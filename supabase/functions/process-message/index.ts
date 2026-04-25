import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { GoogleGenAI } from "https://esm.sh/@google/genai@0.14";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const geminiApiKey = Deno.env.get("GEMINI_API_KEY")!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const ai = new GoogleGenAI({ apiKey: geminiApiKey });

const SYSTEM_PROMPT = `You are R2D, an AI assistant that manages reminders/schedules and shopping lists.

Analyze the user's message and return a JSON response.

Possible actions:
1. ADD_REMINDER - Add a reminder/appointment/schedule
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
    "datetime": "ISO 8601 string or null (for reminders)",
    "notes": "string or null (for reminders)",
    "items": [{"name": "string", "category": "string or null"}] (for shopping),
    "query": "string (for complete/delete - fuzzy match text)"
  },
  "message": "Brief friendly confirmation in the user's language"
}

Rules:
- Respond in the SAME LANGUAGE the user used
- Parse relative dates: "明天" = tomorrow, "下周三" = next Wednesday, "今天下午3点" = today 3pm
- If no time specified, datetime = null
- Split comma/、-separated shopping items into individual entries
- ONLY output valid JSON`;

Deno.serve(async (req: Request) => {
  try {
    const { message_id } = await req.json();

    if (!message_id) {
      return new Response(JSON.stringify({ error: "message_id required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 1. Fetch the message
    const { data: message, error: fetchError } = await supabase
      .from("messages")
      .select("*")
      .eq("id", message_id)
      .single();

    if (fetchError || !message) {
      return new Response(JSON.stringify({ error: "Message not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Skip if already processed
    if (message.status !== "pending") {
      return new Response(JSON.stringify({ status: "already_processed" }), {
        headers: { "Content-Type": "application/json" },
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
    const now = new Date().toISOString();
    const prompt = SYSTEM_PROMPT + `\n\nCurrent date/time: ${now}`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: message.input,
      config: {
        systemInstruction: prompt,
        temperature: 0.1,
        maxOutputTokens: 500,
      },
    });

    const text = response.text?.trim() || "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No valid JSON in Gemini response");
    }

    const result = JSON.parse(jsonMatch[0]);

    // 4. Execute the action (attach user_id to all inserts)
    switch (result.action) {
      case "ADD_REMINDER": {
        const { title, datetime, notes } = result.data;
        await supabase.from("reminders").insert({
          title,
          datetime: datetime || null,
          notes: notes || null,
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
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    // Mark as error
    try {
      const { message_id } = await req.clone().json();
      if (message_id) {
        await supabase
          .from("messages")
          .update({
            status: "error",
            error: String(error),
            processed_at: new Date().toISOString(),
          })
          .eq("id", message_id);
      }
    } catch {
      // ignore
    }

    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
