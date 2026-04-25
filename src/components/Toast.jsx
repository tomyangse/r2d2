import { useEffect } from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { useStore } from '../store/useStore';

export default function Toast() {
  const { toast } = useStore();

  if (!toast) return null;

  return (
    <div className={`ai-toast ai-toast--${toast.type}`}>
      <div className="ai-toast__icon">
        {toast.type === 'success' ? (
          <CheckCircle2 size={20} color="var(--accent-success)" />
        ) : (
          <AlertCircle size={20} color="var(--accent-danger)" />
        )}
      </div>
      <span className="ai-toast__message">{toast.message}</span>
    </div>
  );
}
