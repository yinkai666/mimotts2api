import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../src/services/auth.service';

const prismaMock = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  appSetting: {
    findUnique: vi.fn(),
  },
}));

vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(() => prismaMock),
}));

describe('AuthService.getProxyToken', () => {
  const service = new AuthService();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the configured proxy token value', async () => {
    prismaMock.appSetting.findUnique.mockResolvedValue({
      key: 'proxy_auth_token',
      value: 'token-123456',
    });

    const token = await service.getProxyToken();

    expect(token).toBe('token-123456');
    expect(prismaMock.appSetting.findUnique).toHaveBeenCalledWith({
      where: { key: 'proxy_auth_token' },
    });
  });

  it('returns an empty string when no proxy token is configured', async () => {
    prismaMock.appSetting.findUnique.mockResolvedValue(null);

    const token = await service.getProxyToken();

    expect(token).toBe('');
  });
});
