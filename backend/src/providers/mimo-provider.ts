import axios, { AxiosInstance } from 'axios';
import {
  TTSProvider,
  SynthesizeParams,
  AudioResult,
  CustomVoiceParams,
  CloneVoiceParams,
  VoiceResult,
  ProviderVoice,
} from './tts-provider';
import { logger } from '../utils/logger';

export class MiMoProvider implements TTSProvider {
  private httpClient: AxiosInstance;
  private apiKey: string = '';
  private baseUrl: string = '';

  constructor() {
    // 初始化一个空的 httpClient，后续通过 updateConfig 动态配置
    this.httpClient = axios.create({
      timeout: 60000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    this.httpClient.interceptors.request.use((config) => {
      logger.debug({ url: config.url, method: config.method }, 'MiMo API request');
      return config;
    });

    this.httpClient.interceptors.response.use(
      (response) => {
        logger.debug({ status: response.status }, 'MiMo API response');
        return response;
      },
      (error) => {
        logger.error(
          {
            message: error.message,
            response: error.response?.data,
            status: error.response?.status,
          },
          'MiMo API error'
        );
        throw error;
      }
    );
  }

  /**
   * 动态更新 MiMo API 配置（从数据库读取后调用）
   */
  updateConfig(apiKey: string, baseUrl: string) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;

    this.httpClient.defaults.baseURL = baseUrl;
    this.httpClient.defaults.headers['api-key'] = apiKey;
  }

  /**
   * 检查是否已配置
   */
  isConfigured(): boolean {
    return !!(this.apiKey && this.baseUrl);
  }

  async synthesizeText(params: SynthesizeParams): Promise<AudioResult> {
    if (!this.isConfigured()) {
      throw new Error('MiMo API 未配置，请在设置页面填写 API URL 和 API Key');
    }

    const startTime = Date.now();

    try {
      // 构建消息
      const messages: Array<{ role: string; content: string }> = [];

      // 如果有风格描述，添加到 user 消息
      if (params.style) {
        messages.push({
          role: 'user',
          content: params.style,
        });
      }

      // 待合成文本必须在 assistant 消息中
      messages.push({
        role: 'assistant',
        content: params.text,
      });

      const requestBody = {
        model: params.model || 'mimo-v2.5-tts',
        messages,
        audio: {
          format: params.format || 'wav',
          voice: params.voice,
        },
      };

      logger.info({ voice: params.voice, textLength: params.text.length }, 'Synthesizing text');

      const response = await this.httpClient.post('/chat/completions', requestBody);

      // 提取 Base64 音频数据
      const audioBase64 = response.data.choices?.[0]?.message?.audio?.data;

      if (!audioBase64) {
        throw new Error('No audio data in response');
      }

      // 解码为 Buffer
      const audioBuffer = Buffer.from(audioBase64, 'base64');
      const durationMs = Date.now() - startTime;

      logger.info(
        {
          audioSize: audioBuffer.length,
          durationMs,
          format: params.format || 'wav',
        },
        'Synthesis completed'
      );

      return {
        audioData: audioBuffer,
        format: params.format || 'wav',
        durationMs,
      };
    } catch (error: any) {
      const durationMs = Date.now() - startTime;
      logger.error(
        {
          error: error.message,
          durationMs,
          voice: params.voice,
        },
        'Synthesis failed'
      );
      throw new Error(`MiMo synthesis failed: ${error.message}`);
    }
  }

  async createCustomVoice(params: CustomVoiceParams): Promise<VoiceResult> {
    // TODO: 等待 MiMo 官方文档确认 VoiceDesign 接口
    throw new Error('VoiceDesign not implemented - waiting for official API documentation');
  }

  async cloneVoice(params: CloneVoiceParams): Promise<VoiceResult> {
    // TODO: 等待 MiMo 官方文档确认 VoiceClone 接口
    throw new Error('VoiceClone not implemented - waiting for official API documentation');
  }

  async listProviderVoices(): Promise<ProviderVoice[]> {
    return [
      // V2 版本
      { id: 'mimo_default', name: 'MiMo 默认', language: 'zh', model: 'mimo-v2-tts' },
      { id: 'default_zh', name: 'MiMo 中文女声', language: 'zh', gender: 'female', model: 'mimo-v2-tts' },
      { id: 'default_en', name: 'MiMo 英文女声', language: 'en', gender: 'female', model: 'mimo-v2-tts' },
      // V2.5 版本 - 中文
      { id: '冰糖', name: '冰糖', language: 'zh', model: 'mimo-v2.5-tts' },
      { id: '茉莉', name: '茉莉', language: 'zh', model: 'mimo-v2.5-tts' },
      { id: '苏打', name: '苏打', language: 'zh', model: 'mimo-v2.5-tts' },
      { id: '白桦', name: '白桦', language: 'zh', model: 'mimo-v2.5-tts' },
      // V2.5 版本 - 英文
      { id: 'Mia', name: 'Mia', language: 'en', gender: 'female', model: 'mimo-v2.5-tts' },
      { id: 'Chloe', name: 'Chloe', language: 'en', gender: 'female', model: 'mimo-v2.5-tts' },
      { id: 'Milo', name: 'Milo', language: 'en', gender: 'male', model: 'mimo-v2.5-tts' },
      { id: 'Dean', name: 'Dean', language: 'en', gender: 'male', model: 'mimo-v2.5-tts' },
    ];
  }
}
