// 角色配置（从 skill 文件夹的 config.json 读取）
export interface RoleConfig {
  name: string;
  system_prompt: string;
  voice_style?: string;       // 语音风格描述
  greeting?: string;           // 开场白
  avatar?: string;             // base64 头像
}

// 导入的 Skill
export interface SkillImport {
  id: string;
  folderName: string;
  config: RoleConfig;
  avatarDataUrl?: string;      // 头像 data URL
  voiceSampleDataUrl?: string; // 语音样本 data URL (base64)
}

// 聊天消息
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  reasoning_content?: string;  // 思考过程
  timestamp: number;
  audioUrl?: string;           // TTS 生成的语音 URL
  isPlaying?: boolean;
}

// LLM 提供商
export type LlmProvider = 'mimo' | 'deepseek';

// API 设置
export interface ApiSettings {
  provider: LlmProvider;
  apiKey: string;
  baseUrl: string;
  llmModel: string;           // 语言模型
  ttsModel: string;           // TTS 模型 (仅 MiMo 有效)
  ttsApiKey: string;          // 语音独立 API Key（不填则沿用上方 apiKey）
  ttsBaseUrl: string;         // 语音独立 Base URL（不填则沿用上方 baseUrl）
  enableThinking: boolean;
  reasoningEffort: number;    // 思考强度 0-100，DeepSeek 有效 (high/max)
}

// 按量计费 API 配置（与 TokenPlan 独立的账号）
export interface NonTokenPlanConfig {
  enabled: boolean;
  provider: LlmProvider;
  apiKey: string;
  baseUrl: string;
  model: string;
  ttsModel: string;
  ttsUseTokenPlan: boolean;    // 按量计费模式下 TTS 是否沿用 TokenPlan（语音克隆是 MiMo 特有功能）
}
