'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { voiceApi, synthesisApi, settingsApi } from '@/lib/api';
import { generateAiyuejiConfig, downloadBlob } from '@/lib/utils';
import type { Voice, AppSetting } from '@/types';

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

  // Config generator state
  const [proxyUrl, setProxyUrl] = useState('');
  const [proxyToken, setProxyToken] = useState('');
  const [generatedConfig, setGeneratedConfig] = useState('');

  // Settings edit state
  const [editSettings, setEditSettings] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState('');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [voicesData, settingsData] = await Promise.all([voiceApi.getAll(), settingsApi.getAll()]);
      setVoices(voicesData);
      setSettings(settingsData);
      if (voicesData.length > 0) setSelectedVoice(voicesData[0].localName);
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
      setSettingsMsg('Token 已重新生成，请点击保存');
    } catch (e: any) { alert('操作失败'); }
  };

  const handleClearToken = async () => {
    try {
      await settingsApi.clearToken();
      setEditSettings({ ...editSettings, proxy_auth_token: '' });
      setSettingsMsg('Token 已清除，API 不再需要鉴权');
      const fresh = await settingsApi.getAll(); setSettings(fresh);
    } catch (e: any) { alert('操作失败'); }
  };

  const handleLogout = () => { localStorage.removeItem('token'); router.push('/'); };

  // 获取某个设置项的当前值（用于显示脱敏占位）
  const getSettingDisplay = (key: string) => {
    const s = settings.find(x => x.key === key);
    return s?.masked ? s.value : (editSettings[key] || '');
  };

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

          {/* ========== 音色库 ========== */}
          {activeTab === 'voices' && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold">音色库</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">显示名称</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">本地名称</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">类型</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">模型</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {voices.map(v => (
                      <tr key={v.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{v.displayName}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{v.localName}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{v.type}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{v.model}</td>
                      </tr>
                    ))}
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