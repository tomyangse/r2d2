import { useState, useRef, useCallback, useEffect } from 'react';
import { Mic, MicOff } from 'lucide-react';

export default function VoiceButton({ onResult, disabled }) {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const streamRef = useRef(null);

  // Check if MediaRecorder is supported
  const isSupported = typeof MediaRecorder !== 'undefined' && navigator.mediaDevices?.getUserMedia;

  const stop = useCallback(() => {
    // Stop timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // Stop recorder
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }

    // Stop media stream tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }

    setIsRecording(false);
    setDuration(0);
  }, []);

  const start = useCallback(async () => {
    if (!isSupported || disabled) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      streamRef.current = stream;

      // Determine best supported MIME type
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : 'audio/mp4';

      const recorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 32000, // Keep small for fast upload
      });

      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        chunksRef.current = [];

        if (blob.size < 500) {
          // Too short, ignore
          return;
        }

        // Convert to base64 and send
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64Full = reader.result; // data:audio/webm;...;base64,...
          const base64 = base64Full.split(',')[1];
          const actualMime = mimeType.split(';')[0]; // "audio/webm"
          onResult({ base64, mimeType: actualMime });
        };
        reader.readAsDataURL(blob);
      };

      recorderRef.current = recorder;
      recorder.start(100); // Collect in 100ms chunks
      setIsRecording(true);

      // Duration timer
      setDuration(0);
      timerRef.current = setInterval(() => {
        setDuration(d => d + 1);
      }, 1000);
    } catch (err) {
      console.error('Microphone access error:', err);
    }
  }, [isSupported, disabled, onResult]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        recorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  // Press-and-hold handlers
  const handlePointerDown = (e) => {
    e.preventDefault();
    if (disabled) return;
    start();
  };

  const handlePointerUp = (e) => {
    e.preventDefault();
    if (isRecording) stop();
  };

  const handlePointerLeave = () => {
    if (isRecording) stop();
  };

  const formatDuration = (s) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  if (!isSupported) return null;

  return (
    <>
      <button
        className={`voice-btn ${isRecording ? 'voice-btn--active' : ''}`}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        onContextMenu={(e) => e.preventDefault()}
        disabled={disabled}
        aria-label={isRecording ? 'Release to send' : 'Hold to speak'}
        type="button"
      >
        {isRecording ? <MicOff size={16} /> : <Mic size={16} />}
        {isRecording && (
          <span className="voice-btn__pulse" />
        )}
      </button>
      {isRecording && (
        <div className="voice-interim">
          <span className="voice-interim__dot">●</span>
          <span className="voice-interim__text">录音中 {formatDuration(duration)}</span>
        </div>
      )}
    </>
  );
}
