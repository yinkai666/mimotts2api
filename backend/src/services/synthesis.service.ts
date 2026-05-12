import { PrismaClient } from '@prisma/client';
import { Voice } from '@prisma/client';
import { MiMoProvider } from '../providers/mimo-provider';
import { SynthesizeParams } from '../providers/tts-provider';

const prisma = new PrismaClient();

export class SynthesisService {
  private mimoProvider: MiMoProvider;

  constructor() {
    this.mimoProvider = new MiMoProvider();
  }

  /**
   * 从数据库加载 MiMo 配置并更新 Provider
   */
  async ensureConfigLoaded() {
    const [urlSetting, keySetting] = await Promise.all([
      prisma.appSetting.findUnique({ where: { key: 'mimo_api_base_url' } }),
      prisma.appSetting.findUnique({ where: { key: 'mimo_api_key' } }),
    ]);

    const url = urlSetting?.value || '';
    const key = keySetting?.value || '';

    if (url && key) {
      this.mimoProvider.updateConfig(key, url);
    }
  }

  async synthesize(params: SynthesizeParams & { voiceLocalName?: string; clientIp?: string; userAgent?: string }) {
    const startTime = Date.now();
    let success = false;
    let errorMessage: string | undefined;
    let audioSize: number | undefined;

    try {
      // 每次合成前确保配置是最新的
      await this.ensureConfigLoaded();

      const result = await this.mimoProvider.synthesizeText(params);
      success = true;
      audioSize = result.audioData.length;

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

  async synthesizeWithVoice(params: {
    text: string;
    voice: Pick<Voice, 'localName' | 'providerVoiceId' | 'model' | 'type' | 'configJson'>;
    model?: string;
    format?: 'mp3' | 'wav' | 'pcm16';
    style?: string;
    speed?: number;
    language?: string;
    clientIp?: string;
    userAgent?: string;
  }) {
    const voiceConfig = this.parseVoiceConfig(params.voice.configJson);
    const isVoiceDesign = params.voice.model === 'mimo-v2.5-tts-voicedesign';

    return this.synthesize({
      text: params.text,
      voice: isVoiceDesign ? undefined : params.voice.providerVoiceId || params.voice.localName,
      model: params.model || params.voice.model,
      format: params.format || 'mp3',
      style: params.style || voiceConfig.style,
      speed: params.speed,
      language: params.language,
      voiceLocalName: params.voice.localName,
      clientIp: params.clientIp,
      userAgent: params.userAgent,
      voiceDesignPrompt: isVoiceDesign ? voiceConfig.voiceDesignPrompt : undefined,
      optimizeTextPreview: isVoiceDesign ? voiceConfig.optimizeTextPreview : undefined,
    });
  }

  private parseVoiceConfig(configJson?: string | null): {
    voiceDesignPrompt?: string;
    style?: string;
    optimizeTextPreview?: boolean;
  } {
    if (!configJson) return {};

    try {
      const parsed = JSON.parse(configJson);
      return {
        voiceDesignPrompt: parsed.voiceDesignPrompt || parsed.description,
        style: parsed.style,
        optimizeTextPreview: parsed.optimizeTextPreview,
      };
    } catch {
      return {};
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
      await prisma.synthesisLog.create({ data });
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

  updateMimoConfig(apiKey: string, baseUrl: string) {
    this.mimoProvider.updateConfig(apiKey, baseUrl);
  }
}

export const synthesisService = new SynthesisService();
