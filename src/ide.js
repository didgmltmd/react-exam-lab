/* ide.js — VS Code 모양 실기 화면 */
(function () {
  'use strict';
  const L = window.RL; const esc = L.esc, I = L.icon;
  const IDE = L.ide = {};
  let root, monaco = null, editor = null, monacoP = null;
  let P = null;              // 현재 프로젝트
  let ctx = null;            // {mode:'practice'|'mock', problems:[ids], endAt, onEnd}
  const models = {};         // path -> monaco model (프로젝트별로 새로 만듦)
  const viewStates = {};
  let view = 'explorer', sideOn = true, panelOn = true, panelTab = 'terminal', g2On = true;
  let dev = { running: false, port: 5173, started: 0 };
  let consoleLines = [], consoleErr = 0, problems = [];
  let gradeState = { running: false, results: null };
  let focusArea = 'editor';

  /* ---------- 파일 아이콘 (Seti) ---------- */
  const ATOM = '<svg viewBox="0 0 32 32" width="14" height="14" aria-hidden="true"><g fill="none" stroke="#519aba" stroke-width="2"><ellipse cx="16" cy="16" rx="14" ry="5.5"/><ellipse cx="16" cy="16" rx="14" ry="5.5" transform="rotate(60 16 16)"/><ellipse cx="16" cy="16" rx="14" ry="5.5" transform="rotate(120 16 16)"/></g><circle cx="16" cy="16" r="2.6" fill="#519aba"/></svg>';
  function fileIcon(p) {
    const n = p.split('/').pop();
    if (/\.jsx$/.test(n)) return `<span class="fi">${ATOM}</span>`;
    if (/\.js$/.test(n)) return '<span class="fi" style="color:#cbcb41">JS</span>';
    if (/\.css$/.test(n)) return '<span class="fi" style="color:#519aba;font-size:13px">#</span>';
    if (/\.json$/.test(n)) return '<span class="fi" style="color:#cbcb41">{}</span>';
    if (/\.md$/.test(n)) return '<span class="fi" style="color:#519aba;font-size:11px">ⓘ</span>';
    if (/\.html$/.test(n)) return '<span class="fi" style="color:#e37933">&lt;&gt;</span>';
    if (/\.svg$/.test(n)) return '<span class="fi" style="color:#a074c4;font-size:11px">◈</span>';
    if (n === '.gitignore') return '<span class="fi" style="color:#41535b;font-size:12px">◆</span>';
    return '<span class="fi" style="color:#6d8086">≡</span>';
  }
  const langOf = p => /\.jsx?$/.test(p) ? 'javascript' : /\.css$/.test(p) ? 'css' : /\.json$/.test(p) ? 'json' : /\.md$/.test(p) ? 'markdown' : /\.html$/.test(p) ? 'html' : /\.svg$/.test(p) ? 'xml' : 'plaintext';
  const langLabel = p => /\.jsx$/.test(p) ? 'JavaScript JSX' : /\.js$/.test(p) ? 'JavaScript' : /\.css$/.test(p) ? 'CSS' : /\.json$/.test(p) ? 'JSON' : /\.md$/.test(p) ? 'Markdown' : /\.html$/.test(p) ? 'HTML' : /\.svg$/.test(p) ? 'XML' : 'Plain Text';
  const problemById = id => (L.DATA.practical || []).find(x => x.id === id);

  /* ---------- 프로젝트 ---------- */
  function projName(pr) { const i = (L.DATA.practical || []).indexOf(pr); return 'problem' + (i + 1); }
  function loadProject(pid) {
    const pr = problemById(pid); const name = projName(pr);
    const base = Object.assign({}, L.scaffold(name), pr.files);
    const saved = L.store.get('files2.' + pid, null);
    const files = Object.assign({}, base, saved || {});
    if (saved) Object.keys(saved).forEach(k => { if (saved[k] === null) delete files[k]; });
    files['문제.md'] = pr.desc;
    return { pid, pr, name, files, open: [], active: null, dirty: new Set(), expanded: { src: true, 'src/components': true }, sel: null };
  }
  function persist() {
    if (!P) return; const out = {};
    Object.keys(P.files).forEach(k => { if (k.startsWith('src/')) out[k] = P.files[k]; });
    const base = P.pr.files; Object.keys(base).forEach(k => { if (k.startsWith('src/') && !(k in P.files)) out[k] = null; });
    L.store.set('files2.' + P.pid, out);
  }
  IDE.resetProject = function () {
    if (!P) return; L.store.del('files2.' + P.pid); const pid = P.pid; P = null; disposeModels(); openProject(pid);
    notify('처음 코드로 되돌렸어요.');
  };

  /* ---------- 화면 뼈대 ---------- */
  const VSLOGO = '<svg width="16" height="16" viewBox="0 0 100 100" aria-hidden="true"><path fill="#0065A9" d="M96.46 10.8 75.86.87a6.23 6.23 0 0 0-7.1 1.2L29.35 38.04 12.19 25.01a4.16 4.16 0 0 0-5.32.24l-5.5 5a4.17 4.17 0 0 0 0 6.16L16.25 50 1.37 63.58a4.17 4.17 0 0 0 0 6.16l5.5 5a4.16 4.16 0 0 0 5.32.24l17.16-13.03 39.41 35.96a6.22 6.22 0 0 0 7.1 1.2l20.6-9.91A6.25 6.25 0 0 0 100 83.6V16.42a6.25 6.25 0 0 0-3.54-5.63ZM75.01 72.7 45.11 50l29.9-22.7Z"/></svg>';
  function build() {
    root = document.getElementById('ide');
    root.innerHTML = `
<div class="titlebar">
  <div class="tb-left"><span class="tb-logo">${VSLOGO}</span><div class="tb-menu">${['File', 'Edit', 'Selection', 'View', 'Go', 'Run', 'Terminal', 'Help'].map(m => `<span data-menu="${m}">${m}</span>`).join('')}</div></div>
  <div class="cmd-center" data-act="quick">${I('search', 14)}<span id="cc-name">problem1</span></div>
  <div class="tb-right"><span class="exam-chip" id="exam-chip" hidden></span>
    <button class="tb-btn" data-act="toggle-side" title="Toggle Primary Side Bar (Ctrl+B)">${I('layout-sidebar-left')}</button>
    <button class="tb-btn" data-act="toggle-panel" title="Toggle Panel (Ctrl+J)">${I('layout-panel')}</button>
    <button class="tb-btn" data-act="toggle-g2" title="Toggle Simple Browser">${I('layout-sidebar-right')}</button>
    <button class="win-btn" data-act="home" title="최소화 — 홈으로">${I('chrome-minimize')}</button><button class="win-btn" title="Maximize">${I('chrome-maximize')}</button><button class="win-btn x" data-act="home" title="닫기 — 홈으로">${I('chrome-close')}</button></div>
</div>
<div class="workbench" id="wb">
  <div class="activitybar"><div class="ab-group">
    <button class="ab-item" data-view="explorer" title="Explorer (Ctrl+Shift+E)">${I('files', 24)}</button>
    <button class="ab-item" data-view="search" title="Search (Ctrl+Shift+F)">${I('search', 24)}</button>
    <button class="ab-item" data-view="scm" title="Source Control (Ctrl+Shift+G)">${I('source-control', 24)}</button>
    <button class="ab-item" data-view="run" title="Run and Debug (Ctrl+Shift+D)">${I('debug-alt', 24)}</button>
    <button class="ab-item" data-view="ext" title="Extensions (Ctrl+Shift+X)">${I('extensions', 24)}</button>
    <button class="ab-item" data-view="test" title="시험 도구 — 문제 · 채점">${I('beaker', 24)}<span class="ab-badge" id="ab-score" hidden></span></button>
  </div><div class="ab-group">
    <button class="ab-item" data-act="home" title="홈 (시험 연습실 첫 화면)">${I('home', 24)}</button>
    <button class="ab-item" title="Accounts">${I('account', 24)}</button>
    <button class="ab-item" title="Manage">${I('settings-gear', 24)}</button>
  </div></div>
  <div class="sidebar" id="sidebar"></div>
  <div class="main" id="main">
    <div class="groups" id="groups">
      <div class="group g1">
        <div class="tabs" id="tabs1"></div>
        <div class="crumbs" id="crumbs"></div>
        <div class="ed-wrap"><div class="ed-host" id="edhost"></div><div class="md-host" id="mdhost" hidden></div>
          <div class="welcome" id="welcome" hidden><div><svg width="220" height="220" viewBox="0 0 100 100"><path fill="#fff" d="M96.46 10.8 75.86.87a6.23 6.23 0 0 0-7.1 1.2L29.35 38.04 12.19 25.01a4.16 4.16 0 0 0-5.32.24l-5.5 5a4.17 4.17 0 0 0 0 6.16L16.25 50 1.37 63.58a4.17 4.17 0 0 0 0 6.16l5.5 5a4.16 4.16 0 0 0 5.32.24l17.16-13.03 39.41 35.96a6.22 6.22 0 0 0 7.1 1.2l20.6-9.91A6.25 6.25 0 0 0 100 83.6V16.42a6.25 6.25 0 0 0-3.54-5.63ZM75.01 72.7 45.11 50l29.9-22.7Z"/></svg>
            <p>Show All Commands <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd><br>Go to File <kbd>Ctrl</kbd>+<kbd>P</kbd><br>Find in Files <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>F</kbd><br>Toggle Terminal <kbd>Ctrl</kbd>+<kbd>\`</kbd></p></div></div>
          <div class="loading" id="edload">Monaco 편집기를 불러오는 중…</div>
        </div>
      </div>
      <div class="sash-v" id="sashv"></div>
      <div class="group g2">
        <div class="tabs"><div class="tab on"><span class="fi" style="color:#4daafc">${I('link-external', 14)}</span><span class="nm">Simple Browser</span><button class="x" data-act="toggle-g2" title="Close">${I('close')}</button></div></div>
        <div class="ed-wrap"><div class="sb-host">
          <div class="sb-bar"><button class="tb-btn" title="Back">${I('arrow-left')}</button><button class="tb-btn" title="Forward">${I('arrow-right')}</button><button class="tb-btn" data-act="reload" title="Reload">${I('refresh')}</button>
            <div class="sb-url" id="sburl">http://localhost:5173/</div><button class="tb-btn" title="Open in browser">${I('link-external')}</button></div>
          <div class="sb-frame" id="sbframe"></div>
        </div></div>
      </div>
    </div>
    <div class="panel" id="panel"><div class="sash-h" id="sashh"></div>
      <div class="p-head"><div class="p-tabs" id="ptabs"></div>
        <div class="p-acts"><span class="p-term-name" id="ptname">${I('terminal')} powershell</span><button class="sb-act" data-act="term-new" title="New Terminal">${I('add')}</button><button class="sb-act" data-act="term-kill" title="Kill Terminal">${I('trash')}</button><button class="sb-act" data-act="toggle-panel" title="Close Panel">${I('close')}</button></div></div>
      <div class="p-body" id="pbody"></div>
    </div>
  </div>
</div>
<div class="statusbar"><div class="g"><span class="si remote" title="Open a Remote Window">${I('remote', 14)}</span><span class="si" data-act="show-problems" id="st-err">${I('error', 14)} 0 ${I('warning', 14)} 0</span><span class="si" id="st-port" hidden></span><span class="si" id="st-exam" hidden></span></div>
  <div class="g"><span class="si" id="st-pos">Ln 1, Col 1</span><span class="si">Spaces: 2</span><span class="si">UTF-8</span><span class="si">CRLF</span><span class="si" id="st-lang">{ } JavaScript JSX</span><span class="si">${I('check', 14)} Prettier</span><span class="si">${I('bell', 14)}</span></div></div>`;
    root.addEventListener('click', onClick);
    root.addEventListener('dblclick', e => { if (e.target.closest('.tab') && e.target.closest('.tab').classList.contains('it')) { const p = e.target.closest('.tab').dataset.path; if (p) { P.preview = null; renderTabs(); } } });
    setupSashes();
    window.addEventListener('keydown', onKey, true);
    term.init();
  }

  /* ---------- 사이드바 ---------- */
  function renderSide() {
    const sb = document.getElementById('sidebar'); if (!sb || !P) return;
    root.querySelectorAll('.ab-item[data-view]').forEach(b => b.classList.toggle('on', sideOn && b.dataset.view === view));
    document.getElementById('wb').classList.toggle('noside', !sideOn);
    if (view === 'explorer') {
      sb.innerHTML = `<div class="sb-title"><span>Explorer</span><span class="acts"><button class="sb-act" title="Views and More Actions...">${I('ellipsis')}</button></span></div>
        <div class="sb-sec" data-act="noop">${I('chevron-down')}<span>${esc(P.name)}</span><span class="acts"><button class="sb-act" data-act="new-file" title="New File...">${I('new-file')}</button><button class="sb-act" data-act="new-folder" title="New Folder...">${I('new-folder')}</button><button class="sb-act" data-act="refresh" title="Refresh Explorer">${I('refresh')}</button><button class="sb-act" data-act="collapse" title="Collapse Folders in Explorer">${I('collapse-all')}</button></span></div>
        <div class="tree" id="tree" tabindex="0">${treeHTML()}</div>
        <div class="sb-sec">${I('chevron-right')}<span>Outline</span></div><div class="sb-sec">${I('chevron-right')}<span>Timeline</span></div>`;
    } else if (view === 'test') sb.innerHTML = testViewHTML();
    else if (view === 'search') {
      sb.innerHTML = `<div class="sb-title"><span>Search</span></div><div style="padding:0 12px 0 20px"><input id="sq" placeholder="Search" style="width:100%;height:26px;background:#313131;border:1px solid #3c3c3c;color:#ccc;border-radius:2px;padding:0 6px;font:13px var(--ui);outline-color:#0078d4"></div><div class="tree" id="sres" style="margin-top:8px"></div>`;
      const q = document.getElementById('sq'); q.focus(); q.addEventListener('input', () => searchFiles(q.value));
    } else if (view === 'scm') sb.innerHTML = `<div class="sb-title"><span>Source Control</span></div><p class="tv-note">The folder currently open doesn't have a git repository. You can initialize a repository which will enable source control features powered by Git.</p><div style="padding:0 20px"><button class="vbtn" style="width:100%">Initialize Repository</button></div>`;
    else if (view === 'run') sb.innerHTML = `<div class="sb-title"><span>Run and Debug</span></div><div style="padding:0 20px"><button class="vbtn" style="width:100%">Run and Debug</button></div><p class="tv-note">이 연습실에서는 터미널에서 <b>npm run dev</b> 로 실행해요.</p>`;
    else if (view === 'ext') sb.innerHTML = `<div class="sb-title"><span>Extensions</span></div><div class="sb-sec">${I('chevron-down')}<span>Installed</span></div>${['Korean Language Pack for Visual Studio Code|Microsoft', 'ES7+ React/Redux/React-Native snippets|dsznajder', 'Prettier - Code formatter|Prettier', 'ESLint|Microsoft'].map(x => { const [a, b] = x.split('|'); return `<div class="prow" style="grid-template-columns:28px 1fr"><span style="width:28px;height:28px;border-radius:4px;background:#2b2b2b;display:grid;place-items:center">${I('extensions')}</span><span><div>${a}</div><div class="lv">${b}</div></span></div>`; }).join('')}`;
  }
  function searchFiles(q) {
    const out = document.getElementById('sres'); if (!q) { out.innerHTML = ''; return; }
    const res = []; Object.keys(P.files).filter(p => p.startsWith('src/')).forEach(p => { const txt = curText(p); txt.split('\n').forEach((l, i) => { if (l.toLowerCase().includes(q.toLowerCase())) res.push([p, i + 1, l.trim()]); }); });
    out.innerHTML = res.slice(0, 200).map(r => `<div class="row" data-open="${esc(r[0])}" data-line="${r[1]}" style="padding-left:20px">${fileIcon(r[0])}<span class="nm">${esc(r[2])}</span><span class="err" style="color:#9d9d9d">${esc(r[0].split('/').pop())}:${r[1]}</span></div>`).join('') || '<div class="empty">No results found.</div>';
  }
  function tree() {
    const t = { dirs: {}, files: [] };
    const add = p => { const parts = p.split('/'); let n = t; for (let i = 0; i < parts.length - 1; i++) { n = n.dirs[parts[i]] || (n.dirs[parts[i]] = { dirs: {}, files: [] }); } n.files.push(parts[parts.length - 1]); };
    Object.keys(P.files).forEach(add);
    t.dirs.node_modules = { dirs: {}, files: [], fake: true };
    return t;
  }
  const cmpName = (a, b) => a.toLowerCase().localeCompare(b.toLowerCase(), 'en');
  function treeHTML() {
    const out = [];
    const walk = (n, prefix, depth) => {
      Object.keys(n.dirs).sort(cmpName).forEach(d => {
        const path = prefix + d; const open = !!P.expanded[path]; const node = n.dirs[d];
        out.push(`<div class="row${P.sel === path ? ' sel' : ''}${d === 'node_modules' ? ' dim' : ''}" data-dir="${esc(path)}" style="padding-left:${depth * 8 + 8}px"><span class="tw">${I(open ? 'chevron-down' : 'chevron-right')}</span><span class="nm">${esc(d)}</span></div>`);
        if (open) {
          if (node.fake) L.NODE_MODULES.forEach(m => out.push(`<div class="row dim" style="padding-left:${(depth + 1) * 8 + 8}px"><span class="tw">${I('chevron-right')}</span><span class="nm">${esc(m)}</span></div>`));
          else walk(node, path + '/', depth + 1);
        }
      });
      n.files.slice().sort(cmpName).forEach(f => {
        const path = prefix + f; const er = problems.filter(x => x.file === path).length;
        out.push(`<div class="row${P.sel === path ? ' sel focus' : ''}" data-open="${esc(path)}" style="padding-left:${depth * 8 + 24}px">${fileIcon(path)}<span class="nm"${er ? ' style="color:#f88070"' : ''}>${esc(f)}</span>${P.dirty.has(path) ? '<span class="dot"></span>' : er ? `<span class="err">${er}</span>` : ''}</div>`);
      });
    };
    walk(tree(), '', 0);
    return out.join('');
  }

  /* ---------- 시험 도구 뷰 ---------- */
  function testViewHTML() {
    const pr = P.pr; const res = gradeState.results; const tests = pr.tests;
    const score = res ? tests.reduce((s, t, i) => s + (res[i] && res[i].pass ? t.points : 0), 0) : null;
    const list = (ctx.problems || []).map(id => {
      const x = problemById(id); const best = L.store.get('best2.' + id, null); const full = best != null && best >= L.maxPoints(x);
      return `<div class="prow${id === P.pid ? ' on' : ''}" data-prob="${id}">${I(full ? 'pass-filled' : 'circle-filled', 14)}<span>${esc(projName(x))} · ${esc(x.title)}<div class="lv">${esc(x.level || '')}</div></span><span class="sc${full ? ' full' : ''}">${best == null ? '' : best + ' / ' + L.maxPoints(x)}</span></div>`;
    }).join('');
    const rows = tests.map((t, i) => {
      const r = res && res[i]; const st = !r ? (gradeState.running ? (gradeState.cur === i ? 'run' : 'none') : 'none') : r.running ? 'run' : r.pass ? 'pass' : 'fail';
      const ic = st === 'pass' ? I('pass-filled', 16) : st === 'fail' ? I('error', 16) : st === 'run' ? I('sync', 16) : '<svg class="ic" width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="5.5" fill="none" stroke="currentColor"/></svg>';
      return `<div class="trow"><span class="st st-${st}">${ic}</span><span class="nm">${esc(t.name)}</span><span class="pt">${t.points}점</span>${r && !r.pass && !r.running && r.msg ? `<span class="msg">${esc(r.msg)}</span>` : ''}</div>`;
    }).join('');
    const mock = ctx.mode === 'mock';
    return `<div class="sb-title"><span>시험 도구</span><span class="acts"><button class="sb-act" data-act="grade" title="채점하기">${I('run-all')}</button></span></div>
      <div class="tv">
        <div class="sb-sec">${I('chevron-down')}<span>${mock ? '모의고사 실기 문제' : '실기 문제'}</span></div>
        <div class="plist">${list}</div>
        <div class="tv-sep"></div>
        <div class="tv-head"><div style="font-weight:600;color:#fff">${esc(projName(pr))} · ${esc(pr.title)}</div>
          <div class="tv-score"><b>${score == null ? '–' : score}</b><span>/ ${L.maxPoints(pr)}점</span></div>
          <div style="display:flex;gap:6px;flex-wrap:wrap"><button class="vbtn" data-act="grade"${gradeState.running ? ' disabled' : ''}>${I('run-all', 14)} 채점하기</button><button class="vbtn sec" data-act="open-desc">문제 보기</button></div>
          ${P.dirty.size ? '<div class="tv-note" style="margin:0;color:#cca700">저장하지 않은 파일이 있어요. 채점은 저장된 코드로 해요 (Ctrl+S).</div>' : ''}
        </div>
        <div class="sb-sec">${I('chevron-down')}<span>요구사항 (테스트)</span></div>
        ${rows}
        <div class="tv-sep"></div>
        <div class="tv-links">${mock ? '<button class="vbtn" data-act="end-mock" style="background:#a1260d">시험 종료하고 결과 보기</button>' : `<button class="lnk" data-act="reset-proj">처음 코드로 되돌리기</button><button class="lnk" data-act="show-sol">정답 코드 보기</button><button class="lnk" data-act="home">← 홈으로</button>`}</div>
        <p class="tv-note">채점은 앱을 새로 띄운 뒤 버튼 클릭·입력을 대신 해 보고 결과를 확인해요. 실제 시험처럼 터미널에서 <b>npm run dev</b> 로 직접 실행해 확인하는 습관을 들이세요.</p>
      </div>`;
  }

  /* ---------- 탭 · 편집기 ---------- */
  function curText(p) { return models[p] ? models[p].getValue() : (P.files[p] || ''); }
  function getModel(p) {
    if (models[p]) return models[p];
    const uri = monaco.Uri.parse('file:///C:/Users/user/Desktop/' + P.name + '/' + p);
    const m = monaco.editor.getModel(uri) || monaco.editor.createModel(P.files[p] || '', langOf(p), uri);
    m.setValue(P.files[p] || ''); m.updateOptions({ tabSize: 2, insertSpaces: true });
    m.onDidChangeContent(() => { const d = m.getValue() !== P.files[p]; const was = P.dirty.has(p); if (d) P.dirty.add(p); else P.dirty.delete(p); if (was !== d) { renderTabs(); refreshTree(); if (view === 'test') renderSide(); } if (P.preview === p) { P.preview = null; renderTabs(); } scheduleLint(p); scheduleJsx(m); });
    models[p] = m; return m;
  }
  function disposeModels() { Object.keys(models).forEach(k => { try { models[k].dispose(); } catch (e) { } delete models[k]; }); }
  function openFile(p, opts) {
    opts = opts || {};
    if (p === '문제.md' || opts.md) { if (!P.open.includes(p)) P.open.push(p); P.active = p; P.sel = p; renderTabs(); showActive(); refreshTree(); return; }
    if (!P.open.includes(p)) {
      if (!opts.pin && P.preview && P.preview !== p && !P.dirty.has(P.preview)) { const i = P.open.indexOf(P.preview); if (i >= 0) P.open.splice(i, 1, p); else P.open.push(p); }
      else P.open.push(p);
      if (!opts.pin) P.preview = p;
    } else if (opts.pin && P.preview === p) P.preview = null;
    P.active = p; P.sel = p; renderTabs(); showActive(); refreshTree();
    if (opts.line && editor) { editor.revealLineInCenter(opts.line); editor.setPosition({ lineNumber: opts.line, column: 1 }); }
    if (editor && !opts.nofocus) setTimeout(() => editor.focus(), 0);
  }
  async function closeTab(p) {
    if (P.dirty.has(p)) {
      const r = await L.dialog({ title: `Do you want to save the changes you made to ${p.split('/').pop()}?`, msg: "Your changes will be lost if you don't save them.", buttons: [{ k: 'save', label: 'Save', pri: true }, { k: 'drop', label: "Don't Save" }, { k: 'cancel', label: 'Cancel' }] });
      if (r.k === 'cancel') return; if (r.k === 'save') save(p);
    }
    const i = P.open.indexOf(p); if (i < 0) return; P.open.splice(i, 1);
    if (P.dirty.has(p)) { P.dirty.delete(p); if (models[p]) models[p].setValue(P.files[p]); }
    if (P.preview === p) P.preview = null;
    if (P.active === p) P.active = P.open[Math.min(i, P.open.length - 1)] || null;
    renderTabs(); showActive(); refreshTree();
  }
  function renderTabs() {
    const t = document.getElementById('tabs1'); if (!t || !P) return;
    t.innerHTML = P.open.map(p => {
      const md = p === '문제.md' || p.startsWith('정답:');
      const er = problems.some(x => x.file === p);
      return `<div class="tab${p === P.active ? ' on' : ''}${P.dirty.has(p) ? ' dirty' : ''}${P.preview === p ? ' it' : ''}" data-tab="${esc(p)}" data-path="${esc(p)}" title="${esc(p)}">${md ? '<span class="fi" style="color:#519aba">' + I('book', 14) + '</span>' : fileIcon(p)}<span class="nm${er ? ' er' : ''}">${esc(md ? (p === '문제.md' ? 'Preview 문제.md' : p) : p.split('/').pop())}</span><button class="x" data-close="${esc(p)}" title="Close (Ctrl+W)">${I('close')}</button></div>`;
    }).join('');
    const on = t.querySelector('.tab.on'); if (on) on.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    const cr = document.getElementById('crumbs');
    if (P.active && !(P.active === '문제.md' || P.active.startsWith('정답:'))) { const parts = P.active.split('/'); cr.innerHTML = parts.map((x, i) => (i === parts.length - 1 ? fileIcon(P.active) : '') + `<span>${esc(x)}</span>`).join(I('chevron-right', 14)); cr.style.display = ''; }
    else { cr.innerHTML = ''; cr.style.display = P.active ? '' : 'none'; }
    document.getElementById('st-lang').textContent = P.active ? (P.active.endsWith('.md') || P.active.startsWith('정답:') ? 'Markdown' : langLabel(P.active)) : '';
  }
  function showActive() {
    const md = document.getElementById('mdhost'), ed = document.getElementById('edhost'), wl = document.getElementById('welcome');
    const a = P.active;
    if (!a) { md.hidden = true; ed.style.visibility = 'hidden'; wl.hidden = false; return; }
    wl.hidden = true;
    if (a === '문제.md' || a.startsWith('정답:')) { md.hidden = false; ed.style.visibility = 'hidden'; md.innerHTML = a === '문제.md' && P.pr.sheet ? L.sheet(P.pr, (L.DATA.practical || []).indexOf(P.pr) + 1) : `<div class="md">${a === '문제.md' ? L.md(P.files['문제.md']) : solutionHTML()}</div>`; return; }
    md.hidden = true; ed.style.visibility = '';
    if (!editor) return;
    const cur = editor.getModel(); if (cur) { const k = Object.keys(models).find(x => models[x] === cur); if (k) viewStates[k] = editor.saveViewState(); }
    const m = getModel(a); editor.setModel(m); if (viewStates[a]) editor.restoreViewState(viewStates[a]);
    editor.updateOptions({ readOnly: !a.startsWith('src/') && !['index.html', 'vite.config.js', 'package.json'].includes(a) ? false : false });
    scheduleJsx(m, 0); scheduleLint(a, 0);
  }
  function solutionHTML() {
    const sol = P.pr.solution || {};
    return `<h1>정답 코드 — ${esc(P.pr.title)}</h1><p>정답은 여러 가지가 있을 수 있어요. 아래는 예시 답안이에요.</p>` + Object.keys(sol).map(f => `<h3>${esc(f)}</h3><pre><code>${esc(sol[f])}</code></pre>`).join('');
  }
  function refreshTree() { if (view === 'explorer') { const t = document.getElementById('tree'); if (t) t.innerHTML = treeHTML(); } }

  /* ---------- 저장 · 실행 ---------- */
  function save(p) {
    p = p || P.active; if (!p || !models[p]) return;
    const txt = models[p].getValue(); const changed = txt !== P.files[p];
    P.files[p] = txt; P.dirty.delete(p); if (P.preview === p) P.preview = null; persist(); renderTabs(); refreshTree(); if (view === 'test') renderSide();
    if (dev.running && p.startsWith('src/')) hmr(p, changed);
  }
  function saveAll() { Object.keys(models).forEach(p => { if (P.dirty.has(p)) save(p); }); }
  function savedSrc() { const o = {}; Object.keys(P.files).forEach(k => { if (k !== '문제.md') o[k] = P.files[k]; }); return o; }
  function timeStr() { const d = new Date(); let h = d.getHours(); const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; return `${h}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')} ${ap}`; }
  function hmr(p, changed) {
    const c = L.compile(savedSrc());
    if (!c.ok) { const e = c.errors[0]; term.print(`<span class="t-d">${timeStr()}</span> <span class="t-c t-b">[vite]</span> <span class="t-r">Internal server error: ${esc('/' + e.file)}: ${esc(e.msg)}</span>\n  Plugin: <span class="t-m">${esc(e.plugin)}</span>\n  File: <span class="t-c">${esc('C:/Users/user/Desktop/' + P.name + '/' + e.file)}:${e.line}:${e.col}</span>\n${esc(e.frame || '')}\n`); }
    else if (changed) term.print(`<span class="t-d">${timeStr()}</span> <span class="t-c t-b">[vite]</span> <span class="t-g">(client)</span> hmr update <span class="t-d">/${esc(p)}</span>\n`);
    refreshPreview(c);
  }
  let lastDoc = '';
  function refreshPreview(c) {
    const host = document.getElementById('sbframe'); if (!host) return;
    if (!dev.running) {
      host.innerHTML = `<div class="sb-off"><svg class="face" viewBox="0 0 24 24" fill="currentColor"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V8h16v10zM8.5 13.5l1.5-1.5-1.5-1.5L10 9l3 3-3 3-1.5-1.5zm4.5 1.5h4v-1.5h-4V15z"/></svg><h1>이 사이트에 연결할 수 없음</h1><p><b>localhost</b>에서 연결을 거부했습니다.</p><code>ERR_CONNECTION_REFUSED</code><div class="hint">개발 서버가 꺼져 있어요. 아래 터미널에 <b>npm run dev</b> 를 입력해 실행하세요.</div></div>`;
      lastDoc = ''; return;
    }
    c = c || L.compile(savedSrc());
    const doc = c.ok ? L.appDoc(c, 'preview') : L.overlayDoc(c.errors[0], P.name);
    let f = host.querySelector('iframe');
    if (!f) { host.innerHTML = ''; f = document.createElement('iframe'); f.title = 'Simple Browser'; host.appendChild(f); }
    if (c.ok) { consoleLines = []; consoleErr = 0; renderPanel(); }
    f.srcdoc = doc; lastDoc = doc;
  }
  L.onConsole = function (level, text, tag) {
    if (tag !== 'preview') return;
    if (/Download the React DevTools/.test(text)) return;
    consoleLines.push({ level, text }); if (level === 'error') consoleErr++;
    if (consoleLines.length > 400) consoleLines.shift();
    if (panelTab === 'console') renderPanel(); else renderPanelTabs();
  };

  /* ---------- 진단 (빨간 밑줄) ---------- */
  const lintT = {};
  function scheduleLint(p, ms) {
    if (!/\.jsx?$/.test(p) || !monaco) return;
    clearTimeout(lintT[p]); lintT[p] = setTimeout(() => lint(p), ms == null ? 450 : ms);
  }
  function lint(p) {
    const m = models[p]; if (!m || !window.Babel) return;
    const marks = [];
    try { window.Babel.transform(m.getValue(), { filename: '/' + p, sourceType: 'module', presets: [['react', { runtime: 'classic' }]], highlightCode: false }); }
    catch (e) { const l = e.loc || { line: 1, column: 0 }; marks.push({ severity: monaco.MarkerSeverity.Error, message: String(e.message || e).split('\n')[0].replace(/^[^:]*: /, ''), startLineNumber: l.line, startColumn: l.column + 1, endLineNumber: l.line, endColumn: l.column + 2 }); }
    // 없는 파일 import
    const files = Object.assign({}, P.files); const src = m.getValue(); const re = /import\s+(?:[^'"]*?from\s+)?['"]([^'"]+)['"]/g; let x;
    while ((x = re.exec(src))) { if (!L.resolve(files, p, x[1])) { const pos = m.getPositionAt(x.index + x[0].indexOf(x[1])); marks.push({ severity: monaco.MarkerSeverity.Error, message: `Cannot find module '${x[1]}'.`, startLineNumber: pos.lineNumber, startColumn: pos.column, endLineNumber: pos.lineNumber, endColumn: pos.column + x[1].length }); } }
    monaco.editor.setModelMarkers(m, 'babel', marks);
    problems = problems.filter(q => q.file !== p).concat(marks.map(k => ({ file: p, line: k.startLineNumber, col: k.startColumn, msg: k.message })));
    const n = problems.length; document.getElementById('st-err').innerHTML = `${I('error', 14)} ${n} ${I('warning', 14)} 0`;
    renderPanelTabs(); if (panelTab === 'problems') renderPanel(); renderTabs(); refreshTree();
  }

  /* ---------- JSX 색 보정 ---------- */
  const jsxT = new WeakMap(); const decos = new WeakMap();
  const CTL = new Set(['import', 'export', 'from', 'return', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue', 'default', 'try', 'catch', 'finally', 'throw', 'await', 'as']);
  const KW = new Set(['const', 'let', 'var', 'function', 'new', 'typeof', 'instanceof', 'in', 'of', 'class', 'extends', 'this', 'true', 'false', 'null', 'undefined', 'async', 'void', 'delete', 'super']);
  function scheduleJsx(m, ms) { if (!monaco || !/javascript/.test(m.getLanguageId())) return; clearTimeout(jsxT.get(m)); jsxT.set(m, setTimeout(() => jsx(m), ms == null ? 120 : ms)); }
  function jsx(m) {
    if (m.isDisposed()) return;
    const ds = []; const n = m.getLineCount();
    const add = (ln, a, b, cls) => ds.push({ range: new monaco.Range(ln, a + 1, ln, b + 1), options: { inlineClassName: cls } });
    let inTag = false, inBlock = false;
    for (let ln = 1; ln <= n; ln++) {
      const s = m.getLineContent(ln); let i = 0;
      while (i < s.length) {
        const ch = s[i];
        if (inBlock) { const e = s.indexOf('*/', i); if (e < 0) { i = s.length; break; } i = e + 2; inBlock = false; continue; }
        if (ch === '/' && s[i + 1] === '/' && !inTag) break;
        if (ch === '/' && s[i + 1] === '*') { inBlock = true; i += 2; continue; }
        if (ch === '"' || ch === "'" || ch === '`') { const q = ch; i++; while (i < s.length && s[i] !== q) { if (s[i] === '\\') i++; i++; } i++; continue; }
        if (inTag) {
          if (ch === '/' && s[i + 1] === '>') { add(ln, i, i + 2, 'jx-br'); i += 2; inTag = false; continue; }
          if (ch === '>') { add(ln, i, i + 1, 'jx-br'); i++; inTag = false; continue; }
          if (ch === '{') { let depth = 1, j = i + 1; while (j < s.length && depth) { if (s[j] === '{') depth++; else if (s[j] === '}') depth--; j++; } i = j; continue; }
          const am = /^[A-Za-z_][\w-]*/.exec(s.slice(i)); if (am) { add(ln, i, i + am[0].length, 'jx-attr'); i += am[0].length; continue; }
          i++; continue;
        }
        if (ch === '<') {
          let k = i - 1; while (k >= 0 && s[k] === ' ') k--;
          const prev = k >= 0 ? s[k] : ''; const before = s.slice(0, i).trimEnd();
          const ok = prev === '' || /[(=>{?:,&|\[]/.test(prev) || /\breturn$/.test(before) || ln > 1 && prev === '';
          const tm = /^<(\/?)([A-Za-z][\w.]*)?/.exec(s.slice(i));
          if (ok && tm && (tm[2] || s[i + 1] === '>' || s[i + 1] === '/')) {
            const tl = 1 + tm[1].length; add(ln, i, i + tl, 'jx-br');
            if (tm[2]) add(ln, i + tl, i + tl + tm[2].length, /^[A-Z]/.test(tm[2]) ? 'jx-comp' : 'jx-tag');
            i += tl + (tm[2] ? tm[2].length : 0); inTag = true;
            if (s[i] === '>') { add(ln, i, i + 1, 'jx-br'); i++; inTag = false; }
            continue;
          }
        }
        const w = /^[A-Za-z_$][\w$]*/.exec(s.slice(i));
        if (w && (i === 0 || !/[\w$.]/.test(s[i - 1]) || s[i - 1] === '.')) {
          const word = w[0]; const after = s.slice(i + word.length);
          if (s[i - 1] !== '.' && CTL.has(word)) add(ln, i, i + word.length, 'jx-ctl');
          else if (/^\s*\(/.test(after) && !KW.has(word) && !CTL.has(word)) add(ln, i, i + word.length, 'jx-fn');
          else if (s[i - 1] !== '.' && /^[A-Z]/.test(word) && !KW.has(word)) add(ln, i, i + word.length, /^[A-Z0-9_]+$/.test(word) && word.length > 1 ? 'jx-const' : 'jx-type');
          i += word.length; continue;
        }
        i++;
      }
    }
    decos.set(m, m.deltaDecorations(decos.get(m) || [], ds));
  }

  /* ---------- 아래 패널 ---------- */
  function renderPanelTabs() {
    const pt = document.getElementById('ptabs'); if (!pt) return;
    const tabs = [['problems', 'Problems', problems.length], ['output', 'Output'], ['console', 'Debug Console', consoleErr], ['terminal', 'Terminal'], ['ports', 'Ports', dev.running ? 1 : 0]];
    pt.innerHTML = tabs.map(t => `<button class="p-tab${panelTab === t[0] ? ' on' : ''}" data-ptab="${t[0]}">${t[1]}${t[2] ? `<span class="p-cnt"${t[0] === 'console' ? ' style="background:#a1260d"' : ''}>${t[2]}</span>` : ''}</button>`).join('');
    document.getElementById('ptname').style.visibility = panelTab === 'terminal' ? '' : 'hidden';
  }
  function renderPanel() {
    renderPanelTabs();
    const b = document.getElementById('pbody'); if (!b) return;
    if (panelTab === 'terminal') { term.mount(b); return; }
    term.unmount();
    if (panelTab === 'problems') b.innerHTML = `<div class="plist2">${problems.length ? problems.map(q => `<div class="prob" data-open="${esc(q.file)}" data-line="${q.line}"><span style="color:#f14c4c">${I('error', 16)}</span><span>${esc(q.msg)} <span class="loc">${esc(q.file.split('/').pop())} [Ln ${q.line}, Col ${q.col}]</span></span></div>`).join('') : '<div class="empty">No problems have been detected in the workspace.</div>'}</div>`;
    else if (panelTab === 'console') { b.innerHTML = `<div class="dc">${consoleLines.length ? consoleLines.map(l => `<div class="l ${l.level}">${esc(l.text)}</div>`).join('') : '<div class="empty">Simple Browser 의 console.log 출력이 여기에 보여요.</div>'}</div>`; const d = b.querySelector('.dc'); d.scrollTop = d.scrollHeight; }
    else if (panelTab === 'output') b.innerHTML = '<div class="dc"><div class="empty">Tasks</div></div>';
    else if (panelTab === 'ports') b.innerHTML = `<div class="dc">${dev.running ? `<div class="l">5173  →  http://localhost:${dev.port}/   (vite)</div>` : '<div class="empty">No forwarded ports. Forward a port to access your running services locally.</div>'}</div>`;
  }

  /* ---------- 터미널 (PowerShell) ---------- */
  const term = {
    el: null, kbd: null, lines: null, input: '', hist: [], hi: 0, busy: false,
    init() {
      this.el = document.createElement('div'); this.el.className = 'term';
      this.lines = document.createElement('div'); this.el.appendChild(this.lines);
      this.cur = document.createElement('div'); this.cur.className = 'ln'; this.el.appendChild(this.cur);
      this.kbd = document.createElement('textarea'); this.kbd.className = 'term-kbd'; this.kbd.setAttribute('aria-label', 'Terminal input'); this.kbd.spellcheck = false; this.el.appendChild(this.kbd);
      this.el.addEventListener('mousedown', e => { if (e.target.closest('.t-link')) return; setTimeout(() => { if (!String(window.getSelection())) this.kbd.focus({ preventScroll: true }); }, 0); });
      this.el.addEventListener('click', e => { const a = e.target.closest('.t-link'); if (a) { if (!g2On) toggleG2(true); refreshPreview(); } });
      this.kbd.addEventListener('focus', () => { this.el.classList.add('focus'); focusArea = 'term'; });
      this.kbd.addEventListener('blur', () => this.el.classList.remove('focus'));
      this.kbd.addEventListener('keydown', e => this.key(e));
      this.kbd.addEventListener('input', () => { if (this.busy && !dev.running) { this.kbd.value = ''; return; } this.input += this.kbd.value.replace(/\n/g, ''); this.kbd.value = ''; this.draw(); });
      this.kbd.addEventListener('paste', e => { e.preventDefault(); const t = (e.clipboardData.getData('text') || '').split('\n')[0]; this.input += t; this.draw(); });
    },
    prompt() { return `PS C:\\Users\\user\\Desktop\\${P ? P.name : ''}> `; },
    mount(b) { if (!this.el) return; if (this.el.parentNode !== b) { b.innerHTML = ''; b.appendChild(this.el); } this.draw(); },
    unmount() { if (this.el && this.el.parentNode) this.el.parentNode.removeChild(this.el); },
    focus() { if (this.kbd) this.kbd.focus({ preventScroll: true }); },
    reset() { this.lines.innerHTML = ''; this.input = ''; this.busy = false; this.print('<span class="t-ps">Windows PowerShell\nCopyright (C) Microsoft Corporation. All rights reserved.\n\n새로운 기능 및 개선 사항에 대 한 최신 PowerShell을 설치 하세요! https://aka.ms/PSWindows\n\n</span>'); this.draw(); },
    print(html) { const d = document.createElement('span'); d.innerHTML = html; this.lines.appendChild(d); this.scroll(); },
    scroll() { requestAnimationFrame(() => { this.el.scrollTop = this.el.scrollHeight; }); },
    draw() { if (!this.cur) return; const pre = this.busy ? '' : esc(this.prompt()); this.cur.innerHTML = `${pre}<span class="in">${esc(this.input)}</span><span class="cur"> </span>`; this.scroll(); },
    key(e) {
      if (e.ctrlKey && (e.key === 'c' || e.key === 'C') && !e.shiftKey) {
        e.preventDefault(); const sel = String(window.getSelection()); if (sel) { navigator.clipboard && navigator.clipboard.writeText(sel).catch(() => { }); return; }
        if (dev.running) { stopDev(); return; }
        this.print(esc(this.prompt() + this.input) + '\n'); this.input = ''; this.draw(); return;
      }
      if (e.ctrlKey && (e.key === 'v' || e.key === 'V')) return;
      if (e.ctrlKey && (e.key === 'l' || e.key === 'L')) { e.preventDefault(); this.lines.innerHTML = ''; this.draw(); return; }
      if (e.key === 'Enter') { e.preventDefault(); const cmd = this.input; this.input = ''; this.run(cmd); return; }
      if (e.key === 'Backspace') { e.preventDefault(); this.input = this.input.slice(0, -1); this.draw(); return; }
      if (e.key === 'ArrowUp' && !dev.running) { e.preventDefault(); if (this.hi > 0) { this.hi--; this.input = this.hist[this.hi] || ''; this.draw(); } return; }
      if (e.key === 'ArrowDown' && !dev.running) { e.preventDefault(); if (this.hi < this.hist.length) { this.hi++; this.input = this.hist[this.hi] || ''; this.draw(); } return; }
      if (e.key === 'Tab') { e.preventDefault(); return; }
    },
    run(cmd) {
      if (dev.running) {
        const c = cmd.trim();
        this.print(esc(cmd) + '\n');
        if (c === 'h') this.print('\n  <span class="t-b">Shortcuts</span>\n  <span class="t-d">press</span> <span class="t-b">r + enter</span> <span class="t-d">to restart the server</span>\n  <span class="t-d">press</span> <span class="t-b">u + enter</span> <span class="t-d">to show server url</span>\n  <span class="t-d">press</span> <span class="t-b">o + enter</span> <span class="t-d">to open in browser</span>\n  <span class="t-d">press</span> <span class="t-b">c + enter</span> <span class="t-d">to clear console</span>\n  <span class="t-d">press</span> <span class="t-b">q + enter</span> <span class="t-d">to quit</span>\n');
        else if (c === 'q') stopDev(true);
        else if (c === 'c') { this.lines.innerHTML = ''; }
        else if (c === 'o') { if (!g2On) toggleG2(true); refreshPreview(); }
        else if (c === 'u') this.print(urlLines());
        else if (c === 'r') { this.print(`<span class="t-d">${timeStr()}</span> <span class="t-c t-b">[vite]</span> <span class="t-g">server restarted.</span>\n`); refreshPreview(); }
        this.draw(); return;
      }
      this.print(esc(this.prompt()) + esc(cmd) + '\n');
      const c = cmd.trim(); if (c) { this.hist.push(c); } this.hi = this.hist.length;
      const a = c.split(/\s+/);
      if (!c) { }
      else if (/^npm(\.cmd)?$/.test(a[0])) this.npm(a.slice(1));
      else if (a[0] === 'node' && (a[1] === '-v' || a[1] === '--version')) this.print('v22.18.0\n');
      else if (a[0] === 'node' && !a[1]) this.print('Welcome to Node.js v22.18.0.\nType ".help" for more information.\n<span class="t-d">(이 연습실에서는 node 대화형 모드를 지원하지 않아요)</span>\n');
      else if (a[0] === 'cls' || a[0] === 'clear') this.lines.innerHTML = '';
      else if (a[0] === 'ls' || a[0] === 'dir') this.print(this.dir());
      else if (a[0] === 'cd') { if (a[1] && !['.', './'].includes(a[1])) this.print(`<span class="t-r">cd : '${esc('C:\\Users\\user\\Desktop\\' + P.name + '\\' + a[1])}' 경로는 존재하지 않으므로 찾을 수 없습니다.</span>\n`); }
      else if (a[0] === 'pwd') this.print(`\nPath\n----\nC:\\Users\\user\\Desktop\\${esc(P.name)}\n\n`);
      else if (a[0] === 'code') { }
      else if (a[0] === 'npx' && /vite/.test(c)) this.npm(['run', 'dev']);
      else this.print(`<span class="t-r">${esc(a[0])} : '${esc(a[0])}' 용어가 cmdlet, 함수, 스크립트 파일 또는 실행할 수 있는 프로그램 이름으로 인식되지 않습니다. 이름이 정확한지 확인하고 경로가 포함된 경우 경로가 올바른지 검증한 다음 다시 시도하십시오.\n위치 줄:1 문자:1\n+ ${esc(cmd)}\n+ ${'~'.repeat(Math.max(1, a[0].length))}\n    + CategoryInfo          : ObjectNotFound: (${esc(a[0])}:String) [], CommandNotFoundException\n    + FullyQualifiedErrorId : CommandNotFoundException\n</span>\n`);
      this.draw();
    },
    dir() {
      const t = new Date(Date.now() - 86400000 * 2); const ds = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}   오후 3:12`;
      const items = [['d----', 'node_modules'], ['d----', 'public'], ['d----', 'src'], ['-a---', '.gitignore', 253], ['-a---', 'eslint.config.js', 758], ['-a---', 'index.html', 361], ['-a---', 'package-lock.json', 98213], ['-a---', 'package.json', 641], ['-a---', 'README.md', 1121], ['-a---', 'vite.config.js', 161]];
      return `\n\n    디렉터리: C:\\Users\\user\\Desktop\\${esc(P.name)}\n\n\nMode                 LastWriteTime         Length Name\n----                 -------------         ------ ----\n` + items.map(x => `${x[0]}        ${ds}${String(x[2] || '').padStart(15)} ${x[1]}`).join('\n') + '\n\n';
    },
    npm(a) {
      const sub = a[0];
      if (!sub) { this.print('npm &lt;command&gt;\n\nUsage:\n\nnpm install        install all the dependencies in your project\nnpm run &lt;foo&gt;      run the script named &lt;foo&gt;\n\nnpm@10.9.3 C:\\Program Files\\nodejs\\node_modules\\npm\n'); return; }
      if (sub === '-v' || sub === '--version') { this.print('10.9.3\n'); return; }
      if (sub === 'install' || sub === 'i' || sub === 'ci') {
        this.busy = true; this.draw();
        setTimeout(() => { this.print('\nup to date, audited 152 packages in 2s\n\n33 packages are looking for funding\n  run `npm fund` for details\n\nfound <span class="t-g t-b">0</span> vulnerabilities\n'); this.busy = false; this.draw(); }, 1300);
        return;
      }
      if (sub === 'run' && a[1] === 'dev' || sub === 'start' && false) { startDev(); return; }
      if (sub === 'run' && !a[1]) { this.print(`Lifecycle scripts included in ${esc(P.name)}@0.0.0:\n  dev\n    vite\n\navailable via \`npm run-script\`:\n  build\n    vite build\n  lint\n    eslint .\n  preview\n    vite preview\n\n`); return; }
      if (sub === 'run' && (a[1] === 'build' || a[1] === 'lint' || a[1] === 'preview')) { this.print(`\n&gt; ${esc(P.name)}@0.0.0 ${esc(a[1])}\n&gt; ${a[1] === 'build' ? 'vite build' : a[1] === 'lint' ? 'eslint .' : 'vite preview'}\n\n<span class="t-d">(이 연습실에서는 npm run dev 만 실행할 수 있어요)</span>\n`); return; }
      if (sub === 'start') { this.print('<span class="t-r">npm error</span> Missing script: "start"\n<span class="t-r">npm error</span>\n<span class="t-r">npm error</span> Did you mean one of these?\n<span class="t-r">npm error</span>   npm star # Mark your favorite packages\n<span class="t-r">npm error</span>   npm stars # View packages marked as favorites\n<span class="t-r">npm error</span>\n<span class="t-r">npm error</span> To see a list of scripts, run:\n<span class="t-r">npm error</span>   npm run\n'); return; }
      if (sub === 'run') { this.print(`<span class="t-r">npm error</span> Missing script: "${esc(a[1])}"\n<span class="t-r">npm error</span>\n<span class="t-r">npm error</span> To see a list of scripts, run:\n<span class="t-r">npm error</span>   npm run\n`); return; }
      this.print(`<span class="t-r">npm error</span> (이 연습실에서는 npm install, npm run dev 만 쓸 수 있어요)\n`);
    },
  };
  function urlLines() { return `  <span class="t-g">➜</span>  <span class="t-b">Local</span>:   <span class="t-c t-link">http://localhost:<span class="t-b">${dev.port}</span>/</span>\n  <span class="t-g">➜</span>  <span class="t-d">Network: use </span><span class="t-b">--host</span><span class="t-d"> to expose</span>\n`; }
  function startDev() {
    term.busy = true; term.draw();
    term.print(`\n&gt; ${esc(P.name)}@0.0.0 dev\n&gt; vite\n\n`);
    setTimeout(() => {
      dev.running = true; dev.started = Date.now();
      term.print(`\n  <span class="t-g t-b">VITE</span> <span class="t-g">v7.1.7</span>  <span class="t-d">ready in</span> <span class="t-b">${280 + Math.floor(Math.random() * 300)}</span> <span class="t-d">ms</span>\n\n${urlLines()}  <span class="t-g">➜</span>  <span class="t-d">press </span><span class="t-b">h + enter</span><span class="t-d"> to show help</span>\n`);
      term.draw(); refreshPreview(); renderPanelTabs(); stPort();
    }, 650);
  }
  function stopDev(quiet) {
    dev.running = false; term.busy = false;
    if (!quiet) term.print('^C');
    term.print('\n'); term.draw(); refreshPreview(); renderPanelTabs(); stPort();
  }
  function stPort() { const s = document.getElementById('st-port'); s.hidden = !dev.running; s.innerHTML = `${I('remote', 14)} 5173`; }

  /* ---------- 레이아웃 조절 ---------- */
  function setupSashes() {
    const sv = document.getElementById('sashv'), sh = document.getElementById('sashh'), groups = document.getElementById('groups'), main = document.getElementById('main');
    drag(sv, (x0, y0, ev) => { const r = groups.getBoundingClientRect(); const w = Math.min(Math.max(r.right - ev.clientX, 240), r.width - 240); groups.style.setProperty('--g2-w', w + 'px'); });
    drag(sh, (x0, y0, ev) => { const r = main.getBoundingClientRect(); const h = Math.min(Math.max(r.bottom - ev.clientY, 80), r.height - 120); main.style.setProperty('--panel-h', h + 'px'); });
    function drag(el, fn) {
      el.addEventListener('mousedown', e => {
        e.preventDefault(); el.classList.add('drag'); const ifr = root.querySelectorAll('iframe'); ifr.forEach(f => f.style.pointerEvents = 'none');
        const mv = ev => fn(e.clientX, e.clientY, ev); const up = () => { el.classList.remove('drag'); ifr.forEach(f => f.style.pointerEvents = ''); window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up); if (editor) editor.layout(); };
        window.addEventListener('mousemove', mv); window.addEventListener('mouseup', up);
      });
    }
  }
  function toggleG2(on) { g2On = on == null ? !g2On : on; document.getElementById('groups').classList.toggle('one', !g2On); if (g2On) refreshPreview(); }
  function togglePanel(on) { panelOn = on == null ? !panelOn : on; document.getElementById('main').classList.toggle('nopanel', !panelOn); if (panelOn) renderPanel(); }

  /* ---------- 이벤트 ---------- */
  function onClick(e) {
    const t = e.target;
    const close = t.closest('[data-close]'); if (close) { e.stopPropagation(); closeTab(close.dataset.close); return; }
    const tab = t.closest('[data-tab]'); if (tab) { P.active = tab.dataset.tab; P.sel = P.active; renderTabs(); showActive(); refreshTree(); if (editor && !P.active.endsWith('.md')) editor.focus(); return; }
    const op = t.closest('[data-open]'); if (op) { const p = op.dataset.open; openFile(p, { line: op.dataset.line ? +op.dataset.line : 0, pin: !!op.dataset.line }); return; }
    const dir = t.closest('[data-dir]'); if (dir) { const d = dir.dataset.dir; P.expanded[d] = !P.expanded[d]; P.sel = d; refreshTree(); return; }
    const vw = t.closest('[data-view]'); if (vw) { if (view === vw.dataset.view && sideOn) sideOn = false; else { view = vw.dataset.view; sideOn = true; } renderSide(); if (editor) setTimeout(() => editor.layout(), 0); return; }
    const pt = t.closest('[data-ptab]'); if (pt) { panelTab = pt.dataset.ptab; if (panelTab === 'console') consoleErr = 0; renderPanel(); if (panelTab === 'terminal') term.focus(); return; }
    const pb = t.closest('[data-prob]'); if (pb) { switchProblem(pb.dataset.prob); return; }
    const a = t.closest('[data-act]'); if (!a) return;
    const act = a.dataset.act;
    if (act === 'home') { leave(); }
    else if (act === 'toggle-side') { sideOn = !sideOn; renderSide(); }
    else if (act === 'toggle-panel') togglePanel();
    else if (act === 'toggle-g2') toggleG2();
    else if (act === 'reload') refreshPreview();
    else if (act === 'grade') runGrade();
    else if (act === 'open-desc') openFile('문제.md');
    else if (act === 'reset-proj') { L.ask('처음 코드로 되돌릴까요?', '이 문제에서 지금까지 쓴 코드는 사라져요.', '되돌리기').then(y => { if (y) IDE.resetProject(); }); }
    else if (act === 'show-sol') { L.ask('정답 코드를 볼까요?', '먼저 스스로 풀어 보는 걸 추천해요.', '정답 보기').then(y => { if (!y) return; const k = '정답: ' + P.pr.title; if (!P.open.includes(k)) P.open.push(k); P.active = k; renderTabs(); showActive(); }); }
    else if (act === 'end-mock') { L.ask('시험을 끝낼까요?', '저장된 코드로 실기를 채점하고 결과를 보여 줘요.', '시험 종료').then(y => { if (y) endMock(); }); }
    else if (act === 'show-problems') { togglePanel(true); panelTab = 'problems'; renderPanel(); }
    else if (act === 'term-new' || act === 'term-kill') { if (dev.running) stopDev(true); term.reset(); togglePanel(true); panelTab = 'terminal'; renderPanel(); term.focus(); }
    else if (act === 'collapse') { P.expanded = {}; refreshTree(); }
    else if (act === 'new-file' || act === 'new-folder') newFile(act === 'new-folder');
    else if (act === 'refresh') refreshTree();
    else if (act === 'quick') quickOpen();
  }
  async function newFile(folder) {
    const base = P.sel && !/\.\w+$/.test(P.sel) ? P.sel : (P.sel ? P.sel.split('/').slice(0, -1).join('/') : 'src');
    const r = await L.dialog({ title: folder ? 'New Folder' : 'New File', msg: `${base || P.name} 안에 만들어요.`, input: folder ? '' : 'NewComponent.jsx', ok: '만들기' });
    const name = r.k === 'ok' ? (r.value || '').trim() : ''; if (!name) return;
    const path = (base ? base + '/' : '') + name.replace(/^\/+/, '');
    if (folder) { P.files[path + '/.keep'] = ''; P.expanded[path] = true; persist(); refreshTree(); return; }
    if (P.files[path] != null) { notify('같은 이름의 파일이 이미 있어요.', true); return; }
    P.files[path] = ''; persist(); P.expanded[base] = true; openFile(path, { pin: true });
  }
  function onKey(e) {
    if (root.hidden) return;
    const k = e.key, c = e.ctrlKey || e.metaKey;
    if (c && (k === 's' || k === 'S')) { e.preventDefault(); if (e.shiftKey || e.altKey) saveAll(); else save(); return; }
    if (c && k === '`') { e.preventDefault(); if (panelOn && focusArea === 'term') { togglePanel(false); editor && editor.focus(); } else { togglePanel(true); panelTab = 'terminal'; renderPanel(); term.focus(); } return; }
    if (c && (k === 'j' || k === 'J') && !e.shiftKey) { e.preventDefault(); togglePanel(); return; }
    if (c && (k === 'b' || k === 'B') && !e.shiftKey) { e.preventDefault(); sideOn = !sideOn; renderSide(); return; }
    if (c && (k === 'p' || k === 'P') && !e.shiftKey) { e.preventDefault(); quickOpen(); return; }
    if (c && e.shiftKey && (k === 'E' || k === 'e')) { e.preventDefault(); view = 'explorer'; sideOn = true; renderSide(); return; }
    if (c && e.shiftKey && (k === 'F' || k === 'f')) { e.preventDefault(); view = 'search'; sideOn = true; renderSide(); return; }
    if (c && (k === 'w' || k === 'W') && !e.shiftKey) { e.preventDefault(); if (P.active) closeTab(P.active); return; }
    if (k === 'Escape' && document.querySelector('.quick')) { document.querySelector('.quick').remove(); editor && editor.focus(); }
  }
  function quickOpen() {
    const old = document.querySelector('.quick'); if (old) old.remove();
    const q = document.createElement('div'); q.className = 'quick';
    q.innerHTML = '<input placeholder="Search files by name (append : to go to line or @ to go to symbol)"><div class="items"></div>';
    document.body.appendChild(q); const inp = q.querySelector('input'); const box = q.querySelector('.items'); let sel = 0, items = [];
    const draw = () => { const v = inp.value.toLowerCase(); items = Object.keys(P.files).filter(p => !p.endsWith('.keep') && p.toLowerCase().includes(v)).slice(0, 30); sel = Math.min(sel, items.length - 1); box.innerHTML = items.map((p, i) => `<div class="it${i === sel ? ' on' : ''}" data-i="${i}">${fileIcon(p)}<span>${esc(p.split('/').pop())}</span><span class="pth">${esc(p.split('/').slice(0, -1).join('/'))}</span></div>`).join(''); };
    draw(); inp.focus();
    inp.addEventListener('input', () => { sel = 0; draw(); });
    inp.addEventListener('keydown', e => { if (e.key === 'ArrowDown') { sel = Math.min(sel + 1, items.length - 1); draw(); e.preventDefault(); } else if (e.key === 'ArrowUp') { sel = Math.max(sel - 1, 0); draw(); e.preventDefault(); } else if (e.key === 'Enter') { if (items[sel]) { q.remove(); openFile(items[sel], { pin: true }); } } else if (e.key === 'Escape') { q.remove(); } });
    box.addEventListener('mousedown', e => { const it = e.target.closest('.it'); if (it) { e.preventDefault(); q.remove(); openFile(items[+it.dataset.i], { pin: true }); } });
    inp.addEventListener('blur', () => setTimeout(() => q.remove(), 120));
  }
  let notifT = null;
  function notify(msg, err) {
    const old = document.querySelector('.notif'); if (old) old.remove();
    const n = document.createElement('div'); n.className = 'notif' + (err ? ' err' : ''); n.innerHTML = `${I(err ? 'error' : 'info')}<div class="txt">${msg}</div><button class="sb-act" title="Clear">${I('close')}</button>`;
    n.querySelector('button').onclick = () => n.remove(); document.body.appendChild(n); clearTimeout(notifT); notifT = setTimeout(() => n.remove(), 4500);
  }
  IDE.notify = notify;

  /* ---------- 채점 ---------- */
  async function runGrade() {
    if (gradeState.running) return;
    if (P.dirty.size) notify('저장하지 않은 파일이 있어요. 채점은 <b>저장된 코드</b>로 해요. (Ctrl+S 로 저장)');
    view = 'test'; sideOn = true;
    gradeState = { running: true, results: P.pr.tests.map(() => null), cur: 0 }; renderSide();
    const res = await L.grade(P.pr, savedSrc(), (i, r) => { gradeState.cur = i; if (!r.running) gradeState.results[i] = r; if (view === 'test') renderSide(); });
    gradeState.running = false; gradeState.results = res;
    const score = P.pr.tests.reduce((s, t, i) => s + (res[i] && res[i].pass ? t.points : 0), 0);
    const best = L.store.get('best2.' + P.pid, null); if (best == null || score > best) L.store.set('best2.' + P.pid, score);
    if (ctx.mode === 'mock') { ctx.scores = ctx.scores || {}; ctx.scores[P.pid] = score; }
    L.store.set('last2.' + P.pid, { score, at: Date.now() });
    const ab = document.getElementById('ab-score'); ab.hidden = false; ab.textContent = score;
    renderSide();
    const mx = L.maxPoints(P.pr); notify(score === mx ? `🎉 ${esc(P.pr.title)} — ${mx}점 만점! 모든 요구사항을 통과했어요.` : `채점 결과: <b>${score}점</b> / ${mx}. 실패한 요구사항의 메시지를 확인해 보세요.`, score !== mx);
  }

  /* ---------- 열기 · 전환 ---------- */
  function loadMonaco() {
    if (monacoP) return monacoP;
    monacoP = new Promise((res, rej) => {
      const base = L.CDN.monaco;
      window.MonacoEnvironment = { getWorkerUrl: () => URL.createObjectURL(new Blob([`self.MonacoEnvironment={baseUrl:'${base.replace(/vs$/, '')}'};importScripts('${base}/base/worker/workerMain.js');`], { type: 'text/javascript' })) };
      L.loadScript(base + '/loader.min.js').then(() => {
        window.require.config({ paths: { vs: base }, 'vs/css': { disabled: true } });
        window.require(['vs/editor/editor.main'], () => res(window.monaco), rej);
      }).catch(rej);
    });
    return monacoP;
  }
  function setupMonaco() {
    monaco = window.monaco;
    monaco.editor.defineTheme('dark-modern', {
      base: 'vs-dark', inherit: true,
      rules: [{ token: '', foreground: 'cccccc' }, { token: 'identifier', foreground: '9cdcfe' }, { token: 'keyword', foreground: '569cd6' }, { token: 'string', foreground: 'ce9178' }, { token: 'number', foreground: 'b5cea8' }, { token: 'comment', foreground: '6a9955' }, { token: 'delimiter', foreground: 'd4d4d4' }, { token: 'type.identifier', foreground: '4ec9b0' }, { token: 'regexp', foreground: 'd16969' },
        { token: 'attribute.name.css', foreground: '9cdcfe' }, { token: 'attribute.value.css', foreground: 'ce9178' }, { token: 'tag.css', foreground: 'd7ba7d' }, { token: 'number.css', foreground: 'b5cea8' }],
      colors: { 'editor.background': '#1f1f1f', 'editor.foreground': '#cccccc', 'editorLineNumber.foreground': '#6e7681', 'editorLineNumber.activeForeground': '#cccccc', 'editor.lineHighlightBorder': '#282828', 'editorIndentGuide.background1': '#404040', 'editorIndentGuide.activeBackground1': '#707070', 'editorGutter.background': '#1f1f1f', 'editorWidget.background': '#202020', 'editorSuggestWidget.background': '#202020', 'editorSuggestWidget.selectedBackground': '#04395e', 'minimap.background': '#1f1f1f', 'scrollbarSlider.background': '#79797966', 'editor.selectionBackground': '#264f78', 'editorCursor.foreground': '#aeafad', 'editorBracketMatch.border': '#888888', 'editorBracketHighlight.foreground1': '#ffd700', 'editorBracketHighlight.foreground2': '#da70d6', 'editorBracketHighlight.foreground3': '#179fff' },
    });
    const td = monaco.languages.typescript; if (td) {
      td.javascriptDefaults.setCompilerOptions({ jsx: td.JsxEmit.Preserve, allowJs: true, allowNonTsExtensions: true, target: td.ScriptTarget.ESNext, module: td.ModuleKind.ESNext, moduleResolution: td.ModuleResolutionKind.NodeJs, checkJs: false });
      td.javascriptDefaults.setDiagnosticsOptions({ noSemanticValidation: true, noSyntaxValidation: true });
      td.javascriptDefaults.addExtraLib(`declare module 'react' { export function useState<T>(init: T | (() => T)): [T, (v: T | ((prev: T) => T)) => void]; export function useEffect(fn: () => void | (() => void), deps?: any[]): void; export function useRef<T>(init: T): { current: T }; export function useMemo<T>(fn: () => T, deps: any[]): T; export function useCallback<T>(fn: T, deps: any[]): T; export function useReducer(r: any, init: any): [any, (a: any) => void]; export function createContext<T>(v: T): any; export function useContext<T>(c: any): T; export const StrictMode: any; export const Fragment: any; const React: any; export default React; }
declare module 'react-dom/client' { export function createRoot(el: Element | null): { render(node: any): void }; }`, 'file:///node_modules/@types/react/index.d.ts');
    }
    editor = monaco.editor.create(document.getElementById('edhost'), {
      theme: 'dark-modern', automaticLayout: true, fontFamily: 'Consolas, "Courier New", "D2Coding", monospace', fontSize: 14, lineHeight: 19, tabSize: 2, insertSpaces: true,
      minimap: { enabled: true, renderCharacters: false, scale: 1 }, scrollBeyondLastLine: true, renderWhitespace: 'selection', bracketPairColorization: { enabled: true }, guides: { bracketPairs: false, indentation: true },
      autoClosingBrackets: 'languageDefined', autoClosingQuotes: 'languageDefined', formatOnPaste: false, mouseWheelZoom: true, smoothScrolling: false, cursorBlinking: 'blink', stickyScroll: { enabled: true },
      fixedOverflowWidgets: true, unicodeHighlight: { ambiguousCharacters: false },
    });
    editor.onDidChangeCursorPosition(ev => { document.getElementById('st-pos').textContent = `Ln ${ev.position.lineNumber}, Col ${ev.position.column}`; });
    editor.onDidFocusEditorText(() => { focusArea = 'editor'; });
    const KM = monaco.KeyMod, KC = monaco.KeyCode;
    editor.addCommand(KM.CtrlCmd | KC.KeyS, () => save());
    editor.addCommand(KM.CtrlCmd | KM.Alt | KC.KeyS, () => saveAll());
    editor.addCommand(KM.CtrlCmd | KC.KeyP, () => quickOpen());
    editor.addCommand(KM.CtrlCmd | KC.KeyB, () => { sideOn = !sideOn; renderSide(); });
    editor.addCommand(KM.CtrlCmd | KC.KeyJ, () => togglePanel());
    editor.addCommand(KM.CtrlCmd | KC.KeyW, () => { if (P.active) closeTab(P.active); });
    editor.addCommand(KM.CtrlCmd | KC.Backquote, () => { togglePanel(true); panelTab = 'terminal'; renderPanel(); term.focus(); });
    editor.addCommand(KM.Alt | KM.Shift | KC.KeyF, () => { notify('Prettier: 이 연습실에서는 자동 정렬이 꺼져 있어요.'); });
    document.getElementById('edload').hidden = true;
  }
  function openProject(pid) {
    P = loadProject(pid); disposeModels(); problems = []; consoleLines = []; consoleErr = 0; gradeState = { running: false, results: null };
    const last = L.store.get('last2.' + pid, null); const ab = document.getElementById('ab-score'); ab.hidden = !last; if (last) ab.textContent = last.score;
    if (dev.running) { dev.running = false; }
    term.reset();
    document.getElementById('cc-name').textContent = P.name;
    document.title = `문제.md - ${P.name} - Visual Studio Code`;
    P.open = ['문제.md']; P.active = '문제.md';
    const appPath = Object.keys(P.pr.files).find(p => /^src\/App\.jsx$/.test(p));
    renderSide(); renderTabs(); showActive(); renderPanel(); refreshPreview(); stPort();
    if (monaco && appPath) { openFile(appPath, { pin: true, nofocus: true }); P.active = '문제.md'; renderTabs(); showActive(); }
  }
  async function switchProblem(pid) {
    if (P && pid === P.pid) return;
    if (P && P.dirty.size && !(await L.ask('저장하지 않은 파일이 있어요', '저장하고 다른 문제로 넘어갈까요?', '저장하고 이동'))) return;
    if (P) saveAll();
    openProject(pid);
  }
  IDE.open = function (o) {
    ctx = o; if (!root) build();
    document.getElementById('home').hidden = true; document.getElementById('cbt').hidden = true; root.hidden = false;
    view = o.mode === 'mock' ? 'test' : 'explorer'; sideOn = true;
    const chip = document.getElementById('exam-chip'); chip.hidden = o.mode !== 'mock';
    document.getElementById('st-exam').hidden = o.mode !== 'mock';
    openProject(o.pid || o.problems[0]);
    togglePanel(true); panelTab = 'terminal'; renderPanel();
    const go = () => { if (!editor) { setupMonaco(); } if (P.pr.files['src/App.jsx']) { openFile('src/App.jsx', { pin: true, nofocus: true }); } P.active = '문제.md'; renderTabs(); showActive(); };
    L.babel().then(() => loadMonaco()).then(go).catch(err => { document.getElementById('edload').textContent = '편집기를 불러오지 못했어요. 인터넷 연결을 확인하고 새로 고침 해 주세요. (' + err.message + ')'; });
    if (o.mode === 'mock') tick();
  };
  function tick() {
    if (!ctx || ctx.mode !== 'mock' || root.hidden) return;
    const left = Math.max(0, ctx.endAt - Date.now()); const m = Math.floor(left / 60000), s = Math.floor(left / 1000) % 60;
    const txt = `${I('watch', 14)} ${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    const chip = document.getElementById('exam-chip'); chip.innerHTML = '남은 시간 ' + txt; chip.classList.toggle('ok', left > 600000);
    document.getElementById('st-exam').innerHTML = '모의고사 ' + txt;
    if (left <= 0) { notify('시험 시간이 끝났어요. 저장된 코드로 채점해요.', true); endMock(); return; }
    setTimeout(tick, 1000);
  }
  async function endMock() {
    if (P) saveAll();
    const scores = {};
    for (const id of ctx.problems) {
      const pr = problemById(id); const saved = Object.assign({}, L.scaffold(projName(pr)), pr.files, L.store.get('files2.' + id, {}) || {});
      Object.keys(saved).forEach(k => { if (saved[k] === null) delete saved[k]; });
      notify(`${esc(pr.title)} 채점 중…`);
      const res = await L.grade(pr, saved);
      scores[id] = { score: pr.tests.reduce((s, t, i) => s + (res[i] && res[i].pass ? t.points : 0), 0), res };
    }
    const cb = ctx.onEnd; ctx.mode = 'done'; if (dev.running) dev.running = false;
    root.hidden = true; cb && cb(scores);
  }
  async function leave() {
    if (ctx && ctx.mode === 'mock') { if (!(await L.ask('모의고사를 그만둘까요?', '진행 상황은 저장되지 않아요.', '그만두기'))) return; ctx.mode = 'done'; }
    if (P && P.dirty.size) saveAll();
    if (dev.running) { dev.running = false; }
    root.hidden = true; L.home();
  }
  IDE.isOpen = () => root && !root.hidden;
})();
