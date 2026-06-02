import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Send, LinkIcon, Unlink, CheckCircle2, Loader2, Copy } from 'lucide-react';
import { useStore } from '../store/useStore';

export default function TelegramSettings({ onClose }) {
  const { telegramStatus, loadTelegramStatus, linkTelegram, unlinkTelegram, showToast } = useStore();
  const [isClosing, setIsClosing] = useState(false);
  const [linkCode, setLinkCode] = useState('');
  const [isLinking, setIsLinking] = useState(false);

  useEffect(() => {
    loadTelegramStatus();
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => onClose(), 200);
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) handleClose();
  };

  const handleLink = async () => {
    if (!linkCode.trim() || linkCode.trim().length !== 6) {
      showToast('error', '请输入6位验证码');
      return;
    }
    setIsLinking(true);
    try {
      await linkTelegram(linkCode.trim());
    } finally {
      setIsLinking(false);
      setLinkCode('');
    }
  };

  const handleUnlink = async () => {
    if (confirm('确认解绑 Telegram 机器人？解绑后将不再收到 Telegram 提醒。')) {
      await unlinkTelegram();
    }
  };

  const isLinked = telegramStatus?.linked;

  return createPortal(
    <div
      className={`tg-settings-overlay ${isClosing ? 'tg-settings-overlay--closing' : ''}`}
      onClick={handleOverlayClick}
    >
      <div className={`tg-settings ${isClosing ? 'tg-settings--closing' : ''}`}>
        {/* Accent bar */}
        <div className="tg-settings__accent-bar" />

        {/* Header */}
        <div className="tg-settings__header">
          <div className="tg-settings__header-left">
            <Send size={20} className="tg-settings__icon" />
            <h2 className="tg-settings__title">Telegram 助手</h2>
          </div>
          <button className="tg-settings__close" onClick={handleClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="tg-settings__body">
          {isLinked ? (
            /* Linked state */
            <div className="tg-settings__linked">
              <div className="tg-settings__status">
                <CheckCircle2 size={40} className="tg-settings__status-icon" />
                <div className="tg-settings__status-info">
                  <span className="tg-settings__status-label">已绑定</span>
                  <span className="tg-settings__status-name">
                    {telegramStatus.first_name || telegramStatus.username || 'Telegram 用户'}
                  </span>
                </div>
              </div>

              <div className="tg-settings__features">
                <div className="tg-settings__feature">
                  <span>💬</span>
                  <span>通过 Telegram 发送消息管理日程、购物、记事</span>
                </div>
                <div className="tg-settings__feature">
                  <span>⏰</span>
                  <span>日程到期时自动推送 Telegram 提醒</span>
                </div>
                <div className="tg-settings__feature">
                  <span>🔍</span>
                  <span>随时查询你的记录</span>
                </div>
              </div>

              <button className="tg-settings__unlink-btn" onClick={handleUnlink}>
                <Unlink size={14} />
                <span>解除绑定</span>
              </button>
            </div>
          ) : (
            /* Unlinked state — binding flow */
            <div className="tg-settings__unlinked">
              <div className="tg-settings__steps">
                <div className="tg-settings__step">
                  <span className="tg-settings__step-num">1</span>
                  <div className="tg-settings__step-content">
                    <span className="tg-settings__step-title">打开 Telegram，搜索机器人</span>
                    <span className="tg-settings__step-desc">找到 R2D 助手 Bot 并发送 <code>/start</code></span>
                  </div>
                </div>
                <div className="tg-settings__step">
                  <span className="tg-settings__step-num">2</span>
                  <div className="tg-settings__step-content">
                    <span className="tg-settings__step-title">获取验证码</span>
                    <span className="tg-settings__step-desc">机器人会回复一个 6 位数字验证码</span>
                  </div>
                </div>
                <div className="tg-settings__step">
                  <span className="tg-settings__step-num">3</span>
                  <div className="tg-settings__step-content">
                    <span className="tg-settings__step-title">输入验证码完成绑定</span>
                    <span className="tg-settings__step-desc">在下方输入验证码，即刻开启 Telegram 助手</span>
                  </div>
                </div>
              </div>

              <div className="tg-settings__link-form">
                <input
                  className="tg-settings__code-input"
                  type="text"
                  value={linkCode}
                  onChange={e => setLinkCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="输入 6 位验证码"
                  maxLength={6}
                  onKeyDown={e => { if (e.key === 'Enter') handleLink(); }}
                  autoFocus
                />
                <button
                  className="tg-settings__link-btn"
                  onClick={handleLink}
                  disabled={isLinking || linkCode.length !== 6}
                >
                  {isLinking ? (
                    <Loader2 size={16} className="tg-settings__spinner" />
                  ) : (
                    <>
                      <LinkIcon size={14} />
                      <span>绑定</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
