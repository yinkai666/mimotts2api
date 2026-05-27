import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SynthesisService } from '../src/services/synthesis.service';

const providerMocks = vi.hoisted(() => ({
  synthesizeText: vi.fn(),
  updateConfig: vi.fn(),
}));

const prismaMock = vi.hoisted(() => ({
  appSetting: {
    findUnique: vi.fn(),
  },
  synthesisLog: {
    create: vi.fn(),
    deleteMany: vi.fn(),
  },
}));

vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(() => prismaMock),
}));

vi.mock('../src/config/env', () => ({
  config: {
    synthesisLog: {
      retentionDays: 30,
      textMode: 'redacted',
    },
  },
}));

vi.mock('../src/providers/mimo-provider', () => ({
  MiMoProvider: vi.fn(() => ({
    updateConfig: providerMocks.updateConfig,
    synthesizeText: providerMocks.synthesizeText,
  })),
}));

describe('SynthesisService VoiceDesign templates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.appSetting.findUnique.mockImplementation(({ where }: any) => {
      if (where.key === 'mimo_api_base_url') {
        return Promise.resolve({ value: 'https://api.xiaomimimo.com/v1' });
      }
      if (where.key === 'mimo_api_key') {
        return Promise.resolve({ value: 'api-key' });
      }
      return Promise.resolve(null);
    });
    providerMocks.synthesizeText.mockResolvedValue({
      audioData: Buffer.from('audio'),
      format: 'mp3',
      durationMs: 10,
    });
    prismaMock.synthesisLog.create.mockResolvedValue({});
    prismaMock.synthesisLog.deleteMany.mockResolvedValue({ count: 0 });
  });

  it('injects saved VoiceDesign config when synthesizing with a custom template voice', async () => {
    const service = new SynthesisService();

    await service.synthesizeWithVoice({
      text: '新的一章开始了。',
      voice: {
        localName: 'bedtime_voice',
        providerVoiceId: null,
        model: 'mimo-v2.5-tts-voicedesign',
        type: 'custom',
        configJson: JSON.stringify({
          voiceDesignPrompt: '温柔的年轻女性，语速偏慢，适合睡前故事。',
          style: '轻声、放松',
          optimizeTextPreview: true,
        }),
      },
      format: 'mp3',
      style: '今晚更像耳语',
      clientIp: '127.0.0.1',
      userAgent: 'vitest',
    });

    expect(providerMocks.synthesizeText).toHaveBeenCalledWith(
      expect.objectContaining({
        text: '新的一章开始了。',
        model: 'mimo-v2.5-tts-voicedesign',
        format: 'mp3',
        voiceLocalName: 'bedtime_voice',
        voiceDesignPrompt: '温柔的年轻女性，语速偏慢，适合睡前故事。',
        style: '今晚更像耳语',
        optimizeTextPreview: true,
      })
    );
    expect(providerMocks.synthesizeText.mock.calls[0][0]).not.toHaveProperty('voice', 'bedtime_voice');
  });

  it('injects saved style preset config when synthesizing with a styled voice entry', async () => {
    const service = new SynthesisService();

    await service.synthesizeWithVoice({
      text: '欢迎来到今晚的故事时间。',
      voice: {
        localName: 'moli_bedtime',
        providerVoiceId: '茉莉',
        model: 'mimo-v2.5-tts',
        type: 'styled',
        configJson: JSON.stringify({
          kind: 'style_preset',
          baseVoiceLocalName: 'moli',
          baseProviderVoiceId: '茉莉',
          style: '轻声、放松，像睡前陪伴',
        }),
      },
      format: 'wav',
      clientIp: '127.0.0.1',
      userAgent: 'vitest',
    });

    expect(providerMocks.synthesizeText).toHaveBeenCalledWith(
      expect.objectContaining({
        text: '欢迎来到今晚的故事时间。',
        voice: '茉莉',
        model: 'mimo-v2.5-tts',
        format: 'wav',
        voiceLocalName: 'moli_bedtime',
        style: '轻声、放松，像睡前陪伴',
      })
    );
  });

  it('prepends saved style tag prefix when synthesizing with an audio-tag-based styled entry', async () => {
    const service = new SynthesisService();

    await service.synthesizeWithVoice({
      text: '欢迎回来，今晚继续读最后一章。',
      voice: {
        localName: 'moli_lazy',
        providerVoiceId: '茉莉',
        model: 'mimo-v2.5-tts',
        type: 'styled',
        configJson: JSON.stringify({
          kind: 'style_preset',
          baseVoiceLocalName: 'moli',
          baseProviderVoiceId: '茉莉',
          style: '',
          tagPrefix: '(慵懒)',
        }),
      },
      format: 'wav',
    });

    expect(providerMocks.synthesizeText).toHaveBeenCalledWith(
      expect.objectContaining({
        text: '(慵懒)欢迎回来，今晚继续读最后一章。',
        voice: '茉莉',
        model: 'mimo-v2.5-tts',
        format: 'wav',
        style: undefined,
      })
    );
  });

  it('redacts input text before storing synthesis logs by default', async () => {
    const service = new SynthesisService();

    await service.synthesizeWithVoice({
      text: '这是一段不应该进入数据库的隐私文本。',
      voice: {
        localName: 'moli_private',
        providerVoiceId: '茉莉',
        model: 'mimo-v2.5-tts',
        type: 'builtin',
        configJson: null,
      },
      format: 'mp3',
    });

    expect(prismaMock.synthesisLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        inputText: expect.stringMatching(/^\[redacted length=\d+ sha256=[a-f0-9]{64}\]$/),
        inputLength: '这是一段不应该进入数据库的隐私文本。'.length,
      }),
    });
    expect(prismaMock.synthesisLog.create.mock.calls[0][0].data.inputText).not.toContain('隐私文本');
  });

  it('deletes synthesis logs older than the configured retention window', async () => {
    const service = new SynthesisService();
    const now = new Date('2026-05-28T12:00:00.000Z');

    await service.cleanupExpiredLogs(now);

    expect(prismaMock.synthesisLog.deleteMany).toHaveBeenCalledWith({
      where: {
        createdAt: {
          lt: new Date('2026-04-28T12:00:00.000Z'),
        },
      },
    });
  });
});
