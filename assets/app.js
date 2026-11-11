/* Dispensing Academy - in-browser progress, checks, re-tests, completion codes, price-it. No network calls. */
(function () {
  'use strict';
  var D = window.DA || {}, KEY = 'da1';
  function load() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } }
  function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} }
  var S = load(); S.done = S.done || {}; S.re = S.re || {}; S.qs = S.qs || {}; S.floor = S.floor || {}; S.fc = S.fc || {};
  function say(t) { var r = document.getElementById('sr'); if (!r) { r = document.createElement('div'); r.id = 'sr'; r.className = 'sr'; r.setAttribute('aria-live', 'polite'); r.setAttribute('role', 'status'); document.body.appendChild(r); } r.textContent = ''; setTimeout(function () { r.textContent = t; }, 60); }
  function strip(t) { var d = document.createElement('div'); d.innerHTML = t; return d.textContent; }
  function $(sel, el) { return (el || document).querySelector(sel); }
  function h(tag, attrs, html) { var e = document.createElement(tag); for (var k in (attrs || {})) e.setAttribute(k, attrs[k]); if (html != null) e.innerHTML = html; return e; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  var DAY = 864e5;
  // ---- completion codes: ID-DDMM-SCORE-CC (CC = checksum the coach can verify on the check-in page)
  function sum(str) { var x = 7; for (var i = 0; i < str.length; i++) x = (x * 31 + str.charCodeAt(i)) % 1679616; return x; }
  function cc(body) { var n = sum('TEG-DA|' + body) % 1296; var a = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ'; return a[Math.floor(n / 36) % 34] + a[n % 34]; }
  function makeCode(id, pct) { var d = new Date(); var dd = ('0' + d.getDate()).slice(-2) + ('0' + (d.getMonth() + 1)).slice(-2); var body = id.replace(/-/g, '').toUpperCase() + '-' + dd + '-' + pct; return body + '-' + cc(body); }
  function checkCode(code) { var m = /^([A-Z0-9]+)-(\d{4})-(\d{1,3})-([A-Z0-9]{2})$/.exec(code.trim().toUpperCase()); if (!m) return null; var body = m[1] + '-' + m[2] + '-' + m[3]; return cc(body) === m[4] ? { id: m[1], date: m[2].slice(0, 2) + '/' + m[2].slice(2), pct: +m[3] } : false; }
  // ---- quiz engine (checks, level tests, re-tests, cases)
  function quiz(root, qs, opts) {
    var i = 0, right = 0, marks = [];
    function dots() { var d = h('div', { class: 'dots' }); qs.forEach(function (_, k) { d.appendChild(h('i', { class: k < marks.length ? (marks[k] ? 'r' : 'w') : (k === i ? 'c' : '') })); }); return d; }
    function show() {
      root.innerHTML = '';
      if (i >= qs.length) return finish();
      var q = qs[i], box = h('div', { class: 'q' });
      box.appendChild(dots()); box.appendChild(h('p', { class: 'muted small' }, 'Question ' + (i + 1) + ' of ' + qs.length));
      box.appendChild(h('p', { class: 'stem' }, esc(q.stem)));
      var order = q.type === 'order';
      var opts2 = q.options.map(function (o, k) { return { o: o, k: k }; });
      if (!order && q.type !== 'tf') opts2 = shuffle(opts2);
      if (order) return orderQ(box, q);
      opts2.forEach(function (x) {
        var b = h('button', { class: 'opt', type: 'button' }, esc(x.o));
        b.onclick = function () {
          if (opts.noConf) return answer(box, x.k === q.answer, b, q);
          [].forEach.call(box.querySelectorAll('.opt'), function (o) { o.disabled = true; }); b.classList.add('picked');
          var cf = h('div', { class: 'conf' }, '<p class="small muted">How sure were you?</p>');
          [['sure', 'Sure'], ['unsure', 'Unsure'], ['guess', 'Guess']].forEach(function (c2) { var cb = h('button', { class: 'btn ghost', type: 'button' }, c2[1]); cb.onclick = function () { cf.parentNode.removeChild(cf); answer(box, x.k === q.answer, b, q, false, c2[0]); }; cf.appendChild(cb); });
          box.appendChild(cf); cf.querySelector('button').focus();
        };
        b.dataset.k = x.k; box.appendChild(b);
      });
      root.appendChild(box);
    }
    function orderQ(box, q) {
      var picked = [], pool = shuffle(q.options.map(function (o, k) { return { o: o, k: k }; }));
      box.appendChild(h('p', { class: 'small muted' }, 'Tap the steps in the right order.'));
      var list = h('ol'); box.appendChild(list);
      pool.forEach(function (x) {
        var b = h('button', { class: 'opt', type: 'button' }, esc(x.o));
        b.onclick = function () { b.disabled = true; picked.push(x.k); list.appendChild(h('li', {}, esc(x.o)));
          if (picked.length === q.options.length) { var ok = picked.every(function (v, n) { return v === n; }); answer(box, ok, null, q, true); } };
        box.appendChild(b);
      });
      root.appendChild(box);
    }
    function answer(box, ok, btn, q, isOrder, conf) {
      [].forEach.call(box.querySelectorAll('.opt'), function (b) { b.disabled = true; if (!isOrder && +b.dataset.k === q.answer) b.classList.add('right'); });
      if (btn && !ok) btn.classList.add('wrong');
      if (ok) right++; marks.push(ok);
      if (q.id && page !== 'case') { S.qs[q.id] = { ok: ok, conf: conf || '', at: Date.now() }; save(S); }
      var cnote = ok && conf === 'guess' ? ' You guessed, so it will come back in your daily review.' : (!ok && conf === 'sure' ? ' You were sure, so this one is worth a second look.' : '');
      var fb = h('div', { class: 'fb' }, '<strong>' + (ok ? 'Right.' : 'Not quite.') + '</strong>' + (!ok && btn ? ' You chose: ' + esc(btn.textContent) + '.' : '') + ' ' + esc(q.feedback || '') + (cnote ? '<br><em>' + esc(cnote) + '</em>' : '') +
        (isOrder && !ok ? '<br>Right order: ' + q.options.map(esc).join(' → ') : '') +
        (q.quote ? '<blockquote>From the lesson: ' + esc(q.quote) + '</blockquote>' : ''));
      box.appendChild(fb); say(strip(fb.innerHTML));
      var nx = h('button', { class: 'btn', type: 'button' }, i + 1 < qs.length ? 'Next question' : 'See my result');
      nx.onclick = function () { i++; show(); window.scrollTo(0, root.offsetTop - 70); };
      box.appendChild(h('div', { class: 'actions' })).appendChild(nx); nx.focus();
    }
    function finish() {
      var pct = Math.round(100 * right / qs.length), pass = opts.pass ? pct >= opts.pass * 100 : true;
      var box = h('div', { class: 'q' }); box.appendChild(dots());
      box.appendChild(h('h2', {}, right + ' of ' + qs.length + ' (' + pct + '%)')); say(right + ' of ' + qs.length + ' right');
      if (opts.onDone && !opts.practice) opts.onDone(pct, pass, box);
      var lvl = opts.level, acts = h('div', { class: 'actions' });
      if (!pass) {
        box.appendChild(h('p', {}, 'The pass mark is ' + (opts.pass === 0.75 ? '3 of 4' : Math.round(opts.pass * 100) + '%') + '. Nearly there: the feedback after each question showed the lesson line for the ones you missed. Have another go when ready; you get a fresh set of questions.'));
        var missed = qs.filter(function (_, k) { return !marks[k]; });
        if (missed.length && page !== 'case') { var pm = h('button', { class: 'btn', type: 'button' }, 'Practise the ' + (missed.length > 1 ? missed.length + ' I missed' : 'one I missed')); pm.onclick = function () { root.innerHTML = '<p class="small muted">Practice round: no score and no code. Take the full check again when ready.</p>'; quiz(root, missed, { pass: 0, level: lvl, practice: true }); }; acts.appendChild(pm); }
        var again = h('button', { class: missed.length ? 'btn ghost' : 'btn', type: 'button' }, 'Take the check again'); again.onclick = function () { location.href = location.pathname; }; acts.appendChild(again);
        if (page === 'check') acts.appendChild(h('a', { class: 'btn ghost', href: '../lessons/' + D.id + '.html' }, 'Read the lesson again'));
      } else if (opts.practice) {
        acts.appendChild(h('a', { class: 'btn', href: location.pathname }, 'Take the full check again'));
      } else if (page === 'check' || page === 'test') {
        var cd = box.querySelector('.code');
        if (cd) { var cp = h('button', { class: 'btn ghost', type: 'button' }, 'Copy code'); cp.onclick = function () { try { navigator.clipboard.writeText(cd.textContent); cp.textContent = 'Copied'; } catch (e) {} }; acts.appendChild(cp); }
        var nx2 = page === 'check' ? nextLesson(D.id) : null, L4 = D.lessons || {};
        if (nx2) acts.appendChild(h('a', { class: 'btn', href: '../lessons/' + nx2 + '.html' }, 'Next lesson: ' + esc(L4[nx2].title)));
        if (page === 'test' && /^T\d$/.test(D.id)) acts.appendChild(h('a', { class: 'btn', href: 'certificate.html?l=' + D.id[1] }, 'Your Level ' + D.id[1] + ' slip for your coach'));
        if (lvl != null) { acts.appendChild(h('a', { class: 'btn ghost', href: (page === 'check' ? '../' : '') + 'level-' + lvl + '.html' }, 'Back to Level ' + lvl)); if (page === 'check') acts.appendChild(h('a', { class: 'btn ghost', href: '../test-level-' + lvl + '.html' }, 'Level ' + lvl + ' test')); }
      }
      if (acts.children.length) box.appendChild(acts);
      root.appendChild(box);
    }
    show();
  }
  function nextLesson(after) {
    var L = D.lessons || {}, ks = Object.keys(L), i = after ? ks.indexOf(after) : -1;
    for (var j = i + 1; j < ks.length; j++) if (L[ks[j]].open && !S.done[ks[j]]) return ks[j];
    for (var k = 0; k < ks.length; k++) if (L[ks[k]].open && !S.done[ks[k]]) return ks[k];
    return null;
  }
  function passed(id, pct, box) {
    var code = makeCode(id, pct), now = Date.now();
    var meta = (D.lessons || {})[id] || {};
    S.done[id] = { pct: pct, code: code, at: now, ver: meta.ver || '' };
    if (!S.re[id] && meta.title) S.re[id] = { base: now, done: [] };
    S.last = id; save(S);
    box.appendChild(h('p', { class: 'yay' }, (pct === 100 ? 'Perfect score! ' : 'Nice work! ') + 'You passed. Your completion code for your coach:'));
    box.appendChild(h('div', { class: 'code' }, code));
    box.appendChild(h('p', { class: 'small muted' }, 'It is saved in My progress. It comes back in your daily review after 1, 7 and 30 days.'));
  }
  // ---- re-tests due: offsets 1, 7, 30 days after passing
  var OFF = [1, 7, 30];
  function due() {
    var out = [], now = Date.now();
    Object.keys(S.re).forEach(function (id) { var r = S.re[id], lm = (D.lessons || {})[id]; if (!lm || !lm.open) return; OFF.forEach(function (d, n) { if (r.done.indexOf(n) < 0 && now >= r.base + d * DAY) out.push({ id: id, n: n }); }); });
    return out;
  }
  // ---- pages
  var page = D.page;
  if (page === 'check' || page === 'test' || page === 'case') {
    var n = D.n || D.qs.length, qs = page === 'test' ? shuffle(D.qs).slice(0, n) : page === 'check' ? shuffle(D.qs).slice(0, 4) : D.qs.slice();
    var TL = /^T(\d)$/.exec(D.id || ''); if (page === 'test' && TL) { var LL = D.lessons || {}, need0 = Object.keys(LL).filter(function (k) { return LL[k].level === +TL[1] && LL[k].open; }), left0 = need0.filter(function (k) { return !S.done[k]; }).length; if (left0) { $('#quiz').innerHTML = '<div class="banner lock"><strong>Not open yet.</strong> The Level ' + TL[1] + ' test opens when you have passed all ' + need0.length + ' open lessons at this level (' + left0 + ' to go). <a href="level-' + TL[1] + '.html">Back to Level ' + TL[1] + '</a></div>'; qs = null; } }
    var rq = /[?&]retest=(\d)/.exec(location.search);
    if (page === 'check' && rq) { qs = shuffle(D.qs).slice(0, 2); }
    if (qs === null) {} else if (!qs.length) { $('#quiz').innerHTML = '<div class="banner lock">No questions are open yet at this level: the lessons are awaiting registrant review.</div>'; }
    else quiz($('#quiz') || $('#case'), qs, { pass: D.pass_, level: (D.lessons && D.lessons[D.id] ? D.lessons[D.id].level : (/^T(\d)$/.test(D.id) ? +D.id[1] : (D.id === 'ESC' ? 0 : null))), onDone: function (pct, pass, box) {
      if (page === 'case') return;
      if (rq) { if (S.re[D.id] && S.re[D.id].done.indexOf(+rq[1]) < 0) S.re[D.id].done.push(+rq[1]); save(S); box.appendChild(h('p', {}, 'Re-test recorded. ' + (pass ? 'Well remembered.' : 'Worth re-reading the lesson.'))); return; }
      if (pass) passed(D.id, pct, box);
    } });
  }
  if (page === 'home' || page === 'level') {
    var L = D.lessons || {};
    for (var lv = 0; lv < 4; lv++) {
      var ids = Object.keys(L).filter(function (k) { return L[k].level === lv && L[k].visible; });
      var dn = ids.filter(function (k) { return S.done[k]; }).length, pct = ids.length ? Math.round(100 * dn / ids.length) : 0;
      var r = $('[data-ring="' + lv + '"]'); if (r) { r.style.setProperty('--p', pct); r.setAttribute('data-pct', pct + '%'); }
      var c = $('[data-done="' + lv + '"]'); if (c) c.textContent = dn;
    }
    [].forEach.call(document.querySelectorAll('[data-leveltest]'), function (a) {
      var lv2 = +a.dataset.leveltest, need = Object.keys(L).filter(function (k) { return L[k].level === lv2 && L[k].open; }), left = need.filter(function (k) { return !S.done[k]; }).length;
      if (left) { a.classList.add('ghost'); a.removeAttribute('href'); a.setAttribute('aria-disabled', 'true'); a.textContent = 'Level ' + lv2 + ' test opens when you have passed all ' + need.length + ' open lessons (' + left + ' to go)'; }
    });
    [].forEach.call(document.querySelectorAll('[data-done-for]'), function (e) { var k = e.dataset.doneFor; if (S.done[k] && L[k] && S.done[k].ver && L[k].ver && S.done[k].ver !== L[k].ver) e.innerHTML = '<span class="chip warn">Updated: take the check again</span>'; else if (S.done[k]) e.innerHTML = '<span class="chip ok">Done ✓</span>'; else if (L[k] && L[k].open && L[k].status === 'published') e.innerHTML = '<span class="chip new">New</span>'; });
    [].forEach.call(document.querySelectorAll('[data-levelstate]'), function (e) { var lv3 = +e.dataset.levelstate, open3 = lv3 === 0 || (!!S.done['T' + (lv3 - 1)] && (lv3 !== 1 || !D.escOpen || !!S.done.ESC));
      e.innerHTML = open3 ? '<span class="chip ok">Open</span>' : '<span class="chip lock">Locked</span> <span class="muted">Opens when you pass the Level ' + (lv3 - 1) + ' test</span>';
      var card = e.closest('.card'); if (card && !open3) card.classList.add('locked'); });
    var lb = $('#levellock'); if (lb && D.level > 0 && !S.done['T' + (D.level - 1)]) lb.innerHTML = '<div class="banner lock"><strong>🔒 Locked for now.</strong> This level opens when you pass the Level ' + (D.level - 1) + ' test and your coach signs the Level ' + (D.level - 1) + ' gate. You can look ahead, but start with <a href="level-' + (D.level - 1) + '.html">Level ' + (D.level - 1) + '</a>.</div>';
    if (page === 'home') {
      var last = S.last && L[S.last];
      var nxt = last ? nextLesson(S.last) : null;
      if (last && nxt) $('#continue').innerHTML = '<a class="card" href="lessons/' + esc(nxt) + '.html"><p class="eyebrow">Up next</p><h3>' + esc(L[nxt].title) + '</h3><p class="small muted">Level ' + L[nxt].level + ' · last passed: ' + esc(last.title) + '</p></a>';
      else if (last) $('#continue').innerHTML = '<div class="card"><p class="eyebrow">All open lessons passed</p><h3>Well done.</h3><p class="small muted">Keep up your re-tests and ask your coach about the next level.</p></div>';
      else $('#continue').innerHTML = '<a class="card" href="lessons/l0-01.html"><p class="eyebrow">Start here</p><h3>Welcome: how the Dispensing Academy works</h3><p class="small muted">Level 0 · 6 minutes</p></a>';
      var du = due();
      var anyP = Object.keys(S.done).some(function (k) { return L[k]; }), tdy = new Date().toDateString(), yd = new Date(Date.now() - DAY).toDateString(), sk = S.streak && (S.streak.last === tdy || S.streak.last === yd) ? S.streak.n : 0, dToday = S.streak && S.streak.last === tdy;
      if (anyP) $('#retests').innerHTML = '<a class="card review" href="review.html"><p class="eyebrow">Daily review · 5 questions</p><h3>' + (dToday ? 'Done for today ✓' : du.length ? du.length + ' re-test' + (du.length > 1 ? 's' : '') + ' due' : 'Keep it fresh') + '</h3><p class="small muted">' + (sk ? 'Streak: ' + sk + ' day' + (sk > 1 ? 's' : '') : 'Start a streak today') + '</p></a>';
    }
  }
  if (page === 'progress') {
    var L2 = D.lessons || {}, ids2 = Object.keys(S.done), out = '';
    if (!ids2.length) out = '<div class="banner lock">Nothing passed yet in this browser. Start with <a href="lessons/l0-01.html">Level 0, lesson 1</a>.</div>';
    else {
      var TN = { T0: 'Level 0 test', T1: 'Level 1 test', T2: 'Level 2 test', T3: 'Level 3 test', ESC: 'Escalate-or-stop set' };
      out = '<ul class="codes">';
      ids2.sort().forEach(function (k) { var d = S.done[k], t = (L2[k] || {}).title || TN[k] || k; out += '<li><code class="code-line">' + esc(d.code) + '</code><span class="small muted">' + esc(t) + ' · ' + (+d.pct || 0) + '% · ' + new Date(d.at).toLocaleDateString('en-GB') + '</span></li>'; });
      var du2 = due(); out += '</ul>' + (du2.length ? '<p class="small"><strong>Re-tests due: ' + du2.length + '.</strong> <a href="review.html">Do your daily review</a></p>' : '') + '<div class="card no-print"><p class="eyebrow">For your coach</p><p id="statusline" class="small"></p><button class="btn ghost" type="button" id="copystatus">Copy my status</button></div><div class="actions no-print"><button class="btn ghost" type="button" id="copyall">Copy all codes</button></div><div class="actions no-print"><button class="btn ghost" type="button" onclick="window.print()">Print my progress slip</button><button class="btn ghost" type="button" id="wipe">Clear my progress on this device</button></div>';
      out += '<p class="small muted">Write your name on the printed slip: it is never stored here.</p>';
    }
    out += '<div class="card no-print"><p class="eyebrow">New phone or browser?</p><p class="small">Your progress lives only in this browser. Copy your save code and keep it (e.g. email it to yourself). Paste it on a new device to carry on.</p><div class="actions"><button class="btn ghost" type="button" id="savecode">Copy my save code</button></div><label class="small">Paste a save code <input id="restorein" autocomplete="off" placeholder="DA1...."></label><p id="restoreout" class="small"></p></div>';
    $('#progress').innerHTML = out;
    function b64e(t) { return btoa(unescape(encodeURIComponent(t))); } function b64d(t) { return decodeURIComponent(escape(atob(t))); }
    var sv = $('#savecode'); if (sv) sv.onclick = function () { var c = 'DA1' + b64e(JSON.stringify(S)); try { navigator.clipboard.writeText(c); sv.textContent = 'Copied'; } catch (e) { $('#restorein').value = c; $('#restorein').select(); } };
    var ri = $('#restorein'); if (ri) ri.oninput = function () { var v = ri.value.trim(), o = $('#restoreout'); if (!v) { o.innerHTML = ''; return; } try { if (v.slice(0, 3) !== 'DA1') throw 0; var N = JSON.parse(b64d(v.slice(3))); if (!N || typeof N.done !== 'object') throw 0; var cnt = Object.keys(N.done).filter(function (k) { var d = N.done[k]; return d && checkCode(d.code); }).length; o.innerHTML = '<button class="btn" type="button" id="dorestore">Restore ' + cnt + ' passes</button>'; $('#dorestore').onclick = function () { var M = { done: {}, re: {}, qs: {}, floor: {}, fc: {}, last: S.last || N.last, streak: S.streak }; Object.keys(N.done).forEach(function (k) { var d = N.done[k]; if (d && checkCode(d.code)) M.done[k] = d; }); Object.keys(S.done).forEach(function (k) { M.done[k] = M.done[k] || S.done[k]; }); ['re', 'qs', 'floor', 'fc'].forEach(function (key) { var a = (N[key] && typeof N[key] === 'object') ? N[key] : {}, b = S[key] || {}; Object.keys(a).forEach(function (k) { M[key][k] = a[k]; }); Object.keys(b).forEach(function (k) { M[key][k] = b[k]; }); }); Object.keys(M.re).forEach(function (k) { var r = M.re[k]; if (!r || typeof r.base !== 'number' || !Array.isArray(r.done)) delete M.re[k]; }); var ns = N.streak; if (ns && typeof ns.n === 'number' && (!M.streak || new Date(ns.last) > new Date(M.streak.last))) M.streak = { n: ns.n, last: String(ns.last) }; save(M); location.reload(); }; } catch (e) { o.innerHTML = '<span class="chip bad">That is not a save code</span>'; } };
    var stl = $('#statusline'); if (stl) { var LL2 = D.lessons || {}, dn2 = Object.keys(S.done).filter(function (k) { return LL2[k]; }), lastAt = Math.max.apply(null, [0].concat(Object.keys(S.done).map(function (k) { return S.done[k].at || 0; }))), lvls = [0, 1, 2, 3].map(function (v) { var all = Object.keys(LL2).filter(function (k) { return LL2[k].level === v && LL2[k].open; }); return 'L' + v + ' ' + all.filter(function (k) { return S.done[k]; }).length + '/' + all.length; }).join(', ');
      var stxt = 'Lessons passed: ' + dn2.length + ' (' + lvls + '). Tests: ' + (['T0', 'T1', 'T2', 'T3', 'ESC'].filter(function (k) { return S.done[k]; }).join(' ') || 'none') + '. Last active: ' + (lastAt ? new Date(lastAt).toLocaleDateString('en-GB') : 'never') + '. Re-tests due: ' + due().length + '. Floor tasks done: ' + Object.keys(S.floor).length + '. Review streak: ' + ((S.streak && S.streak.n) || 0) + '.';
      stl.textContent = stxt; var cs = $('#copystatus'); if (cs) cs.onclick = function () { try { navigator.clipboard.writeText(stxt); cs.textContent = 'Copied'; } catch (e) {} }; }
    var ca = $('#copyall'); if (ca) ca.onclick = function () { try { navigator.clipboard.writeText(ids2.sort().map(function (k) { return S.done[k].code; }).join('\n')); ca.textContent = 'Copied'; } catch (e) {} };
    var wp = $('#wipe'); if (wp) wp.onclick = function () { if (confirm('Clear all progress saved on this device?')) { localStorage.removeItem(KEY); location.reload(); } };
  }
  if (page === 'checkin') {
    var ci = $('#codein'), co = $('#codeout');
    ci.oninput = function () { var r = checkCode(ci.value); var LK = {}; Object.keys(D.lessons || {}).forEach(function (k) { if (D.lessons[k].open) LK[k.replace(/-/g, '').toUpperCase()] = 1; }); ['T0', 'T1', 'T2', 'T3', 'ESC'].forEach(function (k) { LK[k] = 1; }); if (r && !LK[r.id]) r = false; co.innerHTML = !ci.value ? '' : r === null ? 'Format: e.g. B07-1111-80-K4' : r === false ? '<span class="chip bad">Not a genuine code</span>' : '<span class="chip ok">Genuine</span> ' + esc(r.id) + ', ' + r.pct + '%, passed on ' + r.date; };
  }
  if (page === 'price') {
    var KINDS = [['easy', 'Starter: list shown'], ['steps', 'Quote step by step'], ['all', 'Random'], ['spot', 'Find the error'], ['lens-list', 'Lens pair'], ['lens-gold', 'Gold lens'], ['frame-gold', 'Gold frame'], ['quote', 'Full quote'], ['quote-gold', 'Gold quote'], ['upgrade', 'Upgrade difference'], ['quote-extra', 'Quote + tint']];
    var mode = 'easy', streak = 0, m = $('#modes');
    KINDS.forEach(function (k) { var b = h('button', { type: 'button', class: k[0] === mode ? 'on' : '' }, k[1]); b.onclick = function () { mode = k[0]; [].forEach.call(m.children, function (c) { c.className = ''; }); b.className = 'on'; ask(); }; m.appendChild(b); });
    function pence(v) { v = String(v).replace(/[£,\s]/g, ''); if (!/^\d+(\.\d{1,2})?$/.test(v)) return null; return Math.round(parseFloat(v) * 100); }
    function ask() {
      if (mode === 'steps') return stepQuote();
      var pool = D.drills.filter(function (d) { return mode === 'all' || d.kind === mode || (mode === 'easy' && d.kind === 'lens-list' && d.answer_pence !== null); }), d = pool[Math.floor(Math.random() * pool.length)], root = $('#pricer');
      if (d.kind === 'spot') {
        root.innerHTML = '<div class="q"><p class="muted small">Streak: ' + streak + '</p><p class="stem">' + esc(d.stem).replace(/\n/g, '<br>') + '</p><div id="sopts"></div><div id="pf"></div></div>';
        d.options.forEach(function (o, k) { var b = h('button', { class: 'opt', type: 'button' }, esc(o)); b.onclick = function () {
          var ok = k === d.answer_index; streak = ok ? streak + 1 : 0;
          [].forEach.call(root.querySelectorAll('.opt'), function (x, j) { x.disabled = true; if (j === d.answer_index) x.classList.add('right'); }); if (!ok) b.classList.add('wrong');
          root.querySelector('#pf').innerHTML = '<div class="fb"><strong>' + (ok ? 'Right!' : 'Not quite. The answer is: ' + esc(d.answer) + '.') + '</strong> ' + esc(d.why || '') + '</div><div class="actions"><button class="btn" type="button" id="nx">Next</button></div>';
          say(strip(root.querySelector('#pf .fb').innerHTML)); root.querySelector('#nx').onclick = ask; root.querySelector('#nx').focus(); }; root.querySelector('#sopts').appendChild(b); });
        return;
      }
      var easyRow = mode === 'easy' && D.rows ? D.rows[d.params.key + '|' + d.params.kind] : null;
      root.innerHTML = '<div class="q"><p class="muted small">Streak: ' + streak + '</p><p class="stem">' + esc(d.stem) + '</p>' + (easyRow ? '<table class="tbl plist"><caption class="small muted">From the price list: ' + esc(easyRow.name) + ', ' + (d.params.kind === 'trans' ? 'Transitions' : 'clear') + ', price per pair</caption>' + easyRow.p.map(function (r) { return '<tr><th>' + esc(r[0]) + '</th><td>' + esc(r[1]) + '</td></tr>'; }).join('') + '</table>' : '') + '<form class="money" autocomplete="off"><span>£</span><input inputmode="decimal" aria-label="Price in pounds" placeholder="0.00"><button class="btn" type="submit">Check</button></form>' +
        (d.kind === 'lens-list' ? '<button class="opt" type="button" id="na">Not available</button>' : '') + '<div id="pf"></div></div>';
      var f = root.querySelector('form'), inp = root.querySelector('input'); inp.focus();
      function mark(gotNA) {
        var p = pence(inp.value), ok = gotNA ? d.answer_pence === null : (p !== null && p === d.answer_pence);
        streak = ok ? streak + 1 : 0;
        var hint = '';
        if (!ok) { var pr = d.params, t = pr.to ? pr.to : pr; hint = '<br>Where to find it: the ' + (t.key ? ((D.rows && D.rows[t.key + '|' + t.kind]) ? D.rows[t.key + '|' + t.kind].name : t.key.replace(/-/g, ' ')) + ' row, ' + t.band + ' column, ' + (t.kind === 'trans' ? 'Transitions' : 'clear') : 'frame list') + (pr.col === 'gold' || d.kind === 'frame-gold' ? ', Gold member figures' : '') + '. Lens prices are per pair.'; }
        root.querySelector('#pf').innerHTML = '<div class="fb"><strong>' + (ok ? 'Right! ' : 'Not quite. The answer is ') + esc(d.answer) + '.</strong>' + hint + '</div><div class="actions"><button class="btn" type="button" id="nx">Next</button></div>';
        [].forEach.call(root.querySelectorAll('button:not(#nx), input'), function (x) { x.disabled = true; });
        root.querySelector('#nx').onclick = ask; root.querySelector('#nx').focus(); say(strip(root.querySelector('#pf .fb').innerHTML));
      }
      f.onsubmit = function (e) { e.preventDefault(); if (pence(inp.value) === null) { inp.focus(); return; } mark(false); };
      var na = root.querySelector('#na'); if (na) na.onclick = function () { mark(true); };
    }
    // faded quoting (panel 10 Nov 2026): round 0 fully worked, then the learner takes over one more step each round
    function stepQuote() {
      var root = $('#pricer'), lv = Math.min(S.fade || 0, 3), q = D.drills.filter(function (d) { return d.kind === 'quote'; }), d, row, lensP, cell;
      for (var tries = 0; tries < 50; tries++) { d = q[Math.floor(Math.random() * q.length)]; row = D.rows && D.rows[d.params.key + '|' + d.params.kind]; cell = row && row.p.filter(function (r) { return r[3] === d.params.band; })[0]; if (cell && cell[2] != null && cell[2] + d.params.frame_list === d.answer_pence) break; cell = null; }
      if (!cell) { root.innerHTML = '<div class="banner lock">No quote to practise right now.</div>'; return; }
      lensP = cell[2]; var fr = d.params.frame_list, tot = fr + lensP;
      function m(p) { return '£' + (p % 100 ? (p / 100).toFixed(2) : p / 100); }
      var STEPS = ['Round 1 of 4: watch it done', 'Round 2 of 4: you add it up', 'Round 3 of 4: you find the lens price, then add up', 'Round 4 of 4: the whole quote, list hidden'];
      var tbl = '<table class="tbl plist"><caption class="small muted">From the price list: ' + esc(row.name) + ', ' + (d.params.kind === 'trans' ? 'Transitions' : 'clear') + ', price per pair</caption>' + row.p.map(function (r) { return '<tr' + (lv === 0 && r[3] === d.params.band ? ' class="hl"' : '') + '><th>' + esc(r[0]) + '</th><td>' + esc(r[1]) + '</td></tr>'; }).join('') + '</table>';
      var hd = '<div class="q"><p class="eyebrow">' + STEPS[lv] + '</p><p class="stem">' + esc(d.stem) + '</p>';
      if (lv === 0) {
        root.innerHTML = hd + tbl + '<ol class="small"><li>Frame from the frame list: <strong>' + m(fr) + '</strong>.</li><li>Lenses: find the row, then the ' + esc(cell[0]) + ' column: <strong>' + m(lensP) + '</strong> a pair.</li><li>Add them: ' + m(fr) + ' + ' + m(lensP) + ' = <strong>' + m(tot) + '</strong>.</li></ol><div class="actions"><button class="btn" type="button" id="sgo">I follow it: my turn</button></div></div>';
        $('#sgo').onclick = function () { S.fade = 1; save(S); stepQuote(); }; return;
      }
      var ask1 = lv >= 2, showList = lv < 3;
      root.innerHTML = hd + (showList ? tbl : '') + '<p class="small">Frame: <strong>' + m(fr) + '</strong></p>' + (ask1 ? '<label class="small">Lens price for the pair <form class="money" autocomplete="off" id="f1"><span>£</span><input inputmode="decimal" placeholder="0.00"></form></label>' : '<p class="small">Lenses: <strong>' + m(lensP) + '</strong></p>') +
        '<label class="small">Total <form class="money" autocomplete="off" id="f2"><span>£</span><input inputmode="decimal" placeholder="0.00"><button class="btn" type="submit">Check</button></form></label><div id="pf"></div></div>';
      var f2 = $('#f2'), i1 = ask1 ? $('#f1 input') : null, i2 = f2.querySelector('input'); (i1 || i2).focus();
      if (ask1) $('#f1').onsubmit = function (e) { e.preventDefault(); i2.focus(); };
      f2.onsubmit = function (e) { e.preventDefault();
        var a1 = ask1 ? pence(i1.value) : lensP, a2 = pence(i2.value); if (a2 === null || (ask1 && a1 === null)) return;
        var ok1 = a1 === lensP, ok2 = a2 === tot, ok = ok1 && ok2;
        if (ok) S.fade = Math.min(lv + 1, 3); save(S);
        var msg = ok ? 'Right! ' + m(fr) + ' + ' + m(lensP) + ' = ' + m(tot) + '.' + (lv < 3 ? ' Next round: you take over one more step.' : ' You can quote on your own. Try Full quote for more.') :
          'Not quite. ' + (!ok1 ? 'The lens price is ' + m(lensP) + ' (' + esc(row.name) + ' row, ' + esc(cell[0]) + ' column). ' : '') + 'The total is ' + m(fr) + ' + ' + m(lensP) + ' = ' + m(tot) + '. Have another go at this round.';
        root.querySelector('#pf').innerHTML = '<div class="fb"><strong>' + msg + '</strong></div><div class="actions"><button class="btn" type="button" id="nx">Next</button>' + (lv ? '<button class="btn ghost" type="button" id="srst">Start again from round 1</button>' : '') + '</div>';
        [].forEach.call(root.querySelectorAll('form input, form button'), function (x) { x.disabled = true; });
        say(strip(msg)); $('#nx').onclick = stepQuote; $('#nx').focus(); var sr2 = $('#srst'); if (sr2) sr2.onclick = function () { S.fade = 0; save(S); stepQuote(); };
      };
    }
    ask();
  }
  // ---- lesson page: pre-question, reading bar, floor task tick
  if (page === 'lesson') {
    var pq = $('#preq'), cand = (D.qs || []).filter(function (q) { return q.type === 'mcq' || q.type === 'tf'; });
    if (pq && cand.length && !S.done[D.id]) {
      var q0 = cand[Math.floor(Math.random() * cand.length)], o0 = q0.options.map(function (o, k) { return { o: o, k: k }; }); if (q0.type === 'mcq') o0 = shuffle(o0);
      pq.innerHTML = '<div class="card pre"><p class="eyebrow">Before you read: have a guess</p><p class="stem">' + esc(q0.stem) + '</p><div class="pre-opts"></div><p class="small muted">Guessing first helps it stick. No score.</p></div>';
      var po = pq.querySelector('.pre-opts');
      o0.forEach(function (x) { var b = h('button', { class: 'opt', type: 'button' }, esc(x.o)); b.dataset.k = x.k; b.onclick = function () {
        [].forEach.call(po.querySelectorAll('.opt'), function (c) { c.disabled = true; if (+c.dataset.k === q0.answer) c.classList.add('right'); }); if (x.k !== q0.answer) b.classList.add('wrong');
        var t = (x.k === q0.answer ? 'Good guess. ' : 'Not this time. ') + 'Read on to find out why.'; po.appendChild(h('p', { class: 'small' }, t)); say(t); }; po.appendChild(b); });
    }
    var rb = $('#readbar'); if (rb) { var upd = function () { var dh = document.documentElement, mx = dh.scrollHeight - dh.clientHeight; rb.style.width = (mx > 0 ? Math.min(100, 100 * (window.pageYOffset || dh.scrollTop) / mx) : 100) + '%'; }; window.addEventListener('scroll', upd, { passive: true }); upd(); }
    [].forEach.call(document.querySelectorAll('[data-floor]'), function (b) { var k = b.dataset.floor;
      function st() { b.textContent = S.floor[k] ? 'Done ✓ (tap to undo)' : 'Mark as done'; b.classList.toggle('on', !!S.floor[k]); } st();
      b.onclick = function () { if (S.floor[k]) delete S.floor[k]; else S.floor[k] = Date.now(); save(S); st(); say(S.floor[k] ? 'Floor task marked done' : 'Floor task unmarked'); }; });
  }
  // ---- flashcards
  if (page === 'flash') {
    var cards = shuffle(D.cards || []), fi = 0, fr = $('#fc');
    var showc = function () {
      var left = cards.filter(function (c) { return !S.fc[c.term]; });
      if (!left.length) { fr.innerHTML = '<div class="card"><h3>All ' + cards.length + ' cards known. Well done.</h3><button class="btn ghost" type="button" id="fcreset">Start again</button></div>'; $('#fcreset').onclick = function () { S.fc = {}; save(S); showc(); }; return; }
      var c = left[fi % left.length];
      fr.innerHTML = '<p class="small muted">' + (cards.length - left.length) + ' of ' + cards.length + ' known</p><button type="button" class="flash" aria-pressed="false"><span class="term">' + esc(c.term) + '</span><span class="means" hidden>' + esc(c.means) + '</span><span class="small muted hint">Tap to see what it means</span></button><div class="actions"><button class="btn" type="button" id="fknow">I know it</button><button class="btn ghost" type="button" id="fnext">Not yet: next card</button></div>';
      var fb2 = fr.querySelector('.flash');
      fb2.onclick = function () { var m2 = fb2.querySelector('.means'), on = m2.hidden; m2.hidden = !on; fb2.querySelector('.hint').hidden = on; fb2.classList.toggle('flipped', on); fb2.setAttribute('aria-pressed', on ? 'true' : 'false'); if (on) say(c.means); };
      $('#fknow').onclick = function () { S.fc[c.term] = 1; save(S); showc(); };
      $('#fnext').onclick = function () { fi++; showc(); };
    };
    showc();
  }
  // ---- branching cases
  if (page === 'branch') {
    var br = $('#branch'), path = [], N = D.nodes, VL = { good: ['ok', 'Good call'], ok: ['warn', 'OK, could be better'], poor: ['bad', 'Not the best'] };
    var node = function (id) {
      var nd = N[id], box = h('div', { class: 'q' });
      path.forEach(function (p) { var v = VL[p.v] || VL.ok; box.appendChild(h('div', { class: 'fb past' }, '<p class="small"><strong>You chose:</strong> ' + esc(p.label) + '</p><span class="chip ' + v[0] + '">' + v[1] + '</span> ' + esc(p.why))); });
      box.appendChild(h('p', { class: 'stem' }, esc(nd.text)));
      if (nd.end || !nd.choices.length) {
        var g = path.filter(function (p) { return p.v === 'good'; }).length;
        box.appendChild(h('p', { class: g === path.length ? 'yay' : 'small' }, g === path.length ? 'Every choice a good call. Well done.' : g + ' of ' + path.length + ' choices were good calls. Try again to find the best route.'));
        var ac = h('div', { class: 'actions' }), ag = h('button', { class: 'btn', type: 'button' }, 'Try again'); ag.onclick = function () { path = []; node(D.start); }; ac.appendChild(ag);
        ac.appendChild(h('a', { class: 'btn ghost', href: '../cases.html' }, 'More cases')); box.appendChild(ac);
        var md = $('#model'); if (md) md.hidden = false;
      } else shuffle(nd.choices).forEach(function (c) { var b = h('button', { class: 'opt', type: 'button' }, esc(c.label)); b.onclick = function () { path.push({ label: c.label, v: c.verdict, why: c.why }); node(c.next); say((VL[c.verdict] || VL.ok)[1] + '. ' + c.why); }; box.appendChild(b); });
      br.innerHTML = ''; br.appendChild(box); if (path.length) window.scrollTo(0, br.offsetTop - 70);
    };
    node(D.start);
  }
  // ---- daily review: 5 questions; due re-tests first, then missed or guessed, then the rest
  if (page === 'review') {
    var B = D.bank || {}, rv = $('#quiz'), pids = Object.keys(S.done).filter(function (k) { return B[k] && B[k].length; });
    if (!pids.length) rv.innerHTML = '<div class="banner lock">Pass your first lesson check, then your daily review starts here. <a href="index.html">Home</a></div>';
    else {
      var pick = [], used = {}, dueL = due().filter(function (x) { return B[x.id]; }), seenDue = {};
      var addq = function (q) { if (q && !used[q.id] && pick.length < 5) { used[q.id] = 1; pick.push(q); } };
      dueL.forEach(function (x) { if (!seenDue[x.id] && pick.length < 5) { var q1 = shuffle(B[x.id])[0]; seenDue[x.id] = { q: q1.id, n: x.n }; addq(q1); } else if (seenDue[x.id] && x.n < seenDue[x.id].n) seenDue[x.id].n = x.n; });
      var all = []; pids.forEach(function (k) { B[k].forEach(function (q) { all.push(q); }); });
      shuffle(all.filter(function (q) { var r = S.qs[q.id]; return r && (!r.ok || r.conf === 'guess' || r.conf === 'unsure'); })).forEach(addq);
      shuffle(all).forEach(addq);
      var nd2 = Object.keys(seenDue).length; $('#rvinfo').textContent = (nd2 ? nd2 + ' re-test' + (nd2 > 1 ? 's' : '') + ' included. ' : '') + 'From ' + pids.length + ' lesson' + (pids.length > 1 ? 's' : '') + ' you have passed.';
      var rvStart = Date.now();
      quiz(rv, pick, { pass: 0, onDone: function (pct, pass, box) {
        Object.keys(seenDue).forEach(function (k) { var sd = seenDue[k], rr = S.qs[sd.q]; if (rr && rr.ok && rr.at >= rvStart && S.re[k] && S.re[k].done.indexOf(sd.n) < 0) S.re[k].done.push(sd.n); });
        var tdy2 = new Date().toDateString(), yd2 = new Date(Date.now() - DAY).toDateString(); S.streak = S.streak || {};
        if (S.streak.last !== tdy2) { S.streak.n = S.streak.last === yd2 ? (S.streak.n || 0) + 1 : 1; S.streak.last = tdy2; } save(S);
        box.appendChild(h('p', { class: 'yay' }, 'Review done. Streak: ' + S.streak.n + ' day' + (S.streak.n > 1 ? 's' : '') + '.'));
        var ac2 = h('div', { class: 'actions' }); ac2.appendChild(h('a', { class: 'btn', href: 'index.html' }, 'Back to home')); box.appendChild(ac2);
      } });
    }
  }
  // ---- level slip (online part complete; the level itself is signed by a registrant)
  if (page === 'cert') {
    var lq = /[?&]l=(\d)/.exec(location.search), lv4 = lq ? +lq[1] : 0, dd = S.done['T' + lv4], ce = $('#cert');
    if (!dd) ce.innerHTML = '<h1>Level ' + lv4 + ' slip</h1><div class="banner lock">Pass the Level ' + lv4 + ' test first. <a href="level-' + lv4 + '.html">Back to Level ' + lv4 + '</a></div>';
    else ce.innerHTML = '<div class="certificate"><p class="eyebrow">The Eyecare Group · Dispensing Academy</p><h1>Level ' + lv4 + ': ' + esc((D.levels || {})[lv4] || '') + '</h1><p class="lead">Online part complete</p><p>Name: <span class="line-in"></span></p><p>Passed the Level ' + lv4 + ' test with ' + (+dd.pct || 0) + '% on ' + new Date(dd.at).toLocaleDateString('en-GB') + '.</p><p>Code for your coach: <code class="code-line">' + esc(dd.code) + '</code></p><p class="small">Next: your coach checks your passport and books your observed sign-off with a registrant. The level is complete when they sign it.</p></div><div class="actions no-print"><button class="btn" type="button" id="certprint">Print</button><a class="btn ghost" href="progress.html">My progress</a></div>';
    var cp2 = $('#certprint'); if (cp2) cp2.onclick = function () { window.print(); };
  }
})();
