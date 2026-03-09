/**
 * fetchSources.js
 * Fetches AI news from RSS feeds, Reddit, HN, arXiv, and GitHub.
 * Returns a normalized array of items.
 */

import { XMLParser } from 'fast-xml-parser';
import fetch from 'node-fetch';

// ─── Constants ────────────────────────────────────────────────────────────────

const RSS_FEEDS = [
  { name: 'MIT Technology Review', url: 'https://www.technologyreview.com/feed/', authority: 18 },
  { name: 'VentureBeat AI',        url: 'https://venturebeat.com/category/ai/feed/', authority: 16 },
  { name: 'TechCrunch AI',         url: 'https://techcrunch.com/category/artificial-intelligence/feed/', authority: 16 },
  { name: 'OpenAI Blog',           url: 'https://openai.com/blog/rss.xml', authority: 20 },
  { name: 'DeepMind Blog',         url: 'https://deepmind.google/blog/rss.xml', authority: 20 },
  { name: 'Anthropic Blog',        url: 'https://www.anthropic.com/rss.xml', authority: 20 },
];

const REDDIT_SUBS = ['artificial', 'MachineLearning', 'AGI', 'OpenAI'];

const HN_QUERIES = ['AI', 'LLM', 'agent', 'OpenAI', 'Anthropic', 'DeepMind', 'Gemini'];

const ARXIV_CATEGORIES = ['cs.AI', 'cs.CL', 'stat.ML'];

const DELAY_MS = 1200; // polite throttle between requests

// ─── Helpers ──────────────────────────────────────────────────────────────────

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchWithRetry(url, opts = {}, retries = 3) {
  const headers = {
    'User-Agent': 'AINewsDashboard/1.0 (github.com/your-org/ai-news-dashboard)',
    ...opts.headers,
  };
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { ...opts, headers, timeout: 15000 });
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return res;
    } catch (err) {
      console.warn(`[fetch] Attempt ${attempt}/${retries} failed for ${url}: ${err.message}`);
      if (attempt < retries) await sleep(attempt * 2000);
      else throw err;
    }
  }
}

