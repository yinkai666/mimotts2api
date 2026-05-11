export interface User {
  id: string;
  username: string;
  role: string;
}

export interface Voice {
  id: string;
  displayName: string;
  localName: string;
  provider: string;
  type: 'builtin' | 'custom' | 'cloned';
  model: string;
  providerVoiceId?: string;
  configJson?: string;
  sampleFilePath?: string;
  consent: boolean;
  remark?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SynthesisLog {
  id: string;
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
  durationMs?: number;
  audioSize?: number;
  clientIp?: string;
  createdAt: string;
}

export interface AppSetting {
  id: string;
  key: string;
  value: string;
  masked?: boolean;
}

export interface AiyuejiConfig {
  loginUrl: string;
  maxWordCount: string;
  ttsConfigGroup: string;
  _ClassName: string;
  _TTSConfigID: string;
  httpConfigs: {
    useCookies: number;
    headers: Record<string, any>;
  };
  ttsHandles: Array<{
    finishedRule: string;
    processType: number;
    maxPageCount: number;
    method: number;
    requestByWebView: number;
    nextPageParams: Record<string, any>;
    parser: {
      playData: string;
    };
    url: string;
    params: {
      input: string;
      voice: string;
      model: string;
      response_format: string;
    };
    httpConfigs: {
      useCookies: number;
      headers: {
        Authorization: string;
      };
    };
  }>;
  _TTSName: string;
}
