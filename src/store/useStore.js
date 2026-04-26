import { create } from 'zustand';
import { supabase } from '../lib/supabase';

export const useStore = create((set, get) => ({
  // --- State ---
  user: null,
  authLoading: true,
  activeTab: 'all',
  reminders: [],
  shoppingItems: [],
  messages: [],
  isProcessing: false,
  toast: null,
  showCompleted: false,
  realtimeChannels: [],

  // --- Auth ---
  setUser: (user) => set({ user }),
  setAuthLoading: (loading) => set({ authLoading: loading }),

  signUp: async (email, password) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    return { data, error };
  },

  signIn: async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    return { data, error };
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({
      user: null,
      reminders: [],
      shoppingItems: [],
      messages: [],
    });
  },

  // --- Tab ---
  setActiveTab: (tab) => set({ activeTab: tab }),

  // --- Toast ---
  showToast: (type, message, onUndo = null) => {
    set({ toast: { type, message, onUndo } });
    const duration = onUndo ? 5000 : 3000;
    setTimeout(() => {
      set(state => {
        // Only clear if same toast is still showing
        if (state.toast?.message === message) return { toast: null };
        return {};
      });
    }, duration);
  },

  // ==================================
  // Message Flow (async, fire-and-forget)
  // ==================================

  sendMessage: async (input, source = 'text', image = null, audio = null) => {
    if (!input.trim() && !image && !audio) return;
    const user = get().user;
    if (!user) return;

    set({ isProcessing: true });

    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({ input: input.trim(), source, status: 'pending', user_id: user.id })
        .select()
        .single();

      if (error) throw error;

      // Add to local messages list immediately
      set(state => ({
        messages: [data, ...state.messages],
      }));

      // Fire-and-forget: invoke Edge Function directly
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const body = { message_id: data.id, timezone };
      if (image) {
        body.image = image; // { base64, mimeType }
      }
      if (audio) {
        body.audio = audio; // { base64, mimeType }
      }
      supabase.functions.invoke('process-message', {
        body,
      }).then(res => {
        console.log('Edge function response:', res);
        if (res.error) console.error('Edge function error:', res.error);
      }).catch(err => console.error('Edge function invoke failed:', err));

      const toastMsg = source === 'voice' ? '🎤 语音指令已发送' 
        : source === 'image' ? '📷 图片已发送，识别中...' 
        : '✨ 已发送，后台处理中...';
      get().showToast('success', toastMsg);
    } catch (error) {
      console.error('Send message error:', error);
      get().showToast('error', '发送失败，请重试');
    } finally {
      set({ isProcessing: false });
    }
  },

  // ==================================
  // Data Loading
  // ==================================

  loadAll: async () => {
    try {
      const [remindersRes, shoppingRes, messagesRes] = await Promise.all([
        supabase.from('reminders').select('*').order('created_at', { ascending: false }),
        supabase.from('shopping_items').select('*').order('created_at', { ascending: false }),
        supabase.from('messages').select('*').order('created_at', { ascending: false }).limit(50),
      ]);

      const updates = {};
      if (remindersRes.data) updates.reminders = remindersRes.data;
      if (shoppingRes.data) updates.shoppingItems = shoppingRes.data;
      if (messagesRes.data) updates.messages = messagesRes.data;

      set(updates);
    } catch (e) {
      console.warn('Failed to load from Supabase:', e);
    }
  },

  // ==================================
  // Realtime Subscriptions
  // ==================================

  subscribeRealtime: () => {
    // Messages channel — watch for status updates
    const messagesChannel = supabase
      .channel('messages-changes')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages' },
        (payload) => {
          const updated = payload.new;
          set(state => ({
            messages: state.messages.map(m =>
              m.id === updated.id ? updated : m
            ),
          }));

          // When a message completes, show toast and refresh data
          if (updated.status === 'done' && updated.result) {
            const msg = updated.result.message || '处理完成';
            get().showToast('success', msg);
            // Refresh affected data
            get().refreshData();
          } else if (updated.status === 'error') {
            get().showToast('error', updated.error || '处理出错');
          }
        }
      )
      .subscribe();

    // Reminders channel — live updates
    const remindersChannel = supabase
      .channel('reminders-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reminders' },
        () => {
          get().refreshReminders();
        }
      )
      .subscribe();

    // Shopping channel — live updates
    const shoppingChannel = supabase
      .channel('shopping-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shopping_items' },
        () => {
          get().refreshShopping();
        }
      )
      .subscribe();

    set({
      realtimeChannels: [messagesChannel, remindersChannel, shoppingChannel],
    });
  },

  unsubscribeRealtime: () => {
    const { realtimeChannels } = get();
    realtimeChannels.forEach(ch => supabase.removeChannel(ch));
    set({ realtimeChannels: [] });
  },

  // ==================================
  // Refresh helpers
  // ==================================

  refreshData: async () => {
    await Promise.all([get().refreshReminders(), get().refreshShopping()]);
  },

  refreshReminders: async () => {
    const { data } = await supabase
      .from('reminders')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) set({ reminders: data });
  },

  refreshShopping: async () => {
    const { data } = await supabase
      .from('shopping_items')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) set({ shoppingItems: data });
  },

  // ==================================
  // Direct CRUD (for UI interactions like checkbox toggle)
  // ==================================

  toggleReminder: async (id) => {
    const reminder = get().reminders.find(r => r.id === id);
    if (!reminder) return;

    const newVal = !reminder.completed;
    // Optimistic update
    set(state => ({
      reminders: state.reminders.map(r =>
        r.id === id ? { ...r, completed: newVal } : r
      ),
    }));

    await supabase.from('reminders').update({ completed: newVal }).eq('id', id);

    // Show undo toast when marking complete
    if (newVal) {
      get().showToast('success', '已标记完成', () => {
        get().toggleReminder(id);
      });
    }
  },

  postponeReminder: async (id) => {
    const reminder = get().reminders.find(r => r.id === id);
    if (!reminder || !reminder.datetime) return;

    const current = new Date(reminder.datetime);
    const tomorrow = new Date(current);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const newDatetime = tomorrow.toISOString();

    // Optimistic update
    set(state => ({
      reminders: state.reminders.map(r =>
        r.id === id ? { ...r, datetime: newDatetime } : r
      ),
    }));

    await supabase.from('reminders').update({ datetime: newDatetime }).eq('id', id);
    get().showToast('success', '已移到明天');
  },

  deleteReminder: async (id) => {
    // Optimistic update
    set(state => ({
      reminders: state.reminders.filter(r => r.id !== id),
    }));
    await supabase.from('reminders').delete().eq('id', id);
  },

  toggleShoppingItem: async (id) => {
    const item = get().shoppingItems.find(i => i.id === id);
    if (!item) return;

    const newVal = !item.checked;
    set(state => ({
      shoppingItems: state.shoppingItems.map(i =>
        i.id === id ? { ...i, checked: newVal } : i
      ),
    }));

    await supabase.from('shopping_items').update({ checked: newVal }).eq('id', id);
  },

  deleteShoppingItem: async (id) => {
    set(state => ({
      shoppingItems: state.shoppingItems.filter(i => i.id !== id),
    }));
    await supabase.from('shopping_items').delete().eq('id', id);
  },

  toggleShowCompleted: () => set(state => ({ showCompleted: !state.showCompleted })),
}));
