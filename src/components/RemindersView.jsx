import { useMemo, useState, useRef, useEffect } from 'react';
import { format, isToday, isTomorrow, isThisWeek, isPast, parseISO, differenceInMinutes } from 'date-fns';
import { Check, Trash2, CalendarClock, Repeat, MoreVertical, Clock, Pencil, ArrowRight, ChevronDown, MapPin } from 'lucide-react';
import { useStore } from '../store/useStore';
import EditReminderModal from './EditReminderModal';

const RECURRENCE_LABELS = {
  daily: '每天',
  weekdays: '工作日',
  'weekly:0': '每周日',
  'weekly:1': '每周一',
  'weekly:2': '每周二',
  'weekly:3': '每周三',
  'weekly:4': '每周四',
  'weekly:5': '每周五',
  'weekly:6': '每周六',
};

function getRecurrenceLabel(recurrence) {
  if (!recurrence) return null;
  if (RECURRENCE_LABELS[recurrence]) return RECURRENCE_LABELS[recurrence];
  if (recurrence.startsWith('monthly:')) return `每月${recurrence.split(':')[1]}号`;
  if (recurrence.startsWith('biweekly:')) {
    const day = RECURRENCE_LABELS[`weekly:${recurrence.split(':')[1]}`];
    return day ? `隔周${day.replace('每', '')}` : recurrence;
  }
  return recurrence;
}

/**
 * Returns a status badge for the reminder.
 * - Past today items (not completed) → "待确认" (pending confirmation)
 * - Within 30 min → "即将开始" (starting soon)
 * - Otherwise → null (clean, no status)
 */
function getStatusBadge(datetime, groupKey) {
  if (!datetime) return null;
  const date = parseISO(datetime);
  const now = new Date();
  const diffMin = differenceInMinutes(date, now);

  // Past items today → "待确认"
  if (diffMin < 0 && isToday(date)) {
    return { text: '待确认', type: 'pending' };
  }

  // Past items from before today → also "待确认"
  if (diffMin < 0 && !isToday(date)) {
    return { text: '待确认', type: 'pending' };
  }

  // Starting within 30 minutes → "即将开始"
  if (diffMin >= 0 && diffMin <= 30) {
    return { text: '即将开始', type: 'soon' };
  }

  return null;
}

function groupReminders(reminders) {
  const groups = {
    overdue: [],
    today: [],
    tomorrow: [],
    thisWeek: [],
    later: [],
    noDate: [],
  };

  reminders.forEach(r => {
    if (!r.datetime) {
      groups.noDate.push(r);
      return;
    }

    const date = parseISO(r.datetime);

    if (isPast(date) && !isToday(date) && !r.completed) {
      groups.overdue.push(r);
    } else if (isToday(date)) {
      groups.today.push(r);
    } else if (isTomorrow(date)) {
      groups.tomorrow.push(r);
    } else if (isThisWeek(date)) {
      groups.thisWeek.push(r);
    } else {
      groups.later.push(r);
    }
  });

  // Sort each group by datetime
  Object.keys(groups).forEach(key => {
    groups[key].sort((a, b) => {
      if (!a.datetime) return 1;
      if (!b.datetime) return -1;
      return new Date(a.datetime) - new Date(b.datetime);
    });
  });

  return groups;
}

const GROUP_LABELS = {
  overdue: '待确认',
  today: '今天',
  tomorrow: '明天',
  thisWeek: '本周',
  later: '之后',
  noDate: '未设定时间',
};

/**
 * Full card reminder item — used for overdue, today, tomorrow groups.
 * Adapts its visual based on groupKey:
 * - overdue/today past items: show "待确认" badge + check circle
 * - tomorrow: no check circle, only menu
 */
