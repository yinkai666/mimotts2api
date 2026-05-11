export function decodeBase64Audio(base64: string): Buffer {
  return Buffer.from(base64, 'base64');
}

export function getAudioMimeType(format: string): string {
  const mimeTypes: Record<string, string> = {
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    pcm16: 'audio/pcm',
    opus: 'audio/opus',
    aac: 'audio/aac',
    flac: 'audio/flac',
  };
  return mimeTypes[format] || 'audio/mpeg';
}

export function validateAudioFile(mimeType: string, allowedTypes: string[]): boolean {
  return allowedTypes.includes(mimeType);
}
