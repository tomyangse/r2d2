import { useEffect } from 'react';
import Header from './components/Header';
import InputBar from './components/InputBar';
import RemindersView from './components/RemindersView';
import ShoppingList from './components/ShoppingList';
import MessageStatus from './components/MessageStatus';
import Toast from './components/Toast';
import AuthPage from './components/AuthPage';
import { useStore } from './store/useStore';
import { supabase } from './lib/supabase';

export default function App() {
  const {
    user, authLoading, setUser, setAuthLoading,
    activeTab, messages, loadAll, subscribeRealtime, unsubscribeRealtime,
  } = useStore();

  // Listen for auth state changes
  useEffect(() => {
    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });

    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // Load data & subscribe to realtime when user logs in
  useEffect(() => {
    if (!user) return;

    loadAll();
    subscribeRealtime();
    return () => unsubscribeRealtime();
  }, [user]);

  // Loading state
  if (authLoading) {
    return (
      <div className="app" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div className="auth-page__logo" style={{ fontSize: '2rem' }}>R2D</div>
      </div>
    );
  }

  // Not logged in
  if (!user) {
    return <AuthPage />;
  }

  const pendingMessages = messages.filter(
    m => m.status === 'pending' || m.status === 'processing'
  );

  return (
    <div className="app">
      <Header />
      <main className="main-content">
        <MessageStatus messages={pendingMessages} />
        {activeTab === 'reminders' ? <RemindersView /> : <ShoppingList />}
      </main>
      <InputBar />
      <Toast />
    </div>
  );
}
