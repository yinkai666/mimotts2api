'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { voiceApi, synthesisApi, settingsApi, authApi } from '@/lib/api';
import { generateAiyuejiConfig, downloadBlob, buildMimoCurlPreview } from '@/lib/utils';
import type { Voice, AppSetting } from '@/types';

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Failed to read audio sample'));
        return;
      }
      resolve(result.split(',')[1] || '');
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export default function DashboardPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('synthesize');
  const [voices, setVoices] = useState<Voice[]>([]);
  const [settings, setSettings] = useState<AppSetting[]>([]);
  const [loading, setLoading] = useState(true);

  // Synthesize state
  const [text, setText] = useState('');
  const [selectedVoice, setSelectedVoice] = useState('');
  const [format, setFormat] = useState('mp3');
  const [style, setStyle] = useState('');
  const [audioUrl, setAudioUrl] = useState('');
  const [synthesizing, setSynthesizing] = useState(false);
  const [voiceLibraryTab, setVoiceLibraryTab] = useState<'builtin' | 'styled' | 'custom' | 'cloned'>('builtin');
  const [sampleAudioUrl, setSampleAudioUrl] = useState('');

  // Styled preset state
  const [styledForm, setStyledForm] = useState({
    displayName: '',
    localName: '',
    baseVoiceLocalName: '',
    style: '',
    previewText: '',
    format: 'wav',
  });
  const [styledPreviewUrl, setStyledPreviewUrl] = useState('');
  const [styledPreviewBlob, setStyledPreviewBlob] = useState<Blob | null>(null);
  const [previewingStyled, setPreviewingStyled] = useState(false);
  const [savingStyled, setSavingStyled] = useState(false);
  const [styledMsg, setStyledMsg] = useState('');

  // Voice design state
  const [designForm, setDesignForm] = useState({
    displayName: '',
    localName: '',
    description: '',
    previewText: '',
    style: '',
    format: 'wav',
    optimizeTextPreview: true,
  });
  const [designPreviewUrl, setDesignPreviewUrl] = useState('');
  const [designPreviewBlob, setDesignPreviewBlob] = useState<Blob | null>(null);
  const [previewingDesign, setPreviewingDesign] = useState(false);
  const [savingDesign, setSavingDesign] = useState(false);
  const [designMsg, setDesignMsg] = useState('');

  // Config generator state
  const [proxyUrl, setProxyUrl] = useState('');
  const [proxyToken, setProxyToken] = useState('');
  const [generatedConfig, setGeneratedConfig] = useState('');
  const [currentProxyToken, setCurrentProxyToken] = useState('');
  const [showCurrentProxyToken, setShowCurrentProxyToken] = useState(false);

  // Settings edit state
  const [editSettings, setEditSettings] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState('');
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState('');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [voicesData, settingsData, proxyTokenData] = await Promise.all([
        voiceApi.getAll(),
        settingsApi.getAll(),
        settingsApi.getProxyToken(),
      ]);
      setVoices(voicesData);
      setSettings(settingsData);
      setCurrentProxyToken(proxyTokenData.token || '');
      setProxyToken(proxyTokenData.token || '');
      if (voicesData.length > 0) setSelectedVoice(voicesData[0].localName);
      const defaultBaseVoice = voicesData.find(v => v.type === 'builtin' && v.model === 'mimo-v2.5-tts');
      if (defaultBaseVoice) {
        setStyledForm(form => ({ ...form, baseVoiceLocalName: defaultBaseVoice.localName }));
      }
      const edit: Record<string, string> = {};
      settingsData.forEach((s) => { edit[s.key] = s.masked ? '' : s.value; });
      setEditSettings(edit);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleSynthesize = async () => {
    if (!text || !selectedVoice) return;
    setSynthesizing(true);
    try {
      const blob = await synthesisApi.synthesize({ text, voice: selectedVoice, format, style: style || undefined });
      setAudioUrl(URL.createObjectURL(blob));
    } catch (e: any) { alert('合成失败: ' + (e.response?.data?.error || e.message)); }
    finally { setSynthesizing(false); }
  };

  const handleDownload = () => {
    if (!audioUrl) return;
    fetch(audioUrl).then(r => r.blob()).then(b => downloadBlob(b, `tts_${Date.now()}.${format}`));
  };

  const handlePreviewStyled = async () => {
    if (!styledForm.baseVoiceLocalName || !styledForm.style || !styledForm.previewText) {
      setStyledMsg('请填写基础音色、风格控制和预览文本');
      return;
    }

    setPreviewingStyled(true);
    setStyledMsg('');
    try {
      const blob = await voiceApi.previewStyled({
        baseVoiceLocalName: styledForm.baseVoiceLocalName,
        style: styledForm.style,
        previewText: styledForm.previewText,
        format: styledForm.format,
      });
      setStyledPreviewBlob(blob);
      setStyledPreviewUrl(URL.createObjectURL(blob));
      setStyledMsg('预览已生成，保存时会把最近一次预览作为样例');
    } catch (e: any) {
      setStyledMsg('预览失败: ' + (e.response?.data?.error || e.message));
    } finally {
      setPreviewingStyled(false);
    }
  };

  const handleSaveStyled = async () => {
    if (!styledForm.displayName || !styledForm.localName || !styledForm.baseVoiceLocalName || !styledForm.style || !styledForm.previewText) {
      setStyledMsg('请完整填写显示名称、调用名称、基础音色、风格控制和预览文本');
      return;
    }

    if (!styledPreviewBlob) {
      setStyledMsg('请先合成一次预览，保存时会把最近一次预览作为样例');
      return;
    }

    setSavingStyled(true);
    setStyledMsg('');
    try {
      const sampleAudioBase64 = await blobToBase64(styledPreviewBlob);
      await voiceApi.createStyled({
        displayName: styledForm.displayName,
        localName: styledForm.localName,
        baseVoiceLocalName: styledForm.baseVoiceLocalName,
        style: styledForm.style,
        previewText: styledForm.previewText,
        format: styledForm.format,
        sampleAudioBase64,
      });
      setStyledMsg('风格模板已保存到音色库');
      setStyledForm({
        displayName: '',
        localName: '',
        baseVoiceLocalName: styledForm.baseVoiceLocalName,
        style: '',
        previewText: '',
        format: 'wav',
      });
      setStyledPreviewBlob(null);
      setStyledPreviewUrl('');
      const freshVoices = await voiceApi.getAll();
      setVoices(freshVoices);
      setVoiceLibraryTab('styled');
      setActiveTab('voices');
    } catch (e: any) {
      setStyledMsg('保存失败: ' + (e.response?.data?.error || e.message));
    } finally {
      setSavingStyled(false);
    }
  };

  const handlePreviewDesign = async () => {
    if (!designForm.description || !designForm.previewText) {
      setDesignMsg('请填写音色描述和预览文本');
      return;
    }

    setPreviewingDesign(true);
    setDesignMsg('');
    try {
      const blob = await voiceApi.previewCustom({
        description: designForm.description,
        previewText: designForm.previewText,
        style: designForm.style || undefined,
        format: designForm.format,
        optimizeTextPreview: designForm.optimizeTextPreview,
      });
      setDesignPreviewBlob(blob);
      setDesignPreviewUrl(URL.createObjectURL(blob));
      setDesignMsg('预览已生成，保存时会重新合成并保存为样例');
    } catch (e: any) {
      setDesignMsg('预览失败: ' + (e.response?.data?.error || e.message));
    } finally {
      setPreviewingDesign(false);
    }
  };

  const handleSaveDesign = async () => {
    if (!designForm.displayName || !designForm.localName || !designForm.description || !designForm.previewText) {
      setDesignMsg('请完整填写显示名称、调用名称、音色描述和预览文本');
      return;
    }

    if (!designPreviewBlob) {
      setDesignMsg('请先合成一次预览，保存时会把最近一次预览作为样例');
      return;
    }

    setSavingDesign(true);
    setDesignMsg('');
    try {
      const sampleAudioBase64 = await blobToBase64(designPreviewBlob);
      await voiceApi.createCustom({
        displayName: designForm.displayName,
        localName: designForm.localName,
        description: designForm.description,
        previewText: designForm.previewText,
        style: designForm.style || undefined,
        format: designForm.format,
        optimizeTextPreview: designForm.optimizeTextPreview,
        sampleAudioBase64,
      });
      setDesignMsg('设计音色已保存到音色库');
      setDesignForm({
        displayName: '',
        localName: '',
        description: '',
        previewText: '',
        style: '',
        format: 'wav',
        optimizeTextPreview: true,
      });
      setDesignPreviewBlob(null);
      setDesignPreviewUrl('');
      const freshVoices = await voiceApi.getAll();
      setVoices(freshVoices);
      setVoiceLibraryTab('custom');
      setActiveTab('voices');
    } catch (e: any) {
      setDesignMsg('保存失败: ' + (e.response?.data?.error || e.message));
    } finally {
      setSavingDesign(false);
    }
  };

  const playVoiceSample = async (voice: Voice) => {
    if (!voice.sampleFilePath) return;
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/voices/${voice.id}/sample`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!response.ok) throw new Error('sample request failed');
      const blob = await response.blob();
      setSampleAudioUrl(URL.createObjectURL(blob));
    } catch (e: any) {
      alert('样例音频播放失败');
    }
  };

  const handleGenerateConfig = () => {
    const voice = voices.find(v => v.localName === selectedVoice);
    if (!voice || !proxyUrl) { alert('请填写代理服务地址'); return; }
    setGeneratedConfig(JSON.stringify(generateAiyuejiConfig(voice, proxyUrl, proxyToken, format), null, 2));
  };

  const handleSaveSettings = async () => {
    setSaving(true); setSettingsMsg('');
    try {
      const data: Record<string, string> = {};
      for (const [k, v] of Object.entries(editSettings)) { if (v !== '') data[k] = v; }
      await settingsApi.update(data);
      setSettingsMsg('保存成功');
      const fresh = await settingsApi.getAll();
      setSettings(fresh);
    } catch (e: any) { setSettingsMsg('保存失败: ' + (e.response?.data?.error || e.message)); }
    finally { setSaving(false); }
  };

  const handleRegenToken = async () => {
    try {
      const r = await settingsApi.regenerateToken();
      setEditSettings({ ...editSettings, proxy_auth_token: r.token });
      setCurrentProxyToken(r.token);
      setProxyToken(r.token);
      setShowCurrentProxyToken(true);
      setSettingsMsg('Token 已重新生成，请点击保存');
    } catch (e: any) { alert('操作失败'); }
  };

  const handleClearToken = async () => {
    try {
      await settingsApi.clearToken();
      setEditSettings({ ...editSettings, proxy_auth_token: '' });
      setCurrentProxyToken('');
      setProxyToken('');
      setShowCurrentProxyToken(false);
      setSettingsMsg('Token 已清除，API 不再需要鉴权');
      const fresh = await settingsApi.getAll(); setSettings(fresh);
    } catch (e: any) { alert('操作失败'); }
  };

  const handleChangePassword = async () => {
    setPasswordMsg('');

    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      setPasswordMsg('请完整填写当前密码和新密码');
      return;
    }

    if (passwordForm.newPassword.length < 8) {
      setPasswordMsg('新密码至少需要 8 个字符');
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordMsg('两次输入的新密码不一致');
      return;
    }

    setChangingPassword(true);
    try {
      await authApi.changePassword(passwordForm.currentPassword, passwordForm.newPassword);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setPasswordMsg('密码修改成功，请使用新密码登录');
    } catch (e: any) {
      setPasswordMsg('密码修改失败: ' + (e.response?.data?.error || e.message));
    } finally {
      setChangingPassword(false);
    }
  };

  const handleLogout = () => { localStorage.removeItem('token'); router.push('/'); };

  // 获取某个设置项的当前值（用于显示脱敏占位）
  const getSettingDisplay = (key: string) => {
    const s = settings.find(x => x.key === key);
    return s?.masked ? s.value : (editSettings[key] || '');
  };

  const apiBaseUrl = editSettings['mimo_api_base_url'] || 'https://api.xiaomimimo.com/v1';
  const baseTtsVoices = voices.filter(v => v.type === 'builtin' && v.model === 'mimo-v2.5-tts');
  const styledBaseVoice = voices.find(v => v.localName === styledForm.baseVoiceLocalName);
  const styledCurlPreview = buildMimoCurlPreview({
    apiBaseUrl,
    model: 'mimo-v2.5-tts',
    format: styledForm.format,
    userContent: styledForm.style,
    assistantText: styledForm.previewText,
    voice: styledBaseVoice?.providerVoiceId || styledBaseVoice?.localName,
  });
  const designCurlPreview = buildMimoCurlPreview({
    apiBaseUrl,
    model: 'mimo-v2.5-tts-voicedesign',
    format: designForm.format,
    userContent: [designForm.description.trim(), designForm.style.trim()].filter(Boolean).join('\n\n'),
    assistantText: designForm.previewText,
    optimizeTextPreview: designForm.optimizeTextPreview,
  });

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="text-lg">加载中...</div></div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">MiMo TTS Proxy Manager</h1>
          <button onClick={handleLogout} className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900">退出登录</button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {[
              { id: 'synthesize', name: '语音合成' },
              { id: 'styled', name: '风格模板' },
              { id: 'design', name: '设计音色' },
              { id: 'voices', name: '音色库' },
              { id: 'config', name: '配置生成器' },
              { id: 'settings', name: '设置' },
            ].map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                className={`${activeTab === t.id ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}>
                {t.name}
              </button>
            ))}
          </nav>
        </div>

        <div className="mt-6 bg-white shadow rounded-lg p-6">

          {/* ========== 语音合成 ========== */}
          {activeTab === 'synthesize' && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold">语音合成测试</h2>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">待合成文本</label>
                <textarea value={text} onChange={e => setText(e.target.value)} rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="输入要合成的文本..." />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">音色</label>
                  <select value={selectedVoice} onChange={e => setSelectedVoice(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500">
                    {voices.map(v => <option key={v.id} value={v.localName}>{v.displayName} ({v.type})</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">格式</label>
                  <select value={format} onChange={e => setFormat(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500">
                    <option value="mp3">MP3</option>
                    <option value="wav">WAV</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">风格（可选）</label>
                  <input type="text" value={style} onChange={e => setStyle(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="如：开心、悲伤" />
                  <p className="text-xs text-gray-400 mt-1">自然语言控制写这里；如果要用音频标签控制，请直接把标签写进「待合成文本」。</p>
                </div>
              </div>
              <button onClick={handleSynthesize} disabled={synthesizing || !text}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">
                {synthesizing ? '合成中...' : '合成语音'}
              </button>
              {audioUrl && (
                <div className="space-y-4">
                  <audio controls src={audioUrl} className="w-full" />
                  <button onClick={handleDownload} className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700">下载音频</button>
                </div>
              )}
            </div>
          )}

          {/* ========== 风格模板 ========== */}
          {activeTab === 'styled' && (
            <div className="space-y-6">
              <div className="flex flex-col gap-1">
                <h2 className="text-xl font-semibold">风格模板</h2>
                <p className="text-sm text-gray-500">风格模板会绑定一个 `mimo-v2.5-tts` 基础音色，并保存自然语言风格控制。保存后可以像普通音色一样通过调用名称给爱阅记直接使用。</p>
              </div>

              {styledMsg && (
                <div className={`px-4 py-3 rounded ${styledMsg.includes('失败') ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'}`}>{styledMsg}</div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">显示名称</label>
                      <input type="text" value={styledForm.displayName}
                        onChange={e => setStyledForm({ ...styledForm, displayName: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        placeholder="茉莉晚安" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">调用名称</label>
                      <input type="text" value={styledForm.localName}
                        onChange={e => setStyledForm({ ...styledForm, localName: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        placeholder="moli_bedtime" />
                      <p className="text-xs text-gray-400 mt-1">仅支持小写字母、数字和下划线</p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">基础音色</label>
                    <select value={styledForm.baseVoiceLocalName}
                      onChange={e => setStyledForm({ ...styledForm, baseVoiceLocalName: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500">
                      {baseTtsVoices.map(v => <option key={v.id} value={v.localName}>{v.displayName}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">风格控制</label>
                    <textarea value={styledForm.style}
                      onChange={e => setStyledForm({ ...styledForm, style: e.target.value })} rows={5}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder="例如：轻声、放松，像睡前陪伴；语速稍慢，句尾自然放缓。" />
                    <p className="text-xs text-gray-400 mt-1">这里只保存自然语言控制。如果你要测试音频标签控制，请直接把标签写进「预览文本」。</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">预览文本</label>
                    <textarea value={styledForm.previewText}
                      onChange={e => setStyledForm({ ...styledForm, previewText: e.target.value })} rows={5}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder="输入用于调试风格模板和保存样例的文本..." />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">样例格式</label>
                    <select value={styledForm.format}
                      onChange={e => setStyledForm({ ...styledForm, format: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500">
                      <option value="wav">WAV</option>
                      <option value="mp3">MP3</option>
                    </select>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <button onClick={handlePreviewStyled}
                      disabled={previewingStyled || !styledForm.baseVoiceLocalName || !styledForm.style || !styledForm.previewText}
                      className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">
                      {previewingStyled ? '合成中...' : '合成预览'}
                    </button>
                    <button onClick={handleSaveStyled}
                      disabled={savingStyled || !styledPreviewBlob || !styledForm.displayName || !styledForm.localName || !styledForm.baseVoiceLocalName || !styledForm.style || !styledForm.previewText}
                      className="px-6 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-800 disabled:opacity-50">
                      {savingStyled ? '保存中...' : '保存到音色库'}
                    </button>
                    {styledPreviewBlob && (
                      <button onClick={() => downloadBlob(styledPreviewBlob, `styled_voice_preview.${styledForm.format}`)}
                        className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700">下载预览</button>
                    )}
                  </div>

                  {styledPreviewUrl && (
                    <div className="border rounded-lg p-4 space-y-3">
                      <h3 className="text-sm font-medium text-gray-700">最近一次预览</h3>
                      <audio controls src={styledPreviewUrl} className="w-full" />
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-gray-700">将发送到 MiMo 的 cURL</h3>
                  <button onClick={() => navigator.clipboard.writeText(styledCurlPreview)}
                    className="px-3 py-2 text-sm bg-white text-gray-700 rounded-md hover:bg-gray-100 border border-gray-200">复制</button>
                </div>
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-md overflow-x-auto text-sm whitespace-pre-wrap break-all">{styledCurlPreview}</pre>
              </div>
            </div>
          )}

          {/* ========== 设计音色 ========== */}
          {activeTab === 'design' && (
            <div className="space-y-6">
              <div className="flex flex-col gap-1">
                <h2 className="text-xl font-semibold">设计音色</h2>
                <p className="text-sm text-gray-500">音色描述用于定义“这个声音是谁”，风格控制用于附加“这次怎么说”。设计音色时必须先提供音色描述，保存后可在语音合成和爱阅记接口中直接调用。</p>
              </div>

              {designMsg && (
                <div className={`px-4 py-3 rounded ${designMsg.includes('失败') ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'}`}>{designMsg}</div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">显示名称</label>
                      <input type="text" value={designForm.displayName}
                        onChange={e => setDesignForm({ ...designForm, displayName: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        placeholder="睡前故事女声" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">调用名称</label>
                      <input type="text" value={designForm.localName}
                        onChange={e => setDesignForm({ ...designForm, localName: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        placeholder="bedtime_voice" />
                      <p className="text-xs text-gray-400 mt-1">仅支持小写字母、数字和下划线</p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">音色描述</label>
                    <textarea value={designForm.description}
                      onChange={e => setDesignForm({ ...designForm, description: e.target.value })} rows={5}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder="例如：温柔的年轻女性，声音清澈柔和，语速偏慢，适合睡前故事和安静旁白。" />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">预览文本</label>
                    <textarea value={designForm.previewText}
                      onChange={e => setDesignForm({ ...designForm, previewText: e.target.value })} rows={4}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder="输入用于调试和保存样例的文本..." />
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">风格控制（可选）</label>
                    <textarea value={designForm.style}
                      onChange={e => setDesignForm({ ...designForm, style: e.target.value })} rows={4}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder="例如：低声、放松、带一点气声；句尾自然放缓。" />
                    <p className="text-xs text-gray-400 mt-1">这里是附加控制，不会替代“音色描述”。如果你要用音频标签控制，请直接把标签写进「预览文本」。</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">样例格式</label>
                      <select value={designForm.format}
                        onChange={e => setDesignForm({ ...designForm, format: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500">
                        <option value="wav">WAV</option>
                        <option value="mp3">MP3</option>
                      </select>
                    </div>
                    <label className="flex items-center gap-2 mt-7 text-sm text-gray-700">
                      <input type="checkbox" checked={designForm.optimizeTextPreview}
                        onChange={e => setDesignForm({ ...designForm, optimizeTextPreview: e.target.checked })}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                      智能润色预览文本
                    </label>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <button onClick={handlePreviewDesign}
                      disabled={previewingDesign || !designForm.description || !designForm.previewText}
                      className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">
                      {previewingDesign ? '合成中...' : '合成预览'}
                    </button>
                    <button onClick={handleSaveDesign}
                      disabled={savingDesign || !designPreviewBlob || !designForm.displayName || !designForm.localName || !designForm.description || !designForm.previewText}
                      className="px-6 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-800 disabled:opacity-50">
                      {savingDesign ? '保存中...' : '保存到音色库'}
                    </button>
                    {designPreviewBlob && (
                      <button onClick={() => downloadBlob(designPreviewBlob, `voice_design_preview.${designForm.format}`)}
                        className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700">下载预览</button>
                    )}
                  </div>

                  {designPreviewUrl && (
                    <div className="border rounded-lg p-4 space-y-3">
                      <h3 className="text-sm font-medium text-gray-700">最近一次预览</h3>
                      <audio controls src={designPreviewUrl} className="w-full" />
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-gray-700">将发送到 MiMo 的 cURL</h3>
                  <button onClick={() => navigator.clipboard.writeText(designCurlPreview)}
                    className="px-3 py-2 text-sm bg-white text-gray-700 rounded-md hover:bg-gray-100 border border-gray-200">复制</button>
                </div>
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-md overflow-x-auto text-sm whitespace-pre-wrap break-all">{designCurlPreview}</pre>
              </div>
            </div>
          )}

          {/* ========== 音色库 ========== */}
          {activeTab === 'voices' && (
            <div className="space-y-6">
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between gap-4">
                  <h2 className="text-xl font-semibold">音色库</h2>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => setActiveTab('styled')}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">新增风格模板</button>
                    <button onClick={() => setActiveTab('design')}
                      className="px-4 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-800">新增设计音色</button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 'builtin', name: '自带音色' },
                    { id: 'styled', name: '风格模板' },
                    { id: 'custom', name: '设计音色' },
                    { id: 'cloned', name: '复刻音色' },
                  ].map(t => (
                    <button key={t.id} onClick={() => setVoiceLibraryTab(t.id as 'builtin' | 'styled' | 'custom' | 'cloned')}
                      className={`${voiceLibraryTab === t.id ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'} px-3 py-2 rounded-md text-sm`}>
                      {t.name}
                    </button>
                  ))}
                </div>
              </div>
              {sampleAudioUrl && (
                <div className="border rounded-lg p-4 space-y-2">
                  <h3 className="text-sm font-medium text-gray-700">样例音频</h3>
                  <audio controls src={sampleAudioUrl} className="w-full" />
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">显示名称</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">本地名称</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">类型</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">模型</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">样例</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {voices.filter(v => v.type === voiceLibraryTab).map(v => (
                      <tr key={v.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{v.displayName}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{v.localName}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{v.type}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{v.model}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {v.sampleFilePath ? (
                            <button onClick={() => playVoiceSample(v)} className="text-blue-600 hover:text-blue-800">播放样例</button>
                          ) : (
                            <span className="text-gray-400">无</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {voices.filter(v => v.type === voiceLibraryTab).length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-sm text-gray-500 text-center">暂无音色</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========== 配置生成器 ========== */}
          {activeTab === 'config' && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold">爱阅记配置生成器</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">选择音色</label>
                  <select value={selectedVoice} onChange={e => setSelectedVoice(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500">
                    {voices.map(v => <option key={v.id} value={v.localName}>{v.displayName}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">输出格式</label>
                  <select value={format} onChange={e => setFormat(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500">
                    <option value="mp3">MP3</option>
                    <option value="wav">WAV</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">代理服务地址 <span className="text-red-500">*</span></label>
                  <input type="text" value={proxyUrl} onChange={e => setProxyUrl(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="https://tts.example.com" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">代理访问 Token（可选）</label>
                  <input type="text" value={proxyToken} onChange={e => setProxyToken(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="留空则不生成 Authorization 头" />
                  <p className="text-xs text-gray-400 mt-1">如果服务器未设置 Token，请留空</p>
                </div>
                {currentProxyToken && (
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-sm font-medium text-gray-700">当前后台 Token</h3>
                      <div className="flex gap-2">
                        <button onClick={() => setProxyToken(currentProxyToken)}
                          className="px-3 py-2 text-sm bg-white text-gray-700 rounded-md hover:bg-gray-100 border border-gray-200">带入配置生成器</button>
                        <button onClick={() => setShowCurrentProxyToken(v => !v)}
                          className="px-3 py-2 text-sm bg-white text-gray-700 rounded-md hover:bg-gray-100 border border-gray-200">{showCurrentProxyToken ? '隐藏' : '显示'}</button>
                        <button onClick={() => { navigator.clipboard.writeText(currentProxyToken); alert('Token 已复制到剪贴板'); }}
                          className="px-3 py-2 text-sm bg-white text-gray-700 rounded-md hover:bg-gray-100 border border-gray-200">复制</button>
                      </div>
                    </div>
                    <div className="font-mono text-sm text-gray-700 break-all">
                      {showCurrentProxyToken ? currentProxyToken : '••••••••••••••••••••••••••••••••'}
                    </div>
                  </div>
                )}
              </div>
              <button onClick={handleGenerateConfig} className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">生成配置</button>
              {generatedConfig && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-medium">生成的配置</h3>
                    <button onClick={() => { navigator.clipboard.writeText(generatedConfig); alert('已复制到剪贴板'); }}
                      className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700">复制配置</button>
                  </div>
                  <pre className="bg-gray-900 text-gray-100 p-4 rounded-md overflow-x-auto text-sm">{generatedConfig}</pre>
                </div>
              )}
            </div>
          )}

          {/* ========== 设置 ========== */}
          {activeTab === 'settings' && (
            <div className="space-y-6 max-w-2xl">
              <h2 className="text-xl font-semibold">系统设置</h2>

              {settingsMsg && (
                <div className={`px-4 py-3 rounded ${settingsMsg.includes('失败') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>{settingsMsg}</div>
              )}

              {/* 管理员密码 */}
              <div className="border rounded-lg p-4 space-y-4">
                <h3 className="font-semibold text-gray-800">管理员密码</h3>
                <p className="text-xs text-gray-500">修改当前登录管理员的后台登录密码。建议使用长度足够、不可猜测的密码。</p>

                {passwordMsg && (
                  <div className={`px-4 py-3 rounded ${passwordMsg.includes('成功') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{passwordMsg}</div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">当前密码</label>
                  <input type="password" value={passwordForm.currentPassword}
                    onChange={e => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    autoComplete="current-password" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">新密码</label>
                  <input type="password" value={passwordForm.newPassword}
                    onChange={e => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    autoComplete="new-password" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">确认新密码</label>
                  <input type="password" value={passwordForm.confirmPassword}
                    onChange={e => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    autoComplete="new-password" />
                </div>

                <button onClick={handleChangePassword} disabled={changingPassword}
                  className="px-4 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-800 disabled:opacity-50">
                  {changingPassword ? '修改中...' : '修改密码'}
                </button>
              </div>

              {/* MiMo API 配置区域 */}
              <div className="border rounded-lg p-4 space-y-4">
                <h3 className="font-semibold text-gray-800">MiMo API 配置</h3>
                <p className="text-xs text-gray-500">填写 MiMo API 的请求地址和 API Key。Plan 和普通 Key 对应的 URL 不同，请根据你的 Key 类型填写。</p>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">MiMo API Base URL</label>
                  <input type="text" value={editSettings['mimo_api_base_url'] || ''}
                    onChange={e => setEditSettings({ ...editSettings, mimo_api_base_url: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="https://api.xiaomimimo.com/v1" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">MiMo API Key {getSettingDisplay('mimo_api_key') ? <span className="text-green-500 text-xs">(当前: {getSettingDisplay('mimo_api_key')})</span> : <span className="text-red-500 text-xs">(未设置)</span>}</label>
                  <input type="password" value={editSettings['mimo_api_key'] || ''}
                    onChange={e => setEditSettings({ ...editSettings, mimo_api_key: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="sk-xxxxxxxx 或你的完整 Key" />
                  <p className="text-xs text-gray-400 mt-1">新输入的值将替换原有 Key，留空则不修改</p>
                </div>
              </div>

              {/* 代理 Token 区域 */}
              <div className="border rounded-lg p-4 space-y-4">
                <h3 className="font-semibold text-gray-800">代理访问 Token（可选）</h3>
                <p className="text-xs text-gray-500">
                  用于爱阅记调用 /v1/audio/speech 时的安全验证。如果设置，爱阅记必须在请求头中携带 <code>Authorization: Bearer &lt;token&gt;</code>。
                  如果不需要鉴权（如内网环境），可以留空或清除。
                </p>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">代理访问 Token {getSettingDisplay('proxy_auth_token') ? <span className="text-green-500 text-xs">(已设置)</span> : <span className="text-yellow-500 text-xs">(未设置 - API 无鉴权)</span>}</label>
                  <input type="text" value={editSettings['proxy_auth_token'] || ''}
                    onChange={e => setEditSettings({ ...editSettings, proxy_auth_token: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="自定义 Token 字符串" />
                </div>
                {currentProxyToken && (
                  <div className="rounded-md bg-gray-50 border border-gray-200 p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-gray-700">当前生效 Token</span>
                      <div className="flex gap-2">
                        <button onClick={() => setShowCurrentProxyToken(v => !v)} className="px-2 py-1 text-xs bg-white border border-gray-200 rounded hover:bg-gray-100">{showCurrentProxyToken ? '隐藏' : '显示'}</button>
                        <button onClick={() => { navigator.clipboard.writeText(currentProxyToken); alert('Token 已复制到剪贴板'); }} className="px-2 py-1 text-xs bg-white border border-gray-200 rounded hover:bg-gray-100">复制</button>
                      </div>
                    </div>
                    <div className="font-mono text-xs text-gray-700 break-all">
                      {showCurrentProxyToken ? currentProxyToken : '••••••••••••••••••••••••••••••••'}
                    </div>
                  </div>
                )}
                <div className="flex gap-2">
                  <button onClick={handleRegenToken} className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200">随机生成 Token</button>
                  <button onClick={handleClearToken} className="px-3 py-2 text-sm bg-red-50 text-red-600 rounded-md hover:bg-red-100">清除 Token</button>
                </div>
              </div>

              {/* 其他配置 */}
              <div className="border rounded-lg p-4 space-y-4">
                <h3 className="font-semibold text-gray-800">其他默认配置</h3>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">默认模型</label>
                  <input type="text" value={editSettings['default_model'] || ''}
                    onChange={e => setEditSettings({ ...editSettings, default_model: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">默认格式</label>
                  <input type="text" value={editSettings['default_format'] || ''}
                    onChange={e => setEditSettings({ ...editSettings, default_format: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">上传限制 (MB)</label>
                  <input type="text" value={editSettings['max_upload_mb'] || ''}
                    onChange={e => setEditSettings({ ...editSettings, max_upload_mb: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
                </div>
              </div>

              <button onClick={handleSaveSettings} disabled={saving}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">
                {saving ? '保存中...' : '保存设置'}
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
