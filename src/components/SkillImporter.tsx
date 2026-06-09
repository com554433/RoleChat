import { useRef, useState } from 'react';
import { useChatStore } from '../store/chatStore';
import type { RoleConfig, SkillImport } from '../types';

interface Props {
  onClose: () => void;
}

export default function SkillImporter({ onClose }: Props) {
  const { setCurrentSkill, currentSkill, roleConfig } = useChatStore();
  const folderInputRef = useRef<HTMLInputElement>(null);
  const configInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [statusText, setStatusText] = useState('');

  // ====== 方式1: 选择 skill 文件夹 ======
  const handleFolderSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setImporting(true);
    setStatusText('正在解析 Skill 文件夹...');

    try {
      const skill = await parseSkillFromFiles(files);
      if (skill) {
        setCurrentSkill(skill);
        setStatusText(`成功导入角色: ${skill.config.name}`);
        setTimeout(() => onClose(), 800);
      }
    } catch (err) {
      setStatusText(`导入失败: ${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setImporting(false);
    }
  };

  // ====== 方式2: 选择配置文件 (.json / .md) ======
  const handleConfigSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setStatusText('正在解析配置文件...');

    try {
      const text = await file.text();
      const isMd = file.name.toLowerCase().endsWith('.md');
      let config: RoleConfig;

      if (isMd) {
        config = parseMarkdownSkill(text, file.name.replace(/\.md$/i, ''));
      } else {
        config = JSON.parse(text);
        if (!config.name || !config.system_prompt) {
          throw new Error('JSON 文件必须包含 name 和 system_prompt 字段');
        }
      }

      const skill: SkillImport = {
        id: Date.now().toString(),
        folderName: file.webkitRelativePath?.split('/')[0] || file.name.replace(/\.[^.]+$/, ''),
        config,
      };

      setCurrentSkill(skill);
      setStatusText(`成功导入角色: ${config.name}`);
      setTimeout(() => onClose(), 800);
    } catch (err) {
      setStatusText(`导入失败: ${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setImporting(false);
    }
  };

  // ====== 方式3: 手动创建 ======
  const handleCreateDefault = () => {
    const defaultSkill: SkillImport = {
      id: Date.now().toString(),
      folderName: '自定义角色',
      config: {
        name: '我的角色',
        system_prompt: '你是一个友好的AI助手，请用自然亲切的语气和用户聊天。',
        greeting: '你好！很高兴认识你~',
      },
    };
    setCurrentSkill(defaultSkill);
    setStatusText('已创建默认角色，可在设置中修改');

    // 如果有当前角色，也更新
    setTimeout(() => onClose(), 500);
  };

  return (
    <>
      <div className="panel-overlay" onClick={onClose} />
      <div className="slide-panel">
        <div className="panel-header">
          <span>导入 Skill 角色</span>
          <button className="close-btn" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="panel-body">
          {/* 已加载的角色 */}
          {currentSkill && (
            <div
              className="skill-card"
              style={{ background: '#e8f8ee', cursor: 'default' }}
            >
              {currentSkill.avatarDataUrl ? (
                <img src={currentSkill.avatarDataUrl} alt="" className="skill-avatar" />
              ) : (
                <div
                  className="skill-avatar"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontWeight: 600,
                  }}
                >
                  {currentSkill.config.name.charAt(0)}
                </div>
              )}
              <div>
                <div className="skill-name">{currentSkill.config.name}</div>
                <div className="skill-meta">
                  {currentSkill.voiceSampleDataUrl ? '含语音样本' : '无语音样本'} ·{' '}
                  {currentSkill.avatarDataUrl ? '有头像' : '无头像'}
                </div>
              </div>
            </div>
          )}

          {statusText && (
            <div
              className="animate-slide-up"
              style={{
                padding: '10px 14px',
                background: statusText.includes('失败') ? '#fff2f0' : '#f0fdf5',
                borderRadius: '8px',
                fontSize: '13px',
                color: statusText.includes('失败') ? '#ff4d4f' : '#333',
                marginBottom: '12px',
              }}
            >
              {statusText}
            </div>
          )}

          <div className="divider" />

          {/* Skill 文件夹说明 */}
          <div
            style={{
              padding: '14px',
              background: '#f0fdf5',
              borderRadius: '8px',
              marginBottom: '16px',
              fontSize: '13px',
              color: '#666',
              lineHeight: '1.7',
            }}
          >
            <strong style={{ color: '#333' }}>Skill 文件夹结构说明</strong>
            <div style={{ marginTop: '8px' }}>
              一个 Skill 文件夹应包含以下文件：
            </div>
            <div
              style={{
                background: '#1e1e1e',
                color: '#d4d4d4',
                padding: '10px 14px',
                borderRadius: '6px',
                margin: '8px 0',
                fontSize: '12px',
                fontFamily: 'monospace',
              }}
            >
              <div>my_character/</div>
              <div>  config.md          &larr; 必需: 角色设定 (Markdown)</div>
              <div>  avatar.png         &larr; 可选: 角色头像</div>
              <div>  voice_sample.wav   &larr; 可选: 语音克隆样本</div>
            </div>
            <div style={{ marginTop: '8px' }}>
              <strong>config.md 格式 (Frontmatter):</strong>
            </div>
            <div
              style={{
                background: '#1e1e1e',
                color: '#d4d4d4',
                padding: '10px 14px',
                borderRadius: '6px',
                margin: '8px 0',
                fontSize: '12px',
                fontFamily: 'monospace',
              }}
            >
              <div style={{color:'#888'}}>---</div>
              <div>name: 猫娘小咪</div>
              <div>voice_style: 活泼</div>
              <div>greeting: 主人~你来啦喵！</div>
              <div style={{color:'#888'}}>---</div>
              <div>&nbsp;</div>
              <div>你是小咪，一只可爱的猫娘。</div>
              <div>你活泼开朗，喜欢喵喵叫。</div>
              <div>...</div>
            </div>
            <div style={{ marginTop: '6px', fontSize: '11px', color: '#999' }}>
              也支持纯文本: 第一行=角色名，余下=系统提示词
            </div>
          </div>

          {/* 导入按钮 */}
          <div className="setting-group">
            <h3 style={{ fontSize: '15px', fontWeight: 500, marginBottom: '12px' }}>
              选择导入方式
            </h3>

            {/* 方式1: 选择文件夹 */}
            <div style={{ marginBottom: '12px' }}>
              <div className="setting-label">方式一：选择 Skill 文件夹</div>
              <button
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #07c160',
                  borderRadius: '8px',
                  background: '#f0fdf5',
                  color: '#07c160',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
                onClick={() => folderInputRef.current?.click()}
                disabled={importing}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
                选择 Skill 文件夹
              </button>
              <input
                ref={folderInputRef}
                type="file"
                // @ts-expect-error webkitdirectory is not in React types
                webkitdirectory=""
                directory=""
                multiple
                style={{ display: 'none' }}
                onChange={handleFolderSelect}
              />
            </div>

            {/* 方式2: 选择配置文件 */}
            <div style={{ marginBottom: '12px' }}>
              <div className="setting-label">方式二：仅导入配置文件 (.json / .md)</div>
              <button
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #1485ee',
                  borderRadius: '8px',
                  background: '#f0f7ff',
                  color: '#1485ee',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
                onClick={() => configInputRef.current?.click()}
                disabled={importing}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
                选择配置文件
              </button>
              <input
                ref={configInputRef}
                type="file"
                accept=".json,.md"
                style={{ display: 'none' }}
                onChange={handleConfigSelect}
              />
            </div>

            {/* 方式3: 手动创建 */}
            <div>
              <div className="setting-label">方式三：手动创建默认角色</div>
              <button
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #e0e0e0',
                  borderRadius: '8px',
                  background: '#fff',
                  color: '#333',
                  cursor: 'pointer',
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
                onClick={handleCreateDefault}
                disabled={importing}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                创建默认角色
              </button>
            </div>
          </div>

          <div className="divider" />

          {/* 当前角色信息 */}
          {currentSkill && (
            <div className="setting-group">
              <h3 style={{ fontSize: '15px', fontWeight: 500, marginBottom: '12px' }}>
                当前角色信息
              </h3>
              <div style={{ fontSize: '14px', color: '#666', lineHeight: '1.6' }}>
                <div>
                  <strong>名称:</strong> {currentSkill.config.name}
                </div>
                <div style={{ marginTop: '4px' }}>
                  <strong>Prompt:</strong>{' '}
                  <span style={{ fontSize: '12px' }}>
                    {currentSkill.config.system_prompt.slice(0, 80)}
                    {currentSkill.config.system_prompt.length > 80 ? '...' : ''}
                  </span>
                </div>
                {currentSkill.config.voice_style && (
                  <div style={{ marginTop: '4px' }}>
                    <strong>语音风格:</strong> {currentSkill.config.voice_style}
                  </div>
                )}
                <div style={{ marginTop: '8px', fontSize: '12px', color: '#999' }}>
                  可在 <strong>设置</strong> 中修改角色名称、头像、背景、System Prompt 等
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ====== 解析 Skill 文件夹 ======
async function parseSkillFromFiles(files: FileList): Promise<SkillImport | null> {
  // 先计算文件夹名（取第一个文件所在的目录名）
  let folderName = '';
  const firstPath = files[0]?.webkitRelativePath || '';
  const parts = firstPath.split('/');
  folderName = parts[0] || 'unknown';

  // 分类文件
  let configFile: File | null = null;
  let avatarFile: File | null = null;
  let voiceFile: File | null = null;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const relPath = file.webkitRelativePath || file.name;
    const filename = relPath.split('/').pop()?.toLowerCase() || '';

    if (filename === 'config.json') {
      configFile = file;
    } else if (filename === 'config.md' || filename.endsWith('.md')) {
      // 取第一个 .md 文件作为配置文件（优先级低于 config.json）
      if (!configFile) configFile = file;
    } else if (filename.startsWith('avatar.') || filename === 'avatar.png' || filename === 'avatar.jpg' || filename === 'avatar.jpeg') {
      avatarFile = file;
    } else if (filename.startsWith('voice') && (filename.endsWith('.wav') || filename.endsWith('.mp3') || filename.endsWith('.ogg'))) {
      voiceFile = file;
    } else if (filename.startsWith('voice_sample') && (filename.endsWith('.wav') || filename.endsWith('.mp3') || filename.endsWith('.ogg'))) {
      voiceFile = file;
    }
  }

  if (!configFile) {
    throw new Error('Skill 文件夹中未找到 config.json 或 .md 配置文件');
  }

  // 解析配置文件
  const text = await configFile.text();
  const isMd = configFile.name.toLowerCase().endsWith('.md');
  let config: RoleConfig;

  if (isMd) {
    config = parseMarkdownSkill(text, folderName);
  } else {
    config = JSON.parse(text);
    if (!config.name || !config.system_prompt) {
      throw new Error('config.json 必须包含 name 和 system_prompt 字段');
    }
  }

  // 读取头像
  let avatarDataUrl: string | undefined;
  if (avatarFile) {
    avatarDataUrl = await readFileAsDataUrl(avatarFile);
  }

  // 读取语音样本
  let voiceSampleDataUrl: string | undefined;
  if (voiceFile) {
    voiceSampleDataUrl = await readFileAsDataUrl(voiceFile);
  }

  return {
    id: Date.now().toString(),
    folderName,
    config,
    avatarDataUrl,
    voiceSampleDataUrl,
  };
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ====== 解析 Markdown 格式的 Skill 文件 ======
// 支持两种格式:
// 1. YAML Frontmatter: ---\nname: xxx\n---\n内容为 system_prompt
// 2. 纯文本: 第一行作为名称，其余为 system_prompt
function parseMarkdownSkill(text: string, fallbackName: string): RoleConfig {
  // 更健壮的 frontmatter 正则：兼容末尾无换行、空内容等情况
  const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*(?:\n([\s\S]*))?$/;
  const match = text.match(frontmatterRegex);

  let name = fallbackName;
  let system_prompt = '';
  let voice_style = '';
  let greeting = '';

  if (match) {
    // 有 YAML Frontmatter
    const yamlBlock = match[1];
    system_prompt = (match[2] || '').trim();

    // 简单解析 YAML key: value
    const lines = yamlBlock.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const colonIdx = trimmed.indexOf(':');
      if (colonIdx === -1) continue;

      const key = trimmed.substring(0, colonIdx).trim().toLowerCase();
      const value = trimmed.substring(colonIdx + 1).trim().replace(/^["']|["']$/g, '');

      switch (key) {
        case 'name':
        case '角色名':
        case '角色名称':
          name = value;
          break;
        case 'system_prompt':
        case 'system':
        case 'prompt':
        case '设定':
        case '人设':
        case '角色设定':
          // 如果 body 为空，用这里的值
          if (!system_prompt) system_prompt = value;
          break;
        case 'voice_style':
        case '语音风格':
        case '风格':
          voice_style = value;
          break;
        case 'greeting':
        case '开场白':
        case '招呼':
          greeting = value;
          break;
      }
    }
  } else {
    // 没有 Frontmatter，第一行作为名称，其余为 system_prompt
    const lines = text.trim().split('\n');
    // 尝试检测第一行是否像标题 (# 开头或短行)
    const firstLine = lines[0].trim();
    if (firstLine.startsWith('# ')) {
      name = firstLine.replace(/^#+\s*/, '').trim();
    } else if (firstLine.length <= 30 && !firstLine.includes('。') && !firstLine.includes('，')) {
      // 短行可能是名称
      name = firstLine;
      system_prompt = lines.slice(1).join('\n').trim();
    } else {
      // 整段都是 system_prompt，用文件夹名做角色名
      system_prompt = text.trim();
    }
  }

  // 如果没有显式 system_prompt 就用全部内容
  if (!system_prompt && !match) {
    system_prompt = text.trim();
  }

  const config: RoleConfig = {
    name: name || fallbackName,
    system_prompt: system_prompt || text.trim(),
    voice_style: voice_style || undefined,
    greeting: greeting || undefined,
  };

  console.log('[SkillImporter] 解析结果:', {
    name: config.name,
    system_prompt_len: config.system_prompt.length,
    system_prompt_preview: config.system_prompt.slice(0, 80),
    voice_style: config.voice_style,
    greeting: config.greeting?.slice(0, 50),
  });

  return config;
}
