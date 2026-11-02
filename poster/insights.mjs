// © 2026 Job Shift Careers. Weekly: saves views, reach and engagement for everything the poster posted,
// plus the accounts' follower counts, into insights/ (one file per run + latest.json) for the Sunday review.
// A metric Meta doesn't give for a post is simply left out; nothing here can fail the week.
import fs from "node:fs";
import { CFG, g } from "./graph.mjs";

const ROOT = new URL("../", import.meta.url).pathname;
const read = (f, d) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch (e) { return d; } };
const state = read(ROOT + "state/posted.json", {});
const sched = Object.fromEntries((read(ROOT + "schedule.json", { posts: [] }).posts || []).map(p => [p.id, p]));
const IG_METRICS = ["views", "reach", "likes", "comments", "shares", "saved", "total_interactions", "ig_reels_avg_watch_time"];
const FB_METRICS = ["blue_reels_play_count", "post_impressions_unique", "post_video_avg_time_watched", "post_video_social_actions"];

async function metrics(id, list, path) {
  const out = {};
  for (const m of list) {   // one at a time: Meta refuses the whole call if any one metric isn't offered for this post
    try { const r = await g("GET", `${id}/${path}`, { metric: m }); const v = r.data && r.data[0] && r.data[0].values && r.data[0].values[0]; if (v) out[m] = v.value; } catch (e) {}
  }
  return out;
}
async function main() {
  if (!CFG.token) { console.log("Not set up yet: META_TOKEN missing."); return; }
  const day = new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10), rows = [];
  for (const [id, st] of Object.entries(state)) {
    const p = sched[id] || {}, row = { id, when: p.when || "", series: p.series || "", title: p.title || "" };
    if (st.ig && st.ig.id) { row.ig = await metrics(st.ig.id, IG_METRICS, "insights"); row.ig_link = st.ig.link; }
    if (st.fb && st.fb.id) { row.fb = await metrics(st.fb.id, FB_METRICS, "video_insights"); row.fb_link = st.fb.link; }
    rows.push(row);
  }
  const acct = {};
  if (CFG.ig) try { acct.ig = await g("GET", CFG.ig, { fields: "username,followers_count,media_count" }); } catch (e) { acct.ig_error = e.message; }
  if (CFG.page) try { acct.fb = await g("GET", CFG.page, { fields: "name,followers_count,fan_count" }); } catch (e) { acct.fb_error = e.message; }
  const out = { saved: new Date().toISOString(), day, accounts: acct, posts: rows };
  fs.mkdirSync(ROOT + "insights", { recursive: true });
  fs.writeFileSync(`${ROOT}insights/${day}.json`, JSON.stringify(out, null, 2) + "\n");
  fs.writeFileSync(`${ROOT}insights/latest.json`, JSON.stringify(out, null, 2) + "\n");
  console.log(`Saved insights for ${rows.length} post(s) to insights/${day}.json`);
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
