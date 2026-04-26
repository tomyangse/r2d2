import { useMemo, useState, useRef, useEffect } from 'react';
import { format, isToday, isTomorrow, isThisWeek, isPast, parseISO, differenceInMinutes } from 'date-fns';
import { Check, Trash2, CalendarClock, Repeat, MoreVertical, Clock, Pencil, ArrowRight, ChevronDown } from 'lucide-react';
import { useStore } from '../store/useStore';

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
  const { toggleReminder, deleteReminder, postponeReminder } = useStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const timeStr = reminder.datetime
    ? format(parseISO(reminder.datetime), 'HH:mm')
    : null;

  const isPending = !reminder.completed && reminder.datetime && isPast(parseISO(reminder.datetime));
  const isFuture = groupKey === 'tomorrow' || (groupKey === 'today' && !isPending);
  const status = !reminder.completed ? getStatusBadge(reminder.datetime, groupKey) : null;

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

  return (
    <div
      className={`reminder-item ${reminder.completed ? 'reminder-item--completed' : ''} ${isPending ? 'reminder-item--pending' : ''}`}
    >
      <div className="reminder-item__time-col">
        {timeStr ? (
          <span className={`reminder-item__time ${isPending ? 'reminder-item__time--pending' : ''}`}>{timeStr}</span>
        ) : (
          <span className="reminder-item__dot" />
        )}
      </div>
      {timeStr && <span className="reminder-item__time-divider" />}
      <div className="reminder-item__content">
        <div className="reminder-item__title">
          {reminder.title}
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
      </div>
      <div className="reminder-item__actions">
        {/* Show check circle for pending items & today's items, but NOT for tomorrow */}
        {!isFuture && !reminder.completed && (
          <button
            className="check-circle-btn"
            onClick={() => toggleReminder(reminder.id)}
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
              {isPending ? (
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
                  <button className="dropdown-menu__item" onClick={() => setMenuOpen(false)}>
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
                  <button className="dropdown-menu__item" onClick={() => setMenuOpen(false)}>
                    <Pencil size={14} />
                    <span>编辑</span>
                  </button>
                  <button className="dropdown-menu__item" onClick={() => setMenuOpen(false)}>
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

  return (
    <div className={`compact-item ${reminder.completed ? 'compact-item--completed' : ''}`}>
      {dateLabel && <span className="compact-item__date">{dateLabel}</span>}
      {timeLabel && <span className="compact-item__time">{timeLabel}</span>}
      <span className="compact-item__title">{reminder.title}</span>
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
            {reminder.recurrence ? (
              <>
                <button className="dropdown-menu__item" onClick={() => setMenuOpen(false)}>
                  <Pencil size={14} />
                  <span>编辑本次</span>
                </button>
                <button className="dropdown-menu__item" onClick={() => setMenuOpen(false)}>
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
                <button className="dropdown-menu__item" onClick={() => setMenuOpen(false)}>
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
    </div>
  );
}

export default function RemindersView() {
  const { reminders, showCompleted, toggleShowCompleted } = useStore();
  const [showLater, setShowLater] = useState(false);

  const active = reminders.filter(r => !r.completed);
  const completed = reminders.filter(r => r.completed);
  const groups = useMemo(() => groupReminders(active), [active]);

  const hasAny = reminders.length > 0;

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
