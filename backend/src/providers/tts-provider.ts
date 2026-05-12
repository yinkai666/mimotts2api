export interface SynthesizeParams {
  text: string;
  voice?: string;
  model?: string;
  format?: 'mp3' | 'wav' | 'pcm16';
  style?: string;
  speed?: number;
  language?: string;
  voiceDesignPrompt?: string;
  optimizeTextPreview?: boolean;
}

export interface AudioResult {
  audioData: Buffer;
  format: string;
  durationMs?: number;
}

export interface CustomVoiceParams {
  description: string;
  model: string;
}

export interface CloneVoiceParams {
  audioFile: Buffer;
  fileName: string;
  model: string;
}

export interface VoiceResult {
  voiceId: string;
  provider: string;
  metadata?: any;
}

export interface ProviderVoice {
  id: string;
  name: string;
  language: string;
  gender?: string;
  model: string;
}

export interface TTSProvider {
  synthesizeText(params: SynthesizeParams): Promise<AudioResult>;
  createCustomVoice(params: CustomVoiceParams): Promise<VoiceResult>;
  cloneVoice(params: CloneVoiceParams): Promise<VoiceResult>;
  listProviderVoices(): Promise<ProviderVoice[]>;
}
