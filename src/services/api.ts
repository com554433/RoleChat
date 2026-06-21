import type { ApiSettings, RoleConfig, NonTokenPlanConfig, LlmProvider } from '../types';

// ==================== 认证模式适配 ====================
function resolveApi(
  settings: ApiSettings,
  payAsYouGo: NonTokenPlanConfig,
) {
  if (payAsYouGo.enabled) {
    const provider = payAsYouGo.provider || 'mimo';
    const base = payAsYouGo.baseUrl.replace(/\/+$/, '');
    const isDeepSeek = provider === 'deepseek';
    return {
      apiKey: payAsYouGo.apiKey,
      url: base,
      model: payAsYouGo.model,
      ttsModel: payAsYouGo.ttsModel,
      provider,
      headers: {
        'Content-Type': 'application/json',
        ...(isDeepSeek
          ? { Authorization: `Bearer ${payAsYouGo.apiKey}` }
          : { 'api-key': payAsYouGo.apiKey }),
      },
    };
  }
  const provider = settings.provider || 'mimo';
  const isDeepSeek = provider === 'deepseek';

  // 优先使用 provider 专属字段，回退到通用字段
  const effectiveApiKey = isDeepSeek
    ? (settings.deepseekApiKey || settings.apiKey)
    : (settings.mimoApiKey || settings.apiKey);
  const effectiveBaseUrl = isDeepSeek
    ? (settings.deepseekBaseUrl || settings.baseUrl)
    : (settings.mimoBaseUrl || settings.baseUrl);
  const effectiveModel = isDeepSeek
    ? (settings.deepseekModel || settings.llmModel)
    : (settings.mimoModel || settings.llmModel);

  const defaultBase = isDeepSeek
    ? 'https://api.deepseek.com/v1/chat/completions'
    : 'https://api.xiaomimimo.com/v1';
  const base = (effectiveBaseUrl || defaultBase).replace(/\/+$/, '');
  return {
    apiKey: effectiveApiKey,
    url: base,
    model: effectiveModel,
    ttsModel: settings.ttsModel,
    provider,
    headers: {
      'Content-Type': 'application/json',
      ...(isDeepSeek
        ? { Authorization: `Bearer ${effectiveApiKey}` }
        : { 'api-key': effectiveApiKey }),
    },
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

// ==================== Skill 蒸馏生成器 ====================
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
    if (!reader) throw new Error('无响应数据');

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
export async function callLLM(
  messages: { role: string; content: string }[],
  settings: ApiSettings,
  nonTokenPlan: NonTokenPlanConfig,
  onChunk?: (content: string, reasoning?: string) => void,
  signal?: AbortSignal
): Promise<{ content: string; reasoning: string }> {
  const api = resolveApi(settings, nonTokenPlan);
  const isDeepSeek = api.provider === 'deepseek';

  const body: Record<string, unknown> = {
    model: api.model,
    messages,
    max_completion_tokens: 2048,
    stream: !!onChunk,
  };

  // 非思考模式才传 temperature/top_p（思考模式下 MiMo/DeepSeek 都会忽略）
  const re = settings.reasoningEffort ?? 50;
  if (re <= 0) {
    body.temperature = 0.8;
    body.top_p = 0.95;
  }

  // 思考控制
  if (re > 0) {
    // thinking 开关（MiMo 和 DeepSeek 都支持）
    body.thinking = { type: 'enabled' };

    // reasoning_effort 仅 DeepSeek 支持
    if (isDeepSeek) {
      body.reasoning_effort = re <= 66 ? 'high' : 'max';
    }
  }

  // 诊断日志
  console.log('[LLM]', api.url, 'provider=', api.provider, 'model=', api.model, 'keyLen=', api.apiKey?.length ?? 0, 'stream=', !!onChunk, 'reasoning=', re > 0 ? 'on' : 'off');

  const resp = await fetch(api.url, {
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
    errMsg += `\n[${api.model} @ ${api.url}]`;
    console.error('[LLM Error]', errMsg);
    throw new Error(errMsg);
  }

  // 流式响应
  if (onChunk && body.stream) {
    let fullContent = '';
    let fullReasoning = '';
    const reader = resp.body?.getReader();
    if (!reader) throw new Error('无响应数据');

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

// ==================== 语音克隆 TTS API（仅 MiMo） ====================
export async function callVoiceClone(
  text: string,
  voiceSampleBase64: string,
  voiceSampleFormat: string,
  settings: ApiSettings,
  nonTokenPlan: NonTokenPlanConfig,
  voiceStyle?: string,
  signal?: AbortSignal
): Promise<string> {
  let ttsUrl: string;
  let ttsKey: string;
  let ttsHeaders: Record<string, string>;

  // 优先使用独立 TTS API 配置
  if (settings.ttsApiKey) {
    ttsUrl = (settings.ttsBaseUrl || settings.baseUrl || 'https://api.xiaomimimo.com/v1').replace(/\/+$/, '');
    ttsKey = settings.ttsApiKey;
    ttsHeaders = { 'Content-Type': 'application/json', 'api-key': ttsKey };
  } else {
    // 回退到 resolveApi 的逻辑
    const safeNtp = nonTokenPlan || { enabled: false, apiKey: '', baseUrl: '', model: '', ttsModel: '', ttsUseTokenPlan: true, provider: 'mimo' as const } as NonTokenPlanConfig;
    const api = resolveApi(
      settings,
      (safeNtp.enabled && safeNtp.ttsUseTokenPlan !== false)
        ? { ...safeNtp, enabled: false }
        : safeNtp,
    );
    ttsUrl = api.url;
    ttsKey = api.apiKey;
    ttsHeaders = api.headers;
  }

  const messages: { role: string; content: string }[] = [];
  if (voiceStyle) {
    messages.push({ role: 'user', content: `语音风格: ${voiceStyle}。请用自然生动的语气朗读。` });
  }
  messages.push({ role: 'assistant', content: text });

  const body = {
    model: settings.ttsModel,
    messages,
    audio: {
      format: 'wav',
      voice: `data:audio/${voiceSampleFormat};base64,${voiceSampleBase64}`,
    },
  };

  console.log('[TTS]', ttsUrl, 'model=', settings.ttsModel, 'keyLen=', ttsKey?.length ?? 0, 'textLen=', text.length, 'voiceStyle=', voiceStyle || '(none)');

  const resp = await fetch(ttsUrl, {
    method: 'POST',
    headers: ttsHeaders,
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
    errMsg += `\n[${settings.ttsModel} @ ${ttsUrl}]`;
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

// ==================== ASR 语音识别 API ====================
export async function callASR(
  audioBlob: Blob,
  settings: ApiSettings,
  signal?: AbortSignal,
): Promise<string> {
  const baseUrl = (settings.asrBaseUrl || 'https://api.xiaomimimo.com/v1').replace(/\/+$/, '');
  const apiKey = settings.asrApiKey || settings.mimoApiKey || settings.apiKey;
  const model = settings.asrModel || 'mimo-v2.5-asr';

  if (!apiKey) throw new Error('请先在设置中配置 ASR API Key');

  const formData = new FormData();
  formData.append('file', audioBlob, 'audio.wav');
  formData.append('model', model);

  console.log('[ASR]', baseUrl, 'model=', model, 'keyLen=', apiKey.length);

  const resp = await fetch(`${baseUrl}/audio/transcriptions`, {
    method: 'POST',
    headers: {
      'api-key': apiKey,
    },
    body: formData,
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
    throw new Error(errMsg);
  }

  const data = await resp.json();
  const text = data.text || '';
  if (!text.trim()) throw new Error('未识别到语音内容');
  return text.trim();
}
