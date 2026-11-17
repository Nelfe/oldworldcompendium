/* Old World Compendium — aide-mémoire (PWA, non officiel). Vanilla JS, aucune dépendance. */
(function () {
  'use strict';

  const T = window.TOW;
  const KEY = 'towfr.v2';
  const SIDE = { me: 'Mon tour', opp: 'Tour adverse' };
  const UCATS = { lord: 'Seigneurs', hero: 'Héros', core: 'Noyau', special: 'Spécial', rare: 'Rare', merc: 'Mercenaires', ally: 'Alliés' };
  const TROOPS = [['', '—'], ['infantry', 'Infanterie'], ['cavalry', 'Cavalerie'], ['chariots', 'Chars'], ['monsters', 'Monstres'], ['war-machine', 'Machine de guerre']];
  const PROF = [['m', 'M'], ['ws', 'CC'], ['bs', 'CT'], ['s', 'F'], ['t', 'E'], ['w', 'PV'], ['i', 'I'], ['a', 'A'], ['ld', 'Cd']];
  const SPELL_TYPES = [
    ['enchantment', 'Enchantement'], ['hex', 'Hex'], ['conveyance', 'Transport'],
    ['magic-missile', 'Projectile magique'], ['vortex', 'Vortex magique'], ['assailment', 'Assaut'],
  ];
  const SPELL_PHASE = {
    enchantment: ['strategy', 'me'], hex: ['strategy', 'me'], conveyance: ['movement', 'me'],
    'magic-missile': ['shooting', 'me'], vortex: ['shooting', 'me'], assailment: ['combat', 'both'],
  };
  const PHASE_NAME = { strategy: 'Stratégie', movement: 'Mouvement', shooting: 'Tir', combat: 'Combat' };

  /* ------------------------------------------------------------------ utils */
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
  const num = (v) => { const n = parseInt(v, 10); return isNaN(n) ? 0 : n; };
  const officialUrl = (path) => T.BASE + path;
  const shorten = (s, n) => { s = String(s || ''); return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s; };
  const safeUrl = (u) => (/^https?:\/\//i.test(String(u || '').trim()) ? String(u).trim() : '');
  const byFr = (a, b) => String(a.fr || a.name || '').localeCompare(String(b.fr || b.name || ''), 'fr');
  const clone = (o) => JSON.parse(JSON.stringify(o));

  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('on');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove('on'), 2400);
  }

  /* ------------------------------------------------------------------ state */
  function defaults() {
    return { lists: [], notes: {}, armies: [], units: [], spells: [], game: { round: 1, side: 'me', phase: 0, step: 0, iStart: true, listId: null } };
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

  const getArmy = (id) => state.armies.find((a) => a.id === id);
  const getUnit = (id) => state.units.find((u) => u.id === id);
  const getSpell = (id) => state.spells.find((s) => s.id === id);
  const getList = (id) => state.lists.find((l) => l.id === id);

  /* -------------------------------------------------- glossaire & mots-clés */
  let G = [], GI = {}, TERM = {}, RX = null, OUT = {};
  const stripParen = (s) => String(s || '').replace(/\s*\([^)]*\)\s*$/, '').trim();

  function rebuild() {
    G = T.G.slice();
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
      out.push({ id, start: m.index + m[1].length, end: m.index + m[0].length });
    }
    return out;
  }

  /* Texte -> HTML avec mots-clés cliquables. all=true : toutes les occurrences, sinon la première de chaque mot-clé. */
  function kw(text, skip, all) {
    text = String(text == null ? '' : text);
    const seen = new Set(skip ? [].concat(skip) : []);
    let out = '', last = 0;
    matches(text).forEach((m) => {
      if ((!all && seen.has(m.id)) || m.start < last) return;
      seen.add(m.id);
      out += esc(text.slice(last, m.start));
      out += '<a class="kw" href="#regle-' + esc(m.id) + '" data-k="' + esc(m.id) + '">' + esc(text.slice(m.start, m.end)) + '</a>';
      last = m.end;
    });
    return out + esc(text.slice(last));
  }
  const kwBlock = (t) => esc('') + String(t || '').split('\n').map((l) => kw(l, null, false)).join('<br>');

  /* ------------------------------------------------------------ info-bulle */
  const tip = document.createElement('div');
  tip.id = 'tip'; tip.setAttribute('role', 'tooltip');
  document.body.appendChild(tip);
  const canHover = window.matchMedia && window.matchMedia('(hover: hover)').matches;
  let tipTimer = null;

  function showTip(a, sticky) {
    const e = GI[a.dataset.k];
    if (!e) return;
    tip.innerHTML = '<strong>' + esc(e.fr) + '</strong> <span class="en">' + esc(e.en) + '</span><p>' + esc(shorten(e.txt, 240)) + '</p>' +
      (sticky ? '<a class="btn small" href="#regle-' + esc(e.id) + '">Ouvrir la fiche</a>' : '');
    tip.style.display = 'block';
    const r = a.getBoundingClientRect(), tw = tip.offsetWidth, th = tip.offsetHeight;
    const x = Math.min(Math.max(8, r.left), window.innerWidth - tw - 8);
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
  document.addEventListener('focusin', (ev) => { const a = ev.target.closest && ev.target.closest('.kw'); if (a) showTip(a, false); });
  document.addEventListener('focusout', (ev) => { if (ev.target.closest && ev.target.closest('.kw') && !tip.dataset.sticky) hideTip(); });
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
    const arg = decodeURIComponent(parts[1] || '');
    let tab = parts[0] || 'regles';
    let html;
    if (tab === 'regle') { html = viewEntry(arg); tab = 'regles'; }
    else if (tab === 'armees') html = viewArmies();
    else if (tab === 'armee') { html = viewArmy(arg); tab = 'armees'; }
    else if (tab === 'unite') { html = viewUnit(arg); tab = 'armees'; }
    else if (tab === 'sort') { html = viewSpell(arg); tab = 'armees'; }
    else if (tab === 'listes') html = viewLists();
    else if (tab === 'liste') { html = viewList(arg); tab = 'listes'; }
    else if (tab === 'phases') html = viewPhases();
    else if (tab === 'about') { html = viewAbout(); tab = ''; }
    else { html = viewRules(); tab = 'regles'; }
    app.innerHTML = html;
    $$('.tabbar a').forEach((a) => { const on = a.dataset.tab === tab; a.classList.toggle('on', on); if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    if (!route.keepScroll) window.scrollTo(0, 0);
    route.keepScroll = false;
  }
  function rerender() { route.keepScroll = true; route(); }
  window.addEventListener('hashchange', route);

  /* ------------------------------------------------------- vue : règles */
  function viewRules() {
    return '<h1>Règles</h1>' +
      '<p class="hint">Résumés rédigés en français, classés comme les chapitres du site officiel. Les mots <a class="kw" href="#regle-charge" data-k="charge">soulignés</a> sont cliquables, et sur ordinateur un survol affiche un aperçu. Pour le déroulement d\'un tour, voir l\'onglet <a href="#phases">Phases</a>.</p>' +
      '<input type="search" id="q" placeholder="Rechercher une règle, un mot-clé…" value="' + esc(ui.q) + '" data-bind="q" aria-label="Rechercher">' +
      '<div id="results">' + rulesResults() + '</div>';
  }
  const chapOf = (slug) => (T.CHAPTERS || []).find((c) => c.slug === slug);
  function rulesResults() {
    const q = ui.q.trim().toLowerCase();
    const items = G.filter((e) => (q || !e.stub) && (!q || [e.fr, e.en, e.txt].concat(e.aliases || []).join(' ').toLowerCase().includes(q))).sort(byFr);
    if (q && !items.length) return '<p class="muted">Aucune règle trouvée.</p>';
    const by = {};
    items.forEach((e) => { (by[e.ch] = by[e.ch] || []).push(e); });
    return T.CHAPTERS.map((c, i) => {
      const list = by[c.slug] || [];
      const num = '<span class="chnum">' + (i + 1) + '</span>';
      const link = '<a class="chlink" href="' + esc(officialUrl(c.slug)) + '" target="_blank" rel="noopener">Chapitre officiel (EN) ↗</a>';
      if (!list.length) {
        if (q) return '';
        return '<div class="chap empty"><div class="chsum">' + num + '<span class="chname">' + esc(c.fr) + '<small>' + esc(c.en) + '</small></span>' +
          '<a class="chlink" href="' + esc(officialUrl(c.slug)) + '" target="_blank" rel="noopener" aria-label="Ouvrir le chapitre officiel ' + esc(c.en) + '">↗</a></div></div>';
      }
      return '<details class="chap"' + (q ? ' open' : '') + '><summary class="chsum">' + num +
        '<span class="chname">' + esc(c.fr) + '<small>' + esc(c.en) + '</small></span><span class="badge">' + list.length + '</span></summary>' +
        '<div class="chbody">' + list.map((r) =>
          '<a class="card" href="#regle-' + esc(r.id) + '"><h3>' + esc(r.fr) + '</h3><div class="en">' + esc(r.en || '') + '</div>' +
          '<p class="muted">' + esc(shorten(r.txt, 140)) + '</p></a>').join('') + link + '</div></details>';
    }).join('');
  }

  /* ------------------------------------------------------ vue : une fiche */
  function viewEntry(id) {
    const e = GI[id];
    if (!e) return '<h1>Fiche introuvable</h1><p><a href="#regles">← Retour aux règles</a></p>';
    const rel = new Set(OUT[id] || []);
    G.forEach((o) => { if (o.id !== id && OUT[o.id] && OUT[o.id].has(id)) rel.add(o.id); });
    const relHtml = Array.from(rel).filter((i) => GI[i]).sort((a, b) => byFr(GI[a], GI[b]))
      .map((i) => '<a class="chip" href="#regle-' + esc(i) + '" data-k="' + esc(i) + '">' + esc(GI[i].fr) + '</a>').join('');
    const uses = (e.uses || []).map((u) => {
      const ph = T.PHASES.find((p) => p.id === u.p);
      return '<li><strong>' + esc(ph ? ph.fr : u.p) + '</strong> · ' + (u.s === 'both' ? 'les deux tours' : esc(SIDE[u.s])) + ' — ' + kw(u.n, id) + '</li>';
    }).join('');
    return '<p><a href="#regles">← Règles</a></p>' +
      '<h1>' + esc(e.fr) + '</h1><div class="en">' + esc(e.en || '') + ' · <span class="badge">' + esc((chapOf(e.ch) || {}).fr || '') + '</span></div>' +
      '<div class="card" style="margin-top:12px"><p>' + kw(e.txt, id) + '</p></div>' +
      (e.path ? '<p><a class="btn ghost" href="' + esc(officialUrl(e.path)) + '" target="_blank" rel="noopener">Texte officiel (EN) ↗</a></p>' : '') +
      (uses ? '<h2>Pendant la partie</h2><ul>' + uses + '</ul>' : '') +
      (relHtml ? '<h2>Voir aussi</h2><div class="chips">' + relHtml + '</div>' : '') +
      '<h2>Ma note</h2><textarea data-bind="note" data-id="' + esc(id) + '" placeholder="Précisions, FAQ, rappel perso…">' + esc(state.notes[id] || '') + '</textarea>';
  }

  /* ----------------------------------------------- bibliothèque : armées */
  const unitsOf = (aid) => state.units.filter((u) => u.army === aid);
  const spellsOf = (aid) => state.spells.filter((s) => s.army === aid);

  function viewArmies() {
    const cards = state.armies.slice().sort(byFr).map((a) =>
      '<a class="card" href="#armee-' + esc(a.id) + '"><h3>' + esc(a.name) + '</h3><div class="muted">' + unitsOf(a.id).length + ' unité(s) · ' +
      spellsOf(a.id).length + ' sort(s) · ' + (a.comps || []).length + ' composition(s)</div></a>').join('');
    return '<h1>Armées</h1>' +
      '<p class="hint">Votre bibliothèque : armées, sous-factions, fiches d\'unité (profil, options, équipement, règles) et sorts. Les données sont les vôtres : saisissez ce que vous jouez, ou importez un fichier JSON. Elles alimentent ensuite le constructeur de listes et l\'assistant de phases.</p>' +
      '<div class="row" style="margin:10px 0"><button class="btn" data-act="newarmy">+ Nouvelle armée</button>' +
      '<button class="btn ghost" data-act="importall">Importer (JSON)</button>' +
      '<button class="btn ghost" data-act="template">Copier un modèle JSON</button></div>' +
      (cards || '<p class="muted">Aucune armée pour l\'instant. Créez-en une (par exemple votre faction), puis ajoutez ses unités.</p>') +
      '<h2>Factions du jeu</h2><p class="muted">Pages officielles (anglais) pour consulter les profils et les coûts :</p><div class="chips">' +
      T.ARMIES.map((n) => '<a class="chip" href="' + esc(officialUrl('army/' + n.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''))) + '" target="_blank" rel="noopener">' + esc(n) + ' ↗</a>').join('') + '</div>';
  }

  function limitsText(l) {
    return Object.keys(UCATS).map((c) => {
      const x = (l || {})[c] || {};
      const mn = x.min === '' || x.min == null ? null : x.min, mx = x.max === '' || x.max == null ? null : x.max;
      if (mn === null && mx === null) return '';
      return UCATS[c] + ' ' + (mn !== null ? '≥' + mn + '%' : '') + (mx !== null ? (mn !== null ? ' ' : '') + '≤' + mx + '%' : '');
    }).filter(Boolean).join(' · ');
  }

  function viewArmy(id) {
    const a = getArmy(id);
    if (!a) return '<h1>Armée introuvable</h1><p><a href="#armees">← Armées</a></p>';
    const comps = (a.comps || []).map((c) =>
      '<div class="card"><div class="row between"><h3>' + esc(c.name) + '</h3><span class="row"><button class="btn small ghost" data-act="editcomp" data-id="' + esc(c.id) + '" data-a="' + esc(a.id) + '">Modifier</button>' +
      '<button class="btn small danger" data-act="delcomp" data-id="' + esc(c.id) + '" data-a="' + esc(a.id) + '">Supprimer</button></span></div>' +
      '<div class="muted">' + (esc(limitsText(c.limits)) || 'Aucune contrainte saisie') + '</div></div>').join('');
    const us = unitsOf(id);
    const unitsHtml = Object.keys(UCATS).map((c) => {
      const list = us.filter((u) => u.cat === c).sort(byFr);
      if (!list.length) return '';
      return '<h3 style="margin-top:12px">' + esc(UCATS[c]) + '</h3>' + list.map((u) =>
        '<a class="card" href="#unite-' + esc(u.id) + '"><div class="row between"><h3>' + esc(u.name) + '</h3><strong>' + num(u.base) + ' pts</strong></div>' +
        '<div class="muted">' + (num(u.sizeMin) ? u.sizeMin + (num(u.sizeMax) && u.sizeMax !== u.sizeMin ? '–' + u.sizeMax : '') + ' fig.' : '') +
        (num(u.wizard) ? ' · Magicien niv. ' + num(u.wizard) : '') + '</div></a>').join('');
    }).join('');
    const sp = spellsOf(id);
    const lores = Array.from(new Set(sp.map((s) => s.lore || 'Sans liste'))).sort();
    const spellsHtml = lores.map((l) => '<h3 style="margin-top:12px">' + esc(l) + '</h3>' + sp.filter((s) => (s.lore || 'Sans liste') === l).sort(byFr).map((s) =>
      '<a class="card" href="#sort-' + esc(s.id) + '"><div class="row between"><h3>' + esc(s.name) + '</h3><span class="badge">' + esc((SPELL_TYPES.find((t) => t[0] === s.type) || [0, ''])[1]) + '</span></div>' +
      '<div class="muted">Incantation ' + esc(s.cast || '?') + (s.range ? ' · portée ' + esc(s.range) : '') + '</div></a>').join('')).join('');
    return '<p><a href="#armees">← Armées</a></p>' +
      '<div class="row between"><h1>' + esc(a.name) + '</h1><span class="row"><button class="btn small ghost" data-act="editarmy" data-id="' + esc(a.id) + '">Renommer</button>' +
      '<button class="btn small danger" data-act="delarmy" data-id="' + esc(a.id) + '">Supprimer</button></span></div>' +
      '<div class="row" style="margin:8px 0"><button class="btn" data-act="newunit" data-a="' + esc(a.id) + '">+ Unité</button>' +
      '<button class="btn" data-act="newspell" data-a="' + esc(a.id) + '">+ Sort</button>' +
      '<button class="btn ghost" data-act="exportarmy" data-id="' + esc(a.id) + '">Exporter</button>' +
      '<button class="btn ghost" data-act="copyarmy" data-id="' + esc(a.id) + '">Copier le JSON</button></div>' +
      '<h2>Compositions & sous-factions</h2>' +
      '<p class="muted">Chaque composition porte ses limites de points par catégorie (en %), utilisées par le constructeur.</p>' + comps +
      '<button class="btn ghost" data-act="newcomp" data-a="' + esc(a.id) + '">+ Composition</button>' +
      '<h2>Unités</h2>' + (unitsHtml || '<p class="muted">Aucune unité. Ajoutez la première.</p>') +
      '<h2>Sorts</h2>' + (spellsHtml || '<p class="muted">Aucun sort.</p>');
  }

  /* ---------------------------------------------------- fiche d'une unité */
  function parseOpts(t) {
    let g = '';
    const out = [];
    String(t || '').split('\n').forEach((l) => {
      l = l.trim();
      if (!l) return;
      if (l[0] === '#') { g = l.replace(/^#+\s*/, ''); return; }
      const p = l.split('|').map((s) => s.trim());
      if (!p[0]) return;
      out.push({ g, name: p[0], pts: num(p[1]), per: /^m/i.test(p[2] || '') });
    });
    return out;
  }
  function optsToText(o) {
    let g = null, s = '';
    (o || []).forEach((x) => {
      if (x.g !== g) { g = x.g; if (g) s += '# ' + g + '\n'; }
      s += x.name + ' | ' + x.pts + (x.per ? ' | m' : '') + '\n';
    });
    return s.trim();
  }
  function optsHtml(o, checked, attrs) {
    const groups = {};
    (o || []).forEach((x, i) => { (groups[x.g || 'Options'] = groups[x.g || 'Options'] || []).push([x, i]); });
    return Object.keys(groups).map((g) => '<div class="optgroup"><strong>' + esc(g) + '</strong>' + groups[g].map((p) => {
      const x = p[0], i = p[1];
      const lbl = esc(x.name) + ' <span class="muted">+' + x.pts + ' pts' + (x.per ? '/fig.' : '') + '</span>';
      return checked ? '<label class="check"><input type="checkbox" ' + attrs + ' data-i="' + i + '"' + (checked.indexOf(i) >= 0 ? ' checked' : '') + '> ' + lbl + '</label>' : '<div>' + lbl + '</div>';
    }).join('') + '</div>').join('');
  }
  function ruleIdsOf(u) {
    const lu = u.libId ? getUnit(u.libId) : null;
    const src = lu || u;
    const ids = (src.rules || []).slice();
    if (src.troop) ids.push(src.troop);
    if (num(src.wizard) > 0) ids.push('wizard');
    return Array.from(new Set(ids)).filter((i) => GI[i]);
  }
  function profTable(rows) {
    rows = (rows || []).filter((r) => r && (r.n || PROF.some((p) => r[p[0]])));
    if (!rows.length) return '';
    return '<div class="scroll"><table class="prof"><thead><tr><th></th>' + PROF.map((p) => '<th>' + p[1] + '</th>').join('') + '</tr></thead><tbody>' +
      rows.map((r) => '<tr><th>' + esc(r.n || '') + '</th>' + PROF.map((p) => '<td>' + esc(r[p[0]] || '–') + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>';
  }

  function viewUnit(id) {
    const u = getUnit(id);
    if (!u) return '<h1>Unité introuvable</h1><p><a href="#armees">← Armées</a></p>';
    const a = getArmy(u.army);
    const ids = ruleIdsOf({ libId: id });
    const chips = ids.map((r) => '<a class="chip" href="#regle-' + esc(r) + '" data-k="' + esc(r) + '">' + esc(GI[r].fr) + '</a>').join('');
    const sp = (u.spells || []).map(getSpell).filter(Boolean).map((s) => '<a class="chip" href="#sort-' + esc(s.id) + '">' + esc(s.name) + '</a>').join('');
    const url = safeUrl(u.url);
    return '<p><a href="#armee-' + esc(u.army) + '">← ' + esc(a ? a.name : 'Armée') + '</a></p>' +
      '<div class="row between"><h1>' + esc(u.name) + '</h1><span class="badge">' + esc(UCATS[u.cat] || '') + '</span></div>' +
      '<div class="card">' + profTable(u.prof) +
      '<div class="sum" style="margin-top:10px"><div><small>Coût de base</small><b>' + num(u.base) + ' pts</b></div>' +
      '<div><small>Effectif</small><b>' + (num(u.sizeMin) ? u.sizeMin + (num(u.sizeMax) && u.sizeMax !== u.sizeMin ? '–' + u.sizeMax : '') : '–') + '</b></div>' +
      (num(u.ppm) ? '<div><small>Par fig. en plus</small><b>' + num(u.ppm) + ' pts</b></div>' : '') +
      (u.save ? '<div><small>Sauvegarde</small><b>' + esc(u.save) + '</b></div>' : '') + '</div></div>' +
      (chips ? '<h2>Règles spéciales</h2><div class="chips">' + chips + '</div>' : '') +
      (u.extra ? '<p>' + kwBlock(u.extra) + '</p>' : '') +
      (u.equip ? '<h2>Équipement</h2><p>' + kwBlock(u.equip) + '</p>' : '') +
      ((u.opts || []).length ? '<h2>Options & améliorations</h2><div class="card">' + optsHtml(u.opts, null) + '</div>' : '') +
      (sp ? '<h2>Sorts</h2><div class="chips">' + sp + '</div>' : '') +
      (u.notes ? '<h2>Notes</h2><p>' + kwBlock(u.notes) + '</p>' : '') +
      (url ? '<p><a class="btn ghost" href="' + esc(url) + '" target="_blank" rel="noopener">Fiche officielle ↗</a></p>' : '') +
      '<div class="row" style="margin-top:12px"><button class="btn ghost" data-act="editunit" data-id="' + esc(u.id) + '">Modifier</button>' +
      '<button class="btn ghost" data-act="dupunitlib" data-id="' + esc(u.id) + '">Dupliquer</button>' +
      '<button class="btn danger" data-act="delunitlib" data-id="' + esc(u.id) + '">Supprimer</button></div>';
  }

  function viewSpell(id) {
    const s = getSpell(id);
    if (!s) return '<h1>Sort introuvable</h1><p><a href="#armees">← Armées</a></p>';
    const a = getArmy(s.army);
    const t = SPELL_TYPES.find((x) => x[0] === s.type);
    const ph = SPELL_PHASE[s.type];
    const url = safeUrl(s.url);
    return '<p><a href="#armee-' + esc(s.army) + '">← ' + esc(a ? a.name : 'Armée') + '</a></p>' +
      '<h1>' + esc(s.name) + '</h1><div class="muted">' + esc(s.lore || '') + '</div>' +
      '<div class="card"><div class="sum"><div><small>Incantation</small><b>' + esc(s.cast || '?') + '</b></div>' +
      '<div><small>Portée</small><b>' + esc(s.range || '–') + '</b></div>' +
      '<div><small>Catégorie</small><b>' + (t ? '<a class="kw" href="#regle-' + esc(t[0]) + '" data-k="' + esc(t[0]) + '">' + esc(t[1]) + '</a>' : '–') + '</b></div></div>' +
      (ph ? '<p class="muted">Se lance : ' + esc(PHASE_NAME[ph[0]]) + (ph[1] === 'both' ? ' (les deux tours)' : '') + '</p>' : '') +
      (s.txt ? '<p>' + kwBlock(s.txt) + '</p>' : '') + '</div>' +
      (url ? '<p><a class="btn ghost" href="' + esc(url) + '" target="_blank" rel="noopener">Texte officiel ↗</a></p>' : '') +
      '<div class="row"><button class="btn ghost" data-act="editspell" data-id="' + esc(s.id) + '">Modifier</button>' +
      '<button class="btn danger" data-act="delspell" data-id="' + esc(s.id) + '">Supprimer</button></div>';
  }

  /* ------------------------------------------------ vue : liste des listes */
  function calcPts(u) {
    const lu = u.libId ? getUnit(u.libId) : null;
    if (!lu) return num(u.pts);
    const min = num(lu.sizeMin);
    const size = num(u.size) || min || 1;
    let p = num(lu.base) + Math.max(0, size - min) * num(lu.ppm);
    (lu.opts || []).forEach((o, i) => { if ((u.opts || []).indexOf(i) >= 0) p += num(o.pts) * (o.per ? size : 1); });
    return p;
  }
  const unitName = (u) => (u.libId && getUnit(u.libId) ? getUnit(u.libId).name : u.name) || 'Unité';
  const unitCat = (u) => (u.libId && getUnit(u.libId) ? getUnit(u.libId).cat : u.cat);
  const listTotal = (l) => (l.units || []).reduce((s, u) => s + calcPts(u), 0);

  function viewLists() {
    const cards = state.lists.map((l) => {
      const tot = listTotal(l), lim = num(l.limit), a = getArmy(l.armyId);
      return '<a class="card" href="#liste-' + esc(l.id) + '"><div class="row between"><h3>' + esc(l.name || 'Sans nom') + '</h3>' +
        '<span class="' + (lim && tot > lim ? 'bad' : '') + '">' + tot + (lim ? ' / ' + lim : '') + ' pts</span></div>' +
        '<div class="muted">' + esc((a ? a.name : l.army) || 'Armée non précisée') + ' · ' + (l.units || []).length + ' unité(s)</div></a>';
    }).join('');
    return '<h1>Mes listes d\'armée</h1>' +
      '<div class="row" style="margin:10px 0"><button class="btn" data-act="newlist">+ Nouvelle liste</button>' +
      '<button class="btn ghost" data-act="importlists">Importer (JSON)</button></div>' +
      (cards || '<p class="muted">Aucune liste pour l\'instant. Créez-en une, choisissez l\'armée et la composition, puis ajoutez des unités de votre bibliothèque.</p>');
  }

  /* ------------------------------------------------ vue : éditeur de liste */
  function effLimits(l) {
    const a = getArmy(l.armyId);
    const c = a && (a.comps || []).find((x) => x.id === l.compId);
    return c ? c.limits || {} : l.limits || {};
  }

  function summaryHtml(l) {
    const tot = listTotal(l), lim = num(l.limit);
    const byCat = {};
    (l.units || []).forEach((u) => { byCat[unitCat(u)] = (byCat[unitCat(u)] || 0) + calcPts(u); });
    const base = lim || tot || 1;
    const pct = Math.min(100, Math.round((tot / (lim || tot || 1)) * 100));
    const L = effLimits(l);
    let html = '<div class="sum"><div><small>Total</small><b class="' + (lim && tot > lim ? 'bad' : '') + '">' + tot + (lim ? ' / ' + lim : '') + ' pts</b>' +
      (lim ? '<div class="bar"><i class="' + (tot > lim ? 'over' : '') + '" style="width:' + pct + '%"></i></div>' : '') + '</div>' +
      '<div><small>Unités</small><b>' + (l.units || []).length + '</b></div>' +
      '<div><small>Figurines</small><b>' + (l.units || []).reduce((s, u) => s + (num(u.size) || (u.libId && getUnit(u.libId) ? num(getUnit(u.libId).sizeMin) : 0)), 0) + '</b></div></div>';
    const lines = [];
    Object.keys(UCATS).forEach((c) => {
      const v = byCat[c] || 0, p = Math.round((v / base) * 1000) / 10;
      const lm = L[c] || {};
      const mx = lm.max !== undefined && lm.max !== '' && lm.max !== null ? Number(lm.max) : null;
      const mn = lm.min !== undefined && lm.min !== '' && lm.min !== null ? Number(lm.min) : null;
      if (!v && mx === null && mn === null) return;
      const bad = (mx !== null && p > mx) || (mn !== null && p < mn);
      lines.push('<li class="' + (bad ? 'bad' : '') + '">' + esc(UCATS[c]) + ' : ' + v + ' pts (' + p + ' %)' +
        (mn !== null ? ' · min ' + mn + ' %' : '') + (mx !== null ? ' · max ' + mx + ' %' : '') + (bad ? ' ⚠' : '') + '</li>');
    });
    if (lines.length) html += '<ul style="margin:10px 0 0;padding-left:18px">' + lines.join('') + '</ul>';
    return html;
  }
  function refreshSummary(l) { const el = $('#sum'); if (el) el.innerHTML = summaryHtml(l); }

  function unitCard(l, u, i) {
    const lu = u.libId ? getUnit(u.libId) : null;
    const ids = ruleIdsOf(u);
    const chips = ids.map((r) => '<a class="chip" href="#regle-' + esc(r) + '" data-k="' + esc(r) + '">' + esc(GI[r].fr) + '</a>').join('');
    const size = num(u.size) || (lu ? num(lu.sizeMin) : 0);
    let body = '';
    if (lu) {
      body += '<div class="row"><label for="sz-' + esc(u.id) + '" style="margin:0">Effectif</label><input type="number" id="sz-' + esc(u.id) + '" style="width:80px" min="' + num(lu.sizeMin) + '"' +
        (num(lu.sizeMax) ? ' max="' + num(lu.sizeMax) + '"' : '') + ' value="' + size + '" data-bind="usize" data-id="' + esc(u.id) + '">' +
        (num(lu.sizeMin) ? '<small>' + lu.sizeMin + (num(lu.sizeMax) ? '–' + lu.sizeMax : '+') + ' fig.</small>' : '') + '</div>';
      if ((lu.opts || []).length) body += '<details' + ((u.opts || []).length ? ' open' : '') + '><summary>Options & améliorations</summary>' + optsHtml(lu.opts, u.opts || [], 'data-bind="uopt" data-id="' + esc(u.id) + '"') + '</details>';
      const sp = (lu.spells || []).map(getSpell).filter(Boolean);
      if (sp.length) body += '<div class="chips">' + sp.map((s) => '<a class="chip" href="#sort-' + esc(s.id) + '">✦ ' + esc(s.name) + '</a>').join('') + '</div>';
    } else if (u.notes) body += '<p>' + esc(u.notes) + '</p>';
    return '<div class="card"><div class="row between"><h3>' + (lu ? '<a href="#unite-' + esc(lu.id) + '">' + esc(lu.name) + '</a>' : esc(u.name || 'Unité')) +
      (size ? ' <small>×' + size + '</small>' : '') + '</h3><strong>' + calcPts(u) + ' pts</strong></div>' +
      '<div class="muted">' + esc(UCATS[unitCat(u)] || '') + (lu && num(lu.wizard) ? ' · Magicien niv. ' + num(lu.wizard) : (!lu && num(u.wizard) ? ' · Magicien niv. ' + num(u.wizard) : '')) + '</div>' +
      (chips ? '<div class="chips">' + chips + '</div>' : '') + body +
      '<div class="row no-print" style="margin-top:6px">' + (lu ? '' : '<button class="btn small ghost" data-act="editfree" data-id="' + esc(u.id) + '">Modifier</button>') +
      '<button class="btn small ghost" data-act="dupunit" data-id="' + esc(u.id) + '">Dupliquer</button>' +
      '<button class="btn small ghost" data-act="upunit" data-id="' + esc(u.id) + '" aria-label="Monter"' + (i === 0 ? ' disabled' : '') + '>↑</button>' +
      '<button class="btn small ghost" data-act="downunit" data-id="' + esc(u.id) + '" aria-label="Descendre"' + (i === l.units.length - 1 ? ' disabled' : '') + '>↓</button>' +
      '<button class="btn small danger" data-act="delunit" data-id="' + esc(u.id) + '">Supprimer</button></div></div>';
  }
  function unitsHtml(l) {
    if (!(l.units || []).length) return '<p class="muted">Aucune unité. Ajoutez-en depuis votre bibliothèque, ou créez une unité libre.</p>';
    return Object.keys(UCATS).map((c) => {
      const idx = l.units.map((u, i) => [u, i]).filter((p) => unitCat(p[0]) === c);
      if (!idx.length) return '';
      return '<h3 class="cat-h">' + esc(UCATS[c]) + ' <small>' + idx.reduce((s, p) => s + calcPts(p[0]), 0) + ' pts</small></h3>' + idx.map((p) => unitCard(l, p[0], p[1])).join('');
    }).join('');
  }

  function viewList(id) {
    const l = getList(id);
    if (!l) return '<h1>Liste introuvable</h1><p><a href="#listes">← Mes listes</a></p>';
    const a = getArmy(l.armyId);
    const armyOpts = '<option value="">— armée libre —</option>' + state.armies.slice().sort(byFr).map((x) => '<option value="' + esc(x.id) + '"' + (x.id === l.armyId ? ' selected' : '') + '>' + esc(x.name) + '</option>').join('');
    const compOpts = a ? '<option value="">— aucune —</option>' + (a.comps || []).map((c) => '<option value="' + esc(c.id) + '"' + (c.id === l.compId ? ' selected' : '') + '>' + esc(c.name) + '</option>').join('') : '';
    const limRows = Object.keys(UCATS).map((c) => {
      const lm = (l.limits || {})[c] || {};
      return '<div class="row"><span style="width:110px">' + esc(UCATS[c]) + '</span>' +
        '<input type="number" min="0" max="100" placeholder="min %" data-bind="lmin" data-cat="' + c + '" value="' + esc(lm.min == null ? '' : lm.min) + '" style="width:90px" aria-label="Minimum % ' + esc(UCATS[c]) + '">' +
        '<input type="number" min="0" max="100" placeholder="max %" data-bind="lmax" data-cat="' + c + '" value="' + esc(lm.max == null ? '' : lm.max) + '" style="width:90px" aria-label="Maximum % ' + esc(UCATS[c]) + '"></div>';
    }).join('');
    return '<p class="no-print"><a href="#listes">← Mes listes</a></p>' +
      '<label for="lname">Nom de la liste</label><input type="text" id="lname" data-bind="lname" data-id="' + esc(l.id) + '" value="' + esc(l.name) + '">' +
      '<div class="grid2"><div><label for="larmy">Armée</label><select id="larmy" data-bind="larmy">' + armyOpts + '</select></div>' +
      '<div><label for="lcomp">Composition</label>' + (a ? '<select id="lcomp" data-bind="lcomp">' + compOpts + '</select>' : '<input type="text" id="lcomp" disabled placeholder="Choisissez d\'abord une armée">') + '</div>' +
      '<div><label for="llimit">Limite de points</label><input type="number" id="llimit" min="0" step="50" data-bind="llimit" value="' + esc(l.limit || '') + '" placeholder="ex. 2000"></div></div>' +
      '<div id="sum" class="card" style="margin-top:12px">' + summaryHtml(l) + '</div>' +
      (a && (a.comps || []).find((c) => c.id === l.compId) ? '' :
        '<details class="no-print"><summary>Contraintes de composition de cette liste (en % des points)</summary>' + limRows + '</details>') +
      '<div class="row between" style="margin:14px 0 8px"><h2 style="margin:0">Unités</h2><span class="row no-print"><button class="btn" data-act="addunit">+ Ajouter une unité</button></span></div>' +
      '<div id="units">' + unitsHtml(l) + '</div>' +
      '<div class="row no-print" style="margin-top:14px">' +
      '<button class="btn ghost" data-act="usephases" data-id="' + esc(l.id) + '">Utiliser dans Phases</button>' +
      '<button class="btn ghost" data-act="copylist" data-id="' + esc(l.id) + '">Copier en texte</button>' +
      '<button class="btn ghost" data-act="exportlist" data-id="' + esc(l.id) + '">Exporter</button>' +
      '<button class="btn ghost" data-act="duplist" data-id="' + esc(l.id) + '">Dupliquer</button>' +
      '<button class="btn danger" data-act="dellist" data-id="' + esc(l.id) + '">Supprimer la liste</button></div>';
  }

  function listText(l) {
    const tot = listTotal(l), lim = num(l.limit), a = getArmy(l.armyId);
    let t = (l.name || 'Liste') + ((a && a.name) || l.army ? ' — ' + (a ? a.name : l.army) : '') + ' — ' + tot + (lim ? '/' + lim : '') + ' pts\n';
    Object.keys(UCATS).forEach((c) => {
      const us = (l.units || []).filter((u) => unitCat(u) === c);
      if (!us.length) return;
      t += '\n' + UCATS[c].toUpperCase() + '\n';
      us.forEach((u) => {
        const lu = u.libId ? getUnit(u.libId) : null;
        const opts = lu ? (u.opts || []).map((i) => lu.opts[i] && lu.opts[i].name).filter(Boolean).join(', ') : '';
        const size = num(u.size) || (lu ? num(lu.sizeMin) : 0);
        t += '- ' + unitName(u) + (size ? ' ×' + size : '') + ' — ' + calcPts(u) + ' pts' + (opts ? ' [' + opts + ']' : '') + '\n';
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
    g.step = 0;
    save();
  }

  function remindersHtml(list, phase, side) {
    const groups = {};
    const add = (key, o, unit) => {
      if (!groups[key]) groups[key] = Object.assign({ units: [] }, o);
      if (groups[key].units.indexOf(unit) < 0) groups[key].units.push(unit);
    };
    (list.units || []).forEach((u) => {
      const label = unitName(u);
      ruleIdsOf(u).forEach((rid) => {
        (GI[rid].uses || []).forEach((use) => {
          if (use.p !== phase.id || !(use.s === side || use.s === 'both')) return;
          add(rid + '|' + use.n, { rid, n: use.n }, label);
        });
      });
      const lu = u.libId ? getUnit(u.libId) : null;
      (lu ? lu.spells || [] : []).map(getSpell).filter(Boolean).forEach((s) => {
        const ph = SPELL_PHASE[s.type];
        if (!ph || ph[0] !== phase.id || !(ph[1] === side || ph[1] === 'both')) return;
        add('sp|' + s.id, { spell: s }, label);
      });
    });
    const items = Object.keys(groups).map((k) => groups[k]);
    if (!items.length) return '<p class="muted">Aucun rappel spécifique pour votre liste dans cette phase.</p>';
    return '<ul>' + items.map((g) => g.spell ?
      '<li>✦ Sort <a href="#sort-' + esc(g.spell.id) + '">' + esc(g.spell.name) + '</a> — incantation ' + esc(g.spell.cast || '?') + '<br><span class="units">' + esc(g.units.join(', ')) + '</span></li>' :
      '<li><a class="kw" href="#regle-' + esc(g.rid) + '" data-k="' + esc(g.rid) + '">' + esc(GI[g.rid].fr) + '</a> — ' + kw(g.n, g.rid) + '<br><span class="units">' + esc(g.units.join(', ')) + '</span></li>').join('') + '</ul>';
  }

  function flowHtml(side) {
    const g = state.game;
    return '<div class="flow">' + T.PHASES.map((p, pi) =>
      '<div class="fphase' + (pi === g.phase ? ' on' : '') + '"><div class="fhead"><b>' + esc(p.fr) + '</b>' + (p.perUnit ? '<small>unité par unité</small>' : '') + '</div>' +
      p.subs.map((s, si) =>
        (si ? '<div class="farrow" aria-hidden="true">↓</div>' : '') +
        '<div class="fnode' + (pi === g.phase && si === g.step ? ' on' : '') + '" role="button" tabindex="0" data-act="gostep" data-phase="' + pi + '" data-step="' + si + '">' +
        '<b>' + esc(s.fr) + '</b><span>' + kw(s.short[side]) + '</span></div>').join('') + '</div>').join('<div class="farrow wide" aria-hidden="true">→</div>') +
      '</div><p class="hint">Fin du tour : l\'adversaire commence aussitôt le sien, avec le même enchaînement.</p>';
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
      '<p class="hint">Aucune liste d\'armée pour l\'instant : <a href="#listes">créez-en une</a> pour obtenir des rappels adaptés à vos unités et à vos sorts.</p>';

    const sideTabs = ['me', 'opp'].map((s) => '<button class="' + (s === side ? 'on' : '') + '" data-act="side" data-side="' + s + '">' + SIDE[s] + '</button>').join('');

    const steps = phase.subs.map((s, si) =>
      '<div class="card step' + (si === g.step ? ' sel' : '') + '" id="st-' + esc(s.id) + '"><div class="row between"><h3>' + esc(s.fr) + ' <small class="en">' + esc(s.en) + '</small></h3>' +
      '<a href="' + esc(officialUrl(s.path)) + '" target="_blank" rel="noopener" class="muted">Officiel ↗</a></div>' +
      '<p><b>' + (side === 'me' ? 'Vous :' : 'Pendant son tour :') + '</b> ' + kw(s[side]) + '</p>' +
      '<ul class="bul">' + s.bul.map((b) => '<li>' + kw(b, null, false) + '</li>').join('') + '</ul></div>').join('');

    return '<h1>Assistant de phases</h1>' +
      '<div class="card"><div class="row between"><div><b>Tour de jeu ' + g.round + '</b> · ' + (secondPlayer ? '2<sup>e</sup>' : '1<sup>er</sup>') + ' joueur<br><span class="muted">' + SIDE[side] + ' — ' + esc(phase.fr) + '</span></div>' +
      '<div class="row"><button class="btn ghost small" data-act="prev" aria-label="Phase précédente">←</button><button class="btn small" data-act="next">Phase suivante →</button></div></div>' +
      '<label class="check"><input type="checkbox" data-bind="istart"' + (g.iStart ? ' checked' : '') + '> Je joue en premier</label></div>' +
      listSel +
      '<div class="seg" role="group" aria-label="Tour">' + sideTabs + '</div>' +
      '<h2>Schéma du tour</h2><p class="muted">Touchez une étape pour voir son détail. Les mots soulignés ouvrent la règle.</p>' +
      flowHtml(side) +
      '<div class="row between"><h2 style="margin:0">' + esc(phase.fr) + ' <small class="en">' + esc(phase.en) + '</small></h2><a href="' + esc(officialUrl(phase.path)) + '" target="_blank" rel="noopener">Officiel ↗</a></div>' +
      '<p>' + esc(phase.intro) + '</p>' +
      (phase.note ? '<p class="hint">' + esc(phase.note) + '</p>' : '') +
      (side === 'opp' ? '<p class="hint">C\'est le tour de l\'adversaire : voici ce que vous pouvez ou devez faire pendant ses étapes.</p>' : '') +
      (list ? '<div class="card remind"><h3>Votre armée — ' + esc(list.name || 'Sans nom') + '</h3>' + remindersHtml(list, phase, side) + '</div>' : '') +
      '<div class="steps" id="detail">' + steps + '</div>';
  }

  /* -------------------------------------------------------------- vue : à propos */
  function viewAbout() {
    return '<h1>À propos</h1>' +
      '<div class="card"><p>Outil de fan <b>non officiel</b>, non affilié à Games Workshop. Les règles sont des <b>résumés personnels en français</b> destinés à servir d\'aide-mémoire : ils ne remplacent pas le livre de règles. Pour le texte exact, chaque fiche renvoie à l\'index officiel en ligne <a href="https://tow.whfb.app/" target="_blank" rel="noopener">tow.whfb.app</a> (en anglais).</p>' +
      '<p>Les noms français sont des traductions libres ; le nom anglais est affiché à côté.</p></div>' +
      '<h2>Vos données</h2><div class="card"><p>Tout est enregistré localement sur cet appareil (armées, unités, sorts, listes, notes). Rien n\'est envoyé en ligne. Pensez à exporter une sauvegarde de temps en temps.</p>' +
      '<div class="row"><button class="btn ghost" data-act="exportall">Exporter tout (JSON)</button><button class="btn ghost" data-act="copyall">Copier le JSON</button><button class="btn ghost" data-act="importfull">Importer une sauvegarde</button></div></div>' +
      '<h2>Installer l\'app</h2><div class="card"><p>Ouvrez cette page depuis un hébergement HTTPS puis utilisez « Ajouter à l\'écran d\'accueil » ou « Installer l\'application ». Une fois installée, elle fonctionne hors ligne (sauf les liens officiels).</p></div>';
  }

  /* -------------------------------------------------------------- boîtes de dialogue */
  const dlg = $('#dlg');
  function openDlg(html) { dlg.innerHTML = html; if (!dlg.open) { if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', ''); } }
  function closeDlg() { if (dlg.open) { if (dlg.close) dlg.close(); else dlg.removeAttribute('open'); } }
  let pendingYes = null;
  function ask(msg, yes) {
    pendingYes = yes;
    openDlg('<h2>Confirmer</h2><p>' + esc(msg) + '</p><div class="row" style="margin-top:14px"><button class="btn danger" data-act="yes">Supprimer</button><button class="btn ghost" data-act="closedlg">Annuler</button></div>');
  }
  const cancelBtn = '<button class="btn ghost" type="button" data-act="closedlg">Annuler</button>';

  function openArmyForm(id) {
    const a = id ? getArmy(id) : null;
    openDlg('<form id="aform"><h2>' + (a ? 'Renommer l\'armée' : 'Nouvelle armée') + '</h2><input type="hidden" name="id" value="' + esc(a ? a.id : '') + '">' +
      '<label for="a_name">Nom</label><input type="text" id="a_name" name="name" list="armynames" value="' + esc(a ? a.name : '') + '" required>' +
      '<datalist id="armynames">' + T.ARMIES.map((n) => '<option value="' + esc(n) + '">').join('') + '</datalist>' +
      '<div class="row" style="margin-top:14px"><button class="btn" type="submit">Enregistrer</button>' + cancelBtn + '</div></form>');
  }

  function openCompForm(aid, cid) {
    const a = getArmy(aid); if (!a) return;
    const c = cid ? (a.comps || []).find((x) => x.id === cid) : null;
    const L = (c && c.limits) || {};
    openDlg('<form id="cform"><h2>' + (c ? 'Modifier la composition' : 'Nouvelle composition') + '</h2><input type="hidden" name="a" value="' + esc(aid) + '"><input type="hidden" name="id" value="' + esc(c ? c.id : '') + '">' +
      '<label for="c_name">Nom (armée principale, sous-faction…)</label><input type="text" id="c_name" name="name" value="' + esc(c ? c.name : '') + '" required>' +
      '<p class="muted">Limites en % des points de la liste (laissez vide si aucune).</p>' +
      Object.keys(UCATS).map((k) => '<div class="row"><span style="width:110px">' + esc(UCATS[k]) + '</span>' +
        '<input type="number" min="0" max="100" name="min_' + k + '" placeholder="min %" value="' + esc(L[k] && L[k].min != null ? L[k].min : '') + '" style="width:90px" aria-label="Min ' + esc(UCATS[k]) + '">' +
        '<input type="number" min="0" max="100" name="max_' + k + '" placeholder="max %" value="' + esc(L[k] && L[k].max != null ? L[k].max : '') + '" style="width:90px" aria-label="Max ' + esc(UCATS[k]) + '"></div>').join('') +
      '<div class="row" style="margin-top:14px"><button class="btn" type="submit">Enregistrer</button>' + cancelBtn + '</div></form>');
  }

  let draft = null;
  /* Lecture d'une page d'unité copiée depuis tow.whfb.app (texte collé par l'utilisateur) */
  function splitSheets(text) {
    const out = []; let cur = [];
    String(text || '').replace(/\r/g, '').split('\n').forEach((l) => {
      cur.push(l);
      if (/\|\s*Warhammer: The Old World\s*$/i.test(l.trim())) { out.push(cur.join('\n')); cur = []; }
    });
    if (cur.join('').trim()) out.push(cur.join('\n'));
    return out.filter((s) => /Unit Category|Troop Type|\bLd\b/i.test(s));
  }
  function parseSheet(text) {
    const lines = String(text || '').replace(/\r/g, '').split('\n').map((l) => l.trim());
    const out = {}; const notes = [];
    let name = '';
    const tail = lines.filter((l) => /\|\s*Warhammer: The Old World\s*$/i.test(l)).pop();
    if (tail) name = tail.replace(/\|\s*Warhammer: The Old World\s*$/i, '').trim();
    if (!name) { const i = lines.findIndex((l) => /Online Rules Index/i.test(l)); name = (lines.slice(i + 1).find((l) => l) || '').trim(); }
    if (name) out.name = name;
    const hi = lines.findIndex((l) => /^M\s+WS\s+BS\s+S\s+T\s+W\s+I\s+A\s+Ld$/i.test(l));
    if (hi >= 0) {
      const rows = [];
      for (let k = hi + 1; k < lines.length && lines[k] && !/^Unit Category/i.test(lines[k]); k++) {
        const tk = lines[k].split(/\s+/);
        if (tk.length < 10) break;
        const vals = tk.slice(-9);
        if (!vals.every((v) => /^[\d*+\-\/]+$/.test(v))) break;
        const r = { n: tk.slice(0, -9).join(' ') };
        PROF.forEach((p, j) => { r[p[0]] = vals[j]; });
        rows.push(r);
      }
      if (rows.length) out.prof = rows.slice(0, 3);
    }
    const grab = (re) => { for (const l of lines) { const m = l.match(re); if (m) return m[1].trim(); } return ''; };
    const block = (label) => {
      const i = lines.findIndex((l) => l.toLowerCase().startsWith(label.toLowerCase() + ':'));
      if (i < 0) return '';
      let s = lines[i].slice(label.length + 1).trim();
      for (let k = i + 1; k < lines.length && lines[k] && !/^(Optional Rules|Special Rules|Switch Index|Links|Equipment|Unit Size|Base Size|Troop Type|Unit Category)\b/i.test(lines[k]); k++) s += '\n' + lines[k];
      return s;
    };
    const cat = grab(/^Unit Category:\s*(.+)/i), troop = grab(/^Troop Type:\s*(.+)/i);
    const tt = (troop + ' ' + cat).toLowerCase();
    out.troop = /chariot/.test(tt) ? 'chariots' : /monster/.test(tt) ? 'monsters' : /war machine/.test(tt) ? 'war-machine' : /cavalry/.test(tt) ? 'cavalry' : /infantry/.test(tt) ? 'infantry' : '';
    if (/character/.test(tt)) out.cat = 'hero';
    const us = grab(/^Unit Size:\s*(.+)/i).match(/(\d+)\s*(?:[-–]\s*(\d+))?/);
    if (us) { out.sizeMin = +us[1]; out.sizeMax = us[2] ? +us[2] : 0; }
    const eq = block('Equipment'); if (eq) out.equip = eq;
    const src = lines.find((l) => /,\s*p\.\s*\d+/i.test(l)); if (src) notes.push('Source : ' + src);
    const bs = grab(/^Base Size:\s*(.+)/i); if (bs) notes.push('Socle : ' + bs);
    const split = (s) => s.split('\n').join(',').split(/,|(?<=[a-z0-9)])(?=[A-Z])/).map((x) => x.trim()).filter(Boolean);
    const rules = []; const extra = [];
    const byEn = {}; G.forEach((e) => { byEn[(e.en || '').replace(/\s*\(.*\)\s*$/, '').toLowerCase()] = e.id; byEn[e.fr.toLowerCase()] = e.id; });
    const sort = (s) => split(s).forEach((r) => {
      const m = r.match(/^(.*?)\s*(\(.*\)|\{.*\}|\d\+|X)?$/); const base = (m ? m[1] : r).toLowerCase();
      const id = byEn[base];
      if (id) { if (rules.indexOf(id) < 0) rules.push(id); if (m && m[2]) extra.push(GI[id].fr + ' ' + m[2]); } else extra.push(r);
    });
    sort(block('Special Rules'));
    out.rules = rules;
    out.extra = extra.length ? 'Autres règles / précisions : ' + extra.join(', ') : '';
    const opt = split(block('Optional Rules')); if (opt.length) notes.push('Règles optionnelles : ' + opt.join(', '));
    if (notes.length) out.notes = notes.join('\n');
    return out;
  }

  function openUnitForm(aid, uid_, preset) {
    const ex = uid_ ? getUnit(uid_) : null;
    draft = ex ? clone(ex) : { id: uid(), army: aid, name: '', cat: 'core', troop: 'infantry', prof: [{}, {}, {}], save: '', sizeMin: 10, sizeMax: 0, base: 0, ppm: 0, opts: [], equip: '', rules: [], extra: '', wizard: 0, spells: [], notes: '', url: '' };
    if (preset) Object.keys(preset).forEach((k) => { if (preset[k] !== '' && preset[k] != null && !(Array.isArray(preset[k]) && !preset[k].length)) draft[k] = preset[k]; });
    while (draft.prof.length < 3) draft.prof.push({});
    draft.rules = draft.rules || []; draft.spells = draft.spells || [];
    const catOpts = Object.keys(UCATS).map((c) => '<option value="' + c + '"' + (draft.cat === c ? ' selected' : '') + '>' + esc(UCATS[c]) + '</option>').join('');
    const troopOpts = TROOPS.map((t) => '<option value="' + t[0] + '"' + (draft.troop === t[0] ? ' selected' : '') + '>' + esc(t[1]) + '</option>').join('');
    const prof = '<div class="scroll"><table class="prof edit"><thead><tr><th></th>' + PROF.map((p) => '<th>' + p[1] + '</th>').join('') + '</tr></thead><tbody>' +
      draft.prof.slice(0, 3).map((r, i) => '<tr><td><input type="text" name="pn' + i + '" value="' + esc(r.n || '') + '" placeholder="' + (i ? 'Ligne ' + (i + 1) : 'Unité') + '" aria-label="Nom de la ligne ' + (i + 1) + '"></td>' +
        PROF.map((p) => '<td><input type="text" name="p' + i + '_' + p[0] + '" value="' + esc(r[p[0]] || '') + '" aria-label="' + p[1] + ' ligne ' + (i + 1) + '"></td>').join('') + '</tr>').join('') + '</tbody></table></div>';
    const armySpells = spellsOf(draft.army);
    openDlg('<form id="uform"><h2>' + (ex ? 'Modifier l\'unité' : 'Nouvelle unité') + '</h2>' +
      '<details class="paste"' + (ex ? '' : ' open') + '><summary>Coller une fiche depuis tow.whfb.app</summary>' +
      '<p class="muted">Ouvrez la page de l\'unité, sélectionnez tout (Ctrl+A), copiez, puis collez ici. Vous pouvez coller <b>plusieurs pages à la suite</b> : chaque unité est créée d\'un coup. Le profil, la taille, l\'équipement et les règles sont remplis ; il restera à saisir les points, la catégorie et les options.</p>' +
      '<textarea id="u_paste" placeholder="Collez le texte de la page ici…"></textarea><button type="button" class="btn ghost" data-act="parseunit">Remplir la fiche</button></details>' +
      '<label for="u_name">Nom</label><input type="text" id="u_name" name="name" value="' + esc(draft.name) + '" required>' +
      '<div class="grid2"><div><label for="u_cat">Catégorie</label><select id="u_cat" name="cat">' + catOpts + '</select></div>' +
      '<div><label for="u_troop">Type de troupe</label><select id="u_troop" name="troop">' + troopOpts + '</select></div>' +
      '<div><label for="u_smin">Effectif minimum</label><input type="number" id="u_smin" name="sizeMin" min="0" value="' + esc(draft.sizeMin) + '"></div>' +
      '<div><label for="u_smax">Effectif maximum (0 = illimité)</label><input type="number" id="u_smax" name="sizeMax" min="0" value="' + esc(draft.sizeMax) + '"></div>' +
      '<div><label for="u_base">Points (effectif minimum)</label><input type="number" id="u_base" name="base" min="0" value="' + esc(draft.base) + '"></div>' +
      '<div><label for="u_ppm">Points par figurine en plus</label><input type="number" id="u_ppm" name="ppm" min="0" value="' + esc(draft.ppm) + '"></div>' +
      '<div><label for="u_save">Sauvegarde d\'armure</label><input type="text" id="u_save" name="save" value="' + esc(draft.save) + '" placeholder="ex. 5+"></div>' +
      '<div><label for="u_wiz">Niveau de magicien</label><select id="u_wiz" name="wizard">' + [0, 1, 2, 3, 4].map((n) => '<option value="' + n + '"' + (num(draft.wizard) === n ? ' selected' : '') + '>' + (n ? 'Niveau ' + n : 'Non') + '</option>').join('') + '</select></div></div>' +
      '<label>Profil (M, CC, CT, F, E, PV, I, A, Cd)</label>' + prof +
      '<label for="u_opts">Options & améliorations (une par ligne : <i>Nom | points | m</i> ; « m » = par figurine ; une ligne « # Titre » ouvre un groupe)</label>' +
      '<textarea id="u_opts" name="opts" placeholder="# Groupe de commandement&#10;Musicien | 5&#10;Armes lourdes | 2 | m">' + esc(optsToText(draft.opts)) + '</textarea>' +
      '<label for="u_equip">Équipement</label><textarea id="u_equip" name="equip">' + esc(draft.equip) + '</textarea>' +
      '<label for="rs">Règles spéciales du glossaire</label><div class="chips" id="rchips"></div>' +
      '<input type="search" id="rs" placeholder="Chercher une règle à ajouter…" autocomplete="off"><div class="sugg" id="rres" hidden></div>' +
      '<label for="u_extra">Autres règles (texte libre)</label><textarea id="u_extra" name="extra">' + esc(draft.extra) + '</textarea>' +
      (armySpells.length ? '<label>Sorts connus</label><div class="chips">' + armySpells.map((s) => '<label class="chip' + (draft.spells.indexOf(s.id) >= 0 ? ' on' : '') + '" style="cursor:pointer"><input type="checkbox" name="sp" value="' + esc(s.id) + '"' + (draft.spells.indexOf(s.id) >= 0 ? ' checked' : '') + ' hidden> ' + esc(s.name) + '</label>').join('') + '</div>' : '') +
      '<label for="u_notes">Notes</label><textarea id="u_notes" name="notes">' + esc(draft.notes) + '</textarea>' +
      '<label for="u_url">Lien vers la fiche officielle</label><input type="text" id="u_url" name="url" value="' + esc(draft.url) + '" placeholder="https://tow.whfb.app/unit/…">' +
      '<div class="row" style="margin-top:14px"><button class="btn" type="submit">Enregistrer</button>' + cancelBtn + '</div></form>');
    drawChips();
  }
  function drawChips() {
    const c = $('#rchips'); if (!c) return;
    c.innerHTML = draft.rules.filter((r) => GI[r]).map((r) => '<button type="button" class="chip on" data-act="rmrule" data-id="' + esc(r) + '">' + esc(GI[r].fr) + '<span class="x">✕</span></button>').join('') || '<span class="muted">Aucune pour l\'instant</span>';
  }
  function drawSuggestions(q) {
    const box = $('#rres'); if (!box) return;
    q = q.trim().toLowerCase();
    if (!q) { box.hidden = true; box.innerHTML = ''; return; }
    const items = G.filter((e) => draft.rules.indexOf(e.id) < 0 && [e.fr, e.en].concat(e.aliases || []).join(' ').toLowerCase().includes(q)).slice(0, 8);
    box.hidden = !items.length;
    box.innerHTML = items.map((e) => '<button type="button" data-act="addrule" data-id="' + esc(e.id) + '">' + esc(e.fr) + ' <span class="en">' + esc(e.en || '') + '</span></button>').join('');
  }

  function openSpellForm(aid, sid) {
    const s = sid ? getSpell(sid) : null;
    openDlg('<form id="sform"><h2>' + (s ? 'Modifier le sort' : 'Nouveau sort') + '</h2><input type="hidden" name="a" value="' + esc(s ? s.army : aid) + '"><input type="hidden" name="id" value="' + esc(s ? s.id : '') + '">' +
      '<label for="s_name">Nom</label><input type="text" id="s_name" name="name" value="' + esc(s ? s.name : '') + '" required>' +
      '<div class="grid2"><div><label for="s_lore">Liste de sorts (Lore)</label><input type="text" id="s_lore" name="lore" value="' + esc(s ? s.lore : '') + '"></div>' +
      '<div><label for="s_type">Catégorie</label><select id="s_type" name="type">' + SPELL_TYPES.map((t) => '<option value="' + t[0] + '"' + (s && s.type === t[0] ? ' selected' : '') + '>' + esc(t[1]) + '</option>').join('') + '</select></div>' +
      '<div><label for="s_cast">Valeur d\'incantation</label><input type="text" id="s_cast" name="cast" value="' + esc(s ? s.cast : '') + '" placeholder="ex. 7+"></div>' +
      '<div><label for="s_range">Portée</label><input type="text" id="s_range" name="range" value="' + esc(s ? s.range : '') + '" placeholder="ex. 24"></div></div>' +
      '<label for="s_txt">Effet</label><textarea id="s_txt" name="txt">' + esc(s ? s.txt : '') + '</textarea>' +
      '<label for="s_url">Lien officiel</label><input type="text" id="s_url" name="url" value="' + esc(s ? s.url || '' : '') + '">' +
      '<div class="row" style="margin-top:14px"><button class="btn" type="submit">Enregistrer</button>' + cancelBtn + '</div></form>');
  }

  /* picker d'unité pour le constructeur */
  function openPicker(l) {
    const lib = l.armyId ? unitsOf(l.armyId) : [];
    const rows = Object.keys(UCATS).map((c) => {
      const us = lib.filter((u) => u.cat === c).sort(byFr);
      if (!us.length) return '';
      return '<h3 style="margin-top:10px">' + esc(UCATS[c]) + '</h3><div class="sugg" style="max-height:none">' +
        us.map((u) => '<button type="button" data-act="pick" data-id="' + esc(u.id) + '">' + esc(u.name) + ' <span class="muted">— ' + num(u.base) + ' pts' + (num(u.sizeMin) ? ' · ' + u.sizeMin + ' fig.' : '') + '</span></button>').join('') + '</div>';
    }).join('');
    openDlg('<h2>Ajouter une unité</h2>' +
      (l.armyId ? (rows || '<p class="muted">La bibliothèque de cette armée est vide. Ajoutez des unités dans l\'onglet <a href="#armees" data-act="closedlg">Armées</a>, ou créez une unité libre.</p>') :
        '<p class="muted">Choisissez une armée pour utiliser votre bibliothèque, ou créez une unité libre.</p>') +
      '<div class="row" style="margin-top:14px"><button class="btn ghost" data-act="newfree">Unité libre</button>' + cancelBtn + '</div>');
  }
  function openFreeForm(l, unitId) {
    const ex = unitId ? l.units.find((u) => u.id === unitId) : null;
    draft = ex ? clone(ex) : { id: uid(), name: '', cat: 'core', size: 10, pts: 0, troop: 'infantry', wizard: 0, rules: [], notes: '' };
    draft.rules = draft.rules || [];
    const catOpts = Object.keys(UCATS).map((c) => '<option value="' + c + '"' + (draft.cat === c ? ' selected' : '') + '>' + esc(UCATS[c]) + '</option>').join('');
    openDlg('<form id="fform"><h2>' + (ex ? 'Modifier l\'unité libre' : 'Unité libre') + '</h2>' +
      '<label for="f_name">Nom</label><input type="text" id="f_name" name="name" value="' + esc(draft.name) + '" required>' +
      '<div class="grid2"><div><label for="f_cat">Catégorie</label><select id="f_cat" name="cat">' + catOpts + '</select></div>' +
      '<div><label for="f_size">Effectif</label><input type="number" id="f_size" name="size" min="0" value="' + esc(draft.size) + '"></div>' +
      '<div><label for="f_pts">Points</label><input type="number" id="f_pts" name="pts" min="0" value="' + esc(draft.pts) + '"></div>' +
      '<div><label for="f_wiz">Niveau de magicien</label><select id="f_wiz" name="wizard">' + [0, 1, 2, 3, 4].map((n) => '<option value="' + n + '"' + (num(draft.wizard) === n ? ' selected' : '') + '>' + (n ? 'Niveau ' + n : 'Non') + '</option>').join('') + '</select></div></div>' +
      '<label for="rs">Règles spéciales</label><div class="chips" id="rchips"></div>' +
      '<input type="search" id="rs" placeholder="Chercher une règle à ajouter…" autocomplete="off"><div class="sugg" id="rres" hidden></div>' +
      '<label for="f_notes">Notes</label><input type="text" id="f_notes" name="notes" value="' + esc(draft.notes || '') + '">' +
      '<div class="row" style="margin-top:14px"><button class="btn" type="submit">Enregistrer</button>' + cancelBtn + '</div></form>');
    drawChips();
  }

  /* -------------------------------------------------------------- fichiers */
  function download(name, text) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function copyText(t) {
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(() => toast('Copié'), () => fallbackCopy(t));
    else fallbackCopy(t);
  }
  function fallbackCopy(t) {
    const ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); toast('Copié'); } catch (e) { toast('Copie impossible'); }
    ta.remove();
  }
  function armyBundle(id) {
    const a = getArmy(id);
    return { format: 'towfr-army', version: 1, armies: [clone(a)], units: unitsOf(id).map(clone), spells: spellsOf(id).map(clone) };
  }
  const TEMPLATE = {
    format: 'towfr-army', version: 1,
    armies: [{ id: 'a1', name: 'Mon armée', comps: [{ id: 'c1', name: 'Armée principale', limits: { core: { min: 25 }, rare: { max: 25 } } }] }],
    units: [{
      id: 'u1', army: 'a1', name: 'Exemple de régiment', cat: 'core', troop: 'infantry',
      prof: [{ n: 'Soldat', m: '4', ws: '3', bs: '3', s: '3', t: '3', w: '1', i: '3', a: '1', ld: '7' }],
      save: '5+', sizeMin: 10, sizeMax: 30, base: 60, ppm: 6,
      opts: [{ g: 'Groupe de commandement', name: 'Musicien', pts: 5, per: false }, { g: 'Équipement', name: 'Armes lourdes', pts: 1, per: true }],
      equip: '', rules: ['drilled'], extra: '', wizard: 0, spells: [], notes: '', url: '',
    }],
    spells: [{ id: 's1', army: 'a1', name: 'Exemple de sort', lore: 'Ma liste', cast: '7+', range: '24', type: 'magic-missile', txt: '', url: '' }],
  };
  function mergeBundle(d) {
    if (!d || !Array.isArray(d.armies)) throw new Error('format');
    const map = {};
    d.armies.forEach((a) => {
      let ex = state.armies.find((x) => x.name.toLowerCase() === String(a.name || '').toLowerCase());
      if (!ex) { ex = { id: uid(), name: String(a.name || 'Armée'), comps: [] }; state.armies.push(ex); }
      map[a.id] = ex.id;
      (a.comps || []).forEach((c) => {
        if (!ex.comps.find((x) => x.name === c.name)) ex.comps.push({ id: uid(), name: String(c.name || ''), limits: c.limits || {} });
      });
    });
    const smap = {};
    (d.spells || []).forEach((s) => {
      const id = uid(); smap[s.id] = id;
      state.spells.push(Object.assign({}, s, { id, army: map[s.army] || s.army }));
    });
    (d.units || []).forEach((u) => {
      const v = Object.assign({ prof: [], opts: [], rules: [], spells: [] }, u, { id: uid(), army: map[u.army] || u.army });
      v.spells = (u.spells || []).map((i) => smap[i]).filter(Boolean);
      state.units.push(v);
    });
    return d.units ? d.units.length : 0;
  }
  let importMode = 'lists';
  const filein = $('#filein');
  filein.addEventListener('change', () => {
    const f = filein.files && filein.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const d = JSON.parse(r.result);
        if (importMode === 'full') {
          if (!d || typeof d !== 'object' || !Array.isArray(d.lists)) throw new Error('format');
          state = Object.assign(defaults(), d, { game: Object.assign(defaults().game, d.game || {}) });
          save(); toast('Sauvegarde importée'); rerender();
        } else if (importMode === 'lib') {
          const n = mergeBundle(d); save(); toast(n + ' unité(s) importée(s)'); rerender();
        } else {
          const arr = Array.isArray(d) ? d : [d]; let n = 0;
          arr.forEach((l) => { if (!l || !Array.isArray(l.units)) return; l.id = uid(); l.units.forEach((u) => { u.id = uid(); }); state.lists.push(l); n++; });
          if (!n) throw new Error('format');
          save(); toast(n + ' liste(s) importée(s)'); rerender();
        }
      } catch (e) { toast('Fichier invalide'); }
      filein.value = '';
    };
    r.readAsText(f);
  });

  /* -------------------------------------------------------------- événements */
  function scrollToStep() {
    const ph = T.PHASES[state.game.phase], s = ph && ph.subs[state.game.step];
    const el = s && document.getElementById('st-' + s.id);
    if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  document.addEventListener('keydown', (ev) => {
    if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.matches && ev.target.matches('[role=button][data-act]')) { ev.preventDefault(); ev.target.click(); }
  });

  document.addEventListener('click', (ev) => {
    const k = ev.target.closest && ev.target.closest('a.kw');
    if (k && !canHover) { ev.preventDefault(); showTip(k, true); return; }
    if (k) return;
    if (!(ev.target.closest && ev.target.closest('#tip'))) hideTip();
    if (ev.target.closest && ev.target.closest('#tip a')) { hideTip(); return; }

    const b = ev.target.closest && ev.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act, id = b.dataset.id, aid = b.dataset.a;
    const hash = curHash();
    const curList = hash[0] === 'liste' ? getList(decodeURIComponent(hash[1] || '')) : null;

    switch (act) {
      case 'cat': ui.cat = b.dataset.cat || ''; $$('#cats .chip').forEach((c) => c.classList.toggle('on', (c.dataset.cat || '') === ui.cat)); $('#results').innerHTML = rulesResults(); break;

      /* armées */
      case 'newarmy': openArmyForm(null); break;
      case 'editarmy': openArmyForm(id); break;
      case 'delarmy': ask('Supprimer cette armée, ses unités et ses sorts ?', () => {
        state.armies = state.armies.filter((a) => a.id !== id); state.units = state.units.filter((u) => u.army !== id); state.spells = state.spells.filter((s) => s.army !== id);
        state.lists.forEach((l) => { if (l.armyId === id) { l.armyId = ''; l.compId = ''; } }); save(); location.hash = '#armees'; rerender();
      }); break;
      case 'newcomp': openCompForm(aid, null); break;
      case 'editcomp': openCompForm(aid, id); break;
      case 'delcomp': ask('Supprimer cette composition ?', () => { const a = getArmy(aid); if (a) a.comps = a.comps.filter((c) => c.id !== id); save(); rerender(); }); break;
      case 'parseunit': {
        const ta = $('#u_paste'); if (!ta || !draft) break;
        const segs = splitSheets(ta.value);
        if (segs.length > 1) {
          const made = segs.map(parseSheet).filter((p) => p.name && p.prof).map((p) => Object.assign({ id: uid(), army: draft.army, name: '', cat: 'core', troop: '', prof: [], save: '', sizeMin: 0, sizeMax: 0, base: 0, ppm: 0, opts: [], equip: '', rules: [], extra: '', wizard: 0, spells: [], notes: '', url: '' }, p));
          if (made.length) { made.forEach((u) => state.units.push(u)); const aid2 = draft.army; draft = null; save(); closeDlg(); location.hash = '#armee-' + aid2; rerender(); toast(made.length + ' unités créées. Renseignez leurs points et leur catégorie.'); break; }
        }
        const p = parseSheet(ta.value);
        if (!p.name && !p.prof) { toast('Texte non reconnu : collez toute la page de l\'unité.'); break; }
        const exists = state.units.some((u) => u.id === draft.id);
        openUnitForm(draft.army, exists ? draft.id : null, p);
        toast('Fiche lue : ' + (p.name || 'unité') + '. Complétez les points.');
        break;
      }
      case 'newunit': openUnitForm(aid, null); break;
      case 'editunit': openUnitForm(null, id); break;
      case 'dupunitlib': { const u = getUnit(id); if (!u) break; const c = clone(u); c.id = uid(); c.name += ' (copie)'; state.units.push(c); save(); location.hash = '#unite-' + c.id; break; }
      case 'delunitlib': ask('Supprimer cette fiche d\'unité ?', () => {
        const u = getUnit(id); const a = u && u.army;
        state.units = state.units.filter((x) => x.id !== id);
        state.lists.forEach((l) => { l.units = (l.units || []).filter((x) => x.libId !== id); });
        save(); location.hash = a ? '#armee-' + a : '#armees'; rerender();
      }); break;
      case 'newspell': openSpellForm(aid, null); break;
      case 'editspell': openSpellForm(null, id); break;
      case 'delspell': ask('Supprimer ce sort ?', () => {
        const s = getSpell(id); const a = s && s.army;
        state.spells = state.spells.filter((x) => x.id !== id); state.units.forEach((u) => { u.spells = (u.spells || []).filter((x) => x !== id); });
        save(); location.hash = a ? '#armee-' + a : '#armees'; rerender();
      }); break;
      case 'exportarmy': { const a = getArmy(id); if (a) download(a.name.replace(/[^\w-]+/g, '_') + '.json', JSON.stringify(armyBundle(id), null, 1)); break; }
      case 'copyarmy': if (getArmy(id)) copyText(JSON.stringify(armyBundle(id), null, 1)); break;
      case 'template': copyText(JSON.stringify(TEMPLATE, null, 1)); break;
      case 'importall': importMode = 'lib'; filein.click(); break;
      case 'importfull': importMode = 'full'; filein.click(); break;
      case 'importlists': importMode = 'lists'; filein.click(); break;
      case 'exportall': download('old-world-sauvegarde.json', JSON.stringify(state, null, 1)); break;
      case 'copyall': copyText(JSON.stringify(state, null, 1)); break;

      /* listes */
      case 'newlist': { const l = { id: uid(), name: 'Nouvelle liste', armyId: '', compId: '', limit: 2000, limits: {}, units: [] }; state.lists.push(l); save(); location.hash = '#liste-' + l.id; break; }
      case 'addunit': if (curList) openPicker(curList); break;
      case 'pick': if (curList) {
        const lu = getUnit(id); if (!lu) break;
        curList.units.push({ id: uid(), libId: lu.id, size: num(lu.sizeMin) || 1, opts: [] }); save(); closeDlg(); rerender();
      } break;
      case 'newfree': if (curList) openFreeForm(curList, null); break;
      case 'editfree': if (curList) openFreeForm(curList, id); break;
      case 'dupunit': if (curList) {
        const i = curList.units.findIndex((u) => u.id === id); if (i < 0) break;
        const c = clone(curList.units[i]); c.id = uid(); if (!c.libId) c.name = (c.name || 'Unité') + ' (copie)';
        curList.units.splice(i + 1, 0, c); save(); rerender();
      } break;
      case 'upunit': case 'downunit': if (curList) {
        const i = curList.units.findIndex((u) => u.id === id), j = act === 'upunit' ? i - 1 : i + 1;
        if (i < 0 || j < 0 || j >= curList.units.length) break;
        const t = curList.units[i]; curList.units[i] = curList.units[j]; curList.units[j] = t; save(); rerender();
      } break;
      case 'delunit': if (curList) ask('Supprimer cette unité de la liste ?', () => { curList.units = curList.units.filter((u) => u.id !== id); save(); rerender(); }); break;
      case 'dellist': ask('Supprimer cette liste ?', () => {
        state.lists = state.lists.filter((l) => l.id !== id); if (state.game.listId === id) state.game.listId = null; save(); location.hash = '#listes'; rerender();
      }); break;
      case 'duplist': { const l = getList(id); if (!l) break; const c = clone(l); c.id = uid(); c.name = (l.name || 'Liste') + ' (copie)'; c.units.forEach((u) => { u.id = uid(); }); state.lists.push(c); save(); location.hash = '#liste-' + c.id; break; }
      case 'copylist': { const l = getList(id); if (l) copyText(listText(l)); break; }
      case 'exportlist': { const l = getList(id); if (l) download((l.name || 'liste').replace(/[^\w-]+/g, '_') + '.json', JSON.stringify(l, null, 1)); break; }
      case 'usephases': state.game.listId = id; save(); location.hash = '#phases'; break;

      /* phases */
      case 'side': state.game.side = b.dataset.side; save(); rerender(); break;
      case 'gostep': state.game.phase = num(b.dataset.phase); state.game.step = num(b.dataset.step); save(); rerender(); scrollToStep(); break;
      case 'next': stepPhase(1); rerender(); window.scrollTo(0, 0); break;
      case 'prev': stepPhase(-1); rerender(); window.scrollTo(0, 0); break;

      /* dialogues */
      case 'closedlg': closeDlg(); break;
      case 'yes': { const f = pendingYes; pendingYes = null; closeDlg(); if (f) f(); break; }
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
      case 'note': { if (t.value.trim()) state.notes[t.dataset.id] = t.value; else delete state.notes[t.dataset.id]; save(); break; }
      case 'lname': if (l) { l.name = t.value; save(); } break;
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
    if (!b) return;
    const hash = curHash();
    const l = hash[0] === 'liste' ? getList(decodeURIComponent(hash[1] || '')) : null;
    if (b === 'plist') { state.game.listId = t.value; save(); rerender(); }
    else if (b === 'istart') { state.game.iStart = t.checked; save(); rerender(); }
    else if (l && b === 'larmy') { l.armyId = t.value; l.compId = ''; save(); rerender(); }
    else if (l && b === 'lcomp') { l.compId = t.value; save(); rerender(); }
    else if (l && b === 'usize') { const u = l.units.find((x) => x.id === t.dataset.id); if (u) { u.size = num(t.value); save(); rerender(); } }
    else if (l && b === 'uopt') {
      const u = l.units.find((x) => x.id === t.dataset.id); if (!u) return;
      const i = num(t.dataset.i); u.opts = u.opts || [];
      const at = u.opts.indexOf(i);
      if (t.checked && at < 0) u.opts.push(i); else if (!t.checked && at >= 0) u.opts.splice(at, 1);
      save(); rerender();
    }
  });

  document.addEventListener('submit', (ev) => {
    const f = ev.target;
    const fd = new FormData(f); const fid = f.getAttribute('id');
    if (fid === 'aform') {
      ev.preventDefault();
      const name = String(fd.get('name') || '').trim(); if (!name) return;
      const id = String(fd.get('id') || '');
      if (id) { const a = getArmy(id); if (a) a.name = name; save(); closeDlg(); rerender(); }
      else { const a = { id: uid(), name, comps: [] }; state.armies.push(a); save(); closeDlg(); location.hash = '#armee-' + a.id; }
    } else if (fid === 'cform') {
      ev.preventDefault();
      const a = getArmy(String(fd.get('a'))); if (!a) return closeDlg();
      const limits = {};
      Object.keys(UCATS).forEach((k) => {
        const mn = fd.get('min_' + k), mx = fd.get('max_' + k);
        if (mn !== '' || mx !== '') limits[k] = { min: mn === '' ? '' : Number(mn), max: mx === '' ? '' : Number(mx) };
      });
      const cid = String(fd.get('id') || '');
      const c = cid ? (a.comps || []).find((x) => x.id === cid) : null;
      const name = String(fd.get('name') || '').trim() || 'Composition';
      if (c) { c.name = name; c.limits = limits; } else (a.comps = a.comps || []).push({ id: uid(), name, limits });
      save(); closeDlg(); rerender();
    } else if (fid === 'uform') {
      ev.preventDefault();
      if (!draft) return closeDlg();
      draft.name = String(fd.get('name') || '').trim() || 'Unité sans nom';
      draft.cat = fd.get('cat'); draft.troop = fd.get('troop') || '';
      draft.sizeMin = num(fd.get('sizeMin')); draft.sizeMax = num(fd.get('sizeMax'));
      draft.base = num(fd.get('base')); draft.ppm = num(fd.get('ppm'));
      draft.save = String(fd.get('save') || '').trim(); draft.wizard = num(fd.get('wizard'));
      draft.prof = [0, 1, 2].map((i) => { const r = { n: String(fd.get('pn' + i) || '').trim() }; PROF.forEach((p) => { r[p[0]] = String(fd.get('p' + i + '_' + p[0]) || '').trim(); }); return r; })
        .filter((r) => r.n || PROF.some((p) => r[p[0]]));
      draft.opts = parseOpts(fd.get('opts'));
      draft.equip = String(fd.get('equip') || ''); draft.extra = String(fd.get('extra') || '');
      draft.spells = fd.getAll('sp');
      draft.notes = String(fd.get('notes') || ''); draft.url = safeUrl(fd.get('url'));
      const i = state.units.findIndex((u) => u.id === draft.id);
      if (i >= 0) state.units[i] = draft; else state.units.push(draft);
      const id = draft.id; draft = null; save(); closeDlg(); location.hash = '#unite-' + id; rerender();
    } else if (fid === 'sform') {
      ev.preventDefault();
      const id = String(fd.get('id') || '') || uid();
      const s = { id, army: String(fd.get('a')), name: String(fd.get('name') || '').trim(), lore: String(fd.get('lore') || '').trim(), type: fd.get('type'), cast: String(fd.get('cast') || '').trim(), range: String(fd.get('range') || '').trim(), txt: String(fd.get('txt') || ''), url: safeUrl(fd.get('url')) };
      if (!s.name) return;
      const i = state.spells.findIndex((x) => x.id === id);
      if (i >= 0) state.spells[i] = s; else state.spells.push(s);
      save(); closeDlg(); location.hash = '#sort-' + id; rerender();
    } else if (fid === 'fform') {
      ev.preventDefault();
      const hash = curHash(); const l = hash[0] === 'liste' ? getList(decodeURIComponent(hash[1] || '')) : null;
      if (!l || !draft) return closeDlg();
      draft.name = String(fd.get('name') || '').trim() || 'Unité'; draft.cat = fd.get('cat');
      draft.size = num(fd.get('size')); draft.pts = num(fd.get('pts')); draft.wizard = num(fd.get('wizard')); draft.notes = String(fd.get('notes') || '');
      const i = l.units.findIndex((u) => u.id === draft.id);
      if (i >= 0) l.units[i] = draft; else l.units.push(draft);
      draft = null; save(); closeDlg(); rerender();
    }
  });

  /* les chips "sorts connus" sont des cases masquées : refléter l'état */
  document.addEventListener('change', (ev) => {
    const t = ev.target;
    if (t.name === 'sp' && t.closest) { const lab = t.closest('label'); if (lab) lab.classList.toggle('on', t.checked); }
  });

  dlg.addEventListener('click', (ev) => { if (ev.target === dlg) closeDlg(); });

  /* -------------------------------------------------------------- démarrage */
  rebuild();
  route();
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
})();
