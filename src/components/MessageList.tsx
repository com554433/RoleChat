import { memo, useEffect, useRef } from 'react';
import { useChatStore, useMessages, useCurrentSkill } from '../store/chatStore';
import MessageBubble from './MessageBubble';
import type { ChatMessage } from '../types';

export default memo(function MessageList() {
  const messages = useMessages();
  const roleConfig = useCurrentSkill()?.config;
  const isLoading = useChatStore((s) => s.isLoading);
  const bottomRef = useRef<HTMLDivElement>(null);

  // 自动滚动到底部（auto 避免流式输出时 smooth 动画重叠抖动）
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'auto' });
  }, [messages, isLoading]);

  // 空状态
  if (messages.length === 0 && !isLoading) {
    return (
      <div className="message-list">
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
    <div className="message-list">
      {messages.map((msg: ChatMessage) => (
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
})
