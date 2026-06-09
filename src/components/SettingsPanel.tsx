import { useRef, useState } from 'react';
import { useChatStore } from '../store/chatStore';

interface Props {
  onClose: () => void;
}

export default function SettingsPanel({ onClose }: Props) {
  const {
    roleConfig,
    avatarDataUrl,
    setAvatarDataUrl,
    backgroundUrl,
    setBackgroundUrl,
    voiceSampleDataUrl,
    setVoiceSampleDataUrl,
    apiSettings,
    updateApiSettings,
    showThinking,
    setShowThinking,
    isTtsEnabled,
    toggleTts,
    setRoleConfig,
    clearChat,
  } = useChatStore();

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);
  const voiceInputRef = useRef<HTMLInputElement>(null);
  const [editName, setEditName] = useState(roleConfig?.name || '');
  const [editSystemPrompt, setEditSystemPrompt] = useState(roleConfig?.system_prompt || '');

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

            <div className="setting-label">API Key</div>
            <input
              className="setting-input"
              type="password"
              value={apiSettings.apiKey}
              onChange={(e) => updateApiSettings({ apiKey: e.target.value })}
              placeholder="输入 MiMo API Key (sk-xxxx)"
            />

            <div className="setting-label" style={{ marginTop: '12px' }}>
              API Base URL
            </div>
            <input
              className="setting-input"
              value={apiSettings.baseUrl}
              onChange={(e) => updateApiSettings({ baseUrl: e.target.value })}
              placeholder="https://api.xiaomimimo.com/v1"
            />

            <div className="setting-label" style={{ marginTop: '12px' }}>
              语言模型
            </div>
            <select
              className="setting-input"
              value={apiSettings.llmModel}
              onChange={(e) => updateApiSettings({ llmModel: e.target.value })}
            >
              <option value="mimo-v2.5">mimo-v2.5</option>
              <option value="mimo-v2.5-pro">mimo-v2.5-pro</option>
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
          </div>

          <div className="divider" />

          {/* ====== 其他 ====== */}
          <div className="setting-group">
            <h3 style={{ fontSize: '15px', fontWeight: 500, marginBottom: '12px' }}>
              ⚙️ 其他
            </h3>
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
