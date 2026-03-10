/**
 * app.js — AI Intelligence Dashboard
 * Loads /data/latest.json and renders all sections.
 */

const DATA_URL = './data.json';
let currentFilter = 'all';
let data = null;

// ─── Bootstrap ────────────────────────────────────────────────────────────────

async function loadData() {
  showLoading();
  try {
    const res = await fetch(DATA_URL + '?t=' + Date.now());
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data = await res.json();
    render(data);
    showMain();
  } catch (err) {
    showError('Could not load dashboard data: ' + err.message);
  }
}

// ─── Render ───────────────────────────────────────────────────────────────────

function render(d) {
  renderHeader(d);
  renderBrief(d.dailyBrief);
  renderTopNews(d.topNews || []);
  renderTrending(d.trendingTopics || []);
  renderToolLaunches(d.toolLaunches || []);
  renderReddit(d.redditSignals || []);
  renderResearch(d.research || []);
  renderFunding(d.funding || []);
}

function renderHeader(d) {
  const el = document.getElementById('last-updated');
  if (!d.generatedAt) return;
  const date = new Date(d.generatedAt);
  el.textContent = 'Updated ' + timeAgo(date) + ' · ' + date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function renderBrief(text) {
  const el = document.getElementById('brief-text');
  el.textContent = text || 'No brief available today.';
}

function renderTopNews(items) {
  const badge = document.getElementById('news-count');
  badge.textContent = items.length;

  const list = document.getElementById('top-news-list');
  list.innerHTML = items.map((item, i) => cardHtml(item, i + 1, true)).join('');
}

function renderTrending(topics) {
  const list = document.getElementById('trending-list');
  list.innerHTML = topics.map((t, i) => `
    <div class="trend-item" onclick="window.open('${esc(t.topStory?.url || '#')}', '_blank')">
      <div class="trend-header">
        <span class="trend-rank">${i + 1}</span>
        <span class="trend-name">${esc(t.name)}</span>
        <span class="trend-count">${t.itemCount} stories</span>
      </div>
      <div class="trend-why">${esc(t.whyTrending || '')}</div>
      ${t.topStory ? `<div class="trend-top-story">
        <a href="${esc(t.topStory.url)}" target="_blank" rel="noopener"
           onclick="event.stopPropagation()">${esc(t.topStory.title)}</a>
      </div>` : ''}
    </div>
  `).join('');
}

function renderToolLaunches(items) {
  const list = document.getElementById('tools-list');
  list.innerHTML = items.map((item, i) => cardHtml(item, i + 1, true)).join('');
}

function renderReddit(items) {
  const list = document.getElementById('reddit-list');
  list.innerHTML = items.map((item, i) => redditCardHtml(item, i + 1)).join('');
}

function renderResearch(items) {
  const list = document.getElementById('research-list');
  list.innerHTML = items.map((item, i) => cardHtml(item, i + 1, true)).join('');
}

function renderFunding(items) {
  const list = document.getElementById('funding-list');
  if (!items.length) {
    list.innerHTML = '<div class="card" style="color:var(--text-muted);font-size:12px;text-align:center;padding:20px;">No funding news today.</div>';
    return;
  }
  list.innerHTML = items.map((item, i) => cardHtml(item, i + 1, true)).join('');
}

// ─── Card Builders ────────────────────────────────────────────────────────────

function cardHtml(item, rank, showSummary) {
  const scoreClass = item.score >= 70 ? 'score-high' : item.score >= 45 ? 'score-medium' : 'score-low';
  const summaryHtml = showSummary && item.summary ? buildSummaryHtml(item.summary) : '';
  const snippetHtml = (!item.summary && item.rawTextSnippet)
    ? `<div class="card-snippet">${esc(item.rawTextSnippet)}</div>`
    : '';

  return `
    <div class="card ${scoreClass}" onclick="window.open('${esc(item.url)}', '_blank')">
      <div class="card-header">
        <span class="card-rank">${rank}</span>
        <a class="card-title" href="${esc(item.url)}" target="_blank" rel="noopener"
           onclick="event.stopPropagation()">${esc(item.title)}</a>
      </div>
      <div class="card-meta">
        <span class="source-tag">${esc(item.source)}</span>
        ${item.cluster ? `<span class="cluster-tag">${esc(item.cluster)}</span>` : ''}
        <div class="score-bar-wrap">
          <div class="score-bar">
            <div class="score-bar-fill" style="width:${item.score}%"></div>
          </div>
          <span class="score-val">${item.score}/100</span>
        </div>
        <span class="time-ago">${timeAgo(new Date(item.publishedAt))}</span>
      </div>
      ${summaryHtml}
      ${snippetHtml}
    </div>`;
}

function buildSummaryHtml(summary) {
  const lines = summary.split('\n').filter(Boolean);
  const bullets = lines.map((line) => {
    const clean = line.replace(/^[•\-]\s*/, '');
    const parts = clean.split(':');
    const label = parts[0];
    const body  = parts.slice(1).join(':').trim();
    if (body) {
      return `<div class="summary-bullet"><strong>${esc(label)}:</strong> <span>${esc(body)}</span></div>`;
    }
    return `<div class="summary-bullet">${esc(clean)}</div>`;
  }).join('');

  return `<div class="card-summary">${bullets}</div>`;
}

function redditCardHtml(item, rank) {
  const meta = item.redditMeta || {};
  const snippetHtml = item.rawTextSnippet
    ? `<div class="card-snippet">${esc(item.rawTextSnippet)}</div>`
    : '';

  return `
    <div class="card" onclick="window.open('${esc(meta.permalink || item.url)}', '_blank')">
      <div class="card-header">
        <span class="card-rank">${rank}</span>
        <a class="card-title" href="${esc(meta.permalink || item.url)}" target="_blank" rel="noopener"
           onclick="event.stopPropagation()">${esc(item.title)}</a>
      </div>
      <div class="card-meta">
        <span class="source-tag">${esc(item.source)}</span>
        <span class="time-ago">${timeAgo(new Date(item.publishedAt))}</span>
      </div>
      ${meta.upvotes != null ? `
        <div class="reddit-stats">
          <span class="reddit-stat">▲ ${fmt(meta.upvotes)}</span>
          <span class="reddit-stat">💬 ${fmt(meta.comments)}</span>
        </div>` : ''}
      ${snippetHtml}
    </div>`;
}

// ─── Filters ──────────────────────────────────────────────────────────────────

document.querySelectorAll('.filter-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    currentFilter = btn.dataset.filter;
    document.querySelectorAll('.filter-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    applyFilter();
  });
});

