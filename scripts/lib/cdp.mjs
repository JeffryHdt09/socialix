// Un pilote de Chrome minimal, sans dépendance : le protocole DevTools (CDP) parlé par le WebSocket de Node. Suffit pour charger une page,
// lire ce qu'elle affiche, cliquer, taper, appuyer sur une touche, prendre une capture et lancer axe-core (accessibilité).
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const CHROME_CANDIDATES = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe"];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function launchChrome({ port = 9333, width = 1280, height = 900 } = {}) {
  const exe = CHROME_CANDIDATES.find((p) => fs.existsSync(p));
  if (!exe) throw new Error("Chrome introuvable");
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "socialix-chrome-"));
  const proc = spawn(exe, ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "--no-first-run", "--no-default-browser-check", "--disable-gpu", `--window-size=${width},${height}`, "about:blank"], { stdio: "ignore" });

  let list = null;
  for (let i = 0; i < 50 && !list; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/list`);
      const targets = await res.json();
      list = targets.find((t) => t.type === "page") ?? null;
    } catch {
      await sleep(200);
    }
  }
  if (!list) {
    proc.kill();
    throw new Error("Chrome n'a pas démarré");
  }

  const ws = new WebSocket(list.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });

  let id = 0;
  const pending = new Map();
  const listeners = new Set();
  const consoleErrors = [];
  ws.addEventListener("message", (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(`${msg.error.message}`));
      else resolve(msg.result);
    } else if (msg.method) {
      if (msg.method === "Runtime.exceptionThrown") consoleErrors.push(`exception : ${msg.params.exceptionDetails?.exception?.description?.split("\n")[0] ?? msg.params.exceptionDetails?.text}`);
      if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") consoleErrors.push(`console.error : ${msg.params.args.map((a) => a.value ?? a.description ?? "").join(" ").slice(0, 200)}`);
      for (const l of listeners) l(msg);
    }
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const n = ++id;
      pending.set(n, { resolve, reject });
      ws.send(JSON.stringify({ id: n, method, params }));
    });

  await send("Page.enable");
  await send("Runtime.enable");
  await send("Network.enable");

  const evaluate = async (expression) => {
    const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(`évaluation : ${r.exceptionDetails.exception?.description?.split("\n")[0] ?? r.exceptionDetails.text}`);
    return r.result.value;
  };
  const waitFor = async (expression, { timeout = 60_000, every = 150 } = {}) => {
    const t0 = Date.now();
    let last;
    while (Date.now() - t0 < timeout) {
      try {
        last = await evaluate(expression);
        if (last) return last;
      } catch {
        /* la page se recharge : on réessaie */
      }
      await sleep(every);
    }
    throw new Error(`délai dépassé en attendant : ${expression.slice(0, 120)}`);
  };

  return {
    consoleErrors,
    evaluate,
    waitFor,
    send,
    async goto(url) {
      const loaded = new Promise((resolve) => {
        const l = (msg) => {
          if (msg.method === "Page.loadEventFired") {
            listeners.delete(l);
            resolve();
          }
        };
        listeners.add(l);
      });
      await send("Page.navigate", { url });
      await Promise.race([loaded, sleep(60_000)]);
      await waitFor("document.readyState === 'complete'");
      await sleep(400); // l'hydratation de React
    },
    async setCookie(name, value, url) {
      await send("Network.setCookie", { name, value, url, httpOnly: true, sameSite: "Lax" });
    },
    async setViewport(w, h, mobile = false) {
      await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile });
    },
    async screenshot(file) {
      const { data } = await send("Page.captureScreenshot", { format: "png" });
      fs.writeFileSync(file, Buffer.from(data, "base64"));
    },
    // Une vraie frappe (pas une valeur posée par le script) : indispensable pour tester « Entrée dans un champ »
    async press(key) {
      const codes = { Enter: { code: "Enter", vk: 13, text: "\r" } };
      const k = codes[key];
      await send("Input.dispatchKeyEvent", { type: "keyDown", key, code: k.code, windowsVirtualKeyCode: k.vk, text: k.text });
      await send("Input.dispatchKeyEvent", { type: "keyUp", key, code: k.code, windowsVirtualKeyCode: k.vk });
    },
    // Un vrai clic de souris au centre d'un élément (certains composants, comme les onglets, réagissent à l'appui et non au « click »)
    async clickAt(elementExpression) {
      const point = await evaluate(`(() => { const el = ${elementExpression}; if (!el) return null; el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
      if (!point) return false;
      await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: point.x, y: point.y });
      await send("Input.dispatchMouseEvent", { type: "mousePressed", x: point.x, y: point.y, button: "left", clickCount: 1 });
      await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: point.x, y: point.y, button: "left", clickCount: 1 });
      return true;
    },
    async type(text) {
      await send("Input.insertText", { text });
    },
    async runAxe(axeSource) {
      await evaluate(axeSource);
      return evaluate(`axe.run(document, { resultTypes: ['violations'] }).then(r => r.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, target: v.nodes[0] && v.nodes[0].target.join(' ') })))`);
    },
    async close() {
      try {
        ws.close();
      } catch {
        /* déjà fermé */
      }
      proc.kill();
      await sleep(500);
      fs.rmSync(profile, { recursive: true, force: true, maxRetries: 3 });
    },
  };
}
