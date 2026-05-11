import { FastifyRequest, FastifyReply } from 'fastify';
import { JWTPayload } from '../types';

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch (error) {
    reply.status(401).send({ error: 'Unauthorized' });
  }
}

export function extractBearerToken(authHeader?: string): string | null {
  if (!authHeader) return null;
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null;
  return parts[1];
}