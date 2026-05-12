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
  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
  };
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
      headers,
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

export function buildMimoCurlPreview(options: {
  apiBaseUrl?: string;
  model: string;
  format: string;
  assistantText?: string;
  userContent?: string;
  voice?: string;
  optimizeTextPreview?: boolean;
}): string {
  const messages = [];
  if (options.userContent?.trim()) {
    messages.push({
      role: 'user',
      content: options.userContent.trim(),
    });
  }
  if (options.assistantText?.trim()) {
    messages.push({
      role: 'assistant',
      content: options.assistantText.trim(),
    });
  }

  const audio: Record<string, unknown> = {
    format: options.format,
  };

  if (options.voice) {
    audio.voice = options.voice;
  }
  if (options.optimizeTextPreview !== undefined) {
    audio.optimize_text_preview = options.optimizeTextPreview;
  }

  const payload = JSON.stringify({
    model: options.model,
    messages,
    audio,
  }, null, 2);

  const baseUrl = options.apiBaseUrl || 'https://api.xiaomimimo.com/v1';
  return [
    `curl --location --request POST '${baseUrl}/chat/completions' \\`,
    '--header "api-key: <MIMO_API_KEY>" \\',
    "--header 'Content-Type: application/json' \\",
    `--data-raw '${payload}'`,
  ].join('\n');
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
