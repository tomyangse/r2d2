import { useState } from 'react';
import { Plus, LogOut, Send } from 'lucide-react';
import { useStore } from '../store/useStore';
import TelegramSettings from './TelegramSettings';

export default function Header() {
  const { activeTab, setActiveTab, reminders, shoppingItems, notes = [], tasks = [], user, signOut } = useStore();
  const [showTelegram, setShowTelegram] = useState(false);

  const pendingReminders = reminders.filter(r => !r.completed).length;
  const pendingItems = shoppingItems.filter(i => !i.checked).length;
  const notesCount = notes.length;
  const pendingTasks = tasks.filter(t => t.status !== 'completed').length;

  return (
    <header className="header">
      {/* Top Row: Brand + Actions */}
      <div className="header__top-row">
        <div className="header__brand">
          <div className="header__logo">R2D</div>
          <div className="header__subtitle">AI Life Assistant</div>
        </div>
        <div className="header__actions">
          <button
            className="header__logout"
            onClick={signOut}
            aria-label="Sign out"
            title={user?.email}
          >
            <LogOut size={15} />
          </button>
          <button
            className="header__telegram-btn"
            onClick={() => setShowTelegram(true)}
            aria-label="Telegram settings"
            title="Telegram 助手"
          >
            <Send size={15} />
          </button>
          <button
            className="header__add-btn"
            aria-label="Add new"
            onClick={() => {
              const input = document.querySelector('.input-bar__input');
              if (input) input.focus();
            }}
          >
            <Plus size={20} strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {showTelegram && <TelegramSettings onClose={() => setShowTelegram(false)} />}

      {/* Tab Bar */}
      <nav className="header__tabs">
        <button
          className={`header__tab ${activeTab === 'all' ? 'header__tab--active' : ''}`}
          onClick={() => setActiveTab('all')}
          aria-label="All tab"
        >
          <span>全部</span>
        </button>
        <button
          className={`header__tab ${activeTab === 'reminders' ? 'header__tab--active' : ''}`}
          onClick={() => setActiveTab('reminders')}
          aria-label="Reminders tab"
        >
          <span>日程</span>
          <span className="header__tab-badge">{pendingReminders}</span>
        </button>
        <button
          className={`header__tab ${activeTab === 'shopping' ? 'header__tab--active' : ''}`}
          onClick={() => setActiveTab('shopping')}
          aria-label="Shopping list tab"
        >
          <span>购物</span>
          <span className="header__tab-badge">{pendingItems}</span>
        </button>
        <button
          className={`header__tab ${activeTab === 'notes' ? 'header__tab--active' : ''}`}
          onClick={() => setActiveTab('notes')}
          aria-label="Notes tab"
        >
          <span>记事</span>
          {notesCount > 0 && <span className="header__tab-badge">{notesCount}</span>}
        </button>
        <button
          className={`header__tab ${activeTab === 'tasks' ? 'header__tab--active' : ''}`}
          onClick={() => setActiveTab('tasks')}
          aria-label="Tasks tab"
        >
          <span>任务</span>
          {pendingTasks > 0 && <span className="header__tab-badge">{pendingTasks}</span>}
        </button>
      </nav>
    </header>
  );
}
