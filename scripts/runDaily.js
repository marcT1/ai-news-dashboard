/**
 * runDaily.js
 * Orchestrates the full daily pipeline:
 *   fetch → score → summarize → cluster → write JSON → send email
 */

import { fetchAllSources }                                         from './fetchSources.js';
import { scoreItems, clusterItems, selectToolLaunches,
         selectFunding, selectResearch, selectRedditSignals }     from './scoreRankCluster.js';
import { summarizeItems, generateDailyBrief }                     from './summarize.js';
import { writeOutputJson }                                        from './writeJson.js';
import { sendDailyEmail }                                         from './sendEmail.js';

async function main() {
  const startTime = Date.now();
  console.log('=== AI News Dashboard — Daily Run ===');
  console.log(`Started at ${new Date().toISOString()}`);

  try {
    // 1. Fetch
    const raw = await fetchAllSources();
    if (raw.length === 0) {
      throw new Error('No items fetched — aborting.');
    }

    // 2. Score & rank
    const scored = scoreItems(raw);
    console.log(`[pipeline] Scored ${scored.length} items. Top score: ${scored[0]?.score}`);

    // 3. Cluster
    const { clusters, trending } = clusterItems(scored);
    // Attach cluster label to each item
    for (const [clusterName, items] of Object.entries(clusters)) {
      for (const item of items) {
        item.cluster = clusterName;
      }
    }

    // 4. Select category buckets
    const topNews      = scored.slice(0, 10);
    const toolLaunches = selectToolLaunches(scored);
    const funding      = selectFunding(scored);
    const research     = selectResearch(scored);
    const redditSignals = selectRedditSignals(scored);

    console.log(`[pipeline] top:${topNews.length} tools:${toolLaunches.length} funding:${funding.length} research:${research.length} reddit:${redditSignals.length}`);

    // 5. Summarize top news (LLM)
    const summarizedNews = await summarizeItems(topNews);

    // 6. Also summarize tool launches and funding (best effort)
    const summarizedTools   = await summarizeItems(toolLaunches.slice(0, 3));
    const summarizedFunding = await summarizeItems(funding.slice(0, 3));

    // Fill back full lists with summaries for the ones we didn't summarize
    const toolLaunchesOut = [
      ...summarizedTools,
      ...toolLaunches.slice(3),
    ].slice(0, 5);

    const fundingOut = [
      ...summarizedFunding,
      ...funding.slice(3),
    ].slice(0, 5);

    // 7. Daily brief
    const dailyBrief = await generateDailyBrief(summarizedNews);

    // 8. Write JSON
    const payload = writeOutputJson({
      topNews: summarizedNews,
      trendingTopics: trending,
      toolLaunches: toolLaunchesOut,
      redditSignals,
      research,
      funding: fundingOut,
      dailyBrief,
    });

    // 9. Send email
    await sendDailyEmail(payload);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`=== Done in ${elapsed}s ===`);
    process.exit(0);

  } catch (err) {
    console.error('[pipeline] FATAL:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

main();