function normalizeUrl(url) {
  try {
    const u = new URL(url);
    u.search = '';
    u.hash = '';
    return u.toString().replace(/\/+$/, '').toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

function parseDate(str) {
  if (!str) return new Date();
  const d = new Date(str);
  return isNaN(d.getTime()) ? new Date() : d;
}

function snippet(text, max = 300) {
  if (!text) return '';
  const clean = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return clean.length > max ? clean.slice(0, max) + '…' : clean;
}

let _idCounter = 0;
function makeId(prefix) {
  return `${prefix}-${Date.now()}-${_idCounter++}`;
}

// ─── RSS ──────────────────────────────────────────────────────────────────────

async function fetchRSS() {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
  const items = [];

  for (const feed of RSS_FEEDS) {
    try {
      console.log(`[RSS] Fetching ${feed.name}…`);
      const res = await fetchWithRetry(feed.url);
      const xml = await res.text();
      const parsed = parser.parse(xml);

      const channel = parsed?.rss?.channel || parsed?.feed;
      if (!channel) { console.warn(`[RSS] No channel found for ${feed.name}`); continue; }

      // Support both RSS <item> and Atom <entry>
      const rawItems = channel.item || channel.entry || [];
      const list = Array.isArray(rawItems) ? rawItems : [rawItems];

      for (const item of list.slice(0, 20)) {
        const title = item.title?.['#text'] || item.title || '';
        const url   = item.link?.['#text'] || item.link?.href || item.link || item.id || '';
        const pub   = item.pubDate || item.published || item.updated || '';
        const desc  = item.description?.['#text'] || item.description ||
                      item.summary?.['#text']     || item.summary     ||
                      item.content?.['#text']     || item.content     || '';

        if (!title || !url) continue;

        items.push({
          id: makeId('rss'),
          title: String(title).trim(),
          url: String(url).trim(),
          source: feed.name,
          publishedAt: parseDate(pub).toISOString(),
          scoreSignals: { sourceAuthority: feed.authority },
          rawTextSnippet: snippet(String(desc)),
        });
      }

      await sleep(DELAY_MS);
    } catch (err) {
      console.error(`[RSS] Error fetching ${feed.name}: ${err.message}`);
    }
  }

  console.log(`[RSS] Fetched ${items.length} items.`);
  return items;
}

// ─── Reddit ───────────────────────────────────────────────────────────────────

async function fetchReddit() {
  const items = [];

  for (const sub of REDDIT_SUBS) {
    try {
      console.log(`[Reddit] Fetching r/${sub}…`);
      const url = `https://www.reddit.com/r/${sub}/hot.json?limit=25`;
      const res = await fetchWithRetry(url);
      const json = await res.json();
      const posts = json?.data?.children || [];

      for (const { data: p } of posts) {
        if (p.is_self && p.score < 10) continue;
        const postUrl = p.url?.startsWith('http') ? p.url : `https://reddit.com${p.permalink}`;
        items.push({
          id: makeId('reddit'),
          title: p.title,
          url: postUrl,
          source: `Reddit r/${sub}`,
          publishedAt: new Date(p.created_utc * 1000).toISOString(),
          scoreSignals: {
            sourceAuthority: 10,
            upvotes: p.score || 0,
            comments: p.num_comments || 0,
          },
          rawTextSnippet: snippet(p.selftext || p.title),
          redditMeta: {
            subreddit: sub,
            upvotes: p.score,
            comments: p.num_comments,
            permalink: `https://reddit.com${p.permalink}`,
          },
        });
      }

      await sleep(DELAY_MS);
    } catch (err) {
      console.error(`[Reddit] Error fetching r/${sub}: ${err.message}`);
    }
  }

  console.log(`[Reddit] Fetched ${items.length} items.`);
  return items;
}

// ─── Hacker News ──────────────────────────────────────────────────────────────

async function fetchHackerNews() {
  const items = [];
  const seen = new Set();
  const threeDaysAgo = Math.floor(Date.now() / 1000) - 3 * 86400;

  for (const query of HN_QUERIES) {
    try {
      console.log(`[HN] Querying "${query}"…`);
      const url = `https://hn.algolia.com/api/v1/search_by_date?query=${encodeURIComponent(query)}&tags=story&numericFilters=created_at_i>${threeDaysAgo}&hitsPerPage=20`;
      const res = await fetchWithRetry(url);
      const json = await res.json();

      for (const hit of json.hits || []) {
        if (seen.has(hit.objectID)) continue;
        seen.add(hit.objectID);

        const storyUrl = hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`;
        items.push({
          id: makeId('hn'),
          title: hit.title || hit.story_title || '',
          url: storyUrl,
          source: 'Hacker News',
          publishedAt: new Date(hit.created_at_i * 1000).toISOString(),
          scoreSignals: {
            sourceAuthority: 14,
            upvotes: hit.points || 0,
            comments: hit.num_comments || 0,
          },
          rawTextSnippet: snippet(hit.story_text || hit.comment_text || hit.title || ''),
          hnMeta: {
            points: hit.points,
            comments: hit.num_comments,
            hnUrl: `https://news.ycombinator.com/item?id=${hit.objectID}`,
          },
        });
      }

      await sleep(DELAY_MS);
    } catch (err) {
      console.error(`[HN] Error querying "${query}": ${err.message}`);
    }
  }

  console.log(`[HN] Fetched ${items.length} unique items.`);
  return items;
}

// ─── arXiv ────────────────────────────────────────────────────────────────────

