import { FastifyInstance } from 'fastify';
import { synthesisService } from '../services/synthesis.service';

export async function logsRoutes(fastify: FastifyInstance) {
  // 获取合成日志
  fastify.get('/api/logs', {
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const { success, startDate, endDate, limit, offset } = request.query as any;

      const filters: any = {};
      if (success !== undefined) filters.success = success === 'true';
      if (startDate) filters.startDate = new Date(startDate);
      if (endDate) filters.endDate = new Date(endDate);
      if (limit) filters.limit = parseInt(limit, 10);
      if (offset) filters.offset = parseInt(offset, 10);

      const result = await synthesisService.getLogs(filters);
      return result;
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // 获取统计信息
  fastify.get('/api/logs/stats', {
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const stats = await synthesisService.getStats();
      return stats;
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });
}
