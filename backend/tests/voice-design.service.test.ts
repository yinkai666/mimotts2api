import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VoiceDesignService } from '../src/services/voice-design.service';

const prismaMock = vi.hoisted(() => ({
  voice: {
    create: vi.fn(),
  },
  uploadFile: {
    create: vi.fn(),
  },
}));

vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(() => prismaMock),
}));

vi.mock('fs/promises', () => ({
  default: {
    mkdir: vi.fn(),
    writeFile: vi.fn(),
  },
  mkdir: vi.fn(),
  writeFile: vi.fn(),
}));

vi.mock('../src/config/env', () => ({
  config: {
    upload: {
      storageDir: 'uploads-test',
      maxSizeMB: 10,
      allowedMimeTypes: ['audio/mpeg', 'audio/wav'],
    },
  },
}));

describe('VoiceDesignService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.uploadFile.create.mockResolvedValue({ id: 'file-1' });
    prismaMock.voice.create.mockResolvedValue({
      id: 'voice-1',
      displayName: '睡前故事女声',
      localName: 'bedtime_voice',
      type: 'custom',
      model: 'mimo-v2.5-tts-voicedesign',
      sampleFilePath: 'uploads-test/voice-samples/sample.wav',
      configJson: '{}',
    });
  });

  it('stores a voice design template and its latest preview audio sample', async () => {
    const service = new VoiceDesignService();

    const voice = await service.saveDesign({
      displayName: '睡前故事女声',
      localName: 'bedtime_voice',
      description: '温柔的年轻女性，语速偏慢，适合睡前故事。',
      previewText: '晚安，今天也辛苦了。',
      style: '轻声、放松',
      format: 'wav',
      optimizeTextPreview: true,
      sampleAudio: Buffer.from('audio-bytes'),
    });

    expect(prismaMock.uploadFile.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        originalName: 'bedtime_voice_sample.wav',
        mimeType: 'audio/wav',
        purpose: 'voice-samples',
        size: Buffer.from('audio-bytes').length,
      }),
    });
    expect(prismaMock.voice.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        displayName: '睡前故事女声',
        localName: 'bedtime_voice',
        provider: 'mimo',
        type: 'custom',
        model: 'mimo-v2.5-tts-voicedesign',
        providerVoiceId: null,
        consent: true,
        isActive: true,
        configJson: JSON.stringify({
          voiceDesignPrompt: '温柔的年轻女性，语速偏慢，适合睡前故事。',
          previewText: '晚安，今天也辛苦了。',
          style: '轻声、放松',
          format: 'wav',
          optimizeTextPreview: true,
        }),
      }),
    });
    expect(voice.id).toBe('voice-1');
  });
});
