import knowledgeFile from '../data/knowledge.json' with { type: 'json' };
import { normalize } from './catalog.mjs';

function compact(value = '') {
  return normalize(value).replace(/\s+/g, ' ').trim();
}

export function knowledgeResponse(message, shopBaseUrl) {
  const text = compact(message);
  if (!text) return null;
  let best = null;
  for (const entry of knowledgeFile.entries) {
    const score = entry.keywords.reduce((total, keyword) => {
      const normalizedKeyword = compact(keyword);
      const tokens = normalizedKeyword.split(' ');
      if (text.includes(normalizedKeyword)) return total + tokens.length + 2;
      const messageTokens = new Set(text.split(' '));
      if (tokens.length >= 2 && tokens.every((token) => messageTokens.has(token))) return total + tokens.length;
      return total;
    }, 0);
    if (score > Number(best?.score || 0)) best = { entry, score };
  }
  if (!best?.score) return null;
  return {
    text: best.entry.answer,
    link: {
      label: best.entry.label,
      url: new URL(best.entry.path, shopBaseUrl).toString()
    },
    topic: best.entry.id
  };
}

export const knowledgeStats = Object.freeze({
  entries: knowledgeFile.entries.length,
  version: knowledgeFile.version
});
