import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ChatMessage, SkillImport, ApiSettings, RoleConfig, NonTokenPlanConfig } from '../types';

interface ChatStore {
  // 多角色
  skills: SkillImport[];
  activeSkillId: string | null;

  // 每个角色的聊天记录
  skillChats: Record<string, ChatMessage[]>;

  // 角色配置 (派生)
  roleConfig: RoleConfig | null;
  avatarDataUrl: string;
  backgroundUrl: string;

  // 聊天下拉
  isLoading: boolean;

  // API
  apiSettings: ApiSettings;

  // 非 TokenPlan 配置
  nonTokenPlan: NonTokenPlanConfig;

  // 语音
  voiceSampleDataUrl: string;
  isTtsEnabled: boolean;

  // 设置面板 (不持久化)
  isSettingsOpen: boolean;
  isSkillImporterOpen: boolean;

  // 显示思考过程
  showThinking: boolean;
  theme: 'light' | 'dark';

  // Actions
  setRoleConfig: (config: RoleConfig | null) => void;
  addSkill: (skill: SkillImport) => void;
  removeSkill: (id: string) => void;
  setActiveSkill: (id: string | null) => void;
  setAvatarDataUrl: (url: string) => void;
  setBackgroundUrl: (url: string) => void;
  setVoiceSampleDataUrl: (url: string) => void;
  addMessage: (msg: ChatMessage) => void;
  updateLastMessage: (content: string, reasoning?: string) => void;
  setLoading: (loading: boolean) => void;
  updateApiSettings: (settings: Partial<ApiSettings>) => void;
  updateNonTokenPlan: (config: Partial<NonTokenPlanConfig>) => void;
  setShowThinking: (show: boolean) => void;
  toggleSettings: () => void;
  toggleSkillImporter: () => void;
  toggleTts: () => void;
  toggleTheme: () => void;
  clearChat: () => void;
  updateMessageAudio: (msgId: string, audioUrl: string) => void;
  setMessagePlaying: (msgId: string, playing: boolean) => void;
}

// 辅助: 从 skills + activeSkillId 派生当前技能
function getCurrentSkill(state: {
  skills: SkillImport[];
  activeSkillId: string | null;
}): SkillImport | null {
  if (!state.activeSkillId) return null;
  return state.skills.find((s) => s.id === state.activeSkillId) || null;
}

