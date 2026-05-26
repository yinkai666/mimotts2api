import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { synthesisService } from '../services/synthesis.service';
import { voiceService } from '../services/voice.service';

const ENDPOINT = '/api/synthesize';

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
    const startTime = Date.now();
    let parsed: z.infer<typeof synthesizeSchema> | null = null;

    try {
      parsed = synthesizeSchema.parse(request.body);

      // 查询音色配置
      const voice = await voiceService.getByLocalName(parsed.voice);
      if (!voice) {
        await synthesisService.logFailedRequest({
          endpoint: ENDPOINT,
          statusCode: 404,
          errorCode: 'voice_not_found',
          errorMessage: `Voice not found: ${parsed.voice}`,
          voiceLocalName: parsed.voice,
          model: parsed.model,
          inputText: parsed.text,
          format: parsed.format || 'mp3',
          style: parsed.style,
          speed: parsed.speed,
          clientIp: request.ip,
          userAgent: request.headers['user-agent'],
          durationMs: Date.now() - startTime,
        });
        return reply.status(404).send({ error: 'Voice not found' });
      }

      // 调用合成服务
      const result = await synthesisService.synthesizeWithVoice({
        text: parsed.text,
        voice,
        model: parsed.model,
        format: parsed.format || 'mp3',
        style: parsed.style,
        speed: parsed.speed,
        clientIp: request.ip,
        userAgent: request.headers['user-agent'],
        endpoint: ENDPOINT,
      });

      // 返回音频
      const mimeType = result.format === 'mp3' ? 'audio/mpeg' : 'audio/wav';
      reply
        .header('Content-Type', mimeType)
        .header('Content-Length', result.audioData.length)
        .header('X-Generation-Ms', (Date.now() - startTime).toString())
        .header('Access-Control-Expose-Headers', 'X-Generation-Ms')
        .send(result.audioData);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        await synthesisService.logFailedRequest({
          endpoint: ENDPOINT,
          statusCode: 400,
          errorCode: 'invalid_parameters',
          errorMessage: error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; '),
          inputText: (request.body as any)?.text,
          clientIp: request.ip,
          userAgent: request.headers['user-agent'],
          durationMs: Date.now() - startTime,
        });
        return reply.status(400).send({ error: 'Invalid request', details: error.errors });
      }
      return reply.status(500).send({ error: error.message });
    }
  });
}
