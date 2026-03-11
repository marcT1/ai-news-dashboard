import sgMail from '@sendgrid/mail';

export async function sendDailyEmail(data) {
  if (!process.env.SENDGRID_API_KEY) {
    console.log('[email] No SENDGRID_API_KEY — skipping email.');
    return;
  }
  if (!data || !data.topNews) {
    console.log('[email] No data to send — skipping email.');
    return;
  }

  sgMail.setApiKey(process.env.SENDGRID_API_KEY);

  const date = new Date().toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
  const subject = `AI Brief — ${new Date().toISOString().slice(0,10)}`;
  const html = buildHtml(data, date);
  const text = buildText(data, date);

  const msg = {
    to: process.env.RECIPIENT_EMAIL,
    from: process.env.FROM_EMAIL,
    subject,
    text,
    html,
  };

  try {
    await sgMail.send(msg);
    console.log(`[email] Sent to ${process.env.RECIPIENT_EMAIL}`);
  } catch (err) {
    console.error('[email] Failed:', err.response?.body || err.message);
  }
}

function buildHtml(data, date) {
  const { topNews = [], dailyBrief = '', trendingTopics = [] } = data;

  const newsHtml = topNews.slice(0, 5).map((item, i) => {
    const summary = (item.summary || '').split('\n').filter(Boolean)
      .map(l => `<li style="margin:4px 0;">${l.replace(/^[•\-]\s*/,'')}</li>`).join('');
    return `
      <div style="margin-bottom:24px;padding:16px;background:#f9fafb;border-radius:8px;border-left:4px solid #4F46E5;">
        <div style="font-size:12px;color:#6B7280;margin-bottom:6px;">#${i+1} · ${item.source} · Score: ${item.score}/100</div>
        <a href="${item.url}" style="font-size:16px;font-weight:bold;color:#1F2937;text-decoration:none;">${item.title}</a>
        ${summary ? `<ul style="margin:10px 0 0 0;padding-left:20px;color:#374151;font-size:14px;">${summary}</ul>` : ''}
      </div>`;
  }).join('');

  const trendingHtml = trendingTopics.slice(0, 5).map((t, i) =>
    `<div style="margin:6px 0;"><strong>${i+1}. ${t.name}</strong> — ${t.itemCount} stories</div>`
  ).join('');

  const dashUrl = process.env.DASHBOARD_URL || '#';

  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1F2937;">
      <div style="background:#4F46E5;padding:24px;border-radius:8px 8px 0 0;">
        <h1 style="color:white;margin:0;font-size:24px;">🤖 AI Intelligence Brief</h1>
        <p style="color:#C7D2FE;margin:6px 0 0;">${date}</p>
      </div>
      <div style="padding:24px;background:white;border:1px solid #E5E7EB;">
        <h2 style="color:#4F46E5;font-size:16px;">⚡ DAILY BRIEF</h2>
        <p style="line-height:1.6;">${dailyBrief}</p>
        <hr style="border:none;border-top:1px solid #E5E7EB;margin:24px 0;">
        <h2 style="color:#1F2937;font-size:18px;">📰 Top Stories</h2>
        ${newsHtml}
        ${trendingHtml ? `<hr style="border:none;border-top:1px solid #E5E7EB;margin:24px 0;"><h2 style="color:#1F2937;font-size:18px;">🔥 Trending Topics</h2>${trendingHtml}` : ''}
        <hr style="border:none;border-top:1px solid #E5E7EB;margin:24px 0;">
        <div style="text-align:center;">
          <a href="${dashUrl}" style="background:#4F46E5;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;">View Full Dashboard →</a>
        </div>
      </div>
      <div style="padding:16px;text-align:center;color:#9CA3AF;font-size:12px;">
        AI Intelligence Dashboard · Automated daily digest
      </div>
    </div>`;
}

function buildText(data, date) {
  const { topNews = [], dailyBrief = '' } = data;
  const stories = topNews.slice(0, 5).map((item, i) =>
    `${i+1}. ${item.title}\n   ${item.source} · Score: ${item.score}/100\n   ${item.url}`
  ).join('\n\n');
  return `AI Intelligence Brief — ${date}\n\n${dailyBrief}\n\nTOP STORIES\n\n${stories}\n\nView dashboard: ${process.env.DASHBOARD_URL||''}`;
}
