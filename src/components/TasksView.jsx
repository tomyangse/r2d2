import { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Folder, Briefcase, Home, Heart, ShoppingBag, BookOpen, Sparkles,
  Plus, MoreVertical, Pencil, Trash2, CheckCircle2, Circle, Play,
  ChevronRight, ChevronDown, Calendar, X
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { format, isToday, isTomorrow, parseISO } from 'date-fns';
import ProjectDetailModal from './ProjectDetailModal';
import TaskDetailModal from './TaskDetailModal';

export default function TasksView() {
  const { 
    projects = [], 
    tasks = [], 
    taskActiveDomain, 
    setTaskActiveDomain, 
    toggleTaskStatus,
    deleteTask,
    addTask,
    updateTask
  } = useStore();

  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [activeTaskMenu, setActiveTaskMenu] = useState(null);

  const [expandedIds, setExpandedIds] = useState(new Set());
  const [newTitle, setNewTitle] = useState('');
  const [childInputs, setChildInputs] = useState({});
  const [showArchive, setShowArchive] = useState(false);

  const taskMenuRef = useRef(null);

  // Close menu on click outside
  useEffect(() => {
    const handler = (e) => {
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

  // Filter top-level active tasks (parent_id is null, status is not completed)
  const activeTasks = useMemo(() => {
    return tasks.filter(t => {
      const matchDomain = taskActiveDomain === 'personal'
        ? (t.domain === 'personal' || t.domain === 'family')
        : t.domain === 'work';
      return matchDomain && !t.parent_id && t.status !== 'completed';
    });
  }, [tasks, taskActiveDomain]);

  // Filter completed tasks to show in the archive list.
  // We show a completed task if it is completed, AND either:
  // - It has no parent task (top-level task), OR
  // - Its parent task is NOT completed (active).
  const completedTasks = useMemo(() => {
    return tasks.filter(t => {
      const matchDomain = taskActiveDomain === 'personal'
        ? (t.domain === 'personal' || t.domain === 'family')
        : t.domain === 'work';
      if (!matchDomain || t.status !== 'completed') return false;

      if (t.parent_id) {
        const parent = tasks.find(pt => pt.id === t.parent_id);
        if (parent && parent.status === 'completed') {
          // Parent is also completed, so this child will be shown under its parent in the archive.
          // Don't show it at the top level of the archive.
          return false;
        }
      }
      return true;
    });
  }, [tasks, taskActiveDomain]);

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
    addTask(val, null, domain, null, 'medium', null, null);
    setNewTitle('');
  };

  const renderInlineAddInput = (parentId) => {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const val = childInputs[parentId]?.trim();
          if (!val) return;
          
          const domain = taskActiveDomain === 'work' ? 'work' : 'personal';
          const parentTask = tasks.find(t => t.id === parentId);
          const projId = parentTask ? parentTask.project_id : null;
          
          addTask(val, null, domain, projId, 'medium', null, parentId);
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
          placeholder="＋ 添加子任务..."
          value={childInputs[parentId] || ''}
          onChange={(e) => setChildInputs(prev => ({ ...prev, [parentId]: e.target.value }))}
        />
      </form>
    );
  };

  const renderTaskNode = (t, depth = 0) => {
    // Only show active child tasks when rendering inside the active list
    // (If the current task t is completed, show all children; otherwise only active children)
    const childTasks = tasks.filter(child => {
      if (t.status === 'completed') {
        return child.parent_id === t.id;
      }
      return child.parent_id === t.id && child.status !== 'completed';
    });
    
    const expanded = isExpanded(t.id);
    const hasChildren = childTasks.length > 0;
    const canHaveChildren = depth < 2;
    const hasAnySubtasks = tasks.some(child => child.parent_id === t.id);
    
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
    
    // Resolve project title for tag display
    const project = projects.find(p => p.id === t.project_id);
    const parentTask = t.parent_id ? tasks.find(pt => pt.id === t.parent_id) : null;
    const dateInputId = `date-input-${t.id}`;

    return (
      <div key={t.id} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {/* Task Row */}
        <div
          className={`task-card ${t.status === 'completed' ? 'task-card--completed' : ''}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: depth > 0 ? '6px 10px' : '10px 14px',
            borderRadius: depth > 0 ? 'var(--radius-sm)' : 'var(--radius-md)',
            background: depth > 0 ? 'var(--bg-hover)' : 'var(--bg-card)',
            borderLeft: depth > 0 
              ? 'none' 
              : `3px solid var(--priority-${t.priority}, ${t.priority === 'high' ? '#e05252' : t.priority === 'medium' ? '#e6a817' : '#c0c0d0'})`,
            border: depth > 0 ? 'none' : 'var(--border-subtle)',
            boxShadow: depth > 0 ? 'none' : 'var(--shadow-xs)',
            transition: 'all 0.2s ease',
            cursor: canHaveChildren ? 'pointer' : 'default'
          }}
          onClick={canHaveChildren ? () => toggleExpand(t.id) : undefined}
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

            {/* Title & Badges */}
            <div style={{ minWidth: 0, flex: 1, display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span
                style={{
                  fontSize: depth > 0 ? 'var(--font-size-xs)' : 'var(--font-size-sm)',
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
                <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '120px' }}>
                  ({t.description})
                </span>
              )}
              {project && (
                <span className={`status-badge color-theme-${project.color_theme}`} style={{ fontSize: '9px', padding: '1px 6px', borderRadius: '4px', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
                  📁 {project.title}
                </span>
              )}
              {parentTask && (
                <span style={{ fontSize: '9px', padding: '1px 6px', borderRadius: '4px', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
                  属于: {parentTask.title}
                </span>
              )}
              {dateLabel && !hasAnySubtasks && (
                <span 
                  style={{ 
                    fontSize: '9px', 
                    color: isOverdue ? 'var(--accent-danger)' : 'var(--text-secondary)',
                    background: isOverdue ? 'var(--accent-danger-soft)' : 'var(--bg-tertiary)',
                    padding: '1px 6px',
                    borderRadius: '4px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    document.getElementById(dateInputId)?.showPicker();
                  }}
                  title="修改截止时间"
                >
                  <Calendar size={10} />
                  <span>{dateLabel}</span>
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      updateTask(t.id, { due_date: null });
                    }}
                    style={{ 
                      marginLeft: '2px', 
                      display: 'inline-flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      fontSize: '8px',
                      color: 'var(--text-tertiary)',
                      background: 'rgba(0,0,0,0.05)',
                      lineHeight: 1
                    }}
                    title="清除时间"
                  >
                    ×
                  </span>
                </span>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }} onClick={e => e.stopPropagation()}>
            {/* Quick Calendar Picker */}
            {!hasAnySubtasks && (
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  document.getElementById(dateInputId)?.showPicker();
                }}
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  color: t.due_date ? 'var(--accent-primary)' : 'var(--text-muted)', 
                  cursor: 'pointer', 
                  display: 'flex', 
                  padding: '4px',
                  borderRadius: '4px',
                  transition: 'background 0.2s'
                }}
                title="设置截止时间"
              >
                <Calendar size={14} />
              </button>
              <input
                id={dateInputId}
                type="datetime-local"
                value={t.due_date ? t.due_date.slice(0, 16) : ''}
                onChange={(e) => {
                  const val = e.target.value;
                  updateTask(t.id, { due_date: val ? new Date(val).toISOString() : null });
                }}
                style={{
                  position: 'absolute',
                  width: 0,
                  height: 0,
                  opacity: 0,
                  pointerEvents: 'none',
                  border: 'none',
                  padding: 0
                }}
              />
            </div>
            )}

            {/* Options Menu */}
            <div ref={activeTaskMenu === t.id ? taskMenuRef : null} style={{ position: 'relative' }}>
              <button
                onClick={() => setActiveTaskMenu(activeTaskMenu === t.id ? null : t.id)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', padding: '4px' }}
              >
                <MoreVertical size={14} />
              </button>
              {activeTaskMenu === t.id && (
                <div className="dropdown-menu" style={{ right: 0, top: '24px' }}>
                  {canHaveChildren && (
                    <button
                      className="dropdown-menu__item"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!expanded) toggleExpand(t.id);
                        setActiveTaskMenu(null);
                      }}
                    >
                      <Plus size={12} />
                      <span>添加子任务</span>
                    </button>
                  )}
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

            {canHaveChildren && (hasChildren || expanded) && (
              <ChevronRight
                size={14}
                style={{
                  color: 'var(--text-muted)',
                  transform: expanded ? 'rotate(90deg)' : 'none',
                  transition: 'transform var(--duration-base)',
                  cursor: 'pointer'
                }}
                onClick={(e) => { e.stopPropagation(); toggleExpand(t.id); }}
              />
            )}
          </div>
        </div>

        {/* Child Tasks */}
        {expanded && (
          <div style={{ 
            marginTop: '2px', 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '4px', 
            borderLeft: '1px dashed var(--bg-tertiary)', 
            marginLeft: '10px', 
            paddingLeft: '10px' 
          }}>
            {childTasks.map(child => renderTaskNode(child, depth + 1))}
            {canHaveChildren && renderInlineAddInput(t.id)}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="tasks-view animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
      
      {/* 1. Domain Selector Tabs */}
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

      {/* 3. Tasks Tree List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        
        {/* Active Tasks List */}
        {activeTasks.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {activeTasks.map(task => renderTaskNode(task, 0))}
          </div>
        ) : (
          completedTasks.length === 0 && (
            <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: 'var(--border-subtle)' }}>
              ☕ 当前分类下暂无待办任务，在下方输入内容开始创建
            </div>
          )
        )}

        {/* 2. Top-level simple add form (Moved below active tasks list) */}
        <form onSubmit={handleTopLevelSubmit} style={{ display: 'flex', gap: '8px', width: '100%', marginTop: '6px', marginBottom: '6px' }}>
          <input
            type="text"
            className="form-input"
            style={{
              flex: 1,
              fontSize: 'var(--font-size-sm)',
              padding: '8px 14px',
              borderRadius: 'var(--radius-md)',
              border: 'var(--border-subtle)',
              background: 'var(--bg-hover)'
            }}
            placeholder="添加新任务..."
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
          />
          <button
            type="submit"
            style={{
              background: 'var(--accent-primary)',
              color: 'white',
              border: 'none',
              padding: '0 20px',
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

        {/* Completed Tasks (Archive) Section — Collapsed by default */}
        {completedTasks.length > 0 && (
          <div className="accordion-section completed-archive" style={{ marginTop: 'var(--space-md)' }}>
            <button
              className="accordion-header"
              onClick={() => setShowArchive(!showArchive)}
              style={{ color: 'var(--text-secondary)' }}
            >
              <span className="accordion-header__label">
                <span>📁 已完成归档 ({completedTasks.length})</span>
              </span>
              <ChevronDown
                size={16}
                className={`accordion-chevron ${showArchive ? 'accordion-chevron--open' : ''}`}
              />
            </button>
            {showArchive && (
              <div className="accordion-content" style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
                {completedTasks.map(task => renderTaskNode(task, 0))}
              </div>
            )}
          </div>
        )}

      </div>

      {/* Detail Modal */}
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
