import { useState, useEffect } from 'react';
import { X, Calendar, Flag, FolderDot } from 'lucide-react';
import { useStore } from '../store/useStore';

export default function TaskDetailModal({ task = null, defaultDomain = 'personal', defaultProjectId = null, onClose }) {
  const { addTask, updateTask, projects } = useStore();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [domain, setDomain] = useState('personal');
  const [projectId, setProjectId] = useState('');
  const [priority, setPriority] = useState('medium');
  const [dueDate, setDueDate] = useState('');

  // Filter projects by current domain
  const domainProjects = projects.filter(p => p.domain === domain);

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description || '');
      setDomain(task.domain);
      setProjectId(task.project_id || '');
      setPriority(task.priority || 'medium');
      setDueDate(task.due_date ? task.due_date.slice(0, 16) : '');
    } else {
      setDomain(defaultDomain);
      setProjectId(defaultProjectId || '');
    }
  }, [task, defaultDomain, defaultProjectId]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    const formattedDueDate = dueDate ? new Date(dueDate).toISOString() : null;
    const finalProjectId = projectId ? projectId : null;

    if (task) {
      updateTask(task.id, {
        title: title.trim(),
        description: description.trim(),
        domain,
        project_id: finalProjectId,
        priority,
        due_date: formattedDueDate
      });
    } else {
      addTask(title.trim(), description.trim(), domain, finalProjectId, priority, formattedDueDate);
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
            {task ? '📝 编辑任务' : '🎯 新建任务'}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          <div>
            <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: '500', marginBottom: '4px', color: 'var(--text-secondary)' }}>任务标题</label>
            <input 
              type="text" 
              placeholder="输入任务名称，如：购买露营烤架" 
              value={title} 
              onChange={e => setTitle(e.target.value)} 
              required
              style={{ width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: 'var(--border-subtle)', background: 'var(--bg-primary)', color: 'var(--text-primary)', outline: 'none', fontSize: 'var(--font-size-base)' }}
            />
          </div>

          {task && (
            <>
              <div>
                <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: '500', marginBottom: '4px', color: 'var(--text-secondary)' }}>任务描述 (选填)</label>
                <textarea 
                  placeholder="添加具体的步骤或备注信息..." 
                  value={description} 
                  onChange={e => setDescription(e.target.value)}
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
                      onClick={() => {
                        setDomain(d.key);
                        setProjectId(''); // Clear project when switching domain
                      }}
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
                <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: '500', marginBottom: '4px', color: 'var(--text-secondary)' }}>归属项目</label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <FolderDot size={16} style={{ position: 'absolute', left: '12px', color: 'var(--text-tertiary)' }} />
                  <select
                    value={projectId}
                    onChange={e => setProjectId(e.target.value)}
                    style={{ 
                      width: '100%', 
                      padding: '10px 12px 10px 36px', 
                      borderRadius: 'var(--radius-sm)', 
                      border: 'var(--border-subtle)', 
                      background: 'var(--bg-primary)', 
                      color: 'var(--text-primary)', 
                      outline: 'none', 
                      fontSize: 'var(--font-size-base)',
                      appearance: 'none'
                    }}
                  >
                    <option value="">（不属于任何项目 - 独立任务）</option>
                    {domainProjects.map(p => (
                      <option key={p.id} value={p.id}>{p.title}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: '500', marginBottom: '4px', color: 'var(--text-secondary)' }}>优先级</label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <Flag size={14} style={{ position: 'absolute', left: '12px', color: priority === 'high' ? 'var(--accent-danger)' : priority === 'medium' ? 'var(--accent-warning)' : 'var(--text-tertiary)' }} />
                    <select
                      value={priority}
                      onChange={e => setPriority(e.target.value)}
                      style={{ 
                        width: '100%', 
                        padding: '8px 10px 8px 32px', 
                        borderRadius: 'var(--radius-sm)', 
                        border: 'var(--border-subtle)', 
                        background: 'var(--bg-primary)', 
                        color: 'var(--text-primary)', 
                        outline: 'none', 
                        fontSize: 'var(--font-size-sm)',
                        appearance: 'none'
                      }}
                    >
                      <option value="low">低优先级 ⚪</option>
                      <option value="medium">中优先级 🟡</option>
                      <option value="high">高优先级 🔴</option>
                    </select>
                  </div>
                </div>

                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: '500', marginBottom: '4px', color: 'var(--text-secondary)' }}>截止日期 (选填)</label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <Calendar size={14} style={{ position: 'absolute', left: '12px', color: 'var(--text-tertiary)' }} />
                    <input 
                      type="datetime-local" 
                      value={dueDate} 
                      onChange={e => setDueDate(e.target.value)} 
                      style={{ 
                        width: '100%', 
                        padding: '8px 8px 8px 32px', 
                        borderRadius: 'var(--radius-sm)', 
                        border: 'var(--border-subtle)', 
                        background: 'var(--bg-primary)', 
                        color: 'var(--text-primary)', 
                        outline: 'none', 
                        fontSize: 'var(--font-size-sm)',
                        minHeight: '34px'
                      }}
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          <div style={{ display: 'flex', gap: '10px', marginTop: 'var(--space-sm)' }}>
            <button 
              type="button" 
              onClick={onClose} 
              style={{ flex: 1, padding: '10px', borderRadius: 'var(--radius-sm)', border: 'var(--border-subtle)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 'var(--font-size-base)' }}
            >
              取消
            </button>
            <button 
              type="submit" 
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
