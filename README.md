# 飞云间 (FeiYunJian)

开源免费的桌面 AI 角色扮演聊天应用，基于 Electron + React + TypeScript 构建。

> 仅供学习交流使用

---

## 功能特性

### 角色扮演
- **一键创建角色** — 输入角色名和作品名，自动生成角色设定和人设
- **Skill 系统** — 支持导入 `.md` 角色文件，精细控制角色行为
- **文件夹导入** — 多 md 文件自动整合合并
- **多角色切换** — 左侧边栏随时切换，对话独立不串
- **角色设定持久化** — 退出重进不丢失角色配置

### 语音能力
- **TTS 语音合成** — 角色回复自动朗读，支持自定义音色（需要上传参考音频）
- **ASR 语音识别** — 按住麦克风录音，松开自动识别为文字输入
- **独立 ASR 配置** — 语音识别 API Key / Base URL / 模型可单独设置

### API 配置
- **MiMo (小米)** — 对话 + TTS + 按量计费
- **DeepSeek** — 独立 API Key / Base URL / 模型选择
- **双 provider 解耦** — 切换 provider 不丢失对方配置
- **思考模式** — 支持 DeepSeek 深度思考（think mode）

### 界面
- **深色 / 浅色主题** — 一键切换
- **关于页面** — 版本信息 ver1.5

---

## 快速开始

### 免安装版
直接双击 `FeiYunJian.exe` 运行（无需安装）。

### 安装版
运行 `FeiYunJian-Setup.exe`，自选安装目录，自动创建桌面快捷方式。

---

## 使用指南

### 1. 配置 API
点击右上角齿轮 → 选择 provider（MiMo 或 DeepSeek），填入 API Key、Base URL、模型名称。

### 2. 导入角色
点击左侧 `+` → 输入角色名和作品名 → 点击生成。也可导入已有的 `.md` 角色文件。

### 3. 开始对话
选中角色即可聊天。启用 TTS 后角色会用语音回复，启用 ASR 后按住麦克风按钮说话。

---

## 技术栈

| 层 | 技术 |
|---|---|
| 框架 | Electron |
| 前端 | React + TypeScript |
| 构建 | Vite |
| 状态 | Zustand |
| 样式 | Tailwind CSS |
| 打包 | electron-builder + NSIS |

---

## 构建

```bash
npm install
npx vite build
npx electron-builder --win
```

---

## 许可

本软件仅供个人学习和技术交流使用，请勿用于商业用途。

使用本软件所产生的任何内容，由用户自行负责。
