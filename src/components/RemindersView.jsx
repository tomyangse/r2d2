import { useMemo } from 'react';
import { format, isToday, isTomorrow, isThisWeek, isPast, parseISO } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { Check, Trash2, Bell, CalendarClock } from 'lucide-react';
import { useStore } from '../store/useStore';

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

  const timeStr = reminder.datetime
    ? format(parseISO(reminder.datetime), 'HH:mm')
    : null;
  
  const isOverdue = reminder.datetime && 
    isPast(parseISO(reminder.datetime)) && 
    !isToday(parseISO(reminder.datetime)) && 
    !reminder.completed;

  return (
    <div
      className={`reminder-item ${reminder.completed ? 'reminder-item--completed' : ''} ${isOverdue ? 'reminder-item--overdue' : ''}`}
    >
      <div className="reminder-item__time-col">
        {timeStr ? (
          <span className="reminder-item__time">{timeStr}</span>
        ) : (
          <span className="reminder-item__dot" />
        )}
      </div>
      <div className="reminder-item__content">
        <div className="reminder-item__title">{reminder.title}</div>
        {reminder.notes && (
          <div className="reminder-item__notes">{reminder.notes}</div>
        )}
      </div>
      <div className="reminder-item__actions">
        <button
          className="action-btn action-btn--success"
          onClick={() => toggleReminder(reminder.id)}
          aria-label={reminder.completed ? 'Mark incomplete' : 'Mark complete'}
        >
          <Check size={14} />
        </button>
        <button
          className="action-btn action-btn--danger"
          onClick={() => deleteReminder(reminder.id)}
          aria-label="Delete reminder"
        >
          <Trash2 size={14} />
        </button>
      </div>
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
          <button className="empty-state__example" onClick={() => useStore.getState().sendMessage('下周三预约牙医')}>
            "下周三预约牙医"
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {Object.entries(groups).map(([key, items]) => {
        if (items.length === 0) return null;
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
