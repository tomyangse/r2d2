import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { GoogleGenAI } from "https://esm.sh/@google/genai@1";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const geminiApiKey = Deno.env.get("GEMINI_API_KEY")!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const ai = new GoogleGenAI({ apiKey: geminiApiKey });

const SYSTEM_PROMPT = `You are R2D, an AI assistant that manages reminders/schedules, shopping lists, personal notes/memos, and answers knowledge queries based on past records.

Analyze the user's message and return a JSON response.

Possible actions:
1. ADD_REMINDER - Add a reminder/appointment/schedule (supports recurring)
2. ADD_SHOPPING - Add items to shopping list
3. ADD_NOTE - Add a note/memo/thought/password/credentials/general list (not a schedule or shopping item)
4. COMPLETE_REMINDER - Mark reminder as done
5. COMPLETE_SHOPPING - Mark shopping item(s) as done
6. DELETE_REMINDER - Delete a reminder
7. DELETE_SHOPPING - Delete shopping item(s)
8. DELETE_NOTE - Delete a note
9. QUERY_KNOWLEDGE - Search user's database (notes, reminders, schedules) to answer their question (e.g. "WiFi密码是多少", "我记过关于王总的什么吗")
10. UNKNOWN - Cannot understand

Response format (valid JSON only, no markdown):
{
  "action": "ADD_REMINDER" | "ADD_SHOPPING" | "ADD_NOTE" | "COMPLETE_REMINDER" | "COMPLETE_SHOPPING" | "DELETE_REMINDER" | "DELETE_SHOPPING" | "DELETE_NOTE" | "QUERY_KNOWLEDGE" | "UNKNOWN",
  "data": {
    "title": "string (for reminders, and also for notes. For notes, generate a short descriptive title)",
    "datetime": "ISO 8601 string or null (for reminders - the NEXT occurrence time)",
    "notes": "string or null (for reminders)",
    "location": "string or null (for reminders - extract any location/address/place mentioned. Keep it as a clean address or place name suitable for map search, e.g. 'Alexanderplatz, Berlin' or '北京西站' or '123 Main St, NYC')",
    "recurrence": "string or null (for reminders - recurrence pattern)",
    "items": [{"name": "string", "category": "string"}] (for shopping - MUST assign a category),
    "query": "string (for complete/delete actions, and for QUERY_KNOWLEDGE - natural language query)",
    "content": "string (for notes - the body of the note, cleaned up and formatted)",
    "tags": ["string"] (for notes - dynamic tags. e.g., ["密码"], ["灵感"], ["备忘"], ["账单"], ["旅行"], ["生活"], ["工作"]),
    "type": "sticky" | "checklist" | "rich" (for notes - "sticky" for short fragments/credentials/info under 100 chars, "checklist" for list notes, "rich" for long notes/diaries/meeting minutes),
    "color_theme": "amber" | "indigo" | "rose" | "emerald" | "cyan" | "violet" (for notes - choose one depending on notes topic)
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
- "每周日上午10点送女儿画画" → action: ADD_REMINDER, recurrence: "weekly:0", datetime: next Sunday 10:00
- "每天早上8点吃药" → action: ADD_REMINDER, recurrence: "daily", datetime: tomorrow 08:00
- "买苹果和两盒牛奶" → action: ADD_SHOPPING, items: [{"name": "苹果", "category": "果蔬"}, {"name": "牛奶", "category": "乳制品"}]
- "记录一下：大门密码是 2580#" → action: ADD_NOTE, title: "🔑 大门密码", content: "2580#", type: "sticky", tags: ["密码"], color_theme: "amber"
- "旅行打包清单：牙刷、充电线、护照" → action: ADD_NOTE, title: "🎒 旅行打包清单", content: "- 牙刷\n- 充电线\n- 护照", type: "checklist", tags: ["旅行", "清单"], color_theme: "cyan"
- "家里wifi密码是多少？" → action: QUERY_KNOWLEDGE, query: "家里wifi密码是多少？"
- "我之前记录过关于王总会议的什么吗？" → action: QUERY_KNOWLEDGE, query: "我之前记录过关于王总会议的什么吗？"
- "下周我有什么安排？" → action: QUERY_KNOWLEDGE, query: "下周我有什么安排？"
- "明天下午3点在星巴克见客户" → action: ADD_REMINDER, title: "见客户", datetime: "...", location: "星巴克"
- "6月1号带孩子去Alexanderplatz看牙医" → action: ADD_REMINDER, title: "带孩子看牙医", datetime: "...", location: "Alexanderplatz"
- "remind me dentist at Schönhauser Allee 10 at 3pm" → action: ADD_REMINDER, title: "Dentist", datetime: "...", location: "Schönhauser Allee 10"

Rules:
- Respond in the SAME LANGUAGE the user used
- Route questions/queries about their recorded details, passwords, wifi, diary, schedules, or past meetings to QUERY_KNOWLEDGE
- ONLY output valid JSON

Shopping categories (MUST use one of these exact values):
Grocery categories (日常超市):
- "果蔬" = fruits, vegetables, salad, herbs
- "肉类" = meat, poultry, minced meat
- "鱼虾海鲜" = fish, shrimp, seafood
- "乳制品" = milk, cheese, yogurt, cream, butter
- "蛋类" = eggs
- "面包烘焙" = bread, pastries, flour, baking
- "冷冻食品" = frozen meals, ice cream, frozen vegetables
- "饮料" = juice, soda, water, coffee, tea
- "零食" = chips, candy, chocolate, nuts
- "调味品" = oil, vinegar, spices, soy sauce, ketchup
- "粮油干货" = rice, pasta, noodles, canned food, cereal
- "家用日化" = detergent, soap, toilet paper, cleaning
- "个护" = shampoo, toothpaste, skincare
- "婴幼儿" = baby food, diapers
- "宠物" = pet food, pet supplies
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
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

    // Extract text — handle both property and candidates array
    let text = "";
    try {
      text = response.text?.trim() || "";
    } catch {
      // Fallback: extract from candidates
      const parts = response?.candidates?.[0]?.content?.parts;
      if (parts) {
        text = parts
          .filter((p: any) => p.text && !p.thought)
          .map((p: any) => p.text)
          .join("")
          .trim();
      }
    }

    console.log("Gemini raw response text:", text.substring(0, 300));

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No valid JSON in Gemini response: " + text.substring(0, 300));
    }

    const result = JSON.parse(jsonMatch[0]);

    // 4. Execute the action (attach user_id to all inserts)
    switch (result.action) {
      case "ADD_REMINDER": {
        const { title, datetime, notes, recurrence, location } = result.data;
        await supabase.from("reminders").insert({
          title,
          datetime: datetime || null,
          notes: notes || null,
          location: location || null,
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

      case "ADD_NOTE": {
        const { title, content, tags, type, color_theme } = result.data;
        await supabase.from("notes").insert({
          title: title || "无标题记事",
          content: content || "",
          tags: tags || [],
          type: type || "sticky",
          color_theme: color_theme || "indigo",
          is_pinned: false,
          user_id: userId,
        });
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

      case "DELETE_NOTE": {
        const query = result.data.query?.toLowerCase() || "";
        const { data: notes } = await supabase
          .from("notes")
          .select("*")
          .eq("user_id", userId);

        const match = notes?.find((n: { title: string; content: string }) =>
          n.title.toLowerCase().includes(query) || n.content.toLowerCase().includes(query)
        );
        if (match) {
          await supabase.from("notes").delete().eq("id", match.id);
        }
        break;
      }

      case "QUERY_KNOWLEDGE": {
        const queryText = result.data.query || message.input;

        // 1. Fetch user's knowledge base (all notes and reminders)
        const [notesRes, remindersRes] = await Promise.all([
          supabase.from("notes").select("title, content, tags").eq("user_id", userId),
          supabase.from("reminders").select("title, datetime, notes").eq("user_id", userId),
        ]);

        const notes = notesRes.data || [];
        const reminders = remindersRes.data || [];

        // 2. Format knowledge base as context string
        const contextStr = [
          "Here is the user's personal database context:",
          "=== NOTES ===",
          notes.map((n, i) => `[Note #${i+1}] Title: "${n.title}"\nTags: ${JSON.stringify(n.tags)}\nContent:\n${n.content}`).join("\n\n"),
          "=== REMINDERS & SCHEDULES ===",
          reminders.map((r, i) => `[Reminder #${i+1}] Title: "${r.title}"\nTime: ${r.datetime || "No time specified"}\nNotes: ${r.notes || "None"}`).join("\n\n"),
        ].join("\n\n");

        // 3. Ask Gemini to answer the user's question using this context
        const RAG_SYSTEM_PROMPT = `You are R2D's semantic search and question answering engine.
Answer the user's question based strictly on the provided user database context.
Be direct, helpful, and answer in a friendly, conversational tone in the user's language.
If the database context does not contain the answer, politely say so. Do not hallucinate or make up facts.`;

        const responseRAG = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: [
            { text: contextStr },
            { text: `User question: "${queryText}"` }
          ],
          config: {
            systemInstruction: RAG_SYSTEM_PROMPT,
            temperature: 0.2,
            maxOutputTokens: 800,
            thinkingConfig: { thinkingBudget: 0 },
          },
        });

        let answer = "";
        try {
          answer = responseRAG.text?.trim() || "";
        } catch {
          const parts = responseRAG?.candidates?.[0]?.content?.parts;
          if (parts) {
            answer = parts
              .filter((p: any) => p.text && !p.thought)
              .map((p: any) => p.text)
              .join("")
              .trim();
          }
        }

        // 4. Update the result data with the generated answer
        result.data = {
          query: queryText,
          answer: answer || "未找到相关记录。"
        };
        // Update confirmation message
        result.message = answer || "查询完成";
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
