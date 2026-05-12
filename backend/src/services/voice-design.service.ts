import { PrismaClient, Voice } from '@prisma/client';
import fs from 'fs/promises';
import path from 'path';
import { config } from '../config/env';
import { getAudioMimeType } from '../utils/audio';

const prisma = new PrismaClient();

export interface SaveVoiceDesignParams {
  displayName: string;
  localName: string;
  description: string;
  previewText: string;
  style?: string;
  format: 'mp3' | 'wav' | 'pcm16';
  optimizeTextPreview?: boolean;
  sampleAudio: Buffer;
}

export interface SaveStyledPresetParams {
  displayName: string;
  localName: string;
  baseVoiceLocalName: string;
  baseProviderVoiceId: string;
  style?: string;
  tagPrefix?: string;
  previewText: string;
  format: 'mp3' | 'wav' | 'pcm16';
  sampleAudio: Buffer;
}

export class VoiceDesignService {
  async saveDesign(params: SaveVoiceDesignParams): Promise<Voice> {
    const sampleFilePath = await this.saveSampleAudio(
      params.localName,
      params.format,
      params.sampleAudio
    );

    return prisma.voice.create({
      data: {
        displayName: params.displayName,
        localName: params.localName,
        provider: 'mimo',
        type: 'custom',
        model: 'mimo-v2.5-tts-voicedesign',
        providerVoiceId: null,
        configJson: JSON.stringify({
          voiceDesignPrompt: params.description,
          previewText: params.previewText,
          style: params.style,
          format: params.format,
          optimizeTextPreview: params.optimizeTextPreview,
        }),
        sampleFilePath,
        consent: true,
        isActive: true,
      },
    });
  }

  async saveStyledPreset(params: SaveStyledPresetParams): Promise<Voice> {
    const sampleFilePath = await this.saveSampleAudio(
      params.localName,
      params.format,
      params.sampleAudio
    );

    return prisma.voice.create({
      data: {
        displayName: params.displayName,
        localName: params.localName,
        provider: 'mimo',
        type: 'styled',
        model: 'mimo-v2.5-tts',
        providerVoiceId: params.baseProviderVoiceId,
        configJson: JSON.stringify({
          kind: 'style_preset',
          baseVoiceLocalName: params.baseVoiceLocalName,
          baseProviderVoiceId: params.baseProviderVoiceId,
          style: params.style,
          tagPrefix: params.tagPrefix,
          previewText: params.previewText,
          format: params.format,
        }),
        sampleFilePath,
        consent: true,
        isActive: true,
      },
    });
  }

  private async saveSampleAudio(localName: string, format: string, audio: Buffer): Promise<string> {
    const extension = format === 'mp3' ? 'mp3' : format === 'pcm16' ? 'pcm' : 'wav';
    const safeLocalName = localName.replace(/[^a-z0-9_]/g, '_');
    const fileName = `${Date.now()}_${safeLocalName}_sample.${extension}`;
    const uploadDir = path.join(config.upload.storageDir, 'voice-samples');
    const filePath = path.join(uploadDir, fileName);

    await fs.mkdir(uploadDir, { recursive: true });
    await fs.writeFile(filePath, audio);

    await prisma.uploadFile.create({
      data: {
        fileName,
        originalName: `${safeLocalName}_sample.${extension}`,
        filePath,
        mimeType: getAudioMimeType(format),
        size: audio.length,
        purpose: 'voice-samples',
      },
    });

    return filePath;
  }
}

export const voiceDesignService = new VoiceDesignService();
