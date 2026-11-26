// Monthly content refresh for Open tabs.
// Asks Claude for fresh cards, statements and pairs, replaces the OLDEST items
// in content.json (arrays are ordered oldest first) and writes pr-body.md for review.
//
// Usage:  ANTHROPIC_API_KEY=... node scripts/update-content.mjs
// Test:   node scripts/update-content.mjs --mock response.json   (no API call)
import fs from "node:fs";

const CONTENT = process.env.CONTENT_PATH || "content.json";
const BODY = process.env.BODY_PATH || "pr-body.md";
const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-5-5";
const args = process.argv.slice(2);
const mockFile = args.includes("--mock") ? args[args.indexOf("--mock") + 1] : null;

// How many items to rotate out per theme. Time-sensitive themes change more.
const PLAN = {
  ai:   {deep: 4, hot: 3, pairs: 1},
  tech: {deep: 4, hot: 3, pairs: 1},
  hot:  {deep: 3, hot: 3, pairs: 1},
  ideas:{deep: 2, hot: 2, pairs: 0},
  lessons:{deep: 2, hot: 2, pairs: 0},
  learn:{deep: 2, hot: 2, pairs: 0},
  adventure:{deep: 1, hot: 1, pairs: 0},
  recs: {deep: 2, hot: 2, pairs: 1},
};

const doc = JSON.parse(fs.readFileSync(CONTENT, "utf8"));
const today = new Date().toISOString().slice(0, 10);

function buildPrompt(){
  const parts = doc.themes.filter(t => PLAN[t.id]).map(t => {
    const p = PLAN[t.id];
    return `## ${t.id}: ${t.name} (${t.tag})
Write exactly: ${p.deep} new deep cards, ${p.hot} new hot or not statements, ${p.pairs} new this-or-that pairs.
Current deep cards:\n${t.deep.map(x => "- " + x).join("\n")}
Current statements:\n${t.hot.map(x => "- " + x).join("\n")}
Current pairs:\n${t.pairs.map(x => "- " + x.join(" / ")).join("\n")}`;
  }).join("\n\n");
  return `Today is ${today}. You refresh the content of "Open tabs", a conversation game that remote teams of tech and design professionals play for 45 minutes. Content must feel current: reflect what people in technology and work are talking about right now (use web search if it is available, otherwise rely on your knowledge and prefer lasting topics over very recent news).

Rules:
- Plain English, short, friendly, sentence case. No jargon, no emojis, no dashes used as punctuation.
- Deep cards: one open question each, ending with "?", up to 110 characters, answerable in under a minute.
- Hot or not statements: one clear opinion that people can rate from 1 to 5, ending with ".", up to 110 characters.
- Pairs: two short options (up to 40 characters each) for "this or that".
- Safe for work: no politics, religion, health, money or personal-life questions, and nothing that names a company or person negatively.
- Do not repeat or lightly reword any current item. Do not copy text from the web.

${parts}

Reply with JSON only, no other text, in this exact shape:
{"themes":{"<id>":{"deep":["..."],"hot":["..."],"pairs":[["a","b"]]}}}`;
}

async function call(useSearch){
  const body = {model: MODEL, max_tokens: 8000, messages: [{role: "user", content: buildPrompt()}]};
  if (useSearch) body.tools = [{type: "web_search_20250305", name: "web_search", max_uses: 5}];
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {"x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json"},
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error(`API ${r.status}: ${(await r.text()).slice(0, 400)}`);
  const j = await r.json();
  return j.content.filter(b => b.type === "text").map(b => b.text).join("\n");
}

async function getResponse(){
  if (mockFile) return fs.readFileSync(mockFile, "utf8");
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set");
  if (process.env.NO_SEARCH !== "1"){
    try { return await call(true); }
    catch (e) { console.warn("Web search call failed, retrying without it.\n" + e.message); }
  }
  return call(false);
}

const norm = s => s.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
const bad = s => /[—–]/.test(s) || /\p{Extended_Pictographic}/u.test(s);
function cleanList(list, n, {end, max}, existing){
  if (!Array.isArray(list) || list.length !== n) return null;
  const seen = new Set(existing.map(norm)), out = [];
  for (let x of list){
    if (typeof x !== "string") return null;
    x = x.trim();
    if (x.length < 15 || x.length > max || !x.endsWith(end) || bad(x) || seen.has(norm(x))) return null;
    seen.add(norm(x)); out.push(x);
  }
  return out;
}
function cleanPairs(list, n, existing){
  if (!Array.isArray(list) || list.length !== n) return null;
  const seen = new Set(existing.flat().map(norm)), out = [];
  for (const p of list){
    if (!Array.isArray(p) || p.length !== 2) return null;
    const [a, b] = p.map(x => typeof x === "string" ? x.trim() : "");
    if (!a || !b || a.length > 40 || b.length > 40 || norm(a) === norm(b) || bad(a) || bad(b) || seen.has(norm(a)) || seen.has(norm(b))) return null;
    seen.add(norm(a)); seen.add(norm(b)); out.push([a, b]);
  }
  return out;
}

const raw = await getResponse();
const start = raw.indexOf("{"), end = raw.lastIndexOf("}");
if (start < 0 || end < 0) throw new Error("No JSON found in the response");
const gen = JSON.parse(raw.slice(start, end + 1)).themes || {};

const report = [];
for (const t of doc.themes){
  const plan = PLAN[t.id], g = gen[t.id];
  if (!plan || !g) continue;
  const deep = cleanList(g.deep, plan.deep, {end: "?", max: 110}, t.deep);
  const hot = cleanList(g.hot, plan.hot, {end: ".", max: 110}, t.hot);
  const pairs = cleanPairs(g.pairs || [], plan.pairs, t.pairs);
  if (!deep || !hot || !pairs){ console.warn(`Skipping ${t.id}: the generated items did not pass validation.`); continue; }
  const gone = [...t.deep.slice(0, deep.length), ...t.hot.slice(0, hot.length), ...t.pairs.slice(0, pairs.length).map(p => p.join(" / "))];
  t.deep = [...t.deep.slice(deep.length), ...deep];
  t.hot = [...t.hot.slice(hot.length), ...hot];
  t.pairs = [...t.pairs.slice(pairs.length), ...pairs];
  report.push(`### ${t.name}\n**Added**\n${[...deep, ...hot, ...pairs.map(p => p.join(" / "))].map(x => "- " + x).join("\n")}\n\n**Removed**\n${gone.map(x => "- " + x).join("\n")}\n`);
}

if (!report.length){ console.log("No changes."); process.exit(0); }
doc.version = today;
fs.writeFileSync(CONTENT, JSON.stringify(doc, null, 2) + "\n");
fs.writeFileSync(BODY, `Monthly content refresh (${today}).\n\nReview each item before merging: tone, accuracy and fit for a team session. Edit \`content.json\` in this branch if something should change. Nothing goes live until you merge.\n\n${report.join("\n")}`);
console.log(`Updated ${report.length} theme(s).`);
