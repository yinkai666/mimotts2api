import { PrismaClient } from '@prisma/client';
import { Voice } from '@prisma/client';
import { createHash } from 'crypto';
import { config } from '../config/env';
import { MiMoProvider } from '../providers/mimo-provider';
import { SynthesizeParams } from '../providers/tts-provider';

const prisma = new PrismaClient();
const DAY_MS = 24 * 60 * 60 * 1000;
const CLEANUP_INTERVAL_MS = DAY_MS;
const PREVIEW_TEXT_LENGTH = 80;

export type SynthesisLogTextMode = 'redacted' | 'full' | 'preview';

export function formatSynthesisLogInputText(
  inputText: string,
  mode: SynthesisLogTextMode = config.synthesisLog.textMode
): string {
  if (!inputText) return '';
  if (mode === 'full') return inputText;

  const hash = createHash('sha256').update(inputText).digest('hex');
  if (mode === 'preview') {
    const preview =
      inputText.length > PREVIEW_TEXT_LENGTH
        ? `${inputText.slice(0, PREVIEW_TEXT_LENGTH)}...`
        : inputText;
    return `[preview length=${inputText.length} sha256=${hash}] ${preview}`;
  }

  return `[redacted length=${inputText.length} sha256=${hash}]`;
}

export class SynthesisService {
  private mimoProvider: MiMoProvider;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

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

