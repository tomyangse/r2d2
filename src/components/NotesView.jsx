import { useState } from 'react';
import { Pin, Trash2, Copy, Edit3, Check, X, ChevronDown, ChevronUp } from 'lucide-react';
import { useStore } from '../store/useStore';
import NoteDetailModal from './NoteDetailModal';

export default function NotesView() {
  const {
    notes = [],
    togglePinNote,
    updateNote,
    deleteNote,
    toggleNoteChecklistItem,
    showToast,
  } = useStore();

  const [activeTag, setActiveTag] = useState('全部');
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [expandedIds, setExpandedIds] = useState({});
  const [selectedNote, setSelectedNote] = useState(null);

  // Get all unique tags from notes
  const allTags = ['全部', ...new Set(notes.flatMap(note => note.tags || []))];

  // Filter notes by active tag
  const filteredNotes = activeTag === '全部'
    ? notes
    : notes.filter(note => note.tags && note.tags.includes(activeTag));

  // Split into pinned and unpinned
  const pinnedNotes = filteredNotes.filter(note => note.is_pinned);
  const regularNotes = filteredNotes.filter(note => !note.is_pinned);

  const handleCopy = (content, e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(content)
      .then(() => {
        showToast('success', '已复制到剪贴板 📋');
      })
      .catch(() => {
        showToast('error', '复制失败');
      });
  };

  const startEditing = (note, e) => {
    e.stopPropagation();
    setEditingId(note.id);
    setEditTitle(note.title);
    setEditContent(note.content);
  };

  const cancelEditing = (e) => {
    if (e) e.stopPropagation();
    setEditingId(null);
    setEditTitle('');
    setEditContent('');
  };

  const saveEditing = async (id, e) => {
    e.stopPropagation();
    if (!editTitle.trim() && !editContent.trim()) {
      showToast('error', '标题或正文不能为空');
      return;
    }
    await updateNote(id, editTitle.trim(), editContent.trim());
    setEditingId(null);
  };

  const toggleExpand = (id, e) => {
    e.stopPropagation();
    setExpandedIds(prev => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // Render checklist items
  const renderChecklist = (note) => {
    const lines = note.content.split('\n');
    let checkboxIndex = 0;

    return (
      <div className="note-card__checklist">
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
                className={`note-card__checklist-item ${isChecked ? 'note-card__checklist-item--checked' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleNoteChecklistItem(note.id, currentIdx);
                }}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  readOnly
                  className="note-card__checkbox"
                />
                <span className="note-card__checklist-text">{label}</span>
              </label>
            );
          }

          // Plain text line inside checklist
          return trimmed ? (
            <p key={index} className="note-card__checklist-plain">{trimmed}</p>
          ) : null;
        })}
      </div>
    );
  };

  // Render rich text body
  const renderRichBody = (note) => {
    const isExpanded = expandedIds[note.id];
    const isLong = note.content.length > 150;
    const displayText = isLong && !isExpanded
      ? note.content.slice(0, 150) + '...'
      : note.content;

    return (
      <div className="note-card__rich-body">
        <p className="note-card__text">{displayText}</p>
        {isLong && (
          <button
            className="note-card__expand-btn"
            onClick={(e) => toggleExpand(note.id, e)}
          >
            {isExpanded ? (
              <>
                <span>收起</span>
                <ChevronUp size={14} />
              </>
            ) : (
              <>
                <span>展开全文</span>
                <ChevronDown size={14} />
              </>
            )}
          </button>
        )}
      </div>
    );
  };

  const renderNoteCard = (note) => {
    const isEditing = editingId === note.id;
    const themeClass = note.color_theme ? `note-card--theme-${note.color_theme}` : 'note-card--theme-indigo';

    return (
      <div
        key={note.id}
        className={`note-card ${themeClass} ${note.is_pinned ? 'note-card--pinned' : ''} note-card--type-${note.type}`}
        onClick={() => !isEditing && setSelectedNote(note)}
        onDoubleClick={(e) => !isEditing && startEditing(note, e)}
        style={{ cursor: isEditing ? 'default' : 'pointer' }}
      >
        {/* Card Header */}
        <div className="note-card__header">
          {isEditing ? (
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="note-card__title-input"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <h3 className="note-card__title">{note.title}</h3>
          )}

          <div className="note-card__actions">
            <button
              className={`note-card__action note-card__action--pin ${note.is_pinned ? 'note-card__action--active' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                togglePinNote(note.id);
              }}
              title={note.is_pinned ? "取消置顶" : "置顶记事"}
            >
              <Pin size={14} />
            </button>
            <button
              className="note-card__action note-card__action--copy"
              onClick={(e) => handleCopy(note.content, e)}
              title="复制正文"
            >
              <Copy size={14} />
            </button>
            {!isEditing && (
              <button
                className="note-card__action note-card__action--edit"
                onClick={(e) => startEditing(note, e)}
                title="编辑记事"
              >
                <Edit3 size={14} />
              </button>
            )}
            <button
              className="note-card__action note-card__action--delete"
              onClick={(e) => {
                e.stopPropagation();
                if (confirm('确认删除此条记事吗？')) deleteNote(note.id);
              }}
              title="删除记事"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        {/* Card Body */}
        <div className="note-card__body">
          {isEditing ? (
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="note-card__content-input"
              rows={4}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <>
              {note.type === 'checklist' && renderChecklist(note)}
              {note.type === 'rich' && renderRichBody(note)}
              {note.type === 'sticky' && <p className="note-card__text note-card__text--sticky">{note.content}</p>}
            </>
          )}
        </div>

        {/* Card Footer */}
        <div className="note-card__footer">
          {isEditing ? (
            <div className="note-card__edit-actions">
              <button className="note-card__edit-btn note-card__edit-btn--save" onClick={(e) => saveEditing(note.id, e)}>
                <Check size={14} />
                <span>保存</span>
              </button>
              <button className="note-card__edit-btn note-card__edit-btn--cancel" onClick={cancelEditing}>
                <X size={14} />
                <span>取消</span>
              </button>
            </div>
          ) : (
            <div className="note-card__metadata">
              {note.tags && note.tags.length > 0 && (
                <div className="note-card__tags">
                  {note.tags.map(tag => (
                    <span key={tag} className="note-card__tag">#{tag}</span>
                  ))}
                </div>
              )}
              <span className="note-card__time">
                {new Date(note.updated_at || note.created_at).toLocaleDateString('zh-CN', {
                  month: 'numeric',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="notes-view">
      {/* Title */}
      <h2 className="notes-view__title">📓 闪念记事</h2>

      {/* Dynamic Tag Capsule Chips */}
      {allTags.length > 1 && (
        <div className="notes-view__tags-bar">
          {allTags.map(tag => (
            <button
              key={tag}
              className={`notes-view__tag-chip ${activeTag === tag ? 'notes-view__tag-chip--active' : ''}`}
              onClick={() => setActiveTag(tag)}
            >
              {tag === '全部' ? '🔍 全部' : `# ${tag}`}
            </button>
          ))}
        </div>
      )}

      {notes.length === 0 ? (
        <div className="notes-view__empty">
          <p className="notes-view__empty-text">这里空空如也 ✏️</p>
          <p className="notes-view__empty-sub">
            在下方输入：“记录一下 Wi-Fi 密码是...”，或者输入“打包装备清单：...”试试吧！
          </p>
        </div>
      ) : (
        <div className="notes-view__content">
          {/* Pinned Section */}
          {pinnedNotes.length > 0 && (
            <div className="notes-view__section">
              <h4 className="notes-view__section-title">📌 置顶内容</h4>
              <div className="notes-view__grid">
                {pinnedNotes.map(note => renderNoteCard(note))}
              </div>
            </div>
          )}

          {/* Regular Section */}
          {regularNotes.length > 0 && (
            <div className="notes-view__section">
              {pinnedNotes.length > 0 && <h4 className="notes-view__section-title">📝 其他记事</h4>}
              <div className="notes-view__grid">
                {regularNotes.map(note => renderNoteCard(note))}
              </div>
            </div>
          )}

          {filteredNotes.length === 0 && (
            <div className="notes-view__empty">
              <p className="notes-view__empty-text">该分类下没有相关记事</p>
            </div>
          )}
        </div>
      )}

      {/* Note Detail Modal */}
      {selectedNote && (
        <NoteDetailModal
          note={notes.find(n => n.id === selectedNote.id) || selectedNote}
          onClose={() => setSelectedNote(null)}
        />
      )}
    </div>
  );
}
