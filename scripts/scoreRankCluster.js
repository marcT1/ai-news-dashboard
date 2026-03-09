/**
 * scoreRankCluster.js
 * Scores, ranks, and clusters normalized news items.
 */

// ─── Scoring ──────────────────────────────────────────────────────────────────

const BUSINESS_KEYWORDS = [
  'funding', 'acquisition', 'enterprise', 'regulation', 'healthcare',
  'finance', 'security', 'chips', 'data center', 'partnership', 'revenue',
  'investment', 'ipo', 'merger', 'startup', 'billion', 'million',
  'contract', 'compliance', 'policy', 'ban', 'lawsuit',
];

const TOOL_KEYWORDS = [
  'launch', 'release', 'announce', 'introduce', 'debut', 'unveil',
  'available', 'open source', 'api', 'sdk', 'plugin', 'integration',
  'update', 'version', 'model', 'product',
];

const SOURCE_AUTHORITY_MAP = {
  'MIT Technology Review': 18,
  'VentureBeat AI': 16,
  'TechCrunch AI': 16,
  'OpenAI Blog': 20,
  'DeepMind Blog': 20,
  'Anthropic Blog': 20,
  'Hacker News': 14,
  'arXiv': 15,
  'GitHub Trending': 12,
};

function getSourceAuthority(source) {
  for (const [key, val] of Object.entries(SOURCE_AUTHORITY_MAP)) {
    if (source.includes(key)) return val;
  }
  if (source.startsWith('Reddit')) return 10;
  return 8;
}

function scoreFreshness(publishedAt) {
  const ageHours = (Date.now() - new Date(publishedAt).getTime()) / 3600000;
  if (ageHours < 6)   return 30;
  if (ageHours < 12)  return 26;
  if (ageHours < 24)  return 22;
  if (ageHours < 48)  return 15;
  if (ageHours < 72)  return 8;
  return 2;
}

function scoreEngagement(signals) {
  const upvotes  = signals.upvotes  || 0;
  const comments = signals.comments || 0;
  const combined = upvotes + comments * 2;

  if (combined > 1000) return 25;
  if (combined > 500)  return 20;
  if (combined > 200)  return 15;
  if (combined > 50)   return 10;
  if (combined > 10)   return 5;
  return 0;
}

function scoreNovelty(item, allItems) {
  // Compare against other items with same source type
  const others = allItems.filter(
    (o) => o.id !== item.id && o.source !== item.source
  );
  if (others.length === 0) return 15;

  const maxSimilarity = Math.max(
    ...others.map((o) => jaccardSimilarity(item.title, o.title))
  );

  if (maxSimilarity > 0.7) return 0;
  if (maxSimilarity > 0.5) return 5;
  if (maxSimilarity > 0.3) return 10;
  return 15;
}

function scoreBusinessImpact(item) {
  const text = `${item.title} ${item.rawTextSnippet}`.toLowerCase();
  const hits = BUSINESS_KEYWORDS.filter((kw) => text.includes(kw)).length;
  return Math.min(10, hits * 3);
}

