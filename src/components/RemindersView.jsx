import { useMemo, useState, useRef, useEffect } from 'react';
import {
  format,
  isToday,
  isTomorrow,
  isThisWeek,
  isPast,
  parseISO,
  differenceInMinutes,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  differenceInWeeks
} from 'date-fns';
import { Check, Trash2, CalendarClock, Repeat, MoreVertical, Clock, Pencil, ArrowRight, ChevronDown, MapPin, ChevronLeft, ChevronRight } from 'lucide-react';
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

/**
 * Helper to check if a reminder or task occurs on a specific checkDate
 */
function isReminderOccurOnDate(r, checkDate) {
  if (!r.datetime) return false;

  let date;
  try {
    date = parseISO(r.datetime);
  } catch (e) {
    return false;
  }

  // Normalize times to midnight in the local timezone for date-only comparison
  const checkStart = new Date(checkDate.getFullYear(), checkDate.getMonth(), checkDate.getDate());
  const rStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (checkStart < rStart) {
    return false;
  }

  if (!r.recurrence) {
    return isSameDay(date, checkDate);
  }

  const dayOfWeek = checkDate.getDay();
  const dayOfMonth = checkDate.getDate();

  if (r.recurrence === 'daily') {
    return true;
  }

  if (r.recurrence === 'weekdays') {
    return dayOfWeek >= 1 && dayOfWeek <= 5;
  }

  if (r.recurrence.startsWith('weekly:')) {
    const targetDay = parseInt(r.recurrence.split(':')[1], 10);
    return dayOfWeek === targetDay;
  }

  if (r.recurrence.startsWith('biweekly:')) {
    const targetDay = parseInt(r.recurrence.split(':')[1], 10);
    if (dayOfWeek !== targetDay) return false;

    const startWeek = startOfWeek(date, { weekStartsOn: 1 });
    const checkWeek = startOfWeek(checkDate, { weekStartsOn: 1 });
    const diffWeeks = differenceInWeeks(checkWeek, startWeek);
    return Math.abs(diffWeeks) % 2 === 0;
  }

  if (r.recurrence.startsWith('monthly:')) {
    const targetDay = parseInt(r.recurrence.split(':')[1], 10);
    return dayOfMonth === targetDay;
  }

  return false;
}

/**
 * Full card reminder item — used for overdue, today, tomorrow groups.
 * Adapts its visual based on groupKey:
 * - overdue/today past items: show "待确认" badge + check circle
 * - tomorrow: no check circle, only menu
 */
