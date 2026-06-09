import { useState, useRef, useCallback } from 'react';
import { useChatStore } from '../store/chatStore';
import { callLLM, callVoiceClone } from '../services/api';

let abortController: AbortController | null = null;

export default function ChatInput() {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const {
    roleConfig,
    messages,
    addMessage,
    updateLastMessage,
    setLoading,
    setStreamingContent,
    setStreamingReasoning,
    apiSettings,
    isLoading,
    isTtsEnabled,
    voiceSampleDataUrl,
    updateMessageAudio,
    setMessagePlaying,
  } = useChatStore();

  // 自动调整 textarea 高度
  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 120) + 'px';
    }
  }, []);

  // TTS 自动朗读 (在 LLM 回复完成后调用)
  const autoTtsPlay = async (msgId: string) => {
    // 延迟一下等 store 更新完成
    await new Promise((r) => setTimeout(r, 100));
    const latestMsgs = useChatStore.getState().messages;
    const targetMsg = latestMsgs.find((m) => m.id === msgId);
    if (!targetMsg || !targetMsg.content.trim()) return;

    try {
      const voiceMatch = voiceSampleDataUrl.match(/^data:audio\/(\w+);base64,(.+)$/);
      if (!voiceMatch) return;

      console.log('[ChatInput] 自动TTS: 文本长度', targetMsg.content.length);
      const audioUrl = await callVoiceClone(
        targetMsg.content,
        voiceMatch[2],
        voiceMatch[1],
        apiSettings,
        roleConfig?.voice_style,
      );

      updateMessageAudio(msgId, audioUrl);

      // 尝试自动播放
      const audio = new Audio(audioUrl);
      audio.play().catch(() => {
        console.log('[ChatInput] 自动播放被浏览器阻止，点击消息上的朗读按钮即可');
      });
    } catch (err) {
      console.error('[ChatInput] TTS自动播放失败:', err);
    }
  };

  // Enter 发送，Shift+Enter 换行
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    const userMsg = {
      id: Date.now().toString(),
      role: 'user' as const,
      content: trimmed,
      timestamp: Date.now(),
    };

    addMessage(userMsg);
    setText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    // 构建 API messages
    const apiMessages: { role: string; content: string }[] = [];

    // 1. 系统提示词（角色设定）
    if (roleConfig?.system_prompt) {
      apiMessages.push({ role: 'system', content: roleConfig.system_prompt });
      console.log('[ChatInput] 已加载角色system_prompt, 长度:', roleConfig.system_prompt.length);
    } else {
      console.warn('[ChatInput] 警告: roleConfig 为空或无 system_prompt', roleConfig);
    }

    // 2. 开场白：如果是首次对话且有greeting，自动发送
    const isFirstMsg = messages.length === 0;
    if (isFirstMsg && roleConfig?.greeting) {
      // 先把开场白作为 assistant 消息显示
      const greetId = (Date.now() + 2).toString();
      addMessage({
        id: greetId,
        role: 'assistant',
        content: roleConfig.greeting,
        timestamp: Date.now() + 1,
      });
    }

    // 3. 历史消息：过滤掉空内容的消息（之前失败的占位消息）
    const allMsgs = [...messages, userMsg];
    for (const m of allMsgs) {
      if (m.content && m.content.trim()) {
        apiMessages.push({ role: m.role, content: m.content });
      }
      // 过滤掉 content 为空的 assistant 占位消息（这类消息会导致 API invalid request）
    }

    // 添加 assistant 占位
    const assistantId = (Date.now() + 1).toString();
    addMessage({
      id: assistantId,
      role: 'assistant',
      content: '',
      reasoning_content: '',
      timestamp: Date.now(),
    });

    setLoading(true);
    abortController = new AbortController();

    try {
      await callLLM(
        apiMessages,
        apiSettings,
        (content, reasoning) => {
          updateLastMessage(content, reasoning);
        },
        abortController.signal,
      );

      // LLM回复完成后自动触发TTS朗读
      if (isTtsEnabled && voiceSampleDataUrl) {
        autoTtsPlay(assistantId);
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        updateLastMessage('[已停止生成]');
      } else {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        // 检测常见错误给出提示
        let hint = '';
        if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
          hint = '\n（网络错误：请检查API地址是否正确，或尝试使用桌面版EXE（Electron不受CORS限制））';
        } else if (msg.includes('401')) {
          hint = '\n（401 认证失败：API Key 无效或未设置，请在设置中检查）';
        } else if (msg.includes('403')) {
          hint = '\n（403 权限不足：API Key 没有访问该模型的权限）';
        }
        updateLastMessage(`[错误] ${msg}${hint}`);
      }
    } finally {
      setLoading(false);
      abortController = null;
    }
  };

  return (
    <div className="input-area">
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          adjustHeight();
        }}
        onKeyDown={handleKeyDown}
        placeholder={roleConfig ? `和${roleConfig.name}聊天...` : '输入消息...'}
        rows={1}
      />
      <button
        className="send-btn"
        onClick={handleSend}
        disabled={!text.trim() || isLoading}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
        </svg>
      </button>
    </div>
  );
}
