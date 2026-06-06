import { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Folder, Briefcase, Home, Heart, ShoppingBag, BookOpen, Sparkles,
  Plus, MoreVertical, Pencil, Trash2, LayoutGrid, List, Check,
  Calendar, Flag, Circle, Play, CheckCircle2, ChevronRight, X
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
    taskViewMode, 
    setTaskViewMode,
    toggleTaskStatus,
    deleteTask,
    deleteProject
  } = useStore();

  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [editingTask, setEditingTask] = useState(null);
  const [activeProjMenu, setActiveProjMenu] = useState(null);
  const [activeTaskMenu, setActiveTaskMenu] = useState(null);

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

  // Filter projects by domain
  const filteredProjects = useMemo(() => {
    return projects.filter(p => p.domain === taskActiveDomain);
  }, [projects, taskActiveDomain]);

  // Filter tasks by domain and selected project
  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      const matchDomain = t.domain === taskActiveDomain;
      const matchProject = selectedProjectId ? t.project_id === selectedProjectId : true;
      return matchDomain && matchProject;
    });
  }, [tasks, taskActiveDomain, selectedProjectId]);

  // Calculate task counts per column for Kanban
  const kanbanGroups = useMemo(() => {
    const groups = { todo: [], in_progress: [], completed: [] };
    filteredTasks.forEach(t => {
      if (t.status === 'completed') {
        groups.completed.push(t);
      } else if (t.status === 'in_progress') {
        groups.in_progress.push(t);
      } else {
        groups.todo.push(t);
      }
    });
    return groups;
  }, [filteredTasks]);

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
    return format(date, 'M月d日 HH:mm') + ' 截止';
  };

  const renderTaskCard = (t) => {
    const project = projects.find(p => p.id === t.project_id);
    const dateLabel = getTaskDueDateLabel(t.due_date);
    const isOverdue = t.due_date && new Date(t.due_date) < new Date() && t.status !== 'completed';
    
    // Status Icon
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

    return (
      <div 
        key={t.id}
        className={`task-card task-card--priority-${t.priority} ${t.status === 'completed' ? 'task-card--completed' : ''}`}
        style={{
          background: 'var(--bg-card)',
          borderRadius: 'var(--radius-md)',
          padding: 'var(--space-md)',
          border: 'var(--border-subtle)',
          boxShadow: 'var(--shadow-xs)',
          borderLeft: `4px solid var(--priority-${t.priority}, ${t.priority === 'high' ? '#e05252' : t.priority === 'medium' ? '#e6a817' : '#c0c0d0'})`,
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          position: 'relative',
          transition: 'all 0.2s ease',
          cursor: 'default'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', flex: 1, minWidth: 0 }}>
            <button 
              onClick={() => toggleTaskStatus(t.id)}
              style={{
                background: 'none',
                border: 'none',
                color: statusColor,
                cursor: 'pointer',
                padding: 0,
                marginTop: '2px',
                display: 'flex',
                alignItems: 'center',
                flexShrink: 0
              }}
            >
              <StatusIcon size={18} />
            </button>
            <div style={{ minWidth: 0, flex: 1 }}>
              <span 
                style={{ 
                  fontSize: 'var(--font-size-base)', 
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
                <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', marginTop: '2px', wordBreak: 'break-all' }}>
                  {t.description}
                </p>
              )}
            </div>
          </div>

          <div ref={activeTaskMenu === t.id ? taskMenuRef : null} style={{ position: 'relative' }}>
            <button 
              onClick={() => setActiveTaskMenu(activeTaskMenu === t.id ? null : t.id)}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              <MoreVertical size={16} />
            </button>
            {activeTaskMenu === t.id && (
              <div className="dropdown-menu" style={{ right: 0, top: '20px' }}>
                <button className="dropdown-menu__item" onClick={(e) => handleEditTask(t, e)}>
                  <Pencil size={14} />
                  <span>编辑任务</span>
                </button>
                <button className="dropdown-menu__item" onClick={() => { toggleTaskStatus(t.id); setActiveTaskMenu(null); }}>
                  <Check size={14} />
                  <span>切换状态</span>
                </button>
                <button className="dropdown-menu__item dropdown-menu__item--danger" onClick={(e) => handleDeleteTask(t.id, e)}>
                  <Trash2 size={14} />
                  <span>删除任务</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Task Meta Row */}
        {(project || dateLabel) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
            {project && (
              <span 
                onClick={() => setSelectedProjectId(project.id)}
                className={`status-badge color-theme-${project.color_theme}`}
                style={{
                  fontSize: '9px',
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-pill)',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                📁 {project.title}
              </span>
            )}
            {dateLabel && (
              <span 
                style={{ 
                  fontSize: '9px', 
                  color: isOverdue ? 'var(--accent-danger)' : 'var(--text-secondary)',
                  background: isOverdue ? 'var(--accent-danger-soft)' : 'var(--bg-tertiary)',
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-pill)',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '2px'
                }}
              >
                <Calendar size={10} />
                {dateLabel}
              </span>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="tasks-view animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
      
      {/* 1. Domain Slider Selector */}
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
          { id: 'personal', label: '🏠 个人生活' },
          { id: 'family', label: '👨‍👩‍👧‍👦 家庭协同' },
          { id: 'work', label: '💼 工作事务' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => {
              setTaskActiveDomain(tab.id);
              setSelectedProjectId(null); // Reset filter when switching domain
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

      {/* 2. Projects Dashboard section */}
      <div className="projects-section" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h4 style={{ fontSize: 'var(--font-size-sm)', fontWeight: '600', color: 'var(--text-secondary)' }}>项目</h4>
          <button 
            onClick={() => { setEditingProject(null); setProjectModalOpen(true); }}
            style={{ 
              background: 'none', 
              border: 'none', 
              color: 'var(--accent-primary)', 
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '2px',
              fontSize: 'var(--font-size-sm)',
              fontWeight: '500'
            }}
          >
            <Plus size={14} /> 新建项目
          </button>
        </div>

        {/* Project Card Horizontal Grid */}
        <div 
          className="projects-scroll-grid"
          style={{
            display: 'flex',
            gap: '12px',
            overflowX: 'auto',
            paddingBottom: '8px',
            scrollbarWidth: 'none'
          }}
        >
          {filteredProjects.length === 0 ? (
            <div style={{ padding: '24px 0', width: '100%', textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', border: 'var(--border-subtle)' }}>
              暂无项目，创建一个项目以组织任务
            </div>
          ) : (
            filteredProjects.map(proj => {
              const stats = projectStats[proj.id] || { total: 0, completed: 0, percent: 0 };
              const IconComp = ICON_MAP[proj.icon] || Folder;
              const isSelected = selectedProjectId === proj.id;
              
              return (
                <div
                  key={proj.id}
                  onClick={() => setSelectedProjectId(isSelected ? null : proj.id)}
                  style={{
                    flexShrink: 0,
                    width: '140px',
                    background: 'var(--bg-card)',
                    borderRadius: 'var(--radius-md)',
                    padding: '12px',
                    border: isSelected ? '2px solid var(--accent-primary)' : 'var(--border-subtle)',
                    boxShadow: isSelected ? 'var(--shadow-md)' : 'var(--shadow-xs)',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    height: '110px',
                    position: 'relative',
                    transition: 'all 0.2s'
                  }}
                  className={`project-card color-theme-${proj.color_theme}`}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
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

                    <div ref={activeProjMenu === proj.id ? projMenuRef : null} style={{ position: 'relative' }}>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveProjMenu(activeProjMenu === proj.id ? null : proj.id);
                        }}
                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', padding: '2px' }}
                      >
                        <MoreVertical size={14} />
                      </button>
                      {activeProjMenu === proj.id && (
                        <div className="dropdown-menu" style={{ right: 0, top: '16px' }}>
                          <button className="dropdown-menu__item" onClick={(e) => handleEditProject(proj, e)}>
                            <Pencil size={12} />
                            <span>编辑</span>
                          </button>
                          <button className="dropdown-menu__item dropdown-menu__item--danger" onClick={(e) => handleDeleteProject(proj.id, e)}>
                            <Trash2 size={12} />
                            <span>删除</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ marginTop: '8px', minWidth: 0 }}>
                    <h5 style={{ fontSize: 'var(--font-size-base)', fontWeight: '600', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {proj.title}
                    </h5>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                      <span style={{ fontSize: '9px', color: 'var(--text-tertiary)' }}>{stats.completed}/{stats.total} 任务</span>
                      <span style={{ fontSize: '9px', fontWeight: '600', color: 'var(--accent-primary)' }}>{stats.percent}%</span>
                    </div>
                    {/* Linear Progress Bar */}
                    <div style={{ height: '4px', background: 'var(--bg-tertiary)', borderRadius: '2px', overflow: 'hidden', marginTop: '4px' }}>
                      <div style={{ height: '100%', width: `${stats.percent}%`, background: 'var(--accent-primary)', transition: 'width 0.3s ease' }} />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 3. Task Management Control Panel */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--space-sm)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: '600', color: 'var(--text-secondary)' }}>
            任务列表 {selectedProjectId && '（筛选中）'}
          </span>
          {selectedProjectId && (
            <button 
              onClick={() => setSelectedProjectId(null)}
              style={{ background: 'var(--bg-tertiary)', border: 'none', color: 'var(--text-secondary)', padding: '2px 8px', borderRadius: '4px', fontSize: '9px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}
            >
              取消项目筛选 <X size={10} />
            </button>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* View Toggle */}
          <div style={{ display: 'flex', background: 'var(--bg-tertiary)', padding: '2px', borderRadius: '6px' }}>
            <button
              onClick={() => setTaskViewMode('kanban')}
              style={{
                background: taskViewMode === 'kanban' ? 'var(--bg-secondary)' : 'transparent',
                color: taskViewMode === 'kanban' ? 'var(--text-primary)' : 'var(--text-muted)',
                border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', display: 'flex'
              }}
              title="看板视图"
            >
              <LayoutGrid size={14} />
            </button>
            <button
              onClick={() => setTaskViewMode('list')}
              style={{
                background: taskViewMode === 'list' ? 'var(--bg-secondary)' : 'transparent',
                color: taskViewMode === 'list' ? 'var(--text-primary)' : 'var(--text-muted)',
                border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', display: 'flex'
              }}
              title="列表视图"
            >
              <List size={14} />
            </button>
          </div>

          <button 
            onClick={() => { setEditingTask(null); setTaskModalOpen(true); }}
            style={{ 
              background: 'var(--accent-primary)', 
              border: 'none', 
              color: '#fff', 
              padding: '6px 12px', 
              borderRadius: 'var(--radius-pill)', 
              cursor: 'pointer', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '4px',
              fontSize: 'var(--font-size-sm)',
              fontWeight: '500',
              boxShadow: 'var(--shadow-xs)'
            }}
          >
            <Plus size={14} /> 新建任务
          </button>
        </div>
      </div>

      {/* 4. Task Display Area (Kanban / List) */}
      {filteredTasks.length === 0 ? (
        <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--font-size-base)', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: 'var(--border-subtle)', boxShadow: 'var(--shadow-card)' }}>
          暂无符合条件的任务
        </div>
      ) : taskViewMode === 'kanban' ? (
        /* Kanban View - Scroll Snap */
        <div 
          className="kanban-scroll-container"
          style={{
            display: 'flex',
            gap: '12px',
            overflowX: 'auto',
            scrollSnapType: 'x mandatory',
            paddingBottom: '16px',
            scrollbarWidth: 'none',
            margin: '0 -16px',
            padding: '0 16px 16px'
          }}
        >
          {/* Column 1: TODO */}
          <div 
            style={{ 
              flex: '0 0 280px', 
              scrollSnapAlign: 'center', 
              background: 'rgba(238, 238, 243, 0.5)', 
              borderRadius: 'var(--radius-lg)', 
              padding: '12px', 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '12px',
              maxHeight: '450px',
              overflowY: 'auto'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid rgba(91, 77, 199, 0.2)', paddingBottom: '6px' }}>
              <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: '600', color: 'var(--text-primary)' }}>待办</span>
              <span className="header__tab-badge" style={{ background: 'rgba(91, 77, 199, 0.1)', color: 'var(--accent-primary)' }}>{kanbanGroups.todo.length}</span>
            </div>
            {kanbanGroups.todo.map(renderTaskCard)}
          </div>

          {/* Column 2: IN PROGRESS */}
          <div 
            style={{ 
              flex: '0 0 280px', 
              scrollSnapAlign: 'center', 
              background: 'rgba(238, 238, 243, 0.5)', 
              borderRadius: 'var(--radius-lg)', 
              padding: '12px', 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '12px',
              maxHeight: '450px',
              overflowY: 'auto'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid rgba(230, 168, 23, 0.2)', paddingBottom: '6px' }}>
              <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: '600', color: 'var(--text-primary)' }}>进行中</span>
              <span className="header__tab-badge" style={{ background: 'rgba(230, 168, 23, 0.1)', color: 'var(--accent-warning)' }}>{kanbanGroups.in_progress.length}</span>
            </div>
            {kanbanGroups.in_progress.map(renderTaskCard)}
          </div>

          {/* Column 3: COMPLETED */}
          <div 
            style={{ 
              flex: '0 0 280px', 
              scrollSnapAlign: 'center', 
              background: 'rgba(238, 238, 243, 0.5)', 
              borderRadius: 'var(--radius-lg)', 
              padding: '12px', 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '12px',
              maxHeight: '450px',
              overflowY: 'auto'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid rgba(61, 186, 140, 0.2)', paddingBottom: '6px' }}>
              <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: '600', color: 'var(--text-primary)' }}>已完成</span>
              <span className="header__tab-badge" style={{ background: 'rgba(61, 186, 140, 0.10)', color: 'var(--accent-success)' }}>{kanbanGroups.completed.length}</span>
            </div>
            {kanbanGroups.completed.map(renderTaskCard)}
          </div>
        </div>
      ) : (
        /* List View */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filteredTasks.map(renderTaskCard)}
        </div>
      )}

      {/* 5. Modals */}
      {projectModalOpen && (
        <ProjectDetailModal 
          project={editingProject} 
          defaultDomain={taskActiveDomain}
          onClose={() => { setProjectModalOpen(false); setEditingProject(null); }} 
        />
      )}

      {taskModalOpen && (
        <TaskDetailModal 
          task={editingTask} 
          defaultDomain={taskActiveDomain}
          defaultProjectId={selectedProjectId}
          onClose={() => { setTaskModalOpen(false); setEditingTask(null); }} 
        />
      )}
    </div>
  );
}
