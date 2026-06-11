import { memo } from 'react';
import { useChatStore } from '../store/chatStore';

interface Props {
  onSettingsClick: () => void;
  onSkillClick: () => void;
}

export default memo(function ChatHeader({ onSettingsClick, onSkillClick }: Props) {
  const roleConfig = useChatStore((s) => s.roleConfig);
  const avatarDataUrl = useChatStore((s) => s.avatarDataUrl);
  const isLoading = useChatStore((s) => s.isLoading);
  const isTtsEnabled = useChatStore((s) => s.isTtsEnabled);
  const toggleTts = useChatStore((s) => s.toggleTts);

  const name = roleConfig?.name || '未加载角色';
  const status = isLoading ? '正在输入...' : '在线';

  return (
    <div className="chat-header">
      {/* 角色头像 */}
      {avatarDataUrl ? (
        <img src={avatarDataUrl} alt={name} className="avatar" />
      ) : (
        <div className="avatar-placeholder">{name.charAt(0)}</div>
      )}

      {/* 名称和状态 */}
      <div className="info">
        <div className="name">{name}</div>
        <div className="status">{status}</div>
      </div>

      {/* 操作按钮 */}
      <div className="actions">
        <button
          className="action-btn"
          onClick={onSkillClick}
          title="导入Skill角色"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
        <button
          className="action-btn"
          onClick={toggleTts}
          title={isTtsEnabled ? '语音已开启' : '语音已关闭 - 点击开启朗读'}
          style={{ color: isTtsEnabled ? '#07c160' : '#999' }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill={isTtsEnabled ? '#07c160' : 'none'} stroke="currentColor" strokeWidth="2">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            {isTtsEnabled && (
              <>
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
              </>
            )}
            {!isTtsEnabled && <line x1="23" y1="1" x2="1" y2="23" stroke="#999" />}
          </svg>
        </button>
        <button
          className="action-btn"
          onClick={onSettingsClick}
          title="设置"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
