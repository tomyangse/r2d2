import { Bell, ShoppingCart, LogOut } from 'lucide-react';
import { useStore } from '../store/useStore';

export default function Header() {
  const { activeTab, setActiveTab, reminders, shoppingItems, user, signOut } = useStore();

  const pendingReminders = reminders.filter(r => !r.completed).length;
  const pendingItems = shoppingItems.filter(i => !i.checked).length;

  return (
    <header className="header">
      <div className="header__logo">R2D</div>
      <nav className="header__tabs">
        <button
          className={`header__tab ${activeTab === 'reminders' ? 'header__tab--active' : ''}`}
          onClick={() => setActiveTab('reminders')}
          aria-label="Reminders tab"
        >
          <Bell size={14} />
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
          <ShoppingCart size={14} />
          <span>购物</span>
          {pendingItems > 0 && (
            <span className="header__tab-badge">{pendingItems}</span>
          )}
        </button>
      </nav>
      <button
        className="header__logout"
        onClick={signOut}
        aria-label="Sign out"
        title={user?.email}
      >
        <LogOut size={16} />
      </button>
    </header>
  );
}
