import { useEffect, useRef } from 'react';
import { useChatStore } from '../store/chatStore';
import MessageBubble from './MessageBubble';

export default function MessageList() {
  const { messages, isLoading, streamingReasoning, roleConfig } = useChatStore();
  const bottomRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // 自动滚动到底部
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingReasoning, isLoading]);

  // 空状态
  if (messages.length === 0 && !isLoading) {
    return (
      <div className="message-list" ref={listRef}>
        <div className="empty-state">
          <div className="empty-icon">💬</div>
          <div className="empty-text">
            {roleConfig
              ? `开始和${roleConfig.name}聊天吧~`
              : '请先导入一个 Skill 角色文件夹<br/>点击右上角 + 按钮导入'}
          </div>
        </div>
        <div ref={bottomRef} />
      </div>
    );
  }

  return (
    <div className="message-list" ref={listRef}>
      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} />
      ))}

      {/* 加载 / 打字指示器 */}
      {isLoading && (
        <div className="msg-row other">
          <div className="msg-avatar-placeholder">
            {roleConfig?.name?.charAt(0) || 'AI'}
          </div>
          <div className="msg-bubble">
            <div className="typing-indicator">
              <div className="typing-dot" />
              <div className="typing-dot" />
              <div className="typing-dot" />
            </div>
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
