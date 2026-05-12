import { PrismaClient } from '@prisma/client';
import { comparePassword, hashPassword } from '../utils/crypto';
import { JWTPayload, LoginRequest, LoginResponse } from '../types';

const prisma = new PrismaClient();

export class AuthService {
  async login(data: LoginRequest): Promise<LoginResponse | null> {
    const user = await prisma.user.findUnique({
      where: { username: data.username },
    });

    if (!user) {
      return null;
    }

    const isPasswordValid = await comparePassword(data.password, user.password);
    if (!isPasswordValid) {
      return null;
    }

    return {
      token: '',
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
      },
    };
  }

  async getUserById(userId: string) {
    return prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        role: true,
        createdAt: true,
      },
    });
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<{ ok: boolean; reason?: 'user_not_found' | 'invalid_current_password' }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return { ok: false, reason: 'user_not_found' };
    }

    const isPasswordValid = await comparePassword(currentPassword, user.password);
    if (!isPasswordValid) {
      return { ok: false, reason: 'invalid_current_password' };
    }

    const newPasswordHash = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: userId },
      data: { password: newPasswordHash },
    });

    return { ok: true };
  }

  /**
   * 验证代理 Token（可选）
   * 如果数据库中没有配置 proxy_auth_token，则跳过鉴权
   * 如果配置了，则必须匹配
   */
  async verifyProxyToken(token: string | null): Promise<{ authorized: boolean; reason?: string }> {
    const setting = await prisma.appSetting.findUnique({
      where: { key: 'proxy_auth_token' },
    });

    // 没有配置 Token → 不需要鉴权，直接放行
    if (!setting || !setting.value) {
      return { authorized: true };
    }

    // 配置了 Token 但请求没带 → 拒绝
    if (!token) {
      return { authorized: false, reason: 'missing_token' };
    }

    // Token 不匹配 → 拒绝
    if (setting.value !== token) {
      return { authorized: false, reason: 'invalid_token' };
    }

    return { authorized: true };
  }

  async getProxyToken(): Promise<string> {
    const setting = await prisma.appSetting.findUnique({
      where: { key: 'proxy_auth_token' },
    });

    return setting?.value || '';
  }
}

export const authService = new AuthService();
