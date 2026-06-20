import { useEffect } from 'react';
import { useChatStore } from './store/chatStore';
import ChatHeader from './components/ChatHeader';
import MessageList from './components/MessageList';
import ChatInput from './components/ChatInput';
import SettingsPanel from './components/SettingsPanel';
import SkillImporter from './components/SkillImporter';
import SkillSidebar from './components/SkillSidebar';

export default function App() {
  const isSettingsOpen = useChatStore((s) => s.isSettingsOpen);
  const isSkillImporterOpen = useChatStore((s) => s.isSkillImporterOpen);
  const toggleSettings = useChatStore((s) => s.toggleSettings);
  const toggleSkillImporter = useChatStore((s) => s.toggleSkillImporter);
  const backgroundUrl = useChatStore((s) => s.backgroundUrl);
  const theme = useChatStore((s) => s.theme);
  const activeSkillId = useChatStore((s) => s.activeSkillId);

  // 同步 theme 到 <html data-theme>
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  return (
    <div className="app-shell">
      {/* 左侧角色列表 (微信风格) */}
      <SkillSidebar onImportClick={toggleSkillImporter} />

      {/* 右侧聊天区 */}
      <div className="chat-container">
        {/* 聊天背景 */}
        {backgroundUrl && (
          <div className="chat-bg-layer">
            <img src={backgroundUrl} alt="" />
          </div>
        )}

        {/* 顶部栏 */}
        <ChatHeader
          onSettingsClick={toggleSettings}
          onSkillClick={toggleSkillImporter}
        />

        {/* 消息列表 */}
        {activeSkillId ? (
          <MessageList />
        ) : (
          <div className="message-list">
            <div className="empty-state">
              <div className="empty-icon">💬</div>
              <div className="empty-text">
                请先导入一个角色<br />
                点击左侧 + 按钮或右上角 + 导入
              </div>
            </div>
          </div>
        )}

        {/* 输入区 — 有角色才显示 */}
        {activeSkillId && <ChatInput />}

        {/* 设置面板 */}
        {isSettingsOpen && <SettingsPanel onClose={toggleSettings} />}

        {/* Skill 导入面板 */}
        {isSkillImporterOpen && <SkillImporter onClose={toggleSkillImporter} />}
      </div>
    </div>
  );
}
