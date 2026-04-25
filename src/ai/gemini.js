import { GoogleGenAI } from '@google/genai';

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

let ai = null;
if (apiKey) {
  ai = new GoogleGenAI({ apiKey });
}

const SYSTEM_PROMPT = `You are R2D, an AI assistant that helps manage reminders/schedules and shopping lists.

When the user sends a message, analyze it and return a JSON response with these possible actions:

1. ADD_REMINDER - Add a reminder/appointment/schedule item
2. ADD_SHOPPING - Add items to the shopping list
3. COMPLETE_REMINDER - Mark a reminder as done
4. COMPLETE_SHOPPING - Mark shopping item(s) as done
5. DELETE_REMINDER - Delete a reminder
6. DELETE_SHOPPING - Delete shopping item(s)
7. UNKNOWN - Cannot understand the intent

Response format (ALWAYS respond with valid JSON only, no markdown):
{
  "action": "ADD_REMINDER" | "ADD_SHOPPING" | "COMPLETE_REMINDER" | "COMPLETE_SHOPPING" | "DELETE_REMINDER" | "DELETE_SHOPPING" | "UNKNOWN",
  "data": {
    // For ADD_REMINDER:
    "title": "string",
    "datetime": "ISO 8601 string or null",
    "notes": "string or null"
    
    // For ADD_SHOPPING:
    "items": [{"name": "string", "category": "string or null"}]
    
    // For COMPLETE/DELETE:
    "query": "string to match against existing items"
  },
  "message": "Brief friendly confirmation message in the same language the user used"
}

Current date/time: {{CURRENT_TIME}}

Important rules:
- Always respond in the SAME LANGUAGE the user writes in
- For dates, interpret relative terms like "明天" (tomorrow), "下周三" (next Wednesday), "今天下午3点" (today 3pm)
- If no time is specified for a reminder, set datetime to null
- For shopping, split comma-separated or listed items into individual entries
- Be concise in your confirmation message
- ONLY output valid JSON, nothing else`;

export async function parseWithGemini(input) {
  if (!ai) {
    throw new Error('Gemini API key not configured');
  }

  const now = new Date().toISOString();
  const prompt = SYSTEM_PROMPT.replace('{{CURRENT_TIME}}', now);

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: input,
      config: {
        systemInstruction: prompt,
        temperature: 0.1,
        maxOutputTokens: 500,
      },
    });

    const text = response.text.trim();
    
    // Try to extract JSON from the response
    let jsonStr = text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }
    
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error('Gemini parsing error:', error);
    throw error;
  }
}

export function isGeminiConfigured() {
  return !!apiKey;
}
