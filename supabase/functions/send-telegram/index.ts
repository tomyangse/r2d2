import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const NOTIFY_WINDOW_MINUTES = 35;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ============================================
// Telegram API Helper
// ============================================

async function sendTelegramMessage(chatId: number, text: string): Promise<boolean> {
  try {
    const res = await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`sendMessage failed for chat ${chatId}: ${res.status} ${body}`);
      return false;
    }

    return true;
  } catch (err) {
    console.error(`sendMessage error for chat ${chatId}:`, err);
    return false;
  }
}

// ============================================
// Format Reminder Message
// ============================================

function formatReminderMessage(
  title: string,
  datetime: string,
  location: string | null,
  alertType: "30m" | "3m"
): string {
  const dt = new Date(datetime);
  const timeStr = dt.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/Berlin",
  });
  const dateStr = dt.toLocaleDateString("zh-CN", {
    month: "long",
    day: "numeric",
    timeZone: "Europe/Berlin",
  });

  let msg = `⏰ <b>日程提醒</b>\n\n`;
  msg += `📌 ${title}\n`;
  msg += `🕐 ${dateStr} ${timeStr}\n`;

  if (location) {
    msg += `📍 ${location}\n`;
  }

  if (alertType === "3m") {
    msg += `\n⏳ <b>最后提醒</b>：还有 3 分钟就要开始啦！`;
  } else {
    msg += `\n⏳ 还有 30 分钟开始！`;
  }

  return msg;
}

