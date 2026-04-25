import { useState } from 'react';
import { Loader, Mail, Lock, ArrowRight, UserPlus, LogIn } from 'lucide-react';
import { useStore } from '../store/useStore';

export default function AuthPage() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, signUp } = useStore();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password.trim()) {
      setError('请填写邮箱和密码');
      return;
    }

    if (password.length < 6) {
      setError('密码至少需要 6 位');
      return;
    }

    setLoading(true);
    try {
      if (isSignUp) {
        const { error: err } = await signUp(email, password);
        if (err) throw err;
      } else {
        const { error: err } = await signIn(email, password);
        if (err) throw err;
      }
    } catch (err) {
      const msg = err.message || String(err);
      if (msg.includes('Invalid login')) {
        setError('邮箱或密码不正确');
      } else if (msg.includes('already registered')) {
        setError('该邮箱已注册，请直接登录');
      } else if (msg.includes('Email not confirmed')) {
        setError('请先确认邮箱（检查收件箱）');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-page__container">
        {/* Logo */}
        <div className="auth-page__header">
          <div className="auth-page__logo">R2D</div>
          <div className="auth-page__subtitle">
            AI 驱动的日程 & 购物助手
          </div>
        </div>

        {/* Form */}
        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-form__field">
            <div className="auth-form__icon">
              <Mail size={16} />
            </div>
            <input
              id="auth-email"
              type="email"
              className="auth-form__input"
              placeholder="邮箱地址"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              disabled={loading}
            />
          </div>

          <div className="auth-form__field">
            <div className="auth-form__icon">
              <Lock size={16} />
            </div>
            <input
              id="auth-password"
              type="password"
              className="auth-form__input"
              placeholder="密码（至少 6 位）"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
              disabled={loading}
            />
          </div>

          {error && (
            <div className="auth-form__error animate-fade-in">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="auth-form__submit"
            disabled={loading}
          >
            {loading ? (
              <Loader size={16} className="spin" />
            ) : (
              <>
                {isSignUp ? <UserPlus size={16} /> : <LogIn size={16} />}
                <span>{isSignUp ? '注册' : '登录'}</span>
                <ArrowRight size={14} />
              </>
            )}
          </button>
        </form>

        {/* Toggle */}
        <div className="auth-page__toggle">
          <span className="auth-page__toggle-text">
            {isSignUp ? '已有账号？' : '还没有账号？'}
          </span>
          <button
            className="auth-page__toggle-btn"
            onClick={() => { setIsSignUp(!isSignUp); setError(''); }}
            type="button"
          >
            {isSignUp ? '立即登录' : '立即注册'}
          </button>
        </div>
      </div>
    </div>
  );
}
