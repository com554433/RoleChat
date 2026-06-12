# RoleChat

基于 MiMo API 的 AI 角色扮演桌面应用。支持深度角色扮演、语音克隆朗读、多角色管理。

## 技术栈

| 层 | 技术 |
|---|------|
| 前端 | React 18 + TypeScript + Tailwind CSS |
| 状态管理 | Zustand (persist) |
| 桌面壳 | Electron 28 |
| 构建 | Vite 5 |
| API | MiMo V2.5 系列 (OpenAI 兼容格式) |

## 功能

### 角色扮演

- **CSP 方法论**：AI 自动生成深度角色 System Prompt，包含行为镜片、反应规则、表达DNA、核心矛盾、对话样本
- **多角色管理**：支持同时管理多个角色，左侧列表一键切换，聊天记录独立保存
- **思考过程展示**：可折叠的 reasoning 区域，查看 AI 的"内心独白"
- **开场白**：首次对话自动触发角色设定的 greeting

### 语音克隆 (TTS)

- 调用 MiMo `mimo-v2.5-tts-voiceclone` 模型
- 上传角色语音样本 (wav/mp3)，AI 合成该音色朗读回复
- 支持自动朗读（LLM 回复完成后自动触发）和手动点击朗读
- 暂停/恢复播放控制

### API 配置

- **TokenPlan 模式**：MiMo 预付 credits 账号，`api-key` 认证
- **按量计费模式**：独立开关，完全隔离的 Key/URL/模型
- TTS 可指定沿用 TokenPlan（适合第三方 API 不含语音克隆的场景）
- API Key 和 Base URL 均支持粘贴/复制按钮

### 用户体验

- **流式 SSE 回复**：实时打字效果
- **深色/浅色主题**：一键切换
- **自定义头像和聊天背景**
- **消息复制**：一键复制到剪贴板
- **桌面应用**：Electron 打包为单文件 EXE，不受浏览器 CORS 限制

## 快速开始

```bash
# 安装依赖
npm install

# 开发模式（浏览器）
npm run dev

# 开发模式（Electron）
npm run electron:dev

# 构建 EXE
npm run electron:build
```

## 项目结构

```
src/
├── components/
│   ├── ChatHeader.tsx       # 顶部栏：角色信息、TTS 开关、设置入口
│   ├── ChatInput.tsx        # 输入框：发送消息、自动高度
│   ├── MessageBubble.tsx    # 消息气泡：思考过程、复制、语音播放
│   ├── MessageList.tsx      # 消息列表：自动滚动
│   ├── SettingsPanel.tsx    # 设置面板：API 配置、角色编辑、主题
│   ├── SkillImporter.tsx    # 导入面板：AI 生成角色、文件导入
│   └── SkillSidebar.tsx     # 侧边栏：角色列表、切换
├── services/
│   └── api.ts               # API 调用：LLM 流式、Skill 生成、TTS 语音克隆
├── store/
│   └── chatStore.ts         # Zustand 状态管理 + persist
├── types/
│   └── index.ts             # TypeScript 类型定义
├── App.tsx                  # 根组件
└── main.tsx                 # 入口
electron/
└── main.cjs                 # Electron 主进程
```

## API 认证模式

两种模式均使用 `api-key` Header 认证（MiMo 官方标准）：

```
POST {baseUrl}
Content-Type: application/json
api-key: {your_api_key}
```

- TokenPlan 和按量计费的差异仅在于 API Key 和付费方式
- 不支持 `Authorization: Bearer` 认证
- URL 需填写完整地址（不会自动拼接路径后缀）

## 许可

MIT
