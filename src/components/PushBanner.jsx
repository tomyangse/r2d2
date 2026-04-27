import { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { isPushSupported, isPushSubscribed, subscribeToPush, getPermissionStatus } from '../lib/pushNotifications';
import { useStore } from '../store/useStore';

export default function PushBanner() {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const showToast = useStore(s => s.showToast);

  useEffect(() => {
    // Only show banner if push is supported, permission not yet decided, and not subscribed
    async function check() {
      if (!isPushSupported()) return;
      const permission = getPermissionStatus();
      if (permission === 'denied') return;  // User already blocked, don't nag
      if (permission === 'granted') {
        // Already granted — ensure subscription exists
        const subscribed = await isPushSubscribed();
        if (!subscribed) {
          // Permission granted but no subscription — silently re-subscribe
          try { await subscribeToPush(); } catch { /* ignore */ }
        }
        return;
      }
      // permission === 'default' — show the banner
      setVisible(true);
    }
    check();
  }, []);

  const handleEnable = async () => {
    setLoading(true);
    try {
      await subscribeToPush();
      showToast('success', '🔔 通知已开启，到时间会提醒你');
      setVisible(false);
    } catch (err) {
      if (err.message?.includes('denied')) {
        showToast('error', '通知权限被拒绝，可在浏览器设置中开启');
      } else {
        showToast('error', '开启通知失败: ' + err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = () => {
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="push-banner">
      <div className="push-banner__content">
        <Bell size={18} className="push-banner__icon" />
        <span className="push-banner__text">开启通知提醒，到时间自动提醒你</span>
      </div>
      <div className="push-banner__actions">
        <button
          className="push-banner__btn push-banner__btn--enable"
          onClick={handleEnable}
          disabled={loading}
        >
          {loading ? '开启中...' : '开启'}
        </button>
        <button
          className="push-banner__btn push-banner__btn--dismiss"
          onClick={handleDismiss}
        >
          稍后
        </button>
      </div>
    </div>
  );
}