function applyFilter() {
  const sections = document.querySelectorAll('.section-block[data-section]');
  sections.forEach((section) => {
    const key = section.dataset.section;
    if (currentFilter === 'all' || key === currentFilter || key === 'all') {
      section.classList.remove('hidden');
    } else {
      section.classList.add('hidden');
    }
  });
}

// ─── UI State ─────────────────────────────────────────────────────────────────

function showLoading() {
  document.getElementById('loading').classList.remove('hidden');
  document.getElementById('main-content').classList.add('hidden');
  document.getElementById('error-state').classList.add('hidden');
}

function showMain() {
  document.getElementById('loading').classList.add('hidden');
  document.getElementById('error-state').classList.add('hidden');
  document.getElementById('main-content').classList.remove('hidden');
}

function showError(msg) {
  document.getElementById('loading').classList.add('hidden');
  document.getElementById('main-content').classList.add('hidden');
  const err = document.getElementById('error-state');
  err.classList.remove('hidden');
  document.getElementById('error-msg').textContent = msg;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function timeAgo(date) {
  const s = Math.floor((Date.now() - date.getTime()) / 1000);
  if (s < 60)   return 'just now';
  if (s < 3600) return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  return Math.floor(s / 86400) + 'd ago';
}

function fmt(n) {
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return String(n);
}

// ─── Init ─────────────────────────────────────────────────────────────────────

loadData();
