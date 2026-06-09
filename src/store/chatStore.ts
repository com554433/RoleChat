import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ChatMessage, SkillImport, ApiSettings, RoleConfig } from '../types';

interface ChatStore {
  // 角色
  currentSkill: SkillImport | null;
  roleConfig: RoleConfig | null;
  avatarDataUrl: string;
  backgroundUrl: string;

  // 聊天
  messages: ChatMessage[];
  isLoading: boolean;
  streamingContent: string;
  streamingReasoning: string;

  // API
  apiSettings: ApiSettings;

  // 语音
  voiceSampleDataUrl: string;
  isTtsEnabled: boolean;

  // 设置面板 (不持久化)
  isSettingsOpen: boolean;
  isSkillImporterOpen: boolean;

  // 显示思考过程
  showThinking: boolean;

  // Actions
  setRoleConfig: (config: RoleConfig | null) => void;
  setCurrentSkill: (skill: SkillImport | null) => void;
  setAvatarDataUrl: (url: string) => void;
  setBackgroundUrl: (url: string) => void;
  setVoiceSampleDataUrl: (url: string) => void;
  addMessage: (msg: ChatMessage) => void;
  updateLastMessage: (content: string, reasoning?: string) => void;
  setLoading: (loading: boolean) => void;
  setStreamingContent: (content: string) => void;
  setStreamingReasoning: (reasoning: string) => void;
  updateApiSettings: (settings: Partial<ApiSettings>) => void;
  setShowThinking: (show: boolean) => void;
  toggleSettings: () => void;
  toggleSkillImporter: () => void;
  toggleTts: () => void;
  clearChat: () => void;
  updateMessageAudio: (msgId: string, audioUrl: string) => void;
  setMessagePlaying: (msgId: string, playing: boolean) => void;
}

export const useChatStore = create<ChatStore>()(
  persist(
    (set, get) => ({
      currentSkill: null,
      roleConfig: null,
      avatarDataUrl: '',
      backgroundUrl: '',

      messages: [],
      isLoading: false,
      streamingContent: '',
      streamingReasoning: '',

      apiSettings: {
        apiKey: '',
        baseUrl: '',
        llmModel: 'mimo-v2.5',
        ttsModel: 'mimo-v2.5-tts-voiceclone',
        enableThinking: false,
      },

      voiceSampleDataUrl: '',
      isTtsEnabled: false,
      isSettingsOpen: false,
      isSkillImporterOpen: false,
      showThinking: true,

      setRoleConfig: (config) => set({ roleConfig: config }),
      setCurrentSkill: (skill) => {
        if (skill) {
          set({
            currentSkill: skill,
            roleConfig: skill.config,
            avatarDataUrl: skill.avatarDataUrl || get().avatarDataUrl,
            voiceSampleDataUrl: skill.voiceSampleDataUrl || get().voiceSampleDataUrl,
          });
        } else {
          set({ currentSkill: null });
        }
      },
      setAvatarDataUrl: (url) => set({ avatarDataUrl: url }),
      setBackgroundUrl: (url) => set({ backgroundUrl: url }),
      setVoiceSampleDataUrl: (url) => set({ voiceSampleDataUrl: url }),
      addMessage: (msg) =>
        set((s) => ({
          messages: [...s.messages, msg].slice(-200), // 最多保留200条
        })),
      updateLastMessage: (content, reasoning) =>
        set((s) => {
          const msgs = [...s.messages];
          const last = msgs[msgs.length - 1];
          if (last && last.role === 'assistant') {
            msgs[msgs.length - 1] = {
              ...last,
              content: last.content + content,
              reasoning_content: (last.reasoning_content || '') + (reasoning || ''),
            };
          }
          return { messages: msgs };
        }),
      setLoading: (loading) => set({ isLoading: loading }),
      setStreamingContent: (content) => set({ streamingContent: content }),
      setStreamingReasoning: (reasoning) => set({ streamingReasoning: reasoning }),
      updateApiSettings: (settings) =>
        set((s) => ({ apiSettings: { ...s.apiSettings, ...settings } })),
      setShowThinking: (show) => set({ showThinking: show }),
      toggleSettings: () => set((s) => ({ isSettingsOpen: !s.isSettingsOpen })),
      toggleSkillImporter: () => set((s) => ({ isSkillImporterOpen: !s.isSkillImporterOpen })),
      toggleTts: () => set((s) => ({ isTtsEnabled: !s.isTtsEnabled })),
      clearChat: () => set({ messages: [] }),
      updateMessageAudio: (msgId, audioUrl) =>
        set((s) => ({
          messages: s.messages.map((m) =>
            m.id === msgId ? { ...m, audioUrl } : m
          ),
        })),
      setMessagePlaying: (msgId, playing) =>
        set((s) => ({
          messages: s.messages.map((m) =>
            m.id === msgId ? { ...m, isPlaying: playing } : m
          ),
        })),
    }),
    {
      name: 'rolechat-data',
      partialize: (state) => ({
        // 需要持久化的数据
        // currentSkill 中去掉大体积的 data URL，防止超出 localStorage 5MB 限制
        currentSkill: state.currentSkill
          ? {
              ...state.currentSkill,
              avatarDataUrl: state.currentSkill.avatarDataUrl
                ? (state.currentSkill.avatarDataUrl.length < 300000 ? state.currentSkill.avatarDataUrl : '')
                : '',
              voiceSampleDataUrl: state.currentSkill.voiceSampleDataUrl
                ? (state.currentSkill.voiceSampleDataUrl.length < 500000 ? state.currentSkill.voiceSampleDataUrl : '')
                : '',
            }
          : null,
        roleConfig: state.roleConfig,
        avatarDataUrl: state.avatarDataUrl
          ? (state.avatarDataUrl.length < 300000 ? state.avatarDataUrl : '') // 头像>300KB不存
          : '',
        backgroundUrl: state.backgroundUrl
          ? (state.backgroundUrl.length < 500000 ? state.backgroundUrl : '') // 背景>500KB不存
          : '',
        messages: state.messages.slice(-100), // 只存最近100条
        apiSettings: state.apiSettings,
        voiceSampleDataUrl: state.voiceSampleDataUrl
          ? (state.voiceSampleDataUrl.length < 500000 ? state.voiceSampleDataUrl : '') // 语音>500KB不存
          : '',
        isTtsEnabled: state.isTtsEnabled,
        showThinking: state.showThinking,
      }),
      version: 1,
    }
  )
);
