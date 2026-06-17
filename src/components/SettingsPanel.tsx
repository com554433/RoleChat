import { memo, useRef, useState, useEffect } from 'react';
import { useChatStore } from '../store/chatStore';

interface Props {
  onClose: () => void;
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
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedNtpKey, setCopiedNtpKey] = useState(false);
  const [copiedNtpUrl, setCopiedNtpUrl] = useState(false);
  const [editName, setEditName] = useState(roleConfig?.name || '');
  const [editSystemPrompt, setEditSystemPrompt] = useState(roleConfig?.system_prompt || '');

  // sync when roleConfig changes (e.g. switching skills)
  useEffect(() => {
    setEditName(roleConfig?.name || '');
    setEditSystemPrompt(roleConfig?.system_prompt || '');
  }, [roleConfig?.name, roleConfig?.system_prompt]);

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

  // 安全剪贴板 API（Electron 原生 > 浏览器 navigator）
  const clip = () => {
    const w = window as any;
    return w.electronAPI?.clipboard ?? null;
  };

  // 复制
  const handleCopy = (text: string, setter: (v: boolean) => void) => {
    if (!text) return;
    const c = clip();
    const p = c
      ? Promise.resolve(c.writeText(text))
      : navigator.clipboard.writeText(text);
    p.then(() => {
      setter(true);
      setTimeout(() => setter(false), 1500);
    });
  };

  // 从剪贴板粘贴（兼容同步/异步，双重兜底）
  const handlePaste = (onFill: (v: string) => void) => {
    const c = clip();
    if (c) {
      // Electron clipboard: 同步返回字符串
      try {
        const text = c.readText();
        if (text) { onFill(text); return; }
      } catch { /* 降级到 navigator */ }
    }
    // 浏览器 / 权限降级: 异步 Promise
    navigator.clipboard.readText().then((text: string) => {
      if (text) onFill(text);
    }).catch(() => {
      // clipboard API 不可用，静默失败
    });
  };

  // 保存角色名称和 system prompt
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
          <button className="close-btn" onClick={onClose}>
            ✕
          </button>
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

            <div className="setting-label" style={{ marginTop: '12px' }}>
              角色头像
            </div>
            <div
              className="upload-zone"
              onClick={() => avatarInputRef.current?.click()}
            >
              {avatarDataUrl ? (
                <img src={avatarDataUrl} alt="" className="preview-thumb" />
              ) : (
                <>
                  <div className="upload-icon">📷</div>
                  <div className="upload-text">点击上传头像</div>
                </>
              )}
            </div>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileToDataUrl(file, setAvatarDataUrl, 5);
              }}
            />

            <div className="setting-label" style={{ marginTop: '12px' }}>
              聊天背景
            </div>
            <div
              className="upload-zone"
              onClick={() => bgInputRef.current?.click()}
            >
              {backgroundUrl ? (
                <img src={backgroundUrl} alt="" className="preview-thumb" />
              ) : (
                <>
                  <div className="upload-icon">🖼️</div>
                  <div className="upload-text">点击上传聊天背景</div>
                </>
              )}
            </div>
            <input
              ref={bgInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileToDataUrl(file, setBackgroundUrl, 10);
              }}
            />
            {backgroundUrl && (
              <button
                style={{
                  marginTop: '8px',
                  padding: '4px 12px',
                  border: '1px solid #e0e0e0',
                  borderRadius: '4px',
                  background: '#fff',
                  cursor: 'pointer',
                  fontSize: '13px',
                  color: '#ff4d4f',
                }}
                onClick={() => setBackgroundUrl('')}
              >
                移除背景
              </button>
            )}

            <div className="setting-label" style={{ marginTop: '12px' }}>
              角色 System Prompt
            </div>
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

            <div className="toggle-row">
              <div>
                <div className="toggle-label">启用语音朗读 (TTS)</div>
                <div className="toggle-desc">
                  使用 VoiceClone 复刻角色音色朗读回复
                </div>
              </div>
              <div
                className={`toggle-switch ${isTtsEnabled ? 'active' : ''}`}
                onClick={toggleTts}
              />
            </div>

            {/* 语音样本上传 — 始终显示 */}
            <div className="setting-label" style={{ marginTop: '12px' }}>
              角色语音样本 {!isTtsEnabled && <span style={{color: '#bbb', fontSize:'12px'}}>(需先启用TTS)</span>}
            </div>
            <div
              className="upload-zone"
              onClick={() => voiceInputRef.current?.click()}
            >
              {voiceSampleDataUrl ? (
                <div>
                  <div style={{ fontSize: '20px', marginBottom: '4px' }}>
                    🎵
                  </div>
                  <div className="upload-text">已上传语音样本</div>
                  <audio
                    src={voiceSampleDataUrl}
                    controls
                    style={{ marginTop: '8px', width: '100%', maxWidth: '200px' }}
                  />
                </div>
              ) : (
                <>
                  <div className="upload-icon">🎤</div>
                  <div className="upload-text">
                    点击上传角色语音样本 (wav/mp3)
                    <br />
                    <span style={{ fontSize: '12px', color: '#bbb' }}>
                      用于音色克隆，建议3~10秒清晰语音
                    </span>
                  </div>
                </>
              )}
            </div>
            <input
              ref={voiceInputRef}
              type="file"
              accept="audio/*"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileToDataUrl(file, setVoiceSampleDataUrl, 10);
              }}
            />
          </div>

          <div className="divider" />

          {/* ====== 模型设置 ====== */}
          <div className="setting-group">
            <h3 style={{ fontSize: '15px', fontWeight: 500, marginBottom: '12px' }}>
              🤖 模型设置
            </h3>

            {/* ---------- MiMo 按量计费开关 ---------- */}
            <div
              className="toggle-row"
              style={{
                padding: '12px',
                border: nonTokenPlan.enabled ? '1px solid #6366f1' : '1px solid #e0e0e0',
                borderRadius: '8px',
                background: nonTokenPlan.enabled ? '#f5f3ff' : '#f9f9f9',
                marginBottom: '16px',
              }}
            >
              <div>
                <div className="toggle-label" style={{ fontSize: '14px' }}>
                  💳 MiMo 按量计费 API
                </div>
                <div className="toggle-desc">
                  使用 MiMo 按量计费账号（与 TokenPlan 独立配置）
                </div>
              </div>
              <div
                className={`toggle-switch ${nonTokenPlan.enabled ? 'active' : ''}`}
                onClick={() => updateNonTokenPlan({ enabled: !nonTokenPlan.enabled })}
              />
            </div>

            {/* ---------- 按量计费配置 ---------- */}
            {nonTokenPlan.enabled && (
              <>
                <div style={{
                  marginBottom: '8px',
                  padding: '6px 10px',
                  background: '#eef2ff',
                  borderRadius: '6px',
                  fontSize: '12px',
                  color: '#3730a3',
                }}>
                  认证方式为 <code style={{background:'#c7d2fe', padding:'1px 4px', borderRadius:'3px', fontSize:'11px'}}>api-key</code> 头
                </div>

                <div className="setting-label">API Key（按量计费）</div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input
                    className="setting-input"
                    type="password"
                    value={nonTokenPlan.apiKey}
                    onChange={(e) => updateNonTokenPlan({ apiKey: e.target.value })}
                    placeholder="sk-mimo-xxxx"
                    style={{ flex: 1 }}
                  />
                  <button
                    className="copy-key-btn"
                    onClick={() => handlePaste((v) => updateNonTokenPlan({ apiKey: v }))}
                    title="从剪贴板粘贴"
                  >
                    粘贴
                  </button>
                  <button
                    className={`copy-key-btn ${copiedNtpKey ? 'copied' : ''}`}
                    onClick={() => handleCopy(nonTokenPlan.apiKey, setCopiedNtpKey)}
                    title="复制"
                  >
                    {copiedNtpKey ? '已复制' : '复制'}
                  </button>
                </div>

                <div className="setting-label" style={{ marginTop: '12px' }}>
                  API Base URL（按量计费）
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input
                    className="setting-input"
                    value={nonTokenPlan.baseUrl}
                    onChange={(e) => updateNonTokenPlan({ baseUrl: e.target.value })}
                    placeholder="https://api.xiaomimimo.com/v1/chat/completions"
                    style={{ flex: 1 }}
                  />
                  <button
                    className="copy-key-btn"
                    onClick={() => handlePaste((v) => updateNonTokenPlan({ baseUrl: v }))}
                    title="从剪贴板粘贴"
                  >
                    粘贴
                  </button>
                  <button
                    className={`copy-key-btn ${copiedNtpUrl ? 'copied' : ''}`}
                    onClick={() => handleCopy(nonTokenPlan.baseUrl, setCopiedNtpUrl)}
                    title="复制"
                  >
                    {copiedNtpUrl ? '已复制' : '复制'}
                  </button>
                </div>

                <div className="setting-label" style={{ marginTop: '12px' }}>
                  模型名称
                </div>
                <input
                  className="setting-input"
                  value={nonTokenPlan.model}
                  onChange={(e) => updateNonTokenPlan({ model: e.target.value })}
                  placeholder="mimo-v2.5"
                />

                <div className="setting-label" style={{ marginTop: '12px' }}>
                  TTS 语音模型
                </div>
                <input
                  className="setting-input"
                  value={nonTokenPlan.ttsModel}
                  onChange={(e) => updateNonTokenPlan({ ttsModel: e.target.value })}
                  placeholder="mimo-v2.5-tts-voiceclone"
                />

                <div className="setting-toggle-row" style={{ marginTop: '12px' }}>
                  <label className="setting-toggle-label" htmlFor="tts-use-tokenplan">
                    🎤 TTS 沿用 TokenPlan 配置
                  </label>
                  <label className="toggle-switch">
                    <input
                      id="tts-use-tokenplan"
                      type="checkbox"
                      checked={nonTokenPlan.ttsUseTokenPlan}
                      onChange={(e) => updateNonTokenPlan({ ttsUseTokenPlan: e.target.checked })}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>
                {nonTokenPlan.ttsUseTokenPlan && (
                  <div style={{ fontSize: '11px', color: 'var(--accent-color)', marginTop: '4px' }}>
                    语音克隆为 MiMo 特有功能，TTS 将使用上方 TokenPlan 配置的 API Key 和 URL
                  </div>
                )}
              </>
            )}

            {/* ---------- TokenPlan 配置（原有） ---------- */}
            {!nonTokenPlan.enabled && (
              <>
            <div className="setting-label">API Key</div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <input
                className="setting-input"
                type="password"
                value={apiSettings.apiKey}
                onChange={(e) => updateApiSettings({ apiKey: e.target.value })}
                placeholder="输入 MiMo API Key (sk-xxxx)"
                style={{ flex: 1 }}
              />
              <button
                className="copy-key-btn"
                onClick={() => handlePaste((v) => updateApiSettings({ apiKey: v }))}
                title="从剪贴板粘贴"
              >
                粘贴
              </button>
              <button
                className={`copy-key-btn ${copiedKey ? 'copied' : ''}`}
                onClick={() => handleCopy(apiSettings.apiKey, setCopiedKey)}
                title="复制 API Key"
              >
                {copiedKey ? '已复制' : '复制'}
              </button>
            </div>

            <div className="setting-label" style={{ marginTop: '12px' }}>
              API Base URL
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <input
                className="setting-input"
                value={apiSettings.baseUrl}
                onChange={(e) => updateApiSettings({ baseUrl: e.target.value })}
                placeholder="https://api.xiaomimimo.com/v1/chat/completions"
                style={{ flex: 1 }}
              />
              <button
                className="copy-key-btn"
                onClick={() => handlePaste((v) => updateApiSettings({ baseUrl: v }))}
                title="从剪贴板粘贴"
              >
                粘贴
              </button>
              <button
                className={`copy-key-btn ${copiedUrl ? 'copied' : ''}`}
                onClick={() => handleCopy(apiSettings.baseUrl, setCopiedUrl)}
                title="复制 Base URL"
              >
                {copiedUrl ? '已复制' : '复制'}
              </button>
            </div>

            <div className="setting-label" style={{ marginTop: '12px' }}>
              语言模型
            </div>
            <select
              className="setting-input"
              value={apiSettings.llmModel}
              onChange={(e) => updateApiSettings({ llmModel: e.target.value })}
            >
              <option value="mimo-v2.5-pro">mimo-v2.5-pro</option>
              <option value="mimo-v2.5">mimo-v2.5</option>
            </select>

            <div className="setting-label" style={{ marginTop: '12px' }}>
              语音模型
            </div>
            <select
              className="setting-input"
              value={apiSettings.ttsModel}
              onChange={(e) => updateApiSettings({ ttsModel: e.target.value })}
            >
              <option value="mimo-v2.5-tts-voiceclone">
                mimo-v2.5-tts-voiceclone
              </option>
              <option value="mimo-v2.5-tts">
                mimo-v2.5-tts (预置音色)
              </option>
              <option value="mimo-v2.5-tts-voicedesign">
                mimo-v2.5-tts-voicedesign
              </option>
            </select>

            {/* 显示思考过程 */}
            <div className="toggle-row" style={{ marginTop: '12px' }}>
              <div>
                <div className="toggle-label">显示思考过程</div>
                <div className="toggle-desc">
                  MiMo 模型会自动进行深度思考，开启后可在聊天中看到推理内容
                </div>
              </div>
              <div
                className={`toggle-switch ${showThinking ? 'active' : ''}`}
                onClick={() => setShowThinking(!showThinking)}
              />
            </div>
            </>
            )}
          </div>

          <div className="divider" />

          {/* ====== 其他 ====== */}
          <div className="setting-group">
            <h3 style={{ fontSize: '15px', fontWeight: 500, marginBottom: '12px' }}>
              ⚙️ 其他
            </h3>

            <div className="toggle-row">
              <div>
                <div className="toggle-label">
                  {theme === 'dark' ? '🌙 深色模式' : '☀️ 浅色模式'}
                </div>
                <div className="toggle-desc">切换界面配色风格</div>
              </div>
              <div
                className={`toggle-switch ${theme === 'dark' ? 'active' : ''}`}
                onClick={toggleTheme}
              />
            </div>

            <div style={{ height: '12px' }} />
            <button
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #ff4d4f',
                borderRadius: '6px',
                background: '#fff',
                color: '#ff4d4f',
                cursor: 'pointer',
                fontSize: '14px',
              }}
              onClick={clearChat}
            >
              清空聊天记录
            </button>
          </div>

          <div className="divider" />

          {/* ====== 关于 ====== */}
          <div className="setting-group">
            <h3 style={{ fontSize: '15px', fontWeight: 500, marginBottom: '12px' }}>
              ℹ️ 关于
            </h3>
            <div style={{ fontSize: '13px', color: '#888', lineHeight: '1.8' }}>
              <div>RoleChat 二次元角色扮演</div>
              <div>版本 1.0.0</div>
              <div style={{ marginTop: '4px' }}>
                基于 Electron + React + TypeScript 构建
              </div>
            </div>
          </div>

          {/* 配置说明 */}
          <div
            style={{
              marginTop: '16px',
              padding: '12px',
              background: '#f0fdf5',
              borderRadius: '8px',
              fontSize: '12px',
              color: '#666',
              lineHeight: '1.6',
            }}
          >
            <strong>API 配置说明</strong>
            <ul style={{ paddingLeft: '16px', marginTop: '4px' }}>
              <li>需在 <a href="https://platform.xiaomimimo.com" target="_blank" rel="noreferrer" style={{color: '#07c160'}}>小米MiMo开放平台</a> 获取 API Key</li>
              <li>语言模型: mimo-v2.5 / mimo-v2.5-pro (OpenAI 兼容)</li>
              <li>语音模型: mimo-v2.5-tts-voiceclone (通过上传音频进行音色克隆)</li>
              <li>TTS 系列模型目前限时免费</li>
              <li>语音合成文本需放在 assistant role 中</li>
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}
