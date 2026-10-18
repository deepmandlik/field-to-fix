// Record real interactions with the Field-to-Fix app (local dev, same Cloud backend) as screencast segments.
// Each segment becomes a folder of JPEG frames + timestamps; mux.mjs turns them into MP4s.
// Usage: node record.mjs <out-dir>
import fs from "node:fs";
import puppeteer from "puppeteer-core";

const OUT = process.argv[2];
const BASE = "http://localhost:3000";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true,
  defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 1.3334 },
});
const page = await browser.newPage();
await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "light" }]);

// A visible cursor and click ripple, since headless screencasts have no pointer.
await page.evaluateOnNewDocument(() => {
  window.addEventListener("DOMContentLoaded", () => {
    const c = document.createElement("div");
    c.id = "__cur";
    c.style.cssText = "position:fixed;left:-50px;top:-50px;width:22px;height:22px;z-index:2147483647;pointer-events:none;transition:transform .08s";
    c.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24"><path d="M3 2l7 19 2.5-7.5L20 11z" fill="#1F1F1F" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    document.body.appendChild(c);
    document.addEventListener("mousemove", (e) => { c.style.left = e.clientX - 3 + "px"; c.style.top = e.clientY - 2 + "px"; }, true);
    document.addEventListener("mousedown", (e) => {
      const r = document.createElement("div");
      r.style.cssText = `position:fixed;left:${e.clientX - 22}px;top:${e.clientY - 22}px;width:44px;height:44px;border-radius:50%;border:3px solid #0B57D0;background:rgba(11,87,208,.18);z-index:2147483646;pointer-events:none;transition:all .45s ease-out`;
      document.body.appendChild(r);
      requestAnimationFrame(() => { r.style.transform = "scale(1.9)"; r.style.opacity = "0"; });
      setTimeout(() => r.remove(), 600);
      c.style.transform = "scale(.85)"; setTimeout(() => (c.style.transform = ""), 120);
    }, true);
  });
});

const cdp = await page.createCDPSession();
let seg = null, n = 0;
cdp.on("Page.screencastFrame", async (f) => {
  if (seg) {
    const name = `${String(n++).padStart(5, "0")}.jpg`;
    fs.writeFileSync(`${OUT}/${seg}/${name}`, Buffer.from(f.data, "base64"));
    fs.appendFileSync(`${OUT}/${seg}/frames.txt`, `${name} ${f.metadata.timestamp}\n`);
  }
  try { await cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }); } catch {}
});
async function start(name) {
  seg = name; n = 0;
  fs.rmSync(`${OUT}/${name}`, { recursive: true, force: true });
  fs.mkdirSync(`${OUT}/${name}`, { recursive: true });
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 88, maxWidth: 1920, maxHeight: 1200, everyNthFrame: 1 });
  await page.mouse.move(720, 450);
  console.log("● rec", name);
}
async function stop(hold = 800) {
  await sleep(hold);
  await cdp.send("Page.stopScreencast");
  fs.appendFileSync(`${OUT}/${seg}/frames.txt`, `END ${Date.now() / 1000}\n`);
  console.log("■ stop", seg, n, "frames");
  seg = null;
}

