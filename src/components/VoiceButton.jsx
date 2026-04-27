import { useState, useRef, useCallback, useEffect } from 'react';
import { Mic, MicOff } from 'lucide-react';

export default function VoiceButton({ onResult, disabled }) {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const streamRef = useRef(null);
  const pointerDownRef = useRef(false); // Track if finger/mouse is still held

  // Check if MediaRecorder is supported
  const isSupported = typeof MediaRecorder !== 'undefined' && navigator.mediaDevices?.getUserMedia;

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    pointerDownRef.current = false;

    // Stop timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // Stop recorder — onstop callback will handle the blob and stream cleanup
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      console.log('[Voice] Stopping recorder, state:', recorderRef.current.state);
      recorderRef.current.stop();
    } else {
      // Recorder never started or already inactive — clean up stream
      console.log('[Voice] Recorder already inactive, cleaning up stream');
      stopStream();
    }

    setIsRecording(false);
    setDuration(0);
  }, [stopStream]);

  const start = useCallback(async () => {
    if (!isSupported || disabled) return;

    pointerDownRef.current = true;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      // If user already released while we were waiting for mic permission, abort
      if (!pointerDownRef.current) {
        console.log('[Voice] Pointer released during getUserMedia, aborting');
        stream.getTracks().forEach(t => t.stop());
        return;
      }

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
        console.log('[Voice] onstop fired, chunks:', chunksRef.current.length);
        const blob = new Blob(chunksRef.current, { type: mimeType });
        chunksRef.current = [];

        // Clean up stream after data is collected
        stopStream();

        console.log('[Voice] Blob size:', blob.size, 'type:', blob.type);

        if (blob.size < 100) {
          // Too short, ignore
          console.log('[Voice] Blob too small, ignoring');
          return;
        }

        // Convert to base64 and send
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64Full = reader.result;
          const base64 = base64Full.split(',')[1];
          const actualMime = mimeType.split(';')[0]; // "audio/webm"
          console.log('[Voice] Sending audio, base64 length:', base64?.length, 'mime:', actualMime);
          onResult({ base64, mimeType: actualMime });
        };
        reader.onerror = (err) => {
          console.error('[Voice] FileReader error:', err);
          stopStream();
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
      pointerDownRef.current = false;
    }
  }, [isSupported, disabled, onResult, stopStream]);

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
    // Always call stop — it checks pointerDownRef and recorder state internally
    stop();
  };

  const handlePointerLeave = () => {
    if (pointerDownRef.current) stop();
  };

  // Also listen for global pointerup in case finger moves off button
  useEffect(() => {
    const handleGlobalPointerUp = () => {
      if (pointerDownRef.current) {
        stop();
      }
    };
    window.addEventListener('pointerup', handleGlobalPointerUp);
    return () => window.removeEventListener('pointerup', handleGlobalPointerUp);
  }, [stop]);

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
        style={{ touchAction: 'none' }}
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
