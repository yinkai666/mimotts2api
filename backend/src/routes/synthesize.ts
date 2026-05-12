import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { synthesisService } from '../services/synthesis.service';
import { voiceService } from '../services/voice.service';

const synthesizeSchema = z.object({
  text: z.string().min(1).max(4096),
  voice: z.string(),
  model: z.string().optional(),
  format: z.enum(['mp3', 'wav', 'pcm16']).optional(),
  style: z.string().optional(),
  speed: z.number().min(0.25).max(4.0).optional(),
  language: z.string().optional(),
});

export async function synthesizeRoutes(fastify: FastifyInstance) {
  // 测试合成
  fastify.post('/api/synthesize', {
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const params = synthesizeSchema.parse(request.body);

      // 查询音色配置
      const voice = await voiceService.getByLocalName(params.voice);
      if (!voice) {
        return reply.status(404).send({ error: 'Voice not found' });
      }

      // 调用合成服务
      const result = await synthesisService.synthesizeWithVoice({
        text: params.text,
        voice,
        model: params.model,
        format: params.format || 'mp3',
        style: params.style,
        speed: params.speed,
        clientIp: request.ip,
        userAgent: request.headers['user-agent'],
      });

      // 返回音频
      const mimeType = result.format === 'mp3' ? 'audio/mpeg' : 'audio/wav';
      reply
        .header('Content-Type', mimeType)
        .header('Content-Length', result.audioData.length)
        .send(result.audioData);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Invalid request', details: error.errors });
      }
      return reply.status(500).send({ error: error.message });
    }
  });
}
