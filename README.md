# RoleChat

基于 MiMo API 的角色扮演桌面应用。

## 特色功能

**CSP 一键蒸馏角色 Skill** · **语音克隆朗读** · **多角色管理** · **流式回复** · **深色/浅色主题** · **桌面 EXE 单文件**

---

## 快速开始

```bash
npm install
npm run dev              # 浏览器开发
npm run electron:dev     # Electron 开发
npm run electron:build   # 构建 EXE
```

## 功能详情

### 角色扮演

- **CSP 方法论**：一键生成深度 System Prompt（行为镜片、反应规则、表达DNA、核心矛盾、对话样本）
- **多角色管理**：左侧列表一键切换，聊天记录独立保存
- **思考过程**：可折叠的 reasoning 区域，查看"内心独白"
- **开场白**：首次对话自动触发角色 greeting

### 语音克隆 (TTS)

- 调用 MiMo `mimo-v2.5-tts-voiceclone`，上传声音样本即可复刻音色
- 支持自动朗读（LLM 回复后自动触发）和手动播放
- 暂停/恢复控制

### API 配置

- **TokenPlan**：MiMo 预付 credits，`api-key` 认证
- **按量计费**：独立开关，Key/URL/模型完全隔离
- TTS 可指定沿用 TokenPlan（适合第三方 API 不含语音克隆）
- Key 和 URL 均支持粘贴/复制

### 其他

- 流式 SSE 实时打字效果
- 深色/浅色主题一键切换
- 自定义头像和聊天背景
- Electron 打包，不受 CORS 限制

## API 认证

```
POST {baseUrl}
Content-Type: application/json
api-key: {your_api_key}
```

- TokenPlan 和按量计费均使用 `api-key` Header
- URL 需填写完整地址，不会自动拼接路径

## 项目结构

```
src/
├── components/       # 7 个组件（ChatHeader/Input/Message 等）
├── services/api.ts   # LLM 流式、Skill 生成、TTS
├── store/            # Zustand + persist
├── types/            # TypeScript 类型
├── App.tsx
└── main.tsx
electron/
└── main.cjs          # Electron 主进程
```

## 技术栈

React 18 · TypeScript · Zustand · Tailwind CSS · Vite 5 · Electron 28 · MiMo V2.5

## 许可

MIT
