/* inventory.js — UI do Inventário (carrega depois do main.js e do upgrader.js e substitui o loadInventory antigo) */
(function () {
    'use strict';

    const $ = (id) => document.getElementById(id);
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const money = (n) => (typeof formatCurrency === 'function' ? formatCurrency(Number(n) || 0) : (Number(n) || 0).toFixed(2));
    const BATCH = 36;
    const COND_NAME = { FN: 'factory new', MW: 'minimal wear', FT: 'field-tested', WW: 'well-worn', BS: 'battle-scarred' };

    const S = { items: [], byId: new Map(), view: [], q: '', sort: 'newest', rar: 'all', bound: false, req: 0 };

    // ------------------------------------------------------------------ helpers
    // Tira StatTrak™/Souvenir do nome e devolve-os como tags separadas (igual ao upgrader)
    function parseSkin(name) {
        const n = String(name || '');
        const st = /stattrak/i.test(n), sv = /souvenir/i.test(n);
        const base = n.replace(/stattrak™?\s*/ig, '').replace(/souvenir\s*/ig, '').replace(/\s{2,}/g, ' ').trim();
        const i = base.indexOf(' | ');
        return { st, sv, base, weapon: i > 0 ? base.slice(0, i) : base, finish: i > 0 ? base.slice(i + 3) : '' };
    }
    function tagHTML(p) {
        return p.st ? '<span class="ugx-tag st">StatTrak™</span>' : p.sv ? '<span class="ugx-tag sv">Souvenir</span>' : '';
    }
    const hasNum = (v) => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v));
    function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

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

    const LOCK_SVG = '<svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor" aria-hidden="true"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM9 6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9V6zm9 14H6V10h12v10zm-6-3c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2z"/></svg>';

    function badgesHTML(it) {
        const b = [];
        if (it.equippedTeam === 2 || it.equippedTeam === 4) b.push('<span class="inv2-b t" title="Equipped as Terrorist">T</span>');
        if (it.equippedTeam === 3 || it.equippedTeam === 4) b.push('<span class="inv2-b ct" title="Equipped as Counter-Terrorist">CT</span>');
        if (it.isLocked) b.push(`<span class="inv2-b lock" title="Locked">${LOCK_SVG}</span>`);
        return b.length ? `<div class="inv2-badges">${b.join('')}</div>` : '';
    }

    function cardHTML(it) {
        const p = parseSkin(it.name);
        const cond = it.conditionShort || '';
        const parts = [];
        if (hasNum(it.wear)) parts.push(`<span title="Float">${Number(it.wear).toFixed(5)}</span>`);
        if (hasNum(it.seed)) parts.push(`<span class="seed" title="Pattern">#${Number(it.seed)}</span>`);
        return `<div class="ugx-card inv2-card" data-id="${esc(it.id)}" role="button" tabindex="0" aria-label="${esc(p.base)}" style="--rc:${esc(it.color || '#4b69ff')}">
            <div class="ugx-card-top"><span class="ugx-wear ${esc(cond)}">${esc(cond)}</span>${tagHTML(p)}</div>
            ${badgesHTML(it)}
            <img src="${esc(it.img)}" alt="" loading="lazy" decoding="async">
            <div class="ugx-weapon">${esc(p.finish ? p.weapon : '\u00A0')}</div>
            <div class="ugx-finish" title="${esc(p.base)}">${esc(p.finish || p.weapon)}</div>
            <div class="ugx-price">$${money(it.value)}</div>
            <div class="ugx-meta">${parts.join('')}</div>
        </div>`;
    }

    // ------------------------------------------------------------------ lista com render incremental
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
    function more(grid) {
        const a = grid._n, b = Math.min(a + BATCH, grid._items.length);
        if (a >= b) return;
        let h = '';
        for (let i = a; i < b; i++) h += grid._render(grid._items[i]);
        grid.insertAdjacentHTML('beforeend', h);
        grid._n = b;
    }
    // A página inteira faz scroll (.main-content). Estas funções mexem nesse scroll sem a animação "smooth" do CSS.
    const scroller = () => { const r = $('inv2'); return r && r.closest('.main-content'); };
    function jump(sc, top) {
        const prev = sc.style.scrollBehavior;
        sc.style.scrollBehavior = 'auto';
        sc.scrollTop = top;
        sc.style.scrollBehavior = prev;
    }
    // keep = true: vem de um reload (vender, equipar...) -> mantém a posição e não repete a animação de entrada
    function mountList(grid, items, render, emptyHTML, keep) {
        const sc = scroller();
        const visible = !!(sc && grid.offsetParent !== null);
        let saved = 0, gridTop = 0;
        if (keep && visible) {
            saved = sc.scrollTop;
            gridTop = grid.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop;
            grid.style.minHeight = grid.offsetHeight + 'px'; // a página não encolhe a meio da atualização
        } else if (!keep) {
            if (visible) jump(sc, 0);
            refreshAnim(grid);
        }
        grid._items = items; grid._render = render; grid._n = 0;
        grid.innerHTML = '';
        if (!items.length) { grid.style.minHeight = ''; grid.innerHTML = `<div class="ugx-empty">${emptyHTML}</div>`; return; }
        more(grid);
        if (saved) {
            const need = saved - gridTop + window.innerHeight + 420;
            while (grid._n < items.length && grid.lastElementChild.getBoundingClientRect().bottom - grid.getBoundingClientRect().top < need) more(grid);
            jump(sc, saved);
        }
        grid.style.minHeight = '';
        kickEnd();
    }
    // desenha mais cartas quando o fim da lista se aproxima do ecrã
    let io = null;
    function kickEnd() { const end = $('inv2-end'); if (io && end) { io.unobserve(end); io.observe(end); } }
    function watchEnd(grid) {
        const end = $('inv2-end'), sc = scroller();
        if (end && 'IntersectionObserver' in window) {
            io = new IntersectionObserver((es) => {
                if (!es.some((e) => e.isIntersecting) || !grid._items) return;
                more(grid);
                if (grid._n < grid._items.length) requestAnimationFrame(kickEnd); // ainda há espaço vazio: continua
            }, { rootMargin: '0px 0px 700px 0px' });
            io.observe(end);
        } else if (sc) {
            sc.addEventListener('scroll', () => {
                if (grid._items && sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 600) more(grid);
            }, { passive: true });
        }
    }

    // ------------------------------------------------------------------ filtrar + ordenar + desenhar
    function floatKey(it) { return hasNum(it.wear) ? Number(it.wear) : Infinity; }

    function compute() {
        const q = parseQ(S.q);
        const list = S.items.filter((it) => {
            if (S.rar !== 'all' && String(it.color || '').toLowerCase() !== S.rar) return false;
            const v = Number(it.value) || 0;
            if (q.min !== null && v < q.min) return false;
            if (q.max !== null && v > q.max) return false;
            if (q.text.length) {
                const c = String(it.conditionShort || '').toUpperCase();
                const hay = (String(it.name || '') + ' ' + c + ' ' + (COND_NAME[c] || '')).toLowerCase();
                if (!q.text.every((t) => hay.includes(t))) return false;
            }
            return true;
        });
        if (S.sort === 'high') list.sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0));
        else if (S.sort === 'low') list.sort((a, b) => (Number(a.value) || 0) - (Number(b.value) || 0));
        else if (S.sort === 'float') list.sort((a, b) => { const x = floatKey(a), y = floatKey(b); return x === y ? 0 : x < y ? -1 : 1; });
        else if (S.sort === 'name') list.sort((a, b) => parseSkin(a.name).base.localeCompare(parseSkin(b.name).base));
        return list; // 'newest' = ordem de S.items (mais recentes primeiro)
    }

    function paintHeader() {
        const total = S.items.length, shown = S.view.length;
        const sum = S.view.reduce((s, it) => s + (Number(it.value) || 0), 0);
        $('inv2-count').textContent = shown === total ? `${total} ${total === 1 ? 'skin' : 'skins'}` : `${shown} of ${total}`;
        $('inv2-total').textContent = '$' + money(sum);
        $('btn-sell-all').disabled = total === 0;
        $('inv2-rar').querySelectorAll('button').forEach((b) => {
            const v = b.dataset.v;
            const n = v === 'all' ? total : S.items.filter((it) => String(it.color || '').toLowerCase() === v).length;
            b.dataset.n = n;
            b.querySelector('small').textContent = n;
            b.classList.toggle('on', v === S.rar);
        });
    }

    function render(keep) {
        S.view = compute();
        paintHeader();
        const empty = S.items.length === 0
            ? '<b>Your inventory is empty</b>Open a case to get your first skin.'
            : '<b>No skins found</b>Try another search or clear the rarity filter.';
        mountList($('inv2-grid'), S.view, cardHTML, empty, keep);
    }

    // ------------------------------------------------------------------ dados
    async function load() {
        bind();
        const req = ++S.req;
        let data;
        try {
            const res = await fetch('/api/me');
            data = await res.json();
        } catch (e) { console.error(e); return; }
        if (!data || !data.loggedIn || req !== S.req) return; // resposta antiga: ignora
        currentUser = data.user;
        S.items = (data.user.inventory || []).slice().reverse(); // o servidor guarda do mais antigo para o mais novo
        S.byId = new Map(S.items.map((it) => [String(it.id), it]));
        render(true);
    }

    // ------------------------------------------------------------------ dropdown personalizado
    // Troca o <select> por um menu de vidro (mesmo comportamento do upgrader). O <select> fica escondido e em sincronia.
    function enhanceSelects() {
        const root = $('inv2');
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
        document.addEventListener('pointerdown', (e) => { if (!e.target.closest || !e.target.closest('#inv2 .ugx-dd')) closeAll(); });
    }

    // ------------------------------------------------------------------ eventos
    function openItem(card) {
        const it = card && S.byId.get(card.dataset.id);
        if (it && typeof openSkinModal === 'function') openSkinModal(it);
    }
    function bind() {
        if (S.bound || !$('inv2')) return;
        S.bound = true;
        enhanceSelects();
        const grid = $('inv2-grid');
        watchEnd(grid);
        grid.addEventListener('click', (e) => openItem(e.target.closest('.inv2-card')));
        grid.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            const card = e.target.closest && e.target.closest('.inv2-card');
            if (!card) return;
            e.preventDefault();
            openItem(card);
        });
        $('inv2-search').addEventListener('input', debounce((e) => { S.q = e.target.value; render(false); }, 150));
        $('inv2-sort').addEventListener('change', (e) => { S.sort = e.target.value; render(false); });
        $('inv2-rar').addEventListener('click', (e) => {
            const b = e.target.closest('button'); if (!b) return;
            S.rar = b.dataset.v;
            render(false);
        });
    }

    // ------------------------------------------------------------------ modal da skin (substitui o openSkinModal antigo)
    const WEAR_FULL = { FN: 'Factory New', MW: 'Minimal Wear', FT: 'Field-Tested', WW: 'Well-Worn', BS: 'Battle-Scarred' };
    const EQUIP_AVAILABLE = false; // false = botões de equipar bloqueados com "Unavailable" (põe true para voltar a equipar)
    const WEAR_SEGS = [['FN', 0.07], ['MW', 0.08], ['FT', 0.23], ['WW', 0.07], ['BS', 0.55]]; // larguras = intervalos de float
    const IC_LOCK = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9.5" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';
    const IC_UNLOCK = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9.5" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 7.5-2"/></svg>';
    const IC_OUT = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h9M10.5 7.5L15 12l-4.5 4.5M19 5v14"/></svg>';

    // "RIFLES • ASSAULT RIFLE" -> "Assault rifle"
    function catLabel(weaponId) {
        if (typeof getWeaponCategory !== 'function') return '';
        const last = String(getWeaponCategory(weaponId) || '').split('•').pop().trim();
        if (!last || /^other$/i.test(last)) return '';
        if (/^smgs?$/i.test(last)) return 'SMG';
        const t = last.toLowerCase();
        return t.charAt(0).toUpperCase() + t.slice(1);
    }
    function floatBar(w, cond) {
        const segs = WEAR_SEGS.map(([k, span]) => `<i class="${k}${k === cond ? ' on' : ''}" style="flex:${span}"></i>`).join('');
        const mark = hasNum(w) ? `<b style="left:${Math.max(0, Math.min(1, Number(w))) * 100}%"></b>` : '';
        return segs + mark;
    }
    function actionsHTML(it) {
        const id = esc(it.id);
        const eq = it.equippedTeam || 0;
        const type = typeof getWeaponTeamType === 'function' ? getWeaponTeamType(it.weaponId) : 'both';
        const onT = EQUIP_AVAILABLE && (eq === 2 || eq === 4), onCT = EQUIP_AVAILABLE && (eq === 3 || eq === 4);
        const lockAttr = EQUIP_AVAILABLE ? '' : ' disabled aria-disabled="true" title="Equipping is unavailable"';
        const offCls = EQUIP_AVAILABLE ? '' : ' off';
        const offTag = EQUIP_AVAILABLE ? '' : '<span class="skm-off">Unavailable</span>';
        let h = '';
        if (type === 'tr' || type === 'ct' || type === 'both') {
            h += '<div class="skm-label">Equip</div><div class="skm-equip">';
            if (type === 'tr' || type === 'both') h += `<button type="button" class="skm-btn t${onT ? ' on' : ''}${offCls}" data-act="equip" data-team="2" data-id="${id}"${lockAttr}><i class="skm-ic t">T</i>Terrorist${offTag}</button>`;
            if (type === 'ct' || type === 'both') h += `<button type="button" class="skm-btn ct${onCT ? ' on' : ''}${offCls}" data-act="equip" data-team="3" data-id="${id}"${lockAttr}><i class="skm-ic ct">CT</i>Counter-Terrorist${offTag}</button>`;
            if (type === 'both') h += `<button type="button" class="skm-btn both wide${EQUIP_AVAILABLE && eq === 4 ? ' on' : ''}${offCls}" data-act="equip" data-team="4" data-id="${id}"${lockAttr}><span class="skm-pair"><i class="skm-ic t">T</i><i class="skm-ic ct">CT</i></span>Both sides${offTag}</button>`;
            h += '</div>';
        }
        if (eq > 0) h += `<button type="button" class="skm-btn quiet" data-act="unequip" data-id="${id}">${IC_OUT}Remove from loadout</button>`;
        h += '<div class="skm-end">';
        h += `<button type="button" class="skm-btn quiet${it.isLocked ? ' locked' : ''}" data-act="lock" data-id="${id}">${it.isLocked ? IC_UNLOCK + 'Unlock skin' : IC_LOCK + 'Lock skin'}</button>`;
        h += `<button type="button" class="skm-sell" data-act="sell" data-id="${id}">Sell for $${money(it.value)}</button>`;
        h += '</div>';
        return h;
    }

    function openSkin(item) {
        const modal = $('skin-action-modal');
        if (!modal || !item) return;
        bindModal(); // o modal está no HTML depois dos <script>, por isso só aqui já existe
        const p = parseSkin(item.name);
        const cond = String(item.conditionShort || '').toUpperCase();
        const color = item.color || '#4b69ff';
        modal.style.setProperty('--rc', color);
        document.documentElement.style.setProperty('--rarity-color', color); // o resto do site ainda usa esta variável

        const img = $('modal-skin-img');
        img.src = item.img;
        img.alt = p.base;
        const pill = $('modal-skin-cond');
        pill.className = 'ugx-wear ' + cond;
        pill.textContent = cond;
        $('modal-skin-tag').innerHTML = tagHTML(p);
        $('modal-skin-type').textContent = catLabel(item.weaponId);
        $('modal-skin-weapon').textContent = p.finish ? p.weapon : '';
        const title = (p.finish || p.weapon).replace(/\s*\((factory new|minimal wear|field-tested|well-worn|battle-scarred)\)\s*$/i, '');
        $('modal-skin-name').textContent = title;
        $('modal-skin-price').textContent = '$' + money(item.value);
        $('modal-full-cond').textContent = WEAR_FULL[cond] || 'Unknown';
        $('modal-float-val').textContent = hasNum(item.wear) ? Number(item.wear).toFixed(8) : '—';
        $('modal-seed-val').textContent = hasNum(item.seed) ? '#' + Number(item.seed) : '—';
        $('skm-fbar').innerHTML = floatBar(item.wear, cond);
        $('modal-actions-container').innerHTML = actionsHTML(item);

        modal.classList.remove('closing');
        modal.style.display = 'flex';
        const first = modal.querySelector('.skm-btn, .skm-sell');
        if (first) first.focus({ preventScroll: true });
    }

    function bindModal() {
        const modal = $('skin-action-modal'), box = $('modal-actions-container');
        if (!modal || !box || modal._skm) return;
        modal._skm = true;
        const isOpen = () => modal.style.display !== 'none' && !modal.classList.contains('closing');

        box.addEventListener('click', async (e) => {
            const b = e.target.closest('button[data-act]');
            if (!b || b.disabled) return;
            const id = b.dataset.id, act = b.dataset.act;
            if (act === 'equip' && !EQUIP_AVAILABLE) return;
            const btns = box.querySelectorAll('button');
            btns.forEach((x) => { x.disabled = true; });
            try {
                if (act === 'equip') await executeSkinAction(id, Number(b.dataset.team));
                else if (act === 'unequip') await executeSkinAction(id, 0, 'unequip');
                else if (act === 'lock') await toggleItemLock(id);
                else if (act === 'sell') await executeSellFromModal(id);
            } catch (err) {
                console.error(err);
            } finally {
                if (isOpen()) btns.forEach((x) => { if (!x.classList.contains('off')) x.disabled = false; }); // falhou: deixa tentar outra vez
            }
        });
        modal.addEventListener('mousedown', (e) => { if (e.target === modal) closeSkinModal(); }); // clicar fora fecha
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && isOpen()) closeSkinModal(); });
    }

    window.openSkinModal = openSkin;
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindModal); else bindModal();

    window.loadInventory = load;
    bind();
})();