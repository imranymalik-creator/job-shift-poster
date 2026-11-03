// Runs the poster against a pretend Meta server (no real accounts touched).  node tests/poster.test.mjs
import http from "node:http"; import fs from "node:fs"; import { execFile } from "node:child_process"; import os from "node:os"; import path from "node:path";
const calls = []; let n = 0, publishes = 0;
const srv = http.createServer((q, r) => {
  let b = ""; q.on("data", c => b += c); q.on("end", () => {
    const u = new URL(q.url, "http://x"), p = u.pathname, body = Object.fromEntries(new URLSearchParams(b)); calls.push(q.method + " " + p);
    const J = o => { r.writeHead(200, { "content-type": "application/json" }); r.end(JSON.stringify(o)); };
    if (q.method === "HEAD" && p.startsWith("/media/")) { r.writeHead(p.includes("missing") ? 404 : 200); return r.end(); }
    if (p.endsWith("/IG1/media")) { if (!body.video_url || body.media_type !== "REELS") return J({ error: { message: "bad" } }); if (body.collaborators !== '["i.m.imran"]') return J({ error: { message: "collab " + body.collaborators } }); return J({ id: "C" + (++n) }); }
    if (/\/C\d+$/.test(p)) return J({ status_code: "FINISHED" });
    if (p.endsWith("/IG1/media_publish")) { publishes++; return J({ id: "M" + body.creation_id }); }
    if (/\/MC\d+$/.test(p)) return J({ permalink: "https://instagram.com/reel/x" });
    if (q.method === "GET" && p.endsWith("/PG1") && u.searchParams.get("fields") === "access_token") return J({ access_token: "PAGETOKEN", id: "PG1" });
    // like real Meta: the Page's videos need the Page's own key, not the system-user key
    if (p.endsWith("/PG1/video_reels") && body.access_token !== "PAGETOKEN") return J({ error: { message: "(#200) Subject does not have permission to post videos on this target", code: 200 } });
    if (p.endsWith("/PG1/video_reels") && body.upload_phase === "start") return J({ video_id: "V9", upload_url: "x" });
    if (p.startsWith("/video-upload/")) return J({ success: q.headers.file_url && q.headers.authorization === "OAuth PAGETOKEN" ? true : false });
    if (p.endsWith("/PG1/video_reels") && body.upload_phase === "finish") return J({ success: body.video_state === "PUBLISHED" });
    J({ error: { message: "unknown " + p } });
  });
});
await new Promise(r => srv.listen(8471, r));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "poster-")); fs.cpSync(new URL("../poster", import.meta.url).pathname, tmp + "/poster", { recursive: true });
const S = { posts: [
  { id: "a", when: "2026-11-09T19:00:00+05:30", video: "media/a.mp4", platforms: ["ig", "fb"], ig_collaborators: ["i.m.imran"], caption: "A" },
  { id: "b", when: "2026-11-10T19:00:00+05:30", video: "media/b.mp4", ig_collaborators: ["i.m.imran"], caption: "B (future)" },
  { id: "t", when: "2026-11-01T19:00:00+05:30", video: "media/t.mp4", test: true, ig_collaborators: ["i.m.imran"], caption: "test" },
  { id: "old", when: "2026-11-08T01:00:00+05:30", video: "media/o.mp4", caption: "missed" },
  { id: "late", when: "2026-11-09T19:00:00+05:30", video: "media/missing.mp4", caption: "not online yet" } ] };
fs.writeFileSync(tmp + "/schedule.json", JSON.stringify(S));
const env = { ...process.env, META_TOKEN: "T", IG_USER_ID: "IG1", FB_PAGE_ID: "PG1", GRAPH_BASE: "http://127.0.0.1:8471", RUPLOAD_BASE: "http://127.0.0.1:8471", MEDIA_BASE: "http://127.0.0.1:8471/", POSTER_WAIT_MS: "5" };
const run = (args, now) => new Promise((res, rej) => execFile("node", [tmp + "/poster/post.mjs", ...args], { env: { ...env, POSTER_NOW: now }, encoding: "utf8" }, (e, so, se) => e ? rej(new Error(se || e.message)) : res(so + se)));
let ok = 0, bad = 0; const t = (name, c) => { c ? ok++ : bad++; console.log((c ? "ok   " : "FAIL ") + name); };
// 1. test mode: Instagram accepts the upcoming and test reels, nothing is published
let out = await run(["--check"], "2026-11-09T18:00:00+05:30");
t("check: accepted without publishing", /TEST OK/.test(out) && publishes === 0);
t("check: nothing remembered as posted", !fs.existsSync(tmp + "/state/posted.json"));
// 2. real run at 19:30 on 9 Nov: 'a' posts to both, 'b' waits, test never posts, 'old' skipped, 'late' waits for its video
out = await run([], "2026-11-09T19:30:00+05:30");
let st = JSON.parse(fs.readFileSync(tmp + "/state/posted.json", "utf8"));
t("post: a on Instagram", st.a && st.a.ig && st.a.ig.id === "MC" + n);
t("post: a on Facebook", st.a && st.a.fb && st.a.fb.id === "V9");
t("post: future b untouched", !st.b);
t("post: test entry never published", !st.t);
t("post: missed slot (>12 h) skipped, not posted", st.old && st.old.skipped && !st.old.ig);
t("post: video not online yet → waits", !st.late && /not online yet/.test(out));
// 3. run again: nothing posted twice
const before = publishes; await run([], "2026-11-09T20:00:00+05:30");
t("again: nothing posted twice", publishes === before);
console.log(`\n${ok} passed, ${bad} failed`); srv.close(); if (bad) process.exit(1);
