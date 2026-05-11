import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../src/services/auth.service';
import { comparePassword, hashPassword } from '../src/utils/crypto';

vi.mock('../src/utils/crypto', () => ({
  comparePassword: vi.fn(),
  hashPassword: vi.fn(),
}));

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

describe('AuthService.changePassword', () => {
  const service = new AuthService();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects an incorrect current password without updating the user', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-1',
      username: 'admin',
      password: 'old-hash',
      role: 'admin',
    });
    vi.mocked(comparePassword).mockResolvedValue(false);

    const result = await service.changePassword('user-1', 'wrong-password', 'new-password');

    expect(result).toEqual({ ok: false, reason: 'invalid_current_password' });
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('hashes and stores the new password when the current password is valid', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-1',
      username: 'admin',
      password: 'old-hash',
      role: 'admin',
    });
    vi.mocked(comparePassword).mockResolvedValue(true);
    vi.mocked(hashPassword).mockResolvedValue('new-hash');

    const result = await service.changePassword('user-1', 'old-password', 'new-password');

    expect(result).toEqual({ ok: true });
    expect(hashPassword).toHaveBeenCalledWith('new-password');
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { password: 'new-hash' },
    });
  });
});
