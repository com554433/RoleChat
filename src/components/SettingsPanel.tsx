import { memo, useRef, useState, useEffect } from 'react';
import { useChatStore } from '../store/chatStore';
import type { LlmProvider } from '../types';

interface Props {
  onClose: () => void;
}

const DEEPSEEK_MODELS = ['deepseek-v4-pro', 'deepseek-v4-flash'];
const MIMO_MODELS = ['mimo-v2.5-pro', 'mimo-v2.5'];
const MIMO_TTS_MODELS = ['mimo-v2.5-tts-voiceclone', 'mimo-v2.5-tts', 'mimo-v2.5-tts-voicedesign'];

function reasoningLabel(v: number, provider: LlmProvider) {
  if (provider === 'mimo') {
    return v <= 0 ? '关闭' : '开启';
  }
  // DeepSeek: 0=关闭, 1-66=high, 67-100=max
  if (v <= 0) return '关闭';
  if (v <= 66) return 'high';
  return 'max';
}

export default memo(function SettingsPanel({ onClose }: Props) {
  const roleConfig = useChatStore((s) => s.roleConfig);
  const avatarDataUrl = useChatStore((s) => s.avatarDataUrl);
  const setAvatarDataUrl = useChatStore((s) => s.setAvatarDataUrl);
  const backgroundUrl = useChatStore((s) => s.backgroundUrl);
  const setBackgroundUrl = useChatStore((s) => s.setBackgroundUrl);
  const voiceSampleDataUrl = useChatStore((s) => s.voiceSampleDataUrl);
  const setVoiceSampleDataUrl = useChatStore((s) => s.setVoiceSampleDataUrl);
  const apiSettings = useChatStore((s) => s.apiSettings);
  const updateApiSettings = useChatStore((s) => s.updateApiSettings);
  const nonTokenPlan = useChatStore((s) => s.nonTokenPlan);
  const updateNonTokenPlan = useChatStore((s) => s.updateNonTokenPlan);
  const showThinking = useChatStore((s) => s.showThinking);
  const setShowThinking = useChatStore((s) => s.setShowThinking);
  const isTtsEnabled = useChatStore((s) => s.isTtsEnabled);
  const toggleTts = useChatStore((s) => s.toggleTts);
  const theme = useChatStore((s) => s.theme);
  const toggleTheme = useChatStore((s) => s.toggleTheme);
  const setRoleConfig = useChatStore((s) => s.setRoleConfig);
  const clearChat = useChatStore((s) => s.clearChat);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);
  const voiceInputRef = useRef<HTMLInputElement>(null);
  const [editName, setEditName] = useState(roleConfig?.name || '');
  const [editSystemPrompt, setEditSystemPrompt] = useState(roleConfig?.system_prompt || '');

  // sync when roleConfig changes (e.g. switching skills)
  useEffect(() => {
    setEditName(roleConfig?.name || '');
    setEditSystemPrompt(roleConfig?.system_prompt || '');
  }, [roleConfig?.name, roleConfig?.system_prompt]);

  const currentProvider = apiSettings.provider || 'mimo';

  // 处理文件读取为 Data URL
  const handleFileToDataUrl = (
    file: File,
    callback: (url: string) => void,
    maxSizeMB = 10,
  ) => {
    if (file.size > maxSizeMB * 1024 * 1024) {
      alert(`文件大小不能超过 ${maxSizeMB}MB`);
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => callback(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  // 安全剪贴板 API
  const clip = () => {
    const w = window as any;
    return w.electronAPI?.clipboard ?? null;
  };

  const handlePaste = (onFill: (v: string) => void) => {
    const c = clip();
    if (c) {
      try {
        const text = c.readText();
        if (text) { onFill(text); return; }
      } catch { /* 降级 */ }
    }
    navigator.clipboard.readText().then((text: string) => {
      if (text) onFill(text);
    }).catch(() => {});
  };

  const handleSaveRole = () => {
    if (roleConfig) {
      setRoleConfig({
        ...roleConfig,
        name: editName,
        system_prompt: editSystemPrompt,
      });
    }
  };



  return (
    <>
      <div className="panel-overlay" onClick={onClose} />
      <div className="slide-panel">
        <div className="panel-header">
          <span>设置</span>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="panel-body">
          {/* ====== 角色设置 ====== */}
          <div className="setting-group">
            <h3 style={{ fontSize: '15px', fontWeight: 500, marginBottom: '12px' }}>
              🎭 角色设置
            </h3>

            <div className="setting-label">角色名称</div>
            <input
              className="setting-input"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={handleSaveRole}
              placeholder="输入角色名称"
            />

            <div className="setting-label" style={{ marginTop: '12px' }}>角色头像</div>
            <div className="upload-zone" onClick={() => avatarInputRef.current?.click()}>
              {avatarDataUrl ? (
                <img src={avatarDataUrl} alt="" className="preview-thumb" />
              ) : (
                <>
                  <div className="upload-icon">📷</div>
                  <div className="upload-text">点击上传头像</div>
                </>
              )}
            </div>
            <input ref={avatarInputRef} type="file" accept="image/*" style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileToDataUrl(file, setAvatarDataUrl, 2);
              }}
            />

            <div className="setting-label" style={{ marginTop: '12px' }}>聊天背景</div>
            <div className="upload-zone" onClick={() => bgInputRef.current?.click()}>
              {backgroundUrl ? (
                <img src={backgroundUrl} alt="" className="preview-thumb" />
              ) : (
                <>
                  <div className="upload-icon">🖼️</div>
                  <div className="upload-text">点击上传聊天背景</div>
                </>
              )}
            </div>
            <input ref={bgInputRef} type="file" accept="image/*" style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileToDataUrl(file, setBackgroundUrl, 5);
              }}
            />
            {backgroundUrl && (
              <button style={{ marginTop: '8px', padding: '4px 12px', border: '1px solid #e0e0e0', borderRadius: '4px', background: '#fff', cursor: 'pointer', fontSize: '13px', color: '#ff4d4f' }}
                onClick={() => setBackgroundUrl('')}>移除背景</button>
            )}

            <div className="setting-label" style={{ marginTop: '12px' }}>角色 System Prompt</div>
            <textarea
              className="setting-input"
              value={editSystemPrompt}
              onChange={(e) => setEditSystemPrompt(e.target.value)}
              onBlur={handleSaveRole}
              placeholder="输入角色的系统提示词……"
              rows={5}
              style={{ resize: 'vertical', fontFamily: 'inherit' }}
            />
          </div>

          <div className="divider" />

          {/* ====== 语音设置 ====== */}
          <div className="setting-group">
            <h3 style={{ fontSize: '15px', fontWeight: 500, marginBottom: '12px' }}>
              🎙️ 语音设置
            </h3>

            {currentProvider === 'deepseek' && (
              <div style={{ padding: '8px 12px', background: '#fff8e1', border: '1px solid #ffe082', borderRadius: '6px', fontSize: '12px', color: '#f57f17', marginBottom: '12px' }}>
                TTS 语音克隆为 MiMo 特有功能，当前 LLM 提供商为 DeepSeek，语音功能将使用 TokenPlan 中的 MiMo 配置
              </div>
            )}

            <div className="toggle-row">
              <div>
                <div className="toggle-label">启用语音朗读 (TTS)</div>
                <div className="toggle-desc">使用 VoiceClone 复刻角色音色朗读回复</div>
              </div>
              <div className={`toggle-switch ${isTtsEnabled ? 'active' : ''}`} onClick={toggleTts} />
            </div>

            <div className="setting-label" style={{ marginTop: '12px' }}>
              角色语音样本 {!isTtsEnabled && <span style={{ color: '#bbb', fontSize: '12px' }}>(需先启用TTS)</span>}
            </div>
            <div className="upload-zone" onClick={() => voiceInputRef.current?.click()}>
              {voiceSampleDataUrl ? (
                <div>
                  <div style={{ fontSize: '20px', marginBottom: '4px' }}>🎵</div>
                  <div className="upload-text">已上传语音样本</div>
                  <audio src={voiceSampleDataUrl} controls style={{ marginTop: '8px', width: '100%', maxWidth: '200px' }} />
                </div>
              ) : (
                <>
                  <div className="upload-icon">🎤</div>
                  <div className="upload-text">
                    点击上传角色语音样本 (wav/mp3)
                    <br />
                    <span style={{ fontSize: '12px', color: '#bbb' }}>用于音色克隆，建议3~10秒清晰语音</span>
                  </div>
                </>
              )}
            </div>
            <input ref={voiceInputRef} type="file" accept="audio/*" style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileToDataUrl(file, setVoiceSampleDataUrl, 5);
              }}
            />
          </div>

          <div className="divider" />

          {/* ====== 语音模型 API 设置 ====== */}
          <div className="setting-group">
            <h3 style={{ fontSize: '15px', fontWeight: 500, marginBottom: '12px' }}>
              🔗 语音模型 API 设置
            </h3>
            <div style={{ padding: '8px 12px', background: '#eef2ff', borderRadius: '6px', fontSize: '12px', color: '#3730a3', marginBottom: '12px' }}>
              TTS 语音克隆为 MiMo 特有功能，需使用 MiMo API Key。不填则沿用上方模型设置中的 API Key。
            </div>

            <div className="setting-label">TTS API Key</div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <input
                className="setting-input" type="password"
                value={apiSettings.ttsApiKey}
                onChange={(e) => updateApiSettings({ ttsApiKey: e.target.value })}
                placeholder="留空则沿用上方 API Key (sk-mimo-xxxx)"
                style={{ flex: 1 }}
              />
              <button className="copy-key-btn" onClick={() => handlePaste((v) => updateApiSettings({ ttsApiKey: v }))} title="从剪贴板粘贴">粘贴</button>
            </div>

            <div className="setting-label" style={{ marginTop: '12px' }}>TTS Base URL</div>
            <input
              className="setting-input"
              value={apiSettings.ttsBaseUrl}
              onChange={(e) => updateApiSettings({ ttsBaseUrl: e.target.value })}
              placeholder="留空则沿用上方 Base URL (https://api.xiaomimimo.com/v1)"
            />

            <div className="setting-label" style={{ marginTop: '12px' }}>TTS 语音模型</div>
            <select className="setting-input" value={apiSettings.ttsModel}
              onChange={(e) => updateApiSettings({ ttsModel: e.target.value })}>
              {MIMO_TTS_MODELS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>

            {apiSettings.ttsApiKey && (
              <div style={{ marginTop: '8px', fontSize: '12px', color: '#6366f1' }}>
                已配置独立 TTS API，语音合成将使用此 Key
              </div>
            )}
          </div>

          <div className="divider" />

          {/* ====== ASR 语音识别设置 ====== */}
          <div className="setting-group">
            <h3 style={{ fontSize: '15px', fontWeight: 500, marginBottom: '12px' }}>
              🎤 语音识别 (ASR)
            </h3>

            <div className="toggle-row">
              <div>
                <div className="toggle-label">启用语音输入</div>
                <div className="toggle-desc">在聊天输入框旁显示麦克风按钮，语音转文字</div>
              </div>
              <div className={`toggle-switch ${apiSettings.asrEnabled ? 'active' : ''}`}
                onClick={() => updateApiSettings({ asrEnabled: !apiSettings.asrEnabled })} />
            </div>

            {apiSettings.asrEnabled && (
              <>
                <div className="setting-label" style={{ marginTop: '12px' }}>ASR API Key</div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input className="setting-input" type="password"
                    value={apiSettings.asrApiKey || apiSettings.mimoApiKey || apiSettings.apiKey}
                    onChange={(e) => updateApiSettings({ asrApiKey: e.target.value })}
                    placeholder="留空则沿用 MiMo API Key"
                    style={{ flex: 1 }} />
                  <button className="copy-key-btn" onClick={() => handlePaste((v) => updateApiSettings({ asrApiKey: v }))}>粘贴</button>
                </div>

                <div className="setting-label" style={{ marginTop: '10px' }}>ASR Base URL</div>
                <input className="setting-input"
                  value={apiSettings.asrBaseUrl}
                  onChange={(e) => updateApiSettings({ asrBaseUrl: e.target.value })}
                  placeholder="https://api.xiaomimimo.com/v1" />

                <div className="setting-label" style={{ marginTop: '10px' }}>ASR 模型</div>
                <input className="setting-input"
                  value={apiSettings.asrModel}
                  onChange={(e) => updateApiSettings({ asrModel: e.target.value })}
                  placeholder="mimo-v2.5-asr" />

                <div style={{ marginTop: '8px', padding: '8px 12px', background: '#f0fdf5', borderRadius: '6px', fontSize: '12px', color: '#666' }}>
                  使用 OpenAI 兼容的 <code style={{ background: '#dcfce7', padding: '1px 4px', borderRadius: '3px' }}>/v1/audio/transcriptions</code> 端点，支持 MiMo 及其他兼容服务
                </div>
              </>
            )}
          </div>

          <div className="divider" />

          {/* ====== 模型设置 ====== */}
          <div className="setting-group">
            <h3 style={{ fontSize: '15px', fontWeight: 500, marginBottom: '12px' }}>
              🤖 模型设置
            </h3>

            {/* ========== DeepSeek 配置 ========== */}
            <div style={{
              padding: '12px', border: currentProvider === 'deepseek' ? '2px solid #6366f1' : '1px solid #e0e0e0',
              borderRadius: '8px', background: currentProvider === 'deepseek' ? '#f5f3ff' : '#fafafa',
              marginBottom: '12px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h4 style={{ fontSize: '14px', fontWeight: 600, color: '#6366f1', margin: 0 }}>🔵 DeepSeek</h4>
                {currentProvider === 'deepseek' ? (
                  <span style={{ fontSize: '11px', color: '#6366f1', background: '#e0e7ff', padding: '2px 8px', borderRadius: '4px', fontWeight: 500 }}>● 当前使用</span>
                ) : (
                  <button onClick={() => updateApiSettings({ provider: 'deepseek' })}
                    style={{ fontSize: '11px', padding: '3px 10px', border: '1px solid #6366f1', borderRadius: '4px', background: '#fff', color: '#6366f1', cursor: 'pointer' }}>
                    切换至此
                  </button>
                )}
              </div>

              <div style={{ marginBottom: '4px', padding: '4px 8px', background: '#eef2ff', borderRadius: '4px', fontSize: '11px', color: '#3730a3' }}>
                认证: <code style={{ background: '#c7d2fe', padding: '1px 4px', borderRadius: '3px' }}>Authorization: Bearer</code>
              </div>

              <div className="setting-label">API Key</div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <input className="setting-input" type="password"
                  value={apiSettings.deepseekApiKey || apiSettings.apiKey}
                  onChange={(e) => updateApiSettings({ deepseekApiKey: e.target.value })}
                  placeholder="sk-xxxx (DeepSeek API Key)"
                  style={{ flex: 1 }} />
                <button className="copy-key-btn" onClick={() => handlePaste((v) => updateApiSettings({ deepseekApiKey: v }))}>粘贴</button>
              </div>

              <div className="setting-label" style={{ marginTop: '10px' }}>Base URL</div>
              <input className="setting-input"
                value={apiSettings.deepseekBaseUrl || apiSettings.baseUrl}
                onChange={(e) => updateApiSettings({ deepseekBaseUrl: e.target.value })}
                placeholder="https://api.deepseek.com/v1/chat/completions" />

              <div className="setting-label" style={{ marginTop: '10px' }}>语言模型</div>
              <select className="setting-input"
                value={apiSettings.deepseekModel || apiSettings.llmModel}
                onChange={(e) => updateApiSettings({ deepseekModel: e.target.value })}>
                {DEEPSEEK_MODELS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>

            {/* ========== MiMo 配置 ========== */}
            <div style={{
              padding: '12px', border: currentProvider === 'mimo' ? '2px solid #6366f1' : '1px solid #e0e0e0',
              borderRadius: '8px', background: currentProvider === 'mimo' ? '#f5f3ff' : '#fafafa',
              marginBottom: '12px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h4 style={{ fontSize: '14px', fontWeight: 600, color: '#6366f1', margin: 0 }}>🟠 MiMo (小米)</h4>
                {currentProvider === 'mimo' ? (
                  <span style={{ fontSize: '11px', color: '#6366f1', background: '#e0e7ff', padding: '2px 8px', borderRadius: '4px', fontWeight: 500 }}>● 当前使用</span>
                ) : (
                  <button onClick={() => updateApiSettings({ provider: 'mimo' })}
                    style={{ fontSize: '11px', padding: '3px 10px', border: '1px solid #6366f1', borderRadius: '4px', background: '#fff', color: '#6366f1', cursor: 'pointer' }}>
                    切换至此
                  </button>
                )}
              </div>

              <div style={{ marginBottom: '4px', padding: '4px 8px', background: '#fef3c7', borderRadius: '4px', fontSize: '11px', color: '#92400e' }}>
                认证: <code style={{ background: '#fde68a', padding: '1px 4px', borderRadius: '3px' }}>api-key header</code>
              </div>

              <div className="setting-label">API Key</div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <input className="setting-input" type="password"
                  value={apiSettings.mimoApiKey || apiSettings.apiKey}
                  onChange={(e) => updateApiSettings({ mimoApiKey: e.target.value })}
                  placeholder="sk-mimo-xxxx (MiMo API Key)"
                  style={{ flex: 1 }} />
                <button className="copy-key-btn" onClick={() => handlePaste((v) => updateApiSettings({ mimoApiKey: v }))}>粘贴</button>
              </div>

              <div className="setting-label" style={{ marginTop: '10px' }}>Base URL</div>
              <input className="setting-input"
                value={apiSettings.mimoBaseUrl || apiSettings.baseUrl}
                onChange={(e) => updateApiSettings({ mimoBaseUrl: e.target.value })}
                placeholder="https://api.xiaomimimo.com/v1" />

              <div className="setting-label" style={{ marginTop: '10px' }}>语言模型</div>
              <select className="setting-input"
                value={apiSettings.mimoModel || apiSettings.llmModel}
                onChange={(e) => updateApiSettings({ mimoModel: e.target.value })}>
                {MIMO_MODELS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>

              <div className="setting-label" style={{ marginTop: '10px' }}>TTS 语音模型</div>
              <select className="setting-input" value={apiSettings.ttsModel}
                onChange={(e) => updateApiSettings({ ttsModel: e.target.value })}>
                {MIMO_TTS_MODELS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>

            {/* ========== 按量计费 (MiMo) ========== */}
            <div style={{
              padding: '12px', border: '1px solid #e0e0e0', borderRadius: '8px', background: '#f9fafb',
            }}>
              <h4 style={{ fontSize: '14px', fontWeight: 600, color: '#6366f1', margin: '0 0 4px 0' }}>💳 按量计费 API（独立配置）</h4>
              <div style={{ fontSize: '11px', color: '#999', marginBottom: '10px' }}>使用独立账号的 API 配置（与 TokenPlan 分开），仅 MiMo 有效</div>

              <div className="toggle-row" style={{
                padding: '10px 12px', border: nonTokenPlan.enabled ? '1px solid #6366f1' : '1px solid #e0e0e0',
                borderRadius: '6px', background: nonTokenPlan.enabled ? '#f5f3ff' : '#fff',
                marginBottom: nonTokenPlan.enabled ? '12px' : '0',
              }}>
                <div className="toggle-label" style={{ fontSize: '13px' }}>启用按量计费</div>
                <div className={`toggle-switch ${nonTokenPlan.enabled ? 'active' : ''}`}
                  onClick={() => updateNonTokenPlan({ enabled: !nonTokenPlan.enabled })} />
              </div>

              {nonTokenPlan.enabled && (<>
                <div className="setting-label">按量计费 API Key</div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input className="setting-input" type="password"
                    value={nonTokenPlan.apiKey}
                    onChange={(e) => updateNonTokenPlan({ apiKey: e.target.value })}
                    placeholder="sk-mimo-xxxx" style={{ flex: 1 }} />
                  <button className="copy-key-btn" onClick={() => handlePaste((v) => updateNonTokenPlan({ apiKey: v }))}>粘贴</button>
                </div>

                <div className="setting-label" style={{ marginTop: '10px' }}>按量计费 Base URL</div>
                <input className="setting-input"
                  value={nonTokenPlan.baseUrl}
                  onChange={(e) => updateNonTokenPlan({ baseUrl: e.target.value })}
                  placeholder="https://api.xiaomimimo.com/v1" />

                <div className="setting-label" style={{ marginTop: '10px' }}>按量计费语言模型</div>
                <select className="setting-input" value={nonTokenPlan.model}
                  onChange={(e) => updateNonTokenPlan({ model: e.target.value })}>
                  {MIMO_MODELS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>

                <div className="setting-label" style={{ marginTop: '10px' }}>按量计费 TTS 语音模型</div>
                <select className="setting-input" value={nonTokenPlan.ttsModel}
                  onChange={(e) => updateNonTokenPlan({ ttsModel: e.target.value })}>
                  {MIMO_TTS_MODELS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>

                <div className="setting-toggle-row" style={{ marginTop: '12px' }}>
                  <label className="setting-toggle-label" htmlFor="tts-use-tokenplan">🎤 TTS 沿用 TokenPlan 配置</label>
                  <label className="toggle-switch">
                    <input id="tts-use-tokenplan" type="checkbox" checked={nonTokenPlan.ttsUseTokenPlan}
                      onChange={(e) => updateNonTokenPlan({ ttsUseTokenPlan: e.target.checked })} />
                    <span className="toggle-slider"></span>
                  </label>
                </div>
                {nonTokenPlan.ttsUseTokenPlan && (
                  <div style={{ fontSize: '11px', color: '#6366f1', marginTop: '4px' }}>
                    语音克隆为 MiMo 特有功能，TTS 将使用上方 TokenPlan 配置
                  </div>
                )}
              </>)}
            </div>

            {/* ========== 思考设置 ========== */}
            <div style={{ marginTop: '16px', padding: '12px', border: '1px solid #e0e0e0', borderRadius: '8px', background: '#fafafa' }}>
              <h4 style={{ fontSize: '14px', fontWeight: 600, color: '#6366f1', margin: '0 0 10px 0' }}>🧠 思考设置</h4>

              <div className="toggle-row">
                <div>
                  <div className="toggle-label">显示思考过程</div>
                  <div className="toggle-desc">在聊天中查看模型的推理内容</div>
                </div>
                <div className={`toggle-switch ${showThinking ? 'active' : ''}`} onClick={() => setShowThinking(!showThinking)} />
              </div>

              <div style={{ marginTop: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <div className="setting-label" style={{ margin: 0 }}>思考强度</div>
                  <span style={{ fontSize: '12px', color: '#6366f1', fontWeight: 500 }}>
                    {reasoningLabel(apiSettings.reasoningEffort ?? 50, currentProvider)}
                  </span>
                </div>
                <input type="range" min="0" max="100" step="1" value={apiSettings.reasoningEffort ?? 50}
                  onChange={(e) => updateApiSettings({ reasoningEffort: Number(e.target.value) })}
                  style={{ width: '100%', accentColor: '#6366f1' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#999', marginTop: '2px' }}>
                  {currentProvider === 'mimo' ? (
                    <><span>关闭</span><span>开启</span></>
                  ) : (
                    <><span>关闭</span><span>high</span><span>max</span></>
                  )}
                </div>
                <div className="toggle-desc" style={{ marginTop: '4px' }}>
                  {currentProvider === 'mimo' ? 'MiMo 仅支持开/关' : 'DeepSeek 支持 high/max 两档'}
                </div>
              </div>
            </div>
          </div>

          <div className="divider" />

          {/* ====== 其他 ====== */}
          <div className="setting-group">
            <h3 style={{ fontSize: '15px', fontWeight: 500, marginBottom: '12px' }}>⚙️ 其他</h3>

            <div className="toggle-row">
              <div>
                <div className="toggle-label">{theme === 'dark' ? '🌙 深色模式' : '☀️ 浅色模式'}</div>
                <div className="toggle-desc">切换界面配色风格</div>
              </div>
              <div className={`toggle-switch ${theme === 'dark' ? 'active' : ''}`} onClick={toggleTheme} />
            </div>

            <div style={{ height: '12px' }} />
            <button style={{ width: '100%', padding: '10px', border: '1px solid #ff4d4f', borderRadius: '6px', background: '#fff', color: '#ff4d4f', cursor: 'pointer', fontSize: '14px' }}
              onClick={clearChat}>清空聊天记录</button>
          </div>

          <div className="divider" />

          {/* ====== 关于 ====== */}
          <div className="setting-group">
            <h3 style={{ fontSize: '15px', fontWeight: 500, marginBottom: '12px' }}>ℹ️ 关于</h3>
            <div style={{ fontSize: '13px', color: '#888', lineHeight: '1.8' }}>
              <div>飞云间</div>
              <div>版本 ver1.5</div>
              <div style={{ marginTop: '4px' }}>基于 Electron + React + TypeScript 构建</div>
            </div>
          </div>

          {/* 配置说明 */}
          <div style={{ marginTop: '16px', padding: '12px', background: '#f0fdf5', borderRadius: '8px', fontSize: '12px', color: '#666', lineHeight: '1.6' }}>
            <strong>API 配置说明</strong>
            <ul style={{ paddingLeft: '16px', marginTop: '4px' }}>
              <li><strong>MiMo</strong>：需在 <a href="https://platform.xiaomimimo.com" target="_blank" rel="noreferrer" style={{ color: '#07c160' }}>小米MiMo开放平台</a> 获取 API Key</li>
              <li><strong>DeepSeek</strong>：需在 <a href="https://platform.deepseek.com" target="_blank" rel="noreferrer" style={{ color: '#07c160' }}>DeepSeek 开放平台</a> 获取 API Key</li>
              <li>语言模型: MiMo (mimo-v2.5 / mimo-v2.5-pro) 或 DeepSeek (deepseek-chat / deepseek-reasoner / deepseek-v4-pro)</li>
              <li>语音模型 (仅 MiMo): mimo-v2.5-tts-voiceclone (通过上传音频进行音色克隆)</li>
              <li>TTS 系列模型目前限时免费</li>
              <li>思考强度仅 DeepSeek 支持（high/max），MiMo 仅支持开/关</li>
            </ul>
          </div>
        </div>
      </div>
    </>
  );
})
