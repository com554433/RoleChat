import { useChatStore } from './store/chatStore';
import ChatHeader from './components/ChatHeader';
import MessageList from './components/MessageList';
import ChatInput from './components/ChatInput';
import SettingsPanel from './components/SettingsPanel';
import SkillImporter from './components/SkillImporter';

export default function App() {
  const {
    isSettingsOpen,
    isSkillImporterOpen,
    toggleSettings,
    toggleSkillImporter,
    backgroundUrl,
  } = useChatStore();

  return (
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
      <MessageList />

      {/* 输入区 */}
      <ChatInput />

      {/* 设置面板 */}
      {isSettingsOpen && <SettingsPanel onClose={toggleSettings} />}

      {/* Skill 导入面板 */}
      {isSkillImporterOpen && <SkillImporter onClose={toggleSkillImporter} />}
    </div>
  );
}
