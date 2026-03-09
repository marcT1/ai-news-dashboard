/**
 * writeJson.js
 * Assembles final payload and writes to /data/latest.json
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = join(__dirname, '..', 'data', 'latest.json');

export function writeOutputJson({
  topNews,
  trendingTopics,
  toolLaunches,
  redditSignals,
  research,
  funding,
  dailyBrief,
}) {
  const payload = {
    generatedAt: new Date().toISOString(),
    topNews:       topNews.map(sanitizeItem),
    trendingTopics,
    toolLaunches:  toolLaunches.map(sanitizeItem),
    redditSignals: redditSignals.map(sanitizeReddit),
    research:      research.map(sanitizeItem),
    funding:       funding.map(sanitizeItem),
    dailyBrief,
    meta: {
      topNewsCount:       topNews.length,
      trendingTopicsCount: trendingTopics.length,
      toolLaunchesCount:  toolLaunches.length,
      redditSignalsCount: redditSignals.length,
      researchCount:      research.length,
      fundingCount:       funding.length,
    },
  };

  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, JSON.stringify(payload, null, 2), 'utf-8');
  console.log(`[writeJson] Wrote ${OUTPUT_PATH}`);
  return payload;
}

function sanitizeItem(item) {
  return {
    id:            item.id,
    title:         item.title,
    url:           item.url,
    source:        item.source,
    publishedAt:   item.publishedAt,
    score:         item.score,
    scoreBreakdown: item.scoreBreakdown,
    summary:       item.summary || null,
    rawTextSnippet: item.rawTextSnippet?.slice(0, 300) || '',
    cluster:       item.cluster || null,
  };
}

function sanitizeReddit(item) {
  return {
    ...sanitizeItem(item),
    redditMeta: item.redditMeta || null,
  };
}
