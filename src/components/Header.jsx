import { Plus, LogOut } from 'lucide-react';
import { useStore } from '../store/useStore';

export default function Header() {
  const { activeTab, setActiveTab, reminders, shoppingItems, user, signOut } = useStore();

  const pendingReminders = reminders.filter(r => !r.completed).length;
  const pendingItems = shoppingItems.filter(i => !i.checked).length;

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
            className="header__add-btn"
            aria-label="Add new"
            onClick={() => {
              // Focus the input bar
              const input = document.querySelector('.input-bar__input');
              if (input) input.focus();
            }}
          >
            <Plus size={20} strokeWidth={1.5} />
          </button>
        </div>
      </div>

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
          {pendingReminders > 0 && (
            <span className="header__tab-badge">{pendingReminders}</span>
          )}
        </button>
        <button
          className={`header__tab ${activeTab === 'shopping' ? 'header__tab--active' : ''}`}
          onClick={() => setActiveTab('shopping')}
          aria-label="Shopping list tab"
        >
          <span>购物</span>
          {pendingItems > 0 && (
            <span className="header__tab-badge">{pendingItems}</span>
          )}
        </button>
      </nav>
    </header>
  );
}
