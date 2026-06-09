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

// API 设置
export interface ApiSettings {
  apiKey: string;
  baseUrl: string;
  llmModel: string;           // mimo-v2.5 或 mimo-v2.5-pro
  ttsModel: string;           // mimo-v2.5-tts-voiceclone
  enableThinking: boolean;
}