function ReminderItem({ reminder, groupKey, subdued = false }) {
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
      className={`reminder-item ${reminder.completed ? 'reminder-item--completed' : ''} ${isPending && !reminder.isTask ? 'reminder-item--pending' : ''} ${menuOpen ? 'reminder-item--menu-open' : ''} ${subdued ? 'reminder-item--subdued' : ''} ${taskClass}`}
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

export default function RemindersView({ minimal = false }) {
  const { reminders, tasks, projects, showCompleted, toggleShowCompleted } = useStore();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showOverdue, setShowOverdue] = useState(true);
  const [showNoDate, setShowNoDate] = useState(false);

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

  const todayDate = useMemo(() => new Date(), []);
  const displayDate = minimal ? todayDate : selectedDate;

  const selectedDayItems = useMemo(() => {
    return combinedItems.filter(item => isReminderOccurOnDate(item, displayDate));
  }, [combinedItems, displayDate]);

  const activeOnSelectedDay = useMemo(() => {
    return selectedDayItems.filter(item => !item.completed);
  }, [selectedDayItems]);

  const completedOnSelectedDay = useMemo(() => {
    return selectedDayItems.filter(item => item.completed);
  }, [selectedDayItems]);

  const tomorrowDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d;
  }, []);

  const activeOnTomorrow = useMemo(() => {
    const tomorrowItems = combinedItems.filter(item => isReminderOccurOnDate(item, tomorrowDate));
    return tomorrowItems.filter(item => !item.completed);
  }, [combinedItems, tomorrowDate]);

  const overdueItems = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return combinedItems.filter(item => {
      if (item.completed || !item.datetime) return false;
      if (item.recurrence) return false; // Recurring items shouldn't show in overdue
      
      const itemDate = parseISO(item.datetime);
      const itemDay = new Date(itemDate.getFullYear(), itemDate.getMonth(), itemDate.getDate());
      return itemDay < today;
    });
  }, [combinedItems]);

  const noDateItems = useMemo(() => {
    return combinedItems.filter(item => !item.completed && !item.datetime);
  }, [combinedItems]);

  // Calendar calculations
  const startOfCurrentMonth = startOfMonth(currentMonth);
  const endOfCurrentMonth = endOfMonth(currentMonth);
  const startOfGrid = startOfWeek(startOfCurrentMonth, { weekStartsOn: 1 });
  const endOfGrid = endOfWeek(endOfCurrentMonth, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: startOfGrid, end: endOfGrid });

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth() + 1;
  const headerStr = `${year}年${month}月`;

  const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const formattedSelectedDate = `${displayDate.getMonth() + 1}月${displayDate.getDate()}日 · ${dayNames[displayDate.getDay()]}`;

  const totalSchedulesCount = activeOnSelectedDay.length + completedOnSelectedDay.length;

  if (minimal) {
    return (
      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Today's Section */}
        <div>
          <div className="details-header" style={{ marginTop: 0, marginBottom: '8px' }}>
            <span className="details-header__title">今日待办</span>
            <span className="details-header__count">{activeOnSelectedDay.length} 项</span>
          </div>

          {activeOnSelectedDay.length > 0 ? (
            <div className="day-reminders-list">
              {activeOnSelectedDay.map((r, i) => (
                <div key={r.id} style={{ animationDelay: `${i * 30}ms` }}>
                  <ReminderItem reminder={r} groupKey="today" subdued={!r.isTask} />
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-day-state" style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-tertiary)', fontSize: 'var(--font-size-sm)', background: 'var(--bg-hover)', borderRadius: 'var(--radius-lg)' }}>
              ☕ 今日无待办日程
            </div>
          )}
        </div>

        {/* Tomorrow's Section */}
        <div>
          <div className="details-header" style={{ marginTop: 0, marginBottom: '8px' }}>
            <span className="details-header__title" style={{ color: 'var(--text-secondary)' }}>明日日程预告</span>
            <span className="details-header__count" style={{ color: 'var(--text-tertiary)' }}>{activeOnTomorrow.length} 项</span>
          </div>

          {activeOnTomorrow.length > 0 ? (
            <div className="day-reminders-list" style={{ opacity: 0.65 }}>
              {activeOnTomorrow.map((r, i) => (
                <div key={r.id} style={{ animationDelay: `${i * 30}ms` }}>
                  <ReminderItem reminder={r} groupKey="tomorrow" subdued={!r.isTask} />
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-day-state" style={{ textAlign: 'center', padding: '16px 0', color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)', background: 'var(--bg-hover)', borderRadius: 'var(--radius-lg)', opacity: 0.65 }}>
              ☕ 明日无安排日程
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {/* Overdue Section */}
      {overdueItems.length > 0 && (
        <div className="accordion-section overdue-section">
          <button
            className="accordion-header"
            onClick={() => setShowOverdue(!showOverdue)}
            style={{ color: 'var(--accent-danger)' }}
          >
            <span className="accordion-header__label">
              <span>⚠️ 逾期未完成 ({overdueItems.length})</span>
            </span>
            <ChevronDown
              size={16}
              className={`accordion-chevron ${showOverdue ? 'accordion-chevron--open' : ''}`}
            />
          </button>
          {showOverdue && (
            <div className="accordion-content">
              {overdueItems.map(r => (
                <ReminderItem key={r.id} reminder={r} groupKey="overdue" />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Selected Day Details Section */}
      <div className="details-header">
        <span className="details-header__title">{formattedSelectedDate}</span>
        <span className="details-header__count">{totalSchedulesCount} 项日程</span>
      </div>

      {/* Active items on selected day */}
      {activeOnSelectedDay.length > 0 ? (
        <div className="day-reminders-list" style={{ marginBottom: 'var(--space-md)' }}>
          {activeOnSelectedDay.map((r, i) => (
            <div key={r.id} style={{ animationDelay: `${i * 30}ms` }}>
              <ReminderItem reminder={r} groupKey={isToday(selectedDate) ? 'today' : isTomorrow(selectedDate) ? 'tomorrow' : 'later'} />
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-day-state" style={{ textAlign: 'center', padding: 'var(--space-md) 0', color: 'var(--text-tertiary)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-md)' }}>
          ☕ 当天无未完成日程
        </div>
      )}

      {/* Completed items on selected day */}
      {completedOnSelectedDay.length > 0 && (
        <div className="completed-section" style={{ marginTop: 'var(--space-sm)', marginBottom: 'var(--space-md)' }}>
          <button
            className={`completed-section__header ${showCompleted ? 'completed-section__header--open' : ''}`}
            onClick={toggleShowCompleted}
          >
            <span className="completed-section__label">
              已完成 ({completedOnSelectedDay.length})
            </span>
            <ChevronDown size={16} className="completed-section__chevron" />
          </button>
          {showCompleted && (
            <div className="completed-section__list">
              {completedOnSelectedDay.map(r => (
                <ReminderItem key={r.id} reminder={r} groupKey="completed" />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Calendar Card */}
      <div className="calendar-container" style={{ marginTop: 'var(--space-md)' }}>
        <div className="calendar-header">
          <span className="calendar-header__title">{headerStr}</span>
          <div className="calendar-header__nav">
            <button
              className="calendar-nav-btn"
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              aria-label="Previous month"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              className="calendar-nav-btn"
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              aria-label="Next month"
            >
              <ChevronRight size={16} />
            </button>
            {(!isSameMonth(currentMonth, new Date()) || !isSameDay(selectedDate, new Date())) && (
              <button
                className="calendar-today-btn"
                onClick={() => {
                  const today = new Date();
                  setCurrentMonth(today);
                  setSelectedDate(today);
                }}
              >
                今天
              </button>
            )}
          </div>
        </div>

        <div className="calendar-grid">
          {['一', '二', '三', '四', '五', '六', '日'].map(d => (
            <div key={d} className="calendar-grid__weekday">{d}</div>
          ))}

          {days.map((day, i) => {
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const isSelected = isSameDay(day, selectedDate);
            const isDayToday = isToday(day);

            const dayItems = active.filter(item => isReminderOccurOnDate(item, day));
            const hasRegular = dayItems.some(item => !item.isTask && !item.recurrence);
            const hasRecurring = dayItems.some(item => !item.isTask && item.recurrence);
            const hasTask = dayItems.some(item => item.isTask);

            return (
              <button
                key={day.toISOString()}
                className={`calendar-day ${!isCurrentMonth ? 'calendar-day--outside' : ''} ${isSelected ? 'calendar-day--selected' : ''} ${isDayToday ? 'calendar-day--today' : ''}`}
                style={{ animationDelay: `${(i % 7) * 20}ms` }}
                onClick={() => {
                  setSelectedDate(day);
                  if (!isCurrentMonth) {
                    setCurrentMonth(startOfMonth(day));
                  }
                }}
              >
                <span className="calendar-day__number">{day.getDate()}</span>
                <div className="calendar-day__dots">
                  {hasRegular && <span className="calendar-dot calendar-dot--regular" />}
                  {hasRecurring && <span className="calendar-dot calendar-dot--recurring" />}
                  {hasTask && <span className="calendar-dot calendar-dot--task" />}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* No Date Items Section */}
      {noDateItems.length > 0 && (
        <div className="accordion-section no-date-section" style={{ marginTop: 'var(--space-lg)' }}>
          <button
            className="accordion-header"
            onClick={() => setShowNoDate(!showNoDate)}
          >
            <span className="accordion-header__label">
              <span>📂 未设定时间 ({noDateItems.length})</span>
            </span>
            <ChevronDown
              size={16}
              className={`accordion-chevron ${showNoDate ? 'accordion-chevron--open' : ''}`}
            />
          </button>
          {showNoDate && (
            <div className="accordion-content">
              {noDateItems.map(r => (
                <CompactReminderItem key={r.id} reminder={r} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
