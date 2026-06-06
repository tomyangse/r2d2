import { useState, useEffect } from 'react';
import { X, Folder, Briefcase, Home, Heart, ShoppingBag, BookOpen, Sparkles } from 'lucide-react';
import { useStore } from '../store/useStore';

const COLOR_THEMES = [
  { name: 'indigo', color: '#5b4dc7', label: '北欧蓝' },
  { name: 'rose', color: '#e05252', label: '绯红' },
  { name: 'emerald', color: '#3dba8c', label: '薄荷绿' },
  { name: 'amber', color: '#e6a817', label: '琥珀黄' },
  { name: 'violet', color: '#8b5cf6', label: '极光紫' },
  { name: 'cyan', color: '#06b6d4', label: '冰晶蓝' }
];

const ICONS = [
  { name: 'Folder', icon: Folder, label: '文件夹' },
  { name: 'Briefcase', icon: Briefcase, label: '工作' },
  { name: 'Home', icon: Home, label: '家庭' },
  { name: 'Heart', icon: Heart, label: '生活' },
  { name: 'ShoppingBag', icon: ShoppingBag, label: '购物' },
  { name: 'BookOpen', icon: BookOpen, label: '学习' },
  { name: 'Sparkles', icon: Sparkles, label: '创意' }
];

export default function ProjectDetailModal({ project = null, defaultDomain = 'personal', onClose }) {
  const { addProject, updateProject } = useStore();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [domain, setDomain] = useState('personal');
  const [colorTheme, setColorTheme] = useState('indigo');
  const [icon, setIcon] = useState('Folder');

  useEffect(() => {
    if (project) {
      setTitle(project.title);
      setDescription(project.description || '');
      setDomain(project.domain);
      setColorTheme(project.color_theme || 'indigo');
      setIcon(project.icon || 'Folder');
    } else {
      setDomain(defaultDomain);
    }
  }, [project, defaultDomain]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    if (project) {
      updateProject(project.id, {
        title: title.trim(),
        description: description.trim(),
        domain,
        color_theme: colorTheme,
        icon
      });
    } else {
      addProject(title.trim(), description.trim(), domain, colorTheme, icon);
    }
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0, 0, 0, 0.4)', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
      <div 
        className="modal-content animate-scale-in" 
        onClick={e => e.stopPropagation()}
        style={{ background: 'var(--bg-secondary)', padding: 'var(--space-lg)', borderRadius: 'var(--radius-xl)', width: '90%', maxWidth: '400px', boxShadow: 'var(--shadow-lg)', border: 'var(--border-subtle)' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
          <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: '600', color: 'var(--text-primary)' }}>
            {project ? '📝 编辑项目' : '🚀 新建项目'}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          <div>
            <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: '500', marginBottom: '4px', color: 'var(--text-secondary)' }}>项目名称</label>
            <input 
              type="text" 
              placeholder="输入项目名称，如：周六露营计划" 
              value={title} 
              onChange={e => setTitle(e.target.value)} 
              required
              className="form-input"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: 'var(--border-subtle)', background: 'var(--bg-primary)', color: 'var(--text-primary)', outline: 'none', fontSize: 'var(--font-size-base)' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: '500', marginBottom: '4px', color: 'var(--text-secondary)' }}>描述 (选填)</label>
            <textarea 
              placeholder="输入项目描述..." 
              value={description} 
              onChange={e => setDescription(e.target.value)}
              className="form-input"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: 'var(--border-subtle)', background: 'var(--bg-primary)', color: 'var(--text-primary)', outline: 'none', resize: 'none', height: '60px', fontSize: 'var(--font-size-base)' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: '500', marginBottom: '6px', color: 'var(--text-secondary)' }}>所属维度</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {[
                { key: 'personal', label: '🏠 个人' },
                { key: 'family', label: '👨‍👩‍👧‍👦 家庭' },
                { key: 'work', label: '💼 工作' }
              ].map(d => (
                <button
                  key={d.key}
                  type="button"
                  onClick={() => setDomain(d.key)}
                  style={{ 
                    flex: 1, 
                    padding: '8px', 
                    borderRadius: 'var(--radius-sm)', 
                    border: 'var(--border-subtle)',
                    background: domain === d.key ? 'var(--accent-primary-soft)' : 'var(--bg-primary)',
                    color: domain === d.key ? 'var(--accent-primary)' : 'var(--text-secondary)',
                    fontWeight: domain === d.key ? '600' : '400',
                    cursor: 'pointer',
                    fontSize: 'var(--font-size-sm)',
                    transition: 'all 0.2s'
                  }}
                >
                  {d.label.split(' ')[1]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: '500', marginBottom: '6px', color: 'var(--text-secondary)' }}>主题颜色</label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {COLOR_THEMES.map(theme => (
                <button
                  key={theme.name}
                  type="button"
                  onClick={() => setColorTheme(theme.name)}
                  title={theme.label}
                  style={{ 
                    width: '32px', 
                    height: '32px', 
                    borderRadius: '50%', 
                    background: theme.color,
                    border: colorTheme === theme.name ? '3px solid var(--text-primary)' : 'none',
                    cursor: 'pointer',
                    boxShadow: 'var(--shadow-xs)',
                    transform: colorTheme === theme.name ? 'scale(1.1)' : 'scale(1)',
                    transition: 'transform 0.1s ease'
                  }}
                />
              ))}
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: '500', marginBottom: '6px', color: 'var(--text-secondary)' }}>项目图标</label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {ICONS.map(i => {
                const IconComponent = i.icon;
                const isSelected = icon === i.name;
                return (
                  <button
                    key={i.name}
                    type="button"
                    onClick={() => setIcon(i.name)}
                    title={i.label}
                    style={{ 
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '36px',
                      height: '36px',
                      borderRadius: 'var(--radius-sm)',
                      border: 'var(--border-subtle)',
                      background: isSelected ? 'var(--accent-primary-soft)' : 'var(--bg-primary)',
                      color: isSelected ? 'var(--accent-primary)' : 'var(--text-tertiary)',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    <IconComponent size={18} />
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: 'var(--space-sm)' }}>
            <button 
              type="button" 
              onClick={onClose} 
              className="btn-secondary"
              style={{ flex: 1, padding: '10px', borderRadius: 'var(--radius-sm)', border: 'var(--border-subtle)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 'var(--font-size-base)' }}
            >
              取消
            </button>
            <button 
              type="submit" 
              className="btn-primary"
              style={{ flex: 1, padding: '10px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--accent-primary)', color: '#fff', fontWeight: '500', cursor: 'pointer', fontSize: 'var(--font-size-base)', boxShadow: 'var(--shadow-sm)' }}
            >
              保存
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
