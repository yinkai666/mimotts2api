import { PrismaClient } from '@prisma/client';
import { MiMoProvider } from '../providers/mimo-provider';
import { SynthesizeParams } from '../providers/tts-provider';

const prisma = new PrismaClient();

export class SynthesisService {
  private mimoProvider: MiMoProvider;

  constructor() {
    this.mimoProvider = new MiMoProvider();
  }

  async synthesize(params: SynthesizeParams & { voiceLocalName?: string; clientIp?: string; userAgent?: string }) {
    const startTime = Date.now();
    let success = false;
    let errorMessage: string | undefined;
    let audioSize: number | undefined;

    try {
      const result = await this.mimoProvider.synthesizeText(params);
      success = true;
      audioSize = result.audioData.length;

      // 记录日志
      await this.logSynthesis({
        voiceLocalName: params.voiceLocalName,
        providerVoiceId: params.voice,
        model: params.model || 'mimo-v2.5-tts',
        inputText: params.text,
        inputLength: params.text.length,
        format: params.format || 'wav',
        style: params.style,
        speed: params.speed,
        success: true,
        durationMs: Date.now() - startTime,
        audioSize,
        clientIp: params.clientIp,
        userAgent: params.userAgent,
      });

      return result;
    } catch (error: any) {
      success = false;
      errorMessage = error.message;

      // 记录失败日志
      await this.logSynthesis({
        voiceLocalName: params.voiceLocalName,
        providerVoiceId: params.voice,
        model: params.model || 'mimo-v2.5-tts',
        inputText: params.text,
        inputLength: params.text.length,
        format: params.format || 'wav',
        style: params.style,
        speed: params.speed,
        success: false,
        errorMessage,
        durationMs: Date.now() - startTime,
        clientIp: params.clientIp,
        userAgent: params.userAgent,
      });

      throw error;
    }
  }

  private async logSynthesis(data: {
    voiceLocalName?: string;
    providerVoiceId?: string;
    model: string;
    inputText: string;
    inputLength: number;
    format: string;
    style?: string;
    speed?: number;
    success: boolean;
    errorMessage?: string;
    durationMs: number;
    audioSize?: number;
    clientIp?: string;
    userAgent?: string;
  }) {
    try {
      await prisma.synthesisLog.create({
        data,
      });
    } catch (error) {
      console.error('Failed to log synthesis:', error);
    }
  }

  async getLogs(filters?: {
    success?: boolean;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }) {
    const where: any = {};
    if (filters?.success !== undefined) where.success = filters.success;
    if (filters?.startDate || filters?.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = filters.startDate;
      if (filters.endDate) where.createdAt.lte = filters.endDate;
    }

    const [logs, total] = await Promise.all([
      prisma.synthesisLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: filters?.limit || 50,
        skip: filters?.offset || 0,
      }),
      prisma.synthesisLog.count({ where }),
    ]);

    return { logs, total };
  }

  async getStats() {
    const [total, successful, failed] = await Promise.all([
      prisma.synthesisLog.count(),
      prisma.synthesisLog.count({ where: { success: true } }),
      prisma.synthesisLog.count({ where: { success: false } }),
    ]);

    return {
      total,
      successful,
      failed,
      successRate: total > 0 ? (successful / total) * 100 : 0,
    };
  }

  updateMimoApiKey(apiKey: string) {
    this.mimoProvider.updateApiKey(apiKey);
  }
}

export const synthesisService = new SynthesisService();