  async synthesize(
    params: SynthesizeParams & {
      voiceLocalName?: string;
      clientIp?: string;
      userAgent?: string;
      endpoint?: string;
    }
  ) {
    const startTime = Date.now();

    try {
      // 每次合成前确保配置是最新的
      await this.ensureConfigLoaded();

      const result = await this.mimoProvider.synthesizeText(params);

      await this.logSynthesis({
        endpoint: params.endpoint,
        voiceLocalName: params.voiceLocalName,
        providerVoiceId: params.voice,
        model: params.model || 'mimo-v2.5-tts',
        inputText: params.text,
        inputLength: params.text.length,
        format: params.format || 'wav',
        style: params.style,
        speed: params.speed,
        success: true,
        statusCode: 200,
        durationMs: Date.now() - startTime,
        audioSize: result.audioData.length,
        clientIp: params.clientIp,
        userAgent: params.userAgent,
      });

      return result;
    } catch (error: any) {
      const { statusCode, errorCode } = classifySynthesisError(error);

      await this.logSynthesis({
        endpoint: params.endpoint,
        voiceLocalName: params.voiceLocalName,
        providerVoiceId: params.voice,
        model: params.model || 'mimo-v2.5-tts',
        inputText: params.text,
        inputLength: params.text.length,
        format: params.format || 'wav',
        style: params.style,
        speed: params.speed,
        success: false,
        statusCode,
        errorCode,
        errorMessage: error.message,
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
    endpoint?: string;
  }) {
    const voiceConfig = this.parseVoiceConfig(params.voice.configJson);
    const isVoiceDesign = params.voice.model === 'mimo-v2.5-tts-voicedesign';

    return this.synthesize({
      text: voiceConfig.tagPrefix && !params.text.trim().startsWith(voiceConfig.tagPrefix)
        ? `${voiceConfig.tagPrefix}${params.text}`
        : params.text,
      voice: isVoiceDesign
        ? undefined
        : voiceConfig.baseProviderVoiceId || params.voice.providerVoiceId || params.voice.localName,
      model: params.model || params.voice.model,
      format: params.format || 'mp3',
      style: (params.style || voiceConfig.style)?.trim() || undefined,
      speed: params.speed,
      language: params.language,
      voiceLocalName: params.voice.localName,
      clientIp: params.clientIp,
      userAgent: params.userAgent,
      endpoint: params.endpoint,
      voiceDesignPrompt: isVoiceDesign ? voiceConfig.voiceDesignPrompt : undefined,
      optimizeTextPreview: isVoiceDesign ? voiceConfig.optimizeTextPreview : undefined,
    });
  }

  /**
   * 记录在合成之前就失败的请求（鉴权失败、参数错误、音色不存在等）
   */
  async logFailedRequest(data: {
    endpoint: string;
    statusCode: number;
    errorCode: string;
    errorMessage: string;
    voiceLocalName?: string;
    providerVoiceId?: string;
    model?: string;
    inputText?: string;
    format?: string;
    style?: string;
    speed?: number;
    clientIp?: string;
    userAgent?: string;
    durationMs?: number;
  }) {
    await this.logSynthesis({
      endpoint: data.endpoint,
      voiceLocalName: data.voiceLocalName,
      providerVoiceId: data.providerVoiceId,
      model: data.model || 'unknown',
      inputText: data.inputText || '',
      inputLength: (data.inputText || '').length,
      format: data.format || 'unknown',
      style: data.style,
      speed: data.speed,
      success: false,
      statusCode: data.statusCode,
      errorCode: data.errorCode,
      errorMessage: data.errorMessage,
      durationMs: data.durationMs,
      clientIp: data.clientIp,
      userAgent: data.userAgent,
    });
  }

  private parseVoiceConfig(configJson?: string | null): {
    voiceDesignPrompt?: string;
    baseVoiceLocalName?: string;
    baseProviderVoiceId?: string;
    style?: string;
    tagPrefix?: string;
    previewText?: string;
    format?: 'mp3' | 'wav' | 'pcm16';
    kind?: string;
    optimizeTextPreview?: boolean;
  } {
    if (!configJson) return {};

    try {
      const parsed = JSON.parse(configJson);
      return {
        kind: parsed.kind,
        voiceDesignPrompt: parsed.voiceDesignPrompt || parsed.description,
        baseVoiceLocalName: parsed.baseVoiceLocalName,
        baseProviderVoiceId: parsed.baseProviderVoiceId,
        style: parsed.style,
        tagPrefix: parsed.tagPrefix,
        previewText: parsed.previewText,
        format: parsed.format,
        optimizeTextPreview: parsed.optimizeTextPreview,
      };
    } catch {
      return {};
    }
  }

  private async logSynthesis(data: {
    endpoint?: string;
    voiceLocalName?: string;
    providerVoiceId?: string;
    model: string;
    inputText: string;
    inputLength: number;
    format: string;
    style?: string;
    speed?: number;
    success: boolean;
    statusCode?: number;
    errorCode?: string;
    errorMessage?: string;
    durationMs?: number;
    audioSize?: number;
    clientIp?: string;
    userAgent?: string;
  }) {
    try {
      await prisma.synthesisLog.create({
        data: {
          ...data,
          inputText: formatSynthesisLogInputText(data.inputText),
        },
      });
    } catch (error) {
      console.error('Failed to log synthesis:', error);
    }
  }

  async cleanupExpiredLogs(now: Date = new Date()) {
    const retentionDays = config.synthesisLog.retentionDays;
    if (!Number.isFinite(retentionDays) || retentionDays <= 0) {
      return { count: 0 };
    }

    const cutoff = new Date(now.getTime() - retentionDays * DAY_MS);
    return prisma.synthesisLog.deleteMany({
      where: {
        createdAt: {
          lt: cutoff,
        },
      },
    });
  }

  startLogRetentionCleanup() {
    if (this.cleanupTimer || config.synthesisLog.retentionDays <= 0) return;

    void this.cleanupExpiredLogs().catch((error) => {
      console.error('Failed to cleanup expired synthesis logs:', error);
    });

    this.cleanupTimer = setInterval(() => {
      void this.cleanupExpiredLogs().catch((error) => {
        console.error('Failed to cleanup expired synthesis logs:', error);
      });
    }, CLEANUP_INTERVAL_MS);

    this.cleanupTimer.unref?.();
  }

  async getLogs(filters?: {
    success?: boolean;
    endpoint?: string;
    errorCode?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }) {
    const where: any = {};
    if (filters?.success !== undefined) where.success = filters.success;
    if (filters?.endpoint) where.endpoint = filters.endpoint;
    if (filters?.errorCode) where.errorCode = filters.errorCode;
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
    const now = Date.now();
    const oneMinuteAgo = new Date(now - 60 * 1000);
    const oneHourAgo = new Date(now - 60 * 60 * 1000);
    const twentyFourHoursAgo = new Date(now - 24 * 60 * 60 * 1000);

    const [
      total,
      successful,
      failed,
      lastMinute,
      lastHour,
      last24Hours,
      last24HoursFailed,
      avgDuration,
    ] = await Promise.all([
      prisma.synthesisLog.count(),
      prisma.synthesisLog.count({ where: { success: true } }),
      prisma.synthesisLog.count({ where: { success: false } }),
      prisma.synthesisLog.count({ where: { createdAt: { gte: oneMinuteAgo } } }),
      prisma.synthesisLog.count({ where: { createdAt: { gte: oneHourAgo } } }),
      prisma.synthesisLog.count({ where: { createdAt: { gte: twentyFourHoursAgo } } }),
      prisma.synthesisLog.count({
        where: { createdAt: { gte: twentyFourHoursAgo }, success: false },
      }),
      prisma.synthesisLog.aggregate({
        where: { createdAt: { gte: oneHourAgo }, success: true },
        _avg: { durationMs: true },
      }),
    ]);

    return {
      total,
      successful,
      failed,
      successRate: total > 0 ? (successful / total) * 100 : 0,
      rpm: lastMinute,
      requestsLastHour: lastHour,
      requestsLast24h: last24Hours,
      failedLast24h: last24HoursFailed,
      avgDurationMs: avgDuration._avg.durationMs ?? 0,
    };
  }

  /**
   * RPM 时序数据：按时间桶聚合
   * range='hour'：最近 60 分钟，每分钟一个桶
   * range='day'：最近 24 小时，每 10 分钟一个桶（共 144 桶）
   */
  async getTimeseries(range: 'hour' | 'day') {
    const now = Date.now();
    const bucketMs = range === 'hour' ? 60 * 1000 : 10 * 60 * 1000;
    const bucketCount = range === 'hour' ? 60 : 144;
    const windowMs = bucketMs * bucketCount;
    const since = new Date(now - windowMs);

    const logs = await prisma.synthesisLog.findMany({
      where: { createdAt: { gte: since } },
      select: { createdAt: true, success: true },
    });

    const startMs = Math.floor((now - windowMs) / bucketMs) * bucketMs;
    const buckets: Array<{ t: number; total: number; success: number; failed: number }> = [];
    for (let i = 0; i < bucketCount; i++) {
      buckets.push({ t: startMs + i * bucketMs, total: 0, success: 0, failed: 0 });
    }

    for (const log of logs) {
      const idx = Math.floor((log.createdAt.getTime() - startMs) / bucketMs);
      if (idx < 0 || idx >= bucketCount) continue;
      buckets[idx].total++;
      if (log.success) buckets[idx].success++;
      else buckets[idx].failed++;
    }

    return {
      range,
      bucketMs,
      buckets: buckets.map((b) => ({
        time: new Date(b.t).toISOString(),
        total: b.total,
        success: b.success,
        failed: b.failed,
      })),
    };
  }

  /**
   * 按错误代码聚合最近一段时间的失败请求
   */
  async getErrorDistribution(range: 'hour' | 'day' | 'all' = 'day') {
    const where: any = { success: false };
    if (range !== 'all') {
      const windowMs = range === 'hour' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
      where.createdAt = { gte: new Date(Date.now() - windowMs) };
    }

    const grouped = await prisma.synthesisLog.groupBy({
      by: ['errorCode', 'statusCode'],
      where,
      _count: { _all: true },
    });

    return grouped
      .map((g) => ({
        errorCode: g.errorCode || 'unknown',
        statusCode: g.statusCode,
        count: g._count._all,
      }))
      .sort((a, b) => b.count - a.count);
  }

  updateMimoConfig(apiKey: string, baseUrl: string) {
    this.mimoProvider.updateConfig(apiKey, baseUrl);
  }
}

/**
 * 把合成阶段的错误归类为 (statusCode, errorCode)
 * - 上游有 status：直接透传
 * - "未配置"：503 / mimo_unconfigured
 * - 其他：500 / synthesis_failed
 */
function classifySynthesisError(error: any): { statusCode: number; errorCode: string } {
  const upstreamStatus: number | undefined = error?.upstreamStatus;
  const upstreamCode: string | undefined = error?.upstreamCode;
  const msg: string = error?.message || '';

  if (upstreamStatus) {
    if (upstreamStatus === 401 || upstreamStatus === 403) {
      return { statusCode: 502, errorCode: upstreamCode || 'mimo_unauthorized' };
    }
    if (upstreamStatus === 429) {
      return { statusCode: 502, errorCode: upstreamCode || 'mimo_rate_limited' };
    }
    if (upstreamStatus >= 500) {
      return { statusCode: 502, errorCode: upstreamCode || 'mimo_upstream_error' };
    }
    return { statusCode: 502, errorCode: upstreamCode || `mimo_${upstreamStatus}` };
  }

  if (/未配置|not configured|API 未配置/i.test(msg)) {
    return { statusCode: 503, errorCode: 'mimo_unconfigured' };
  }
  if (/No audio data/i.test(msg)) {
    return { statusCode: 502, errorCode: 'mimo_empty_response' };
  }
  if (/voice design prompt/i.test(msg)) {
    return { statusCode: 400, errorCode: 'invalid_voice_design' };
  }

  return { statusCode: 500, errorCode: 'synthesis_failed' };
}

export const synthesisService = new SynthesisService();
