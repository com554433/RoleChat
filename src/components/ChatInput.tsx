import { memo, useState, useRef, useCallback } from 'react';
import { useChatStore, useMessages } from '../store/chatStore';
import { callLLM, callVoiceClone, callASR } from '../services/api';

function uid(prefix = '') {
  return prefix + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);
}

export default memo(function ChatInput() {
  const [text, setText] = useState('');
  const [recording, setRecording] = useState<'idle' | 'recording' | 'transcribing'>('idle');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
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

  // 自动调整 textarea 高度（用 rAF 避免 layout thrashing）
  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 120) + 'px';
    });
  }, []);

  // ==================== 语音录制 ASR ====================
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        // 停止所有轨道
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        if (blob.size === 0) {
          setRecording('idle');
          return;
        }

        setRecording('transcribing');
        try {
          // 转 base64
          const buf = await blob.arrayBuffer();
          const bytes = new Uint8Array(buf);
          let binary = '';
          for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          const base64 = btoa(binary);

          const transcribed = await callASR(base64, 'webm', apiSettings, nonTokenPlan);
          if (transcribed && transcribed !== '（无法识别）') {
            setText((prev) => (prev ? prev + transcribed : transcribed));
            // 调整 textarea 高度
            requestAnimationFrame(() => {
              const el = textareaRef.current;
              if (el) {
                el.style.height = 'auto';
                el.style.height = Math.min(el.scrollHeight, 120) + 'px';
              }
            });
          }
        } catch (err) {
          console.error('[ASR] 语音识别失败:', err);
        } finally {
          setRecording('idle');
        }
      };

      recorder.start();
      setRecording('recording');
    } catch (err) {
      console.error('[ASR] 无法访问麦克风:', err);
      alert('无法访问麦克风，请检查浏览器权限设置');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
  };

  // TTS 自动朗读 (在 LLM 回复完成后调用)
  const autoTtsPlay = async (msgId: string) => {
    // 延迟一下等 store 更新完成
    await new Promise((r) => setTimeout(r, 100));
    const state = useChatStore.getState();
    const latestMsgs = state.skillChats[state.activeSkillId || ''] || [];
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
        nonTokenPlan,
        roleConfig?.voice_style,
      );

      updateMessageAudio(msgId, audioUrl);

      // 尝试自动播放
      setMessagePlaying(msgId, true);
      const audio = new Audio(audioUrl);
      audio.onended = () => setMessagePlaying(msgId, false);
      audio.play().catch(() => {
        setMessagePlaying(msgId, false);
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
      // 先把开场白作为 assistant 消息显示，并加入 API 上下文
      const greetId = uid('g');
      apiMessages.push({ role: 'assistant', content: roleConfig.greeting });
      addMessage({
        id: greetId,
        role: 'assistant',
        content: roleConfig.greeting,
        timestamp: Date.now(),
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
      abortRef.current = null;
    }
  };

  return (
    <div className="input-area">
      {/* 语音录制按钮 */}
      <button
        className="mic-btn"
        onClick={() => {
          if (recording === 'recording') {
            stopRecording();
          } else if (recording === 'idle') {
            startRecording();
          }
          // transcribing 时不可点击
        }}
        disabled={recording === 'transcribing' || isLoading}
        title={
          recording === 'idle'
            ? '语音输入'
            : recording === 'recording'
              ? '点击停止录音'
              : '识别中...'
        }
        style={{
          background:
            recording === 'recording'
              ? '#ff4d4f'
              : recording === 'transcribing'
                ? '#fadb14'
                : 'var(--input-bg, #f0f0f0)',
          color: recording === 'idle' ? '#666' : '#fff',
          flexShrink: 0,
          width: '36px',
          height: '36px',
          border: 'none',
          borderRadius: '50%',
          cursor: recording === 'transcribing' ? 'wait' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'background 0.2s',
        }}
      >
        {recording === 'transcribing' ? (
          <span style={{ fontSize: '14px', animation: 'spin 1s linear infinite' }}>⏳</span>
        ) : recording === 'recording' ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4" height="16" rx="2" />
            <rect x="14" y="4" width="4" height="16" rx="2" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
            <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
          </svg>
        )}
      </button>

      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          adjustHeight();
        }}
        onKeyDown={handleKeyDown}
        placeholder={recording === 'recording' ? '正在录音...' : roleConfig ? `和${roleConfig.name}聊天...` : '输入消息...'}
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
