import { PrismaClient, Voice } from '@prisma/client';

const prisma = new PrismaClient();

export class VoiceService {
  private cache: Map<string, Voice> = new Map();

  async getAll(filters?: { type?: string; isActive?: boolean }) {
    const where: any = {};
    if (filters?.type) where.type = filters.type;
    if (filters?.isActive !== undefined) where.isActive = filters.isActive;

    return prisma.voice.findMany({
      where,
      orderBy: [{ type: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async getById(id: string) {
    return prisma.voice.findUnique({
      where: { id },
    });
  }

  async getByLocalName(localName: string): Promise<Voice | null> {
    // 先查缓存
    if (this.cache.has(localName)) {
      return this.cache.get(localName)!;
    }

    const voice = await prisma.voice.findUnique({
      where: { localName },
    });

    if (voice) {
      this.cache.set(localName, voice);
    }

    return voice;
  }

  async create(data: {
    displayName: string;
    localName: string;
    type: string;
    model: string;
    providerVoiceId?: string;
    configJson?: string;
    sampleFilePath?: string;
    consent?: boolean;
    remark?: string;
  }) {
    const voice = await prisma.voice.create({
      data: {
        ...data,
        provider: 'mimo',
        isActive: true,
      },
    });

    this.cache.set(voice.localName, voice);
    return voice;
  }

  async update(id: string, data: Partial<Voice>) {
    const voice = await prisma.voice.update({
      where: { id },
      data,
    });

    // 更新缓存
    this.cache.set(voice.localName, voice);
    return voice;
  }

  async delete(id: string) {
    const voice = await prisma.voice.findUnique({ where: { id } });
    if (voice) {
      this.cache.delete(voice.localName);
    }

    return prisma.voice.delete({
      where: { id },
    });
  }

  clearCache() {
    this.cache.clear();
  }
}

export const voiceService = new VoiceService();
