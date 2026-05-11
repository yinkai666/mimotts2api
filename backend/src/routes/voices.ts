import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { voiceService } from '../services/voice.service';

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

  // 定制音色（TODO）
  fastify.post('/api/voices/custom', {
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    return reply.status(501).send({
      error: 'Not implemented',
      message: 'VoiceDesign feature is pending official API documentation',
    });
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
