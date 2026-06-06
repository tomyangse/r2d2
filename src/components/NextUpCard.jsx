import { useMemo, useState, useEffect } from 'react';
import { parseISO, isAfter, isToday, isTomorrow, differenceInMinutes, format } from 'date-fns';
import { useStore } from '../store/useStore';

export default function NextUpCard() {
  const { reminders, tasks } = useStore();
  const [now, setNow] = useState(new Date());

  // Update every minute for the countdown
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(interval);
  }, []);

  // Find the next upcoming uncompleted reminder or task deadline
  const nextUp = useMemo(() => {
    const mappedTasks = (tasks || [])
      .filter(t => t.due_date && t.status !== 'completed')
      .map(t => ({
        id: t.id,
        title: t.title,
        datetime: t.due_date,
        isTask: true,
      }));

    const upcoming = [...(reminders || [])]
      .filter(r => r.datetime && !r.completed)
      .map(r => ({
        id: r.id,
        title: r.title,
        datetime: r.datetime,
        isTask: false,
      }))
      .concat(mappedTasks)
      .filter(item => isAfter(parseISO(item.datetime), now))
      .sort((a, b) => new Date(a.datetime) - new Date(b.datetime));

    return upcoming[0] || null;
  }, [reminders, tasks, now]);

  if (!nextUp) return null;

  const targetDate = parseISO(nextUp.datetime);
  const totalMinutes = differenceInMinutes(targetDate, now);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const timeStr = format(targetDate, 'HH:mm');

  // Date label
  let dateLabel = '';
  if (isToday(targetDate)) {
    dateLabel = '今天';
  } else if (isTomorrow(targetDate)) {
    dateLabel = '明天';
  } else {
    dateLabel = format(targetDate, 'M月d日');
  }

  let countdownStr = '';
  if (hours > 0) {
    countdownStr = `还有 ${hours} 小时 ${minutes} 分钟`;
  } else if (minutes > 0) {
    countdownStr = `还有 ${minutes} 分钟`;
  } else {
    countdownStr = '即将开始';
  }

  return (
    <div className="next-up-card">
      <div className="next-up-card__label">
        <span className="next-up-card__label-icon">{nextUp.isTask ? '🎯' : '✨'}</span>
        <span>{nextUp.isTask ? '任务截止' : '下一件事'}</span>
      </div>
      <div className="next-up-card__main">
        <span className="next-up-card__time">{timeStr}</span>
        <span className="next-up-card__divider" />
        <span className="next-up-card__title">{nextUp.title}</span>
      </div>
      <div className="next-up-card__meta">
        <span className="next-up-card__date-label">{dateLabel}</span>
        <span className="next-up-card__countdown">{countdownStr}</span>
      </div>
      {/* Decorative clock */}
      <div className="next-up-card__decoration">
        <div className="next-up-card__clock" />
      </div>
    </div>
  );
}
