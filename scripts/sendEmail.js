/**
 * sendEmail.js
 * Sends the daily AI brief email via SendGrid.
 */

import sgMail from '@sendgrid/mail';

const RECIPIENT   = process.env.RECIPIENT_EMAIL || 'marct191@gmail.com';
const SENDER      = process.env.FROM_EMAIL      || 'noreply@yourdomain.com';
const DASHBOARD   = process.env.DASHBOARD_URL   || 'https://your-org.github.io/ai-news-dashboard/';

export async function sendDailyEmail(payload) {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    console.warn('[email] SENDGRID_API_KEY not set — skipping email.');
    return;
  }

  sgMail.setApiKey(apiKey);

  const today  = new Date().toISOString().slice(0, 10);
  const subject = `AI Brief — ${today}`;

  const html  = buildHtml(payload, today);
  const text  = buildText(payload, today);

  try {
    await sgMail.send({
      to:      RECIPIENT,
      from:    SENDER,
      subject,
      html,
      text,
    });
    console.log(`[email] Sent to ${RECIPIENT}`);
  } catch (err) {
    console.error('[email] SendGrid error:', err?.response?.body || err.message);
    throw err;
  }
}

// ─── HTML builder ─────────────────────────────────────────────────────────────

function buildHtml(payload, today) {
  const storiesHtml = payload.topNews
    .slice(0, 5)
    .map((item) => {
      const bullets = (item.summary || '')
        .split('\n')
        .filter(Boolean)
        .map((b) => `<li style="margin:4px 0;">${escapeHtml(b.replace(/^[•\-]\s*/, ''))}</li>`)
        .join('');

      return `
        <div style="margin-bottom:24px;padding-bottom:16px;border-bottom:1px solid #e5e7eb;">
          <h3 style="margin:0 0 6px;font-size:15px;">
            <a href="${item.url}" style="color:#1d4ed8;text-decoration:none;">${escapeHtml(item.title)}</a>
          </h3>
          <p style="margin:0 0 8px;font-size:12px;color:#6b7280;">
            ${escapeHtml(item.source)} &nbsp;·&nbsp; Score: ${item.score}/100
          </p>
          <ul style="margin:0;padding-left:20px;font-size:13px;color:#374151;">${bullets}</ul>
        </div>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:640px;margin:0 auto;padding:20px;background:#f9fafb;">
  <div style="background:#fff;border-radius:8px;padding:24px;box-shadow:0 1px 3px rgba(0,0,0,.1);">

    <h1 style="margin:0 0 4px;font-size:22px;color:#111827;">🤖 AI Brief</h1>
    <p style="margin:0 0 20px;color:#6b7280;font-size:14px;">${today} &nbsp;·&nbsp;
      <a href="${DASHBOARD}" style="color:#1d4ed8;">View Dashboard →</a>
    </p>

    <div style="background:#f0f9ff;border-left:4px solid #0ea5e9;padding:16px;border-radius:0 6px 6px 0;margin-bottom:28px;">
      <h2 style="margin:0 0 8px;font-size:14px;font-weight:700;color:#0369a1;text-transform:uppercase;letter-spacing:.05em;">
        ⚡ Daily Brief
      </h2>
      <p style="margin:0;font-size:14px;line-height:1.6;color:#0c4a6e;">${escapeHtml(payload.dailyBrief || '')}</p>
    </div>

    <h2 style="margin:0 0 16px;font-size:16px;font-weight:700;color:#111827;">📰 Top 5 Stories</h2>
    ${storiesHtml}

    ${payload.trendingTopics?.length ? `
    <h2 style="margin:24px 0 12px;font-size:16px;font-weight:700;color:#111827;">🔥 Trending Topics</h2>
    <ul style="margin:0;padding-left:20px;font-size:13px;color:#374151;">
      ${payload.trendingTopics.map((t) => `<li style="margin-bottom:6px;"><strong>${escapeHtml(t.name)}</strong> — ${escapeHtml(t.whyTrending)}</li>`).join('')}
    </ul>` : ''}

    <hr style="margin:24px 0;border:none;border-top:1px solid #e5e7eb;">
    <p style="margin:0;font-size:11px;color:#9ca3af;text-align:center;">
      AI News Dashboard &nbsp;·&nbsp;
      <a href="${DASHBOARD}" style="color:#9ca3af;">${DASHBOARD}</a>
    </p>
  </div>
</body>
</html>`;
}

// ─── Plain text builder ───────────────────────────────────────────────────────

function buildText(payload, today) {
  const lines = [
    `AI Brief — ${today}`,
    `Dashboard: ${DASHBOARD}`,
    '',
    '=== DAILY BRIEF ===',
    payload.dailyBrief || '',
    '',
    '=== TOP 5 STORIES ===',
  ];

  payload.topNews.slice(0, 5).forEach((item, i) => {
    lines.push('', `${i + 1}. ${item.title}`);
    lines.push(`   Source: ${item.source} | Score: ${item.score}/100`);
    lines.push(`   URL: ${item.url}`);
    if (item.summary) {
      item.summary.split('\n').filter(Boolean).forEach((b) => lines.push(`   ${b}`));
    }
  });

  if (payload.trendingTopics?.length) {
    lines.push('', '=== TRENDING TOPICS ===');
    payload.trendingTopics.forEach((t) => {
      lines.push(`• ${t.name}: ${t.whyTrending}`);
    });
  }

  return lines.join('\n');
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
