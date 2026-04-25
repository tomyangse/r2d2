/**
 * Local intent parser — fallback when Gemini is not available.
 * Handles basic Chinese + English commands via keyword matching.
 */

const SHOPPING_KEYWORDS_ZH = ['买', '购买', '采购', '购物', '加入清单', '添加', '需要买'];
const SHOPPING_KEYWORDS_EN = ['buy', 'get', 'shop', 'add to list', 'need', 'grocery', 'shopping'];
const REMINDER_KEYWORDS_ZH = ['提醒', '预约', '约', '记得', '别忘', '安排', '日程', '会议'];
const REMINDER_KEYWORDS_EN = ['remind', 'schedule', 'appointment', 'meeting', 'don\'t forget', 'remember'];
const DELETE_KEYWORDS = ['删除', '删掉', '去掉', '移除', 'delete', 'remove', 'cancel', '取消'];
const COMPLETE_KEYWORDS = ['完成', '搞定', '买了', '做了', '好了', 'done', 'complete', 'checked', 'finish'];

function containsAny(text, keywords) {
  const lower = text.toLowerCase();
  return keywords.some(k => lower.includes(k));
}

function extractTimeFromText(text) {
  const now = new Date();
  
  // Chinese relative dates
  if (text.includes('今天')) {
    // keep today
  } else if (text.includes('明天')) {
    now.setDate(now.getDate() + 1);
  } else if (text.includes('后天')) {
    now.setDate(now.getDate() + 2);
  } else if (text.includes('下周')) {
    now.setDate(now.getDate() + 7);
  }
  
  // English relative dates
  const lower = text.toLowerCase();
  if (lower.includes('tomorrow')) {
    now.setDate(now.getDate() + 1);
  } else if (lower.includes('next week')) {
    now.setDate(now.getDate() + 7);
  }
  
  // Extract time patterns like "3点", "15:00", "3pm"
  const zhTimeMatch = text.match(/(\d{1,2})(?::(\d{2}))?(?:点|時)/);
  const enTimeMatch = text.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
  const milTimeMatch = text.match(/(\d{1,2}):(\d{2})/);
  
  if (zhTimeMatch) {
    let hours = parseInt(zhTimeMatch[1]);
    const minutes = zhTimeMatch[2] ? parseInt(zhTimeMatch[2]) : 0;
    if (text.includes('下午') || text.includes('晚上')) {
      if (hours < 12) hours += 12;
    }
    now.setHours(hours, minutes, 0, 0);
  } else if (enTimeMatch) {
    let hours = parseInt(enTimeMatch[1]);
    const minutes = enTimeMatch[2] ? parseInt(enTimeMatch[2]) : 0;
    if (enTimeMatch[3].toLowerCase() === 'pm' && hours < 12) hours += 12;
    if (enTimeMatch[3].toLowerCase() === 'am' && hours === 12) hours = 0;
    now.setHours(hours, minutes, 0, 0);
  } else if (milTimeMatch) {
    now.setHours(parseInt(milTimeMatch[1]), parseInt(milTimeMatch[2]), 0, 0);
  } else {
    return null;
  }
  
  return now.toISOString();
}

function extractShoppingItems(text) {
  // Remove known prefixes
  let cleaned = text;
  [...SHOPPING_KEYWORDS_ZH, ...SHOPPING_KEYWORDS_EN].forEach(k => {
    cleaned = cleaned.replace(new RegExp(k, 'gi'), '');
  });
  
  // Split by common delimiters
  const items = cleaned
    .split(/[,，、;；\n]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0 && s.length < 50);
  
  return items.map(name => ({ name, category: null }));
}

function extractReminderTitle(text) {
  let cleaned = text;
  [...REMINDER_KEYWORDS_ZH, ...REMINDER_KEYWORDS_EN].forEach(k => {
    cleaned = cleaned.replace(new RegExp(k, 'gi'), '');
  });
  
  // Remove time-related words
  cleaned = cleaned
    .replace(/今天|明天|后天|下周[一二三四五六日]?/g, '')
    .replace(/上午|下午|晚上|早上/g, '')
    .replace(/\d{1,2}[点時:]\d{0,2}/g, '')
    .replace(/tomorrow|today|next week/gi, '')
    .replace(/\d{1,2}:\d{2}/g, '')
    .replace(/\d{1,2}\s*(am|pm)/gi, '')
    .replace(/[我要去]/g, '')
    .trim();
  
  return cleaned || text.trim();
}

export function parseLocally(input) {
  const text = input.trim();
  
  if (!text) {
    return { action: 'UNKNOWN', data: {}, message: '请输入内容' };
  }
  
  // Check for delete/complete first
  if (containsAny(text, DELETE_KEYWORDS)) {
    const isShoppingContext = containsAny(text, [...SHOPPING_KEYWORDS_ZH, ...SHOPPING_KEYWORDS_EN, '清单', 'list']);
    return {
      action: isShoppingContext ? 'DELETE_SHOPPING' : 'DELETE_REMINDER',
      data: { query: text },
      message: '已处理删除请求'
    };
  }
  
  if (containsAny(text, COMPLETE_KEYWORDS)) {
    const isShoppingContext = containsAny(text, [...SHOPPING_KEYWORDS_ZH, ...SHOPPING_KEYWORDS_EN, '清单', 'list']);
    return {
      action: isShoppingContext ? 'COMPLETE_SHOPPING' : 'COMPLETE_REMINDER',
      data: { query: text },
      message: '已标记完成'
    };
  }
  
  // Shopping intent
  if (containsAny(text, SHOPPING_KEYWORDS_ZH) || containsAny(text, SHOPPING_KEYWORDS_EN)) {
    const items = extractShoppingItems(text);
    if (items.length > 0) {
      return {
        action: 'ADD_SHOPPING',
        data: { items },
        message: `已添加 ${items.length} 项到购物清单`
      };
    }
  }
  
  // Reminder intent
  if (containsAny(text, REMINDER_KEYWORDS_ZH) || containsAny(text, REMINDER_KEYWORDS_EN)) {
    const datetime = extractTimeFromText(text);
    const title = extractReminderTitle(text);
    return {
      action: 'ADD_REMINDER',
      data: { title, datetime, notes: null },
      message: `已添加提醒: ${title}`
    };
  }
  
  // Default: try to be smart about it
  // If it looks like a list of items (has commas), treat as shopping
  if (text.includes('，') || text.includes(',') || text.includes('、')) {
    const items = text
      .split(/[,，、]+/)
      .map(s => s.trim())
      .filter(s => s.length > 0 && s.length < 50)
      .map(name => ({ name, category: null }));
    
    if (items.length >= 2) {
      return {
        action: 'ADD_SHOPPING',
        data: { items },
        message: `已添加 ${items.length} 项到购物清单`
      };
    }
  }
  
  // If it has time-related words, treat as reminder
  const datetime = extractTimeFromText(text);
  if (datetime) {
    return {
      action: 'ADD_REMINDER',
      data: { title: extractReminderTitle(text), datetime, notes: null },
      message: `已添加提醒`
    };
  }
  
  return {
    action: 'UNKNOWN',
    data: {},
    message: '我不太确定你想做什么。试试说 "提醒我..." 或 "买..."'
  };
}
