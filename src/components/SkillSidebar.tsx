import { useChatStore } from '../store/chatStore';

interface Props {
  onImportClick: () => void;
}

export default function SkillSidebar({ onImportClick }: Props) {
  const { skills, activeSkillId, skillChats, setActiveSkill, removeSkill, theme } =
    useChatStore();

  const getLastMsg = (skillId: string) => {
    const msgs = skillChats[skillId] || [];
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].content?.trim()) {
        const c = msgs[i].content;
        return c.length > 25 ? c.slice(0, 25) + '…' : c;
      }
    }
    return null;
  };

  const getLastTime = (skillId: string) => {
    const msgs = skillChats[skillId] || [];
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].timestamp) {
        return formatTime(msgs[i].timestamp);
      }
    }
    return null;
  };

  return (
    <div className={`skill-sidebar ${theme === 'dark' ? 'skill-sidebar-dark' : ''}`}>
      {/* 搜索 + 添加 */}
      <div className="sidebar-header">
        <span className="sidebar-title">聊天</span>
        <button className="sidebar-add-btn" onClick={onImportClick} title="导入角色">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <line x1="19" y1="8" x2="19" y2="14" />
            <line x1="22" y1="11" x2="16" y2="11" />
          </svg>
        </button>
      </div>

      {/* 角色列表 */}
      <div className="sidebar-list">
        {skills.length === 0 ? (
          <div className="sidebar-empty">
            <div style={{ fontSize: '32px', opacity: 0.4 }}>💬</div>
            <div style={{ fontSize: '13px', color: '#999', marginTop: '8px' }}>
              还没有角色
            </div>
            <div style={{ fontSize: '12px', color: '#bbb' }}>
              点击 + 导入
            </div>
          </div>
        ) : (
          skills.map((skill) => {
            const isActive = skill.id === activeSkillId;
            const lastMsg = getLastMsg(skill.id);
            const lastTime = getLastTime(skill.id);
            return (
              <div
                key={skill.id}
                className={`sidebar-item ${isActive ? 'sidebar-item-active' : ''}`}
                onClick={() => setActiveSkill(skill.id)}
              >
                {skill.avatarDataUrl ? (
                  <img src={skill.avatarDataUrl} alt="" className="sidebar-avatar" />
                ) : (
                  <div className="sidebar-avatar sidebar-avatar-placeholder">
                    {skill.config.name.charAt(0)}
                  </div>
                )}
                <div className="sidebar-item-info">
                  <div className="sidebar-item-top">
                    <span className="sidebar-item-name">{skill.config.name}</span>
                    {lastTime && <span className="sidebar-item-time">{lastTime}</span>}
                  </div>
                  <div className="sidebar-item-preview">
                    {lastMsg || skill.config.greeting || '点击开始聊天'}
                  </div>
                </div>

                {/* 删除按钮（hover 显示） */}
                <button
                  className="sidebar-item-del"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeSkill(skill.id);
                  }}
                  title="移除角色"
                >
                  ✕
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const isToday =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();

  if (isToday) {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
