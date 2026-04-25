import { useState, useRef, useCallback, useEffect } from 'react';
import { Mic, MicOff } from 'lucide-react';

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

export default function VoiceButton({ onResult, disabled }) {
  const [isListening, setIsListening] = useState(false);
  const [interim, setInterim] = useState('');
  const recognitionRef = useRef(null);

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

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'zh-CN'; // Primary: Chinese, also picks up English
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);

    recognition.onresult = (event) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      setInterim(interimTranscript);

      if (finalTranscript) {
        onResult(finalTranscript);
        stop();
      }
    };

    recognition.onerror = (event) => {
      console.warn('Speech recognition error:', event.error);
      stop();
    };

    recognition.onend = () => {
      setIsListening(false);
      setInterim('');
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

  const toggle = () => {
    if (isListening) {
      stop();
    } else {
      start();
    }
  };

  if (!isSupported) return null;

  return (
    <>
      <button
        className={`voice-btn ${isListening ? 'voice-btn--active' : ''}`}
        onClick={toggle}
        disabled={disabled}
        aria-label={isListening ? 'Stop recording' : 'Start voice input'}
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
