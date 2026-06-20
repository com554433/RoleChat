import { memo, useState, useRef, useCallback } from 'react';
import { useChatStore, useMessages } from '../store/chatStore';
import { callLLM, callVoiceClone } from '../services/api';

function uid(prefix: string) {
  return prefix + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);
}

export default memo(function ChatInput() {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const messages = useMessages();

  const roleConfig = useChatStore((s) => s.roleConfig);
  const addMessage = useChatStore((s) => s.addMessage);
  const updateLastMessage = useChatStore((s) => s.updateLastMessage);
  const setLoading = useChatStore((s) => s.setLoading);
  const apiSettings = useChatStore((s) => s.apiSettings);
  const nonTokenPlan = useChatStore((s) => s.nonTokenPlan);
  const isLoading = useChatStore((s) => s.isLoading);
  const isTtsEnabled = useChatStore((s) => s.isTtsEnabled);
  const voiceSampleDataUrl = useChatStore((s) => s.voiceSampleDataUrl);
  const updateMessageAudio = useChatStore((s) => s.updateMessageAudio);
  const setMessagePlaying = useChatStore((s) => s.setMessagePlaying);

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 120) + 'px';
    });
  }, []);

  const autoTtsPlay = async (msgId: string) => {
    await new Promise((r) => setTimeout(r, 100));
    const state = useChatStore.getState();
    const latestMsgs = state.skillChats[state.activeSkillId || ''] || [];
    const targetMsg = latestMsgs.find((m) => m.id === msgId);
    if (!targetMsg || !targetMsg.content.trim()) return;

    try {
      const voiceMatch = voiceSampleDataUrl.match(/^data:audio\/(\w+);base64,(.+)$/);
      if (!voiceMatch) return;

      console.log('[ChatInput] TTS text len:', targetMsg.content.length);
      const audioUrl = await callVoiceClone(
        targetMsg.content,
        voiceMatch[2],
        voiceMatch[1],
        apiSettings,
        nonTokenPlan,
        roleConfig?.voice_style,
      );

      updateMessageAudio(msgId, audioUrl);

      setMessagePlaying(msgId, true);
      const audio = new Audio(audioUrl);
      audio.onended = () => setMessagePlaying(msgId, false);
      audio.play().catch(() => {
        setMessagePlaying(msgId, false);
        console.log('[ChatInput] autoplay blocked');
      });
    } catch (err) {
      console.error('[ChatInput] TTS fail:', err);
    }
  };

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
      id: uid('u'),
      role: 'user' as const,
      content: trimmed,
      timestamp: Date.now(),
    };

    addMessage(userMsg);
    setText('');
    if (textareaRef.current) {
      requestAnimationFrame(() => {
        textareaRef.current!.style.height = 'auto';
      });
    }

    const apiMessages: { role: string; content: string }[] = [];

    if (roleConfig?.system_prompt) {
      apiMessages.push({ role: 'system', content: roleConfig.system_prompt });
    }

    const isFirstMsg = messages.length === 0;
    if (isFirstMsg && roleConfig?.greeting) {
      const greetId = uid('g');
      apiMessages.push({ role: 'assistant', content: roleConfig.greeting });
      addMessage({
        id: greetId,
        role: 'assistant',
        content: roleConfig.greeting,
        timestamp: Date.now(),
      });
    }

    const allMsgs = [...messages, userMsg];
    for (const m of allMsgs) {
      if (m.content && m.content.trim()) {
        apiMessages.push({ role: m.role, content: m.content });
      }
    }

    const assistantId = uid('a');
    addMessage({
      id: assistantId,
      role: 'assistant',
      content: '',
      reasoning_content: '',
      timestamp: Date.now(),
    });

    setLoading(true);
    abortRef.current = new AbortController();

    try {
      await callLLM(
        apiMessages,
        apiSettings,
        nonTokenPlan,
        (content, reasoning) => {
          updateLastMessage(content, reasoning);
        },
        abortRef.current.signal,
      );

      if (isTtsEnabled && voiceSampleDataUrl) {
        autoTtsPlay(assistantId);
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        updateLastMessage('[已停止生成]');
      } else {
        const msg = err instanceof Error ? err.message : '未知错误';
        let hint = '';
        if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
          hint = '\n(网络错误)';
        } else if (msg.includes('401')) {
          hint = '\n(401: API Key 无效)';
        } else if (msg.includes('403')) {
          hint = '\n(403: 无权限)';
        }
        updateLastMessage('[错误] ' + msg + hint);
      }
    } finally {
      setLoading(false);
      abortRef.current = null;
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
        placeholder={roleConfig ? '和' + roleConfig.name + '聊天...' : '输入消息...'}
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
});
