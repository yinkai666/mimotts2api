'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { voiceApi, synthesisApi, settingsApi, authApi } from '@/lib/api';
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

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [voicesData, settingsData] = await Promise.all([
        voiceApi.getAll(),
        settingsApi.getAll(),
      ]);
      setVoices(voicesData);
      setSettings(settingsData);
      if (voicesData.length > 0) {
        setSelectedVoice(voicesData[0].localName);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSynthesize = async () => {
    if (!text || !selectedVoice) return;

    setSynthesizing(true);
    try {
      const blob = await synthesisApi.synthesize({
        text,
        voice: selectedVoice,
        format,
        style: style || undefined,
      });

      const url = URL.createObjectURL(blob);
      setAudioUrl(url);
    } catch (error: any) {
      alert('合成失败: ' + (error.response?.data?.error || error.message));
    } finally {
      setSynthesizing(false);
    }
  };

  const handleDownload = () => {
    if (!audioUrl) return;
    fetch(audioUrl)
      .then((res) => res.blob())
      .then((blob) => {
        downloadBlob(blob, `tts_${Date.now()}.${format}`);
      });
  };

  const handleGenerateConfig = () => {
    const voice = voices.find((v) => v.localName === selectedVoice);
    if (!voice || !proxyUrl || !proxyToken) {
      alert('请填写完整信息');
      return;
    }

    const config = generateAiyuejiConfig(voice, proxyUrl, proxyToken, format);
    setGeneratedConfig(JSON.stringify(config, null, 2));
  };

  const handleCopyConfig = () => {
    navigator.clipboard.writeText(generatedConfig);
    alert('已复制到剪贴板');
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    router.push('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">加载中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">MiMo TTS Proxy Manager</h1>
          <button
            onClick={handleLogout}
            className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900"
          >
            退出登录
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {[
              { id: 'synthesize', name: '语音合成' },
              { id: 'voices', name: '音色库' },
              { id: 'config', name: '配置生成器' },
              { id: 'settings', name: '设置' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
              >
                {tab.name}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="mt-6 bg-white shadow rounded-lg p-6">
          {/* Synthesize Tab */}
          {activeTab === 'synthesize' && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold">语音合成测试</h2>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  待合成文本
                </label>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="输入要合成的文本..."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    音色
                  </label>
                  <select
                    value={selectedVoice}
                    onChange={(e) => setSelectedVoice(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    {voices.map((voice) => (
                      <option key={voice.id} value={voice.localName}>
                        {voice.displayName} ({voice.type})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    格式
                  </label>
                  <select
                    value={format}
                    onChange={(e) => setFormat(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="mp3">MP3</option>
                    <option value="wav">WAV</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    风格（可选）
                  </label>
                  <input
                    type="text"
                    value={style}
                    onChange={(e) => setStyle(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="如：开心、悲伤"
                  />
                </div>
              </div>

              <button
                onClick={handleSynthesize}
                disabled={synthesizing || !text}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {synthesizing ? '合成中...' : '合成语音'}
              </button>

              {audioUrl && (
                <div className="space-y-4">
                  <audio controls src={audioUrl} className="w-full" />
                  <button
                    onClick={handleDownload}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                  >
                    下载音频
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Voices Tab */}
          {activeTab === 'voices' && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold">音色库</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        显示名称
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        本地名称
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        类型
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        模型
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {voices.map((voice) => (
                      <tr key={voice.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {voice.displayName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {voice.localName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {voice.type}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {voice.model}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Config Generator Tab */}
          {activeTab === 'config' && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold">爱阅记配置生成器</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    选择音色
                  </label>
                  <select
                    value={selectedVoice}
                    onChange={(e) => setSelectedVoice(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    {voices.map((voice) => (
                      <option key={voice.id} value={voice.localName}>
                        {voice.displayName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    输出格式
                  </label>
                  <select
                    value={format}
                    onChange={(e) => setFormat(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="mp3">MP3</option>
                    <option value="wav">WAV</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    代理服务地址
                  </label>
                  <input
                    type="text"
                    value={proxyUrl}
                    onChange={(e) => setProxyUrl(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="https://tts.example.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    代理访问 Token
                  </label>
                  <input
                    type="text"
                    value={proxyToken}
                    onChange={(e) => setProxyToken(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="your-proxy-token"
                  />
                </div>
              </div>

              <button
                onClick={handleGenerateConfig}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                生成配置
              </button>

              {generatedConfig && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-medium">生成的配置</h3>
                    <button
                      onClick={handleCopyConfig}
                      className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                    >
                      复制配置
                    </button>
                  </div>
                  <pre className="bg-gray-900 text-gray-100 p-4 rounded-md overflow-x-auto text-sm">
                    {generatedConfig}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* Settings Tab */}
          {activeTab === 'settings' && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold">系统设置</h2>
              <div className="space-y-4">
                {settings.map((setting) => (
                  <div key={setting.id}>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {setting.key}
                    </label>
                    <input
                      type="text"
                      value={setting.value}
                      disabled
                      className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                    />
                  </div>
                ))}
              </div>
              <p className="text-sm text-gray-500">
                提示：配置项通过环境变量或数据库管理，请联系管理员修改。
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
