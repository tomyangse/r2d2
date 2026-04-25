import { useState, useRef, useEffect } from 'react';
import { Send, Loader } from 'lucide-react';
import { useStore } from '../store/useStore';
import VoiceButton from './VoiceButton';

export default function InputBar() {
  const [value, setValue] = useState('');
  const textareaRef = useRef(null);
  const { sendMessage, isProcessing } = useStore();

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
    }
  }, [value]);

  // Keyboard shortcut: "/" to focus
  useEffect(() => {
    const handler = (e) => {
      if (e.key === '/' && document.activeElement !== textareaRef.current) {
        e.preventDefault();
        textareaRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleSubmit = async () => {
    const text = value.trim();
    if (!text || isProcessing) return;
    setValue('');
    await sendMessage(text, 'text');
  };

  const handleVoiceResult = async (transcript) => {
    setValue('');
    await sendMessage(transcript, 'voice');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="input-bar">
      <div className="input-bar__container">
        <textarea
          ref={textareaRef}
          className="input-bar__input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="✨ 说点什么，然后不管了..."
          rows={1}
          disabled={isProcessing}
          aria-label="AI input"
        />
        <VoiceButton onResult={handleVoiceResult} disabled={isProcessing} />
        <button
          className={`input-bar__send ${isProcessing ? 'input-bar__send--loading' : ''}`}
          onClick={handleSubmit}
          disabled={!value.trim() || isProcessing}
          aria-label="Send"
        >
          {isProcessing ? <Loader size={16} /> : <Send size={16} />}
        </button>
      </div>
    </div>
  );
}
