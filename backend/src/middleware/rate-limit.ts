import { FastifyRequest, FastifyReply } from 'fastify';
import { config } from '../config/env';

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

const store: RateLimitStore = {};

export async function rateLimit(request: FastifyRequest, reply: FastifyReply) {
  const clientIp = request.ip;
  const now = Date.now();
  const windowMs = config.rateLimit.windowMs;
  const maxRequests = config.rateLimit.maxRequests;

  if (!store[clientIp] || store[clientIp].resetTime < now) {
    store[clientIp] = {
      count: 1,
      resetTime: now + windowMs,
    };
    return;
  }

  store[clientIp].count++;

  if (store[clientIp].count > maxRequests) {
    reply.status(429).send({
      error: 'Too many requests',
      retryAfter: Math.ceil((store[clientIp].resetTime - now) / 1000),
    });
  }
}

// 清理过期记录
setInterval(() => {
  const now = Date.now();
  Object.keys(store).forEach((key) => {
    if (store[key].resetTime < now) {
      delete store[key];
    }
  });
}, 60000); // 每分钟清理一次
