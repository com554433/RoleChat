import { memo, useRef, useState, useEffect } from 'react';
import { useChatStore } from '../store/chatStore';
import { generateSkill } from '../services/api';
import type { RoleConfig, SkillImport } from '../types';

interface Props {
  onClose: () => void;
}

async function parseSkillFromFiles(files: FileList): Promise<SkillImport | null> {
  let folderName = '';
  const firstPath = files[0]?.webkitRelativePath || '';
  const parts = firstPath.split('/');
  folderName = parts[0] || 'unknown';

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
    throw new Error('角色文件夹：未找到 config.json 或 .md 文件');
  }

  const text = await configFile.text();
  const isMd = configFile.name.toLowerCase().endsWith('.md');
  let config: RoleConfig;

  if (isMd) {
    config = parseMarkdownSkill(text, folderName);
  } else {
    config = JSON.parse(text);
    if (!config.name || !config.system_prompt) {
      throw new Error('config.json 必须包含 name 和 system_prompt');
    }
  }

  let avatarDataUrl: string | undefined;
  if (avatarFile) {
    avatarDataUrl = await readFileAsDataUrl(avatarFile);
  }

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

function parseMarkdownSkill(text: string, fallbackName: string): RoleConfig {
  const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*(?:\n([\s\S]*))?$/;
  const match = text.match(frontmatterRegex);

  let name = fallbackName;
  let system_prompt = '';
  let voice_style = '';
  let greeting = '';

  if (match) {
    const yamlBlock = match[1];
    system_prompt = (match[2] || '').trim();

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
          name = value;
          break;
        case 'system_prompt':
        case 'system':
        case 'prompt':
          if (!system_prompt) system_prompt = value;
          break;
        case 'voice_style':
          voice_style = value;
          break;
        case 'greeting':
          greeting = value;
          break;
      }
    }
  } else {
    const lines = text.trim().split('\n');
    const firstLine = lines[0].trim();
    if (firstLine.startsWith('# ')) {
      name = firstLine.replace(/^#+\s*/, '').trim();
    } else if (firstLine.length <= 30 && !firstLine.includes('.') && !firstLine.includes(',')) {
      name = firstLine;
      system_prompt = lines.slice(1).join('\n').trim();
    } else {
      system_prompt = text.trim();
    }
  }

  if (!system_prompt && !match) {
    system_prompt = text.trim();
  }

  return {
    name: name || fallbackName,
    system_prompt: system_prompt || text.trim(),
    voice_style: voice_style || undefined,
    greeting: greeting || undefined,
  };
}

