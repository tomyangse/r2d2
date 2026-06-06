import { create } from 'zustand';
import { supabase } from '../lib/supabase';

export const useStore = create((set, get) => ({
  // --- State ---
  user: null,
  authLoading: true,
  activeTab: 'all',
  reminders: [],
  shoppingItems: [],
  notes: [],
  messages: [],
  projects: [],
  tasks: [],
  taskActiveDomain: 'work',
  taskViewMode: 'kanban',
  isProcessing: false,
  toast: null,
  showCompleted: false,
  realtimeChannels: [],
  ragAnswer: null,
  telegramStatus: null,

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
      notes: [],
      messages: [],
      projects: [],
      tasks: [],
    });
  },

  // --- Tab ---
  setActiveTab: (tab) => set({ activeTab: tab }),

  // --- RAG Q&A ---
  setRagAnswer: (ragAnswer) => set({ ragAnswer }),

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
      const [remindersRes, shoppingRes, messagesRes, notesRes, projectsRes, tasksRes] = await Promise.all([
        supabase.from('reminders').select('*').order('created_at', { ascending: false }),
        supabase.from('shopping_items').select('*').order('created_at', { ascending: false }),
        supabase.from('messages').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('notes').select('*').order('created_at', { ascending: false }),
        supabase.from('projects').select('*').order('created_at', { ascending: false }),
        supabase.from('tasks').select('*').order('created_at', { ascending: false }),
      ]);

      const updates = {};
      if (remindersRes.data) updates.reminders = remindersRes.data;
      if (shoppingRes.data) updates.shoppingItems = shoppingRes.data;
      if (messagesRes.data) updates.messages = messagesRes.data;
      if (notesRes.data) updates.notes = notesRes.data;
      if (projectsRes.data) updates.projects = projectsRes.data;
      if (tasksRes.data) updates.tasks = tasksRes.data;

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

          // When a message completes, show toast/answer and refresh data
          if (updated.status === 'done' && updated.result) {
            const msg = updated.result.message || '处理完成';
            if (updated.result.action === 'QUERY_KNOWLEDGE' && updated.result.data) {
              set({
                ragAnswer: {
                  query: updated.result.data.query,
                  answer: updated.result.data.answer,
                }
              });
            } else {
              get().showToast('success', msg);
            }
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

    // Notes channel — live updates
    const notesChannel = supabase
      .channel('notes-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notes' },
        () => {
          get().refreshNotes();
        }
      )
      .subscribe();

    // Projects channel — live updates
    const projectsChannel = supabase
      .channel('projects-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'projects' },
        () => {
          get().refreshProjects();
        }
      )
      .subscribe();

    // Tasks channel — live updates
    const tasksChannel = supabase
      .channel('tasks-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks' },
        () => {
          get().refreshTasks();
        }
      )
      .subscribe();

    set({
      realtimeChannels: [messagesChannel, remindersChannel, shoppingChannel, notesChannel, projectsChannel, tasksChannel],
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
    await Promise.all([
      get().refreshReminders(),
      get().refreshShopping(),
      get().refreshNotes(),
      get().refreshProjects(),
      get().refreshTasks()
    ]);
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

  refreshNotes: async () => {
    const { data } = await supabase
      .from('notes')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) set({ notes: data });
  },

  refreshProjects: async () => {
    const { data } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) set({ projects: data });
  },

  refreshTasks: async () => {
    const { data } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) set({ tasks: data });
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

  updateReminder: async (id, updates) => {
    // Optimistic update
    set(state => ({
      reminders: state.reminders.map(r =>
        r.id === id ? { ...r, ...updates } : r
      ),
    }));

    const { error } = await supabase.from('reminders').update(updates).eq('id', id);
    if (error) {
      console.error('Update reminder error:', error);
      get().showToast('error', '更新失败，请重试');
      // Revert on error
      get().refreshReminders();
    } else {
      get().showToast('success', '日程已更新');
    }
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

  // --- Notes CRUD ---
  togglePinNote: async (id) => {
    const note = get().notes.find(n => n.id === id);
    if (!note) return;

    const newVal = !note.is_pinned;
    // Optimistic update
    set(state => ({
      notes: state.notes.map(n =>
        n.id === id ? { ...n, is_pinned: newVal } : n
      ),
    }));

    await supabase.from('notes').update({ is_pinned: newVal }).eq('id', id);
  },

  updateNote: async (id, title, content) => {
    // Optimistic update
    set(state => ({
      notes: state.notes.map(n =>
        n.id === id ? { ...n, title, content, updated_at: new Date().toISOString() } : n
      ),
    }));

    await supabase.from('notes').update({ title, content, updated_at: new Date().toISOString() }).eq('id', id);
    get().showToast('success', '已保存修改');
  },

  deleteNote: async (id) => {
    // Optimistic update
    set(state => ({
      notes: state.notes.filter(n => n.id !== id),
    }));
    await supabase.from('notes').delete().eq('id', id);
    get().showToast('success', '记事已删除');
  },

  toggleNoteChecklistItem: async (id, itemIndex) => {
    const note = get().notes.find(n => n.id === id);
    if (!note || note.type !== 'checklist') return;

    // Content represents markdown-style checklists: e.g. "- [ ] item" or "- [x] item"
    const lines = note.content.split('\n');
    let currentIndex = 0;
    
    const newLines = lines.map(line => {
      if (line.trim().startsWith('- [ ]') || line.trim().startsWith('- [x]')) {
        if (currentIndex === itemIndex) {
          currentIndex++;
          if (line.includes('- [ ]')) {
            return line.replace('- [ ]', '- [x]');
          } else {
            return line.replace('- [x]', '- [px]');
          }
        }
        currentIndex++;
      }
      return line;
    });

    const finalLines = newLines.map(line => {
      if (line.includes('- [px]')) {
        return line.replace('- [px]', '- [ ]');
      }
      return line;
    });

    const newContent = finalLines.join('\n');

    // Optimistic update
    set(state => ({
      notes: state.notes.map(n =>
        n.id === id ? { ...n, content: newContent } : n
      ),
    }));

    await supabase.from('notes').update({ content: newContent }).eq('id', id);
  },

  // --- Telegram Binding ---
  loadTelegramStatus: async () => {
    const user = get().user;
    if (!user) return;

    const { data } = await supabase
      .from('telegram_chats')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    set({
      telegramStatus: data
        ? { linked: true, chat_id: data.chat_id, username: data.username, first_name: data.first_name }
        : { linked: false },
    });
  },

  linkTelegram: async (code) => {
    const user = get().user;
    if (!user) return;

    try {
      // 1. Find the link code
      const { data: linkCode, error: findError } = await supabase
        .from('telegram_link_codes')
        .select('*')
        .eq('code', code)
        .eq('used', false)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();

      if (findError || !linkCode) {
        get().showToast('error', '验证码无效或已过期，请重新获取');
        return;
      }

      // 2. Create the binding
      const { error: insertError } = await supabase
        .from('telegram_chats')
        .upsert({
          user_id: user.id,
          chat_id: linkCode.chat_id,
          username: linkCode.username,
          first_name: linkCode.first_name,
          is_active: true,
          linked_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });

      if (insertError) {
        console.error('Link telegram error:', insertError);
        get().showToast('error', '绑定失败，请重试');
        return;
      }

      // 3. Mark code as used
      await supabase
        .from('telegram_link_codes')
        .update({ used: true })
        .eq('id', linkCode.id);

      get().showToast('success', '🎉 Telegram 绑定成功！');
      get().loadTelegramStatus();
    } catch (e) {
      console.error('Link telegram error:', e);
      get().showToast('error', '绑定失败，请重试');
    }
  },

  unlinkTelegram: async () => {
    const user = get().user;
    if (!user) return;

    const { error } = await supabase
      .from('telegram_chats')
      .delete()
      .eq('user_id', user.id);

    if (error) {
      get().showToast('error', '解绑失败');
      return;
    }

    set({ telegramStatus: { linked: false } });
    get().showToast('success', 'Telegram 已解绑');
  },

  // --- Projects & Tasks Setters & CRUD ---
  setTaskActiveDomain: (domain) => set({ taskActiveDomain: domain }),
  setTaskViewMode: (mode) => set({ taskViewMode: mode }),

  addProject: async (title, description, domain, colorTheme = 'indigo', icon = 'Folder') => {
    const user = get().user;
    if (!user) return;

    const newProj = {
      title,
      description,
      domain,
      color_theme: colorTheme,
      icon,
      user_id: user.id
    };

    // Optimistic Update
    const tempId = crypto.randomUUID();
    const tempProj = { ...newProj, id: tempId, is_completed: false, created_at: new Date().toISOString() };
    set(state => ({ projects: [tempProj, ...state.projects] }));

    const { error } = await supabase.from('projects').insert(newProj);
    if (error) {
      console.error('Add project error:', error);
      get().showToast('error', '创建项目失败，请重试');
      get().refreshProjects();
    } else {
      get().showToast('success', '项目已创建');
    }
  },

  updateProject: async (id, updates) => {
    set(state => ({
      projects: state.projects.map(p => p.id === id ? { ...p, ...updates } : p)
    }));

    const { error } = await supabase.from('projects').update(updates).eq('id', id);
    if (error) {
      console.error('Update project error:', error);
      get().showToast('error', '更新项目失败');
      get().refreshProjects();
    } else {
      get().showToast('success', '项目已更新');
    }
  },

  deleteProject: async (id) => {
    set(state => ({
      projects: state.projects.filter(p => p.id !== id),
      tasks: state.tasks.filter(t => t.project_id !== id) // Cascade locally
    }));

    const { error } = await supabase.from('projects').delete().eq('id', id);
    if (error) {
      console.error('Delete project error:', error);
      get().showToast('error', '删除项目失败');
      get().refreshProjects();
      get().refreshTasks();
    } else {
      get().showToast('success', '项目已删除');
    }
  },

  addTask: async (title, description, domain, projectId = null, priority = 'medium', dueDate = null, parentId = null) => {
    const user = get().user;
    if (!user) return;

    let finalDomain = domain;
    if (projectId) {
      const proj = get().projects.find(p => p.id === projectId);
      if (proj) finalDomain = proj.domain;
    } else if (parentId) {
      const parentTask = get().tasks.find(t => t.id === parentId);
      if (parentTask) finalDomain = parentTask.domain;
    }

    const newTask = {
      title,
      description,
      domain: finalDomain,
      project_id: projectId,
      parent_id: parentId,
      priority,
      due_date: dueDate,
      status: 'todo',
      user_id: user.id
    };

    // Optimistic Update
    const tempId = crypto.randomUUID();
    const tempTask = { ...newTask, id: tempId, created_at: new Date().toISOString() };
    set(state => ({ tasks: [tempTask, ...state.tasks] }));

    const { error } = await supabase.from('tasks').insert(newTask);
    if (error) {
      console.error('Add task error:', error);
      get().showToast('error', '添加任务失败，请重试');
      get().refreshTasks();
    } else {
      get().showToast('success', '任务已添加');
    }
  },

  updateTask: async (id, updates) => {
    const task = get().tasks.find(t => t.id === id);
    const currentProjectId = updates.project_id !== undefined ? updates.project_id : (task ? task.project_id : null);
    
    let finalUpdates = { ...updates };
    if (currentProjectId) {
      const proj = get().projects.find(p => p.id === currentProjectId);
      if (proj) finalUpdates.domain = proj.domain;
    }

    set(state => ({
      tasks: state.tasks.map(t => t.id === id ? { ...t, ...finalUpdates } : t)
    }));

    const { error } = await supabase.from('tasks').update(finalUpdates).eq('id', id);
    if (error) {
      console.error('Update task error:', error);
      get().showToast('error', '更新任务失败');
      get().refreshTasks();
    }
  },

  deleteTask: async (id) => {
    set(state => {
      // Find all descendants recursively to delete optimistically
      const idsToDelete = new Set([id]);
      let added = true;
      while (added) {
        added = false;
        state.tasks.forEach(t => {
          if (t.parent_id && idsToDelete.has(t.parent_id) && !idsToDelete.has(t.id)) {
            idsToDelete.add(t.id);
            added = true;
          }
        });
      }
      return {
        tasks: state.tasks.filter(t => !idsToDelete.has(t.id))
      };
    });

    const { error } = await supabase.from('tasks').delete().eq('id', id);
    if (error) {
      console.error('Delete task error:', error);
      get().showToast('error', '删除任务失败');
      get().refreshTasks();
    } else {
      get().showToast('success', '任务已删除');
    }
  },

  toggleTaskStatus: async (id) => {
    const task = get().tasks.find(t => t.id === id);
    if (!task) return;

    // Cycle status: todo -> in_progress -> completed -> todo
    let newStatus = 'todo';
    let completedAt = null;

    if (task.status === 'todo') {
      newStatus = 'in_progress';
    } else if (task.status === 'in_progress') {
      newStatus = 'completed';
      completedAt = new Date().toISOString();
    }

    set(state => ({
      tasks: state.tasks.map(t =>
        t.id === id ? { ...t, status: newStatus, completed_at: completedAt } : t
      )
    }));

    const { error } = await supabase.from('tasks')
      .update({ status: newStatus, completed_at: completedAt })
      .eq('id', id);

    if (error) {
      console.error('Toggle task status error:', error);
      get().refreshTasks();
    } else {
      const toastMsg = newStatus === 'completed' ? '任务已完成'
        : newStatus === 'in_progress' ? '任务进行中'
        : '任务已重置为待办';
      
      // If completed, provide undo option
      if (newStatus === 'completed') {
        get().showToast('success', toastMsg, async () => {
          // Undo action: reset to in_progress
          set(state => ({
            tasks: state.tasks.map(t =>
              t.id === id ? { ...t, status: 'in_progress', completed_at: null } : t
            )
          }));
          await supabase.from('tasks').update({ status: 'in_progress', completed_at: null }).eq('id', id);
        });
      } else {
        get().showToast('success', toastMsg);
      }
    }
  },
}));
