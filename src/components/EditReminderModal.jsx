import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Calendar, Clock, AlignLeft, Type, MapPin } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useStore } from '../store/useStore';

export default function EditReminderModal({ reminder, onClose }) {
  const { updateReminder } = useStore();

  // Parse existing values
  const existingDate = reminder.datetime ? parseISO(reminder.datetime) : null;

  const [title, setTitle] = useState(reminder.title || '');
  const [date, setDate] = useState(
    existingDate ? format(existingDate, 'yyyy-MM-dd') : ''
  );
  const [time, setTime] = useState(
    existingDate ? format(existingDate, 'HH:mm') : ''
  );
  const [notes, setNotes] = useState(reminder.notes || '');
  const [location, setLocation] = useState(reminder.location || '');
  const [isClosing, setIsClosing] = useState(false);

  const titleRef = useRef(null);

  // Focus title input on mount
  useEffect(() => {
    if (titleRef.current) {
      titleRef.current.focus();
      titleRef.current.select();
    }
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // Prevent body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => onClose(), 200);
  };

  const handleSave = async () => {
    if (!title.trim()) return;

    let datetime = null;
    if (date) {
      datetime = time
        ? new Date(`${date}T${time}:00`).toISOString()
        : new Date(`${date}T00:00:00`).toISOString();
    }

    await updateReminder(reminder.id, {
      title: title.trim(),
      datetime,
      notes: notes.trim() || null,
      location: location.trim() || null,
    });

    handleClose();
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) handleClose();
  };

  return createPortal(
    <div
      className={`edit-modal-overlay ${isClosing ? 'edit-modal-overlay--closing' : ''}`}
      onClick={handleOverlayClick}
    >
      <div className={`edit-modal ${isClosing ? 'edit-modal--closing' : ''}`}>
        {/* Header */}
        <div className="edit-modal__header">
          <h2 className="edit-modal__title">编辑日程</h2>
          <button className="edit-modal__close" onClick={handleClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <div className="edit-modal__body">
          {/* Title field */}
          <div className="edit-modal__field">
            <label className="edit-modal__label">
              <Type size={14} />
              <span>标题</span>
            </label>
            <input
              ref={titleRef}
              className="edit-modal__input"
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="日程标题"
              onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
            />
          </div>

          {/* Date & Time row */}
          <div className="edit-modal__row">
            <div className="edit-modal__field edit-modal__field--flex">
              <label className="edit-modal__label">
                <Calendar size={14} />
                <span>日期</span>
              </label>
              <input
                className="edit-modal__input"
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
              />
            </div>
            <div className="edit-modal__field edit-modal__field--flex">
              <label className="edit-modal__label">
                <Clock size={14} />
                <span>时间</span>
              </label>
              <input
                className="edit-modal__input"
                type="time"
                value={time}
                onChange={e => setTime(e.target.value)}
              />
            </div>
          </div>

          {/* Notes field */}
          <div className="edit-modal__field">
            <label className="edit-modal__label">
              <AlignLeft size={14} />
              <span>备注</span>
            </label>
            <textarea
              className="edit-modal__textarea"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="添加备注（可选）"
              rows={3}
            />
          </div>

          {/* Location field */}
          <div className="edit-modal__field">
            <label className="edit-modal__label">
              <MapPin size={14} />
              <span>地址</span>
            </label>
            <input
              className="edit-modal__input"
              type="text"
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="添加地址（可选，可点击导航）"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="edit-modal__footer">
          <button className="edit-modal__btn edit-modal__btn--cancel" onClick={handleClose}>
            取消
          </button>
          <button
            className="edit-modal__btn edit-modal__btn--save"
            onClick={handleSave}
            disabled={!title.trim()}
          >
            保存
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
