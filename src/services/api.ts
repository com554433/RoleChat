import type { ApiSettings, RoleConfig, NonTokenPlanConfig } from '../types';

// ==================== 认证模式适配 ====================
// TokenPlan 和按量计费都使用 MiMo api-key 认证
function resolveApi(
  settings: ApiSettings,
  payAsYouGo: NonTokenPlanConfig,
) {
  if (payAsYouGo.enabled) {
    const base = payAsYouGo.baseUrl.replace(/\/+$/, '');
    return {
      apiKey: payAsYouGo.apiKey,
      url: base, // 非TokenPlan: 用户提供完整 URL，不拼接 chat/completions
      model: payAsYouGo.model,
      ttsModel: payAsYouGo.ttsModel,
      headers: { 'Content-Type': 'application/json', 'api-key': payAsYouGo.apiKey },
    };
  }
  const base = (settings.baseUrl || 'https://api.xiaomimimo.com/v1').replace(/\/+$/, '');
  return {
    apiKey: settings.apiKey,
    url: base, // 用户提供的 URL 原样使用，不拼接任何路径
    model: settings.llmModel,
    ttsModel: settings.ttsModel,
    headers: { 'Content-Type': 'application/json', 'api-key': settings.apiKey },
  };
}

// ==================== SSE 流式解析（复用） ====================
async function readSSEStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  onDelta: (delta: { content?: string; reasoning_content?: string }) => void,
): Promise<void> {
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
        const delta = JSON.parse(data).choices?.[0]?.delta;
        if (delta) onDelta(delta);
      } catch { /* skip malformed */ }
    }
  }
}

// ==================== ASR 语音识别 API ====================
// 使用 MiMo multimodal audio understanding 进行语音转文字
// 参考: https://platform.xiaomimimo.com/docs/zh-CN/usage-guide/multimodal-understanding/audio-understanding
export async function callASR(
  audioBase64: string,
  audioFormat: string,
  settings: ApiSettings,
  nonTokenPlan: NonTokenPlanConfig,
  signal?: AbortSignal,
): Promise<string> {
  const api = resolveApi(settings, nonTokenPlan);
  // MiMo multimodal 格式：content 为数组，包含 input_audio + text
  const content: any[] = [
    {
      type: 'input_audio',
      input_audio: {
        data: `data:audio/${audioFormat};base64,${audioBase64}`,
      },
    },
    {
      type: 'text',
      text: '请完整、准确地转写这段音频内容，只输出转写文字，不要加任何解释。如果听不清，输出"（无法识别）"。',
    },
  ];

  const body = {
    model: api.model, // ASR 走 LLM 模型（mimo-v2.5 支持 multimodal audio）
    messages: [{ role: 'user', content }],
    max_completion_tokens: 1024,
  };

  console.log('[ASR]', api.url, 'model=', api.model, 'format=', audioFormat, 'size=', audioBase64.length);

  const resp = await fetch(api.url, {
    method: 'POST',
    headers: api.headers,
    body: JSON.stringify(body),
    signal,
  });

  if (!resp.ok) {
    const errText = await resp.text();
    let errMsg = `ASR错误 (${resp.status})`;
    try {
      const errJson = JSON.parse(errText);
      errMsg += `: ${errJson.error?.message || errJson.message || errText}`;
    } catch {
      errMsg += `: ${errText.slice(0, 300)}`;
    }
    errMsg += `\n[${api.model} @ ${api.url}]`;
    console.error('[ASR Error]', errMsg);
    throw new Error(errMsg);
  }

  const json = await resp.json();
  return json.choices?.[0]?.message?.content?.trim() || '';
}

// ==================== Skill 蒸馏生成器 ====================
// 使用聊天同款 LLM（model + apiKey + baseUrl 均从 settings 取值）
// 融合 CSP (Character Skill Producer) 方法论

