import { useMemo, useState, useRef, useEffect } from 'react';
import { format, isToday, isTomorrow, isThisWeek, isPast, parseISO, differenceInMinutes } from 'date-fns';
import { Check, Trash2, CalendarClock, Repeat, MoreVertical, Clock, Pencil, BellOff } from 'lucide-react';
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

function getRelativeStatus(datetime) {
  if (!datetime) return null;
  const date = parseISO(datetime);
  const now = new Date();
  const diffMin = differenceInMinutes(date, now);

  // Past items — not today → "overdue"
  if (diffMin < 0 && !isToday(date)) {
    const absDiff = Math.abs(diffMin);
    if (absDiff < 60) return { text: `已过期 ${absDiff} 分钟`, type: 'overdue' };
    const hours = Math.floor(absDiff / 60);
    return { text: `已过期 ${hours} 小时`, type: 'overdue' };
  }
  // Past items — today → "elapsed" (softer visual)
  if (diffMin < 0 && isToday(date)) {
    const absDiff = Math.abs(diffMin);
    if (absDiff < 60) return { text: `已过 ${absDiff} 分钟`, type: 'elapsed' };
    const hours = Math.floor(absDiff / 60);
    const mins = absDiff % 60;
    return { text: `已过 ${hours} 小时${mins > 0 ? ' ' + mins + ' 分钟' : ''}`, type: 'elapsed' };
  }
  if (diffMin >= 0 && diffMin <= 15) return { text: `还有 ${diffMin} 分钟`, type: 'soon' };
  if (diffMin > 15 && diffMin <= 60) return { text: `还有 ${diffMin} 分钟`, type: 'normal' };
  if (diffMin > 60 && isToday(date)) {
    const hours = Math.floor(diffMin / 60);
    const mins = diffMin % 60;
    return { text: `还有 ${hours} 小时${mins > 0 ? ' ' + mins + ' 分钟' : ''}`, type: 'normal' };
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
  overdue: '已过期',
  today: '今天',
  tomorrow: '明天',
  thisWeek: '本周',
  later: '之后',
  noDate: '未设定时间',
};

function ReminderItem({ reminder }) {
  const { toggleReminder, deleteReminder } = useStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const timeStr = reminder.datetime
    ? format(parseISO(reminder.datetime), 'HH:mm')
    : null;

  const isOverdue = reminder.datetime &&
    isPast(parseISO(reminder.datetime)) &&
    !isToday(parseISO(reminder.datetime)) &&
    !reminder.completed;

  // Today's item whose time has already passed
  const isElapsed = reminder.datetime &&
    isPast(parseISO(reminder.datetime)) &&
    isToday(parseISO(reminder.datetime)) &&
    !reminder.completed;

  const status = !reminder.completed ? getRelativeStatus(reminder.datetime) : null;

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
      className={`reminder-item ${reminder.completed ? 'reminder-item--completed' : ''} ${isOverdue ? 'reminder-item--overdue' : ''} ${isElapsed ? 'reminder-item--elapsed' : ''}`}
    >
      <div className="reminder-item__time-col">
        {timeStr ? (
          <span className="reminder-item__time">{timeStr}</span>
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
          <div className={`reminder-item__status reminder-item__status--${status.type}`}>
            {status.text}
          </div>
        )}
        {reminder.notes && (
          <div className="reminder-item__notes">{reminder.notes}</div>
        )}
      </div>
      <div className="reminder-item__actions">
        <button
          className={`check-circle-btn ${reminder.completed ? 'check-circle-btn--checked' : ''}`}
          onClick={() => toggleReminder(reminder.id)}
          aria-label={reminder.completed ? 'Mark incomplete' : 'Mark complete'}
        >
          <Check size={14} />
        </button>
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
              <button className="dropdown-menu__item" onClick={() => setMenuOpen(false)}>
                <Pencil size={14} />
                <span>编辑</span>
              </button>
              <button className="dropdown-menu__item" onClick={() => setMenuOpen(false)}>
                <Clock size={14} />
                <span>延后提醒</span>
              </button>
              <button className="dropdown-menu__item" onClick={() => setMenuOpen(false)}>
                <Repeat size={14} />
                <span>设置重复</span>
              </button>
              <button
                className="dropdown-menu__item dropdown-menu__item--danger"
                onClick={() => {
                  deleteReminder(reminder.id);
                  setMenuOpen(false);
                }}
              >
                <Trash2 size={14} />
                <span>删除</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Compact single-line item for future dates (thisWeek, later, noDate)
function CompactReminderItem({ reminder }) {
  const { toggleReminder, deleteReminder } = useStore();

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

  return (
    <div className={`compact-item ${reminder.completed ? 'compact-item--completed' : ''}`}>
      <button
        className={`compact-item__check ${reminder.completed ? 'compact-item__check--checked' : ''}`}
        onClick={() => toggleReminder(reminder.id)}
        aria-label="Toggle"
      >
        <Check size={10} />
      </button>
      {dateLabel && <span className="compact-item__date">{dateLabel}</span>}
      {timeLabel && <span className="compact-item__time">{timeLabel}</span>}
      <span className="compact-item__title">{reminder.title}</span>
      {reminder.recurrence && (
        <Repeat size={12} className="compact-item__recur" />
      )}
      <button className="compact-item__delete" onClick={() => deleteReminder(reminder.id)} aria-label="Delete">
        <Trash2 size={12} />
      </button>
    </div>
  );
}

export default function RemindersView() {
  const { reminders, showCompleted, toggleShowCompleted } = useStore();

  const active = reminders.filter(r => !r.completed);
  const completed = reminders.filter(r => r.completed);
  const groups = useMemo(() => groupReminders(active), [active]);

  const hasAny = reminders.length > 0;

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

  // Groups that get full card rendering
  const detailGroups = ['overdue', 'today', 'tomorrow'];
  // Groups that get compact rendering
  const compactGroups = ['thisWeek', 'later', 'noDate'];

  const [showLater, setShowLater] = useState(false);

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
                <ReminderItem reminder={r} />
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
          {groups.thisWeek.map(r => (
            <CompactReminderItem key={r.id} reminder={r} />
          ))}
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
              {groups.later.map(r => (
                <CompactReminderItem key={r.id} reminder={r} />
              ))}
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

      {completed.length > 0 && (
        <div className="completed-section">
          <button className="completed-toggle" onClick={toggleShowCompleted}>
            {showCompleted ? '隐藏' : '显示'} 已完成 ({completed.length})
          </button>
          {showCompleted && completed.map(r => (
            <ReminderItem key={r.id} reminder={r} />
          ))}
        </div>
      )}
    </div>
  );
}
