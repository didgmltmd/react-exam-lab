/* core.js — 프로젝트 파일, 브라우저 안 컴파일(Babel), 미리보기 런타임, 자동 채점 */
(function () {
  'use strict';
  const L = window.RL = window.RL || {};
  const CDN = L.CDN = {
    monaco: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.52.2/min/vs',
    babel: 'https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/7.26.4/babel.min.js',
    react: 'https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.development.js',
    reactDom: 'https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.development.js',
  };
  L.esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  L.icon = (n, size) => { const d = (window.ICONS || {})[n]; size = size || 16; return d ? `<svg class="ic" viewBox="${d[0]}" width="${size}" height="${size}" fill="currentColor" aria-hidden="true">${d[1]}</svg>` : ''; };
  L.store = {
    get(k, d) { try { const v = localStorage.getItem('reactlab.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('reactlab.' + k, JSON.stringify(v)); } catch (e) { } },
    del(k) { try { localStorage.removeItem('reactlab.' + k); } catch (e) { } },
  };
  // 페이지 안 대화상자 (confirm/prompt 대신). buttons: [{k, label, pri}] → Promise<{k, value}>
  L.dialog = function (o) {
    return new Promise(res => {
      const dark = !document.getElementById('ide').hidden;
      const w = document.createElement('div'); w.className = 'dlg-back' + (dark ? ' dark' : '');
      const btns = o.buttons || [{ k: 'cancel', label: '취소' }, { k: 'ok', label: o.ok || '확인', pri: true }];
      w.innerHTML = `<div class="dlg" role="dialog" aria-modal="true" aria-labelledby="dlg-t"><div class="dlg-t" id="dlg-t">${L.esc(o.title || '')}</div>${o.msg ? `<div class="dlg-m">${L.esc(o.msg).replace(/\n/g, '<br>')}</div>` : ''}${o.input != null ? `<input class="dlg-in" id="dlg-in" value="${L.esc(o.input)}" placeholder="${L.esc(o.placeholder || '')}" spellcheck="false" autocomplete="off">` : ''}<div class="dlg-b">${btns.map(b => `<button class="dlg-btn${b.pri ? ' pri' : ''}" data-k="${b.k}">${L.esc(b.label)}</button>`).join('')}</div></div>`;
      document.body.appendChild(w);
      const inp = w.querySelector('.dlg-in'); const pri = w.querySelector('.dlg-btn.pri') || w.querySelector('.dlg-btn');
      setTimeout(() => { if (inp) { inp.focus(); inp.select(); } else pri.focus(); }, 0);
      const done = k => { w.remove(); res({ k, value: inp ? inp.value : null }); };
      w.addEventListener('click', e => { const b = e.target.closest('[data-k]'); if (b) done(b.dataset.k); else if (e.target === w) done('cancel'); });
      w.addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); done('cancel'); } else if (e.key === 'Enter' && (inp || !e.target.closest('button'))) { e.preventDefault(); done(pri.dataset.k); } }, true);
    });
  };
  L.ask = async (title, msg, ok) => (await L.dialog({ title, msg, ok })).k === 'ok';
  L.loadScript = (src) => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('load ' + src)); document.head.appendChild(s); });
  let babelP = null;
  // Monaco 의 AMD 로더(define.amd)가 있으면 Babel 이 전역에 안 붙으므로 잠시 숨김
  L.babel = () => babelP || (babelP = window.Babel ? Promise.resolve(window.Babel) : (() => { const d = window.define; if (d && d.amd) window.define = undefined; return L.loadScript(CDN.babel).then(() => { if (d) window.define = d; return window.Babel; }); })());

  /* ---------- Vite 프로젝트 기본 파일 ---------- */
  const VITE_SVG = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" aria-hidden="true" role="img" class="iconify iconify--logos" width="31.88" height="32" preserveAspectRatio="xMidYMid meet" viewBox="0 0 256 257"><defs><linearGradient id="IconifyId1813088fe1fbc01fb466" x1="-.828%" x2="57.636%" y1="7.652%" y2="78.411%"><stop offset="0%" stop-color="#41D1FF"></stop><stop offset="100%" stop-color="#BD34FE"></stop></linearGradient><linearGradient id="IconifyId1813088fe1fbc01fb467" x1="43.376%" x2="50.316%" y1="2.242%" y2="89.03%"><stop offset="0%" stop-color="#FFEA83"></stop><stop offset="8.333%" stop-color="#FFDD35"></stop><stop offset="100%" stop-color="#FFA800"></stop></linearGradient></defs><path fill="url(#IconifyId1813088fe1fbc01fb466)" d="M255.153 37.938L134.897 252.976c-2.483 4.44-8.862 4.466-11.382.048L.875 37.958c-2.746-4.814 1.371-10.646 6.827-9.67l120.385 21.517a6.537 6.537 0 0 0 2.322-.004l117.867-21.483c5.438-.991 9.574 4.796 6.877 9.62Z"></path><path fill="url(#IconifyId1813088fe1fbc01fb467)" d="M185.432.063L96.44 17.501a3.268 3.268 0 0 0-2.634 3.014l-5.474 92.456a3.268 3.268 0 0 0 3.997 3.378l24.777-5.718c2.318-.535 4.413 1.507 3.936 3.838l-7.361 36.047c-.495 2.426 1.782 4.5 4.151 3.78l15.304-4.649c2.372-.72 4.652 1.36 4.15 3.788l-11.698 56.621c-.732 3.542 3.979 5.473 5.943 2.437l1.313-2.028l72.516-144.72c1.215-2.423-.88-5.186-3.54-4.672l-25.505 4.922c-2.396.462-4.435-1.77-3.759-4.114l16.646-57.705c.677-2.35-1.37-4.583-3.769-4.113Z"></path></svg>\n';
  const REACT_SVG = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" aria-hidden="true" role="img" class="iconify iconify--logos" width="35.93" height="32" preserveAspectRatio="xMidYMid meet" viewBox="0 0 256 228"><path fill="#00D8FF" d="M210.483 73.824a171.49 171.49 0 0 0-8.24-2.597c.465-1.9.893-3.777 1.273-5.621c6.238-30.281 2.16-54.676-11.769-62.708c-13.355-7.7-35.196.329-57.254 19.526a171.23 171.23 0 0 0-6.375 5.848a155.866 155.866 0 0 0-4.241-3.917C100.759 3.829 77.587-4.822 63.673 3.233C50.33 10.957 46.379 33.89 51.995 62.588a170.974 170.974 0 0 0 1.892 8.48c-3.28.932-6.445 1.924-9.474 2.98C17.309 83.498 0 98.307 0 113.668c0 15.865 18.582 31.778 46.812 41.427a145.52 145.52 0 0 0 6.921 2.165a167.467 167.467 0 0 0-2.01 9.138c-5.354 28.2-1.173 50.591 12.134 58.266c13.744 7.926 36.812-.22 59.273-19.855a145.567 145.567 0 0 0 5.342-4.923a168.064 168.064 0 0 0 6.92 6.314c21.758 18.722 43.246 26.282 56.54 18.586c13.731-7.949 18.194-32.003 12.4-61.268a145.016 145.016 0 0 0-1.535-6.842c1.62-.48 3.21-.974 4.76-1.488c29.348-9.723 48.443-25.443 48.443-41.52c0-15.417-17.868-30.326-45.517-39.844Z"></path></svg>\n';
  L.scaffold = function (name) {
    return {
      '.gitignore': '# Logs\nlogs\n*.log\nnpm-debug.log*\n\nnode_modules\ndist\ndist-ssr\n*.local\n\n# Editor directories and files\n.vscode/*\n!.vscode/extensions.json\n.idea\n.DS_Store\n',
      'eslint.config.js': "import js from '@eslint/js'\nimport globals from 'globals'\nimport reactHooks from 'eslint-plugin-react-hooks'\nimport reactRefresh from 'eslint-plugin-react-refresh'\nimport { defineConfig, globalIgnores } from 'eslint/config'\n\nexport default defineConfig([\n  globalIgnores(['dist']),\n  {\n    files: ['**/*.{js,jsx}'],\n    extends: [\n      js.configs.recommended,\n      reactHooks.configs['recommended-latest'],\n      reactRefresh.configs.vite,\n    ],\n    languageOptions: {\n      ecmaVersion: 2020,\n      globals: globals.browser,\n      parserOptions: {\n        ecmaVersion: 'latest',\n        ecmaFeatures: { jsx: true },\n        sourceType: 'module',\n      },\n    },\n    rules: {\n      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],\n    },\n  },\n])\n",
      'index.html': `<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <link rel="icon" type="image/svg+xml" href="/vite.svg" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>${name}</title>\n  </head>\n  <body>\n    <div id="root"></div>\n    <script type="module" src="/src/main.jsx"></script>\n  </body>\n</html>\n`,
      'package.json': JSON.stringify({ name, private: true, version: '0.0.0', type: 'module', scripts: { dev: 'vite', build: 'vite build', lint: 'eslint .', preview: 'vite preview' }, dependencies: { react: '^19.1.1', 'react-dom': '^19.1.1' }, devDependencies: { '@eslint/js': '^9.36.0', '@types/react': '^19.1.16', '@types/react-dom': '^19.1.9', '@vitejs/plugin-react': '^5.0.4', eslint: '^9.36.0', 'eslint-plugin-react-hooks': '^5.2.0', 'eslint-plugin-react-refresh': '^0.4.22', globals: '^16.4.0', vite: '^7.1.7' } }, null, 2) + '\n',
      'README.md': '# React + Vite\n\nThis template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.\n',
      'vite.config.js': "import { defineConfig } from 'vite'\nimport react from '@vitejs/plugin-react'\n\n// https://vite.dev/config/\nexport default defineConfig({\n  plugins: [react()],\n})\n",
      'public/vite.svg': VITE_SVG,
      'src/assets/react.svg': REACT_SVG,
    };
  };
  L.NODE_MODULES = ['.vite', '@babel', '@eslint', '@vitejs', 'eslint', 'eslint-plugin-react-hooks', 'globals', 'react', 'react-dom', 'rollup', 'scheduler', 'vite'];

  /* ---------- 컴파일 ---------- */
  const isCode = p => /\.(jsx?|mjs)$/.test(p);
  const isCss = p => /\.css$/.test(p);
  function norm(p) { const out = []; p.split('/').forEach(s => { if (!s || s === '.') return; if (s === '..') out.pop(); else out.push(s); }); return out.join('/'); }
  const PKGS = ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime', 'react/jsx-dev-runtime'];
  function resolve(files, from, spec) {
    if (PKGS.includes(spec)) return spec;
    if (!(spec.startsWith('.') || spec.startsWith('/'))) return null;
    const base = spec.startsWith('/') ? norm(spec) : norm(from.split('/').slice(0, -1).join('/') + '/' + spec);
    for (const e of ['', '.jsx', '.js', '/index.jsx', '/index.js']) if (files[base + e] != null) return base + e;
    if (/\.svg$/.test(base) && files['public/' + base.replace(/^public\//, '')] != null) return base;
    return null;
  }
  L.resolve = resolve;
  // files: {path: source}. 결과: {ok, mods:{path:code}, css:{path:text}, errors:[{file,line,col,msg,frame,plugin}]}
  L.compile = function (files) {
    const B = window.Babel; const mods = {}, css = {}, errors = [];
    for (const p of Object.keys(files)) {
      if (!p.startsWith('src/')) continue;
      if (isCss(p)) { css[p] = files[p]; continue; }
      if (/\.svg$/.test(p)) { mods[p] = 'module.exports = { __esModule: true, default: "data:image/svg+xml;utf8,' + encodeURIComponent(files[p]).replace(/"/g, '%22') + '" };'; continue; }
      if (!isCode(p)) continue;
      try {
        const r = B.transform(files[p], { filename: '/' + p, sourceType: 'module', presets: [['react', { runtime: 'classic', development: false }]], plugins: ['transform-modules-commonjs'], retainLines: true, highlightCode: false });
        mods[p] = r.code;
        const re = /require\("([^"]+)"\)/g; let m;
        while ((m = re.exec(r.code))) {
          const spec = m[1];
          if (!resolve(files, p, spec)) {
            const ln = (files[p].split('\n').findIndex(l => l.includes("'" + spec + "'") || l.includes('"' + spec + '"')) + 1) || 1;
            errors.push({ file: p, line: ln, col: 1, plugin: 'vite:import-analysis', msg: `Failed to resolve import "${spec}" from "${p}". Does the file exist?`, frame: frameOf(files[p], ln, 1) });
          }
        }
      } catch (e) {
        const loc = e.loc || {}; const line = loc.line || 1, col = (loc.column || 0) + 1;
        const msg = String(e.message || e).split('\n')[0].replace(/^\/?src\//, 'src/').replace(/^[^:]*: /, '');
        errors.push({ file: p, line, col, plugin: 'vite:react-babel', msg, frame: frameOf(files[p], line, col) });
      }
    }
    if (!mods['src/main.jsx'] && !errors.length) errors.push({ file: 'index.html', line: 11, col: 1, plugin: 'vite:import-analysis', msg: 'Failed to load url /src/main.jsx (resolved id: /src/main.jsx). Does the file exist?', frame: '' });
    return { ok: !errors.length, mods, css, errors };
  };
  function frameOf(src, line, col) {
    const ls = src.split('\n'); const a = Math.max(1, line - 2), b = Math.min(ls.length, line + 2); const w = String(b).length; const out = [];
    for (let i = a; i <= b; i++) { out.push(`${i === line ? '>' : ' '} ${String(i).padStart(w)} | ${ls[i - 1]}`); if (i === line) out.push(`  ${' '.repeat(w)} | ${' '.repeat(Math.max(0, col - 1))}^`); }
    return out.join('\n');
  }

  /* ---------- 미리보기 문서 ---------- */
  const PROJ_DIR = 'C:/Users/user/Desktop/';
  L.overlayDoc = function (err, project) {
    const e = L.esc;
    return `<!doctype html><html><head><meta charset="utf-8"><title>Vite + React</title></head><body style="margin:0">
<div style="position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.66);display:flex;align-items:flex-start;overflow:auto">
<div style="font-family:ui-monospace,Menlo,Consolas,monospace;line-height:1.5;width:800px;max-width:calc(100vw - 32px);color:#d8d8d8;margin:30px auto;padding:2.5vh 4vw;position:relative;background:#181818;border-radius:6px 6px 8px 8px;box-shadow:0 19px 38px rgba(0,0,0,.3),0 15px 12px rgba(0,0,0,.22);overflow:hidden;border-top:8px solid #ff5555;direction:ltr;text-align:left">
<pre style="font-family:inherit;font-size:16px;margin:0 0 1em;overflow-x:scroll;scrollbar-width:none;white-space:pre-wrap;color:#ff5555;font-weight:600"><span style="color:#ff5555">[plugin:${e(err.plugin)}] </span>${e(err.file === 'index.html' ? '' : '/' + err.file + ': ')}${e(err.msg)}</pre>
<pre style="font-family:inherit;font-size:16px;margin:0 0 1em;white-space:pre-wrap;color:#2dd9da">${e(PROJ_DIR + project + '/' + err.file)}:${err.line}:${err.col}</pre>
<pre style="font-family:inherit;font-size:16px;margin:0 0 1em;overflow-x:auto;color:#c9c9c9;background:#ffffff0d;padding:1em;border-radius:4px">${e(err.frame || '')}</pre>
<div style="font-size:13px;color:#999;border-top:1px dotted #999;padding-top:13px;line-height:1.8">Click outside, press <kbd style="line-height:1.5;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:.75rem;font-weight:700;background:#38383d;color:#fff;padding:.15rem .3rem;border-radius:.25rem;border-width:.0625rem .0625rem .1875rem;border-style:solid;border-color:#54545d">Esc</kbd> key, or fix the code to dismiss.<br>You can also disable this overlay by setting <code style="font-size:13px;font-family:inherit;color:#ffd166">server.hmr.overlay</code> to <code style="font-size:13px;font-family:inherit;color:#ffd166">false</code> in <code style="font-size:13px;font-family:inherit;color:#ffd166">vite.config.js</code>.</div>
</div></div></body></html>`;
  };
  // 실행 문서. tag: 'preview' | 'grade'
  L.appDoc = function (c, tag) {
    const J = s => JSON.stringify(s).replace(/<\/(script)/gi, '<\\/$1');
    return `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Vite + React</title>
<script>
(function(){var tag=${J(tag)};function fmt(a){if(typeof a[0]==='string'&&/%[sdoOifc]/.test(a[0])){var i=1;var s=a[0].replace(/%([sdoOifc])/g,function(m,k){if(k==='c'){i++;return ''}var v=a[i++];return typeof v==='object'?str(v):String(v)});return [s].concat(a.slice(i).map(str)).join(' ')}return a.map(str).join(' ')}
function str(v){if(typeof v==='string')return v;if(v instanceof Error)return v.stack||String(v);try{return JSON.stringify(v,function(k,x){return typeof x==='function'?'ƒ '+(x.name||'')+'()':x})}catch(e){return String(v)}}
['log','info','warn','error','debug'].forEach(function(k){var o=console[k];console[k]=function(){var a=[].slice.call(arguments);try{if(parent&&parent.RL&&parent.RL.onConsole)parent.RL.onConsole(k,fmt(a),tag)}catch(e){}return o.apply(console,a)}});
window.addEventListener('error',function(ev){try{parent.RL.onConsole('error','Uncaught '+(ev.error&&ev.error.stack?ev.error.stack.split('\\n').slice(0,2).join('\\n'):ev.message),tag)}catch(e){}});
window.addEventListener('unhandledrejection',function(ev){try{parent.RL.onConsole('error','Uncaught (in promise) '+String(ev.reason),tag)}catch(e){}});})();
</script>
<script src="${CDN.react}"></script><script src="${CDN.reactDom}"></script>
</head><body><div id="root"></div>
<script>
(function(){var M=${J(c.mods)},C=${J(c.css)},cache={};
function norm(p){var o=[];p.split('/').forEach(function(s){if(!s||s==='.')return;if(s==='..')o.pop();else o.push(s)});return o.join('/')}
function res(from,spec){var b=spec.charAt(0)==='/'?norm(spec):norm(from.split('/').slice(0,-1).join('/')+'/'+spec);var ex=['','.jsx','.js','/index.jsx','/index.js'];for(var i=0;i<ex.length;i++){if(M[b+ex[i]]!=null||C[b+ex[i]]!=null)return b+ex[i]}return null}
var I=ReactDOM.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED;
var client={createRoot:function(a,b){if(I)I.usingClientEntryPoint=true;try{return ReactDOM.createRoot(a,b)}finally{if(I)I.usingClientEntryPoint=false}},hydrateRoot:function(a,b,c){if(I)I.usingClientEntryPoint=true;try{return ReactDOM.hydrateRoot(a,b,c)}finally{if(I)I.usingClientEntryPoint=false}}};
function jsx(t,p,k){var q=Object.assign({},p);if(k!==undefined)q.key=k;var ch=q.children;delete q.children;return ch===undefined?React.createElement(t,q):Array.isArray(ch)?React.createElement.apply(null,[t,q].concat(ch)):React.createElement(t,q,ch)}
function req(from,spec){if(spec==='react')return React;if(spec==='react-dom')return ReactDOM;if(spec==='react-dom/client')return client;if(spec==='react/jsx-runtime'||spec==='react/jsx-dev-runtime')return {jsx:jsx,jsxs:jsx,jsxDEV:jsx,Fragment:React.Fragment};
var id=res(from,spec);if(id==null)throw new Error('Failed to resolve import "'+spec+'" from "'+from+'"');
if(C[id]!=null){if(!cache[id]){cache[id]=1;var s=document.createElement('style');s.setAttribute('data-vite-dev-id','/'+id);s.textContent=C[id];document.head.appendChild(s)}return {}}
if(cache[id])return cache[id].exports;var m={exports:{}};cache[id]=m;
(new Function('require','module','exports','React',M[id]+'\\n//# sourceURL=http://localhost:5173/'+id))(function(s){return req(id,s)},m,m.exports,React);return m.exports}
window.__RL_ready=false;try{req('','/src/main.jsx')}catch(e){console.error(e)}setTimeout(function(){window.__RL_ready=true},0);})();
</script></body></html>`;
  };

  /* ---------- 채점 ---------- */
  function helpers(w) {
    const d = w.document;
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const desc = x => typeof x === 'string' ? x : x && x.text != null ? `"${x.text}" ${x.sel || 'button'}` : String(x);
    const find = x => {
      if (!x) return null; if (typeof x === 'string') return d.querySelector(x); if (x.nodeType) return x;
      if (x.text != null) { const all = [...d.querySelectorAll(x.sel || 'button')]; return all.find(e => e.textContent.trim() === x.text) || all.find(e => e.textContent.includes(x.text)) || null; }
      return null;
    };
    const t = {
      $: s => d.querySelector(s), $$: s => [...d.querySelectorAll(s)], find,
      text: x => { const el = find(x); return el ? el.textContent.trim() : ''; },
      value: x => { const el = find(x); return el ? el.value : ''; },
      wait,
      async click(x) { const el = find(x); if (!el) throw new Error(`클릭할 요소를 찾지 못했어요: ${desc(x)}`); el.click(); await wait(25); },
      async type(x, v) {
        const el = find(x); if (!el) throw new Error(`입력할 칸을 찾지 못했어요: ${desc(x)}`);
        const proto = el.tagName === 'TEXTAREA' ? w.HTMLTextAreaElement.prototype : el.tagName === 'SELECT' ? w.HTMLSelectElement.prototype : w.HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, String(v));
        el.dispatchEvent(new w.Event('input', { bubbles: true })); el.dispatchEvent(new w.Event('change', { bubbles: true })); await wait(25);
      },
      async key(x, k) { const el = find(x); if (!el) throw new Error(`요소를 찾지 못했어요: ${desc(x)}`); for (const type of ['keydown', 'keypress', 'keyup']) el.dispatchEvent(new w.KeyboardEvent(type, { key: k, code: k, keyCode: k === 'Enter' ? 13 : 0, which: k === 'Enter' ? 13 : 0, bubbles: true })); await wait(25); },
      expect(c, m) { if (!c) throw new Error(m || '조건이 맞지 않아요'); },
      num: s => { const v = parseFloat(String(s).replace(/,/g, '').replace(/[^0-9.\-]/g, '')); return v; },
      active: () => d.activeElement,
    };
    return t;
  }
  let gradeFrame = null;
  function frame() {
    if (gradeFrame && document.body.contains(gradeFrame)) return gradeFrame;
    gradeFrame = document.createElement('iframe'); gradeFrame.setAttribute('aria-hidden', 'true'); gradeFrame.tabIndex = -1;
    gradeFrame.style.cssText = 'position:fixed;left:-3000px;top:0;width:1100px;height:800px;border:0;visibility:hidden';
    document.body.appendChild(gradeFrame); return gradeFrame;
  }
  function loadInto(f, html) {
    return new Promise(res => {
      let done = false; const fin = () => { if (!done) { done = true; res(); } };
      f.onload = () => { const w = f.contentWindow; const t0 = Date.now(); (function poll() { if ((w && w.__RL_ready) || Date.now() - t0 > 4000) setTimeout(fin, 60); else setTimeout(poll, 30); })(); };
      f.srcdoc = html; setTimeout(fin, 9000);
    });
  }
  // problem: {tests:[{name,points,body}]}, files: saved files. onStep(i, result)
  L.grade = async function (problem, files, onStep) {
    await L.babel();
    const c = L.compile(files);
    const results = [];
    if (!c.ok) {
      const er = c.errors[0];
      for (let i = 0; i < problem.tests.length; i++) { const r = { pass: false, msg: `컴파일 오류 — ${er.file}:${er.line} ${er.msg}` }; results.push(r); onStep && onStep(i, r); }
      return results;
    }
    const html = L.appDoc(c, 'grade'); const f = frame();
    for (let i = 0; i < problem.tests.length; i++) {
      const test = problem.tests[i];
      onStep && onStep(i, { running: true });
      await loadInto(f, html);
      const w = f.contentWindow; let r;
      try {
        const fn = new Function('t', 'return (async () => {\n' + test.body + '\n})()');
        await Promise.race([fn(helpers(w)), new Promise((_, rej) => setTimeout(() => rej(new Error('시간 초과 (4초 안에 끝나지 않았어요)')), 4000))]);
        r = { pass: true };
      } catch (e) { r = { pass: false, msg: String(e && e.message || e) }; }
      results.push(r); onStep && onStep(i, r);
    }
    f.srcdoc = '<!doctype html><title>idle</title>';
    return results;
  };
})();
