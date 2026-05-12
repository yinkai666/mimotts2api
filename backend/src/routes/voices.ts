import { FastifyInstance } from 'fastify';
import fs from 'fs/promises';
import path from 'path';
import { z } from 'zod';
import { voiceService } from '../services/voice.service';
import { synthesisService } from '../services/synthesis.service';
import { voiceDesignService } from '../services/voice-design.service';
import { getAudioMimeType } from '../utils/audio';

const createVoiceSchema = z.object({
  displayName: z.string().min(1),
  localName: z.string().regex(/^[a-z0-9_]+$/),
  type: z.enum(['builtin', 'custom', 'cloned']),
  model: z.string(),
  providerVoiceId: z.string().optional(),
  configJson: z.string().optional(),
  sampleFilePath: z.string().optional(),
  consent: z.boolean().optional(),
  remark: z.string().optional(),
});

const updateVoiceSchema = createVoiceSchema.partial();

const voiceDesignSchema = z.object({
  displayName: z.string().min(1).optional(),
  localName: z.string().regex(/^[a-z0-9_]+$/).optional(),
  description: z.string().min(1).max(2000),
  previewText: z.string().min(1).max(4096),
  style: z.string().max(1000).optional(),
  format: z.enum(['mp3', 'wav', 'pcm16']).default('wav'),
  optimizeTextPreview: z.boolean().optional(),
  sampleAudioBase64: z.string().optional(),
});

const styledVoiceBaseSchema = z.object({
  displayName: z.string().min(1).optional(),
  localName: z.string().regex(/^[a-z0-9_]+$/).optional(),
  baseVoiceLocalName: z.string().min(1),
  style: z.string().max(1000).optional(),
  previewText: z.string().min(1).max(4096),
  format: z.enum(['mp3', 'wav', 'pcm16']).default('wav'),
  sampleAudioBase64: z.string().optional(),
});

const styledVoiceSchema = styledVoiceBaseSchema.refine((data) => {
  const text = data.previewText.trim();
  return Boolean(data.style?.trim()) || /^[\(\[（][^)\]）]{1,100}[\)\]）]/.test(text);
}, {
  message: '请填写风格控制，或在预览文本开头使用整体风格标签',
  path: ['style'],
});

function extractLeadingTagPrefix(text: string): string | undefined {
  const trimmed = text.trim();
  const match = trimmed.match(/^([\(\[（][^)\]）]{1,100}[\)\]）])/);
  return match?.[1];
}

function buildSampleUrl(id: string) {
  return `/api/voices/${id}/sample`;
}

