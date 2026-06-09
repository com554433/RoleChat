import { useState, useRef, useEffect } from 'react';
import { useChatStore } from '../store/chatStore';
import { callVoiceClone } from '../services/api';
import type { ChatMessage } from '../types';

interface Props {
  message: ChatMessage;
}

export default function MessageBubble({ message }: Props) {
  const {
    avatarDataUrl,
    roleConfig,
    showThinking,
    isTtsEnabled,
    voiceSampleDataUrl,
    apiSettings,
    updateMessageAudio,
    setMessagePlaying,
  } = useChatStore();

  const [thinkingExpanded, setThinkingExpanded] = useState(true);
  const [ttsLoading, setTtsLoading] = useState(false);
  const [ttsError, setTtsError] = useState('');
  const [audioPaused, setAudioPaused] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const isSelf = message.role === 'user';
  const hasThinking = !!(message.reasoning_content && message.reasoning_content.trim());
  const hasAudio = !!message.audioUrl;

  // 清理 audio
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // 请求 TTS 语音朗读
  const handleTts = async () => {
    setTtsError('');

    if (message.audioUrl) {
      // 已有音频，直接播放
      playAudio(message.audioUrl);
      return;
    }

    if (!isTtsEnabled || !voiceSampleDataUrl || ttsLoading) return;

    setTtsLoading(true);
    try {
      // 从 data URL 中提取 base64 和格式
      const voiceMatch = voiceSampleDataUrl.match(/^data:audio\/(\w+);base64,(.+)$/);
      if (!voiceMatch) throw new Error('Invalid voice sample');

      console.log('[MessageBubble] 手动TTS: 文本长度', message.content.length);
      const audioUrl = await callVoiceClone(
        message.content,
        voiceMatch[2], // base64 data
        voiceMatch[1], // format (e.g. wav, mp3)
        apiSettings,
        roleConfig?.voice_style,
      );

      updateMessageAudio(message.id, audioUrl);
      playAudio(audioUrl);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'TTS请求失败';
      console.error('[MessageBubble] TTS failed:', errMsg);
      setTtsError(errMsg.slice(0, 60));
    } finally {
      setTtsLoading(false);
    }
  };

  const playAudio = (url: string) => {
    // 如果同一个音频暂停中 → 恢复播放
    if (audioRef.current && !audioRef.current.ended && audioRef.current.paused) {
      audioRef.current.play().catch(() => {
        setMessagePlaying(message.id, false);
        setAudioPaused(false);
      });
      setMessagePlaying(message.id, true);
      setAudioPaused(false);
      return;
    }

    // 停止旧的播放
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    const audio = new Audio(url);
    audioRef.current = audio;
    setMessagePlaying(message.id, true);
    setAudioPaused(false);

    audio.onended = () => {
      setMessagePlaying(message.id, false);
      setAudioPaused(false);
      audioRef.current = null;
    };

    audio.onerror = () => {
      setMessagePlaying(message.id, false);
      setAudioPaused(false);
      audioRef.current = null;
    };

    audio.onpause = () => {
      // 只有主动暂停才标记，playback ended 会触发 onended
      if (!audio.ended) {
        setAudioPaused(true);
      }
    };

    audio.onplay = () => {
      setAudioPaused(false);
    };

    audio.play().catch(() => {
      setMessagePlaying(message.id, false);
      setAudioPaused(false);
    });
  };

  // 暂停当前音频
  const pauseAudio = () => {
    if (audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause();
      setAudioPaused(true);
    }
  };

  // 处理播放/暂停按钮
  const handlePlayPause = () => {
    if (message.isPlaying && !audioPaused) {
      // 正在播放 → 暂停
      pauseAudio();
    } else if (message.isPlaying && audioPaused) {
      // 暂停中 → 恢复
      if (audioRef.current) {
        audioRef.current.play().catch(() => {
          setMessagePlaying(message.id, false);
          setAudioPaused(false);
        });
        setAudioPaused(false);
      }
    } else if (message.audioUrl) {
      // 有缓存音频 → 播放
      playAudio(message.audioUrl);
    } else {
      // 需要先请求 TTS
      handleTts();
    }
  };

  // 格式化时间
  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  return (
    <>
      {/* 时间戳（每隔5分钟以上的间隔显示一次） */}
      <div className={isSelf ? 'msg-row self' : 'msg-row other'}>
        {/* 角色头像 */}
        {!isSelf && (
          avatarDataUrl ? (
            <img src={avatarDataUrl} alt="" className="msg-avatar" />
          ) : (
            <div className="msg-avatar-placeholder">
              {roleConfig?.name?.charAt(0) || 'AI'}
            </div>
          )
        )}

        <div style={{ minWidth: 0 }}>
          {/* 思考过程 (仅 AI 消息) */}
          {!isSelf && hasThinking && showThinking && (
            <div className="reasoning-box">
              <div
                className="reasoning-toggle"
                onClick={() => setThinkingExpanded(!thinkingExpanded)}
              >
                <span>{thinkingExpanded ? '▼' : '▶'}</span>
                <span>思考过程</span>
              </div>
              {thinkingExpanded && (
                <div className="animate-slide-up">{message.reasoning_content}</div>
              )}
            </div>
          )}

          {/* 消息气泡 */}
          <div className="msg-bubble">
            {message.content}

            {/* 语音播放/暂停按钮 (仅 AI 消息，且开启 TTS) */}
            {!isSelf && isTtsEnabled && voiceSampleDataUrl && (
              <div
                className={`voice-play-btn ${message.isPlaying ? 'playing' : ''} ${audioPaused ? 'paused' : ''}`}
                onClick={handlePlayPause}
              >
                {ttsLoading ? (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin-slow">
                      <circle cx="12" cy="12" r="10" strokeDasharray="31.4 31.4" />
                    </svg>
                    生成中...
                  </>
                ) : message.isPlaying && !audioPaused ? (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <rect x="6" y="4" width="4" height="16" rx="1" />
                      <rect x="14" y="4" width="4" height="16" rx="1" />
                    </svg>
                    播放中
                  </>
                ) : message.isPlaying && audioPaused ? (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                    已暂停
                  </>
                ) : hasAudio ? (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                    播放语音
                  </>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                      <line x1="12" y1="19" x2="12" y2="23" />
                      <line x1="8" y1="23" x2="16" y2="23" />
                    </svg>
                    朗读
                  </>
                )}
              </div>
            )}

            {/* TTS 错误提示 */}
            {ttsError && (
              <div style={{
                fontSize: '11px',
                color: '#ff4d4f',
                marginTop: '4px',
                cursor: 'pointer',
              }} onClick={handleTts}>
                TTS失败: {ttsError} — 点击重试
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