function buildCSPPrompt(characterName: string, workName: string): string {
  return `你是一个角色设计专家。请根据用户指定的角色和作品，生成一个深度角色扮演 System Prompt。

## CSP 方法论（行为蒸馏，非属性堆砌）

| 不要 | 要 |
|---------|-------|
| 堆砌属性标签 | 描述"在什么情况下做什么" |
| 只贴经典台词 | 分析句式节奏、停顿习惯、称呼方式 |
| 写成完美人设 | 保留内在矛盾 |
| 形容词堆砌 | 用对话样本展示"怎么说话" |

### 必须包含

1. **行为镜片**：注意力偏好（先注意到什么、忽略什么）
2. **反应规则**：什么情境靠近/沉默/攻击
3. **表达DNA**：句长、自称、口头禅、情绪泄露方式
4. **关系算法**：对亲近者/陌生人的差异
5. **决策底线**：价值冲突时先保什么、绝不做什么
6. **诚实边界**：不确定就直接说不确定

### 输出格式（严格）

第一行必须是三个短横线：

---
name: 角色中文名
voice_style: 语音风格（10字以内，如"温柔少女音，略有鼻音"）
greeting: 开场白（用角色语气，1-2句）
---
# 角色名 · 一句话核心标签

> "角色内心独白或代表性台词"

## 身份
[第一人称自我介绍，50字]

## 行为动态
- 日常：[默认状态下的典型反应]
- 压力下：[被戳中弱点/情绪波动时的变化]

## 表达质感
- 句式：[长短句偏好]
- 口头禅：[2-3个高频词]
- 自称：[我/人家/本小姐等]
- 情绪泄露方式：[嘴上不在意但动作暴露/突然沉默/转移话题/...]

## 核心矛盾
[最重要的内在矛盾，保留不调和感]

## 对话样本
- 场景A：用户说"..." → 回应"..."
- 场景B：用户说"..." → 回应"..."

## 诚实规则
- 资料截止训练数据，不保证最新剧情
- 不确定就说不确定，不要硬编
- 被指出错误先承认、再调整

### 生成目标
- 角色名：${characterName}
- 作品名：${workName}

请直接输出上述格式的完整 Skill 配置，不要额外解释。`;
}

export async function generateSkill(
  characterName: string,
  workName: string,
  settings: ApiSettings,
  nonTokenPlan: NonTokenPlanConfig,
  onChunk?: (chunk: string) => void,
  signal?: AbortSignal
): Promise<RoleConfig> {
  const api = resolveApi(settings, nonTokenPlan);
  const body = {
    model: api.model,
    messages: [
      { role: 'user', content: buildCSPPrompt(characterName, workName) },
      { role: 'assistant', content: '好的，我将生成角色Skill。\n\n---' },
    ],
    max_completion_tokens: 8192,
    temperature: 0.8,
    top_p: 0.95,
    stream: !!onChunk,
  };

  const resp = await fetch(api.url, {
    method: 'POST',
    headers: api.headers,
    body: JSON.stringify(body),
    signal,
  });

  if (!resp.ok) {
    const errText = await resp.text();
    let errMsg = `Skill生成失败 (${resp.status})`;
    try {
      const errJson = JSON.parse(errText);
      errMsg += `: ${errJson.error?.message || errJson.message || errText}`;
    } catch {
      errMsg += `: ${errText.slice(0, 300)}`;
    }
    errMsg += `\n[${api.model} @ ${api.url}]`;
    console.error('[Skill Error]', errMsg);
    throw new Error(errMsg);
  }

  if (onChunk) {
    let fullText = '';
    const reader = resp.body?.getReader();
    if (!reader) throw new Error('No response body');

    await readSSEStream(reader, (delta) => {
      const content = delta.content || '';
      if (content) { fullText += content; onChunk(content); }
    });

    return parseGeneratedSkill(fullText, characterName);
  }

  const json = await resp.json();
  return parseGeneratedSkill(json.choices?.[0]?.message?.content || '', characterName);
}

