import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ============================================
// Telegram API Helper
// ============================================

async function sendTelegramMessage(chatId: number, text: string): Promise<void> {
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
    console.error(`sendMessage failed: ${res.status} ${body}`);
  }
}

// ============================================
// Command Handlers
// ============================================

/**
 * /start — Generate a 6-digit link code for binding Telegram to a R2D account
 */
async function handleStart(chatId: number, username?: string, firstName?: string): Promise<void> {
  // Generate a random 6-digit code
  const code = String(Math.floor(100000 + Math.random() * 900000));

  // Invalidate any previous unused codes for this chat
  await supabase
    .from("telegram_link_codes")
    .update({ used: true })
    .eq("chat_id", chatId)
    .eq("used", false);

  // Store the new code
  const { error } = await supabase.from("telegram_link_codes").insert({
    code,
    chat_id: chatId,
    username: username || null,
    first_name: firstName || null,
  });

  if (error) {
    console.error("Failed to insert link code:", error);
    await sendTelegramMessage(chatId, "❌ 生成验证码失败，请稍后重试。");
    return;
  }

  await sendTelegramMessage(
    chatId,
    `🔗 <b>绑定 R2D 账户</b>\n\n` +
    `你的验证码是：<code>${code}</code>\n\n` +
    `请在 10 分钟内到 R2D 网页端「设置」页面输入此验证码完成绑定。\n\n` +
    `绑定后即可直接在 Telegram 中发送消息管理你的日程、购物清单和备忘录。`
  );
}

/**
 * /help — Usage instructions
 */
async function handleHelp(chatId: number): Promise<void> {
  await sendTelegramMessage(
    chatId,
    `📖 <b>R2D Bot 使用指南</b>\n\n` +
    `1️⃣ 发送 /start 获取验证码，在网页端绑定账户\n` +
    `2️⃣ 绑定后，直接发送文字消息即可：\n\n` +
    `  💬 <i>"明天下午3点开会"</i> → 添加日程\n` +
    `  💬 <i>"买牛奶和面包"</i> → 添加购物清单\n` +
    `  💬 <i>"记一下WiFi密码是abc123"</i> → 添加备忘\n` +
    `  💬 <i>"WiFi密码是多少？"</i> → 查询记录\n\n` +
    `📌 其他命令：\n` +
    `  /status — 查看账户绑定状态\n` +
    `  /help — 显示此帮助信息`
  );
}

/**
 * /status — Check if Telegram is linked to a R2D account
 */
async function handleStatus(chatId: number): Promise<void> {
  const { data: chat } = await supabase
    .from("telegram_chats")
    .select("user_id, is_active, linked_at")
    .eq("chat_id", chatId)
    .single();

  if (!chat) {
    await sendTelegramMessage(
      chatId,
      `❌ 当前 Telegram 未绑定任何 R2D 账户。\n\n发送 /start 获取验证码进行绑定。`
    );
    return;
  }

  const linkedDate = new Date(chat.linked_at).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  await sendTelegramMessage(
    chatId,
    `✅ <b>已绑定 R2D 账户</b>\n\n` +
    `📅 绑定时间：${linkedDate}\n` +
    `📡 状态：${chat.is_active ? "活跃" : "已暂停"}`
  );
}

// ============================================
// Message Processing
// ============================================

/**
 * Handle a regular text message:
 * 1. Look up linked user
 * 2. Insert into messages table
 * 3. Invoke process-message Edge Function
 * 4. Poll for completion
 * 5. Reply with AI result
 */
async function handleTextMessage(chatId: number, text: string): Promise<void> {
  // 1. Look up linked user
  const { data: chat } = await supabase
    .from("telegram_chats")
    .select("user_id, is_active")
    .eq("chat_id", chatId)
    .single();

  if (!chat) {
    await sendTelegramMessage(
      chatId,
      `🔒 请先绑定 R2D 账户。\n发送 /start 获取验证码。`
    );
    return;
  }

  if (!chat.is_active) {
    await sendTelegramMessage(chatId, `⏸️ 你的 Telegram 连接已暂停，请在网页端重新启用。`);
    return;
  }

  const userId = chat.user_id;

  // 2. Insert message
  const { data: newMsg, error: insertErr } = await supabase
    .from("messages")
    .insert({
      input: text,
      source: "telegram",
      status: "pending",
      user_id: userId,
    })
    .select("id")
    .single();

  if (insertErr || !newMsg) {
    console.error("Failed to insert message:", insertErr);
    await sendTelegramMessage(chatId, "❌ 消息处理失败，请稍后重试。");
    return;
  }

  const messageId = newMsg.id;

  // 3. Invoke process-message Edge Function via direct HTTP
  // process-message runs synchronously and returns { success, result } in the response
  try {
    const fnUrl = `${supabaseUrl}/functions/v1/process-message`;
    const invokeRes = await fetch(fnUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify({ message_id: messageId, timezone: "Europe/Berlin" }),
    });

    if (!invokeRes.ok) {
      const errBody = await invokeRes.text();
      console.error("process-message invoke failed:", invokeRes.status, errBody);
      await sendTelegramMessage(chatId, "❌ AI 处理失败，请稍后重试。");
      return;
    }

    // 4. Read the result directly from the response
    const responseData = await invokeRes.json();
    console.log("process-message response:", JSON.stringify(responseData).substring(0, 300));

    const replyMessage = responseData?.result?.message;
    if (replyMessage) {
      await sendTelegramMessage(chatId, replyMessage);
    } else {
      await sendTelegramMessage(chatId, "✅ 已处理完成。");
    }
  } catch (invokeErr) {
    console.error("process-message invocation error:", invokeErr);
    await sendTelegramMessage(chatId, "❌ AI 处理失败，请稍后重试。");
    return;
  }
}

// ============================================
// Main Webhook Handler
// ============================================

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const update = await req.json();
    console.log("Telegram update:", JSON.stringify(update).substring(0, 300));

    // Only handle text messages
    const message = update.message;
    if (!message?.text) {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const chatId: number = message.chat.id;
    const text: string = message.text.trim();
    const username: string | undefined = message.from?.username;
    const firstName: string | undefined = message.from?.first_name;

    // Route commands
    if (text === "/start" || text.startsWith("/start ")) {
      await handleStart(chatId, username, firstName);
    } else if (text === "/help") {
      await handleHelp(chatId);
    } else if (text === "/status") {
      await handleStatus(chatId);
    } else if (text.startsWith("/")) {
      // Unknown command
      await sendTelegramMessage(chatId, `❓ 未知命令。发送 /help 查看可用命令。`);
    } else {
      // Regular text message — process through AI pipeline
      await handleTextMessage(chatId, text);
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("telegram-bot error:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
