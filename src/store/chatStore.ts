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
        provider: 'mimo',
        apiKey: '',
        baseUrl: '',
        llmModel: 'mimo-v2.5-pro',
        mimoApiKey: '',
        mimoBaseUrl: '',
        mimoModel: 'mimo-v2.5-pro',
        deepseekApiKey: '',
        deepseekBaseUrl: '',
        deepseekModel: 'deepseek-v4-pro',
        ttsModel: 'mimo-v2.5-tts-voiceclone',
        ttsApiKey: '',
        ttsBaseUrl: '',
        enableThinking: false,
        reasoningEffort: 50,
        asrEnabled: false,
        asrApiKey: '',
        asrBaseUrl: 'https://api.xiaomimimo.com/v1',
        asrModel: 'mimo-v2.5-asr',
      },

      nonTokenPlan: {
        enabled: false,
        provider: 'mimo',
        apiKey: '',
        baseUrl: 'https://api.xiaomimimo.com/v1',
        model: 'mimo-v2.5-pro',
        ttsModel: 'mimo-v2.5-tts-voiceclone',
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

      // 添加角色到列表，如果同名则更新（保留旧ID，不丢失聊天记录）
      addSkill: (skill) =>
        set((s) => {
          const existingIdx = s.skills.findIndex(
            (x) => x.config.name === skill.config.name,
          );
          let newSkills: SkillImport[];
          let effectiveSkill = skill;
          if (existingIdx >= 0) {
            // 复用旧 ID，保留聊天记录
            const oldId = s.skills[existingIdx].id;
            effectiveSkill = { ...skill, id: oldId };
            newSkills = [...s.skills];
            newSkills[existingIdx] = effectiveSkill;
          } else {
            newSkills = [...s.skills, effectiveSkill];
          }

          // 确保新角色有聊天记录槽位
          const newChats = { ...s.skillChats };
          if (!newChats[effectiveSkill.id]) {
            newChats[effectiveSkill.id] = [];
          }

          // 设置为当前活跃
          const active = getCurrentSkill({ skills: newSkills, activeSkillId: effectiveSkill.id });
          return {
            skills: newSkills,
            skillChats: newChats,
            activeSkillId: effectiveSkill.id,
            roleConfig: active?.config || null,
            avatarDataUrl: effectiveSkill.avatarDataUrl ?? s.avatarDataUrl,
            voiceSampleDataUrl: effectiveSkill.voiceSampleDataUrl ?? s.voiceSampleDataUrl,
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
          config: skill.config?.system_prompt?.length > 100000
            ? { ...skill.config, system_prompt: skill.config.system_prompt.slice(0, 100000) }
            : skill.config,
          avatarDataUrl: skill.avatarDataUrl
            ? skill.avatarDataUrl.length < 2000000
              ? skill.avatarDataUrl
              : ''
            : '',
          voiceSampleDataUrl: skill.voiceSampleDataUrl
            ? skill.voiceSampleDataUrl.length < 5000000
              ? skill.voiceSampleDataUrl
              : ''
            : '',
        })),
        activeSkillId: state.activeSkillId,
        roleConfig: state.roleConfig && state.roleConfig.system_prompt && state.roleConfig.system_prompt.length > 100000
          ? { ...state.roleConfig, system_prompt: state.roleConfig.system_prompt.slice(0, 100000) }
          : state.roleConfig,
        skillChats: state.skillChats,
        avatarDataUrl: state.avatarDataUrl
          ? state.avatarDataUrl.length < 2000000
            ? state.avatarDataUrl
            : ''
          : '',
        backgroundUrl: state.backgroundUrl
          ? state.backgroundUrl.length < 5000000
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
      // 水合完成后，从 skills 中恢复 roleConfig（兼容旧数据）
      onRehydrateStorage: () => (state) => {
        if (state && !state.roleConfig && state.activeSkillId && state.skills.length > 0) {
          const active = state.skills.find((s) => s.id === state.activeSkillId);
          if (active?.config) {
            state.roleConfig = active.config;
          }
        }
      },
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
