'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { voiceApi, synthesisApi, settingsApi, authApi, clearToken, getToken } from '@/lib/api';
import { generateAiyuejiConfig, downloadBlob, buildMimoCurlPreview, formatDuration } from '@/lib/utils';
import type {
  Voice,
  AppSetting,
  SynthesisLog,
  LogStats,
  TimeseriesResponse,
  ErrorDistributionResponse,
} from '@/types';

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

function hasLeadingStyleTag(text: string): boolean {
  return /^[\(\[（][^)\]）]{1,100}[\)\]）]/.test(text.trim());
}

type SynthesisExample = {
  name: string;
  text: string;
  format?: 'mp3' | 'wav';
  style?: string;
};

const SYNTHESIS_EXAMPLES: SynthesisExample[] = [
  {
    name: '《诛仙》开篇 · 道法自然',
    text: '天地不仁，以万物为刍狗。这句话出自《道德经》，看似无情，实则蕴含天地至理。青云门的长老曾对弟子讲道：天地待世间万物如同祭祀用的草狗，没有亲疏厚薄之分，众生平等，各凭造化。修仙之人若能悟透其中真意，方可一窥大道，踏上那条通往长生的漫漫长路。',
    format: 'mp3',
    style: '沉稳',
  },
  {
    name: '《斗破苍穹》萧炎归来 · 莫欺少年穷',
    text: '萧炎缓缓抬起头，目光在那群曾经讥讽过他的人脸上一一扫过，声音不大，却铿锵有力：三十年河东，三十年河西，莫欺少年穷！他身后斗气翻涌，昔日那个被废掉的少爷已经脱胎换骨。整个加玛帝国都会记住这一天，记住萧家少年带着无尽的怒火与不甘，重新踏上巅峰之路。',
    format: 'mp3',
    style: '激昂',
  },
  {
    name: '《凡人修仙传》韩立入门',
    text: '七玄门，这个原本默默无名的小门派，最近几年却如同得到了什么际遇一般，一跃成为七玄国境内首屈一指的大派。门中弟子上千，长老数十，声势远超从前。少年韩立背着包袱站在山门之外，望着那高耸入云的青色山峰，心中既有忐忑，也燃起了一丝从未有过的渴望——他要在这里，走出一条属于自己的修仙之路。',
    format: 'mp3',
  },
  {
    name: '《雪中悍刀行》徐凤年饮酒',
    text: '徐凤年慢悠悠地走进酒馆，把佩刀往桌上一搁，朝柜台喊了一声：小二，上酒，我徐凤年今日要痛饮一回。店里几个江湖客闻声侧目，有人冷笑，有人皱眉。这位北凉世子顶着一身风尘，却全然不在意旁人眼光。他端起酒碗一饮而尽，心中明白：这一路从北凉走到江南，看尽了人间冷暖，也终于认清了几个真正能托付生死的兄弟。',
    format: 'mp3',
    style: '豪爽',
  },
  {
    name: '《三体》罗辑面壁 · 黑暗森林',
    text: '罗辑站在联合国总部的讲台上，望着台下黑压压的人群，神情前所未有的平静。他缓缓开口：弱小和无知不是生存的障碍，傲慢才是。整个大厅瞬间陷入死寂。这位曾经颓废度日的社会学者，如今是人类最后一位面壁者，即将用自己的方式，去面对那个名为黑暗森林的宇宙真相。',
    format: 'mp3',
    style: '沉稳',
  },
  {
    name: '《盗墓笔记》吴邪 · 十年之约',
    text: '吴邪一个人坐在长白山顶的小亭子里，肩头落满了雪。他从怀中掏出一张泛黄的照片，指尖轻轻摩挲着照片里那个穿黑衣的身影，自言自语：闷油瓶，十年之约，我没忘。声音被山风吹散在茫茫雪原里。这一等就是整整十年，从青葱少年到三十出头，他用半个青春，换一个不知能不能等到的回答。',
    format: 'mp3',
    style: '低沉',
  },
  {
    name: '《庆余年》范闲诗会',
    text: '范闲端着酒杯走到台前，面对满座达官显贵和文人墨客，缓缓开口，声音不大，却字字清晰：我希望这个世界上的每一个人，都能有尊严地活着，而不是像狗一样苟且偷生。满堂哗然。这个从澹州小城走出来的少年，从这一刻起，真正踏入了庆国京都的风口浪尖。从此以后，他的每一步都将牵动天下大势。',
    format: 'mp3',
  },
  {
    name: '《明朝那些事儿》卷末 · 化为尘土',
    text: '我之所以写下这些文字，不是为了证明什么，只是想告诉大家：所有的繁华，终归化为尘土；所有的英雄，终将归于沉默。三百年大明王朝，从朱元璋开局一个碗，到崇祯煤山自缢，看似漫长的历史，不过是后人茶余饭后的几行字。但正是这无数小人物的悲欢离合，汇成了我们今天读到的那段波澜壮阔的历史。',
    format: 'wav',
    style: '沉稳',
  },
];

