import { useState, useRef, useCallback, useEffect } from 'react';
import { Mic, MicOff } from 'lucide-react';

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

export default function VoiceButton({ onResult, disabled }) {
  const [isListening, setIsListening] = useState(false);
  const [interim, setInterim] = useState('');
  const recognitionRef = useRef(null);
  const finalTranscriptRef = useRef('');

  const isSupported = !!SpeechRecognition;

  const stop = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
    setInterim('');
  }, []);

  const start = useCallback(() => {
    if (!isSupported || disabled) return;

    finalTranscriptRef.current = '';

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'zh-CN';
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);

    recognition.onresult = (event) => {
      let finalText = '';
      let interimText = '';

      for (let i = 0; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalText += transcript;
        } else {
          interimText += transcript;
        }
      }

      if (finalText) {
        finalTranscriptRef.current = finalText;
      }
      setInterim(interimText || finalText);
    };

    recognition.onerror = (event) => {
      console.warn('Speech recognition error:', event.error);
      stop();
    };

    recognition.onend = () => {
      setIsListening(false);
      setInterim('');
      // Send whatever we got when recognition ends (user released button)
      const text = finalTranscriptRef.current;
      if (text.trim()) {
        onResult(text.trim());
      }
      finalTranscriptRef.current = '';
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [isSupported, disabled, onResult, stop]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  // Handle pointer down (start) and pointer up (stop)
  const handlePointerDown = (e) => {
    e.preventDefault();
    if (disabled) return;
    start();
  };

  const handlePointerUp = (e) => {
    e.preventDefault();
    if (isListening) {
      stop();
    }
  };

  // Also stop if pointer leaves the button while held
  const handlePointerLeave = () => {
    if (isListening) {
      stop();
    }
  };

  if (!isSupported) return null;

  return (
    <>
      <button
        className={`voice-btn ${isListening ? 'voice-btn--active' : ''}`}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        onContextMenu={(e) => e.preventDefault()}
        disabled={disabled}
        aria-label={isListening ? 'Release to send' : 'Hold to speak'}
        type="button"
      >
        {isListening ? <MicOff size={16} /> : <Mic size={16} />}
        {isListening && (
          <span className="voice-btn__pulse" />
        )}
      </button>
      {interim && (
        <div className="voice-interim">
          <span className="voice-interim__text">{interim}</span>
          <span className="voice-interim__dot">●</span>
        </div>
      )}
    </>
  );
}
