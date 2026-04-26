import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { GoogleGenAI } from "https://esm.sh/@google/genai@1";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const geminiApiKey = Deno.env.get("GEMINI_API_KEY")!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const ai = new GoogleGenAI({ apiKey: geminiApiKey });

const SYSTEM_PROMPT = `You are R2D, an AI assistant that manages reminders/schedules and shopping lists.

Analyze the user's message and return a JSON response.

Possible actions:
1. ADD_REMINDER - Add a reminder/appointment/schedule (supports recurring)
2. ADD_SHOPPING - Add items to shopping list
3. COMPLETE_REMINDER - Mark reminder as done
4. COMPLETE_SHOPPING - Mark shopping item(s) as done
5. DELETE_REMINDER - Delete a reminder
6. DELETE_SHOPPING - Delete shopping item(s)
7. UNKNOWN - Cannot understand

Response format (valid JSON only, no markdown):
{
  "action": "ADD_REMINDER" | "ADD_SHOPPING" | "COMPLETE_REMINDER" | "COMPLETE_SHOPPING" | "DELETE_REMINDER" | "DELETE_SHOPPING" | "UNKNOWN",
  "data": {
    "title": "string (for reminders)",
    "datetime": "ISO 8601 string or null (for reminders - the NEXT occurrence time)",
    "notes": "string or null (for reminders)",
    "recurrence": "string or null (for reminders - recurrence pattern)",
    "items": [{"name": "string", "category": "string"}] (for shopping - MUST assign a category),
    "query": "string (for complete/delete - fuzzy match text)"
  },
  "message": "Brief friendly confirmation in the user's language"
}

Recurrence patterns:
- null = one-time (default)
- "daily" = every day
- "weekdays" = Monday to Friday
- "weekly:0" = every Sunday, "weekly:1" = every Monday, ..., "weekly:6" = every Saturday
- "biweekly:0" to "biweekly:6" = every other week on that day
- "monthly:15" = every month on the 15th

Examples:
- "每周日上午10点送女儿画画" → recurrence: "weekly:0", datetime: next Sunday 10:00
- "每天早上8点吃药" → recurrence: "daily", datetime: tomorrow 08:00
- "工作日下午5点打卡" → recurrence: "weekdays", datetime: next weekday 17:00
- "每月15号交房租" → recurrence: "monthly:15", datetime: next 15th
- "明天下午3点开会" → recurrence: null, datetime: tomorrow 15:00

Rules:
- Respond in the SAME LANGUAGE the user used
- Parse relative dates: "明天" = tomorrow, "下周三" = next Wednesday, "今天下午3点" = today 3pm
- For recurring reminders, set datetime to the NEXT occurrence
- If no time specified, datetime = null
- Split comma/、-separated shopping items into individual entries
- ONLY output valid JSON

Shopping categories (MUST use one of these exact values):
Grocery categories (日常超市):
- "果蔬" = fruits, vegetables, salad, herbs (Frukt & Grönt)
- "肉类" = meat, poultry, minced meat (Kött & Fågel)
- "鱼虾海鲜" = fish, shrimp, seafood (Fisk & Skaldjur)
- "乳制品" = milk, cheese, yogurt, cream, butter (Mejeri)
- "蛋类" = eggs (Ägg)
- "面包烘焙" = bread, pastries, flour, baking (Bröd & Bageri)
- "冷冻食品" = frozen meals, ice cream, frozen vegetables (Fryst)
- "饮料" = juice, soda, water, coffee, tea (Drycker)
- "零食" = chips, candy, chocolate, nuts (Snacks & Godis)
- "调味品" = oil, vinegar, spices, soy sauce, ketchup (Kryddor & Såser)
- "粮油干货" = rice, pasta, noodles, canned food, cereal (Skafferi)
- "家用日化" = detergent, soap, toilet paper, cleaning (Hem & Hushåll)
- "个护" = shampoo, toothpaste, skincare (Hygien)
- "婴幼儿" = baby food, diapers (Baby)
- "宠物" = pet food, pet supplies (Husdjur)
Non-grocery categories (非日常用品):
- "电子产品" = electronics, cables, batteries
- "家具家居" = furniture, decoration, storage
- "工具五金" = tools, hardware, screws
- "服装鞋帽" = clothing, shoes, accessories
- "其他" = anything that doesn't fit above`;


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let parsedMessageId: string | null = null;

  try {
    const { message_id, timezone, image, audio } = await req.json();
    parsedMessageId = message_id;

    if (!message_id) {
      return new Response(JSON.stringify({ error: "message_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Fetch the message
    const { data: message, error: fetchError } = await supabase
      .from("messages")
      .select("*")
      .eq("id", message_id)
      .single();

    if (fetchError || !message) {
      return new Response(JSON.stringify({ error: "Message not found", detail: fetchError }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Skip if already processed
    if (message.status !== "pending") {
      return new Response(JSON.stringify({ status: "already_processed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user_id from the message record
    const userId = message.user_id;

    // 2. Mark as processing
    await supabase
      .from("messages")
      .update({ status: "processing" })
      .eq("id", message_id);

    // 3. Call Gemini
    const tz = timezone || "UTC";
    const now = new Date().toLocaleString("sv-SE", { timeZone: tz, hour12: false }) + ` (${tz})`;
    const prompt = SYSTEM_PROMPT + `\n\nCurrent date/time: ${now}\nUser timezone: ${tz}\nIMPORTANT: All datetime values in the response MUST use the user's timezone offset. For ${tz}, output datetimes like: 2026-04-26T15:00:00+02:00 (NOT UTC/Z).`;

    // Build multimodal contents: text + optional image/audio
    const contentParts: any[] = [];
    if (image?.base64 && image?.mimeType) {
      contentParts.push({
        inlineData: {
          data: image.base64,
          mimeType: image.mimeType,
        },
      });
    }
    if (audio?.base64 && audio?.mimeType) {
      contentParts.push({
        inlineData: {
          data: audio.base64,
          mimeType: audio.mimeType,
        },
      });
      // For voice input, override the text prompt to instruct Gemini to listen
      contentParts.push({ text: "Please listen to this audio recording. The user is giving you a voice command. Understand what they said and respond according to the system instructions. If the audio is unclear or too short, return action UNKNOWN." });
    } else {
      contentParts.push({ text: message.input });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: contentParts,
      config: {
        systemInstruction: prompt,
        temperature: 0.1,
        maxOutputTokens: 500,
      },
    });

    const text = response.text?.trim() || "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No valid JSON in Gemini response: " + text.substring(0, 200));
    }

    const result = JSON.parse(jsonMatch[0]);

    // 4. Execute the action (attach user_id to all inserts)
    switch (result.action) {
      case "ADD_REMINDER": {
        const { title, datetime, notes, recurrence } = result.data;
        await supabase.from("reminders").insert({
          title,
          datetime: datetime || null,
          notes: notes || null,
          recurrence: recurrence || null,
          completed: false,
          user_id: userId,
        });
        break;
      }

      case "ADD_SHOPPING": {
        const items = result.data.items || [];
        if (items.length > 0) {
          await supabase.from("shopping_items").insert(
            items.map((item: { name: string; category?: string }) => ({
              name: item.name,
              category: item.category || null,
              checked: false,
              user_id: userId,
            }))
          );
        }
        break;
      }

      case "COMPLETE_REMINDER": {
        const query = result.data.query?.toLowerCase() || "";
        const { data: reminders } = await supabase
          .from("reminders")
          .select("*")
          .eq("completed", false)
          .eq("user_id", userId);

        const match = reminders?.find((r: { title: string }) =>
          r.title.toLowerCase().includes(query)
        );
        if (match) {
          await supabase
            .from("reminders")
            .update({ completed: true })
            .eq("id", match.id);
        }
        break;
      }

      case "COMPLETE_SHOPPING": {
        const query = result.data.query?.toLowerCase() || "";
        const { data: items } = await supabase
          .from("shopping_items")
          .select("*")
          .eq("checked", false)
          .eq("user_id", userId);

        const match = items?.find((i: { name: string }) =>
          i.name.toLowerCase().includes(query)
        );
        if (match) {
          await supabase
            .from("shopping_items")
            .update({ checked: true })
            .eq("id", match.id);
        }
        break;
      }

      case "DELETE_REMINDER": {
        const query = result.data.query?.toLowerCase() || "";
        const { data: reminders } = await supabase
          .from("reminders")
          .select("*")
          .eq("user_id", userId);

        const match = reminders?.find((r: { title: string }) =>
          r.title.toLowerCase().includes(query)
        );
        if (match) {
          await supabase.from("reminders").delete().eq("id", match.id);
        }
        break;
      }

      case "DELETE_SHOPPING": {
        const query = result.data.query?.toLowerCase() || "";
        const { data: items } = await supabase
          .from("shopping_items")
          .select("*")
          .eq("user_id", userId);

        const match = items?.find((i: { name: string }) =>
          i.name.toLowerCase().includes(query)
        );
        if (match) {
          await supabase.from("shopping_items").delete().eq("id", match.id);
        }
        break;
      }

      default:
        // UNKNOWN — just save the result
        break;
    }

    // 5. Mark as done
    await supabase
      .from("messages")
      .update({
        status: "done",
        result,
        processed_at: new Date().toISOString(),
      })
      .eq("id", message_id);

    return new Response(JSON.stringify({ success: true, result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Edge function error:", error);

    // Mark message as error
    if (parsedMessageId) {
      try {
        await supabase
          .from("messages")
          .update({
            status: "error",
            error: String(error),
            processed_at: new Date().toISOString(),
          })
          .eq("id", parsedMessageId);
      } catch {
        // ignore
      }
    }

    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
