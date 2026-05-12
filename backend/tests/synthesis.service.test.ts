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
  },
}));

vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(() => prismaMock),
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
});
