import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Pin, Copy, Edit3, Trash2, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { useStore } from '../store/useStore';

export default function NoteDetailModal({ note, onClose }) {
  const {
    togglePinNote,
    updateNote,
    deleteNote,
    toggleNoteChecklistItem,
    showToast,
  } = useStore();

  const [isClosing, setIsClosing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(note.title);
  const [editContent, setEditContent] = useState(note.content);

  // Close on Escape
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') {
        if (isEditing) {
          setIsEditing(false);
        } else {
          handleClose();
        }
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isEditing]);

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => onClose(), 200);
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) handleClose();
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(note.content)
      .then(() => showToast('success', '已复制到剪贴板 📋'))
      .catch(() => showToast('error', '复制失败'));
  };

  const handleSave = async () => {
    if (!editTitle.trim() && !editContent.trim()) {
      showToast('error', '标题或正文不能为空');
      return;
    }
    await updateNote(note.id, editTitle.trim(), editContent.trim());
    setIsEditing(false);
  };

  const handleDelete = () => {
    if (confirm('确认删除此条记事吗？')) {
      deleteNote(note.id);
      handleClose();
    }
  };

  const themeClass = note.color_theme ? `note-detail--theme-${note.color_theme}` : 'note-detail--theme-indigo';

  const dateStr = new Date(note.updated_at || note.created_at).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  // Render checklist
  const renderChecklist = () => {
    const lines = note.content.split('\n');
    let checkboxIndex = 0;

    return (
      <div className="note-detail__checklist">
        {lines.map((line, index) => {
          const trimmed = line.trim();
          const isUnchecked = trimmed.startsWith('- [ ]');
          const isChecked = trimmed.startsWith('- [x]');

          if (isUnchecked || isChecked) {
            const label = trimmed.slice(5).trim();
            const currentIdx = checkboxIndex;
            checkboxIndex++;

            return (
              <label
                key={index}
                className={`note-detail__checklist-item ${isChecked ? 'note-detail__checklist-item--checked' : ''}`}
                onClick={() => toggleNoteChecklistItem(note.id, currentIdx)}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  readOnly
                  className="note-detail__checkbox"
                />
                <span className="note-detail__checklist-text">{label}</span>
              </label>
            );
          }

          return trimmed ? (
            <p key={index} className="note-detail__checklist-plain">{trimmed}</p>
          ) : null;
        })}
      </div>
    );
  };

  return createPortal(
    <div
      className={`note-detail-overlay ${isClosing ? 'note-detail-overlay--closing' : ''}`}
      onClick={handleOverlayClick}
    >
      <div className={`note-detail ${themeClass} ${isClosing ? 'note-detail--closing' : ''}`}>
        {/* Decorative top accent bar */}
        <div className="note-detail__accent-bar" />

        {/* Header */}
        <div className="note-detail__header">
          <div className="note-detail__header-left">
            {isEditing ? (
              <input
                type="text"
                className="note-detail__title-input"
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                autoFocus
              />
            ) : (
              <h2 className="note-detail__title">{note.title}</h2>
            )}
            <span className="note-detail__date">{dateStr}</span>
          </div>
          <button className="note-detail__close" onClick={handleClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {/* Tags */}
        {note.tags && note.tags.length > 0 && (
          <div className="note-detail__tags">
            {note.tags.map(tag => (
              <span key={tag} className="note-detail__tag">#{tag}</span>
            ))}
          </div>
        )}

        {/* Body */}
        <div className="note-detail__body">
          {isEditing ? (
            <textarea
              className="note-detail__content-input"
              value={editContent}
              onChange={e => setEditContent(e.target.value)}
              rows={10}
            />
          ) : (
            <>
              {note.type === 'checklist' && renderChecklist()}
              {note.type === 'rich' && (
                <p className="note-detail__text">{note.content}</p>
              )}
              {note.type === 'sticky' && (
                <p className="note-detail__text note-detail__text--sticky">{note.content}</p>
              )}
            </>
          )}
        </div>

        {/* Footer actions */}
        <div className="note-detail__footer">
          {isEditing ? (
            <div className="note-detail__edit-actions">
              <button className="note-detail__action-btn note-detail__action-btn--save" onClick={handleSave}>
                <Check size={16} />
                <span>保存</span>
              </button>
              <button className="note-detail__action-btn note-detail__action-btn--cancel" onClick={() => {
                setIsEditing(false);
                setEditTitle(note.title);
                setEditContent(note.content);
              }}>
                <X size={16} />
                <span>取消</span>
              </button>
            </div>
          ) : (
            <div className="note-detail__toolbar">
              <button
                className={`note-detail__tool ${note.is_pinned ? 'note-detail__tool--active' : ''}`}
                onClick={() => togglePinNote(note.id)}
                title={note.is_pinned ? '取消置顶' : '置顶'}
              >
                <Pin size={16} />
                <span>{note.is_pinned ? '已置顶' : '置顶'}</span>
              </button>
              <button className="note-detail__tool" onClick={handleCopy} title="复制">
                <Copy size={16} />
                <span>复制</span>
              </button>
              <button className="note-detail__tool" onClick={() => {
                setIsEditing(true);
                setEditTitle(note.title);
                setEditContent(note.content);
              }} title="编辑">
                <Edit3 size={16} />
                <span>编辑</span>
              </button>
              <button className="note-detail__tool note-detail__tool--danger" onClick={handleDelete} title="删除">
                <Trash2 size={16} />
                <span>删除</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