let mouse = { x: 720, y: 450 };
async function moveTo(x, y, steps = 28) { await page.mouse.move(x, y, { steps }); mouse = { x, y }; }
async function clickSel(sel, text, { pause = 250 } = {}) {
  const box = await page.evaluate((s, t) => {
    const el = [...document.querySelectorAll(s)].find((e) => !t || e.textContent.includes(t));
    if (!el) return null;
    el.scrollIntoView({ block: "center", behavior: "instant" });
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, sel, text);
  if (!box) throw new Error(`not found: ${sel} ${text ?? ""}`);
  await sleep(150);
  await moveTo(box.x, box.y);
  await sleep(pause);
  await page.mouse.down(); await sleep(70); await page.mouse.up();
}
const waitText = (t, timeout = 90000) => page.waitForFunction((x) => document.body.innerText.includes(x), { timeout }, t);
const smoothScroll = (y, ms = 1200) => page.evaluate(async (y, ms) => {
  const y0 = scrollY, t0 = performance.now();
  await new Promise((res) => { const step = (t) => { const k = Math.min(1, (t - t0) / ms); const e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; scrollTo(0, y0 + (y - y0) * e); k < 1 ? requestAnimationFrame(step) : res(); }; requestAnimationFrame(step); });
}, y, ms);
const scrollToSel = async (sel, offset = -90, ms = 1200) => {
  const y = await page.evaluate((s, o) => { const e = document.querySelector(s); return e ? e.getBoundingClientRect().top + scrollY + o : null; }, sel, offset);
  if (y != null) await smoothScroll(y, ms);
};
const as = async (role, path) => {
  await page.evaluate((r) => { localStorage.setItem("f2f.actingRole", r); localStorage.setItem("f2f.guideOpen", "0"); localStorage.setItem("f2f.welcomed", "1"); }, role);
  await page.goto(BASE + path, { waitUntil: "networkidle2" });
  await sleep(1800);
};

// ---------- R1: login as a judge ----------
await page.goto(BASE + "/login", { waitUntil: "networkidle2" });
await page.evaluate(() => { localStorage.setItem("f2f.welcomed", "1"); localStorage.setItem("f2f.guideOpen", "0"); localStorage.setItem("f2f.actingRole", "dealer"); });
await page.reload({ waitUntil: "networkidle2" }); await sleep(1200);
await start("r1-login");
await sleep(800);
await clickSel("label.check", "judge", { pause: 400 }); await sleep(500);
await clickSel("label.check", "judge", { pause: 200 }); await sleep(600);
await clickSel("form button", "Start the demo", { pause: 300 });
await page.waitForFunction(() => location.pathname === "/start", { timeout: 30000 });
await sleep(2500);
await smoothScroll(520, 1800); await sleep(1200);
await stop(600);

// ---------- R2: dealer files a claim with a photo ----------
await as("dealer", "/claim");
await page.evaluate(() => window.scrollTo(0, 300)); await sleep(500);
await start("r2-claim");
await clickSel("button", "Hindi · coolant leak", { pause: 300 }); await sleep(700);
await clickSel(".photo-opt", "Cracked clamp", { pause: 200 }); await sleep(250);
await clickSel(".photo-opt", "Cracked clamp", { pause: 200 }); await sleep(600);
await clickSel("button", "Submit claim", { pause: 300 });
await sleep(1200);
await scrollToSel(".scan", -140, 900);
await waitText("What Gemini saw", 90000);
await sleep(1600);
await scrollToSel(".g3", -30, 1300);
await moveTo(700, 380); await sleep(1500); await moveTo(1250, 330); await sleep(1700);
await stop(400);

// ---------- R3: analyst investigates (quick-reset replay) ----------
await as("analyst", "/case/F2F-0141");
await start("r3-investigate");
await sleep(900);
await clickSel("button", "Investigate with agents", { pause: 400 });
await sleep(2500);
await scrollToSel(".agentlog", -260, 900);
await page.waitForFunction(() => document.body.innerText.includes("Waiting on Kenji"), { timeout: 90000 });
await sleep(1800);
await scrollToSel(".tabs", -10, 1200); await sleep(800);
await smoothScroll(await page.evaluate(() => scrollY + 520), 1600); await sleep(1800);
await stop(400);

// ---------- R4: Ask ----------
await page.evaluate(() => window.scrollTo(0, 0)); await sleep(300);
await start("r4-ask");
await clickSel(".tabs button", "Root cause", { pause: 300 }); await sleep(1000);
await scrollToSel(".tabs", -10, 800);
await clickSel(".suggest button", "Which cities report it most?", { pause: 300 });
await page.waitForFunction(() => [...document.querySelectorAll(".msg.assistant")].some((m) => !m.textContent.includes("Thinking")), { timeout: 120000 });
await sleep(2500);
await stop(300);

// ---------- R5: SQE reads the 8D ----------
await as("sqe", "/case/F2F-0141?tab=8d");
await start("r5-8d");
await sleep(600);
await scrollToSel(".doc", -20, 1200); await sleep(1200);
await smoothScroll(await page.evaluate(() => scrollY + 900), 3500); await sleep(800);
await smoothScroll(await page.evaluate(() => scrollY + 700), 2500); await sleep(800);
await stop(300);

// ---------- R6: SQE approves on the watch (hold to confirm) ----------
await as("sqe", "/watch");
await start("r6-watch-approve");
await sleep(1200);
await clickSel(".wa .wa-card", "Coolant", { pause: 300 }); await sleep(1400);
const hb = await page.evaluate(() => { const r = document.querySelector(".wa .wa-btn.hold").getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
await moveTo(hb.x, hb.y); await sleep(300);
await page.mouse.down(); await sleep(1500); await page.mouse.up();
await page.waitForFunction(() => document.querySelector(".wa-done"), { timeout: 30000 });
await sleep(2200);
await stop(300);

// ---------- R7: supplier responds, AI flags gaps ----------
await as("supplier", "/supplier");
await start("r7-supplier");
await sleep(800);
await clickSel("button", "Fill an example response", { pause: 300 }); await sleep(900);
await clickSel("button", "Submit 8D response", { pause: 300 });
await waitText("AI completeness check", 90000);
await sleep(600);
await scrollToSel(".grid.g2", -40, 1000); await sleep(3200);
await stop(300);

// ---------- R8: SQE sends it back, activity tree ----------
await as("sqe", "/case/F2F-0141?tab=8d");
await start("r8-sendback");
await sleep(800);
await clickSel("button", "Send back with gaps", { pause: 500 }); await sleep(1800);
await page.evaluate(() => window.scrollTo(0, 0)); await sleep(300);
await clickSel(".tabs button", "Activity", { pause: 300 }); await sleep(1000);
await scrollToSel(".tabs", -10, 1000); await sleep(1200);
await smoothScroll(await page.evaluate(() => scrollY + 500), 2200); await sleep(1500);
await stop(300);

// ---------- R9: dealer dictates a claim on the watch ----------
await as("dealer", "/watch");
await clickSel(".seg button", "Wear OS", { pause: 100 }); await sleep(400);
await start("r9-watch-dictate");
await sleep(800);
await clickSel(".wa .wa-btn", "Dictate", { pause: 300 }); await sleep(900);
await clickSel(".wa .wa-card", "Hindi", { pause: 300 }); await sleep(1100);
await clickSel(".wa .wa-btn", "File claim", { pause: 300 });
await page.waitForFunction(() => document.querySelector(".wa-done"), { timeout: 90000 });
await sleep(2400);
await stop(300);

// ---------- R10: head of quality overview ----------
await as("exec", "/overview");
await start("r10-overview");
await sleep(1500);
await smoothScroll(560, 2600); await sleep(1500);
await smoothScroll(1150, 2200); await sleep(1500);
await stop(300);

await browser.close();
console.log("done");