function StatCard({
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: 'neutral' | 'ok' | 'warn';
}) {
  const toneClass =
    tone === 'warn' ? 'text-amber-600' : tone === 'ok' ? 'text-green-600' : 'text-gray-500';
  return (
    <div className="border rounded-lg p-4 bg-white">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className="text-2xl font-semibold text-gray-900">{value}</div>
      {hint && <div className={`text-xs mt-1 ${toneClass}`}>{hint}</div>}
    </div>
  );
}

function RpmChart({ data }: { data: TimeseriesResponse | null }) {
  if (!data || data.buckets.length === 0) {
    return <div className="text-sm text-gray-400 py-12 text-center">暂无数据</div>;
  }

  const W = 800;
  const H = 180;
  const padL = 32;
  const padR = 8;
  const padT = 10;
  const padB = 22;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const buckets = data.buckets;
  const maxTotal = Math.max(1, ...buckets.map((b) => b.total));
  const barW = innerW / buckets.length;
  const isHour = data.range === 'hour';

  const yTicks = [0, 0.5, 1].map((r) => ({
    v: Math.round(maxTotal * r),
    y: padT + innerH - innerH * r,
  }));

  const labelEvery = isHour ? 10 : 24;

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-44" preserveAspectRatio="none">
        {yTicks.map((t, i) => (
          <g key={i}>
            <line x1={padL} y1={t.y} x2={W - padR} y2={t.y} stroke="#e5e7eb" strokeDasharray="3 3" />
            <text x={padL - 4} y={t.y + 3} fontSize="10" textAnchor="end" fill="#9ca3af">{t.v}</text>
          </g>
        ))}
        {buckets.map((b, i) => {
          const x = padL + i * barW;
          const successH = (b.success / maxTotal) * innerH;
          const failedH = (b.failed / maxTotal) * innerH;
          return (
            <g key={i}>
              {failedH > 0 && (
                <rect
                  x={x + 0.5}
                  y={padT + innerH - successH - failedH}
                  width={Math.max(0.5, barW - 1)}
                  height={failedH}
                  fill="#ef4444"
                >
                  <title>
                    {new Date(b.time).toLocaleString('zh-CN', { hour12: false })} 失败 {b.failed}
                  </title>
                </rect>
              )}
              {successH > 0 && (
                <rect
                  x={x + 0.5}
                  y={padT + innerH - successH}
                  width={Math.max(0.5, barW - 1)}
                  height={successH}
                  fill="#3b82f6"
                >
                  <title>
                    {new Date(b.time).toLocaleString('zh-CN', { hour12: false })} 成功 {b.success}
                  </title>
                </rect>
              )}
              {i % labelEvery === 0 && (
                <text x={x + barW / 2} y={H - padB + 14} fontSize="10" textAnchor="middle" fill="#6b7280">
                  {isHour
                    ? new Date(b.time).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
                    : new Date(b.time).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <div className="flex justify-end gap-4 text-xs text-gray-500 pt-1">
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 bg-blue-500 rounded-sm" /> 成功</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 bg-red-500 rounded-sm" /> 失败</span>
      </div>
    </div>
  );
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
  const [synthesisMeta, setSynthesisMeta] = useState<{
    generationMs: number;
    clientElapsedMs: number;
    audioDurationSec: number;
  } | null>(null);
  const [playbackRate, setPlaybackRate] = useState(1);
  const audioRef = useRef<HTMLAudioElement | null>(null);
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

  // Logs state
  const [logStats, setLogStats] = useState<LogStats | null>(null);
  const [logTimeseries, setLogTimeseries] = useState<TimeseriesResponse | null>(null);
  const [logErrors, setLogErrors] = useState<ErrorDistributionResponse | null>(null);
  const [logList, setLogList] = useState<SynthesisLog[]>([]);
  const [logTotal, setLogTotal] = useState(0);
  const [logsLoading, setLogsLoading] = useState(false);
  const [tsRange, setTsRange] = useState<'hour' | 'day'>('hour');
  const [errRange, setErrRange] = useState<'hour' | 'day' | 'all'>('day');
  const [logFilters, setLogFilters] = useState<{
    success: '' | 'true' | 'false';
    endpoint: string;
    errorCode: string;
  }>({ success: '', endpoint: '', errorCode: '' });
  const [logPage, setLogPage] = useState(0);
  const [logPageSize] = useState(20);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const logsRefreshTimer = useRef<NodeJS.Timeout | null>(null);

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

  const loadLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const filters: Parameters<typeof synthesisApi.getLogs>[0] = {
        limit: logPageSize,
        offset: logPage * logPageSize,
      };
      if (logFilters.success !== '') filters.success = logFilters.success === 'true';
      if (logFilters.endpoint) filters.endpoint = logFilters.endpoint;
      if (logFilters.errorCode) filters.errorCode = logFilters.errorCode;

      const [stats, ts, errors, logs] = await Promise.all([
        synthesisApi.getStats(),
        synthesisApi.getTimeseries(tsRange),
        synthesisApi.getErrors(errRange),
        synthesisApi.getLogs(filters),
      ]);
      setLogStats(stats);
      setLogTimeseries(ts);
      setLogErrors(errors);
      setLogList(logs.logs);
      setLogTotal(logs.total);
    } catch (e) { console.error(e); }
    finally { setLogsLoading(false); }
  }, [tsRange, errRange, logFilters, logPage, logPageSize]);

  useEffect(() => {
    if (activeTab !== 'logs') return;
    loadLogs();
  }, [activeTab, loadLogs]);

  useEffect(() => {
    if (activeTab !== 'logs' || !autoRefresh) {
      if (logsRefreshTimer.current) {
        clearInterval(logsRefreshTimer.current);
        logsRefreshTimer.current = null;
      }
      return;
    }
    logsRefreshTimer.current = setInterval(() => { loadLogs(); }, 10000);
    return () => {
      if (logsRefreshTimer.current) {
        clearInterval(logsRefreshTimer.current);
        logsRefreshTimer.current = null;
      }
    };
  }, [activeTab, autoRefresh, loadLogs]);

  const handleSynthesize = async () => {
    if (!text || !selectedVoice) return;
    setSynthesizing(true);
    setSynthesisMeta(null);
    const t0 = performance.now();
    try {
      const { blob, generationMs } = await synthesisApi.synthesize({ text, voice: selectedVoice, format, style: style || undefined });
      const clientElapsedMs = Math.round(performance.now() - t0);
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);
      setSynthesisMeta({
        generationMs,
        clientElapsedMs,
        audioDurationSec: 0,
      });
    } catch (e: any) { alert('合成失败: ' + (e.response?.data?.error || e.message)); }
    finally { setSynthesizing(false); }
  };

  const handleDownload = () => {
    if (!audioUrl) return;
    fetch(audioUrl).then(r => r.blob()).then(b => downloadBlob(b, `tts_${Date.now()}.${format}`));
  };

  const applyExample = (ex: SynthesisExample) => {
    setText(ex.text);
    if (ex.format) setFormat(ex.format);
    setStyle(ex.style ?? '');
  };

  const handlePreviewStyled = async () => {
    if (!styledForm.baseVoiceLocalName || !styledForm.previewText || (!styledForm.style.trim() && !hasLeadingStyleTag(styledForm.previewText))) {
      setStyledMsg('请填写基础音色，并提供风格控制或在预览文本开头使用整体风格标签');
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
    if (!styledForm.displayName || !styledForm.localName || !styledForm.baseVoiceLocalName || !styledForm.previewText || (!styledForm.style.trim() && !hasLeadingStyleTag(styledForm.previewText))) {
      setStyledMsg('请完整填写显示名称、调用名称、基础音色，并提供风格控制或整体风格标签');
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
      const token = getToken();
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

  const handleLogout = () => { clearToken(); router.push('/'); };

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
    userContent: styledForm.style || undefined,
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
              { id: 'logs', name: '调用日志' },
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
                <div className="space-y-3">
                  <audio
                    ref={audioRef}
                    controls
                    src={audioUrl}
                    className="w-full"
                    onLoadedMetadata={(e) => {
                      const dur = e.currentTarget.duration;
                      if (Number.isFinite(dur) && dur > 0) {
                        setSynthesisMeta(prev => prev ? { ...prev, audioDurationSec: dur } : prev);
                      }
                      e.currentTarget.playbackRate = playbackRate;
                    }}
                  />
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-gray-500 mr-1">倍速</span>
                      {[0.75, 1, 1.25, 1.5, 1.75, 2].map(rate => (
                        <button
                          key={rate}
                          onClick={() => {
                            setPlaybackRate(rate);
                            if (audioRef.current) audioRef.current.playbackRate = rate;
                          }}
                          className={`px-2 py-1 text-xs rounded border ${playbackRate === rate
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
                        >
                          {rate}x
                        </button>
                      ))}
                    </div>
                    <button onClick={handleDownload} className="px-4 py-1.5 bg-green-600 text-white text-sm rounded-md hover:bg-green-700">下载音频</button>
                  </div>
                  {synthesisMeta && (
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-600 bg-gray-50 rounded-md px-3 py-2">
                      <span>生成耗时（服务端）：<span className="font-medium text-gray-900">{synthesisMeta.generationMs > 0 ? `${(synthesisMeta.generationMs / 1000).toFixed(2)} s` : '—'}</span></span>
                      <span>客户端总耗时：<span className="font-medium text-gray-900">{(synthesisMeta.clientElapsedMs / 1000).toFixed(2)} s</span></span>
                      <span>音频时长：<span className="font-medium text-gray-900">{synthesisMeta.audioDurationSec > 0 ? `${synthesisMeta.audioDurationSec.toFixed(2)} s` : '—'}</span></span>
                      <span>
                        RTF：
                        <span className="font-medium text-gray-900">
                          {synthesisMeta.audioDurationSec > 0 && synthesisMeta.generationMs > 0
                            ? (synthesisMeta.generationMs / 1000 / synthesisMeta.audioDurationSec).toFixed(3)
                            : '—'}
                        </span>
                        <span className="text-gray-400 ml-1">（&lt; 1 为实时）</span>
                      </span>
                    </div>
                  )}
                </div>
              )}

              <div className="border-t pt-6">
                <h3 className="text-sm font-medium text-gray-700 mb-1">听书场景试听示例</h3>
                <p className="text-xs text-gray-500 mb-3">挑选了 8 段热门小说桥段，每段 150 字左右，贴近真实听书体验。点「使用此示例」会填入上方表单（音色保持当前选择），再点「合成语音」即可试听。</p>
                <ul className="space-y-2">
                  {SYNTHESIS_EXAMPLES.map(ex => (
                    <li key={ex.name} className="flex items-start justify-between gap-3 p-3 bg-gray-50 rounded-md">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-gray-900">
                          {ex.name}
                          {ex.format && <span className="ml-2 text-xs text-gray-400">[{ex.format}]</span>}
                          {ex.style && <span className="ml-1 text-xs text-purple-500">[风格:{ex.style}]</span>}
                          <span className="ml-2 text-xs text-gray-400">约 {ex.text.length} 字</span>
                        </div>
                        <div className="text-xs text-gray-600 mt-1 line-clamp-2">{ex.text}</div>
                      </div>
                      <button
                        onClick={() => applyExample(ex)}
                        className="shrink-0 px-3 py-1 text-xs bg-blue-50 text-blue-600 border border-blue-200 rounded hover:bg-blue-100"
                      >
                        使用此示例
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
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
                    <p className="text-xs text-gray-400 mt-1">这里可以留空。如果你要用音频标签控制，请在「预览文本」开头写整体风格标签，例如 `(慵懒)` 或 `[温柔]`。</p>
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
                      disabled={previewingStyled || !styledForm.baseVoiceLocalName || !styledForm.previewText || (!styledForm.style.trim() && !hasLeadingStyleTag(styledForm.previewText))}
                      className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">
                      {previewingStyled ? '合成中...' : '合成预览'}
                    </button>
                    <button onClick={handleSaveStyled}
                      disabled={savingStyled || !styledPreviewBlob || !styledForm.displayName || !styledForm.localName || !styledForm.baseVoiceLocalName || !styledForm.previewText || (!styledForm.style.trim() && !hasLeadingStyleTag(styledForm.previewText))}
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

          {/* ========== 调用日志 ========== */}
          {activeTab === 'logs' && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">调用日志</h2>
                  <p className="text-sm text-gray-500">记录所有合成调用的成功/失败、耗时、错误代码和客户端信息。</p>
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                    自动刷新 (10s)
                  </label>
                  <button onClick={() => loadLogs()} disabled={logsLoading}
                    className="px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">
                    {logsLoading ? '刷新中...' : '刷新'}
                  </button>
                </div>
              </div>

              {/* 总览卡片 */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard label="总调用数" value={logStats?.total ?? '—'} hint={`成功 ${logStats?.successful ?? 0} · 失败 ${logStats?.failed ?? 0}`} />
                <StatCard
                  label="成功率"
                  value={logStats ? `${logStats.successRate.toFixed(1)}%` : '—'}
                  hint={logStats && logStats.successRate < 95 ? '低于 95%，建议关注错误分布' : '运行良好'}
                  tone={logStats && logStats.successRate < 95 ? 'warn' : 'ok'}
                />
                <StatCard label="近 1 分钟 RPM" value={logStats?.rpm ?? '—'} hint={`近 1 小时 ${logStats?.requestsLastHour ?? 0} 次`} />
                <StatCard
                  label="近 24 小时调用"
                  value={logStats?.requestsLast24h ?? '—'}
                  hint={`其中失败 ${logStats?.failedLast24h ?? 0} · 平均 ${logStats ? formatDuration(logStats.avgDurationMs) : '—'}`}
                  tone={logStats && logStats.failedLast24h > 0 ? 'warn' : 'ok'}
                />
              </div>

              {/* RPM 时序图 */}
              <div className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-medium text-gray-700">请求频率时序图</h3>
                  <div className="flex gap-2">
                    {([
                      { id: 'hour', name: '最近 1 小时（按分钟）' },
                      { id: 'day', name: '最近 24 小时（10 分钟一格）' },
                    ] as const).map(t => (
                      <button key={t.id} onClick={() => setTsRange(t.id)}
                        className={`${tsRange === t.id ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'} px-3 py-1.5 rounded-md text-xs`}>
                        {t.name}
                      </button>
                    ))}
                  </div>
                </div>
                <RpmChart data={logTimeseries} />
              </div>

              {/* 错误分布 */}
              <div className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-medium text-gray-700">错误分布</h3>
                  <div className="flex gap-2">
                    {([
                      { id: 'hour', name: '近 1 小时' },
                      { id: 'day', name: '近 24 小时' },
                      { id: 'all', name: '全部' },
                    ] as const).map(t => (
                      <button key={t.id} onClick={() => setErrRange(t.id)}
                        className={`${errRange === t.id ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'} px-3 py-1.5 rounded-md text-xs`}>
                        {t.name}
                      </button>
                    ))}
                  </div>
                </div>
                {logErrors && logErrors.items.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">错误代码</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">HTTP 状态</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">次数</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">占比</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {(() => {
                          const total = logErrors.items.reduce((s, it) => s + it.count, 0);
                          return logErrors.items.map((it, idx) => (
                            <tr key={idx}>
                              <td className="px-4 py-2 text-sm font-mono text-gray-900">{it.errorCode}</td>
                              <td className="px-4 py-2 text-sm text-gray-600">{it.statusCode ?? '—'}</td>
                              <td className="px-4 py-2 text-sm text-gray-900">{it.count}</td>
                              <td className="px-4 py-2 text-sm text-gray-500">
                                {total > 0 ? `${((it.count / total) * 100).toFixed(1)}%` : '—'}
                              </td>
                              <td className="px-4 py-2 text-sm">
                                <button onClick={() => { setLogFilters({ success: 'false', endpoint: '', errorCode: it.errorCode }); setLogPage(0); }}
                                  className="text-blue-600 hover:text-blue-800">查看明细</button>
                              </td>
                            </tr>
                          ));
                        })()}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">所选时段内没有错误记录。</p>
                )}
              </div>

              {/* 日志明细 */}
              <div className="border rounded-lg p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-sm font-medium text-gray-700">日志明细（共 {logTotal} 条）</h3>
                  <div className="flex flex-wrap items-center gap-2">
                    <select value={logFilters.success}
                      onChange={e => { setLogFilters({ ...logFilters, success: e.target.value as '' | 'true' | 'false' }); setLogPage(0); }}
                      className="px-2 py-1.5 text-sm border border-gray-300 rounded-md">
                      <option value="">全部状态</option>
                      <option value="true">仅成功</option>
                      <option value="false">仅失败</option>
                    </select>
                    <select value={logFilters.endpoint}
                      onChange={e => { setLogFilters({ ...logFilters, endpoint: e.target.value }); setLogPage(0); }}
                      className="px-2 py-1.5 text-sm border border-gray-300 rounded-md">
                      <option value="">全部接口</option>
                      <option value="/v1/audio/speech">/v1/audio/speech</option>
                      <option value="/api/synthesize">/api/synthesize</option>
                    </select>
                    <input type="text" value={logFilters.errorCode}
                      onChange={e => { setLogFilters({ ...logFilters, errorCode: e.target.value }); setLogPage(0); }}
                      placeholder="按错误代码筛选"
                      className="px-2 py-1.5 text-sm border border-gray-300 rounded-md w-44" />
                    {(logFilters.success || logFilters.endpoint || logFilters.errorCode) && (
                      <button onClick={() => { setLogFilters({ success: '', endpoint: '', errorCode: '' }); setLogPage(0); }}
                        className="px-2 py-1.5 text-sm text-gray-600 hover:text-gray-900">清除筛选</button>
                    )}
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">时间</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">接口</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">音色</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">文本</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">状态</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">错误代码</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">耗时</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">IP</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {logList.map(l => (
                        <tr key={l.id} className={l.success ? '' : 'bg-red-50/30'}>
                          <td className="px-3 py-2 text-xs text-gray-600 whitespace-nowrap">{new Date(l.createdAt).toLocaleString('zh-CN', { hour12: false })}</td>
                          <td className="px-3 py-2 text-xs font-mono text-gray-600 whitespace-nowrap">{l.endpoint || '—'}</td>
                          <td className="px-3 py-2 text-xs text-gray-700 whitespace-nowrap">{l.voiceLocalName || '—'}</td>
                          <td className="px-3 py-2 text-xs text-gray-600 max-w-xs truncate" title={l.inputText}>{l.inputText || <span className="text-gray-300">（空）</span>}</td>
                          <td className="px-3 py-2 text-xs whitespace-nowrap">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${l.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                              {l.success ? `成功 ${l.statusCode ?? 200}` : `失败 ${l.statusCode ?? ''}`}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-xs font-mono text-gray-700 whitespace-nowrap" title={l.errorMessage || ''}>
                            {l.errorCode || (l.success ? '—' : 'unknown')}
                          </td>
                          <td className="px-3 py-2 text-xs text-gray-600 whitespace-nowrap">{formatDuration(l.durationMs)}</td>
                          <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{l.clientIp || '—'}</td>
                        </tr>
                      ))}
                      {logList.length === 0 && (
                        <tr>
                          <td colSpan={8} className="px-3 py-8 text-center text-sm text-gray-500">{logsLoading ? '加载中...' : '没有匹配的日志'}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center justify-between pt-2">
                  <span className="text-xs text-gray-500">第 {logPage + 1} / {Math.max(1, Math.ceil(logTotal / logPageSize))} 页</span>
                  <div className="flex gap-2">
                    <button onClick={() => setLogPage(p => Math.max(0, p - 1))} disabled={logPage === 0}
                      className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 disabled:opacity-50">上一页</button>
                    <button onClick={() => setLogPage(p => p + 1)} disabled={(logPage + 1) * logPageSize >= logTotal}
                      className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 disabled:opacity-50">下一页</button>
                  </div>
                </div>
              </div>
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
