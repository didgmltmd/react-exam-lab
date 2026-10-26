/* cbt.js — 홈 화면, 필기(CBT), 실전 모의고사 흐름 */
(function () {
  'use strict';
  const L = window.RL; const esc = L.esc;
  const D = L.DATA;
  // 서술형·코드 작성 문제(essay.json)는 kind 를 type 으로 써서 필기 문제와 한 목록으로 다룸
  const E = (D.essay || []).map(q => Object.assign({}, q, { type: q.kind }));
  const W = (D.written || []).concat(E);
  // 시험 배점 영역 (이해 30 · 코드리뷰 30 · 코드 작성 10 · 서술형 30)
  const AREA = { single: '이해', multi: '이해', review: '코드리뷰', blank: '코드리뷰', code: '코드 작성', essay: '서술형' };
  const AREAS = ['이해', '코드리뷰', '코드 작성', '서술형'];
  const isEssay = q => q.type === 'essay' || q.type === 'code';
  // 채점 포인트 자동 체크: 공백을 모두 지우고 소문자로 바꾼 뒤 키워드가 하나라도 들어 있으면 체크
  const squash = s => String(s || '').replace(/\s+/g, '').toLowerCase();
  const autoTicks = (q, text) => { const t = squash(text); return q.rubric.map(r => r.keys.some(k => t.includes(squash(k)))); };
  const eScore = (q, tk) => q.rubric.reduce((s, r, k) => s + (tk && tk[k] ? r.pts : 0), 0);

  /* ---------- 간단 마크다운 ---------- */
  function inline(s) {
    return esc(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>').replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  }
  L.md = function (src) {
    const ls = String(src || '').replace(/\r/g, '').split('\n'); const out = []; let i = 0;
    while (i < ls.length) {
      const l = ls[i];
      if (/^```/.test(l)) { const buf = []; i++; while (i < ls.length && !/^```/.test(ls[i])) buf.push(ls[i++]); i++; out.push(`<pre><code>${esc(buf.join('\n'))}</code></pre>`); continue; }
      const h = /^(#{1,4})\s+(.*)$/.exec(l); if (h) { out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`); i++; continue; }
      if (/^---+\s*$/.test(l)) { out.push('<hr>'); i++; continue; }
      if (/^\s*>/.test(l)) { const buf = []; while (i < ls.length && /^\s*>/.test(ls[i])) buf.push(ls[i++].replace(/^\s*>\s?/, '')); out.push(`<blockquote>${L.md(buf.join('\n'))}</blockquote>`); continue; }
      if (/^\s*\|/.test(l)) { const rows = []; while (i < ls.length && /^\s*\|/.test(ls[i])) rows.push(ls[i++]); const cells = r => r.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim()); const body = rows.filter(r => !/^\s*\|[\s:|-]+\|\s*$/.test(r)); out.push('<table>' + body.map((r, k) => '<tr>' + cells(r).map(c => k === 0 ? `<th>${inline(c)}</th>` : `<td>${inline(c)}</td>`).join('') + '</tr>').join('') + '</table>'); continue; }
      if (/^\s*([-*]|\d+\.)\s+/.test(l)) {
        const ordered = /^\s*\d+\./.test(l); const items = [];
        while (i < ls.length && (/^\s*([-*]|\d+\.)\s+/.test(ls[i]) || (/^\s{2,}\S/.test(ls[i]) && items.length))) {
          if (/^\s*([-*]|\d+\.)\s+/.test(ls[i]) && !/^\s{2,}/.test(ls[i])) items.push(ls[i].replace(/^\s*([-*]|\d+\.)\s+/, ''));
          else items[items.length - 1] += '\n' + ls[i].trim();
          i++;
        }
        out.push(`<${ordered ? 'ol' : 'ul'}>` + items.map(x => `<li>${x.split('\n').map((y, k) => k && /^([-*]|\d+\.)\s/.test(y) ? '<br>• ' + inline(y.replace(/^([-*]|\d+\.)\s+/, '')) : inline(y)).join(k => ' ')}</li>`).join('') + `</${ordered ? 'ol' : 'ul'}>`);
        continue;
      }
      if (!l.trim()) { i++; continue; }
      const buf = []; while (i < ls.length && ls[i].trim() && !/^(#{1,4}\s|```|\s*([-*]|\d+\.)\s|\s*>|\s*\|)/.test(ls[i])) buf.push(ls[i++]);
      out.push(`<p>${buf.map(inline).join('<br>')}</p>`);
    }
    return out.join('\n');
  };

  /* ---------- 시험지 (작년 시험 문제지 형식) ---------- */
  L.sheet = function (pr, no) {
    const sh = pr.sheet; const shots = sh.shots || [];
    const t = sh.title || (no + '. ' + pr.title);
    let k = 0;
    const slide = (body) => { k++; return `<section class="slide"><h2 class="sl-t">${esc(t)} (${k})</h2><div class="sl-b">${body}</div><div class="sl-f">Page | ${k}</div></section>`; };
    const img = (i, cap) => shots[i] ? `<figure class="shot"><img src="${shots[i]}" alt="${esc(cap || '')}"></figure>` : '';
    const out = [];
    out.push(slide(`<p class="o1">요구사항(초기화면)</p><p class="o2">${esc(sh.summary || '')}</p>${img(0, '초기 화면')}`));
    const st = sh.structure || { areas: [] };
    out.push(slide(`<p class="o1">요구사항(컴포넌트 구조 – ${st.points || 10}점${st.note ? ', ' + esc(st.note) : ''})</p>${st.lead ? `<p class="o2">${esc(st.lead)}</p>` : ''}${(st.areas || []).map(a => `<p class="o2">${esc(a.desc)}</p><p class="o3">이 영역의 이름을 <b>${esc(a.name)}</b>이라고 할 것</p>`).join('')}`));
    const ft = sh.features || { items: [] };
    out.push(slide(`<p class="o1">요구사항(기능 구현 – ${ft.points || 25}점)</p>${(ft.items || []).map(x => `<p class="o2">${esc(x.text)} <b>(${x.points}점)</b></p>${(x.sub || []).map(y => `<p class="o3">${esc(y)}</p>`).join('')}`).join('')}`));
    const scr = (sh.screens || []).slice(1);
    if (scr.length) out.push(slide(`<p class="o1">요구사항(추가 스크린샷)</p>${scr.map(x => `<p class="o2">${esc(x.caption)}</p>`).join('')}<div class="shots">${scr.map((x, i) => `<div>${img(i + 1, x.caption)}<div class="cap">${esc(x.caption)}</div></div>`).join('')}</div>`));
    return `<div class="sheet"><div class="sh-note">문제지 · ${esc(pr.title)} · 배점 ${L.maxPoints(pr)}점${sh.files ? ` · 수정할 파일: <code>${esc(sh.files)}</code>` : ''}</div>${out.join('')}<div class="sh-note">CSS는 채점하지 않아요. 시험 도구(비커 아이콘)의 <b>채점하기</b>는 위 배점대로 요구사항을 하나씩 확인해요.</div></div>`;
  };

  /* ---------- 코드 색칠 (VS Code 색) ---------- */
  const KW = /^(const|let|var|function|new|typeof|class|extends|this|true|false|null|undefined|async|of|in)$/;
  const CT = /^(import|export|from|return|if|else|for|while|switch|case|break|default|await|try|catch)$/;
  function hl(code) {
    let out = '', i = 0; const s = code; let inTag = false;
    while (i < s.length) {
      const r = s.slice(i);
      let m;
      if ((m = /^\/\/.*/.exec(r)) && !inTag) { out += `<span class="hl-cm">${esc(m[0])}</span>`; i += m[0].length; continue; }
      if ((m = /^\/\*[\s\S]*?\*\//.exec(r))) { out += `<span class="hl-cm">${esc(m[0])}</span>`; i += m[0].length; continue; }
      if ((m = /^("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`)/.exec(r))) { out += `<span class="hl-s">${esc(m[0])}</span>`; i += m[0].length; continue; }
      if (inTag) {
        if ((m = /^\/?>/.exec(r))) { out += `<span class="hl-p">${esc(m[0])}</span>`; i += m[0].length; inTag = false; continue; }
        if ((m = /^[A-Za-z_][\w-]*/.exec(r))) { out += `<span class="hl-a">${esc(m[0])}</span>`; i += m[0].length; continue; }
        if (r[0] === '{') { let d = 1, j = 1; while (j < r.length && d) { if (r[j] === '{') d++; else if (r[j] === '}') d--; j++; } out += '{' + hl(r.slice(1, j - 1)) + (d ? '' : '}'); i += j; continue; }
        out += esc(r[0]); i++; continue;
      }
      if ((m = /^<(\/?)([A-Za-z][\w.]*)?/.exec(r)) && (m[2] || r[1] === '>' || r[1] === '/')) {
        const prev = s.slice(0, i).replace(/\s+$/, ''); const pc = prev.slice(-1);
        if (!pc || /[(=>{?:,&|\[]/.test(pc) || /return$/.test(prev)) {
          out += `<span class="hl-p">&lt;${m[1]}</span>` + (m[2] ? `<span class="${/^[A-Z]/.test(m[2]) ? 'hl-t' : 'hl-tag'}">${esc(m[2])}</span>` : '');
          i += m[0].length; inTag = true; if (s[i] === '>') { out += '<span class="hl-p">&gt;</span>'; i++; inTag = false; } continue;
        }
      }
      if ((m = /^\d+(\.\d+)?/.exec(r)) && !/[\w$]/.test(s[i - 1] || '')) { out += `<span class="hl-n">${m[0]}</span>`; i += m[0].length; continue; }
      if ((m = /^[A-Za-z_$][\w$]*/.exec(r))) {
        const w = m[0]; const after = r.slice(w.length);
        const cls = s[i - 1] !== '.' && CT.test(w) ? 'hl-c' : KW.test(w) ? 'hl-k' : /^\s*\(/.test(after) ? 'hl-f' : /^[A-Z]/.test(w) ? 'hl-t' : 'hl-a';
        out += `<span class="${cls}">${esc(w)}</span>`; i += w.length; continue;
      }
      out += esc(r[0]); i++;
    }
    return out;
  }
  L.hl = hl;

  /* ---------- 진행 기록 ---------- */
  const st = L.store;
  function stats() { const r = st.get('wres', {}); let ok = 0, n = 0; Object.values(r).forEach(v => { n++; if (v) ok++; }); return { ok, n }; }

  /* ---------- 홈 ---------- */
  L.home = function () {
    const h = document.getElementById('home'); document.getElementById('cbt').hidden = true; h.hidden = false; document.title = 'React 시험 연습실';
    const s = stats();
    const prs = D.practical || [];
    const wr = st.get('wres', {});
    const areaBtn = a => { const qs = W.filter(q => AREA[q.type] === a); const done = qs.filter(q => wr[q.id] != null).length; return `<button class="btn area" data-area="${a}"><span>${a}</span><small>${done} / ${qs.length}</small></button>`; };
    h.innerHTML = `<div class="home">
      <h1>React 중간고사 연습실</h1>
      <p class="sub">시험이 필기 중심으로 바뀌었어요. 객관식·코드리뷰는 바로 채점되고, 서술형·코드 작성은 모범답안과 채점 포인트를 보며 직접 채점해요.</p>
      <div class="info"><div><b>11/2 (월) 14:00~16:00</b><span>PC 대면 · 120분</span></div><div><b>이해 30%</b><span>객관식</span></div><div><b>코드리뷰 30%</b><span>틀린 곳 찾기 · 빈칸 채우기</span></div><div><b>코드 작성 10%</b><span>짧은 코드 쓰기</span></div><div><b>서술형 30%</b><span>개념 설명 · 이유 쓰기</span></div></div>
      <div class="cards">
        <div class="card"><h2>영역별 연습</h2><p>시험 영역을 골라 한 문제씩 풀고 바로 해설을 봐요. 숫자는 푼 문제 / 전체 문제예요.</p><div class="area-btns">${AREAS.map(areaBtn).join('')}</div><div class="meta">전체 ${W.length}문항 · 푼 문제 ${s.n} · 맞힌 문제 ${s.ok}</div><button class="btn pri go" data-go="written">전체 섞어서 풀기</button></div>
        <div class="card"><h2>실전 모의고사</h2><p>실제 시험처럼 120분 타이머. 끝까지 풀고 제출하면 객관식은 자동 채점, 서술형·코드는 모범답안을 보며 채점해서 100점 만점으로 환산해요.</p><div class="meta">이해 10 · 코드리뷰 10 · 코드 작성 1 · 서술형 3 · 120분</div><button class="btn pri go" data-go="mock">모의고사 시작</button></div>
        <div class="card"><h2>VS Code 실기 (심화)</h2><p>코드 작성 감각을 기르는 연습이에요. VS Code 화면에서 컴포넌트를 완성하고 <b>npm run dev</b>로 확인한 뒤 자동 채점해요.</p><div class="meta">${prs.length}문제 · 시험 비중은 작아졌지만 손에 익히기 좋아요</div><button class="btn go" data-go="practical">실기 연습 열기</button></div>
      </div>
      <h3>VS Code 실기 문제 바로 열기</h3>
      <div class="plinks">${prs.map((p, i) => { const b = st.get('best2.' + p.id, null); const mx = L.maxPoints(p); return `<button class="plink" data-prob="${p.id}"><span><b>problem${i + 1}</b> · ${esc(p.title)}<br><small>${esc(p.level || '')} · ${mx}점</small></span><span class="s${b != null && b >= mx ? ' full' : ''}">${b == null ? '' : b + ' / ' + mx}</span></button>`; }).join('')}</div>
      <p class="foot-note">진행 기록과 작성한 답안은 이 브라우저에만 저장돼요. 범위: 10/26 수업까지 · CSS와 React와 상관없는 JS는 출제 안 됨.</p>
      <p class="foot-note"><button class="btn" data-go="reset">기록 모두 지우기</button></p>
    </div>`;
    h.onclick = e => {
      const b = e.target.closest('[data-go],[data-prob],[data-area]'); if (!b) return;
      if (b.dataset.prob) return L.ide.open({ mode: 'practice', problems: prs.map(p => p.id), pid: b.dataset.prob });
      if (b.dataset.area) { st.set('wfilter', { ch: '', type: '', only: '', area: b.dataset.area }); return startWritten({ mode: 'practice' }); }
      const g = b.dataset.go;
      if (g === 'written') { st.set('wfilter', { ch: '', type: '', only: '', area: '' }); startWritten({ mode: 'practice' }); }
      else if (g === 'practical') L.ide.open({ mode: 'practice', problems: prs.map(p => p.id), pid: prs[0].id });
      else if (g === 'mock') startMock();
      else if (g === 'reset') { L.ask('기록을 모두 지울까요?', '필기 기록, 실기 코드, 점수가 모두 사라져요.', '모두 지우기').then(y => { if (!y) return; try { Object.keys(localStorage).filter(k => k.startsWith('reactlab.')).forEach(k => localStorage.removeItem(k)); } catch (x) { } L.home(); }); }
    };
  };

  /* ---------- 필기 ---------- */
  let S = null; // {mode, list:[q], i, ans:{id:any}, checked:{id:bool}, endAt, onDone}
  const TYPE = { single: '객관식', multi: '복수 정답', review: '틀린 줄 찾기', blank: '빈칸 채우기', code: '코드 작성', essay: '서술형' };
  function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function startWritten(o) {
    const f = Object.assign({ ch: '', type: '', only: '', area: '' }, st.get('wfilter', {}));
    S = Object.assign({ i: 0, ans: {}, checked: {}, ticks: {}, filter: f }, o);
    if (o.mode === 'practice') S.list = filtered(f);
    renderCBT();
  }
  function filtered(f) {
    const wr = st.get('wres', {});
    return W.filter(q => (!f.area || AREA[q.type] === f.area) && (!f.ch || q.ch === f.ch) && (!f.type || q.type === f.type) && (!f.only || (f.only === 'wrong' ? wr[q.id] === false : wr[q.id] == null)));
  }
  const norm = s => String(s).replace(/\s+/g, '').replace(/"/g, "'").replace(/;$/, '');
  // 서술형·코드는 채점 포인트 점수가 70% 이상이면 맞힌 것으로 기록
  function isRight(q, a, tk) {
    if (a == null) return false;
    if (isEssay(q)) return eScore(q, tk || autoTicks(q, a)) >= q.points * 0.7;
    if (q.type === 'single' || q.type === 'multi') { const x = (a || []).slice().sort().join(','), y = q.answer.slice().sort().join(','); return x === y; }
    if (q.type === 'review') return a === q.answer[0];
    if (q.type === 'blank') return q.blanks.every((ok, k) => ok.some(v => norm(v) === norm((a || [])[k] || '')));
    return false;
  }
  const tkOf = q => (S && S.ticks && S.ticks[q.id]) || null;
  function answered(q) { const a = S.ans[q.id]; if (a == null) return false; if (isEssay(q)) return String(a).trim().length > 0; if (Array.isArray(a)) return q.type === 'blank' ? a.some(x => x && x.trim()) : a.length > 0; return true; }
  const codeBlock = src => `<div class="code">${String(src).split('\n').map((l, i) => `<div class="cl"><span class="n">${i + 1}</span><span>${hl(l) || ' '}</span></div>`).join('')}</div>`;
  const chars = v => String(v || '').replace(/\s/g, '').length;
  // 모범답안 + 채점 포인트 (체크박스는 data-tick, 점수는 .esc 에 바로 반영)
  function essayResult(q, a, tk, id) {
    const sc = eScore(q, tk);
    return `<div class="exp essay-res" data-eq="${esc(id || q.id)}"><div class="eh"><b>모범답안</b><span class="esc">${sc} / ${q.points}점</span></div>
      ${q.type === 'code' ? codeBlock(q.answer) : `<p class="ans-t">${inlineQ(q.answer)}</p>`}
      <div class="rub"><div class="rh">채점 포인트 — 내 답에 들어간 것을 체크하세요. 키워드가 보이면 미리 체크돼 있어요.</div>${q.rubric.map((r, k) => `<label class="ri${tk[k] ? ' on' : ''}"><input type="checkbox" data-tick="${k}"${tk[k] ? ' checked' : ''}><span>${inlineQ(r.text)}</span><b>${r.pts}점</b></label>`).join('')}</div>
      ${q.explain ? `<div class="ex2">${inlineQ(q.explain)}</div>` : ''}</div>`;
  }
  function renderCBT() {
    const el = document.getElementById('cbt'); document.getElementById('home').hidden = true; el.hidden = false;
    const mock = S.mode === 'mock';
    if (!S.list.length) {
      el.innerHTML = `<div class="cbt"><div class="cbt-top"><span class="ttl">React 필기 연습</span><span class="r"><button class="btn" data-a="home">홈</button></span></div><div class="cbt-body"><div class="qwrap"><div class="qcard"><p class="qtext">조건에 맞는 문제가 없어요. 오른쪽 필터를 바꿔 보세요.</p></div></div>${sideHTML()}</div></div>`;
      bind(el); return;
    }
    const q = S.list[S.i]; const a = S.ans[q.id]; const done = !mock && S.checked[q.id];
    const right = done && isRight(q, a, tkOf(q));
    let body = `<div class="qhead"><span class="qn">${S.i + 1}.</span><span class="tag k">${AREA[q.type]}</span>${TYPE[q.type] !== AREA[q.type] ? `<span class="tag">${TYPE[q.type]}</span>` : ''}${q.type === 'multi' ? `<span class="tag">${q.pick}개 고르시오</span>` : ''}${isEssay(q) ? `<span class="tag">${q.points}점</span>` : ''}<span class="tag">${esc(q.ch || '')}</span></div><p class="qtext">${inlineQ(q.q)}</p>`;
    if (q.type === 'review') {
      const lines = q.code.split('\n');
      body += `<div class="code pick" role="listbox" aria-label="틀린 줄을 고르세요">${lines.map((l, k) => { const n = k + 1; let c = ''; if (a === n) c = ' on'; if (done) { if (n === q.answer[0]) c = ' right'; else if (a === n) c = ' wrong'; } return `<div class="cl${c}" data-line="${n}" role="option" aria-selected="${a === n}"><span class="n">${n}</span><span>${hl(l) || ' '}</span></div>`; }).join('')}</div><p class="qact" style="margin:0;color:var(--c-mut);font-size:13.5px">틀린 줄을 클릭해서 고르세요.${a ? ` 고른 줄: <b>${a}번째 줄</b>` : ''}</p>`;
    } else if (q.type === 'blank') {
      const vals = a || [];
      const html = hl(q.code).replace(/___(\d+)___/g, (m, n) => { const idx = +n - 1; let c = ''; if (done) c = q.blanks[idx].some(v => norm(v) === norm(vals[idx] || '')) ? ' right' : ' wrong'; const v = vals[idx] || ''; return `<input class="blank${c}" data-blank="${idx}" value="${esc(v)}" placeholder="(${n})" aria-label="빈칸 ${n}" spellcheck="false" autocomplete="off" style="width:${Math.max(8, Math.max(v.length, ...q.blanks[idx].map(x => x.length)) + 2)}ch"${done ? ' readonly' : ''}>`; });
      body += `<div class="code">${html.split('\n').map((l, i) => `<div class="cl"><span class="n">${i + 1}</span><span>${l || ' '}</span></div>`).join('')}</div>`;
    } else if (isEssay(q)) {
      if (q.code) body += codeBlock(q.code);
      const v = a || '';
      body += `<textarea class="essay${q.type === 'code' ? ' mono' : ''}" data-essay aria-label="답안" placeholder="${q.type === 'code' ? '여기에 코드를 작성하세요 (Tab = 들여쓰기)' : '시험 답안지에 쓰듯 문장으로 작성하세요'}" spellcheck="false"${done ? ' readonly' : ''}>${esc(v)}</textarea><div class="ecount"><span data-count>${chars(v)}</span>자 (공백 제외)</div>`;
    } else {
      if (q.code) body += codeBlock(q.code);
      const sel = a || [];
      body += `<div class="opts${q.type === 'multi' ? ' multi' : ''}" role="${q.type === 'multi' ? 'group' : 'radiogroup'}">${q.options.map((o, k) => { let c = sel.includes(k) ? ' on' : ''; if (done) { if (q.answer.includes(k)) c = ' right'; else if (sel.includes(k)) c = ' wrong'; } return `<button class="opt${c}" data-opt="${k}" role="${q.type === 'multi' ? 'checkbox' : 'radio'}" aria-checked="${sel.includes(k)}"><span class="mk">${'①②③④⑤⑥⑦'[k]}</span><span>${inlineQ(o)}</span></button>`; }).join('')}</div>`;
    }
    if (done) {
      if (isEssay(q)) body += essayResult(q, a, S.ticks[q.id] || autoTicks(q, a));
      else {
        let ansTxt = '';
        if (q.type === 'single' || q.type === 'multi') ansTxt = '정답: ' + q.answer.map(k => '①②③④⑤⑥⑦'[k]).join(', ');
        else if (q.type === 'review') ansTxt = `정답: ${q.answer[0]}번째 줄`;
        else ansTxt = '정답: ' + q.blanks.map((b, k) => `(${k + 1}) <code>${esc(b[0])}</code>`).join('  ');
        body += `<div class="exp ${right ? 'ok' : 'no'}"><b class="${right ? 'r' : 'w'}">${right ? '정답이에요!' : '틀렸어요.'}</b> ${ansTxt}<div style="margin-top:6px">${inlineQ(q.explain)}</div>${q.type === 'review' && q.fix ? `<div class="fix">고친 코드: ${esc(q.fix)}</div>` : ''}</div>`;
      }
    }
    const last = S.i === S.list.length - 1;
    const checkLbl = isEssay(q) ? '모범답안 보고 채점하기' : '정답 확인';
    body += `<div class="qact">${S.i > 0 ? '<button class="btn" data-a="prev">← 이전</button>' : ''}${!mock && !done ? `<button class="btn pri" data-a="check"${answered(q) ? '' : ' disabled'}>${checkLbl}</button>` : ''}${!last ? `<button class="btn${mock || done ? ' pri' : ''}" data-a="next">다음 →</button>` : mock ? '<button class="btn pri" data-a="submit">답안 제출하고 채점 →</button>' : ''}</div>`;
    const timer = mock ? `<span class="tm" id="tm"></span>` : '';
    el.innerHTML = `<div class="cbt"><div class="cbt-top"><span class="ttl">${mock ? '실전 모의고사' : 'React 필기 연습'}</span>${timer}<span class="r">${mock ? '<button class="btn pri" data-a="submit">답안 제출</button>' : '<button class="btn" data-a="home">홈</button>'}</span></div>
      <div class="cbt-body"><div class="qwrap"><div class="qcard">${body}</div></div>${sideHTML()}</div></div>`;
    bind(el);
    const qw = el.querySelector('.qwrap'); if (qw) qw.scrollTop = 0;
    const firstBlank = el.querySelector('input.blank:not([readonly])'); if (firstBlank && !answered(q)) firstBlank.focus();
    if (mock) tickW();
  }
  function inlineQ(s) { return esc(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\n/g, '<br>'); }
  function sideHTML() {
    const mock = S.mode === 'mock';
    const grid = `<div class="grid">${S.list.map((q, k) => { let c = ''; if (answered(q)) c = ' ans'; if (!mock && S.checked[q.id]) c = isRight(q, S.ans[q.id], tkOf(q)) ? ' ok' : ' no'; if (k === S.i) c += ' cur'; return `<button class="${c.trim()}" data-go="${k}" aria-label="${k + 1}번">${k + 1}</button>`; }).join('')}</div>`;
    if (mock) { const n = S.list.filter(answered).length; return `<aside class="side"><h4>답안 표시</h4>${grid}<div class="stat">푼 문제 <b>${n}</b> / ${S.list.length}</div><div class="stat">${AREAS.map(ar => { const ix = S.list.map((x, k) => AREA[x.type] === ar ? k + 1 : 0).filter(Boolean); return ix.length ? `${ix[0]}${ix.length > 1 ? '~' + ix[ix.length - 1] : ''} ${ar}` : ''; }).filter(Boolean).join(' · ')}</div><div class="stat">제출하면 객관식·빈칸은 자동 채점되고, 코드 작성·서술형은 모범답안을 보며 직접 채점해요.</div></aside>`; }
    const f = S.filter; const chs = [...new Set(W.map(q => q.ch))]; const s = stats();
    const okN = S.list.filter(q => S.checked[q.id] && isRight(q, S.ans[q.id], tkOf(q))).length, chN = S.list.filter(q => S.checked[q.id]).length;
    return `<aside class="side"><h4>문제 고르기</h4><div class="flt">
      <select data-f="area" aria-label="시험 영역"><option value="">전체 영역</option>${AREAS.map(x => `<option${f.area === x ? ' selected' : ''}>${x}</option>`).join('')}</select>
      <select data-f="ch" aria-label="단원"><option value="">전체 단원</option>${chs.map(c => `<option${f.ch === c ? ' selected' : ''}>${esc(c)}</option>`).join('')}</select>
      <select data-f="type" aria-label="유형"><option value="">전체 유형</option>${Object.keys(TYPE).map(t => `<option value="${t}"${f.type === t ? ' selected' : ''}>${TYPE[t]}</option>`).join('')}</select>
      <select data-f="only" aria-label="기록"><option value="">모든 문제</option><option value="new"${f.only === 'new' ? ' selected' : ''}>안 푼 문제만</option><option value="wrong"${f.only === 'wrong' ? ' selected' : ''}>틀린 문제만 (오답노트)</option></select>
      <button class="btn" data-a="shuffle">순서 섞기</button></div>
      <h4>이번 세트 · ${S.list.length}문항</h4>${grid}<div class="stat">이번 세트 정답 <b>${okN}</b> / ${chN}</div><div class="stat">전체 기록: 맞힘 <b>${s.ok}</b> / 푼 문제 ${s.n}</div><div class="stat">서술형·코드는 채점 포인트 70% 이상이면 맞힘으로 기록돼요.</div></aside>`;
  }
  // 체크박스 하나 바꿀 때 화면 전체를 다시 그리지 않고 점수만 고침
  function onTick(box, q, ticks, save) {
    const k = +box.dataset.tick; ticks[k] = box.checked;
    box.closest('.ri').classList.toggle('on', box.checked);
    const res = box.closest('.essay-res'); res.querySelector('.esc').textContent = `${eScore(q, ticks)} / ${q.points}점`;
    if (save) save();
  }
  function saveEssayRes(q) { const wr = st.get('wres', {}); wr[q.id] = isRight(q, S.ans[q.id], S.ticks[q.id]); st.set('wres', wr); }
  function bind(el) {
    el.onclick = e => {
      const t = e.target; const q = S.list[S.i];
      if (t.closest('.rub')) return; // 체크박스는 onchange 에서 처리
      const o = t.closest('[data-opt]'); if (o && q && !(S.mode !== 'mock' && S.checked[q.id])) { const k = +o.dataset.opt; let a = (S.ans[q.id] || []).slice(); if (q.type === 'multi') { a = a.includes(k) ? a.filter(x => x !== k) : a.concat(k); } else a = [k]; S.ans[q.id] = a; renderCBT(); return; }
      const ln = t.closest('[data-line]'); if (ln && q && q.type === 'review' && !(S.mode !== 'mock' && S.checked[q.id])) { S.ans[q.id] = +ln.dataset.line; renderCBT(); return; }
      const g = t.closest('[data-go]'); if (g) { saveBlanks(); S.i = +g.dataset.go; renderCBT(); return; }
      const b = t.closest('[data-a]'); if (!b) return; const a = b.dataset.a;
      if (a === 'home') { S = null; L.home(); }
      else if (a === 'prev') { saveBlanks(); S.i--; renderCBT(); }
      else if (a === 'next') { saveBlanks(); S.i++; renderCBT(); }
      else if (a === 'check') {
        window.LMTrack && window.LMTrack.event('quiz'); saveBlanks(); S.checked[q.id] = true;
        if (isEssay(q)) { S.ticks[q.id] = autoTicks(q, S.ans[q.id]); saveEssayRes(q); }
        else { const wr = st.get('wres', {}); wr[q.id] = isRight(q, S.ans[q.id]); st.set('wres', wr); }
        renderCBT();
      }
      else if (a === 'shuffle') { S.list = shuffle(S.list); S.i = 0; renderCBT(); }
      else if (a === 'submit') { saveBlanks(); const un = S.list.filter(x => !answered(x)).length; L.ask('답안을 제출할까요?', (un ? `아직 안 푼 문제가 ${un}개 있어요. ` : '') + '제출하면 객관식·빈칸은 자동 채점되고, 코드 작성·서술형은 모범답안을 보며 직접 채점해요.', '제출하고 채점').then(y => { if (y && S && S.onDone) S.onDone(); }); }
    };
    el.onchange = e => {
      const box = e.target.closest('[data-tick]');
      if (box) { const q = S.list[S.i]; if (!S.ticks[q.id]) S.ticks[q.id] = autoTicks(q, S.ans[q.id]); onTick(box, q, S.ticks[q.id], () => { saveEssayRes(q); const gb = el.querySelector(`.grid [data-go="${S.i}"]`); if (gb) { const ok = isRight(q, S.ans[q.id], S.ticks[q.id]); gb.classList.toggle('ok', ok); gb.classList.toggle('no', !ok); } }); return; }
      const s = e.target.closest('[data-f]'); if (!s) return; S.filter[s.dataset.f] = s.value; st.set('wfilter', S.filter); S.list = filtered(S.filter); S.i = 0; S.checked = {}; S.ticks = {}; renderCBT();
    };
    el.oninput = e => {
      const ta = e.target.closest('textarea[data-essay]');
      if (ta) { const q = S.list[S.i]; S.ans[q.id] = ta.value; const c = el.querySelector('[data-count]'); if (c) c.textContent = chars(ta.value); const btn = el.querySelector('[data-a="check"]'); if (btn) btn.disabled = !answered(q); const gb = el.querySelector(`.grid [data-go="${S.i}"]`); if (gb) gb.classList.toggle('ans', answered(q)); return; }
      const inp = e.target.closest('input.blank'); if (!inp) return; const q = S.list[S.i]; const a = (S.ans[q.id] || []).slice(); a[+inp.dataset.blank] = inp.value; S.ans[q.id] = a; const btn = el.querySelector('[data-a="check"]'); if (btn) btn.disabled = !answered(q); inp.style.width = Math.max(8, inp.value.length + 2) + 'ch';
    };
    el.onkeydown = e => {
      const ta = e.target.closest('textarea.mono');
      if (ta && e.key === 'Tab' && !ta.readOnly) { e.preventDefault(); const s = ta.selectionStart, en = ta.selectionEnd; ta.value = ta.value.slice(0, s) + '  ' + ta.value.slice(en); ta.selectionStart = ta.selectionEnd = s + 2; ta.dispatchEvent(new Event('input', { bubbles: true })); return; }
      if (e.key === 'Enter' && e.target.closest('input.blank')) { const btn = el.querySelector('[data-a="check"]') || el.querySelector('[data-a="next"]'); if (btn && !btn.disabled) btn.click(); }
    };
  }
  function saveBlanks() { const q = S && S.list[S.i]; if (!q || q.type !== 'blank') return; const vals = [...document.querySelectorAll('#cbt input.blank')].map(x => x.value); if (vals.some(v => v)) S.ans[q.id] = vals; }
  function tickW() {
    if (!S || S.mode !== 'mock') return; const el = document.getElementById('tm'); if (!el) return;
    const left = Math.max(0, S.endAt - Date.now()); const m = Math.floor(left / 60000), s = Math.floor(left / 1000) % 60;
    el.textContent = `남은 시간 ${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`; el.classList.toggle('low', left < 600000);
    if (left <= 0) { saveBlanks(); S.onDone(); return; }
    clearTimeout(tickW.t); tickW.t = setTimeout(tickW, 1000);
  }

  /* ---------- 모의고사 ---------- */
  async function startMock() {
    if (!(await L.ask('실전 모의고사를 시작할까요?', '· 120분 타이머\n· 이해 10 → 코드리뷰 10 → 코드 작성 1 → 서술형 3\n· 끝날 때까지 정답을 보여 주지 않아요\n· 제출하면 코드 작성·서술형은 모범답안을 보며 직접 채점해요', '시작'))) return;
    window.LMTrack && window.LMTrack.event('mock');
    const pick = (type, n) => shuffle(W.filter(q => q.type === type)).slice(0, n);
    const list = shuffle(pick('single', 7).concat(pick('multi', 3)))
      .concat(shuffle(pick('review', 5).concat(pick('blank', 5))))
      .concat(pick('code', 1)).concat(pick('essay', 3));
    const endAt = Date.now() + 120 * 60000;
    S = { mode: 'mock', list, i: 0, ans: {}, checked: {}, ticks: {}, filter: {}, endAt, onDone: () => { clearTimeout(tickW.t); const M = { list, wAns: S.ans }; S = null; selfGrade(M); } };
    renderCBT();
  }
  // 제출 후: 코드 작성·서술형을 모범답안과 채점 포인트로 직접 채점
  function selfGrade(M) {
    const el = document.getElementById('cbt'); el.hidden = false; document.getElementById('home').hidden = true;
    const subj = M.list.filter(isEssay);
    M.ticks = {}; subj.forEach(q => { M.ticks[q.id] = autoTicks(q, M.wAns[q.id]); });
    if (!subj.length) return report(M);
    const mine = q => { const v = M.wAns[q.id]; return v && String(v).trim() ? `<pre class="mine${q.type === 'code' ? ' mono' : ''}">${esc(v)}</pre>` : '<p class="mine-none">답을 쓰지 않았어요 (0점)</p>'; };
    el.innerHTML = `<div class="page" style="position:absolute"><div class="report sg"><h1>코드 작성 · 서술형 채점</h1><p class="sg-lead">객관식과 빈칸은 자동으로 채점했어요. 아래 ${subj.length}문제는 내 답과 모범답안을 비교해서, 내 답에 들어간 채점 포인트를 체크하세요. 키워드가 보이는 항목은 미리 체크돼 있어요.</p>
      ${subj.map((q, n) => `<section class="sg-item"><div class="qhead"><span class="qn">${M.list.indexOf(q) + 1}.</span><span class="tag k">${AREA[q.type]}</span><span class="tag">${q.points}점</span><span class="tag">${esc(q.ch || '')}</span></div><p class="qtext">${inlineQ(q.q)}</p>${q.code ? codeBlock(q.code) : ''}<h4>내 답</h4>${mine(q)}${essayResult(q, M.wAns[q.id], M.ticks[q.id], q.id)}</section>`).join('')}
      <div class="qact"><button class="btn pri" data-r="done">채점 끝내고 결과 보기</button></div></div></div>`;
    el.onchange = e => { const box = e.target.closest('[data-tick]'); if (!box) return; const id = box.closest('.essay-res').dataset.eq; const q = subj.find(x => x.id === id); onTick(box, q, M.ticks[id]); };
    el.onclick = e => { const b = e.target.closest('[data-r="done"]'); if (b) report(M); };
    el.oninput = null; el.onkeydown = null;
    const pg = el.querySelector('.page'); if (pg) pg.scrollTop = 0;
  }
  function report(M) {
    const el = document.getElementById('cbt'); el.hidden = false; document.getElementById('home').hidden = true;
    const T = M.ticks || {};
    const und = M.list.filter(q => q.type === 'single' || q.type === 'multi'), rev = M.list.filter(q => q.type === 'review' || q.type === 'blank');
    const cod = M.list.filter(q => q.type === 'code'), ess = M.list.filter(q => q.type === 'essay');
    const ok = arr => arr.filter(q => isRight(q, M.wAns[q.id])).length;
    const pts = arr => arr.reduce((s, q) => s + (M.wAns[q.id] && String(M.wAns[q.id]).trim() ? eScore(q, T[q.id]) : 0), 0), max = arr => arr.reduce((s, q) => s + q.points, 0);
    const scale = (got, all, w) => all ? got / all * w : 0;
    const u = scale(ok(und), und.length, 30), r = scale(ok(rev), rev.length, 30), c = scale(pts(cod), max(cod), 10), e = scale(pts(ess), max(ess), 30);
    const r1 = x => Math.round(x * 10) / 10;
    const total = r1(u + r + c + e);
    const wr = st.get('wres', {}); M.list.forEach(q => { wr[q.id] = isEssay(q) ? isRight(q, M.wAns[q.id] || '', T[q.id]) : isRight(q, M.wAns[q.id]); }); st.set('wres', wr);
    const row = (lbl, got, w) => `<div class="rrow"><span>${lbl}</span><b>${r1(got)} / ${w}</b><div class="bar"><i style="width:${got / w * 100}%"></i></div></div>`;
    el.innerHTML = `<div class="page" style="position:absolute"><div class="report"><h1>모의고사 결과</h1><p style="color:var(--c-mut);margin:0">실제 시험 배점(이해 30 · 코드리뷰 30 · 코드 작성 10 · 서술형 30)으로 환산했어요.</p>
      <div class="big">${total}<span style="font-size:22px;color:var(--c-mut)"> / 100</span></div>
      <div class="rows">
        ${row(`이해 (객관식) — ${ok(und)} / ${und.length}문항`, u, 30)}
        ${row(`코드리뷰 (틀린 줄 · 빈칸) — ${ok(rev)} / ${rev.length}문항`, r, 30)}
        ${row(`코드 작성 — ${pts(cod)} / ${max(cod)}점`, c, 10)}
        ${row(`서술형 — ${pts(ess)} / ${max(ess)}점`, e, 30)}
      </div>
      <div class="qact"><button class="btn pri" data-r="review">답 맞춰 보기</button><button class="btn" data-r="home">홈으로</button></div></div></div>`;
    el.onchange = null; el.oninput = null; el.onkeydown = null;
    el.onclick = ev => { const b = ev.target.closest('[data-r]'); if (!b) return; if (b.dataset.r === 'home') L.home(); else { S = { mode: 'practice', list: M.list, i: 0, ans: M.wAns, checked: Object.fromEntries(M.list.map(q => [q.id, true])), ticks: Object.assign({}, T), filter: Object.assign({ ch: '', type: '', only: '', area: '' }, st.get('wfilter', {})) }; renderCBT(); } };
  }

  L.boot = function () { L.home(); };
})();
