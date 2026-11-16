/* Old World — aide-mémoire (PWA, non officiel). Vanilla JS, aucune dépendance. */
(function () {
  'use strict';

  const T = window.TOW;
  const KEY = 'towfr.v1';
  const SIDE = { me: 'Mon tour', opp: 'Tour adverse' };
  const UCATS = { lord: 'Seigneur', hero: 'Héros', core: 'Noyau', special: 'Spécial', rare: 'Rare', merc: 'Mercenaires', ally: 'Alliés' };
  const FLAGS = [
    ['general', 'Général', 'general'],
    ['bsb', 'Porte-étendard de bataille', 'battle-standard'],
    ['champion', 'Champion', 'champion'],
    ['standard', 'Porte-étendard', 'standard'],
    ['musician', 'Musicien', 'musician'],
  ];

  /* ------------------------------------------------------------------ utils */
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
  const num = (v) => { const n = parseInt(v, 10); return isNaN(n) ? 0 : n; };
  const officialUrl = (path) => T.BASE + path;

  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('on');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove('on'), 2200);
  }

  /* ------------------------------------------------------------------ state */
  function defaults() {
    return { lists: [], custom: [], notes: {}, game: { round: 1, side: 'me', phase: 0, iStart: true, listId: null } };
  }
  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) || 'null');
      const d = defaults();
      if (!s) return d;
      return Object.assign(d, s, { game: Object.assign(d.game, s.game || {}) });
    } catch (e) { return defaults(); }
  }
  let state = load();
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); }
    catch (e) { toast('Stockage local indisponible : modifications non sauvegardées'); }
  }
  const ui = { q: '', cat: '' };

  /* -------------------------------------------------- glossaire & mots-clés */
  let G = [], GI = {}, TERM = {}, RX = null, OUT = {};
  const stripParen = (s) => String(s || '').replace(/\s*\([^)]*\)\s*$/, '').trim();

  function rebuild() {
    G = T.G.concat(state.custom.map((c) => Object.assign({ custom: true }, c)));
    GI = {}; G.forEach((e) => { GI[e.id] = e; });
    TERM = {};
    G.forEach((e) => {
      [e.fr, stripParen(e.fr), e.en, stripParen(e.en)].concat(e.aliases || []).forEach((n) => {
        n = (n || '').trim();
        if (n.length < 3) return;
        const k = n.toLowerCase();
        if (!(k in TERM)) TERM[k] = e.id;
      });
    });
    const terms = Object.keys(TERM).sort((a, b) => b.length - a.length).map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    RX = terms.length ? new RegExp('(^|[^\\p{L}\\p{N}])(' + terms.join('|') + ')(?:s|x)?(?![\\p{L}\\p{N}])', 'giu') : null;
    OUT = {};
    G.forEach((e) => { OUT[e.id] = new Set(matches(e.txt || '').map((m) => m.id).filter((i) => i !== e.id)); });
  }

  function matches(text) {
    const out = [];
    if (!RX) return out;
    RX.lastIndex = 0;
    let m;
    while ((m = RX.exec(text))) {
      const id = TERM[m[2].toLowerCase()];
      if (!id) continue;
      const start = m.index + m[1].length;
      out.push({ id, start, end: m.index + m[0].length });
    }
    return out;
  }

  /* Texte -> HTML avec mots-clés cliquables (première occurrence de chaque mot-clé). */
  function kw(text, skip) {
    text = String(text == null ? '' : text);
    const seen = new Set(skip ? [].concat(skip) : []);
    let out = '', last = 0;
    matches(text).forEach((m) => {
      if (seen.has(m.id) || m.start < last) return;
      seen.add(m.id);
      out += esc(text.slice(last, m.start));
      out += '<a class="kw" href="#regle-' + esc(m.id) + '" data-k="' + esc(m.id) + '">' + esc(text.slice(m.start, m.end)) + '</a>';
      last = m.end;
    });
    return out + esc(text.slice(last));
  }

  /* ------------------------------------------------------------ info-bulle */
  const tip = document.createElement('div');
  tip.id = 'tip'; tip.setAttribute('role', 'tooltip');
  document.body.appendChild(tip);
  const canHover = window.matchMedia && window.matchMedia('(hover: hover)').matches;
  let tipTimer = null;

  function shorten(s, n) { s = String(s || ''); return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s; }

  function showTip(a, sticky) {
    const e = GI[a.dataset.k];
    if (!e) return;
    tip.innerHTML = '<strong>' + esc(e.fr) + '</strong> <span class="en">' + esc(e.en) + '</span><p>' + esc(shorten(e.txt, 240)) + '</p>' +
      (sticky ? '<a class="btn small" href="#regle-' + esc(e.id) + '">Ouvrir la fiche</a>' : '');
    tip.style.display = 'block';
    const r = a.getBoundingClientRect(), tw = tip.offsetWidth, th = tip.offsetHeight;
    let x = Math.min(Math.max(8, r.left), window.innerWidth - tw - 8);
    let y = r.bottom + 8;
    if (y + th > window.innerHeight - 70) y = Math.max(8, r.top - th - 8);
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
    tip.dataset.sticky = sticky ? '1' : '';
  }
  function hideTip() { clearTimeout(tipTimer); tip.style.display = 'none'; tip.dataset.sticky = ''; }

  document.addEventListener('mouseover', (ev) => {
    if (!canHover) return;
    const a = ev.target.closest && ev.target.closest('.kw');
    if (!a) return;
    clearTimeout(tipTimer);
    tipTimer = setTimeout(() => showTip(a, false), 120);
  });
  document.addEventListener('mouseout', (ev) => {
    const a = ev.target.closest && ev.target.closest('.kw');
    if (a && !tip.dataset.sticky) hideTip();
  });
  document.addEventListener('focusin', (ev) => {
    const a = ev.target.closest && ev.target.closest('.kw');
    if (a) showTip(a, false);
  });
  document.addEventListener('focusout', (ev) => {
    if (ev.target.closest && ev.target.closest('.kw') && !tip.dataset.sticky) hideTip();
  });
  window.addEventListener('scroll', hideTip, { passive: true });

  /* ---------------------------------------------------------------- routage */
  const app = $('#app');

  function curHash() {
    const h = (location.hash || '').replace(/^#/, '');
    const i = h.indexOf('-');
    return i < 0 ? [h, ''] : [h.slice(0, i), h.slice(i + 1)];
  }

  function route() {
    hideTip();
    const parts = curHash();
    let tab = parts[0] || 'regles';
    let html;
    if (tab === 'regle') { html = viewEntry(decodeURIComponent(parts[1] || '')); tab = 'regles'; }
    else if (tab === 'listes') html = viewLists();
    else if (tab === 'liste') { html = viewList(decodeURIComponent(parts[1] || '')); tab = 'listes'; }
    else if (tab === 'phases') html = viewPhases();
    else if (tab === 'about') { html = viewAbout(); tab = ''; }
    else { html = viewRules(); tab = 'regles'; }
    app.innerHTML = html;
    $$('.tabbar a').forEach((a) => a.classList.toggle('on', a.dataset.tab === tab));
    if (!route.keepScroll) window.scrollTo(0, 0);
    route.keepScroll = false;
  }
  function rerender() { route.keepScroll = true; route(); }
  window.addEventListener('hashchange', route);

  /* ------------------------------------------------------- vue : règles */
  function viewRules() {
    const chips = ['<button class="chip' + (ui.cat === '' ? ' on' : '') + '" data-act="cat" data-cat="">Tout</button>']
      .concat(Object.keys(T.CATS).map((c) => '<button class="chip' + (ui.cat === c ? ' on' : '') + '" data-act="cat" data-cat="' + c + '">' + esc(T.CATS[c]) + '</button>')).join('');
    const seq = T.PHASES.map((p, i) =>
      '<a class="card" href="#phases" data-act="gophase" data-phase="' + i + '"><h3>' + esc(p.fr) + '</h3><p class="muted">' +
      p.subs.map((s) => esc(s.fr)).join(' › ') + '</p></a>').join('');
    const toc = T.TOC.map((t) => '<li><a href="' + esc(officialUrl(t[1])) + '" target="_blank" rel="noopener">' + esc(t[0]) + ' ↗</a></li>').join('');
    return '<h1>Règles</h1>' +
      '<p class="hint">Aide-mémoire rédigé en français (résumés, pas le texte officiel). Les mots <a class="kw" href="#regle-charge" data-k="charge">soulignés</a> sont cliquables ; sur ordinateur, survolez-les pour un aperçu. Chaque fiche renvoie vers la page officielle (en anglais).</p>' +
      '<input type="search" id="q" placeholder="Rechercher une règle, un mot-clé…" value="' + esc(ui.q) + '" data-bind="q" aria-label="Rechercher">' +
      '<div class="chips" id="cats">' + chips + '</div>' +
      '<div id="results">' + rulesResults() + '</div>' +
      '<div class="row" style="margin:12px 0"><button class="btn ghost" data-act="newrule">+ Ajouter une règle perso</button></div>' +
      '<h2>Séquence du tour</h2>' + seq +
      '<details><summary>Sommaire officiel (liens vers tow.whfb.app)</summary><ul class="toc">' + toc + '</ul></details>';
  }
  function rulesResults() {
    const q = ui.q.trim().toLowerCase();
    const items = G.filter((e) => (!ui.cat || e.cat === ui.cat) &&
      (!q || [e.fr, e.en, e.txt].concat(e.aliases || []).join(' ').toLowerCase().includes(q)))
      .sort((a, b) => a.fr.localeCompare(b.fr, 'fr'));
    if (!items.length) return '<p class="muted">Aucune règle trouvée. Vous pouvez en ajouter une, ou consulter le sommaire officiel ci-dessous.</p>';
    return items.map((e) =>
      '<a class="card" href="#regle-' + esc(e.id) + '"><div class="row between"><h3>' + esc(e.fr) + '</h3><span class="badge">' + esc(T.CATS[e.cat] || 'Perso') + '</span></div>' +
      '<div class="en">' + esc(e.en || '') + '</div><p class="muted">' + esc(shorten(e.txt, 140)) + '</p></a>').join('');
  }

  /* ------------------------------------------------------ vue : une fiche */
  function viewEntry(id) {
    const e = GI[id];
    if (!e) return '<h1>Fiche introuvable</h1><p><a href="#regles">← Retour aux règles</a></p>';
    const rel = new Set(OUT[id] || []);
    G.forEach((o) => { if (o.id !== id && OUT[o.id] && OUT[o.id].has(id)) rel.add(o.id); });
    const relHtml = Array.from(rel).filter((i) => GI[i]).sort((a, b) => GI[a].fr.localeCompare(GI[b].fr, 'fr'))
      .map((i) => '<a class="chip" href="#regle-' + esc(i) + '" data-k="' + esc(i) + '">' + esc(GI[i].fr) + '</a>').join('');
    const uses = (e.uses || []).map((u) => {
      const ph = T.PHASES.find((p) => p.id === u.p);
      return '<li><strong>' + esc(ph ? ph.fr : u.p) + '</strong> · ' + (u.s === 'both' ? 'les deux tours' : esc(SIDE[u.s])) + ' — ' + kw(u.n, id) + '</li>';
    }).join('');
    return '<p><a href="#regles">← Règles</a></p>' +
      '<h1>' + esc(e.fr) + '</h1><div class="en">' + esc(e.en || '') + ' · <span class="badge">' + esc(T.CATS[e.cat] || 'Règle perso') + '</span></div>' +
      '<div class="card" style="margin-top:12px"><p>' + kw(e.txt, id) + '</p></div>' +
      (e.path ? '<p><a class="btn ghost" href="' + esc(officialUrl(e.path)) + '" target="_blank" rel="noopener">Texte officiel (EN) ↗</a></p>' :
        (e.url ? '<p><a class="btn ghost" href="' + esc(e.url) + '" target="_blank" rel="noopener">Source ↗</a></p>' : '')) +
      (uses ? '<h2>Pendant la partie</h2><ul>' + uses + '</ul>' : '') +
      (relHtml ? '<h2>Voir aussi</h2><div class="chips">' + relHtml + '</div>' : '') +
      '<h2>Ma note</h2><textarea data-bind="note" data-id="' + esc(id) + '" placeholder="Précisions, FAQ, rappel perso…">' + esc(state.notes[id] || '') + '</textarea>' +
      (e.custom ? '<div class="row" style="margin-top:10px"><button class="btn ghost" data-act="editrule" data-id="' + esc(id) + '">Modifier</button>' +
        '<button class="btn danger" data-act="delrule" data-id="' + esc(id) + '">Supprimer</button></div>' : '');
  }

  /* ------------------------------------------------ vue : liste des listes */
  function listTotal(l) { return (l.units || []).reduce((s, u) => s + num(u.pts), 0); }

  function viewLists() {
    const cards = state.lists.map((l) => {
      const tot = listTotal(l), lim = num(l.limit);
      return '<a class="card" href="#liste-' + esc(l.id) + '"><div class="row between"><h3>' + esc(l.name || 'Sans nom') + '</h3>' +
        '<span class="' + (lim && tot > lim ? 'bad' : '') + '">' + tot + (lim ? ' / ' + lim : '') + ' pts</span></div>' +
        '<div class="muted">' + esc(l.army || 'Armée non précisée') + ' · ' + (l.units || []).length + ' unité(s)</div></a>';
    }).join('');
    return '<h1>Mes listes d\'armée</h1>' +
      '<div class="row" style="margin:10px 0"><button class="btn" data-act="newlist">+ Nouvelle liste</button>' +
      '<button class="btn ghost" data-act="importlists">Importer (JSON)</button></div>' +
      (cards || '<p class="muted">Aucune liste pour l\'instant. Créez-en une, puis ajoutez vos unités (nom, points, règles).</p>');
  }

  /* ------------------------------------------------ vue : éditeur de liste */
  const getList = (id) => state.lists.find((l) => l.id === id);

  function unitRuleIds(u) {
    const ids = (u.rules || []).slice();
    if (u.troop) ids.push(u.troop);
    if (num(u.wizard) > 0) ids.push('wizard');
    FLAGS.forEach((f) => { if (u[f[0]]) ids.push(f[2]); });
    return Array.from(new Set(ids)).filter((i) => GI[i]);
  }

  function summaryHtml(l) {
    const tot = listTotal(l), lim = num(l.limit);
    const byCat = {};
    (l.units || []).forEach((u) => { byCat[u.cat] = (byCat[u.cat] || 0) + num(u.pts); });
    const base = lim || tot || 1;
    const pct = Math.min(100, Math.round((tot / (lim || tot || 1)) * 100));
    let html = '<div class="sum"><div><small>Total</small><b class="' + (lim && tot > lim ? 'bad' : '') + '">' + tot + (lim ? ' / ' + lim : '') + ' pts</b>' +
      (lim ? '<div class="bar"><i class="' + (tot > lim ? 'over' : '') + '" style="width:' + pct + '%"></i></div>' : '') + '</div>' +
      '<div><small>Unités</small><b>' + (l.units || []).length + '</b></div>' +
      '<div><small>Figurines</small><b>' + (l.units || []).reduce((s, u) => s + num(u.size), 0) + '</b></div></div>';
    const lines = [];
    Object.keys(UCATS).forEach((c) => {
      const v = byCat[c] || 0, p = Math.round((v / base) * 1000) / 10;
      const lm = (l.limits || {})[c] || {};
      const mx = lm.max !== undefined && lm.max !== '' ? Number(lm.max) : null;
      const mn = lm.min !== undefined && lm.min !== '' ? Number(lm.min) : null;
      if (!v && mx === null && mn === null) return;
      const bad = (mx !== null && p > mx) || (mn !== null && p < mn);
      lines.push('<li class="' + (bad ? 'bad' : '') + '">' + esc(UCATS[c]) + ' : ' + v + ' pts (' + p + ' %)' +
        (mn !== null ? ' · min ' + mn + ' %' : '') + (mx !== null ? ' · max ' + mx + ' %' : '') + (bad ? ' ⚠' : '') + '</li>');
    });
    if (lines.length) html += '<ul style="margin:10px 0 0;padding-left:18px">' + lines.join('') + '</ul>';
    if ((l.units || []).length > 0 && (l.units || []).length < 3) {
      html += '<p class="hint">Moins de trois unités : consultez la règle officielle « Minimum Three Units » ' +
        '(<a href="' + esc(officialUrl('warhammer-armies/minimum-three-units')) + '" target="_blank" rel="noopener">fiche ↗</a>).</p>';
    }
    return html;
  }
  function refreshSummary(l) { const el = $('#sum'); if (el) el.innerHTML = summaryHtml(l); }

  function unitCard(l, u, i) {
    const ids = unitRuleIds(u);
    const chips = ids.map((r) => '<a class="chip" href="#regle-' + esc(r) + '" data-k="' + esc(r) + '">' + esc(GI[r].fr) + '</a>').join('');
    return '<div class="card"><div class="row between"><h3>' + esc(u.name || 'Unité') + (num(u.size) ? ' <small>×' + num(u.size) + '</small>' : '') + '</h3>' +
      '<strong>' + num(u.pts) + ' pts</strong></div>' +
      '<div class="muted">' + esc(UCATS[u.cat] || '') + (num(u.wizard) ? ' · Magicien niv. ' + num(u.wizard) : '') + '</div>' +
      (chips ? '<div class="chips">' + chips + '</div>' : '') +
      (u.notes ? '<p>' + esc(u.notes) + '</p>' : '') +
      '<div class="row no-print"><button class="btn small ghost" data-act="editunit" data-id="' + esc(u.id) + '">Modifier</button>' +
      '<button class="btn small ghost" data-act="dupunit" data-id="' + esc(u.id) + '">Dupliquer</button>' +
      '<button class="btn small ghost" data-act="upunit" data-id="' + esc(u.id) + '" aria-label="Monter"' + (i === 0 ? ' disabled' : '') + '>↑</button>' +
      '<button class="btn small ghost" data-act="downunit" data-id="' + esc(u.id) + '" aria-label="Descendre"' + (i === l.units.length - 1 ? ' disabled' : '') + '>↓</button>' +
      '<button class="btn small danger" data-act="delunit" data-id="' + esc(u.id) + '">Supprimer</button></div></div>';
  }
  function unitsHtml(l) {
    if (!(l.units || []).length) return '<p class="muted">Aucune unité. Ajoutez votre premier régiment ou personnage.</p>';
    return l.units.map((u, i) => unitCard(l, u, i)).join('');
  }

  function viewList(id) {
    const l = getList(id);
    if (!l) return '<h1>Liste introuvable</h1><p><a href="#listes">← Mes listes</a></p>';
    const limRows = Object.keys(UCATS).map((c) => {
      const lm = (l.limits || {})[c] || {};
      return '<div class="row"><span style="width:110px">' + esc(UCATS[c]) + '</span>' +
        '<input type="number" min="0" max="100" placeholder="min %" data-bind="lmin" data-cat="' + c + '" value="' + esc(lm.min == null ? '' : lm.min) + '" style="width:90px" aria-label="Minimum % ' + esc(UCATS[c]) + '">' +
        '<input type="number" min="0" max="100" placeholder="max %" data-bind="lmax" data-cat="' + c + '" value="' + esc(lm.max == null ? '' : lm.max) + '" style="width:90px" aria-label="Maximum % ' + esc(UCATS[c]) + '"></div>';
    }).join('');
    return '<p class="no-print"><a href="#listes">← Mes listes</a></p>' +
      '<label for="lname">Nom de la liste</label><input type="text" id="lname" data-bind="lname" data-id="' + esc(l.id) + '" value="' + esc(l.name) + '">' +
      '<div class="grid2"><div><label for="larmy">Armée</label><input type="text" id="larmy" list="armies" data-bind="larmy" data-id="' + esc(l.id) + '" value="' + esc(l.army) + '" placeholder="ex. Empire of Man">' +
      '<datalist id="armies">' + T.ARMIES.map((a) => '<option value="' + esc(a) + '">').join('') + '</datalist></div>' +
      '<div><label for="llimit">Limite de points</label><input type="number" id="llimit" min="0" step="50" data-bind="llimit" data-id="' + esc(l.id) + '" value="' + esc(l.limit || '') + '" placeholder="ex. 2000"></div></div>' +
      '<div id="sum" class="card" style="margin-top:12px">' + summaryHtml(l) + '</div>' +
      '<details class="no-print"><summary>Contraintes de composition (optionnel, en % des points)</summary>' +
      '<p class="muted">Saisissez les limites de votre format de jeu (voir <a href="' + esc(officialUrl('warhammer-armies/army-composition-lists')) + '" target="_blank" rel="noopener">composition d\'armée ↗</a>). Elles ne servent qu\'à vous alerter.</p>' + limRows + '</details>' +
      '<div class="row between" style="margin:14px 0 8px"><h2 style="margin:0">Unités</h2><button class="btn no-print" data-act="addunit">+ Ajouter une unité</button></div>' +
      '<div id="units">' + unitsHtml(l) + '</div>' +
      '<div class="row no-print" style="margin-top:14px">' +
      '<button class="btn ghost" data-act="usephases" data-id="' + esc(l.id) + '">Utiliser dans Phases</button>' +
      '<button class="btn ghost" data-act="copylist" data-id="' + esc(l.id) + '">Copier en texte</button>' +
      '<button class="btn ghost" data-act="exportlist" data-id="' + esc(l.id) + '">Exporter</button>' +
      '<button class="btn ghost" data-act="printlist">Imprimer</button>' +
      '<button class="btn ghost" data-act="duplist" data-id="' + esc(l.id) + '">Dupliquer</button>' +
      '<button class="btn danger" data-act="dellist" data-id="' + esc(l.id) + '">Supprimer la liste</button></div>';
  }

  function listText(l) {
    const tot = listTotal(l), lim = num(l.limit);
    let t = (l.name || 'Liste') + (l.army ? ' — ' + l.army : '') + ' — ' + tot + (lim ? '/' + lim : '') + ' pts\n';
    Object.keys(UCATS).forEach((c) => {
      const us = (l.units || []).filter((u) => u.cat === c);
      if (!us.length) return;
      t += '\n' + UCATS[c].toUpperCase() + '\n';
      us.forEach((u) => {
        const rules = unitRuleIds(u).map((r) => GI[r].fr).join(', ');
        t += '- ' + (u.name || 'Unité') + (num(u.size) ? ' ×' + num(u.size) : '') + ' — ' + num(u.pts) + ' pts' + (rules ? ' [' + rules + ']' : '') + '\n';
      });
    });
    return t;
  }

  /* ------------------------------------------------------------ vue : phases */
  function phaseOrder() { return state.game.iStart ? ['me', 'opp'] : ['opp', 'me']; }
  function stepPhase(dir) {
    const g = state.game, order = phaseOrder();
    let idx = order.indexOf(g.side) * 4 + g.phase + dir;
    if (idx >= 8) { idx = 0; g.round += 1; }
    else if (idx < 0) { idx = 7; g.round = Math.max(1, g.round - 1); }
    g.side = order[Math.floor(idx / 4)];
    g.phase = idx % 4;
    save();
  }

  function remindersHtml(list, phase, side) {
    const groups = {};
    (list.units || []).forEach((u) => {
      unitRuleIds(u).forEach((rid) => {
        (GI[rid].uses || []).forEach((use) => {
          if (use.p !== phase.id || !(use.s === side || use.s === 'both')) return;
          const key = rid + '|' + use.n;
          if (!groups[key]) groups[key] = { rid, n: use.n, units: [] };
          const label = (u.name || 'Unité');
          if (groups[key].units.indexOf(label) < 0) groups[key].units.push(label);
        });
      });
    });
    const items = Object.keys(groups).map((k) => groups[k]);
    if (!items.length) return '<p class="muted">Aucun rappel spécifique pour votre liste dans cette phase.</p>';
    return '<ul>' + items.map((g) => '<li><a class="kw" href="#regle-' + esc(g.rid) + '" data-k="' + esc(g.rid) + '">' + esc(GI[g.rid].fr) + '</a> — ' +
      kw(g.n, g.rid) + '<br><span class="units">' + esc(g.units.join(', ')) + '</span></li>').join('') + '</ul>';
  }

  function viewPhases() {
    const g = state.game;
    const list = getList(g.listId) || state.lists[0] || null;
    if (list && g.listId !== list.id) { g.listId = list.id; save(); }
    const phase = T.PHASES[g.phase];
    const side = g.side;
    const order = phaseOrder();
    const secondPlayer = side === order[1];

    const listSel = state.lists.length ?
      '<label for="plist">Liste utilisée</label><select id="plist" data-bind="plist">' +
      state.lists.map((l) => '<option value="' + esc(l.id) + '"' + (list && list.id === l.id ? ' selected' : '') + '>' + esc(l.name || 'Sans nom') + '</option>').join('') + '</select>' :
      '<p class="hint">Aucune liste d\'armée pour l\'instant : <a href="#listes">créez-en une</a> pour obtenir des rappels adaptés à vos unités. Les étapes générales de chaque phase s\'affichent déjà ci-dessous.</p>';

    const phaseTabs = T.PHASES.map((p, i) => '<button class="' + (i === g.phase ? 'on' : '') + '" data-act="phase" data-phase="' + i + '">' + esc(p.fr.replace('Phase de ', '').replace('Phase du ', '')) + '</button>').join('');
    const sideTabs = ['me', 'opp'].map((s) => '<button class="' + (s === side ? 'on' : '') + '" data-act="side" data-side="' + s + '">' + SIDE[s] + '</button>').join('');

    const steps = phase.subs.map((s) =>
      '<div class="card step"><div class="row between"><h3>' + esc(s.fr) + '</h3><a href="' + esc(officialUrl(s.path)) + '" target="_blank" rel="noopener" class="muted">Officiel ↗</a></div>' +
      '<div class="en">' + esc(s.en) + '</div><p>' + kw(s[side]) + '</p></div>').join('');

    return '<h1>Assistant de phases</h1>' +
      '<div class="card"><div class="row between"><div><b>Tour de jeu ' + g.round + '</b> · ' + (secondPlayer ? '2<sup>e</sup>' : '1<sup>er</sup>') + ' joueur<br><span class="muted">' + SIDE[side] + ' — ' + esc(phase.fr) + '</span></div>' +
      '<div class="row"><button class="btn ghost small" data-act="prev" aria-label="Phase précédente">←</button><button class="btn small" data-act="next">Phase suivante →</button></div></div>' +
      '<label class="check"><input type="checkbox" data-bind="istart"' + (g.iStart ? ' checked' : '') + '> Je joue en premier</label></div>' +
      listSel +
      '<div class="seg" role="group" aria-label="Tour">' + sideTabs + '</div>' +
      '<div class="seg" role="group" aria-label="Phase">' + phaseTabs + '</div>' +
      '<div class="row between"><h2 style="margin:0">' + esc(phase.fr) + ' <small class="en">' + esc(phase.en) + '</small></h2><a href="' + esc(officialUrl(phase.path)) + '" target="_blank" rel="noopener">Officiel ↗</a></div>' +
      (phase.note ? '<p class="hint">' + esc(phase.note) + '</p>' : '') +
      (side === 'opp' ? '<p class="hint">C\'est le tour de l\'adversaire : voici ce que vous pouvez ou devez faire pendant ses étapes.</p>' : '') +
      (list ? '<div class="card remind"><h3>Votre armée — ' + esc(list.name || 'Sans nom') + '</h3>' + remindersHtml(list, phase, side) + '</div>' : '') +
      '<div class="steps">' + steps + '</div>';
  }

  /* -------------------------------------------------------------- vue : à propos */
  function viewAbout() {
    return '<h1>À propos</h1>' +
      '<div class="card"><p>Outil de fan <b>non officiel</b>, non affilié à Games Workshop. Les règles sont des <b>résumés personnels en français</b> destinés à servir d\'aide-mémoire : ils ne remplacent pas le livre de règles. Pour le texte exact, chaque fiche renvoie à l\'index officiel en ligne <a href="https://tow.whfb.app/" target="_blank" rel="noopener">tow.whfb.app</a> (en anglais).</p>' +
      '<p>Les noms français sont des traductions libres ; le nom anglais est toujours affiché à côté. Certaines fiches sont volontairement courtes : utilisez « + Ajouter une règle perso » ou la zone « Ma note » pour compléter.</p></div>' +
      '<h2>Vos données</h2><div class="card"><p>Tout est enregistré localement sur cet appareil (listes, notes, règles perso). Rien n\'est envoyé en ligne.</p>' +
      '<div class="row"><button class="btn ghost" data-act="exportall">Exporter tout (JSON)</button><button class="btn ghost" data-act="importall">Importer une sauvegarde</button></div></div>' +
      '<h2>Installer l\'app</h2><div class="card"><p>Sur téléphone ou ordinateur, ouvrez cette page depuis un hébergement HTTPS puis utilisez « Ajouter à l\'écran d\'accueil » / « Installer l\'application » de votre navigateur. Une fois installée, elle fonctionne hors ligne (sauf les liens officiels).</p></div>';
  }

  /* -------------------------------------------------------------- boîtes de dialogue */
  const dlg = $('#dlg');
  function openDlg(html) { dlg.innerHTML = html; if (!dlg.open) { if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', ''); } }
  let pendingYes = null;
  function ask(msg, yes) {
    pendingYes = yes;
    openDlg('<h2>Confirmer</h2><p>' + esc(msg) + '</p><div class="row" style="margin-top:14px"><button class="btn danger" data-act="yes">Supprimer</button><button class="btn ghost" data-act="closedlg">Annuler</button></div>');
  }
  function closeDlg() { if (dlg.open) { if (dlg.close) dlg.close(); else dlg.removeAttribute('open'); } }

  let draft = null, draftListId = null;

  function openUnit(listId, unitId) {
    const l = getList(listId); if (!l) return;
    draftListId = listId;
    const ex = unitId ? l.units.find((u) => u.id === unitId) : null;
    draft = ex ? JSON.parse(JSON.stringify(ex)) : { id: uid(), name: '', cat: 'core', size: 10, pts: 0, troop: 'infantry', wizard: 0, rules: [], notes: '' };
    draft.rules = draft.rules || [];
    const troopOpts = '<option value="">—</option>' + G.filter((e) => e.cat === 'troop' && ['infantry', 'cavalry', 'chariots', 'monsters', 'war-machine'].indexOf(e.id) >= 0)
      .map((e) => '<option value="' + esc(e.id) + '"' + (draft.troop === e.id ? ' selected' : '') + '>' + esc(e.fr) + '</option>').join('');
    const catOpts = Object.keys(UCATS).map((c) => '<option value="' + c + '"' + (draft.cat === c ? ' selected' : '') + '>' + esc(UCATS[c]) + '</option>').join('');
    const flags = FLAGS.map((f) => '<label class="check"><input type="checkbox" name="' + f[0] + '"' + (draft[f[0]] ? ' checked' : '') + '> ' + esc(f[1]) + '</label>').join('');
    openDlg('<form id="uform" method="dialog"><h2>' + (ex ? 'Modifier l\'unité' : 'Nouvelle unité') + '</h2>' +
      '<label for="u_name">Nom</label><input type="text" id="u_name" name="name" value="' + esc(draft.name) + '" placeholder="ex. Hallebardiers" required>' +
      '<div class="grid2"><div><label for="u_cat">Catégorie</label><select id="u_cat" name="cat">' + catOpts + '</select></div>' +
      '<div><label for="u_troop">Type de troupe</label><select id="u_troop" name="troop">' + troopOpts + '</select></div>' +
      '<div><label for="u_size">Effectif (figurines)</label><input type="number" id="u_size" name="size" min="0" value="' + esc(draft.size) + '"></div>' +
      '<div><label for="u_pts">Points</label><input type="number" id="u_pts" name="pts" min="0" value="' + esc(draft.pts) + '"></div>' +
      '<div><label for="u_wiz">Niveau de magicien</label><select id="u_wiz" name="wizard">' + [0, 1, 2, 3, 4].map((n) => '<option value="' + n + '"' + (num(draft.wizard) === n ? ' selected' : '') + '>' + (n ? 'Niveau ' + n : 'Non') + '</option>').join('') + '</select></div></div>' +
      '<label>Rôle / groupe de commandement</label>' + flags +
      '<label for="rs">Règles spéciales, équipement</label><div class="chips" id="rchips"></div>' +
      '<input type="search" id="rs" placeholder="Chercher une règle à ajouter…" autocomplete="off"><div class="sugg" id="rres" hidden></div>' +
      '<label for="u_notes">Notes</label><input type="text" id="u_notes" name="notes" value="' + esc(draft.notes || '') + '" placeholder="équipement, objets magiques…">' +
      '<div class="row" style="margin-top:14px"><button class="btn" type="submit">Enregistrer</button><button class="btn ghost" type="button" data-act="closedlg">Annuler</button></div></form>');
    drawChips();
  }
  function drawChips() {
    const c = $('#rchips'); if (!c) return;
    c.innerHTML = draft.rules.filter((r) => GI[r]).map((r) => '<button type="button" class="chip on" data-act="rmrule" data-id="' + esc(r) + '">' + esc(GI[r].fr) + '<span class="x">✕</span></button>').join('') ||
      '<span class="muted">Aucune pour l\'instant</span>';
  }
  function drawSuggestions(q) {
    const box = $('#rres'); if (!box) return;
    q = q.trim().toLowerCase();
    if (!q) { box.hidden = true; box.innerHTML = ''; return; }
    const items = G.filter((e) => draft.rules.indexOf(e.id) < 0 && [e.fr, e.en].concat(e.aliases || []).join(' ').toLowerCase().includes(q)).slice(0, 8);
    box.hidden = !items.length;
    box.innerHTML = items.map((e) => '<button type="button" data-act="addrule" data-id="' + esc(e.id) + '">' + esc(e.fr) + ' <span class="en">' + esc(e.en || '') + '</span></button>').join('');
  }

  function openRuleForm(id) {
    const ex = id ? state.custom.find((c) => c.id === id) : null;
    const use = ex && ex.uses && ex.uses[0] ? ex.uses[0] : { p: '', s: 'me', n: '' };
    openDlg('<form id="rform" method="dialog"><h2>' + (ex ? 'Modifier la règle' : 'Nouvelle règle perso') + '</h2>' +
      '<input type="hidden" name="id" value="' + esc(ex ? ex.id : '') + '">' +
      '<label for="r_fr">Nom (français)</label><input type="text" id="r_fr" name="fr" value="' + esc(ex ? ex.fr : '') + '" required>' +
      '<label for="r_en">Nom anglais (facultatif)</label><input type="text" id="r_en" name="en" value="' + esc(ex ? ex.en : '') + '">' +
      '<label for="r_cat">Catégorie</label><select id="r_cat" name="cat">' + Object.keys(T.CATS).map((c) => '<option value="' + c + '"' + (ex && ex.cat === c ? ' selected' : '') + '>' + esc(T.CATS[c]) + '</option>').join('') + '</select>' +
      '<label for="r_txt">Description</label><textarea id="r_txt" name="txt" required>' + esc(ex ? ex.txt : '') + '</textarea>' +
      '<label for="r_url">Lien officiel (facultatif)</label><input type="text" id="r_url" name="url" value="' + esc(ex ? ex.url || '' : '') + '" placeholder="https://tow.whfb.app/…">' +
      '<label>Rappel dans l\'assistant de phases (facultatif)</label>' +
      '<div class="grid2"><select name="up" aria-label="Phase"><option value="">— aucune phase —</option>' + T.PHASES.map((p) => '<option value="' + p.id + '"' + (use.p === p.id ? ' selected' : '') + '>' + esc(p.fr) + '</option>').join('') + '</select>' +
      '<select name="us" aria-label="Tour"><option value="me"' + (use.s === 'me' ? ' selected' : '') + '>Mon tour</option><option value="opp"' + (use.s === 'opp' ? ' selected' : '') + '>Tour adverse</option><option value="both"' + (use.s === 'both' ? ' selected' : '') + '>Les deux</option></select></div>' +
      '<input type="text" name="un" value="' + esc(use.n || '') + '" placeholder="Texte du rappel" aria-label="Texte du rappel" style="margin-top:8px">' +
      '<div class="row" style="margin-top:14px"><button class="btn" type="submit">Enregistrer</button><button class="btn ghost" type="button" data-act="closedlg">Annuler</button></div></form>');
  }

  /* -------------------------------------------------------------- fichiers */
  function download(name, text) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function copyText(t) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(t).then(() => toast('Copié'), () => fallbackCopy(t));
    } else fallbackCopy(t);
  }
  function fallbackCopy(t) {
    const ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); toast('Copié'); } catch (e) { toast('Copie impossible'); }
    ta.remove();
  }
  let importMode = 'lists';
  const filein = $('#filein');
  filein.addEventListener('change', () => {
    const f = filein.files && filein.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const d = JSON.parse(r.result);
        if (importMode === 'all') {
          if (!d || typeof d !== 'object' || !Array.isArray(d.lists)) throw new Error('format');
          state = Object.assign(defaults(), d, { game: Object.assign(defaults().game, d.game || {}) });
          rebuild(); save(); toast('Sauvegarde importée'); rerender();
        } else {
          const arr = Array.isArray(d) ? d : [d];
          let n = 0;
          arr.forEach((l) => {
            if (!l || !Array.isArray(l.units)) return;
            l.id = uid(); l.units.forEach((u) => { u.id = uid(); });
            state.lists.push(l); n++;
          });
          if (!n) throw new Error('format');
          save(); toast(n + ' liste(s) importée(s)'); rerender();
        }
      } catch (e) { toast('Fichier invalide'); }
      filein.value = '';
    };
    r.readAsText(f);
  });

  /* -------------------------------------------------------------- événements */
  document.addEventListener('click', (ev) => {
    // mots-clés : sur écran tactile, 1er appui = aperçu ; lien « Ouvrir la fiche » ensuite
    const k = ev.target.closest && ev.target.closest('a.kw');
    if (k && !canHover) { ev.preventDefault(); showTip(k, true); return; }
    if (!(ev.target.closest && ev.target.closest('#tip'))) { if (!k) hideTip(); }
    if (ev.target.closest && ev.target.closest('#tip a')) { hideTip(); return; }

    const b = ev.target.closest && ev.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act, id = b.dataset.id;
    const hash = curHash();
    const curList = hash[0] === 'liste' ? getList(decodeURIComponent(hash[1] || '')) : null;

    switch (act) {
      case 'cat': ui.cat = b.dataset.cat || ''; $$('#cats .chip').forEach((c) => c.classList.toggle('on', (c.dataset.cat || '') === ui.cat)); $('#results').innerHTML = rulesResults(); break;
      case 'gophase': state.game.phase = num(b.dataset.phase); save(); break;
      case 'newrule': openRuleForm(null); break;
      case 'editrule': openRuleForm(id); break;
      case 'delrule':
        ask('Supprimer cette règle perso ?', () => {
          state.custom = state.custom.filter((c) => c.id !== id); delete state.notes[id]; save(); rebuild(); location.hash = '#regles';
        }); break;
      case 'newlist': {
        const l = { id: uid(), name: 'Nouvelle liste', army: '', limit: 2000, limits: {}, units: [] };
        state.lists.push(l); save(); location.hash = '#liste-' + l.id; break;
      }
      case 'importlists': importMode = 'lists'; filein.click(); break;
      case 'importall': importMode = 'all'; filein.click(); break;
      case 'exportall': download('old-world-sauvegarde.json', JSON.stringify(state, null, 1)); break;
      case 'addunit': if (curList) openUnit(curList.id, null); break;
      case 'editunit': if (curList) openUnit(curList.id, id); break;
      case 'dupunit': if (curList) {
        const i = curList.units.findIndex((u) => u.id === id); if (i < 0) break;
        const c = JSON.parse(JSON.stringify(curList.units[i])); c.id = uid(); c.name = (c.name || 'Unité') + ' (copie)';
        curList.units.splice(i + 1, 0, c); save(); rerender();
      } break;
      case 'upunit': case 'downunit': if (curList) {
        const i = curList.units.findIndex((u) => u.id === id), j = act === 'upunit' ? i - 1 : i + 1;
        if (i < 0 || j < 0 || j >= curList.units.length) break;
        const t = curList.units[i]; curList.units[i] = curList.units[j]; curList.units[j] = t; save(); rerender();
      } break;
      case 'delunit': if (curList) ask('Supprimer cette unité ?', () => { curList.units = curList.units.filter((u) => u.id !== id); save(); rerender(); }); break;
      case 'dellist': ask('Supprimer cette liste ?', () => {
        state.lists = state.lists.filter((l) => l.id !== id); if (state.game.listId === id) state.game.listId = null; save(); location.hash = '#listes';
      }); break;
      case 'yes': { const f = pendingYes; pendingYes = null; closeDlg(); if (f) f(); break; }
      case 'duplist': { const l = getList(id); if (!l) break;
        const c = JSON.parse(JSON.stringify(l)); c.id = uid(); c.name = (l.name || 'Liste') + ' (copie)'; c.units.forEach((u) => { u.id = uid(); });
        state.lists.push(c); save(); location.hash = '#liste-' + c.id; break; }
      case 'copylist': { const l = getList(id); if (l) copyText(listText(l)); break; }
      case 'exportlist': { const l = getList(id); if (l) download((l.name || 'liste').replace(/[^\w-]+/g, '_') + '.json', JSON.stringify(l, null, 1)); break; }
      case 'printlist': window.print(); break;
      case 'usephases': state.game.listId = id; save(); location.hash = '#phases'; break;
      case 'side': state.game.side = b.dataset.side; save(); rerender(); break;
      case 'phase': state.game.phase = num(b.dataset.phase); save(); rerender(); break;
      case 'next': stepPhase(1); rerender(); window.scrollTo(0, 0); break;
      case 'prev': stepPhase(-1); rerender(); window.scrollTo(0, 0); break;
      case 'closedlg': closeDlg(); break;
      case 'addrule': if (draft && draft.rules.indexOf(id) < 0) { draft.rules.push(id); drawChips(); const s = $('#rs'); if (s) { s.value = ''; s.focus(); } drawSuggestions(''); } break;
      case 'rmrule': if (draft) { draft.rules = draft.rules.filter((r) => r !== id); drawChips(); } break;
      default: break;
    }
  });

  document.addEventListener('input', (ev) => {
    const t = ev.target, b = t.dataset && t.dataset.bind;
    if (t.id === 'rs') { drawSuggestions(t.value); return; }
    if (!b) return;
    const hash = curHash();
    const l = hash[0] === 'liste' ? getList(decodeURIComponent(hash[1] || '')) : null;
    switch (b) {
      case 'q': ui.q = t.value; $('#results').innerHTML = rulesResults(); break;
      case 'note': { const v = t.value.trim(); if (v) state.notes[t.dataset.id] = t.value; else delete state.notes[t.dataset.id]; save(); break; }
      case 'lname': if (l) { l.name = t.value; save(); } break;
      case 'larmy': if (l) { l.army = t.value; save(); } break;
      case 'llimit': if (l) { l.limit = num(t.value); save(); refreshSummary(l); } break;
      case 'lmin': case 'lmax': if (l) {
        l.limits = l.limits || {}; const c = t.dataset.cat; l.limits[c] = l.limits[c] || {};
        l.limits[c][b === 'lmin' ? 'min' : 'max'] = t.value === '' ? '' : Number(t.value); save(); refreshSummary(l);
      } break;
      default: break;
    }
  });

  document.addEventListener('change', (ev) => {
    const t = ev.target, b = t.dataset && t.dataset.bind;
    if (b === 'plist') { state.game.listId = t.value; save(); rerender(); }
    if (b === 'istart') { state.game.iStart = t.checked; save(); rerender(); }
  });

  document.addEventListener('submit', (ev) => {
    const f = ev.target;
    if (f.id === 'uform') {
      ev.preventDefault();
      const l = getList(draftListId); if (!l || !draft) return closeDlg();
      const fd = new FormData(f);
      draft.name = String(fd.get('name') || '').trim() || 'Unité sans nom';
      draft.cat = fd.get('cat'); draft.troop = fd.get('troop') || '';
      draft.size = num(fd.get('size')); draft.pts = num(fd.get('pts')); draft.wizard = num(fd.get('wizard'));
      draft.notes = String(fd.get('notes') || '');
      FLAGS.forEach((x) => { draft[x[0]] = fd.get(x[0]) === 'on'; });
      const i = l.units.findIndex((u) => u.id === draft.id);
      if (i >= 0) l.units[i] = draft; else l.units.push(draft);
      draft = null; save(); closeDlg(); rerender();
    } else if (f.id === 'rform') {
      ev.preventDefault();
      const fd = new FormData(f);
      const id = String(fd.get('id') || '') || 'perso-' + uid();
      const entry = { id, fr: String(fd.get('fr') || '').trim(), en: String(fd.get('en') || '').trim(), cat: fd.get('cat'), txt: String(fd.get('txt') || '').trim(), uses: [] };
      const url = String(fd.get('url') || '').trim();
      if (/^https?:\/\//i.test(url)) entry.url = url;
      const up = fd.get('up'), un = String(fd.get('un') || '').trim();
      if (up && un) entry.uses.push({ p: up, s: fd.get('us'), n: un });
      const i = state.custom.findIndex((c) => c.id === id);
      if (i >= 0) state.custom[i] = entry; else state.custom.push(entry);
      save(); rebuild(); closeDlg(); location.hash = '#regle-' + id; rerender();
    }
  });

  dlg.addEventListener('click', (ev) => { if (ev.target === dlg) closeDlg(); });

  /* -------------------------------------------------------------- démarrage */
  rebuild();
  route();
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
})();
