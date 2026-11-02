// © 2026 Job Shift Careers. Checks the Meta key and prints the two ids the poster needs.
//   node poster/whoami.mjs        (META_TOKEN set)
import { CFG, g } from "./graph.mjs";
try {
  const me = await g("GET", "me", { fields: "id,name" });
  console.log(`Key works. It belongs to: ${me.name} (${me.id})`);
  let pages = [];
  try { pages = (await g("GET", "me/accounts", { fields: "name,id,instagram_business_account{id,username}" })).data || []; } catch (e) {}
  if (!pages.length && CFG.page) pages = [await g("GET", CFG.page, { fields: "name,id,instagram_business_account{id,username}" })];
  if (!pages.length) console.log("No Facebook Page found for this key. Check the key has the Job Shift Careers Page.");
  for (const p of pages) {
    const ig = p.instagram_business_account;
    console.log(`Facebook Page: ${p.name}  →  FB_PAGE_ID = ${p.id}`);
    console.log(ig ? `  Instagram: @${ig.username}  →  IG_USER_ID = ${ig.id}` : "  No Instagram business account linked to this Page.");
  }
  const perms = await g("GET", "me/permissions").catch(() => null);
  if (perms && perms.data) console.log("Permissions granted:", perms.data.filter(x => x.status === "granted").map(x => x.permission).join(", "));
} catch (e) { console.error(e.message); process.exitCode = 1; }
