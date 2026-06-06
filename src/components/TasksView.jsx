import { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Folder, Briefcase, Home, Heart, ShoppingBag, BookOpen, Sparkles,
  Plus, MoreVertical, Pencil, Trash2, CheckCircle2, Circle, Play,
  ChevronRight, Calendar, X
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { format, isToday, isTomorrow, parseISO } from 'date-fns';
import ProjectDetailModal from './ProjectDetailModal';
import TaskDetailModal from './TaskDetailModal';

const ICON_MAP = {
  Folder,
  Briefcase,
  Home,
  Heart,
  ShoppingBag,
  BookOpen,
  Sparkles
};

export default function TasksView() {
  const { 
    projects = [], 
    tasks = [], 
    taskActiveDomain, 
    setTaskActiveDomain, 
    toggleTaskStatus,
    deleteTask,
    deleteProject,
    addProject,
    addTask
  } = useStore();

  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [editingTask, setEditingTask] = useState(null);
  const [activeProjMenu, setActiveProjMenu] = useState(null);
  const [activeTaskMenu, setActiveTaskMenu] = useState(null);

  const [expandedIds, setExpandedIds] = useState(new Set());
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState('task'); // 'task' | 'project'
  const [childInputs, setChildInputs] = useState({});

  const projMenuRef = useRef(null);
  const taskMenuRef = useRef(null);

  // Close menus on click outside
  useEffect(() => {
    const handler = (e) => {
      if (projMenuRef.current && !projMenuRef.current.contains(e.target)) {
        setActiveProjMenu(null);
      }
      if (taskMenuRef.current && !taskMenuRef.current.contains(e.target)) {
        setActiveTaskMenu(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggleExpand = (id) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const isExpanded = (id) => expandedIds.has(id);

  // Filter projects by domain (personal tab merges both personal & family)
  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      if (taskActiveDomain === 'personal') {
        return p.domain === 'personal' || p.domain === 'family';
      }
      return p.domain === 'work';
    });
  }, [projects, taskActiveDomain]);

  // Filter independent Level 1 tasks by domain
  const activeIndependentTasks = useMemo(() => {
    return tasks.filter(t => {
      const matchDomain = taskActiveDomain === 'personal'
        ? (t.domain === 'personal' || t.domain === 'family')
        : t.domain === 'work';
      return matchDomain && !t.project_id && !t.parent_id;
    });
  }, [tasks, taskActiveDomain]);

  // Project progress statistics
  const projectStats = useMemo(() => {
    const stats = {};
    projects.forEach(p => {
      const pTasks = tasks.filter(t => t.project_id === p.id);
      const total = pTasks.length;
      const completed = pTasks.filter(t => t.status === 'completed').length;
      stats[p.id] = {
        total,
        completed,
        percent: total > 0 ? Math.round((completed / total) * 100) : 0
      };
    });
    return stats;
  }, [projects, tasks]);

  const handleEditProject = (proj, e) => {
    e.stopPropagation();
    setEditingProject(proj);
    setProjectModalOpen(true);
    setActiveProjMenu(null);
  };

  const handleDeleteProject = (projId, e) => {
    e.stopPropagation();
    if (confirm('确认删除此项目？项目下的所有任务都将被删除。')) {
      deleteProject(projId);
      if (selectedProjectId === projId) {
        setSelectedProjectId(null);
      }
    }
    setActiveProjMenu(null);
  };

  const handleEditTask = (task, e) => {
    e.stopPropagation();
    setEditingTask(task);
    setTaskModalOpen(true);
    setActiveTaskMenu(null);
  };

  const handleDeleteTask = (taskId, e) => {
    e.stopPropagation();
    if (confirm('确认删除此任务？')) {
      deleteTask(taskId);
    }
    setActiveTaskMenu(null);
  };

  // Helper to format task due dates
  const getTaskDueDateLabel = (dateStr) => {
    if (!dateStr) return null;
    const date = parseISO(dateStr);
    if (isToday(date)) return '今天截止';
    if (isTomorrow(date)) return '明天截止';
    return format(date, 'M月d日 HH:mm');
  };

  const handleTopLevelSubmit = (e) => {
    e.preventDefault();
    const val = newTitle.trim();
    if (!val) return;
    
    const domain = taskActiveDomain === 'work' ? 'work' : 'personal';
    
    if (newType === 'project') {
      addProject(val, null, domain, 'indigo', 'Folder');
    } else {
      addTask(val, null, domain, null, 'medium', null, null);
    }
    setNewTitle('');
  };

  const renderInlineAddInput = (parentId, isProject) => {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const val = childInputs[parentId]?.trim();
          if (!val) return;
          
          const domain = taskActiveDomain === 'work' ? 'work' : 'personal';
          
          if (isProject) {
            addTask(val, null, domain, parentId, 'medium', null, null);
          } else {
            const parentTask = tasks.find(t => t.id === parentId);
            const projId = parentTask ? parentTask.project_id : null;
            addTask(val, null, domain, projId, 'medium', null, parentId);
          }
          
          setChildInputs(prev => ({ ...prev, [parentId]: '' }));
        }}
        style={{ display: 'flex', width: '100%', marginTop: '4px' }}
      >
        <input
          type="text"
          className="form-input"
          style={{
            flex: 1,
            fontSize: '11px',
            padding: '6px 10px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--bg-tertiary)',
            background: 'var(--bg-hover)'
          }}
          placeholder={isProject ? "＋ 添加子任务..." : "＋ 添加下一级子任务..."}
          value={childInputs[parentId] || ''}
          onChange={(e) => setChildInputs(prev => ({ ...prev, [parentId]: e.target.value }))}
        />
      </form>
    );
  };

  const renderTaskNode = (t, depth = 0) => {
    const childTasks = tasks.filter(child => child.parent_id === t.id);
    const expanded = isExpanded(t.id);
    const hasChildren = childTasks.length > 0;
    
    const StatusIcon = t.status === 'completed' 
      ? CheckCircle2 
      : t.status === 'in_progress' 
        ? Play 
        : Circle;

    const statusColor = t.status === 'completed' 
      ? 'var(--accent-success)' 
      : t.status === 'in_progress' 
        ? 'var(--accent-warning)' 
        : 'var(--text-muted)';

    const isOverdue = t.due_date && new Date(t.due_date) < new Date() && t.status !== 'completed';
    const dateLabel = getTaskDueDateLabel(t.due_date);

    return (
      <div key={t.id} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {/* Task Row */}
        <div
          className={`task-card ${t.status === 'completed' ? 'task-card--completed' : ''}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 12px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-card)',
            borderLeft: `3px solid var(--priority-${t.priority}, ${t.priority === 'high' ? '#e05252' : t.priority === 'medium' ? '#e6a817' : '#c0c0d0'})`,
            border: 'var(--border-subtle)',
            boxShadow: 'var(--shadow-xs)',
            transition: 'all 0.2s ease',
            cursor: 'pointer'
          }}
          onClick={() => toggleExpand(t.id)}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
            {/* Status Button */}
            <button
              onClick={(e) => { e.stopPropagation(); toggleTaskStatus(t.id); }}
              style={{
                background: 'none',
                border: 'none',
                color: statusColor,
                cursor: 'pointer',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                flexShrink: 0
              }}
            >
              <StatusIcon size={16} />
            </button>

            {/* Title & Details */}
            <div style={{ minWidth: 0, flex: 1, display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span
                style={{
                  fontSize: 'var(--font-size-sm)',
                  fontWeight: '500',
                  color: 'var(--text-primary)',
                  textDecoration: t.status === 'completed' ? 'line-through' : 'none',
                  opacity: t.status === 'completed' ? 0.6 : 1,
                  wordBreak: 'break-all'
                }}
              >
                {t.title}
              </span>
              {t.description && (
                <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '150px' }}>
                  ({t.description})
                </span>
              )}
              {dateLabel && (
                <span 
                  style={{ 
                    fontSize: '9px', 
                    color: isOverdue ? 'var(--accent-danger)' : 'var(--text-secondary)',
                    background: isOverdue ? 'var(--accent-danger-soft)' : 'var(--bg-tertiary)',
                    padding: '1px 6px',
                    borderRadius: '4px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '2px',
                    fontWeight: '600'
                  }}
                >
                  <Calendar size={10} />
                  {dateLabel}
                </span>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }} onClick={e => e.stopPropagation()}>
            {/* Menu */}
            <div ref={activeTaskMenu === t.id ? taskMenuRef : null} style={{ position: 'relative' }}>
              <button
                onClick={() => setActiveTaskMenu(activeTaskMenu === t.id ? null : t.id)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', padding: '4px' }}
              >
                <MoreVertical size={14} />
              </button>
              {activeTaskMenu === t.id && (
                <div className="dropdown-menu" style={{ right: 0, top: '24px' }}>
                  <button className="dropdown-menu__item" onClick={(e) => handleEditTask(t, e)}>
                    <Pencil size={12} />
                    <span>编辑</span>
                  </button>
                  <button className="dropdown-menu__item dropdown-menu__item--danger" onClick={(e) => handleDeleteTask(t.id, e)}>
                    <Trash2 size={12} />
                    <span>删除</span>
                  </button>
                </div>
              )}
            </div>

            <ChevronRight
              size={14}
              style={{
                color: 'var(--text-muted)',
                transform: expanded ? 'rotate(90deg)' : 'none',
                transition: 'transform var(--duration-base)',
                cursor: 'pointer'
              }}
              onClick={() => toggleExpand(t.id)}
            />
          </div>
        </div>

        {/* Level 3 Children under Task */}
        {expanded && (
          <div style={{ marginTop: '2px', display: 'flex', flexDirection: 'column', gap: '4px', borderLeft: '1px dashed var(--bg-tertiary)', marginLeft: '10px', paddingLeft: '10px' }}>
            {childTasks.map(child => {
              const childStatusColor = child.status === 'completed' ? 'var(--accent-success)' : 'var(--text-muted)';
              const ChildStatusIcon = child.status === 'completed' ? CheckCircle2 : Circle;
              
              return (
                <div
                  key={child.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 10px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-hover)',
                    border: 'var(--border-subtle)',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                    <button
                      onClick={() => toggleTaskStatus(child.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: childStatusColor,
                        cursor: 'pointer',
                        padding: 0,
                        display: 'flex',
                        alignItems: 'center'
                      }}
                    >
                      <ChildStatusIcon size={14} />
                    </button>
                    <span
                      style={{
                        fontSize: 'var(--font-size-xs)',
                        fontWeight: '500',
                        color: 'var(--text-primary)',
                        textDecoration: child.status === 'completed' ? 'line-through' : 'none',
                        opacity: child.status === 'completed' ? 0.6 : 1,
                        wordBreak: 'break-all'
                      }}
                    >
                      {child.title}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <button
                      onClick={() => deleteTask(child.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        display: 'flex',
                        padding: '4px'
                      }}
                      title="删除子任务"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              );
            })}
            
            {depth < 2 && renderInlineAddInput(t.id, false)}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="tasks-view animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
      
      {/* 1. Domain Selector Tabs (Merged Personal & Family, Work first) */}
      <div 
        className="domain-tabs-container"
        style={{ 
          background: 'var(--bg-tertiary)', 
          borderRadius: 'var(--radius-pill)', 
          padding: '3px',
          display: 'flex',
          position: 'relative',
          zIndex: 10
        }}
      >
        {[
          { id: 'work', label: '💼 工作事务' },
          { id: 'personal', label: '🏠 个人生活' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => {
              setTaskActiveDomain(tab.id);
              setSelectedProjectId(null);
            }}
            style={{
              flex: 1,
              border: 'none',
              background: taskActiveDomain === tab.id ? 'var(--bg-secondary)' : 'transparent',
              color: taskActiveDomain === tab.id ? 'var(--text-primary)' : 'var(--text-tertiary)',
              padding: '8px 0',
              borderRadius: 'var(--radius-pill)',
              fontWeight: taskActiveDomain === tab.id ? '600' : '500',
              fontSize: 'var(--font-size-sm)',
              cursor: 'pointer',
              boxShadow: taskActiveDomain === tab.id ? 'var(--shadow-tab)' : 'none',
              transition: 'all 0.25s var(--ease-smooth)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 2. Top-level inline add form */}
      <form onSubmit={handleTopLevelSubmit} style={{ display: 'flex', gap: '8px', width: '100%', marginBottom: '4px' }}>
        <div style={{ display: 'flex', background: 'var(--bg-hover)', borderRadius: 'var(--radius-md)', padding: '2px', border: 'var(--border-subtle)', flex: 1, alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => setNewType(newType === 'task' ? 'project' : 'task')}
            style={{
              border: 'none',
              background: 'none',
              padding: '6px 12px',
              color: 'var(--accent-primary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: 'var(--font-size-xs)',
              fontWeight: '600'
            }}
            title="点击切换类型"
          >
            {newType === 'project' ? <Folder size={14} /> : <Circle size={14} />}
            <span>{newType === 'project' ? '项目' : '主任务'}</span>
          </button>
          <div style={{ width: '1px', height: '18px', background: 'var(--bg-tertiary)' }} />
          <input
            type="text"
            className="form-input"
            style={{
              flex: 1,
              border: 'none',
              background: 'none',
              boxShadow: 'none',
              fontSize: 'var(--font-size-sm)',
              padding: '6px 12px'
            }}
            placeholder={newType === 'project' ? "新建主项目名称..." : "新建独立主任务..."}
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
          />
        </div>
        <button
          type="submit"
          style={{
            background: 'var(--accent-primary)',
            color: 'white',
            border: 'none',
            padding: '0 16px',
            borderRadius: 'var(--radius-md)',
            cursor: 'pointer',
            fontSize: 'var(--font-size-sm)',
            fontWeight: '600',
            boxShadow: 'var(--shadow-xs)'
          }}
        >
          添加
        </button>
      </form>

      {/* 3. Tree Hierarchy rendering */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        
        {/* Projects list */}
        {filteredProjects.length > 0 && (
          <div>
            <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: '600', color: 'var(--text-tertiary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              主项目 / 文件夹 ({filteredProjects.length})
            </div>
            {filteredProjects.map(proj => {
              const projTasks = tasks.filter(t => t.project_id === proj.id && !t.parent_id);
              const totalTasks = tasks.filter(t => t.project_id === proj.id).length;
              const completedTasksCount = tasks.filter(t => t.project_id === proj.id && t.status === 'completed').length;
              const percent = totalTasks > 0 ? Math.round((completedTasksCount / totalTasks) * 100) : 0;
              const IconComp = ICON_MAP[proj.icon] || Folder;
              const expanded = isExpanded(proj.id);
              
              return (
                <div key={proj.id} style={{ marginBottom: '12px' }} className={`color-theme-${proj.color_theme}`}>
                  {/* Project Folder Row */}
                  <div
                    style={{
                      background: 'var(--bg-card)',
                      borderRadius: 'var(--radius-lg)',
                      padding: '12px var(--space-md)',
                      border: 'var(--border-subtle)',
                      boxShadow: 'var(--shadow-xs)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      borderLeft: `4px solid var(--accent-primary)`
                    }}
                    onClick={() => toggleExpand(proj.id)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                      <div 
                        style={{ 
                          width: '28px', 
                          height: '28px', 
                          borderRadius: '6px', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          background: 'var(--accent-primary-soft)',
                          color: 'var(--accent-primary)'
                        }}
                      >
                        <IconComp size={16} />
                      </div>
                      <span style={{ fontSize: 'var(--font-size-base)', fontWeight: '600', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {proj.title}
                      </span>
                      <span style={{ fontSize: '9px', fontWeight: '600', color: 'var(--text-secondary)', background: 'var(--bg-tertiary)', padding: '1px 6px', borderRadius: '4px' }}>
                        {percent}% ({completedTasksCount}/{totalTasks})
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={e => e.stopPropagation()}>
                      {/* Project Dropdown Menu */}
                      <div ref={activeProjMenu === proj.id ? projMenuRef : null} style={{ position: 'relative' }}>
                        <button
                          onClick={() => setActiveProjMenu(activeProjMenu === proj.id ? null : proj.id)}
                          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', padding: '4px' }}
                        >
                          <MoreVertical size={14} />
                        </button>
                        {activeProjMenu === proj.id && (
                          <div className="dropdown-menu" style={{ right: 0, top: '24px' }}>
                            <button className="dropdown-menu__item" onClick={(e) => handleEditProject(proj, e)}>
                              <Pencil size={12} />
                              <span>编辑项目</span>
                            </button>
                            <button className="dropdown-menu__item dropdown-menu__item--danger" onClick={(e) => handleDeleteProject(proj.id, e)}>
                              <Trash2 size={12} />
                              <span>删除项目</span>
                            </button>
                          </div>
                        )}
                      </div>

                      <ChevronRight
                        size={16}
                        style={{
                          color: 'var(--text-muted)',
                          transform: expanded ? 'rotate(90deg)' : 'none',
                          transition: 'transform var(--duration-base)',
                          cursor: 'pointer'
                        }}
                        onClick={() => toggleExpand(proj.id)}
                      />
                    </div>
                  </div>

                  {/* Level 2 Tasks under Project */}
                  {expanded && (
                    <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '6px', borderLeft: '1px dashed var(--bg-tertiary)', marginLeft: '14px', paddingLeft: '12px' }}>
                      {projTasks.map(task => renderTaskNode(task, 1))}
                      
                      {/* Add task inline input */}
                      {renderInlineAddInput(proj.id, true)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Independent tasks list */}
        <div>
          <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: '600', color: 'var(--text-tertiary)', marginBottom: '8px', marginTop: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            独立主任务 ({activeIndependentTasks.length})
          </div>
          {activeIndependentTasks.length === 0 ? (
            filteredProjects.length === 0 && (
              <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: 'var(--border-subtle)' }}>
                ☕ 当前分类下暂无任务，输入上方内容开始创建
              </div>
            )
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {activeIndependentTasks.map(task => renderTaskNode(task, 0))}
            </div>
          )}
        </div>

      </div>

      {/* Modals */}
      {projectModalOpen && (
        <ProjectDetailModal 
          project={editingProject} 
          defaultDomain={taskActiveDomain === 'work' ? 'work' : 'personal'}
          onClose={() => { setProjectModalOpen(false); setEditingProject(null); }} 
        />
      )}

      {taskModalOpen && (
        <TaskDetailModal 
          task={editingTask} 
          defaultDomain={taskActiveDomain === 'work' ? 'work' : 'personal'}
          defaultProjectId={selectedProjectId}
          onClose={() => { setTaskModalOpen(false); setEditingTask(null); }} 
        />
      )}
    </div>
  );
}
