// 문제지 스크린샷: 정답 코드를 실제 크롬에서 실행 → 시나리오(steps) 수행 → 화면 캡처 (JPEG data URI)
// 사용: node shots.cjs <practical.json> <out shots.json>
const fs = require('fs'), path = require('path'), http = require('http'), { spawn } = require('child_process');
const H = __dirname, S = path.dirname(H);
global.window = {}; global.window.Babel = require(path.join(S, 'react_verify', 'node_modules', '@babel', 'standalone'));
eval(fs.readFileSync(path.join(H, 'core.js'), 'utf8'));
const L = global.window.RL;
const [, , inFile, outFile] = process.argv;
const probs = JSON.parse(fs.readFileSync(inFile, 'utf8'));
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9333 + Math.floor(Math.random() * 400);
const HELPERS = `<script>
window.__shot = async function (steps) {
  const w = window, d = document; const wait = ms => new Promise(r => setTimeout(r, ms));
  const find = x => { if (!x) return null; if (typeof x === 'string') return d.querySelector(x); if (x.nodeType) return x; if (x.text != null) { const all = [...d.querySelectorAll(x.sel || 'button')]; return all.find(e => e.textContent.trim() === x.text) || all.find(e => e.textContent.includes(x.text)) || null; } return null; };
  const t = { $: s => d.querySelector(s), $$: s => [...d.querySelectorAll(s)], find, text: x => { const e = find(x); return e ? e.textContent.trim() : ''; }, value: x => { const e = find(x); return e ? e.value : ''; }, wait,
    async click(x) { const e = find(x); if (!e) throw new Error('no element ' + JSON.stringify(x)); e.click(); await wait(25); },
    async type(x, v) { const e = find(x); if (!e) throw new Error('no input ' + JSON.stringify(x)); const proto = e.tagName === 'TEXTAREA' ? w.HTMLTextAreaElement.prototype : e.tagName === 'SELECT' ? w.HTMLSelectElement.prototype : w.HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(e, String(v)); e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); await wait(25); },
    async key(x, k) { const e = find(x); for (const ty of ['keydown', 'keypress', 'keyup']) e.dispatchEvent(new KeyboardEvent(ty, { key: k, keyCode: k === 'Enter' ? 13 : 0, which: k === 'Enter' ? 13 : 0, bubbles: true })); await wait(25); },
    expect(c, m) { if (!c) throw new Error(m || 'expect'); }, num: s => parseFloat(String(s).replace(/,/g, '').replace(/[^0-9.\\-]/g, '')), active: () => d.activeElement, src: () => '' };
  await (new Function('t', 'return (async () => {\\n' + (steps || '') + '\\n})()'))(t);
  await wait(80); if (d.activeElement && d.activeElement.blur) d.activeElement.blur(); await wait(30);
  return true;
};
</script>`;
const getJSON = u => new Promise((res, rej) => http.get(u, r => { let b = ''; r.on('data', c => b += c); r.on('end', () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } }); }).on('error', rej));
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const prof = path.join(S, 'chprof_shots');
  const ch = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--remote-debugging-port=' + PORT, '--user-data-dir=' + prof, '--window-size=820,900', 'about:blank'], { stdio: 'ignore' });
  let page;
  for (let i = 0; i < 60 && !page; i++) { await sleep(250); try { page = (await getJSON(`http://127.0.0.1:${PORT}/json/list`)).find(t => t.type === 'page'); } catch (e) { } }
  if (!page) throw new Error('chrome not ready');
  const ws = new WebSocket(page.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let id = 0; const pend = {};
  ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pend[d.id]) { pend[d.id](d); delete pend[d.id]; } };
  const cmd = (method, params) => new Promise(r => { const i = ++id; pend[i] = r; ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
  const evalJS = async (expr, awaitPromise) => { const r = await cmd('Runtime.evaluate', { expression: expr, awaitPromise: !!awaitPromise, returnByValue: true }); if (r.result && r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 400)); return r.result && r.result.result && r.result.result.value; };
  await cmd('Page.enable');
  const out = {}; const tmp = path.join(H, '_shot.html');
  for (const pr of probs) {
    if (!pr.sheet || !pr.sheet.screens) continue;
    const files = Object.assign({}, L.scaffold('x'), pr.files, pr.solution || {});
    const c = L.compile(files); if (!c.ok) { console.error(pr.id, 'compile error', c.errors[0]); continue; }
    const html = L.appDoc(c, 'shot').replace('</body></html>', () => HELPERS + '</body></html>');
    fs.writeFileSync(tmp, html);
    out[pr.id] = [];
    for (const sc of pr.sheet.screens) {
      await cmd('Emulation.setDeviceMetricsOverride', { width: 820, height: 900, deviceScaleFactor: 1, mobile: false });
      await cmd('Page.navigate', { url: 'file:///' + tmp.replace(/\\/g, '/') });
      for (let i = 0; i < 80; i++) { await sleep(100); try { if (await evalJS('window.__RL_ready === true')) break; } catch (e) { } }
      await sleep(150);
      try { await evalJS(`window.__shot(${JSON.stringify(sc.steps || '')})`, true); } catch (e) { console.error(pr.id, sc.caption, 'steps failed', e.message); }
      const h = Math.min(1400, Math.max(200, await evalJS("(function(){var r=document.getElementById('root');var b=0;r.querySelectorAll('*').forEach(function(e){var q=e.getBoundingClientRect();if(q.height>0)b=Math.max(b,q.bottom)});return Math.ceil(Math.max(b,r.getBoundingClientRect().bottom)+28)})()")));
      await cmd('Emulation.setDeviceMetricsOverride', { width: 820, height: h, deviceScaleFactor: 1, mobile: false });
      await sleep(120);
      const shot = await cmd('Page.captureScreenshot', { format: 'jpeg', quality: 82, clip: { x: 0, y: 0, width: 820, height: h, scale: 1 }, captureBeyondViewport: true });
      out[pr.id].push('data:image/jpeg;base64,' + shot.result.data);
      console.log(pr.id, sc.caption, h + 'px', Math.round(shot.result.data.length * 0.75 / 1024) + 'KB');
    }
  }
  fs.writeFileSync(outFile, JSON.stringify(out));
  ws.close(); ch.kill();
  try { fs.unlinkSync(tmp); } catch (e) { }
})().catch(e => { console.error(e); process.exit(1); });