async function fetchArXiv() {
  const items = [];
  const threeDaysAgo = new Date(Date.now() - 3 * 86400 * 1000);
  const dateStr = threeDaysAgo.toISOString().slice(0, 10).replace(/-/g, '');

  const query = ARXIV_CATEGORIES.map((c) => `cat:${c}`).join('+OR+');
  const url = `https://export.arxiv.org/api/query?search_query=${query}&start=0&max_results=30&sortBy=submittedDate&sortOrder=descending`;

  try {
    console.log('[arXiv] Fetching recent papers…');
    const res = await fetchWithRetry(url);
    const xml = await res.text();
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
    const parsed = parser.parse(xml);

    const entries = parsed?.feed?.entry || [];
    const list = Array.isArray(entries) ? entries : [entries];

    for (const entry of list) {
      const title = entry.title?.replace(/\n/g, ' ').trim() || '';
      const arxivUrl = (Array.isArray(entry.id) ? entry.id[0] : entry.id) || '';
      const published = entry.published || '';
      const summary = entry.summary || '';

      // Only include papers from last 3 days
      const pubDate = parseDate(published);
      if (pubDate < threeDaysAgo) continue;

      const authors = Array.isArray(entry.author)
        ? entry.author.map((a) => a.name).join(', ')
        : entry.author?.name || '';

      items.push({
        id: makeId('arxiv'),
        title,
        url: arxivUrl.replace('http://', 'https://'),
        source: 'arXiv',
        publishedAt: pubDate.toISOString(),
        scoreSignals: { sourceAuthority: 15 },
        rawTextSnippet: snippet(summary),
        arxivMeta: { authors, categories: ARXIV_CATEGORIES },
      });
    }

    await sleep(DELAY_MS);
  } catch (err) {
    console.error(`[arXiv] Error: ${err.message}`);
  }

  console.log(`[arXiv] Fetched ${items.length} papers.`);
  return items;
}

// ─── GitHub Trending ──────────────────────────────────────────────────────────

async function fetchGitHubTrending() {
  const items = [];
  const token = process.env.GITHUB_TOKEN || '';
  const since = new Date(Date.now() - 7 * 86400 * 1000).toISOString().slice(0, 10);

  const searches = [
    `topic:ai stars:>200 created:>=${since}`,
    `topic:llm stars:>100 created:>=${since}`,
    `topic:machine-learning stars:>200 created:>=${since}`,
  ];

  for (const q of searches) {
    try {
      console.log(`[GitHub] Searching: ${q}`);
      const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=10`;
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetchWithRetry(url, { headers });
      const json = await res.json();

      for (const repo of json.items || []) {
        items.push({
          id: makeId('github'),
          title: `[${repo.full_name}] ${repo.description || repo.name}`,
          url: repo.html_url,
          source: 'GitHub Trending',
          publishedAt: new Date(repo.created_at).toISOString(),
          scoreSignals: {
            sourceAuthority: 12,
            upvotes: repo.stargazers_count || 0,
          },
          rawTextSnippet: snippet(repo.description || ''),
          githubMeta: {
            stars: repo.stargazers_count,
            language: repo.language,
            topics: repo.topics,
          },
        });
      }

      await sleep(DELAY_MS);
    } catch (err) {
      console.error(`[GitHub] Error: ${err.message}`);
    }
  }

  console.log(`[GitHub] Fetched ${items.length} repos.`);
  return items;
}

// ─── Deduplication ────────────────────────────────────────────────────────────

function jaccardSimilarity(a, b) {
  const setA = new Set(a.toLowerCase().split(/\s+/));
  const setB = new Set(b.toLowerCase().split(/\s+/));
  const intersection = [...setA].filter((w) => setB.has(w)).length;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

function deduplicate(items) {
  const urlSeen = new Set();
  const kept = [];

  for (const item of items) {
    const normUrl = normalizeUrl(item.url);

    // Exact URL dedup
    if (urlSeen.has(normUrl)) continue;

    // Fuzzy title dedup against kept items
    const duplicate = kept.some(
      (k) => jaccardSimilarity(item.title, k.title) > 0.72
    );
    if (duplicate) continue;

    urlSeen.add(normUrl);
    kept.push(item);
  }

  console.log(`[dedup] ${items.length} → ${kept.length} items after deduplication.`);
  return kept;
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function fetchAllSources() {
  console.log('=== Fetching all sources ===');
  const [rss, reddit, hn, arxiv, github] = await Promise.allSettled([
    fetchRSS(),
    fetchReddit(),
    fetchHackerNews(),
    fetchArXiv(),
    fetchGitHubTrending(),
  ]);

  const all = [
    ...(rss.status     === 'fulfilled' ? rss.value     : []),
    ...(reddit.status  === 'fulfilled' ? reddit.value  : []),
    ...(hn.status      === 'fulfilled' ? hn.value      : []),
    ...(arxiv.status   === 'fulfilled' ? arxiv.value   : []),
    ...(github.status  === 'fulfilled' ? github.value  : []),
  ];

  console.log(`[fetch] Total raw items: ${all.length}`);
  return deduplicate(all);
}
