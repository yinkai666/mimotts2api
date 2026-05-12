import { beforeEach, describe, expect, it, vi } from 'vitest';
import axios from 'axios';
import { MiMoProvider } from '../src/providers/mimo-provider';

const postMock = vi.fn();

vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      defaults: { headers: {} },
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
      post: postMock,
    })),
  },
}));

vi.mock('../src/utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe('MiMoProvider VoiceDesign synthesis', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    postMock.mockResolvedValue({
      data: {
        choices: [
          {
            message: {
              audio: {
                data: Buffer.from('audio-bytes').toString('base64'),
              },
            },
          },
        ],
      },
    });
  });

  it('builds a VoiceDesign request with the voice prompt in the user message and no audio voice id', async () => {
    const provider = new MiMoProvider();
    provider.updateConfig('api-key', 'https://api.xiaomimimo.com/v1');

    await provider.synthesizeText({
      text: '今晚的故事，从一盏灯开始。',
      model: 'mimo-v2.5-tts-voicedesign',
      format: 'wav',
      voiceDesignPrompt: '温柔的年轻女性，语速偏慢，适合睡前故事。',
      style: '低声、放松、有轻微气声',
      optimizeTextPreview: true,
    });

    expect(postMock).toHaveBeenCalledWith(
      '/chat/completions',
      expect.objectContaining({
        model: 'mimo-v2.5-tts-voicedesign',
        messages: [
          {
            role: 'user',
            content: '温柔的年轻女性，语速偏慢，适合睡前故事。\n\n低声、放松、有轻微气声',
          },
          {
            role: 'assistant',
            content: '今晚的故事，从一盏灯开始。',
          },
        ],
        audio: {
          format: 'wav',
          optimize_text_preview: true,
        },
      })
    );
    expect(postMock.mock.calls[0][1].audio).not.toHaveProperty('voice');
  });

  it('requires a voice design prompt for VoiceDesign requests', async () => {
    const provider = new MiMoProvider();
    provider.updateConfig('api-key', 'https://api.xiaomimimo.com/v1');

    await expect(
      provider.synthesizeText({
        text: '测试文本',
        model: 'mimo-v2.5-tts-voicedesign',
        format: 'wav',
      })
    ).rejects.toThrow('VoiceDesign requires a voice design prompt');

    expect(postMock).not.toHaveBeenCalled();
  });

  it('keeps built-in voice synthesis compatible with audio voice ids', async () => {
    const provider = new MiMoProvider();
    provider.updateConfig('api-key', 'https://api.xiaomimimo.com/v1');

    await provider.synthesizeText({
      text: '你好',
      voice: '茉莉',
      model: 'mimo-v2.5-tts',
      format: 'mp3',
      style: '开心',
    });

    expect(postMock).toHaveBeenCalledWith(
      '/chat/completions',
      expect.objectContaining({
        model: 'mimo-v2.5-tts',
        messages: [
          { role: 'user', content: '开心' },
          { role: 'assistant', content: '你好' },
        ],
        audio: {
          format: 'mp3',
          voice: '茉莉',
        },
      })
    );
  });
});
