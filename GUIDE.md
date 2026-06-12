# RoleChat 全面介绍

基于 React + Electron 的桌面角色扮演应用，支持深度角色生成、语音克隆、多角色管理。

---

## 目录

1. [核心功能](#核心功能)
2. [界面布局](#界面布局)
3. [设置详解](#设置详解)
4. [角色生成 (CSP)](#角色生成-csp)
5. [语音克隆](#语音克隆)
6. [API 认证模式](#api-认证模式)
7. [技术架构](#技术架构)
8. [开发与构建](#开发与构建)

---

## 核心功能

| 功能 | 说明 |
|------|------|
| 一键生成角色 | 输入角色名 + 作品名，自动生成深度角色设定（System Prompt）、开场白、语音风格 |
| 语音对话 | 上传声音样本，AI 用该音色朗读回复；支持自动朗读和手动播放暂停 |
| 多角色管理 | 左侧微信风格列表，每个角色独立聊天记录，一键切换 |
| 流式回复 | 实时打字效果，逐字显示 |
| 思考过程 | 可折叠查看推理过程（reasoning） |
| 深色/浅色 | 一键切换主题 |
| 桌面 EXE | 单文件 Electron 应用，不受浏览器 CORS 限制 |

---

## 界面布局

```
┌────────────┬──────────────────────────────┐
│  侧边栏     │   聊天区                       │
│            │  ┌──────────────────────────┐ │
│  角色列表   │  │  ChatHeader             │ │
│  - 头像     │  │  (名称、状态、按钮)        │ │
│  - 名称     │  ├──────────────────────────┤ │
│  - 最后消息 │  │  MessageList             │ │
│  - 时间     │  │  - MessageBubble × N    │ │
│            │  │  - 思考过程               │ │
│  + 添加     │  │  - 语音播放               │ │
│            │  ├──────────────────────────┤ │
│            │  │  ChatInput               │ │
│            │  │  (输入框 + 发送按钮)       │ │
│            │  └──────────────────────────┘ │
│            │  SettingsPanel (弹出式面板)     │
└────────────┴──────────────────────────────┘
```

---

## 设置详解

点击右上角齿轮图标打开设置面板，包含以下区块：

### 模型设置

| 字段 | 默认值 | 说明 |
|------|--------|------|
| API Key | (需填写) | 服务商密钥，支持粘贴/复制按钮 |
| API Base URL | (需填写) | 完整 API 地址，例如 `https://api.xiaomimimo.com/v1/chat/completions` |
| 语言模型 | `mimo-v2.5` | 对话模型 |
| 语音模型 | `mimo-v2.5-tts-voiceclone` | 语音合成模型 |

### 按量计费 API

独立开关，与上方 TokenPlan 账号完全隔离：

| 字段 | 说明 |
|------|------|
| 开关 | 开启后 LLM 请求走按量计费 Key（认证方式相同，均为 `api-key`） |
| TTS 沿用 TokenPlan | 默认开启，语音克隆走上方 TokenPlan 配置 |

### 角色设置

- 编辑角色名称和 System Prompt
- 上传角色头像（支持图片文件和粘贴）
- 上传聊天背景
- 上传语音样本（wav/mp3）

### 其他

- 思考过程开关
- 语音朗读开关
- 深色/浅色主题切换
- 清空当前聊天记录

---

## 角色生成 (CSP)

CSP (Character Skill Producer) 是一套角色行为蒸馏方法论。用户只需输入角色名和作品名，系统自动生成包含以下要素的深度角色配置：

| 要素 | 说明 |
|------|------|
| 行为镜片 | 角色注意力偏好（先注意什么、忽略什么） |
| 反应规则 | 不同情境下的行为模式（靠近/沉默/攻击） |
| 表达DNA | 句长、自称、口头禅、情绪泄露方式 |
| 关系算法 | 对亲近者与陌生人的差异 |
| 决策底线 | 价值冲突时的优先级和绝对禁忌 |
| 诚实边界 | 不确定时直接承认，不编造 |

### 输出格式

生成的 System Prompt 采用 YAML front matter 格式：

```yaml
---
name: 角色中文名
voice_style: 语音风格描述（10字以内）
greeting: 开场白（1-2句，角色语气）
---
# 角色名 · 一句话核心标签

> "角色代表性台词"

## 身份
[第一人称自我介绍，50字]

## 行为动态
- 日常：[默认反应]
- 压力下：[情绪波动时的变化]

## 表达质感
- 句式：[长短句偏好]
- 口头禅：[2-3个高频词]
- 自称：[我/人家/本小姐等]

## 核心矛盾
[最重要的内在矛盾]

## 对话样本
- 场景A：用户说"..." → 回应"..."
- 场景B：用户说"..." → 回应"..."
```

---

## 语音克隆

基于 MiMo `mimo-v2.5-tts-voiceclone` 模型，实现音色复制 + 语音合成：

### 使用流程

1. 准备一段角色的语音样本（建议 10-30 秒，清晰的单人声音）
2. 在设置面板上传该音频文件
3. 开启语音开关
4. 发送消息后，LLM 回复自动朗读；也可点击消息气泡上的播放按钮手动播放

### 技术要点

- 语音样本以 base64 data URL 存储在 localStorage
- 请求格式包含 `audio.voice` 字段（data URL）和 `audio.format: 'wav'`
- 返回 `audio.data`（base64 wav），直接转为 Audio 对象播放
- 超过 500KB 的语音样本不会持久化到 localStorage（避免存储溢出）

### 自动朗读 vs 手动播放

- **自动朗读**：LLM 流式回复完成后，自动请求 TTS 并播放
- **手动播放**：点击消息气泡下方的朗读按钮
- 音频缓存机制：同一消息只请求一次 TTS，后续点击直接播放缓存

---

## API 认证模式

### 统一认证

所有请求均使用 `api-key` Header：

```
POST {baseUrl}
Content-Type: application/json
api-key: {your_api_key}
```

### TokenPlan 与按量计费

两种模式的差异仅在于 API Key 和付费方式：

| | TokenPlan | 按量计费 |
|---|-----------|----------|
| 认证 | `api-key` | `api-key` |
| 付费 | 预购 credits | 按使用量扣费 |
| 配置 | 模型设置区域 | 独立开关区块 |
| TTS | 默认 | 可选择沿用 TokenPlan |

### 请求端点

URL 需填写完整地址，代码不会自动拼接路径。示例：

```
LLM:  https://api.xiaomimimo.com/v1/chat/completions
TTS:  https://api.xiaomimimo.com/v1/chat/completions
```

---

## 技术架构

### 技术栈

```
React 18          UI 框架
TypeScript        类型安全
Zustand           状态管理（含 persist 中间件）
Tailwind CSS      样式
Vite 5            构建工具
Electron 28        桌面壳
MiMo V2.5         后端 LLM / TTS
```

### 数据流

```
用户输入 → ChatInput
  → callLLM (services/api.ts)
    → fetch (SSE 流式)
      → readSSEStream
        → updateLastMessage (chatStore)
          → MessageBubble 实时渲染
            → (可选) callVoiceClone → Audio 播放
```

### 状态管理

Zustand store (`chatStore.ts`) 持久化字段：

| 字段 | 说明 |
|------|------|
| `skills` | 所有角色（含配置、头像、语音样本） |
| `skillChats` | 每个角色的聊天记录 key-value |
| `apiSettings` | TokenPlan 配置 |
| `nonTokenPlan` | 按量计费配置 |
| `theme` / `showThinking` / `isTtsEnabled` | UI 偏好 |

不持久化字段：`isLoading`、`isSettingsOpen`、`isSkillImporterOpen`

### 性能优化

- 所有组件使用 Zustand selector 逐个订阅（避免全量 store 订阅导致不必要重渲染）
- 全部 7 个组件包裹 `React.memo`
- Vite 代码分割：react / zustand 独立 chunk
- 聊天记录截断至最近 200 条
- 头像 > 300KB 和语音样本 > 500KB 不持久化
- ChatInput 用 `requestAnimationFrame` 避免 layout thrashing

### 项目文件

```
RoleChat/
├── src/
│   ├── components/
│   │   ├── ChatHeader.tsx         顶部栏
│   │   ├── ChatInput.tsx          消息输入
│   │   ├── MessageBubble.tsx      消息气泡
│   │   ├── MessageList.tsx        消息列表
│   │   ├── SettingsPanel.tsx      设置面板
│   │   ├── SkillImporter.tsx      角色导入
│   │   └── SkillSidebar.tsx       角色侧边栏
│   ├── services/
│   │   └── api.ts                 API 服务层
│   ├── store/
│   │   └── chatStore.ts           Zustand 状态
│   ├── types/
│   │   └── index.ts               TS 类型定义
│   ├── styles/
│   │   └── index.css              全局样式
│   ├── App.tsx                    根组件
│   └── main.tsx                   入口
├── electron/
│   ├── main.cjs                   Electron 主进程
│   └── preload.cjs                预加载脚本
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
├── package.json
├── build-exe.bat                  一键构建 + 部署脚本
├── README.md                      小白版介绍
└── GUIDE.md                       本文件（全面版）
```

---

## 开发与构建

```bash
# 安装依赖
npm install

# 浏览器开发（端口 5173）
npm run dev

# Electron 开发
npm run electron:dev

# TypeScript 编译检查
npx tsc -b

# 构建 + 打包 EXE + 部署到 G 盘
.\build-exe.bat

# 仅打包 EXE
npm run electron:build
```

构建输出：
- `dist/` — Vite 构建产物
- `release/win-unpacked/` — Electron 解包目录
- `release/RoleChat.exe` — 单文件 EXE（约 70MB）
