// © 2026 Job Shift Careers. Small helper for Meta's Graph API (Instagram + Facebook Page). No extra packages.
// Settings come from the repository's secrets and variables (Settings › Secrets and variables › Actions):
//   META_TOKEN   (secret)   a token that can post for the Job Shift Careers Page and @jobshiftcareers
//   IG_USER_ID   (variable) the Instagram business account id   (poster/whoami.mjs prints it)
//   FB_PAGE_ID   (variable) the Facebook Page id                 (poster/whoami.mjs prints it)
//   GRAPH_VERSION (variable, optional) default v23.0
export const CFG = {
  token: process.env.META_TOKEN || "",
  ig: process.env.IG_USER_ID || "",
  page: process.env.FB_PAGE_ID || "",
  ver: process.env.GRAPH_VERSION || "v23.0",
  base: process.env.GRAPH_BASE || "https://graph.facebook.com",
  rupload: process.env.RUPLOAD_BASE || "https://rupload.facebook.com",
  mediaBase: (process.env.MEDIA_BASE || "https://imranymalik-creator.github.io/job-shift-poster/").replace(/\/?$/, "/")
};
export const sleep = ms => new Promise(r => setTimeout(r, ms));

// one call; Meta's error text comes back readable, without the token
export async function g(method, path, params = {}, opt = {}) {
  const u = new URL(`${CFG.base}/${CFG.ver}/${path.replace(/^\//, "")}`);
  const body = new URLSearchParams();
  const put = method === "GET" ? (k, v) => u.searchParams.set(k, v) : (k, v) => body.set(k, v);
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null) put(k, typeof v === "object" ? JSON.stringify(v) : String(v));
  put("access_token", opt.token || CFG.token);
  const r = await fetch(u, method === "GET" ? {} : { method, body });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) {
    const e = j.error || {};
    throw new Error(`Meta said no (${method} ${path}): ${e.message || r.status}${e.error_user_msg ? " — " + e.error_user_msg : ""} [code ${e.code || "?"}${e.error_subcode ? "/" + e.error_subcode : ""}]`);
  }
  return j;
}
export const mediaUrl = file => /^https?:\/\//.test(file) ? file : CFG.mediaBase + file.replace(/^\//, "").split("/").map(encodeURIComponent).join("/");

// the video must be reachable on the web before Instagram can fetch it (GitHub Pages takes a minute after a push)
export async function reachable(url) {
  try { const r = await fetch(url, { method: "HEAD" }); return r.ok; } catch (e) { return false; }
}