export default memo(function SkillImporter({ onClose }: Props) {
  const addSkill = useChatStore((s) => s.addSkill);
  const skills = useChatStore((s) => s.skills);
  const apiSettings = useChatStore((s) => s.apiSettings);
  const nonTokenPlan = useChatStore((s) => s.nonTokenPlan);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const configInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [statusText, setStatusText] = useState('');

  const [characterName, setCharacterName] = useState('');
  const [workName, setWorkName] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generatedText, setGeneratedText] = useState('');
  const [generatedConfig, setGeneratedConfig] = useState<RoleConfig | null>(null);
  const [genError, setGenError] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const previewRef = useRef<HTMLPreElement | null>(null);

  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  useEffect(() => {
    if (generatedText && previewRef.current) {
      previewRef.current.scrollTop = previewRef.current.scrollHeight;
    }
  }, [generatedText]);

  const handleAIGenerate = async () => {
    if (!characterName.trim() || !workName.trim()) {
      setGenError('请填写角色名和作品名');
      return;
    }
    setGenError('');
    setGeneratedText('');
    setGeneratedConfig(null);
    setGenerating(true);

    const abort = new AbortController();
    abortRef.current = abort;

    try {
      const config = await generateSkill(
        characterName.trim(),
        workName.trim(),
        apiSettings,
        nonTokenPlan,
        (chunk) => setGeneratedText((p) => p + chunk),
        abort.signal,
      );
      setGeneratedConfig(config);
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        setGenError('已取消');
      } else {
        setGenError((err as Error).message || '生成失败');
      }
    } finally {
      setGenerating(false);
      abortRef.current = null;
    }
  };

  const handleAICancel = () => {
    abortRef.current?.abort();
  };

  const handleAIImport = () => {
    if (!generatedConfig) return;
    const skill: SkillImport = {
      id: Date.now().toString(),
      folderName: generatedConfig.name,
      config: generatedConfig,
    };
    addSkill(skill);
    setStatusText('已导入：' + generatedConfig.name);
    setGeneratedConfig(null);
    setGeneratedText('');
    setTimeout(() => onClose(), 500);
  };

  const handleFolderSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setImporting(true);
    setStatusText('正在解析角色文件夹...');

    try {
      const skill = await parseSkillFromFiles(files);
      if (skill) {
        addSkill(skill);
        setStatusText('已导入：' + skill.config.name);
        setTimeout(() => onClose(), 800);
      }
    } catch (err) {
      setStatusText('导入失败：' + (err instanceof Error ? err.message : '未知错误'));
    } finally {
      setImporting(false);
    }
  };

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
          throw new Error('JSON 必须包含 name 和 system_prompt');
        }
      }

      const skill: SkillImport = {
        id: Date.now().toString(),
        folderName: file.webkitRelativePath?.split('/')[0] || file.name.replace(/\.[^.]+$/, ''),
        config,
      };

      addSkill(skill);
      setStatusText('已导入：' + config.name);
      setTimeout(() => onClose(), 800);
    } catch (err) {
      setStatusText('导入失败：' + (err instanceof Error ? err.message : '未知错误'));
    } finally {
      setImporting(false);
    }
  };

  const handleCreateDefault = () => {
    const defaultSkill: SkillImport = {
      id: Date.now().toString(),
      folderName: '自定义',
      config: {
        name: '我的角色',
        system_prompt: '你是一个友善的AI助手。',
        greeting: '你好！很高兴认识你。',
      },
    };
    addSkill(defaultSkill);
    setStatusText('默认角色已创建');
    setTimeout(() => onClose(), 500);
  };

  return (
    <>
      <div className="panel-overlay" onClick={onClose} />
      <div className="slide-panel">
        <div className="panel-header">
          <span>导入角色</span>
          <button className="close-btn" onClick={onClose}>X</button>
        </div>
        <div className="panel-body">
          {skills.length > 0 && (
            <div className="setting-group">
              <h3 style={{ fontSize: '15px', fontWeight: 500, marginBottom: '8px' }}>
                已加载 ({skills.length})
              </h3>
              {skills.map((skill) => (
                <div key={skill.id} className="skill-card" style={{ background: '#e8f8ee', cursor: 'default' }}>
                  {skill.avatarDataUrl ? (
                    <img src={skill.avatarDataUrl} alt="" className="skill-avatar" />
                  ) : (
                    <div className="skill-avatar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 600 }}>
                      {skill.config.name.charAt(0)}
                    </div>
                  )}
                  <div>
                    <div className="skill-name">{skill.config.name}</div>
                    <div className="skill-meta">
                      {skill.voiceSampleDataUrl ? '有语音' : '无语音'} · {skill.avatarDataUrl ? '有头像' : '无头像'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {statusText && (
            <div className="animate-slide-up" style={{ padding: '10px 14px', background: statusText.includes('失败') ? '#fff2f0' : '#f0fdf5', borderRadius: '8px', fontSize: '13px', color: statusText.includes('失败') ? '#ff4d4f' : '#333', marginBottom: '12px' }}>
              {statusText}
            </div>
          )}

          <div className="divider" />

          <div className="setting-group">
            <h3 style={{ fontSize: '15px', fontWeight: 500, marginBottom: '12px' }}>导入方式</h3>

            <div style={{ marginBottom: '12px' }}>
              <div className="setting-label">方式一：选择角色文件夹</div>
              <button style={{ width: '100%', padding: '12px', border: '1px solid #07c160', borderRadius: '8px', background: '#f0fdf5', color: '#07c160', cursor: 'pointer', fontSize: '14px', fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                onClick={() => folderInputRef.current?.click()}
                disabled={importing}>
                选择文件夹
              </button>
              <input ref={folderInputRef} type="file" {...{ webkitdirectory: '' } as any} directory="" multiple style={{ display: 'none' }} onChange={handleFolderSelect} />
            </div>

            <div style={{ marginBottom: '12px' }}>
              <div className="setting-label">方式二：导入配置文件 (.json/.md)</div>
              <button style={{ width: '100%', padding: '12px', border: '1px solid #1485ee', borderRadius: '8px', background: '#f0f7ff', color: '#1485ee', cursor: 'pointer', fontSize: '14px', fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                onClick={() => configInputRef.current?.click()}
                disabled={importing}>
                选择配置文件
              </button>
              <input ref={configInputRef} type="file" accept=".json,.md" style={{ display: 'none' }} onChange={handleConfigSelect} />
            </div>

            <div>
              <div className="setting-label">方式三：创建默认角色</div>
              <button style={{ width: '100%', padding: '12px', border: '1px solid #e0e0e0', borderRadius: '8px', background: '#fff', color: '#333', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                onClick={handleCreateDefault}
                disabled={importing}>
                创建
              </button>
            </div>

            <div style={{ marginTop: '24px' }}>
              <div className="setting-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ display: 'inline-flex', width: '22px', height: '22px', borderRadius: '50%', background: '#667eea', color: '#fff', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}>AI</span>
                方式四：一键生成
              </div>
              <div style={{ fontSize: '12px', color: '#999', margin: '4px 0 10px' }}>
                输入角色名 + 作品名，一键生成角色
              </div>

              <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                <input className="setting-input" style={{ flex: 1 }} placeholder="角色名" value={characterName}
                  onChange={(e) => { setCharacterName(e.target.value); setGenError(''); }} disabled={generating} />
                <input className="setting-input" style={{ flex: 1 }} placeholder="作品名" value={workName}
                  onChange={(e) => { setWorkName(e.target.value); setGenError(''); }} disabled={generating} />
              </div>

              {genError && (
                <div className="animate-shake" style={{ padding: '8px 12px', background: '#fff0f0', border: '1px solid #ffcccc', borderRadius: '6px', color: '#cc3333', fontSize: '13px', marginBottom: '10px' }}>
                  {genError}
                </div>
              )}

              {generatedText && !generatedConfig && (
                <div className="animate-fade-in" style={{ background: '#f8f9fa', border: '1px solid #e8e8e8', borderRadius: '8px', marginBottom: '10px', overflow: 'hidden' }}>
                  <div style={{ padding: '4px 10px', background: '#eee', fontSize: '11px', color: '#888' }}>预览</div>
                  <pre ref={previewRef} style={{ padding: '10px', margin: 0, fontSize: '12px', lineHeight: 1.6, color: '#444', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: '260px', overflowY: 'auto' }}>{generatedText}</pre>
                </div>
              )}

              {generatedConfig && (
                <div className="animate-fade-in" style={{ padding: '10px', background: '#f0faf0', border: '1px solid #cceecc', borderRadius: '8px', marginBottom: '10px' }}>
                  <div style={{ fontSize: '14px', color: '#333', marginBottom: '6px' }}>
                    <strong>{generatedConfig.name}</strong>
                    {generatedConfig.voice_style && <span style={{ marginLeft: '8px', padding: '2px 8px', background: '#e8f0ff', borderRadius: '4px', fontSize: '11px', color: '#667eea' }}>{generatedConfig.voice_style}</span>}
                  </div>
                  {generatedConfig.greeting && <div style={{ fontSize: '12px', color: '#666', lineHeight: 1.5 }}>{generatedConfig.greeting}</div>}
                  <div style={{ fontSize: '11px', color: '#999', marginTop: '4px' }}>提示词 {(generatedConfig.system_prompt || '').length} 字</div>
                </div>
              )}

              {!generating && !generatedConfig && (
                <button className="skill-gen-btn" style={{ width: '100%', padding: '10px', border: 'none', borderRadius: '8px', background: 'linear-gradient(135deg, #667eea, #764ba2)', color: '#fff', cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}
                  onClick={handleAIGenerate}>
                  一键生成
                </button>
              )}

              {generating && (
                <button className="skill-gen-btn animate-pulse-glow" style={{ width: '100%', padding: '10px', border: 'none', borderRadius: '8px', background: '#ff4757', color: '#fff', cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}
                  onClick={handleAICancel}>
                  取消
                </button>
              )}

              {generatedConfig && !generating && (
                <button style={{ width: '100%', padding: '10px', border: 'none', borderRadius: '8px', background: '#07c160', color: '#fff', cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}
                  onClick={handleAIImport}>
                  导入
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
});