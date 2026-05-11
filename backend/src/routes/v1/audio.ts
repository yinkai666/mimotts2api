import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { synthesisService } from '../../services/synthesis.service';
import { voiceService } from '../../services/voice.service';
import { authService } from '../../services/auth.service';
import { extractBearerToken } from '../../middleware/auth';
import { getAudioMimeType } from '../../utils/audio';
import { rateLimit } from '../../middleware/rate-limit';

const speechSchema = z.object({
  input: z.string().min(1).max(4096).optional(),
  text: z.string().min(1).max(4096).optional(),
  voice: z.string(),
  model: z.string().optional(),
  response_format: z.enum(['mp3', 'wav', 'pcm16']).optional(),
  speed: z.number().min(0.25).max(4.0).optional(),
  style: z.string().optional(),
  language: z.string().optional(),
}).refine((data) => data.input || data.text, {
  message: 'Either input or text must be provided',
});

export async function audioRoutes(fastify: FastifyInstance) {
  // POST /v1/audio/speech - 爱阅记兼容接口
  fastify.post('/v1/audio/speech', {
    onRequest: [rateLimit],
  }, async (request, reply) => {
    const startTime = Date.now();

    try {
      // 1. 验证 Bearer Token
      const token = extractBearerToken(request.headers.authorization);
      if (!token) {
        return reply.status(401).send({
          error: {
            message: 'Missing authorization token',
            type: 'invalid_request_error',
            code: 'missing_token',
          },
        });
      }

      const isValidToken = await authService.verifyProxyToken(token);
      if (!isValidToken) {
        return reply.status(401).send({
          error: {
            message: 'Invalid authorization token',
            type: 'invalid_request_error',
            code: 'invalid_token',
          },
        });
      }

      // 2. 解析参数
      const params = speechSchema.parse(request.body);
      const text = params.input || params.text!;
      const format = params.response_format || 'mp3';

      // 3. 查询音色配置
      const voice = await voiceService.getByLocalName(params.voice);
      if (!voice) {
        return reply.status(404).send({
          error: {
            message: `Voice not found: ${params.voice}`,
            type: 'invalid_request_error',
            code: 'voice_not_found',
          },
        });
      }

      // 4. 调用 MiMo Provider
      const result = await synthesisService.synthesize({
        text,
        voice: voice.providerVoiceId || params.voice,
        model: params.model || voice.model,
        format,
        style: params.style,
        speed: params.speed,
        language: params.language,
        voiceLocalName: params.voice,
        clientIp: request.ip,
        userAgent: request.headers['user-agent'],
      });

      // 5. 返回纯音频二进制
      const mimeType = getAudioMimeType(format);
      reply
        .header('Content-Type', mimeType)
        .header('Content-Length', result.audioData.length)
        .header('X-Duration-Ms', result.durationMs?.toString() || '0')
        .send(result.audioData);

      fastify.log.info({
        voice: params.voice,
        textLength: text.length,
        audioSize: result.audioData.length,
        durationMs: Date.now() - startTime,
      }, 'Audio speech generated');

    } catch (error: any) {
      fastify.log.error({ error: error.message }, 'Audio speech failed');

      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: {
            message: 'Invalid request parameters',
            type: 'invalid_request_error',
            code: 'invalid_parameters',
            details: error.errors,
          },
        });
      }

      return reply.status(500).send({
        error: {
          message: error.message || 'Internal server error',
          type: 'server_error',
          code: 'synthesis_failed',
        },
      });
    }
  });

  // GET /v1/audio/speech - 支持 URL 参数
  fastify.get('/v1/audio/speech', {
    onRequest: [rateLimit],
  }, async (request, reply) => {
    try {
      // 验证 Token
      const token = extractBearerToken(request.headers.authorization);
      if (!token) {
        return reply.status(401).send({
          error: {
            message: 'Missing authorization token',
            type: 'invalid_request_error',
            code: 'missing_token',
          },
        });
      }

      const isValidToken = await authService.verifyProxyToken(token);
      if (!isValidToken) {
        return reply.status(401).send({
          error: {
            message: 'Invalid authorization token',
            type: 'invalid_request_error',
            code: 'invalid_token',
          },
        });
      }

      // 从 query 参数解析
      const query = request.query as any;
      const params = speechSchema.parse({
        input: query.input || query.text,
        voice: query.voice,
        model: query.model,
        response_format: query.response_format || query.format,
        speed: query.speed ? parseFloat(query.speed) : undefined,
        style: query.style,
        language: query.language,
      });

      const text = params.input || params.text!;
      const format = params.response_format || 'mp3';

      // 查询音色
      const voice = await voiceService.getByLocalName(params.voice);
      if (!voice) {
        return reply.status(404).send({
          error: {
            message: `Voice not found: ${params.voice}`,
            type: 'invalid_request_error',
            code: 'voice_not_found',
          },
        });
      }

      // 合成
      const result = await synthesisService.synthesize({
        text,
        voice: voice.providerVoiceId || params.voice,
        model: params.model || voice.model,
        format,
        style: params.style,
        speed: params.speed,
        voiceLocalName: params.voice,
        clientIp: request.ip,
        userAgent: request.headers['user-agent'],
      });

      // 返回音频
      const mimeType = getAudioMimeType(format);
      reply
        .header('Content-Type', mimeType)
        .header('Content-Length', result.audioData.length)
        .send(result.audioData);

    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: {
            message: 'Invalid request parameters',
            type: 'invalid_request_error',
            code: 'invalid_parameters',
          },
        });
      }

      return reply.status(500).send({
        error: {
          message: error.message || 'Internal server error',
          type: 'server_error',
          code: 'synthesis_failed',
        },
      });
    }
  });
}
