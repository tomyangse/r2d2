import { Clock, CheckCircle2, AlertCircle, Loader } from 'lucide-react';

const STATUS_CONFIG = {
  pending: { icon: Clock, color: 'var(--text-tertiary)', label: '排队中' },
  processing: { icon: Loader, color: 'var(--accent-primary)', label: '处理中' },
  done: { icon: CheckCircle2, color: 'var(--accent-success)', label: '完成' },
  error: { icon: AlertCircle, color: 'var(--accent-danger)', label: '出错' },
};

export default function MessageStatus({ messages }) {
  // Only show pending/processing messages
  const active = messages.filter(m => m.status === 'pending' || m.status === 'processing');
  
  if (active.length === 0) return null;

  return (
    <div className="message-status-list">
      {active.map(msg => {
        const config = STATUS_CONFIG[msg.status] || STATUS_CONFIG.pending;
        const Icon = config.icon;
        
        return (
          <div key={msg.id} className={`message-status message-status--${msg.status}`}>
            <div className="message-status__icon">
              <Icon 
                size={14} 
                color={config.color}
                className={msg.status === 'processing' ? 'spin' : ''}
              />
            </div>
            <div className="message-status__content">
              <span className="message-status__text">{msg.input}</span>
              <span className="message-status__label">{config.label}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
