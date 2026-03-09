/**
 * summarize.js
 * Uses OpenAI-compatible API to generate 3-bullet summaries for top items
 * and a daily brief paragraph.
 */

import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL || undefined,
});

const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function callLLM(prompt, maxTokens = 300, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await client.chat.completions.create({
        model: MODEL,
        max_tokens: maxTokens,
        temperature: 0.3,
        messages: [{ role: 'user', content: prompt }],
      });
      return res.choices[0]?.message?.content?.trim() || '';
    } catch (err) {
      console.warn(`[LLM] Attempt ${attempt}/${retries} failed: ${err.message}`);
      if (attempt < retries) {
        // Exponential backoff; respect rate limits
        const wait = attempt * 3000 + (err?.status === 429 ? 10000 : 0);
        await sleep(wait);
      } else {
        throw err;
      }
    }
  }
}

function buildSummaryPrompt(item) {
  return `You are an AI business intelligence analyst. Summarize the following news item in exactly 3 bullets, total ≤ 60 words.

Bullet format:
• What happened: [one concise sentence]
• Why it matters: [one concise sentence]
• Business opportunity: [one concise sentence]

News title: ${item.title}
Source: ${item.source}
Snippet: ${item.rawTextSnippet?.slice(0, 400) || '(no snippet)'}

Respond with ONLY the 3 bullets. No preamble.`;
}

function buildBriefPrompt(topItems) {
  const headlines = topItems
    .map((item, i) => `${i + 1}. ${item.title} (${item.source})`)
    .join('\n');

  return `You are an AI news editor writing a daily 1-minute brief for a business professional.
Write a flowing 3–5 sentence paragraph (≤ 150 words) covering today's top AI stories.
Be specific, data-driven, and highlight business implications.

Today's top stories:
${headlines}

Respond with ONLY the paragraph. No title, no bullets.`;
}

export async function summarizeItems(topItems) {
  console.log(`[summarize] Summarizing ${topItems.length} items…`);
  const summarized = [];

  for (const item of topItems) {
    try {
      const bullets = await callLLM(buildSummaryPrompt(item), 200);
      summarized.push({ ...item, summary: bullets });
      // Polite rate-limit spacing
      await sleep(800);
    } catch (err) {
      console.error(`[summarize] Failed for "${item.title}": ${err.message}`);
      summarized.push({
        ...item,
        summary: `• What happened: ${item.title}\n• Why it matters: See full article.\n• Business opportunity: Monitor developments in this space.`,
      });
    }
  }

  return summarized;
}

export async function generateDailyBrief(topItems) {
  console.log('[summarize] Generating daily brief…');
  try {
    return await callLLM(buildBriefPrompt(topItems.slice(0, 5)), 250);
  } catch (err) {
    console.error(`[summarize] Daily brief failed: ${err.message}`);
    return topItems
      .slice(0, 5)
      .map((item) => item.title)
      .join('. ') + '.';
  }
}
