/* util.js — 공용 도구: 글자 이스케이프, 브라우저 저장, 페이지 안 대화상자 */
(function () {
  'use strict';
  const L = window.RL = window.RL || {};
  L.esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  L.store = {
    get(k, d) { try { const v = localStorage.getItem('reactlab.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('reactlab.' + k, JSON.stringify(v)); } catch (e) { } },
    del(k) { try { localStorage.removeItem('reactlab.' + k); } catch (e) { } },
  };
  // confirm/prompt 대신 쓰는 대화상자. buttons: [{k, label, pri}] → Promise<{k}>
  L.dialog = function (o) {
    return new Promise(res => {
      const w = document.createElement('div'); w.className = 'dlg-back';
      const btns = o.buttons || [{ k: 'cancel', label: '취소' }, { k: 'ok', label: o.ok || '확인', pri: true }];
      w.innerHTML = `<div class="dlg" role="dialog" aria-modal="true" aria-labelledby="dlg-t"><div class="dlg-t" id="dlg-t">${L.esc(o.title || '')}</div>${o.msg ? `<div class="dlg-m">${L.esc(o.msg).replace(/\n/g, '<br>')}</div>` : ''}<div class="dlg-b">${btns.map(b => `<button class="dlg-btn${b.pri ? ' pri' : ''}" data-k="${b.k}">${L.esc(b.label)}</button>`).join('')}</div></div>`;
      document.body.appendChild(w);
      const pri = w.querySelector('.dlg-btn.pri') || w.querySelector('.dlg-btn');
      setTimeout(() => pri.focus(), 0);
      const done = k => { w.remove(); res({ k }); };
      w.addEventListener('click', e => { const b = e.target.closest('[data-k]'); if (b) done(b.dataset.k); else if (e.target === w) done('cancel'); });
      w.addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); done('cancel'); } }, true);
    });
  };
  L.ask = async (title, msg, ok) => (await L.dialog({ title, msg, ok })).k === 'ok';
})();
