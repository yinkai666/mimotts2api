import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authService } from '../services/auth.service';
import { config } from '../config/env';

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export async function authRoutes(fastify: FastifyInstance) {
  // 登录
  fastify.post('/api/auth/login', async (request, reply) => {
    try {
      const body = loginSchema.parse(request.body);
      const result = await authService.login(body);

      if (!result) {
        return reply.status(401).send({ error: 'Invalid credentials' });
      }

      const token = fastify.jwt.sign({
        userId: result.user.id,
        username: result.user.username,
        role: result.user.role,
      });

      return {
        token,
        user: result.user,
      };
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Invalid request', details: error.errors });
      }
      return reply.status(500).send({ error: error.message });
    }
  });

  // 获取当前用户信息
  fastify.get('/api/auth/me', {
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const user = await authService.getUserById(request.user!.userId);
      if (!user) {
        return reply.status(404).send({ error: 'User not found' });
      }
      return user;
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // 登出（客户端删除 token 即可，这里只是占位）
  fastify.post('/api/auth/logout', {
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    return { message: 'Logged out successfully' };
  });
}
