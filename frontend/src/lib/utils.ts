import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { AiyuejiConfig, Voice } from '@/types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateAiyuejiConfig(
  voice: Voice,
  proxyUrl: string,
  token?: string,
  format: string = 'mp3'
): AiyuejiConfig {
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return {
    loginUrl: '',
    maxWordCount: '',
    ttsConfigGroup: 'MiMo',
    _ClassName: 'JxdAdvCustomTTS',
    _TTSConfigID: `mimo_${Date.now()}`,
    httpConfigs: {
      useCookies: 1,
      headers: {} as any,
    },
    ttsHandles: [
      {
        finishedRule: '',
        processType: 1,
        maxPageCount: 1,
        method: 0,
        requestByWebView: 0,
        nextPageParams: {} as any,
        parser: {
          playData: 'ResponseData',
        },
        url: `${proxyUrl}/v1/audio/speech`,
        params: {
          input: '%@',
          voice: voice.localName,
          model: voice.model,
          response_format: format,
        },
        httpConfigs: {
          useCookies: 1,
          headers,
        },
      },
    ],
    _TTSName: `MiMo-${voice.displayName}`,
  };
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
