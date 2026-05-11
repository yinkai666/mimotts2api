import { PrismaClient } from '@prisma/client';
import fs from 'fs/promises';
import path from 'path';
import { config } from '../config/env';
import { validateAudioFile } from '../utils/audio';

const prisma = new PrismaClient();

export class UploadService {
  async saveFile(file: {
    filename: string;
    mimetype: string;
    data: Buffer;
    purpose: string;
  }): Promise<{ filePath: string; fileId: string }> {
    // 验证文件类型
    if (!validateAudioFile(file.mimetype, config.upload.allowedMimeTypes)) {
      throw new Error(`Invalid file type: ${file.mimetype}`);
    }

    // 验证文件大小
    const sizeMB = file.data.length / (1024 * 1024);
    if (sizeMB > config.upload.maxSizeMB) {
      throw new Error(`File too large: ${sizeMB.toFixed(2)}MB (max: ${config.upload.maxSizeMB}MB)`);
    }

    // 生成唯一文件名
    const ext = path.extname(file.filename);
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(7);
    const newFileName = `${timestamp}_${randomStr}${ext}`;

    // 确保上传目录存在
    const uploadDir = path.join(config.upload.storageDir, file.purpose);
    await fs.mkdir(uploadDir, { recursive: true });

    // 保存文件
    const filePath = path.join(uploadDir, newFileName);
    await fs.writeFile(filePath, file.data);

    // 记录到数据库
    const uploadRecord = await prisma.uploadFile.create({
      data: {
        fileName: newFileName,
        originalName: file.filename,
        filePath,
        mimeType: file.mimetype,
        size: file.data.length,
        purpose: file.purpose,
      },
    });

    return {
      filePath,
      fileId: uploadRecord.id,
    };
  }

  async getFile(fileId: string) {
    return prisma.uploadFile.findUnique({
      where: { id: fileId },
    });
  }

  async deleteFile(fileId: string) {
    const file = await prisma.uploadFile.findUnique({
      where: { id: fileId },
    });

    if (!file) {
      throw new Error('File not found');
    }

    // 删除物理文件
    try {
      await fs.unlink(file.filePath);
    } catch (error) {
      console.error('Failed to delete physical file:', error);
    }

    // 删除数据库记录
    await prisma.uploadFile.delete({
      where: { id: fileId },
    });
  }

  async readFile(filePath: string): Promise<Buffer> {
    return fs.readFile(filePath);
  }
}

export const uploadService = new UploadService();