function ReminderItem({ reminder, groupKey }) {
  const { toggleReminder, deleteReminder, postponeReminder, toggleTaskStatus, deleteTask, projects } = useStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const menuRef = useRef(null);

  const timeStr = reminder.datetime
    ? format(parseISO(reminder.datetime), 'HH:mm')
    : null;

  const isAllDayTask = reminder.isTask && (timeStr === '00:00' || timeStr === '23:59' || !reminder.datetime.includes('T'));

  const isPending = !reminder.completed && reminder.datetime && isPast(parseISO(reminder.datetime));
  const isFuture = groupKey === 'tomorrow' || (groupKey === 'today' && !isPending);
  const status = !reminder.completed && !reminder.isTask ? getStatusBadge(reminder.datetime, groupKey) : null;

  const handleEdit = () => {
    if (reminder.isTask) return;
    setMenuOpen(false);
    setEditOpen(true);
  };

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const taskClass = reminder.isTask ? `reminder-item--task-${reminder.priority}` : '';
  const taskBorderColor = reminder.isTask
    ? (reminder.priority === 'high' ? '#e05252' : reminder.priority === 'medium' ? '#e6a817' : '#c0c0d0')
    : null;

  // Resolve project info
  const project = reminder.isTask && projects?.find(p => p.id === reminder.projectId);
  const domainLabel = reminder.domain === 'work' ? '工作' : reminder.domain === 'family' ? '家庭' : '个人';
  const tagLabel = project ? `${domainLabel} · ${project.title}` : domainLabel;
  const themeColor = project?.color_theme || (reminder.domain === 'work' ? 'indigo' : reminder.domain === 'family' ? 'rose' : 'emerald');

  return (
    <div
      className={`reminder-item ${reminder.completed ? 'reminder-item--completed' : ''} ${isPending && !reminder.isTask ? 'reminder-item--pending' : ''} ${menuOpen ? 'reminder-item--menu-open' : ''} ${taskClass}`}
      style={reminder.isTask ? { borderLeft: `3px solid ${taskBorderColor}` } : {}}
    >
      <div className="reminder-item__time-col" style={reminder.isTask ? { minWidth: '65px' } : {}}>
        {reminder.isTask ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
            <span style={{ fontSize: '1.1rem' }}>🎯</span>
            <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', fontWeight: '600' }}>
              {isAllDayTask ? '全天' : `${timeStr}`}
            </span>
          </div>
        ) : timeStr ? (
          <span className={`reminder-item__time ${isPending ? 'reminder-item__time--pending' : ''}`}>{timeStr}</span>
        ) : (
          <span className="reminder-item__dot" />
        )}
      </div>
      {(timeStr || reminder.isTask) && <span className="reminder-item__time-divider" style={reminder.isTask ? { left: '80px' } : {}} />}
      <div className="reminder-item__content">
        <div className="reminder-item__title" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
          <span>{reminder.title}</span>
          {reminder.isTask && (
            <span className={`status-badge color-theme-${themeColor}`} style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '4px', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
              📁 {tagLabel}
            </span>
          )}
          {reminder.recurrence && (
            <span className="reminder-item__recurrence">
              {getRecurrenceLabel(reminder.recurrence)}
            </span>
          )}
        </div>
        {status && (
          <div className={`status-badge status-badge--${status.type}`}>
            {status.text}
          </div>
        )}
        {reminder.notes && (
          <div className="reminder-item__notes">{reminder.notes}</div>
        )}
        {reminder.location && (
          <a
            className="reminder-item__location"
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(reminder.location)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <MapPin size={12} />
            <span>{reminder.location}</span>
          </a>
        )}
      </div>
      <div className="reminder-item__actions">
        {/* Show check circle for pending items & today's items, but NOT for tomorrow */}
        {!isFuture && (
          <button
            className={`check-circle-btn ${reminder.completed ? 'check-circle-btn--checked' : ''}`}
            onClick={() => reminder.isTask ? toggleTaskStatus(reminder.id) : toggleReminder(reminder.id)}
            aria-label="Mark complete"
          >
            <Check size={14} />
          </button>
        )}
        <div ref={menuRef} style={{ position: 'relative' }}>
          <button
            className="three-dot-btn"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="More options"
          >
            <MoreVertical size={16} />
          </button>
          {menuOpen && (
            <div className="dropdown-menu">
              {reminder.isTask ? (
                <>
                  <button className="dropdown-menu__item" onClick={() => { toggleTaskStatus(reminder.id); setMenuOpen(false); }}>
                    <Check size={14} />
                    <span>{reminder.completed ? '设为待办' : '完成任务'}</span>
                  </button>
                  <button
                    className="dropdown-menu__item dropdown-menu__item--danger"
                    onClick={() => { deleteTask(reminder.id); setMenuOpen(false); }}
                  >
                    <Trash2 size={14} />
                    <span>删除任务</span>
                  </button>
                </>
              ) : isPending ? (
                <>
                  {/* Pending confirmation menu */}
                  <button className="dropdown-menu__item" onClick={() => { toggleReminder(reminder.id); setMenuOpen(false); }}>
                    <Check size={14} />
                    <span>标记完成</span>
                  </button>
                  <button className="dropdown-menu__item" onClick={() => { postponeReminder(reminder.id); setMenuOpen(false); }}>
                    <ArrowRight size={14} />
                    <span>移到明天</span>
                  </button>
                  <button className="dropdown-menu__item" onClick={handleEdit}>
                    <Clock size={14} />
                    <span>改时间</span>
                  </button>
                  <button
                    className="dropdown-menu__item dropdown-menu__item--danger"
                    onClick={() => { deleteReminder(reminder.id); setMenuOpen(false); }}
                  >
                    <Trash2 size={14} />
                    <span>删除</span>
                  </button>
                </>
              ) : (
                <>
                  {/* Future item menu */}
                  <button className="dropdown-menu__item" onClick={handleEdit}>
                    <Pencil size={14} />
                    <span>编辑</span>
                  </button>
                  <button className="dropdown-menu__item" onClick={handleEdit}>
                    <Clock size={14} />
                    <span>改时间</span>
                  </button>
                  <button
                    className="dropdown-menu__item dropdown-menu__item--danger"
                    onClick={() => { deleteReminder(reminder.id); setMenuOpen(false); }}
                  >
                    <Trash2 size={14} />
                    <span>删除</span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
      {editOpen && (
        <EditReminderModal reminder={reminder} onClose={() => setEditOpen(false)} />
      )}
    </div>
  );
}

/**
 * Compact single-line item for thisWeek / later / noDate groups.
 * Shows recurrence label text instead of delete button for recurring items.
 */
function CompactReminderItem({ reminder }) {
  const { deleteReminder } = useStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const menuRef = useRef(null);

  let dateLabel = '';
  let timeLabel = '';

  if (reminder.datetime) {
    const date = parseISO(reminder.datetime);
    const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

    if (isThisWeek(date)) {
      dateLabel = dayNames[date.getDay()];
    } else {
      dateLabel = format(date, 'M/d');
      const dayName = dayNames[date.getDay()];
      dateLabel += ` ${dayName}`;
    }
    timeLabel = format(date, 'HH:mm');
  }

  const recurrenceLabel = getRecurrenceLabel(reminder.recurrence);

  const handleEdit = () => {
    setMenuOpen(false);
    setEditOpen(true);
  };

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const { toggleTaskStatus, deleteTask, projects } = useStore();
  
  // Resolve project info for tasks
  const project = reminder.isTask && projects?.find(p => p.id === reminder.projectId);
  const domainLabel = reminder.domain === 'work' ? '工作' : reminder.domain === 'family' ? '家庭' : '个人';
  const tagLabel = project ? `${domainLabel} · ${project.title}` : domainLabel;
  const themeColor = project?.color_theme || (reminder.domain === 'work' ? 'indigo' : reminder.domain === 'family' ? 'rose' : 'emerald');

  return (
    <div className={`compact-item ${reminder.completed ? 'compact-item--completed' : ''} ${reminder.isTask ? `compact-item--task-${reminder.priority}` : ''}`} style={{ position: 'relative', zIndex: menuOpen ? 60 : 'auto', borderLeft: reminder.isTask ? `2px solid ${reminder.priority === 'high' ? '#e05252' : reminder.priority === 'medium' ? '#e6a817' : '#c0c0d0'}` : '' }}>
      {dateLabel && <span className="compact-item__date">{dateLabel}</span>}
      {timeLabel && <span className="compact-item__time">{reminder.isTask ? '🎯' : timeLabel}</span>}
      <span className="compact-item__title" style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        <span>{reminder.title}</span>
        {reminder.isTask && (
          <span className={`status-badge color-theme-${themeColor}`} style={{ fontSize: '9px', padding: '0px 4px', borderRadius: '3px', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
            {tagLabel}
          </span>
        )}
      </span>
      {reminder.location && (
        <a
          className="compact-item__location"
          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(reminder.location)}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
        >
          <MapPin size={10} />
        </a>
      )}
      {reminder.recurrence && (
        <>
          <Repeat size={12} className="compact-item__recur" />
          <span className="compact-item__recur-label">{recurrenceLabel}</span>
        </>
      )}
      <div ref={menuRef} style={{ position: 'relative' }}>
        <button
          className="three-dot-btn three-dot-btn--compact"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="More options"
        >
          <MoreVertical size={14} />
        </button>
        {menuOpen && (
          <div className="dropdown-menu">
            {reminder.isTask ? (
              <>
                <button className="dropdown-menu__item" onClick={() => { toggleTaskStatus(reminder.id); setMenuOpen(false); }}>
                  <Check size={14} />
                  <span>{reminder.completed ? '设为待办' : '完成任务'}</span>
                </button>
                <button
                  className="dropdown-menu__item dropdown-menu__item--danger"
                  onClick={() => { deleteTask(reminder.id); setMenuOpen(false); }}
                >
                  <Trash2 size={14} />
                  <span>删除任务</span>
                </button>
              </>
            ) : reminder.recurrence ? (
              <>
                <button className="dropdown-menu__item" onClick={handleEdit}>
                  <Pencil size={14} />
                  <span>编辑本次</span>
                </button>
                <button className="dropdown-menu__item" onClick={handleEdit}>
                  <Repeat size={14} />
                  <span>编辑整个重复</span>
                </button>
                <button
                  className="dropdown-menu__item dropdown-menu__item--danger"
                  onClick={() => { deleteReminder(reminder.id); setMenuOpen(false); }}
                >
                  <Trash2 size={14} />
                  <span>删除重复</span>
                </button>
              </>
            ) : (
              <>
                <button className="dropdown-menu__item" onClick={handleEdit}>
                  <Pencil size={14} />
                  <span>编辑</span>
                </button>
                <button
                  className="dropdown-menu__item dropdown-menu__item--danger"
                  onClick={() => { deleteReminder(reminder.id); setMenuOpen(false); }}
                >
                  <Trash2 size={14} />
                  <span>删除</span>
                </button>
              </>
            )}
          </div>
        )}
      </div>
      {editOpen && (
        <EditReminderModal reminder={reminder} onClose={() => setEditOpen(false)} />
      )}
    </div>
  );
}

export default function RemindersView() {
  const { reminders, tasks, projects, showCompleted, toggleShowCompleted } = useStore();
  const [showLater, setShowLater] = useState(false);

  // Normalize tasks into reminder-like objects
  const mappedTasks = useMemo(() => {
    return (tasks || [])
      .filter(t => t.due_date)
      .map(t => ({
        id: t.id,
        title: t.title,
        datetime: t.due_date,
        notes: t.description,
        completed: t.status === 'completed',
        isTask: true,
        projectId: t.project_id,
        domain: t.domain,
        priority: t.priority,
        status: t.status,
      }));
  }, [tasks]);

  const combinedItems = useMemo(() => {
    return [...(reminders || []), ...mappedTasks];
  }, [reminders, mappedTasks]);

  const active = useMemo(() => combinedItems.filter(r => !r.completed), [combinedItems]);
  const completed = useMemo(() => combinedItems.filter(r => r.completed), [combinedItems]);
  const groups = useMemo(() => groupReminders(active), [active]);

  const hasAny = combinedItems.length > 0;

  // Groups that get full card rendering
  const detailGroups = ['overdue', 'today', 'tomorrow'];

  if (!hasAny) {
    return (
      <div className="empty-state">
        <CalendarClock className="empty-state__icon" />
        <div className="empty-state__title">暂无日程</div>
        <div className="empty-state__hint">
          用自然语言告诉我你的安排
        </div>
        <div className="empty-state__examples">
          <button className="empty-state__example" onClick={() => useStore.getState().sendMessage('明天下午3点提醒我开会')}>
            "明天下午3点提醒我开会"
          </button>
          <button className="empty-state__example" onClick={() => useStore.getState().sendMessage('remind me to call mom at 5pm')}>
            "remind me to call mom at 5pm"
          </button>
          <button className="empty-state__example" onClick={() => useStore.getState().sendMessage('每周日上午10点送女儿画画课')}>
            "每周日上午10点送女儿画画课"
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {/* Detailed card groups: overdue, today, tomorrow */}
      {detailGroups.map(key => {
        const items = groups[key];
        if (!items || items.length === 0) return null;
        return (
          <div key={key}>
            <div className="section-header">
              <span className="section-header__title">{GROUP_LABELS[key]}</span>
              <div className="section-header__line" />
            </div>
            {items.map((r, i) => (
              <div key={r.id} style={{ animationDelay: `${i * 50}ms` }}>
                <ReminderItem reminder={r} groupKey={key} />
              </div>
            ))}
          </div>
        );
      })}

      {/* Compact list: thisWeek */}
      {groups.thisWeek.length > 0 && (
        <div>
          <div className="section-header">
            <span className="section-header__title">
              {GROUP_LABELS.thisWeek} ({groups.thisWeek.length})
            </span>
            <div className="section-header__line" />
          </div>
          <div className="compact-list-container">
            {groups.thisWeek.map(r => (
              <CompactReminderItem key={r.id} reminder={r} />
            ))}
          </div>
        </div>
      )}

      {/* Compact list: later (collapsed by default) */}
      {groups.later.length > 0 && (
        <div>
          <div className="section-header">
            <span className="section-header__title">
              之后 ({groups.later.length})
            </span>
            <div className="section-header__line" />
          </div>
          {showLater ? (
            <>
              <div className="compact-list-container">
                {groups.later.map(r => (
                  <CompactReminderItem key={r.id} reminder={r} />
                ))}
              </div>
              <button className="completed-toggle" onClick={() => setShowLater(false)}>
                收起
              </button>
            </>
          ) : (
            <button className="completed-toggle" onClick={() => setShowLater(true)}>
              展开查看 {groups.later.length} 项日程
            </button>
          )}
        </div>
      )}

      {/* No date items */}
      {groups.noDate.length > 0 && (
        <div>
          <div className="section-header">
            <span className="section-header__title">
              {GROUP_LABELS.noDate} ({groups.noDate.length})
            </span>
            <div className="section-header__line" />
          </div>
          {groups.noDate.map(r => (
            <CompactReminderItem key={r.id} reminder={r} />
          ))}
        </div>
      )}

      {/* Completed section — collapsible */}
      {completed.length > 0 && (
        <div className="completed-section">
          <button
            className={`completed-section__header ${showCompleted ? 'completed-section__header--open' : ''}`}
            onClick={toggleShowCompleted}
          >
            <span className="completed-section__label">
              已完成 ({completed.length})
            </span>
            <ChevronDown size={16} className="completed-section__chevron" />
          </button>
          {showCompleted && (
            <div className="completed-section__list">
              {completed.map(r => (
                <ReminderItem key={r.id} reminder={r} groupKey="completed" />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
