# 🤖 AI Intelligence Dashboard

A self-hosted AI news aggregator that runs daily via GitHub Actions, publishes a live web dashboard to GitHub Pages, and emails a curated brief every morning.

**Live dashboard → [your-username.github.io/ai-news-dashboard](https://your-username.github.io/ai-news-dashboard)**

---

## What It Does

| Feature | Details |
|---|---|
| **Sources** | MIT TR, VentureBeat, TechCrunch, OpenAI, DeepMind, Anthropic RSS · Reddit (4 subs) · Hacker News · arXiv · GitHub Trending |
| **Pipeline** | Fetch → Deduplicate → Score (0–100) → Cluster → LLM Summarize → JSON → Email |
| **Dashboard** | Responsive HTML/CSS/JS · Filters · Dark theme · Auto-updates |
| **Email** | Daily digest at 7 AM ET via SendGrid |
| **Schedule** | GitHub Actions cron · also triggerable manually |

---

## Repository Structure

```
ai-news-dashboard/
├── .github/
│   └── workflows/
│       └── daily.yml          # GitHub Actions pipeline
├── data/
│   └── latest.json            # Updated daily, served by GitHub Pages
├── docs/                      # GitHub Pages site root
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── scripts/
│   ├── fetchSources.js        # RSS, Reddit, HN, arXiv, GitHub
│   ├── scoreRankCluster.js    # Scoring + topic clustering
│   ├── summarize.js           # LLM 3-bullet summaries
│   ├── writeJson.js           # Assembles data/latest.json
│   ├── sendEmail.js           # SendGrid email digest
│   └── runDaily.js            # Orchestrator
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

---

## Setup Guide

### Step 1 — Create the GitHub Repository

1. Go to [github.com/new](https://github.com/new)
2. Name it `ai-news-dashboard`
3. Set it to **Public** (required for free GitHub Pages)
4. Click **Create repository**
5. Push this code:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/YOUR_USERNAME/ai-news-dashboard.git
   git branch -M main
   git push -u origin main
   ```

### Step 2 — Enable GitHub Pages

1. Go to your repo → **Settings** → **Pages**
2. Under **Source**, select **Deploy from a branch**
3. Branch: `main` · Folder: `/docs`
4. Click **Save**
5. Your dashboard will be live at:  
   `https://YOUR_USERNAME.github.io/ai-news-dashboard/`

### Step 3 — Add GitHub Secrets

Go to your repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

Add these secrets:

| Secret Name | Value |
|---|---|
| `OPENAI_API_KEY` | Your OpenAI API key (`sk-...`) |
| `SENDGRID_API_KEY` | Your SendGrid API key (`SG....`) |
| `RECIPIENT_EMAIL` | `marct191@gmail.com` |
| `FROM_EMAIL` | A verified sender in SendGrid (e.g. `alerts@yourdomain.com`) |
| `DASHBOARD_URL` | `https://YOUR_USERNAME.github.io/ai-news-dashboard/` |

**Optional secrets:**

| Secret Name | Default | Notes |
|---|---|---|
| `OPENAI_MODEL` | `gpt-4o-mini` | Any OpenAI-compatible model |
| `OPENAI_BASE_URL` | _(OpenAI default)_ | Override for Azure / Groq / Together |
| `GITHUB_TOKEN` | Auto-provided | Upgrades GitHub API rate limits |

### Step 4 — SendGrid Sender Verification

1. Log in to [sendgrid.com](https://sendgrid.com)
2. Go to **Settings → Sender Authentication**
3. Verify a **Single Sender** (easiest) or a full domain
4. Use the verified email as your `FROM_EMAIL` secret

> **Free tier:** SendGrid allows 100 emails/day free — more than enough.

### Step 5 — Test Locally

```bash
cp .env.example .env
# Edit .env with your real keys

npm install
npm run dev
```

This runs the full pipeline locally. Check `data/latest.json` and open `docs/index.html` in your browser.

### Step 6 — Test GitHub Actions

1. Go to your repo → **Actions**
2. Click **Daily AI News Pipeline**
3. Click **Run workflow** → **Run workflow**
4. Watch the logs — the pipeline takes 3–8 minutes
5. After success, check `data/latest.json` was committed and your email arrived

---

## Scoring Explained

Each item is scored 0–100 using these weighted signals:

| Signal | Max Points | How It's Calculated |
|---|---|---|
| **Freshness** | 30 | `< 6h → 30` · `< 24h → 22` · `< 72h → 8` |
| **Source Authority** | 20 | OpenAI/DeepMind/Anthropic → 20 · MIT TR → 18 · HN → 14 · Reddit → 10 |
| **Engagement** | 25 | Reddit upvotes + 2× comments · HN points + 2× comments |
| **Novelty** | 15 | Jaccard title similarity vs other items: unique → 15 · similar → 0 |
| **Business Impact** | 10 | Keyword hits: funding/acquisition/regulation/enterprise/etc. |

---

## Topic Clusters

Items are automatically assigned to one of 10 topics:

- Large Language Models
- AI Agents & Automation
- AI Safety & Regulation
- AI in Enterprise
- Research & Benchmarks
- AI Hardware & Chips
- Funding & Acquisitions
- Open Source AI
- AI Tools & Products
- Generative AI & Media

---

## Alternative LLM Providers

The summarizer uses any OpenAI-compatible API. Set `OPENAI_BASE_URL` to switch:

| Provider | Base URL |
|---|---|
| OpenAI (default) | _(leave blank)_ |
| Groq | `https://api.groq.com/openai/v1` |
| Together AI | `https://api.together.xyz/v1` |
| Azure OpenAI | `https://YOUR_RESOURCE.openai.azure.com/openai/deployments/YOUR_DEPLOYMENT` |

---

## Hugging Face Trending

Hugging Face's public trending API endpoint has changed over time. The current public endpoint (`https://huggingface.co/api/models?sort=trending&limit=10`) requires authentication for reliable access.  
**Workaround:** The pipeline includes GitHub Trending as a proxy for hot AI tools. You can add HF support by setting a `HF_API_TOKEN` secret and fetching from their Models API.

---

## Cost Estimate

| Service | Usage | Monthly Cost |
|---|---|---|
| OpenAI gpt-4o-mini | ~15 items × 300 tokens × 30 days | ~$0.05 |
| SendGrid | 30 emails/month | Free |
| GitHub Actions | ~10 min/day | Free (2000 min/month free) |
| GitHub Pages | Static hosting | Free |
| **Total** | | **~$0.05/month** |

---

## Troubleshooting

**No email received:**
- Check SendGrid Activity Feed for delivery status
- Verify `FROM_EMAIL` is a verified sender in SendGrid
- Check spam folder

**Pipeline fails with 429:**
- Rate limit hit on OpenAI — the script has automatic backoff, but if persistent, upgrade your OpenAI tier

**`data/latest.json` not updating:**
- Check Actions logs for errors
- Verify `GITHUB_TOKEN` has write permissions (it does by default for Actions)

**Dashboard shows old data:**
- GitHub Pages has ~1 min propagation delay after commit
- Hard-refresh your browser (`Ctrl+Shift+R`)

---

## License

MIT
