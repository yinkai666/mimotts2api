import { FastifyInstance } from 'fastify';
import { synthesisService } from '../services/synthesis.service';

export async function logsRoutes(fastify: FastifyInstance) {
  // 获取合成日志（支持 success / endpoint / errorCode / 时间范围筛选 + 分页）
  fastify.get('/api/logs', {
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const { success, endpoint, errorCode, startDate, endDate, limit, offset } = request.query as any;

      const filters: any = {};
      if (success !== undefined && success !== '') filters.success = success === 'true';
      if (endpoint) filters.endpoint = endpoint;
      if (errorCode) filters.errorCode = errorCode;
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

  // 获取统计信息（总览卡片用）
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

  // RPM 时序数据（图表用）
  fastify.get('/api/logs/timeseries', {
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const { range } = request.query as any;
      const r: 'hour' | 'day' = range === 'day' ? 'day' : 'hour';
      const data = await synthesisService.getTimeseries(r);
      return data;
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // 错误代码分布
  fastify.get('/api/logs/errors', {
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const { range } = request.query as any;
      const r: 'hour' | 'day' | 'all' =
        range === 'hour' ? 'hour' : range === 'all' ? 'all' : 'day';
      const data = await synthesisService.getErrorDistribution(r);
      return { range: r, items: data };
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });
}
