import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const NOTIFY_BEFORE_MINUTES = 5;

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
  minutesUntil: number
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

  msg += `\n⏳ 还有 ${Math.max(1, Math.round(minutesUntil))} 分钟开始！`;

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
    const windowEnd = new Date(now.getTime() + NOTIFY_BEFORE_MINUTES * 60 * 1000);

    // 1. Find upcoming reminders not yet notified via Telegram
    const { data: reminders, error: remindersError } = await supabase
      .from("reminders")
      .select("id, title, datetime, notes, location, user_id")
      .eq("completed", false)
      .is("telegram_notified_at", null)
      .not("datetime", "is", null)
      .lte("datetime", windowEnd.toISOString())
      .gte("datetime", now.toISOString());

    if (remindersError) {
      console.error("Reminders query error:", remindersError);
      return new Response(JSON.stringify({ error: remindersError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!reminders || reminders.length === 0) {
      return new Response(JSON.stringify({ status: "no_pending", count: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Found ${reminders.length} reminders for Telegram notification`);

    // 2. Group reminders by user_id
    const byUser: Record<string, typeof reminders> = {};
    for (const r of reminders) {
      if (!byUser[r.user_id]) byUser[r.user_id] = [];
      byUser[r.user_id].push(r);
    }

    let sentCount = 0;
    let errorCount = 0;

    // 3. For each user, check if they have an active Telegram binding
    for (const [userId, userReminders] of Object.entries(byUser)) {
      const { data: telegramChat } = await supabase
        .from("telegram_chats")
        .select("chat_id, is_active")
        .eq("user_id", userId)
        .single();

      if (!telegramChat || !telegramChat.is_active) {
        console.log(`No active Telegram chat for user ${userId}, skipping`);
        continue;
      }

      const chatId = telegramChat.chat_id;

      // 4. Send a message for each reminder
      for (const reminder of userReminders) {
        const dt = new Date(reminder.datetime);
        const minutesUntil = (dt.getTime() - now.getTime()) / (60 * 1000);

        const message = formatReminderMessage(
          reminder.title,
          reminder.datetime,
          reminder.location || null,
          minutesUntil
        );

        const ok = await sendTelegramMessage(chatId, message);

        if (ok) {
          sentCount++;
          console.log(`Telegram reminder sent: ${reminder.id} → chat ${chatId}`);

          // 5. Mark as notified via Telegram
          await supabase
            .from("reminders")
            .update({ telegram_notified_at: new Date().toISOString() })
            .eq("id", reminder.id);
        } else {
          errorCount++;
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