// ============================================
// Main Handler
// ============================================

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const now = new Date();
    const windowEnd = new Date(now.getTime() + NOTIFY_WINDOW_MINUTES * 60 * 1000);

    // 1. Find active Telegram chats
    const { data: chats, error: chatsError } = await supabase
      .from("telegram_chats")
      .select("user_id, chat_id, last_daily_preview_date")
      .eq("is_active", true);

    if (chatsError) {
      console.error("Telegram chats query error:", chatsError);
      return new Response(JSON.stringify({ error: chatsError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!chats || chats.length === 0) {
      return new Response(JSON.stringify({ status: "no_active_chats", count: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Fetch upcoming reminders for active users where at least one notification is not yet sent
    const { data: reminders, error: remindersError } = await supabase
      .from("reminders")
      .select("id, title, datetime, notes, location, user_id, telegram_notified_30m_at, telegram_notified_3m_at")
      .eq("completed", false)
      .not("datetime", "is", null)
      .gte("datetime", now.toISOString())
      .lte("datetime", windowEnd.toISOString())
      .or("telegram_notified_30m_at.is.null,telegram_notified_3m_at.is.null");

    if (remindersError) {
      console.error("Reminders query error:", remindersError);
      return new Response(JSON.stringify({ error: remindersError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Group the active chats
    const chatMap = new Map<string, { chat_id: number; last_daily_preview_date: string | null }>();
    for (const chat of chats) {
      chatMap.set(chat.user_id, {
        chat_id: Number(chat.chat_id),
        last_daily_preview_date: chat.last_daily_preview_date || null
      });
    }

    // Group the reminders by user
    const userReminders: Record<string, typeof reminders> = {};
    if (reminders) {
      for (const r of reminders) {
        if (!chatMap.has(r.user_id)) continue;
        if (!userReminders[r.user_id]) userReminders[r.user_id] = [];
        userReminders[r.user_id].push(r);
      }
    }

    let sentCount = 0;
    let errorCount = 0;

    // Process reminders
    for (const [userId, remindersList] of Object.entries(userReminders)) {
      const chatInfo = chatMap.get(userId)!;
      const chatId = chatInfo.chat_id;

      for (const reminder of remindersList) {
        const dt = new Date(reminder.datetime);
        const minutesUntil = (dt.getTime() - now.getTime()) / (60 * 1000);

        let alertType: "30m" | "3m" | null = null;
        
        // 30-minute reminder check: starts in 15 to 35 minutes
        if (
          minutesUntil >= 15 &&
          minutesUntil <= 35 &&
          !reminder.telegram_notified_30m_at
        ) {
          alertType = "30m";
        }
        // 3-minute reminder check: starts in 0 to 5 minutes
        else if (
          minutesUntil >= 0 &&
          minutesUntil <= 5 &&
          !reminder.telegram_notified_3m_at
        ) {
          alertType = "3m";
        }

        if (alertType) {
          const message = formatReminderMessage(
            reminder.title,
            reminder.datetime,
            reminder.location || null,
            alertType
          );

          const ok = await sendTelegramMessage(chatId, message);

          if (ok) {
            sentCount++;
            console.log(`Telegram ${alertType} reminder sent: ${reminder.id} → chat ${chatId}`);

            const updates: Record<string, string> = {};
            if (alertType === "30m") {
              updates.telegram_notified_30m_at = now.toISOString();
            } else {
              updates.telegram_notified_3m_at = now.toISOString();
            }

            await supabase
              .from("reminders")
              .update(updates)
              .eq("id", reminder.id);
          } else {
            errorCount++;
          }
        }
      }
    }

    // --- 3. Daily Schedule Preview (8:00 AM check) ---
    const berlinDateStr = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Berlin",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(now); // "YYYY-MM-DD"

    const berlinHourStr = new Intl.DateTimeFormat("en-US", {
      timeZone: "Europe/Berlin",
      hour: "numeric",
      hour12: false
    }).format(now); // "8" or "08"
    const berlinHour = parseInt(berlinHourStr, 10);

    if (berlinHour >= 8) {
      for (const chat of chats) {
        if (chat.last_daily_preview_date === berlinDateStr) {
          continue;
        }

        const userId = chat.user_id;
        const chatId = Number(chat.chat_id);

        console.log(`Checking daily schedule preview for user ${userId} at ${berlinDateStr}`);

        // Query reminders for today (using a window of [now - 12h, now + 24h] to scan)
        const startWindow = new Date(now.getTime() - 12 * 60 * 60 * 1000).toISOString();
        const endWindow = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

        const { data: dayReminders, error: dayRemindersError } = await supabase
          .from("reminders")
          .select("id, title, datetime, location, completed")
          .eq("user_id", userId)
          .eq("completed", false)
          .not("datetime", "is", null)
          .gte("datetime", startWindow)
          .lte("datetime", endWindow)
          .order("datetime", { ascending: true });

        if (dayRemindersError) {
          console.error(`Failed to fetch today's reminders for user ${userId}:`, dayRemindersError);
          continue;
        }

        // Filter where the reminder date matches today in Berlin
        const todaysItems = (dayReminders || []).filter(r => {
          const rDateStr = new Intl.DateTimeFormat("en-CA", {
            timeZone: "Europe/Berlin",
            year: "numeric",
            month: "2-digit",
            day: "2-digit"
          }).format(new Date(r.datetime));
          return rDateStr === berlinDateStr;
        });

        if (todaysItems.length > 0) {
          let previewMsg = `☀️ <b>早安！这是您今天的日程预览</b> ☀️\n\n`;
          previewMsg += `📅 <b>今天（${berlinDateStr}）您有 ${todaysItems.length} 个未完成预约：</b>\n\n`;

          todaysItems.forEach((r, idx) => {
            const rTimeStr = new Intl.DateTimeFormat("zh-CN", {
              timeZone: "Europe/Berlin",
              hour: "2-digit",
              minute: "2-digit",
              hour12: false
            }).format(new Date(r.datetime));

            let locStr = "";
            if (r.location) {
              locStr = ` 📍 <i>${r.location}</i>`;
            }

            previewMsg += `${idx + 1}️⃣ <b>${rTimeStr}</b> - ${r.title}${locStr}\n`;
          });

          previewMsg += `\n祝您度过美好的一天！✨`;

          const ok = await sendTelegramMessage(chatId, previewMsg);
          if (ok) {
            console.log(`Sent daily preview to chat ${chatId}`);
            sentCount++;
          } else {
            console.error(`Failed to send daily preview to chat ${chatId}`);
            errorCount++;
          }
        } else {
          console.log(`No reminders found for user ${userId} today (${berlinDateStr}), skipping notification.`);
        }

        // Mark as checked/sent for today so we don't query again
        const { error: updateChatError } = await supabase
          .from("telegram_chats")
          .update({ last_daily_preview_date: berlinDateStr })
          .eq("chat_id", chatId);

        if (updateChatError) {
          console.error(`Failed to update last_daily_preview_date for chat ${chatId}:`, updateChatError);
        }
      }
    }

    return new Response(
      JSON.stringify({ status: "done", sent: sentCount, errors: errorCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("send-telegram error:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
