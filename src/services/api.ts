import type { ApiSettings } from '../types';

// ==================== 语言模型 API ====================
// 调用 MiMo 语言模型 (mimo-v2.5 / mimo-v2.5-pro)
// OpenAI 兼容格式，严格按官方文档
//
// 官方文档: https://platform.xiaomimimo.com/docs/zh-CN/quick-start/first-api-call
//
export async function callLLM(
  messages: { role: string; content: string }[],
  settings: ApiSettings,
  onChunk?: (content: string, reasoning?: string) => void,
  signal?: AbortSignal
): Promise<{ content: string; reasoning: string }> {
  // 按官方 curl 示例构建请求体
  const body: Record<string, unknown> = {
    model: settings.llmModel,
    messages,
    max_completion_tokens: 2048,
    temperature: 0.8,
    top_p: 0.95,
    stream: !!onChunk,
  };

  // 注意: 官方 API 中不存在 enable_thinking 参数
  // thinking 是模型内置能力，模型会在需要时自动返回 reasoning_content

  const resp = await fetch(`${settings.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': settings.apiKey,
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!resp.ok) {
    const errText = await resp.text();
    let errMsg = `API错误 (${resp.status})`;
    try {
      const errJson = JSON.parse(errText);
      errMsg += `: ${errJson.error?.message || errJson.message || errText}`;
    } catch {
      errMsg += `: ${errText.slice(0, 300)}`;
    }
    // 附加调试信息
    errMsg += `\n(模型: ${settings.llmModel}, URL: ${settings.baseUrl})`;
    throw new Error(errMsg);
  }

  // 流式响应
  if (onChunk && body.stream) {
    let fullContent = '';
    let fullReasoning = '';
    const reader = resp.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        const data = trimmed.slice(6);
        if (data === '[DONE]') continue;

        try {
          const json = JSON.parse(data);
          const delta = json.choices?.[0]?.delta;
          if (!delta) continue;

          const content = delta.content || '';
          const reasoning = delta.reasoning_content || '';

          if (content) fullContent += content;
          if (reasoning) fullReasoning += reasoning;

          if (content || reasoning) {
            onChunk(content, reasoning);
          }
        } catch {
          // skip malformed chunks
        }
      }
    }

    return { content: fullContent, reasoning: fullReasoning };
  }

  // 非流式响应
  const json = await resp.json();
  const message = json.choices?.[0]?.message;
  return {
    content: message?.content || '',
    reasoning: message?.reasoning_content || '',
  };
}

// ==================== 语音克隆 TTS API ====================
// 调用 MiMo mimo-v2.5-tts-voiceclone 进行音色复制 + 语音合成
// 参考官方文档: https://platform.xiaomimimo.com/docs/zh-CN/usage-guide/speech-synthesis-v2.5
//
// 关键规则:
// - content 必须是纯字符串，不能用 multimodal 数组
// - 参考音频通过 data URL 放在 audio.voice 字段
// - 要合成的文本放在 assistant 消息中
// - user 消息可选，用于传入风格控制指令
export async function callVoiceClone(
  text: string,
  voiceSampleBase64: string,
  voiceSampleFormat: string, // e.g. "wav", "mp3"
  settings: ApiSettings,
  voiceStyle?: string,
  signal?: AbortSignal
): Promise<string> {
  // user 消息：可传入风格指令
  const userContent = voiceStyle
    ? `语音风格: ${voiceStyle}。请用自然生动的语气朗读。`
    : '';

  const body = {
    model: settings.ttsModel,
    messages: [
      {
        role: 'user',
        content: userContent,
      },
      {
        role: 'assistant',
        content: text,
      },
    ],
    audio: {
      format: 'wav',
      voice: `data:audio/${voiceSampleFormat};base64,${voiceSampleBase64}`,
    },
  };

  console.log('[callVoiceClone] 请求参数:', {
    model: body.model,
    textLen: text.length,
    userContent,
    audioVoiceLen: body.audio.voice.length,
  });

  const resp = await fetch(`${settings.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': settings.apiKey,
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!resp.ok) {
    const errText = await resp.text();
    let errMsg = `TTS错误 (${resp.status})`;
    try {
      const errJson = JSON.parse(errText);
      errMsg += `: ${errJson.error?.message || errJson.message || errText}`;
    } catch {
      errMsg += `: ${errText.slice(0, 300)}`;
    }
    throw new Error(errMsg);
  }

  const json = await resp.json();
  const audioData = json.choices?.[0]?.message?.audio?.data;

  if (!audioData) {
    throw new Error('TTS未返回音频数据，请检查语音样本格式');
  }

  return `data:audio/wav;base64,${audioData}`;
}
