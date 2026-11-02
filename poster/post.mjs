// © 2026 Job Shift Careers. Posts what is due in schedule.json to Instagram (reel) and the Facebook Page (reel).
// Runs every 30 minutes on GitHub (see .github/workflows/post.yml). Safe to run again: anything already posted is
// remembered in state/posted.json and never posted twice.
//
//   node poster/post.mjs            post everything that is due
//   node poster/post.mjs --check    TEST ONLY: upload each upcoming reel to Instagram and wait until Instagram
//                                   accepts it, but DON'T publish (nothing appears on the account)
//   node poster/post.mjs --dry      print what would happen, call nothing
import fs from "node:fs";
import { CFG, g, sleep, mediaUrl, reachable } from "./graph.mjs";

const ARGS = new Set(process.argv.slice(2));
const CHECK = ARGS.has("--check"), DRY = ARGS.has("--dry");
const ROOT = new URL("../", import.meta.url).pathname;
const SCHED = ROOT + "schedule.json", STATE = ROOT + "state/posted.json";
const now = new Date(process.env.POSTER_NOW || Date.now());
const WAIT_MS = +(process.env.POSTER_WAIT_MS || 10000), WAIT_TRIES = +(process.env.POSTER_WAIT_TRIES || 36);   // up to 6 min per reel

const read = (f, d) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch (e) { return d; } };
const sched = read(SCHED, { posts: [] }).posts || [];
const state = read(STATE, {});
const save = () => { for (const k of Object.keys(state)) if (!Object.keys(state[k]).length) delete state[k]; fs.mkdirSync(ROOT + "state", { recursive: true }); fs.writeFileSync(STATE, JSON.stringify(state, null, 2) + "\n"); };
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

// ---------- Instagram: reel container → wait until FINISHED → publish ----------
async function igContainer(p, url) {
  const c = await g("POST", `${CFG.ig}/media`, {
    media_type: "REELS", video_url: url, caption: p.caption || "", share_to_feed: true,
    collaborators: (p.ig_collaborators || []).length ? p.ig_collaborators.slice(0, 3) : undefined,
    cover_url: p.cover ? mediaUrl(p.cover) : undefined, thumb_offset: p.cover ? undefined : p.thumb_ms
  });
  for (let i = 0; i < WAIT_TRIES; i++) {
    await sleep(WAIT_MS);
    const s = await g("GET", c.id, { fields: "status_code,status" });
    if (s.status_code === "FINISHED") return c.id;
    if (s.status_code === "ERROR" || s.status_code === "EXPIRED") throw new Error(`Instagram couldn't use the video: ${s.status || s.status_code}`);
  }
  throw new Error("Instagram took too long to process the video; will try again next run");
}
async function postIG(p, url) {
  const id = await igContainer(p, url);
  const pub = await g("POST", `${CFG.ig}/media_publish`, { creation_id: id });
  const m = await g("GET", pub.id, { fields: "permalink" }).catch(() => ({}));
  return { id: pub.id, link: m.permalink || "" };
}

// ---------- Facebook Page reel: start → upload from our URL → finish (publish) ----------
async function postFB(p, url) {
  const st = await g("POST", `${CFG.page}/video_reels`, { upload_phase: "start" });
  const r = await fetch(`${CFG.rupload}/video-upload/${CFG.ver}/${st.video_id}`, { method: "POST", headers: { Authorization: "OAuth " + CFG.token, file_url: url } });
  const up = await r.json().catch(() => ({}));
  if (!r.ok || up.success === false) throw new Error(`Facebook couldn't fetch the video: ${(up.debug_info && up.debug_info.message) || r.status}`);
  await g("POST", `${CFG.page}/video_reels`, { upload_phase: "finish", video_id: st.video_id, video_state: "PUBLISHED", description: p.fb_caption || p.caption || "" });
  return { id: st.video_id, link: `https://www.facebook.com/reel/${st.video_id}` };
}

async function main() {
  if (!DRY && (!CFG.token || (!CFG.ig && !CFG.page))) { log("Not set up yet: META_TOKEN, IG_USER_ID / FB_PAGE_ID are missing. Nothing to do."); return; }
  // "test": true entries are never published; they exist only for the --check test
  const due = sched.filter(p => p.id && p.video && p.when && p.paused !== true && (CHECK ? (p.test === true || new Date(p.when) > now) : (p.test !== true && new Date(p.when) <= now)));
  if (!due.length) { log(CHECK ? "No upcoming reels to test." : "Nothing due."); return; }
  let changed = false, failed = 0;
  for (const p of due) {
    const url = mediaUrl(p.video), where = p.platforms || ["ig", "fb"];
    const st = state[p.id] || (state[p.id] = {});
    if (!CHECK && where.every(w => st[w] && st[w].id)) continue;               // already posted everywhere
    // too late: something due more than 12 hours ago is skipped (a missed slot shouldn't post at 3 am)
    if (!CHECK && now - new Date(p.when) > 12 * 3600e3 && !p.post_late) { if (!st.skipped) { st.skipped = now.toISOString(); changed = true; log(`${p.id}: missed its slot by over 12 h, skipped (set "post_late": true to post anyway)`); } continue; }
    if (DRY) { log(`${p.id}: would post to ${where.join(" + ")} from ${url}`); continue; }
    if (!(await reachable(url))) { log(`${p.id}: video not online yet (${url}); will try next run`); continue; }
    for (const w of where) {
      if (!CHECK && st[w] && st[w].id) continue;
      try {
        if (CHECK) {
          if (w === "ig") { const id = await igContainer(p, url); log(`${p.id}: TEST OK, Instagram accepted the reel (container ${id}, NOT published)`); }
          else log(`${p.id}: TEST: Facebook isn't uploaded in a test (it would publish); the video link works`);
          continue;
        }
        const r = w === "ig" ? await postIG(p, url) : await postFB(p, url);
        st[w] = { ...r, at: new Date().toISOString() }; delete st[w + "_error"]; changed = true;
        log(`${p.id}: posted to ${w === "ig" ? "Instagram" : "Facebook"} ${r.link}`);
      } catch (e) {
        failed++; log(`${p.id}: ${w} FAILED: ${e.message}`);
        if (!CHECK) { st[w + "_error"] = e.message.slice(0, 300); st[w + "_tries"] = (st[w + "_tries"] || 0) + 1; changed = true; }
      }
    }
  }
  if (changed) save();
  if (failed) process.exitCode = CHECK ? 1 : 0;   // a failed post is recorded and retried; the run itself stays green
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