export async function voiceRoutes(fastify: FastifyInstance) {
  // 获取音色列表
  fastify.get('/api/voices', {
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const { type, isActive } = request.query as any;
      const filters: any = {};
      if (type) filters.type = type;
      if (isActive !== undefined) filters.isActive = isActive === 'true';

      const voices = await voiceService.getAll(filters);
      return voices;
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // 获取内置音色
  fastify.get('/api/voices/builtin', async (request, reply) => {
    try {
      const voices = await voiceService.getAll({ type: 'builtin', isActive: true });
      return voices;
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // 获取单个音色
  fastify.get('/api/voices/:id', {
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const voice = await voiceService.getById(id);
      if (!voice) {
        return reply.status(404).send({ error: 'Voice not found' });
      }
      return voice;
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // 创建音色
  fastify.post('/api/voices', {
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const data = createVoiceSchema.parse(request.body);
      const voice = await voiceService.create(data);
      return voice;
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Invalid request', details: error.errors });
      }
      return reply.status(500).send({ error: error.message });
    }
  });

  // 更新音色
  fastify.put('/api/voices/:id', {
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const data = updateVoiceSchema.parse(request.body);
      const voice = await voiceService.update(id, data);
      return voice;
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Invalid request', details: error.errors });
      }
      return reply.status(500).send({ error: error.message });
    }
  });

  // 删除音色
  fastify.delete('/api/voices/:id', {
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      await voiceService.delete(id);
      return { message: 'Voice deleted successfully' };
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // 定制音色预览
  fastify.post('/api/voices/custom/preview', {
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const params = voiceDesignSchema.parse(request.body);
      const result = await synthesisService.synthesize({
        text: params.previewText,
        model: 'mimo-v2.5-tts-voicedesign',
        format: params.format,
        style: params.style,
        voiceDesignPrompt: params.description,
        optimizeTextPreview: params.optimizeTextPreview,
        clientIp: request.ip,
        userAgent: request.headers['user-agent'],
      });

      return reply
        .header('Content-Type', getAudioMimeType(result.format))
        .header('Content-Length', result.audioData.length)
        .send(result.audioData);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Invalid request', details: error.errors });
      }
      return reply.status(500).send({ error: error.message });
    }
  });

  // 定制音色
  fastify.post('/api/voices/custom', {
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const params = voiceDesignSchema.required({
        displayName: true,
        localName: true,
      }).parse(request.body);

      let sampleAudio: Buffer | undefined = params.sampleAudioBase64
        ? Buffer.from(params.sampleAudioBase64, 'base64') as Buffer
        : undefined;

      if (!sampleAudio) {
        const result = await synthesisService.synthesize({
          text: params.previewText,
          model: 'mimo-v2.5-tts-voicedesign',
          format: params.format,
          style: params.style,
          voiceDesignPrompt: params.description,
          optimizeTextPreview: params.optimizeTextPreview,
          clientIp: request.ip,
          userAgent: request.headers['user-agent'],
        });
        sampleAudio = result.audioData;
      }

      const voice = await voiceDesignService.saveDesign({
        displayName: params.displayName,
        localName: params.localName,
        description: params.description,
        previewText: params.previewText,
        style: params.style,
        format: params.format,
        optimizeTextPreview: params.optimizeTextPreview,
        sampleAudio,
      });

      return {
        ...voice,
        sampleUrl: buildSampleUrl(voice.id),
      };
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Invalid request', details: error.errors });
      }
      if (error.code === 'P2002') {
        return reply.status(409).send({ error: 'Local name already exists' });
      }
      return reply.status(500).send({ error: error.message });
    }
  });

  // 风格模板预览
  fastify.post('/api/voices/styled/preview', {
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const params = styledVoiceSchema.parse(request.body);
      const baseVoice = await voiceService.getByLocalName(params.baseVoiceLocalName);
      if (!baseVoice) {
        return reply.status(404).send({ error: 'Base voice not found' });
      }
      if (baseVoice.model !== 'mimo-v2.5-tts') {
        return reply.status(400).send({ error: 'Styled presets only support mimo-v2.5-tts voices' });
      }

      const result = await synthesisService.synthesize({
        text: params.previewText,
        model: 'mimo-v2.5-tts',
        voice: baseVoice.providerVoiceId || baseVoice.localName,
        format: params.format,
        style: params.style,
        clientIp: request.ip,
        userAgent: request.headers['user-agent'],
      });

      return reply
        .header('Content-Type', getAudioMimeType(result.format))
        .header('Content-Length', result.audioData.length)
        .send(result.audioData);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Invalid request', details: error.errors });
      }
      return reply.status(500).send({ error: error.message });
    }
  });

  // 风格模板
  fastify.post('/api/voices/styled', {
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const params = styledVoiceBaseSchema.required({
        displayName: true,
        localName: true,
      }).refine((data) => {
        const text = data.previewText.trim();
        return Boolean(data.style?.trim()) || /^[\(\[（][^)\]）]{1,100}[\)\]）]/.test(text);
      }, {
        message: '请填写风格控制，或在预览文本开头使用整体风格标签',
        path: ['style'],
      }).parse(request.body);

      const baseVoice = await voiceService.getByLocalName(params.baseVoiceLocalName);
      if (!baseVoice) {
        return reply.status(404).send({ error: 'Base voice not found' });
      }
      if (baseVoice.model !== 'mimo-v2.5-tts') {
        return reply.status(400).send({ error: 'Styled presets only support mimo-v2.5-tts voices' });
      }

      let sampleAudio: Buffer | undefined = params.sampleAudioBase64
        ? Buffer.from(params.sampleAudioBase64, 'base64') as Buffer
        : undefined;

      if (!sampleAudio) {
        const result = await synthesisService.synthesize({
          text: params.previewText,
          model: 'mimo-v2.5-tts',
          voice: baseVoice.providerVoiceId || baseVoice.localName,
          format: params.format,
          style: params.style,
          clientIp: request.ip,
          userAgent: request.headers['user-agent'],
        });
        sampleAudio = result.audioData;
      }

      const voice = await voiceDesignService.saveStyledPreset({
        displayName: params.displayName,
        localName: params.localName,
        baseVoiceLocalName: baseVoice.localName,
        baseProviderVoiceId: baseVoice.providerVoiceId || baseVoice.localName,
        style: params.style,
        tagPrefix: extractLeadingTagPrefix(params.previewText),
        previewText: params.previewText,
        format: params.format,
        sampleAudio,
      });

      return {
        ...voice,
        sampleUrl: buildSampleUrl(voice.id),
      };
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Invalid request', details: error.errors });
      }
      if (error.code === 'P2002') {
        return reply.status(409).send({ error: 'Local name already exists' });
      }
      return reply.status(500).send({ error: error.message });
    }
  });

  // 播放音色样例
  fastify.get('/api/voices/:id/sample', {
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const voice = await voiceService.getById(id);
      if (!voice?.sampleFilePath) {
        return reply.status(404).send({ error: 'Voice sample not found' });
      }

      const audio = await fs.readFile(voice.sampleFilePath);
      const ext = path.extname(voice.sampleFilePath).replace('.', '');
      const format = ext === 'pcm' ? 'pcm16' : ext || 'mp3';

      return reply
        .header('Content-Type', getAudioMimeType(format))
        .header('Content-Length', audio.length)
        .send(audio);
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // 复刻音色（TODO）
  fastify.post('/api/voices/clone', {
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    return reply.status(501).send({
      error: 'Not implemented',
      message: 'VoiceClone feature is pending official API documentation',
    });
  });
}