function jaccardSimilarity(a, b) {
  const setA = new Set(a.toLowerCase().split(/\W+/).filter(Boolean));
  const setB = new Set(b.toLowerCase().split(/\W+/).filter(Boolean));
  const intersection = [...setA].filter((w) => setB.has(w)).length;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

export function scoreItems(items) {
  return items.map((item) => {
    const freshness      = scoreFreshness(item.publishedAt);
    const authority      = item.scoreSignals?.sourceAuthority || getSourceAuthority(item.source);
    const engagement     = scoreEngagement(item.scoreSignals || {});
    const novelty        = scoreNovelty(item, items);
    const businessImpact = scoreBusinessImpact(item);

    const total = freshness + authority + engagement + novelty + businessImpact;

    return {
      ...item,
      score: Math.min(100, total),
      scoreBreakdown: { freshness, authority, engagement, novelty, businessImpact },
    };
  }).sort((a, b) => b.score - a.score);
}

// ─── Clustering ───────────────────────────────────────────────────────────────

const TOPIC_SEEDS = [
  { name: 'Large Language Models',  keywords: ['llm', 'gpt', 'claude', 'gemini', 'language model', 'transformer', 'chat'] },
  { name: 'AI Agents & Automation', keywords: ['agent', 'autonomous', 'automation', 'workflow', 'agentic', 'multi-agent'] },
  { name: 'AI Safety & Regulation', keywords: ['safety', 'regulation', 'policy', 'alignment', 'ban', 'law', 'risk', 'ethics'] },
  { name: 'AI in Enterprise',       keywords: ['enterprise', 'business', 'productivity', 'copilot', 'integration', 'saas'] },
  { name: 'Research & Benchmarks',  keywords: ['paper', 'research', 'arxiv', 'benchmark', 'dataset', 'training', 'fine-tun'] },
  { name: 'AI Hardware & Chips',    keywords: ['chip', 'gpu', 'hardware', 'nvidia', 'tpu', 'inference', 'compute', 'datacenter'] },
  { name: 'Funding & Acquisitions', keywords: ['funding', 'acquisition', 'invest', 'billion', 'million', 'ipo', 'startup', 'valuation'] },
  { name: 'Open Source AI',         keywords: ['open source', 'open-source', 'github', 'hugging face', 'llama', 'mistral', 'release'] },
  { name: 'AI Tools & Products',    keywords: ['launch', 'release', 'api', 'plugin', 'tool', 'product', 'feature', 'update'] },
  { name: 'Generative AI & Media',  keywords: ['image', 'video', 'audio', 'diffusion', 'generate', 'creative', 'midjourney', 'sora'] },
];

function assignCluster(item) {
  const text = `${item.title} ${item.rawTextSnippet}`.toLowerCase();
  let bestCluster = null;
  let bestScore = 0;

  for (const seed of TOPIC_SEEDS) {
    const hits = seed.keywords.filter((kw) => text.includes(kw)).length;
    if (hits > bestScore) {
      bestScore = hits;
      bestCluster = seed.name;
    }
  }

  return bestCluster || 'General AI';
}

export function clusterItems(scoredItems) {
  const clusters = {};

  for (const item of scoredItems) {
    const cluster = assignCluster(item);
    if (!clusters[cluster]) clusters[cluster] = [];
    clusters[cluster].push(item);
  }

  // Build trending topics: top 5 by item count × avg score
  const trending = Object.entries(clusters)
    .map(([name, items]) => {
      const avgScore = items.reduce((s, i) => s + i.score, 0) / items.length;
      const topItem  = items[0];
      return {
        name,
        itemCount: items.length,
        trendScore: Math.round(avgScore * Math.log(items.length + 1)),
        whyTrending: buildWhyTrending(name, items),
        topStory: topItem ? { title: topItem.title, url: topItem.url } : null,
        items: items.slice(0, 5),
      };
    })
    .sort((a, b) => b.trendScore - a.trendScore)
    .slice(0, 5);

  return { clusters, trending };
}

function buildWhyTrending(name, items) {
  const count = items.length;
  const sources = [...new Set(items.map((i) => i.source.split(' ')[0]))].slice(0, 3).join(', ');
  const recent = items.filter(
    (i) => Date.now() - new Date(i.publishedAt).getTime() < 24 * 3600000
  ).length;
  return `${count} stories across ${sources}${recent > 0 ? `, ${recent} in the last 24h` : ''}.`;
}

// ─── Category Selectors ───────────────────────────────────────────────────────

export function selectToolLaunches(scoredItems) {
  return scoredItems
    .filter((item) => {
      const text = `${item.title} ${item.rawTextSnippet}`.toLowerCase();
      return TOOL_KEYWORDS.some((kw) => text.includes(kw));
    })
    .slice(0, 5);
}

export function selectFunding(scoredItems) {
  return scoredItems
    .filter((item) => {
      const text = `${item.title} ${item.rawTextSnippet}`.toLowerCase();
      return ['funding', 'raises', 'acquisition', 'invest', 'billion', 'million', 'ipo'].some(
        (kw) => text.includes(kw)
      );
    })
    .slice(0, 5);
}

export function selectResearch(scoredItems) {
  return scoredItems
    .filter((item) => item.source === 'arXiv' || item.source.includes('Research'))
    .slice(0, 5);
}

export function selectRedditSignals(scoredItems) {
  return scoredItems
    .filter((item) => item.source.startsWith('Reddit'))
    .slice(0, 5);
}
