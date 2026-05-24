import { Sparkles, X } from 'lucide-react';
import { useStore } from '../store/useStore';

export default function AiAnswerCard() {
  const { ragAnswer, setRagAnswer } = useStore();

  if (!ragAnswer) return null;

  return (
    <div className="ai-answer-card animate-slide-up">
      {/* Ambience Corner Light Glow */}
      <div className="ai-answer-card__glow" />

      {/* Close button */}
      <button
        className="ai-answer-card__close"
        onClick={() => setRagAnswer(null)}
        aria-label="关闭回答"
        title="关闭回答"
      >
        <X size={16} />
      </button>

      {/* Header */}
      <div className="ai-answer-card__header">
        <Sparkles size={18} className="ai-answer-card__spark" />
        <span className="ai-answer-card__title">R2D AI 智能解答</span>
      </div>

      {/* Query */}
      <div className="ai-answer-card__query">
        <span className="ai-answer-card__query-quote">“</span>
        <span className="ai-answer-card__query-text">{ragAnswer.query}</span>
        <span className="ai-answer-card__query-quote">”</span>
      </div>

      {/* Answer Body */}
      <div className="ai-answer-card__body">
        {ragAnswer.answer.split('\n').map((paragraph, index) => (
          paragraph.trim() ? (
            <p key={index} className="ai-answer-card__text">
              {paragraph.startsWith('- ') || paragraph.startsWith('* ') ? (
                <span className="ai-answer-card__list-item">{paragraph}</span>
              ) : (
                paragraph
              )}
            </p>
          ) : <div key={index} className="ai-answer-card__spacing" />
        ))}
      </div>
    </div>
  );
}
