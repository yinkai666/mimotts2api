import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // 创建默认管理员
  const hashedPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      password: hashedPassword,
      role: 'admin',
    },
  });
  console.log('Created admin user:', admin.username);

  // 创建内置音色
  const builtinVoices = [
    // V2 版本
    { displayName: 'MiMo 默认', localName: 'mimo_default', providerVoiceId: 'mimo_default', model: 'mimo-v2-tts', type: 'builtin' },
    { displayName: 'MiMo 中文女声', localName: 'default_zh', providerVoiceId: 'default_zh', model: 'mimo-v2-tts', type: 'builtin' },
    { displayName: 'MiMo 英文女声', localName: 'default_en', providerVoiceId: 'default_en', model: 'mimo-v2-tts', type: 'builtin' },
    // V2.5 版本 - 中文
    { displayName: '冰糖', localName: 'bingtang', providerVoiceId: '冰糖', model: 'mimo-v2.5-tts', type: 'builtin' },
    { displayName: '茉莉', localName: 'moli', providerVoiceId: '茉莉', model: 'mimo-v2.5-tts', type: 'builtin' },
    { displayName: '苏打', localName: 'suda', providerVoiceId: '苏打', model: 'mimo-v2.5-tts', type: 'builtin' },
    { displayName: '白桦', localName: 'baihua', providerVoiceId: '白桦', model: 'mimo-v2.5-tts', type: 'builtin' },
    // V2.5 版本 - 英文
    { displayName: 'Mia', localName: 'mia', providerVoiceId: 'Mia', model: 'mimo-v2.5-tts', type: 'builtin' },
    { displayName: 'Chloe', localName: 'chloe', providerVoiceId: 'Chloe', model: 'mimo-v2.5-tts', type: 'builtin' },
    { displayName: 'Milo', localName: 'milo', providerVoiceId: 'Milo', model: 'mimo-v2.5-tts', type: 'builtin' },
    { displayName: 'Dean', localName: 'dean', providerVoiceId: 'Dean', model: 'mimo-v2.5-tts', type: 'builtin' },
  ];

  for (const voice of builtinVoices) {
    await prisma.voice.upsert({
      where: { localName: voice.localName },
      update: {},
      create: {
        ...voice,
        provider: 'mimo',
        isActive: true,
      },
    });
  }
  console.log(`Created ${builtinVoices.length} builtin voices`);

  // 创建默认配置
  const defaultSettings = [
    { key: 'mimo_api_key', value: '' },
    { key: 'mimo_api_base_url', value: 'https://api.xiaomimimo.com/v1' },
    { key: 'proxy_auth_token', value: '' },
    { key: 'default_model', value: 'mimo-v2.5-tts' },
    { key: 'default_format', value: 'mp3' },
    { key: 'max_upload_mb', value: '10' },
  ];

  for (const setting of defaultSettings) {
    await prisma.appSetting.upsert({
      where: { key: setting.key },
      update: {},
      create: setting,
    });
  }
  console.log('Created default settings');

  console.log('Seeding completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
