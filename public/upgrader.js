/* upgrader.js — UI do Upgrader (carrega depois do main.js e substitui o initUpgrader antigo) */
(function () {
    'use strict';

    const $ = (id) => document.getElementById(id);
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const money = (n) => (typeof formatCurrency === 'function' ? formatCurrency(Number(n) || 0) : (Number(n) || 0).toFixed(2));
    const MAX_INPUTS = 5;
    const MIN_CHANCE = 1, MAX_CHANCE = 80; // limites de chance (%) para poder fazer upgrade
    const EDGE = 0.95;                      // tem de bater com o servidor
    const BATCH = 36;
    const WEAR_RANGE = { FN: [0, 0.07], MW: [0.07, 0.15], FT: [0.15, 0.38], WW: [0.38, 0.45], BS: [0.45, 1] };

    const S = {
        cat: [], catTs: 0, inv: [], sel: [], target: null, busy: false,
        lo: 0.01, hi: 1000,
        t: { q: '', conds: new Set(), type: 'all', sort: 'price-asc', min: 0.01, max: 1000 },
        i: { q: '', sort: 'newest', type: 'all' },
        pre: [], view: [], bound: false, msgTimer: null
    };

    // ------------------------------------------------------------------ helpers
    // Tira StatTrak™/Souvenir do nome e devolve-os como tags separadas
    function parseSkin(name) {
        const n = String(name || '');
        const st = /stattrak/i.test(n), sv = /souvenir/i.test(n);
        const base = n.replace(/stattrak™?\s*/ig, '').replace(/souvenir\s*/ig, '').replace(/\s{2,}/g, ' ').trim();
        const i = base.indexOf(' | ');
        return { st, sv, base, weapon: i > 0 ? base.slice(0, i) : base, finish: i > 0 ? base.slice(i + 3) : '' };
    }
    function kindOf(weaponId) {
        const w = Number(weaponId) || 0;
        if (w >= 500 && w <= 999) return 'knife';
        if ((w >= 5027 && w <= 5035) || w === 4725) return 'glove';
        return 'weapon';
    }
    function tagHTML(p) {
        return p.st ? '<span class="ugx-tag st">StatTrak™</span>' : p.sv ? '<span class="ugx-tag sv">Souvenir</span>' : '';
    }
    const hasNum = (v) => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v));
    const keyOf = (name, cond) => name + '|' + cond;

    // forma comum para skins do catálogo e do inventário
    const fromTarget = (e) => ({ name: e.name, img: e.img, color: e.color, cond: e.displayCond, price: e.price, float: e.float, seed: e.seed });
    const fromInv = (it) => ({ name: it.name, img: it.img, color: it.color, cond: it.conditionShort, price: it.value, float: it.wear, seed: it.seed });

    function cardHTML(m, attr) {
        const p = parseSkin(m.name);
        const parts = [];
        if (hasNum(m.float)) parts.push(`<span title="Float">${Number(m.float).toFixed(5)}</span>`);
        if (hasNum(m.seed)) parts.push(`<span class="seed" title="Pattern">#${Number(m.seed)}</span>`);
        return `<div class="ugx-card" ${attr} style="--rc:${esc(m.color || '#4b69ff')}">
            <div class="ugx-card-top"><span class="ugx-wear ${esc(m.cond)}">${esc(m.cond)}</span>${tagHTML(p)}</div>
            <img src="${esc(m.img)}" alt="" loading="lazy" decoding="async">
            <div class="ugx-weapon">${esc(p.finish ? p.weapon : '\u00A0')}</div>
            <div class="ugx-finish" title="${esc(p.base)}">${esc(p.finish || p.weapon)}</div>
            <div class="ugx-price">$${money(m.price)}</div>
            <div class="ugx-meta">${parts.join('')}</div>
        </div>`;
    }

    // ---- lista com render incremental (não rebenta com 10 mil skins)
    // animação de "a atualizar" quando a lista muda (filtros, pesquisa, seleção). Limitada para não piscar ao arrastar o slider.
    function refreshAnim(grid) {
        const now = performance.now();
        if (grid._an && now - grid._an < 350) return;
        grid._an = now;
        grid.classList.remove('ugx-refresh');
        void grid.offsetWidth;
        grid.classList.add('ugx-refresh');
        clearTimeout(grid._at);
        grid._at = setTimeout(() => grid.classList.remove('ugx-refresh'), 950);
    }
    function mountList(grid, items, render, emptyText, start) {
        start = start > 0 ? start : 0; // começa a desenhar a meio da lista (usado pelos multiplicadores)
        grid._items = items; grid._render = render; grid._n = start; grid._s = start;
        grid.scrollTop = 0;
        refreshAnim(grid);
        grid.innerHTML = '';
        if (!items.length) { grid.innerHTML = `<div class="ugx-empty">${emptyText}</div>`; return; }
        more(grid);
    }
    function more(grid) {
        const a = grid._n, b = Math.min(a + BATCH, grid._items.length);
        if (a >= b) return;
        let h = '';
        for (let i = a; i < b; i++) h += grid._render(grid._items[i]);
        grid.insertAdjacentHTML('beforeend', h);
        grid._n = b;
    }
    // desenha o bloco anterior (quando a lista começou a meio) mantendo a posição do scroll
    function less(grid) {
        const b = grid._s || 0;
        if (b <= 0) return;
        const a = Math.max(0, b - BATCH);
        let h = '';
        for (let i = a; i < b; i++) h += grid._render(grid._items[i]);
        const prev = grid.scrollHeight;
        grid.insertAdjacentHTML('afterbegin', h);
        grid.scrollTop += grid.scrollHeight - prev;
        grid._s = a;
    }
    function lazyScroll(grid) {
        grid.addEventListener('scroll', () => {
            if (grid._s > 0 && grid.scrollTop < 260) less(grid);
            if (grid.scrollTop + grid.clientHeight >= grid.scrollHeight - 420) more(grid);
        }, { passive: true });
    }

    // "ak  >50  <200  10-100" -> texto + limites de preço
    function parseQ(q) {
        const out = { text: [], min: null, max: null };
        String(q || '').toLowerCase().split(/\s+/).filter(Boolean).forEach((t) => {
            let m;
            if ((m = t.match(/^>=?\$?(\d+(?:\.\d+)?)$/))) out.min = +m[1];
            else if ((m = t.match(/^<=?\$?(\d+(?:\.\d+)?)$/))) out.max = +m[1];
            else if ((m = t.match(/^\$?(\d+(?:\.\d+)?)-\$?(\d+(?:\.\d+)?)$/))) { out.min = +m[1]; out.max = +m[2]; }
            else out.text.push(t);
        });
        return out;
    }
    const textOk = (hay, tokens) => tokens.every((t) => hay.includes(t));

    function msg(text, err) {
        const el = $('ugx-msg');
        if (!el) return;
        el.textContent = text || '';
        el.className = 'ugx-msg' + (err ? ' err' : '');
        clearTimeout(S.msgTimer);
        if (text) S.msgTimer = setTimeout(() => { el.textContent = ''; }, 4500);
    }

    // ------------------------------------------------------------------ dados
    async function loadCatalog() {
        if (S.cat.length && Date.now() - S.catTs < 10 * 60 * 1000) return;
        const r = await fetch('/api/upgrader-skins');
        if (!r.ok) throw new Error('Could not load skins');
        const raw = await r.json();
        S.cat = raw.map((e) => {
            const p = parseSkin(e.name);
            e._p = p;
            e._kind = kindOf(e.weaponId);
            e._key = keyOf(e.name, e.displayCond);
            e._hay = (e.name + ' ' + e.displayCond).toLowerCase();
            return e;
        }).sort((a, b) => a.price - b.price);
        S.catTs = Date.now();
        const first = S.cat.length ? S.cat[0].price : 0.01;
        const last = S.cat.length ? S.cat[S.cat.length - 1].price : 1000;
        const lo = Math.max(0.01, Math.floor(first * 100) / 100);
        const hi = Math.max(lo + 1, Math.ceil(last));
        const wasFull = S.t.max >= S.hi, isFirst = !S.catLoaded;
        S.catLoaded = true;
        S.lo = lo; S.hi = hi;
        if (isFirst) { S.t.min = lo; S.t.max = hi; }
        else { S.t.min = Math.max(lo, Math.min(S.t.min, hi)); S.t.max = wasFull ? hi : Math.min(hi, Math.max(S.t.max, S.t.min)); }
    }
    async function refreshInventory() {
        const r = await fetch('/api/me');
        const d = await r.json();
        S.inv = (d && d.user && d.user.inventory) || [];
        // remove seleções que já não existem
        S.sel = S.sel.filter((id) => S.inv.some((i) => i.id === id && !i.isLocked));
    }

    const selItems = () => S.sel.map((id) => S.inv.find((i) => i.id === id)).filter(Boolean);
    const selTotal = () => selItems().reduce((s, i) => s + (Number(i.value) || 0), 0);

    // ------------------------------------------------------------------ inventário
    function invView() {
        const f = S.i, q = parseQ(f.q);
        let a = S.inv.filter((it) => {
            if (it.isLocked) return false; // skins locked não aparecem
            const p = parseSkin(it.name);
            if (f.type === 'st' && !p.st) return false;
            if (f.type === 'sv' && !p.sv) return false;
            if (f.type === 'normal' && (p.st || p.sv)) return false;
            const v = Number(it.value) || 0;
            if (q.min !== null && v < q.min) return false;
            if (q.max !== null && v > q.max) return false;
            return textOk((it.name + ' ' + it.conditionShort).toLowerCase(), q.text);
        });
        if (f.sort === 'newest') a = a.slice().reverse();
        else if (f.sort === 'high') a.sort((x, y) => y.value - x.value);
        else if (f.sort === 'low') a.sort((x, y) => x.value - y.value);
        else if (f.sort === 'float') a.sort((x, y) => (hasNum(x.wear) ? +x.wear : 9) - (hasNum(y.wear) ? +y.wear : 9));
        return a;
    }
    function renderInventory() {
        const grid = $('ugx-i-grid');
        const view = invView();
        $('ugx-count').textContent = `${S.sel.length}/${MAX_INPUTS}`;
        mountList(grid, view, (it) => {
            const html = cardHTML(fromInv(it), `data-id="${esc(it.id)}"`);
            return S.sel.includes(it.id) ? html.replace('class="ugx-card"', 'class="ugx-card sel"') : html;
        }, S.inv.some((i) => !i.isLocked) ? 'No skins match your search.' : (S.inv.length ? 'All your skins are locked.<br>Unlock some to use them here.' : 'Your inventory is empty.<br>Open some cases first.'));
    }
    function onInvClick(e) {
        const card = e.target.closest('.ugx-card');
        if (!card || S.busy) return;
        const id = card.dataset.id;
        const idx = S.sel.indexOf(id);
        if (idx >= 0) S.sel.splice(idx, 1);
        else if (S.sel.length >= MAX_INPUTS) return msg(`You can use up to ${MAX_INPUTS} skins.`, true);
        else S.sel.push(id);
        card.classList.toggle('sel', S.sel.includes(id));
        $('ugx-count').textContent = `${S.sel.length}/${MAX_INPUTS}`;
        selectionChanged();
    }
    function selectionChanged() {
        const total = selTotal();
        if (S.target && !chanceOk(chanceFor(total, S.target.price))) { S.target = null; msg(`Win chance must be between ${MIN_CHANCE}% and ${MAX_CHANCE}%.`); }
        renderStage();
        computeTargets();
    }

    // ------------------------------------------------------------------ alvos
    function basePass(e) {
        const f = S.t;
        if (f.conds.size && !f.conds.has(e.displayCond)) return false;
        const p = e._p;
        if (f.type === 'st' && !p.st) return false;
        if (f.type === 'sv' && !p.sv) return false;
        if (f.type === 'normal' && (p.st || p.sv)) return false;
        return true;
    }
    // filtra tudo menos o intervalo do slider (serve também para o histograma)
    function computeTargets() {
        const q = parseQ(S.t.q), total = selTotal();
        // só aparecem alvos cuja chance fique entre MIN_CHANCE e MAX_CHANCE
        const chLow = total > 0 ? Math.ceil((total * EDGE * 100 / MAX_CHANCE) * 100) / 100 : 0;
        const chHigh = total > 0 ? Math.floor((total * EDGE * 100 / MIN_CHANCE) * 100) / 100 : Infinity;
        const lowCut = Math.max(q.min || 0, total > 0 ? Math.max(total + 0.005, chLow) : 0);
        const highCut = Math.min(q.max !== null ? q.max : Infinity, chHigh);
        let pre = S.cat.filter((e) => basePass(e) && e.price >= lowCut && e.price <= highCut && textOk(e._hay, q.text));
        if (S.t.sort === 'price-desc') pre = pre.slice().reverse();
        else if (S.t.sort === 'name') pre = pre.slice().sort((a, b) => a.name.replace(/[★™\s]|stattrak|souvenir/gi, '').localeCompare(b.name.replace(/[★™\s]|stattrak|souvenir/gi, '')));
        S.pre = pre;
        applyRange();
    }
    function inRange(price) {
        const lo = S.t.min <= S.lo ? 0 : S.t.min;
        const hi = S.t.max >= S.hi ? Infinity : S.t.max;
        return price >= lo && price <= hi;
    }
    function applyRange() {
        S.view = S.pre.filter((e) => inRange(e.price));
        const grid = $('ugx-t-grid');
        $('ugx-t-total').textContent = `${S.view.length.toLocaleString('en-US')} skins`;
        // se veio de um multiplicador, desenha só à volta da skin escolhida (rápido, em vez de milhares de cartas)
        const ri = S.revealKey ? S.view.findIndex((e) => e._key === S.revealKey) : -1;
        const startAt = ri > 0 ? Math.max(0, ri - 12) : 0;
        mountList(grid, S.view, (e) => {
            const html = cardHTML(fromTarget(e), `data-key="${esc(e._key)}"`);
            return S.target && keyOf(S.target.name, S.target.displayCond) === e._key ? html.replace('class="ugx-card"', 'class="ugx-card sel"') : html;
        }, 'No skins in this range.<br>Widen the price range or clear a filter.', startAt);
    }
    function markTargetSelection() {
        const tk = S.target ? keyOf(S.target.name, S.target.displayCond) : null;
        $('ugx-t-grid').querySelectorAll('.ugx-card').forEach((c) => c.classList.toggle('sel', c.dataset.key === tk));
    }
    function onTargetClick(e) {
        const card = e.target.closest('.ugx-card');
        if (!card || S.busy) return;
        const entry = S.view.find((x) => x._key === card.dataset.key) || S.cat.find((x) => x._key === card.dataset.key);
        if (!entry) return;
        if (S.target && S.target._key === entry._key) S.target = null;
        else if (!chanceOk(chanceFor(selTotal(), entry.price))) return msg(`Win chance must be between ${MIN_CHANCE}% and ${MAX_CHANCE}%.`, true);
        else S.target = entry;
        markTargetSelection();
        renderStage();
    }

    // ---- slider de 2 pontas (escala logarítmica: $0.03 … $10 000 cabem todos)
    const lg = () => Math.log(S.lo);
    const span = () => Math.max(1e-6, Math.log(S.hi) - Math.log(S.lo));
    const toPos = (v) => Math.max(0, Math.min(1, (Math.log(Math.max(v, S.lo)) - lg()) / span()));
    const fromPos = (p) => Math.exp(lg() + p * span());
    const snap = (v) => (v >= 100 ? Math.round(v) : Math.round(v * 100) / 100);

    function paintRange() {
        const a = toPos(S.t.min), b = S.t.max >= S.hi ? 1 : toPos(S.t.max);
        $('ugx-fill').style.left = a * 100 + '%';
        $('ugx-fill').style.width = Math.max(0, b - a) * 100 + '%';
        $('ugx-th-min').style.left = a * 100 + '%';
        $('ugx-th-max').style.left = b * 100 + '%';
        $('ugx-th-min').setAttribute('aria-valuetext', '$' + money(S.t.min));
        $('ugx-th-max').setAttribute('aria-valuetext', '$' + money(S.t.max));
        const imin = $('ugx-t-min'), imax = $('ugx-t-max');
        if (document.activeElement !== imin) imin.value = S.t.min;
        if (document.activeElement !== imax) imax.value = S.t.max;
    }
    let raf = 0;
    function scheduleRange() {
        if (raf) return;
        raf = requestAnimationFrame(() => { raf = 0; applyRange(); });
    }
    function setMin(v) { S.t.min = Math.max(S.lo, Math.min(v, S.t.max)); }
    function setMax(v) { S.t.max = Math.min(S.hi, Math.max(v, S.t.min)); }

    function beginDrag(which, ev) {
        const th = $(which === 'min' ? 'ugx-th-min' : 'ugx-th-max');
        const rect = $('ugx-track').getBoundingClientRect();
        const move = (e) => {
            const p = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            if (which === 'min') setMin(p <= 0.004 ? S.lo : snap(fromPos(Math.min(p, toPos(S.t.max) - 0.005))));
            else setMax(p >= 0.996 ? S.hi : snap(fromPos(Math.max(p, toPos(S.t.min) + 0.005))));
            paintRange(); scheduleRange();
        };
        try { th.setPointerCapture(ev.pointerId); } catch (e) { /* ignora */ }
        const up = () => { th.removeEventListener('pointermove', move); th.removeEventListener('pointerup', up); th.removeEventListener('pointercancel', up); };
        th.addEventListener('pointermove', move);
        th.addEventListener('pointerup', up);
        th.addEventListener('pointercancel', up);
        move(ev);
    }
    function bindSlider() {
        const track = $('ugx-track');
        ['min', 'max'].forEach((w) => {
            const th = $(w === 'min' ? 'ugx-th-min' : 'ugx-th-max');
            th.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); beginDrag(w, e); });
            th.addEventListener('keydown', (e) => {
                const k = e.key;
                if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(k)) return;
                e.preventDefault();
                const step = (e.shiftKey ? 0.05 : 0.01) * (k === 'ArrowLeft' || k === 'ArrowDown' ? -1 : 1);
                if (w === 'min') setMin(k === 'Home' ? S.lo : k === 'End' ? S.t.max : snap(fromPos(Math.max(0, Math.min(toPos(S.t.max) - 0.005, toPos(S.t.min) + step)))));
                else setMax(k === 'End' ? S.hi : k === 'Home' ? S.t.min : snap(fromPos(Math.min(1, Math.max(toPos(S.t.min) + 0.005, toPos(S.t.max) + step)))));
                paintRange(); scheduleRange();
            });
        });
        track.addEventListener('pointerdown', (e) => {
            if (e.target.classList.contains('ugx-thumb')) return;
            e.preventDefault();
            const rect = track.getBoundingClientRect();
            const p = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            const w = Math.abs(p - toPos(S.t.min)) <= Math.abs(p - (S.t.max >= S.hi ? 1 : toPos(S.t.max))) ? 'min' : 'max';
            beginDrag(w, e);
        });
        const fromInput = () => {
            let a = parseFloat($('ugx-t-min').value), b = parseFloat($('ugx-t-max').value);
            if (!Number.isFinite(a)) a = S.lo;
            if (!Number.isFinite(b)) b = S.hi;
            if (a > b) [a, b] = [b, a];
            S.t.min = Math.max(S.lo, Math.min(a, S.hi));
            S.t.max = Math.min(S.hi, Math.max(b, S.lo));
            if (S.t.min > S.t.max) S.t.min = S.t.max;
            paintRange(); applyRange();
        };
        $('ugx-t-min').addEventListener('change', fromInput);
        $('ugx-t-max').addEventListener('change', fromInput);
    }

    // ------------------------------------------------------------------ centro (roda + resumo)
    const CIRC = 2 * Math.PI * 86;
    function chanceFor(total, price) { return total > 0 && price > total ? (total / price) * EDGE * 100 : 0; }
    function chanceOk(c) { return c >= MIN_CHANCE - 1e-6 && c <= MAX_CHANCE + 1e-6; }
    function chanceNow() { return S.target ? chanceFor(selTotal(), S.target.price) : 0; }
    function renderStage() {
        const items = selItems(), total = selTotal(), t = S.target, chance = chanceNow();

        $('ugx-chance').textContent = chance.toFixed(2) + '%';
        $('ugx-slice').style.strokeDasharray = `${(CIRC * chance) / 100} ${CIRC}`;
        $('ugx-slice').style.opacity = chance > 0 ? '1' : '0'; // evita o ponto do traço redondo a 0%
        $('ugx-chance').parentNode.classList.toggle('has', chance > 0);

        $('ugx-in-box').innerHTML = items.length
            ? `<span class="ugx-slot-label">You put in</span>
               <div class="ugx-stack">${items.map((i) => `<img src="${esc(i.img)}" alt="">`).join('')}</div>
               <div class="ugx-slot-main gold">$${money(total)}</div>
               <div class="ugx-slot-sub">${items.length} ${items.length === 1 ? 'skin' : 'skins'}</div>`
            : `<span class="ugx-slot-label">You put in</span><div class="ugx-slot-hint">Pick up to ${MAX_INPUTS} skins from your inventory</div>`;

        if (t) {
            const p = t._p;
            const fl = hasNum(t.float) ? `<div class="ugx-slot-sub">Float ${Number(t.float).toFixed(6)}${hasNum(t.seed) ? ' · #' + Number(t.seed) : ''}</div>` : '';
            $('ugx-out-box').innerHTML = `<span class="ugx-slot-label">You get</span>
               <img class="big" src="${esc(t.img)}" alt="">
               <div class="ugx-slot-name"><span title="${esc(p.base)}">${esc(p.base)}</span>${tagHTML(p)}</div>
               <div class="ugx-slot-main gold">$${money(t.price)} <span class="ugx-wear ${esc(t.displayCond)}">${esc(t.displayCond)}</span></div>${fl}`;
        } else {
            $('ugx-out-box').innerHTML = `<span class="ugx-slot-label">You get</span><div class="ugx-slot-hint">Pick a target skin on the right<br>(win chance ${MIN_CHANCE}% – ${MAX_CHANCE}%)</div>`;
        }
        if (!S.busy) $('ugx-go').textContent = 'Upgrade';
        $('ugx-go').disabled = S.busy || !items.length || !t || !chanceOk(chance);
    }

    function applyMult(m) {
        const total = selTotal();
        if (total <= 0) return msg('Select your skins first.', true);
        const want = total * m;
        // skin mais próxima do alvo (e mais cara que a seleção)
        let best = null, bd = Infinity;
        for (const e of S.cat) {
            if (!chanceOk(chanceFor(total, e.price))) continue;
            const d = Math.abs(e.price - want);
            if (d < bd) { bd = d; best = e; }
        }
        if (!best) return msg('No skin that valuable is available.', true);
        // limpa filtros para a skin ficar visível e centra o slider à volta dela
        S.t.q = ''; $('ugx-t-search').value = '';
        S.t.conds.clear(); S.t.type = 'all';
        $('ugx-t-type').value = 'all';
        syncChips();
        S.t.min = Math.max(S.lo, snap(best.price * 0.7));
        S.t.max = Math.min(S.hi, snap(best.price * 1.4));
        if (S.t.max <= S.t.min) { S.t.min = S.lo; S.t.max = S.hi; }
        S.target = best;
        S.revealKey = best._key;
        const tg = $('ugx-t-grid');
        tg.classList.add('ugx-flat'); // todas as cartas entram ao mesmo tempo (sem escada), a escolhida não aparece antes
        clearTimeout(tg._ft); tg._ft = setTimeout(() => tg.classList.remove('ugx-flat'), 1000);
        paintRange(); renderStage(); computeTargets();
        revealTarget(best._key);
        S.revealKey = null;
    }
    // depois de um 1.5x / 2x / ...: salta para a skin escolhida (centrada) e dá-lhe um destaque
    function revealTarget(key) {
        const grid = $('ugx-t-grid');
        if (!grid) return;
        less(grid); // um bloco acima, para a skin poder ficar centrada
        const card = Array.from(grid.children).find((el) => el.dataset && el.dataset.key === key);
        if (!card) return;
        const g = grid.getBoundingClientRect(), r = card.getBoundingClientRect();
        grid.scrollTop = Math.max(0, grid.scrollTop + (r.top - g.top) - (grid.clientHeight - r.height) / 2);
        card.classList.remove('ugx-ping'); void card.offsetWidth; card.classList.add('ugx-ping');
        setTimeout(() => card.classList.remove('ugx-ping'), 1400);
    }
    function clearAll() {
        if (S.busy) return;
        S.sel = []; S.target = null;
        S.t.min = S.lo; S.t.max = S.hi;
        paintRange(); renderStage(); renderInventory(); computeTargets();
    }

    // ------------------------------------------------------------------ upgrade
    async function go() {
        if (S.busy) return;
        const items = selItems(), t = S.target, total = selTotal();
        if (!items.length || !t || !chanceOk(chanceFor(total, t.price))) return;
        S.busy = true;
        $('ugx').classList.add('busy');
        $('ugx-go').disabled = true;
        $('ugx-go').textContent = 'Rolling…';
        if (typeof isUpgrading !== 'undefined') isUpgrading = true;

        const wrap = $('ugx-needle-wrap');
        wrap.style.transition = 'none';
        wrap.style.transform = 'rotate(0deg)';
        void wrap.offsetWidth;

        try {
            const res = await fetch('/api/upgrade', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    inputItemIds: items.map((i) => i.id),
                    targetSkinName: t.name,
                    targetPrice: t.price,
                    targetCondition: t.displayCond
                })
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error || 'Upgrade failed');

            const rot = (7 + Math.floor(Math.random() * 3)) * 360 + (data.roll / 100) * 360;
            wrap.style.transition = 'transform 5s cubic-bezier(0.15, 0, 0.15, 1)';
            wrap.style.transform = `rotate(${rot}deg)`;
            if (typeof upgradeStartSound !== 'undefined') { upgradeStartSound.currentTime = 0; upgradeStartSound.play().catch(() => {}); }

            setTimeout(async () => {
                if (data.win && typeof upgradeWinSound !== 'undefined') upgradeWinSound.play().catch(() => {});
                if (!data.win && typeof upgradeLossSound !== 'undefined') upgradeLossSound.play().catch(() => {});
                showResult(!!data.win, t, data.item);
                if (data.balance !== undefined && typeof updateBalanceUI === 'function') updateBalanceUI(data.balance);
                S.sel = []; S.target = null;
                try { await refreshInventory(); } catch (e) { /* mantém lista antiga */ }
                endBusy(); renderStage(); renderInventory(); computeTargets();
            }, 5500);
        } catch (e) {
            msg(e.message || 'Upgrade failed', true);
            endBusy();
            renderStage();
        }
    }
    // volta a agulha ao topo (0°) pelo caminho mais curto, em vez de ficar torta onde parou
    function resetNeedle() {
        const wrap = $('ugx-needle-wrap');
        if (!wrap) return;
        const m = /rotate\((-?[\d.]+)deg\)/.exec(wrap.style.transform || '');
        const a = m ? ((parseFloat(m[1]) % 360) + 360) % 360 : 0;
        if (!a) { wrap.style.transition = 'none'; wrap.style.transform = 'rotate(0deg)'; return; }
        wrap.style.transition = 'none';
        wrap.style.transform = `rotate(${a}deg)`;
        void wrap.offsetWidth;
        wrap.style.transition = 'transform .9s cubic-bezier(.22, 1, .36, 1)';
        wrap.style.transform = `rotate(${a > 180 ? 360 : 0}deg)`;
    }
    function endBusy() {
        resetNeedle();
        S.busy = false;
        $('ugx').classList.remove('busy');
        $('ugx-go').textContent = 'Upgrade';
        if (typeof isUpgrading !== 'undefined') isUpgrading = false;
    }

    function showResult(win, target, won) {
        const modal = $('upgrade-modal');
        if (!modal) return;
        const p = parseSkin(target.name);
        const cond = (won && won.conditionShort) || target.displayCond;
        $('upgrade-result-card').className = 'result-card ' + (win ? 'result-win' : 'result-loss');
        $('result-title').textContent = win ? 'Upgrade successful' : 'Upgrade failed';
        const cont = modal.querySelector('.result-footer button');
        if (cont) cont.textContent = 'Continue';
        $('result-img').src = target.img;
        $('result-name').textContent = p.base;
        $('result-price').textContent = '$' + money(target.price);
        const badge = $('result-badge');
        badge.textContent = cond;
        badge.className = 'badge cond-' + cond;
        let extra = tagHTML(p);
        if (win && won) {
            if (hasNum(won.wear)) extra += `<div class="ugx-xrow"><span>Float</span><b>${Number(won.wear).toFixed(8)}</b></div>`;
            if (hasNum(won.seed)) extra += `<div class="ugx-xrow"><span>Pattern</span><b>#${Number(won.seed)}</b></div>`;
        }
        $('result-extra').innerHTML = extra;
        modal.style.display = 'flex';
    }

    // ------------------------------------------------------------------ eventos / init
    function syncChips() {
        $('ugx-t-conds').querySelectorAll('button').forEach((b) => b.classList.toggle('on', S.t.conds.has(b.dataset.v)));
    }
    function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

    // ------------------------------------------------------------------ dropdowns personalizados
    // Troca cada <select> do upgrader por um menu de vidro. O <select> original fica escondido e em sincronia,
    // por isso o resto do código (.value / evento 'change') continua a funcionar igual.
    function enhanceSelects() {
        const root = $('ugx');
        if (!root) return;
        const nv = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
        const dds = [];
        const closeAll = (except) => dds.forEach((d) => { if (d !== except) d.close(); });

        root.querySelectorAll('select').forEach((sel) => {
            if (sel.closest('.ugx-dd')) return;
            const wrap = document.createElement('div');
            wrap.className = 'ugx-dd';
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'ugx-dd-btn';
            btn.setAttribute('aria-haspopup', 'listbox');
            btn.setAttribute('aria-expanded', 'false');
            btn.setAttribute('aria-label', sel.getAttribute('aria-label') || 'Select');
            const label = document.createElement('span');
            label.className = 'ugx-dd-label';
            btn.appendChild(label);
            const menu = document.createElement('div');
            menu.className = 'ugx-dd-menu';
            menu.setAttribute('role', 'listbox');

            sel.parentNode.insertBefore(wrap, sel);
            wrap.append(sel, btn, menu);
            sel.tabIndex = -1;

            const opts = Array.from(sel.options).map((o) => {
                const el = document.createElement('div');
                el.className = 'ugx-dd-opt';
                el.setAttribute('role', 'option');
                el.dataset.v = o.value;
                el.innerHTML = `<span>${esc(o.textContent)}</span>`;
                menu.appendChild(el);
                return el;
            });
            let active = -1;
            const paint = () => {
                const cur = nv.get.call(sel);
                const o = sel.options[sel.selectedIndex];
                label.textContent = o ? o.textContent : '';
                opts.forEach((el) => {
                    const on = el.dataset.v === cur;
                    el.classList.toggle('on', on);
                    el.setAttribute('aria-selected', on ? 'true' : 'false');
                });
            };
            const setActive = (i) => {
                active = (i + opts.length) % opts.length;
                opts.forEach((el, k) => el.classList.toggle('kb', k === active));
                if (opts[active].scrollIntoView) opts[active].scrollIntoView({ block: 'nearest' });
            };
            const dd = { close() { wrap.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); } };
            dds.push(dd);
            const open = () => { closeAll(dd); wrap.classList.add('open'); btn.setAttribute('aria-expanded', 'true'); setActive(sel.selectedIndex); };
            const pick = (v) => {
                if (nv.get.call(sel) !== v) { nv.set.call(sel, v); paint(); sel.dispatchEvent(new Event('change', { bubbles: true })); }
                dd.close();
                btn.focus();
            };

            // quando o código faz select.value = '...' o menu atualiza sozinho
            Object.defineProperty(sel, 'value', {
                configurable: true,
                get() { return nv.get.call(this); },
                set(v) { nv.set.call(this, v); paint(); }
            });

            btn.addEventListener('click', () => (wrap.classList.contains('open') ? dd.close() : open()));
            menu.addEventListener('click', (e) => { const el = e.target.closest('.ugx-dd-opt'); if (el) pick(el.dataset.v); });
            btn.addEventListener('keydown', (e) => {
                const isOpen = wrap.classList.contains('open');
                if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                    e.preventDefault();
                    if (!isOpen) open(); else setActive(active + (e.key === 'ArrowDown' ? 1 : -1));
                } else if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    if (isOpen && active >= 0) pick(opts[active].dataset.v); else open();
                } else if (e.key === 'Escape' || e.key === 'Tab') {
                    dd.close();
                }
            });
            paint();
        });
        document.addEventListener('pointerdown', (e) => { if (!e.target.closest || !e.target.closest('.ugx-dd')) closeAll(); });
    }

    function bind() {
        if (S.bound) return;
        S.bound = true;
        enhanceSelects();
        lazyScroll($('ugx-i-grid')); lazyScroll($('ugx-t-grid'));
        $('ugx-i-grid').addEventListener('click', onInvClick);
        $('ugx-t-grid').addEventListener('click', onTargetClick);

        $('ugx-i-search').addEventListener('input', debounce((e) => { S.i.q = e.target.value; renderInventory(); }, 150));
        $('ugx-i-sort').addEventListener('change', (e) => { S.i.sort = e.target.value; renderInventory(); });

        $('ugx-t-search').addEventListener('input', debounce((e) => { S.t.q = e.target.value; computeTargets(); }, 180));
        $('ugx-t-sort').addEventListener('change', (e) => { S.t.sort = e.target.value; computeTargets(); });
        $('ugx-t-type').addEventListener('change', (e) => { S.t.type = e.target.value; computeTargets(); });
        $('ugx-t-conds').addEventListener('click', (e) => {
            const b = e.target.closest('button'); if (!b) return;
            S.t.conds.has(b.dataset.v) ? S.t.conds.delete(b.dataset.v) : S.t.conds.add(b.dataset.v);
            syncChips(); computeTargets();
        });
        $('ugx-mults').addEventListener('click', (e) => {
            const b = e.target.closest('button'); if (!b || S.busy) return;
            if (b.dataset.clear) clearAll(); else applyMult(parseFloat(b.dataset.m));
        });
        $('ugx-go').addEventListener('click', go);
        bindSlider();
        watchTab();
    }


    // ------------------------------------------------------------------ sem scroll na página
    // Ajusta a altura do upgrader ao espaço real do ecrã e bloqueia o scroll do contentor enquanto a aba está aberta.
    function fit() {
        const tab = $('upgrade-tab'), root = $('ugx');
        if (!tab || !root || tab.style.display === 'none') return;
        const main = tab.closest('.main-content') || tab.parentElement;
        const cs = getComputedStyle(main);
        const avail = main.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
        if (avail > 300) root.style.height = avail + 'px';
    }
    function lockScroll(on) {
        const main = $('upgrade-tab').closest('.main-content');
        if (!main) return;
        if (on) { main.dataset.ugxOv = main.style.overflowY || ''; main.style.setProperty('overflow-y', 'hidden', 'important'); main.scrollTop = 0; }
        else { main.style.removeProperty('overflow-y'); if (main.dataset.ugxOv) main.style.overflowY = main.dataset.ugxOv; }
    }
    function watchTab() {
        const tab = $('upgrade-tab');
        let open = false;
        const sync = () => {
            const now = tab.style.display !== 'none';
            if (now === open) return;
            open = now; lockScroll(now);
            if (now) requestAnimationFrame(fit);
        };
        new MutationObserver(sync).observe(tab, { attributes: true, attributeFilter: ['style'] });
        window.addEventListener('resize', fit);
        sync();
    }

    async function init() {
        bind();
        fit();
        try {
            await Promise.all([loadCatalog(), refreshInventory()]);
        } catch (e) {
            msg(e.message || 'Could not load the upgrader', true);
            return;
        }
        if (S.busy) return;
        paintRange();
        renderInventory();
        renderStage();
        computeTargets();
    }

    window.initUpgrader = init;
})();