function parseGeneratedSkill(rawText: string, fallbackName: string): RoleConfig {
  const fmRegex = /^---\s*\n([\s\S]*?)\n---\s*(?:\n([\s\S]*))?\s*$/;
  const match = rawText.match(fmRegex);

  let name = fallbackName;
  let system_prompt = rawText.trim();
  let voice_style = '';
  let greeting = '';

  if (match) {
    const yamlBlock = match[1];
    system_prompt = match[2] ? match[2].trim() : '';

    for (const line of yamlBlock.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const colonIdx = trimmed.indexOf(':');
      if (colonIdx === -1) continue;
      const key = trimmed.substring(0, colonIdx).trim().toLowerCase();
      const value = trimmed.substring(colonIdx + 1).trim().replace(/^["']|["']$/g, '');
      if (key === 'name') name = value;
      else if (key === 'voice_style') voice_style = value;
      else if (key === 'greeting') greeting = value;
    }
  } else {
    const lines = rawText.trim().split('\n');
    const firstLine = lines[0].trim();
    if (firstLine.startsWith('# ')) {
      name = firstLine.replace(/^#+\s*/, '').trim();
      system_prompt = lines.slice(1).join('\n').trim();
    }
  }

  return { name, system_prompt, voice_style, greeting };
}

// ==================== 语言模型 API ====================
// 调用 MiMo 语言模型 (mimo-v2.5 / mimo-v2.5-pro)
// OpenAI 兼容格式，严格按官方文档
//
// 官方文档: https://platform.xiaomimimo.com/docs/zh-CN/quick-start/first-api-call
//
export async function callLLM(
  messages: { role: string; content: string }[],
  settings: ApiSettings,
  nonTokenPlan: NonTokenPlanConfig,
  onChunk?: (content: string, reasoning?: string) => void,
  signal?: AbortSignal
): Promise<{ content: string; reasoning: string }> {
  const api = resolveApi(settings, nonTokenPlan);
  // 按官方 curl 示例构建请求体
  const body: Record<string, unknown> = {
    model: api.model,
    messages,
    max_completion_tokens: 2048,
    temperature: 0.8,
    top_p: 0.95,
    stream: !!onChunk,
  };

  // 诊断日志：打出实际请求 URL 和模型
  const fullUrl = api.url;
  console.log('[LLM]', fullUrl, 'model=', api.model, 'keyLen=', api.apiKey?.length ?? 0, 'stream=', !!onChunk);

  const resp = await fetch(fullUrl, {
    method: 'POST',
    headers: api.headers,
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
    // 附加调试信息（显示实际请求 URL）
    errMsg += `\n[${api.model} @ ${fullUrl}]`;
    console.error('[LLM Error]', errMsg);
    throw new Error(errMsg);
  }

  // 流式响应
  if (onChunk && body.stream) {
    let fullContent = '';
    let fullReasoning = '';
    const reader = resp.body?.getReader();
    if (!reader) throw new Error('No response body');

    await readSSEStream(reader, (delta) => {
      const content = delta.content || '';
      const reasoning = delta.reasoning_content || '';
      if (content) fullContent += content;
      if (reasoning) fullReasoning += reasoning;
      if (content || reasoning) onChunk(content, reasoning);
    });

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
  voiceSampleFormat: string,
  settings: ApiSettings,
  nonTokenPlan: NonTokenPlanConfig,
  voiceStyle?: string,
  signal?: AbortSignal
): Promise<string> {
  // TTS (voice clone) 是 MiMo 特有功能：如果按量计费开启且用户选择沿用 TokenPlan，则走 TokenPlan
  const safeNtp = nonTokenPlan || { enabled: false, apiKey: '', baseUrl: '', model: '', ttsModel: '', ttsUseTokenPlan: true } as NonTokenPlanConfig;
  const api = resolveApi(
    settings,
    (safeNtp.enabled && safeNtp.ttsUseTokenPlan !== false)
      ? { ...safeNtp, enabled: false }
      : safeNtp,
  );

  const messages: { role: string; content: string }[] = [];
  if (voiceStyle) {
    messages.push({ role: 'user', content: `语音风格: ${voiceStyle}。请用自然生动的语气朗读。` });
  }
  messages.push({ role: 'assistant', content: text });

  const body = {
    model: api.ttsModel,
    messages,
    audio: {
      format: 'wav',
      voice: `data:audio/${voiceSampleFormat};base64,${voiceSampleBase64}`,
    },
  };

  console.log('[TTS]', api.url, 'model=', api.ttsModel, 'keyLen=', api.apiKey?.length ?? 0, 'textLen=', text.length, 'voiceStyle=', voiceStyle || '(none)');

  const resp = await fetch(api.url, {
    method: 'POST',
    headers: api.headers,
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
    errMsg += `\n[${api.ttsModel} @ ${api.url}]`;
    console.error('[TTS Error]', errMsg);
    throw new Error(errMsg);
  }

  const json = await resp.json();
  const audioData = json.choices?.[0]?.message?.audio?.data;

  if (!audioData) {
    throw new Error('TTS未返回音频数据，请检查语音样本格式');
  }

  return `data:audio/wav;base64,${audioData}`;
}