export const useChatStore = create<ChatStore>()(
  persist(
    (set, get) => ({
      skills: [],
      activeSkillId: null,
      skillChats: {},

      roleConfig: null,
      avatarDataUrl: '',
      backgroundUrl: '',

      isLoading: false,

      apiSettings: {
        apiKey: '',
        baseUrl: '',
        llmModel: 'mimo-v2.5',
        ttsModel: 'mimo-v2.5-tts-voiceclone',
        asrModel: 'mimo-v2.5-asr',
        enableThinking: false,
      },

      nonTokenPlan: {
        enabled: false,
        apiKey: '',
        baseUrl: 'https://api.xiaomimimo.com/v1',
        model: 'mimo-v2.5-pro',
        ttsModel: 'mimo-v2.5-tts-voiceclone',
        asrModel: 'mimo-v2.5-asr',
        ttsUseTokenPlan: true,
      },

      voiceSampleDataUrl: '',
      isTtsEnabled: false,
      isSettingsOpen: false,
      isSkillImporterOpen: false,
      showThinking: true,
      theme: 'light',

      setRoleConfig: (config) =>
        set((s) => {
          if (!config || !s.activeSkillId) return { roleConfig: config };
          return {
            roleConfig: config,
            skills: s.skills.map((sk) =>
              sk.id === s.activeSkillId ? { ...sk, config } : sk,
            ),
          };
        }),

      // 添加角色到列表，如果同名则更新
      addSkill: (skill) =>
        set((s) => {
          const existingIdx = s.skills.findIndex(
            (x) => x.config.name === skill.config.name,
          );
          let newSkills: SkillImport[];
          if (existingIdx >= 0) {
            newSkills = [...s.skills];
            newSkills[existingIdx] = skill;
          } else {
            newSkills = [...s.skills, skill];
          }

          // 确保新角色有聊天记录槽位
          const newChats = { ...s.skillChats };
          if (!newChats[skill.id]) {
            newChats[skill.id] = [];
          }

          // 设置为当前活跃
          const active = getCurrentSkill({ skills: newSkills, activeSkillId: skill.id });
          return {
            skills: newSkills,
            skillChats: newChats,
            activeSkillId: skill.id,
            roleConfig: active?.config || null,
            avatarDataUrl: skill.avatarDataUrl ?? s.avatarDataUrl,
            voiceSampleDataUrl: skill.voiceSampleDataUrl ?? s.voiceSampleDataUrl,
          };
        }),

      removeSkill: (id) =>
        set((s) => {
          const newSkills = s.skills.filter((x) => x.id !== id);
          const newChats = { ...s.skillChats };
          delete newChats[id];

          let newActiveId = s.activeSkillId;
          let newRole = s.roleConfig;
          let newAvatar = s.avatarDataUrl;
          let newVoice = s.voiceSampleDataUrl;

          if (s.activeSkillId === id) {
            newActiveId = newSkills[0]?.id || null;
            const active = getCurrentSkill({ skills: newSkills, activeSkillId: newActiveId });
            newRole = active?.config || null;
            newAvatar = active?.avatarDataUrl || '';
            newVoice = active?.voiceSampleDataUrl || '';
          }

          return {
            skills: newSkills,
            skillChats: newChats,
            activeSkillId: newActiveId,
            roleConfig: newRole,
            avatarDataUrl: newAvatar,
            voiceSampleDataUrl: newVoice,
          };
        }),

      setActiveSkill: (id) =>
        set((s) => {
          if (id === s.activeSkillId) return {};
          const active = getCurrentSkill({ skills: s.skills, activeSkillId: id });
          return {
            activeSkillId: id,
            roleConfig: active?.config || null,
            avatarDataUrl: active?.avatarDataUrl || '',
            voiceSampleDataUrl: active?.voiceSampleDataUrl || '',
          };
        }),

      setAvatarDataUrl: (url) => set({ avatarDataUrl: url }),
      setBackgroundUrl: (url) => set({ backgroundUrl: url }),
      setVoiceSampleDataUrl: (url) => set({ voiceSampleDataUrl: url }),

      addMessage: (msg) =>
        set((s) => {
          if (!s.activeSkillId) return {};
          const chats = { ...s.skillChats };
          const current = chats[s.activeSkillId] || [];
          chats[s.activeSkillId] = [...current, msg].slice(-200);
          return { skillChats: chats };
        }),

      updateLastMessage: (content, reasoning) =>
        set((s) => {
          if (!s.activeSkillId) return {};
          const chats = { ...s.skillChats };
          const current = [...(chats[s.activeSkillId] || [])];
          const last = current[current.length - 1];
          if (last && last.role === 'assistant') {
            current[current.length - 1] = {
              ...last,
              content: last.content + content,
              reasoning_content: (last.reasoning_content || '') + (reasoning || ''),
            };
          }
          chats[s.activeSkillId] = current;
          return { skillChats: chats };
        }),

      setLoading: (loading) => set({ isLoading: loading }),
      updateApiSettings: (settings) =>
        set((s) => ({ apiSettings: { ...s.apiSettings, ...settings } })),
      updateNonTokenPlan: (config) =>
        set((s) => ({ nonTokenPlan: { ...s.nonTokenPlan, ...config } })),
      setShowThinking: (show) => set({ showThinking: show }),
      toggleSettings: () => set((s) => ({ isSettingsOpen: !s.isSettingsOpen })),
      toggleSkillImporter: () =>
        set((s) => ({ isSkillImporterOpen: !s.isSkillImporterOpen })),
      toggleTts: () => set((s) => ({ isTtsEnabled: !s.isTtsEnabled })),
      toggleTheme: () =>
        set((s) => ({ theme: s.theme === 'light' ? 'dark' : 'light' })),
      clearChat: () =>
        set((s) => {
          if (!s.activeSkillId) return {};
          const chats = { ...s.skillChats };
          chats[s.activeSkillId] = [];
          return { skillChats: chats };
        }),

      updateMessageAudio: (msgId, audioUrl) =>
        set((s) => {
          if (!s.activeSkillId) return {};
          const chats = { ...s.skillChats };
          const current = [...(chats[s.activeSkillId] || [])];
          chats[s.activeSkillId] = current.map((m) =>
            m.id === msgId ? { ...m, audioUrl } : m,
          );
          return { skillChats: chats };
        }),

      setMessagePlaying: (msgId, playing) =>
        set((s) => {
          if (!s.activeSkillId) return {};
          const chats = { ...s.skillChats };
          const current = [...(chats[s.activeSkillId] || [])];
          chats[s.activeSkillId] = current.map((m) =>
            m.id === msgId ? { ...m, isPlaying: playing } : m,
          );
          return { skillChats: chats };
        }),
    }),
    {
      name: 'rolechat-data-v2',
      partialize: (state) => ({
        skills: state.skills.map((skill) => ({
          ...skill,
          avatarDataUrl: skill.avatarDataUrl
            ? skill.avatarDataUrl.length < 300000
              ? skill.avatarDataUrl
              : ''
            : '',
          voiceSampleDataUrl: skill.voiceSampleDataUrl
            ? skill.voiceSampleDataUrl.length < 500000
              ? skill.voiceSampleDataUrl
              : ''
            : '',
        })),
        activeSkillId: state.activeSkillId,
        skillChats: state.skillChats,
        avatarDataUrl: state.avatarDataUrl
          ? state.avatarDataUrl.length < 300000
            ? state.avatarDataUrl
            : ''
          : '',
        backgroundUrl: state.backgroundUrl
          ? state.backgroundUrl.length < 500000
            ? state.backgroundUrl
            : ''
          : '',
        apiSettings: state.apiSettings,
        nonTokenPlan: state.nonTokenPlan,
        voiceSampleDataUrl: state.voiceSampleDataUrl
          ? state.voiceSampleDataUrl.length < 500000
            ? state.voiceSampleDataUrl
            : ''
          : '',
        isTtsEnabled: state.isTtsEnabled,
        showThinking: state.showThinking,
        theme: state.theme,
      }),
      version: 2,
    },
  ),
);

// Selector hooks for derived state
export const useCurrentSkill = () =>
  useChatStore((s) => {
    if (!s.activeSkillId) return null;
    return s.skills.find((x) => x.id === s.activeSkillId) || null;
  });

export const useMessages = () =>
  useChatStore((s) => {
    if (!s.activeSkillId) return [];
    return s.skillChats[s.activeSkillId] || [];
  });
