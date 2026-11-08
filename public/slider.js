// slider.js — modo de jogo SLIDER (verde / vermelho)
// O jogador escolhe a chance (zona verde). Quanto maior o verde, menor o multiplicador.
// O sorteio é feito no servidor (/api/slider/play); aqui só se desenha e anima o resultado.
// Usa helpers do main.js: bdEsc, bdHasNum, bdParseSkin, bdParseQ, bdEnhanceSelects, formatCurrency, showToast, playTick…

const SLD_MIN = 2;          // % mínimo de chance (igual ao servidor)
const SLD_MAX = 90;         // % máximo de chance
const SLD_EDGE = 0.05;      // margem da casa (igual ao servidor)
const SLD_MAX_ITEMS = 5;
const SLD_BATCH = 48;

// ---- SOM DO SLIDER ----
// Mete o teu ficheiro na pasta assets/ e põe aqui o nome. Toca uma vez quando o marcador começa a andar
// e é cortado quando ele pára. Se o ficheiro não existir/falhar, usa os "tiques" do spinner como antes.
const SLD_SOUND_FILE = '/assets/slider.mp3';   // <- muda para o nome do teu ficheiro (ou '' para usar só os tiques)
const SLD_SOUND_VOLUME = 0.5;                  // 0 a 1
// ---- VELOCIDADE DO SLIDER ----
const SLD_SPIN_MS = 2000;   // duração do marcador a andar (antes: 3600). Menos = mais rápido
const SLD_RESULT_MS = 500;  // pausa depois de parar, antes de abrir o resultado (antes: 900)
let sldSound = null;
let sldSoundOk = false;
function sldLoadSound() {
    if (!SLD_SOUND_FILE || sldSound) return;
    sldSound = new Audio(SLD_SOUND_FILE);
    sldSound.volume = SLD_SOUND_VOLUME;
    sldSound.preload = 'auto';
    sldSound.addEventListener('canplaythrough', () => { sldSoundOk = true; }, { once: true });
    sldSound.addEventListener('error', () => { sldSoundOk = false; });
    sldSound.load();
}

let sldSelected = [];
let sldChance = 50;
let sldBusy = false;
let sldBound = false;
let sldSearch = '';
let sldSortMode = 'newest';
let sldRenderLimit = SLD_BATCH;
let sldSearchTimer = null;

const sldMult = (c) => Math.round((100 / c) * (1 - SLD_EDGE) * 100) / 100;
const sldClamp = (v) => Math.min(SLD_MAX, Math.max(SLD_MIN, v));
const sldEl = (id) => document.getElementById(id);

// ---------- inventário ----------
function sldInventory() {
    return (currentUser && currentUser.inventory) || [];
}
function sldUsable(it) {
    return !it.isLocked && !(it.equippedTeam > 0);
}

function sldVisibleItems() {
    let items = [...sldInventory()].filter(sldUsable).reverse(); // mais recentes primeiro
    const q = bdParseQ(sldSearch);
    items = items.filter((it) => {
        const v = Number(it.value) || 0;
        if (q.min !== null && v < q.min) return false;
        if (q.max !== null && v > q.max) return false;
        if (q.text.length) {
            const hay = (String(it.name || '') + ' ' + String(it.conditionShort || '')).toLowerCase();
            if (!q.text.every((t) => hay.includes(t))) return false;
        }
        return true;
    });
    if (sldSortMode === 'high') items.sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0));
    else if (sldSortMode === 'low') items.sort((a, b) => (Number(a.value) || 0) - (Number(b.value) || 0));
    else if (sldSortMode === 'float') items.sort((a, b) => (bdHasNum(a.wear) ? Number(a.wear) : Infinity) - (bdHasNum(b.wear) ? Number(b.wear) : Infinity));
    return items;
}

function sldCardHTML(it) {
    const p = bdParseSkin(it.name);
    const cond = it.conditionShort || '';
    const tag = p.st ? '<span class="ugx-tag st">StatTrak™</span>' : p.sv ? '<span class="ugx-tag sv">Souvenir</span>' : '';
    const parts = [];
    if (bdHasNum(it.wear)) parts.push(`<span title="Float">${Number(it.wear).toFixed(5)}</span>`);
    if (bdHasNum(it.seed)) parts.push(`<span class="seed" title="Pattern">#${Number(it.seed)}</span>`);
    const picked = sldSelected.includes(it.id);
    return `<div class="ugx-card sgy-card${picked ? ' sel' : ''}" data-id="${bdEsc(it.id)}" role="button" tabindex="0" aria-pressed="${picked}" aria-label="${bdEsc(p.base)}" style="--rc:${bdEsc(it.color || '#4b69ff')}" onclick="sldToggle(this.dataset.id)" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();sldToggle(this.dataset.id);}">
        <div class="ugx-card-top"><span class="ugx-wear ${bdEsc(cond)}">${bdEsc(cond)}</span>${tag}</div>
        <img src="${bdEsc(it.img)}" alt="" loading="lazy" decoding="async">
        <div class="ugx-weapon">${bdEsc(p.finish ? p.weapon : '\u00A0')}</div>
        <div class="ugx-finish" title="${bdEsc(p.base)}">${bdEsc(p.finish || p.weapon)}</div>
        <div class="ugx-price">$${formatCurrency(Number(it.value) || 0)}</div>
        <div class="ugx-meta">${parts.join('')}</div>
    </div>`;
}

function sldMore(grid) {
    const items = grid._sldItems || [];
    const have = grid.querySelectorAll('.sgy-card').length;
    if (have >= items.length) return;
    grid.insertAdjacentHTML('beforeend', items.slice(have, have + SLD_BATCH).map(sldCardHTML).join(''));
    sldRenderLimit = Math.max(sldRenderLimit, have + SLD_BATCH);
}

function sldRenderInventory() {
    const grid = sldEl('sld-inv-grid');
    if (!grid || !currentUser) return;
    // tira da seleção o que já não existe / ficou bloqueado
    const ok = new Set(sldInventory().filter(sldUsable).map((i) => i.id));
    sldSelected = sldSelected.filter((id) => ok.has(id));

    const items = sldVisibleItems();
    grid._sldItems = items;
    const top = grid.scrollTop;
    if (!items.length) {
        const all = sldInventory();
        const free = all.filter(sldUsable).length;
        grid.innerHTML = all.length === 0
            ? '<div class="ugx-empty"><b>Your inventory is empty</b>Open a case to get your first skin.</div>'
            : free === 0
                ? '<div class="ugx-empty"><b>No skins available</b>Locked or equipped skins can\'t be used here.</div>'
                : '<div class="ugx-empty"><b>No skins found</b>Try another search.</div>';
    } else {
        grid.innerHTML = items.slice(0, sldRenderLimit).map(sldCardHTML).join('');
        grid.scrollTop = top;
    }
    sldUpdateUI();
}

function sldOnInventory() {
    const tab = sldEl('slider-tab');
    if (tab && tab.style.display !== 'none' && !sldBusy) sldRenderInventory();
}

function sldToggle(id) {
    if (sldBusy) return;
    const i = sldSelected.indexOf(id);
    if (i > -1) sldSelected.splice(i, 1);
    else if (sldSelected.length < SLD_MAX_ITEMS) sldSelected.push(id);
    else showToast(`You can pick up to ${SLD_MAX_ITEMS} skins per spin.`, 'warn', 'Limit reached');

    const grid = sldEl('sld-inv-grid');
    if (grid) grid.querySelectorAll('.sgy-card').forEach((c) => {
        const on = sldSelected.includes(c.dataset.id);
        c.classList.toggle('sel', on);
        c.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    sldUpdateUI();
}

// ---------- slot, stats e slider ----------
function sldBet() {
    const sel = sldInventory().filter((it) => sldSelected.includes(it.id));
    return { sel, total: sel.reduce((s, it) => s + (Number(it.value) || 0), 0) };
}

function sldRenderSlot(sel, total) {
    const el = sldEl('sld-in-box');
    if (!el) return;
    el.innerHTML = sel.length
        ? `<span class="ugx-slot-label">You put in</span>
           <div class="ugx-stack">${sel.map((i) => `<img src="${bdEsc(i.img || i.image)}" alt="">`).join('')}</div>
           <div class="ugx-slot-main gold">$${formatCurrency(total)}</div>
           <div class="ugx-slot-sub">${sel.length} ${sel.length === 1 ? 'skin' : 'skins'}</div>`
        : `<span class="ugx-slot-label">You put in</span><div class="ugx-slot-hint">Pick up to ${SLD_MAX_ITEMS} skins from your inventory</div>`;
}

function sldUpdateUI() {
    const { sel, total } = sldBet();
    const mult = sldMult(sldChance);
    const set = (id, v) => { const e = sldEl(id); if (e) e.textContent = v; };

    set('sld-count', `${sldSelected.length}/${SLD_MAX_ITEMS}`);
    set('sld-sel-count', sel.length + (sel.length === 1 ? ' skin' : ' skins'));
    set('sld-bet', '$' + formatCurrency(total));
    set('sld-potential', '$' + formatCurrency(total * mult));
    set('sld-chance', sldChance.toFixed(2) + '%');
    set('sld-lose', (100 - sldChance).toFixed(2) + '%');

    const m = sldEl('sld-mult');
    if (m) {
        const txt = mult.toFixed(2) + 'x';
        if (m.textContent !== txt) {
            m.textContent = txt;
            m.classList.remove('bump'); void m.offsetWidth; m.classList.add('bump');
            setTimeout(() => m.classList.remove('bump'), 160);
        }
    }

    const track = sldEl('sld-track');
    if (track) track.style.setProperty('--p', sldChance + '%');
    const handle = sldEl('sld-handle');
    if (handle) handle.setAttribute('aria-valuenow', String(Math.round(sldChance)));

    document.querySelectorAll('#sld-presets button').forEach((b) => b.classList.toggle('on', Math.abs(Number(b.dataset.c) - sldChance) < 0.05));

    sldRenderSlot(sel, total);
    const btn = sldEl('sld-go');
    if (btn) btn.disabled = sldBusy || sel.length === 0;
}

function sldSetChance(v, round = 0.1) {
    let c = sldClamp(Number(v));
    if (!Number.isFinite(c)) return;
    if (round) c = Math.round(c / round) * round;
    sldChance = Math.round(sldClamp(c) * 100) / 100;
    sldUpdateUI();
}

// ---------- ligações (só uma vez) ----------
function sldBind() {
    if (sldBound) return;
    sldBound = true;
    sldLoadSound();
    bdEnhanceSelects('sld');

    const grid = sldEl('sld-inv-grid');
    grid.addEventListener('scroll', () => {
        if (grid.scrollTop + grid.clientHeight >= grid.scrollHeight - 300) sldMore(grid);
    }, { passive: true });

    const search = sldEl('sld-search');
    const sort = sldEl('sld-sort');
    if (search) search.addEventListener('input', () => {
        clearTimeout(sldSearchTimer);
        sldSearchTimer = setTimeout(() => {
            sldSearch = search.value;
            sldRenderLimit = SLD_BATCH;
            grid.scrollTop = 0;
            sldRenderInventory();
        }, 150);
    });
    if (sort) sort.addEventListener('change', () => {
        sldSortMode = sort.value;
        sldRenderLimit = SLD_BATCH;
        grid.scrollTop = 0;
        sldRenderInventory();
    });

    // arrastar / clicar no slider
    const track = sldEl('sld-track');
    const fromX = (clientX) => {
        const r = track.getBoundingClientRect();
        return ((clientX - r.left) / r.width) * 100;
    };
    track.addEventListener('pointerdown', (e) => {
        if (sldBusy) return;
        e.preventDefault();
        track.classList.add('drag');
        try { track.setPointerCapture(e.pointerId); } catch (_) { /* ok */ }
        sldSetChance(fromX(e.clientX));
    });
    track.addEventListener('pointermove', (e) => {
        if (!track.classList.contains('drag')) return;
        sldSetChance(fromX(e.clientX));
    });
    const end = (e) => {
        track.classList.remove('drag');
        try { track.releasePointerCapture(e.pointerId); } catch (_) { /* ok */ }
    };
    track.addEventListener('pointerup', end);
    track.addEventListener('pointercancel', end);

    // teclado na pega
    sldEl('sld-handle').addEventListener('keydown', (e) => {
        if (sldBusy) return;
        const step = e.shiftKey ? 5 : 1;
        if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); sldSetChance(sldChance - step, 0); }
        else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); sldSetChance(sldChance + step, 0); }
        else if (e.key === 'Home') { e.preventDefault(); sldSetChance(SLD_MIN, 0); }
        else if (e.key === 'End') { e.preventDefault(); sldSetChance(SLD_MAX, 0); }
    });

    // atalhos
    sldEl('sld-presets').addEventListener('click', (e) => {
        const b = e.target.closest('button[data-c]');
        if (b && !sldBusy) sldSetChance(Number(b.dataset.c), 0);
    });
}

async function initSlider() {
    sldBind();
    if (!currentUser) {
        try { await loadInventory(); } catch (e) { /* sem sessão */ }
    }
    sldRenderInventory();
}

// ---------- jogo ----------
function sldSetBusy(on) {
    sldBusy = on;
    const root = sldEl('sld');
    if (root) root.classList.toggle('busy', on);
    sldUpdateUI();
}

// move o marcador até ao resultado, com "tiques" enquanto passa
function sldAnimateMarker(roll) {
    return new Promise((resolve) => {
        const track = sldEl('sld-track');
        const marker = sldEl('sld-marker');
        const label = sldEl('sld-marker-val');
        const DURATION = SLD_SPIN_MS;

        track.classList.remove('res-win', 'res-lose');
        marker.classList.remove('win', 'lose');
        marker.style.transition = 'none';
        marker.style.left = (roll < 50 ? 100 : 0) + '%';   // começa do lado oposto: faz sempre um bom percurso
        label.textContent = (roll < 50 ? 100 : 0).toFixed(2);
        marker.classList.add('show');
        void marker.offsetWidth;
        marker.style.transition = `left ${DURATION}ms cubic-bezier(.07, .62, .13, 1)`;
        marker.style.left = roll + '%';

        // som: o teu ficheiro (se carregou) ou os tiques do spinner
        let useFile = sldSoundOk && !!sldSound;
        if (useFile) {
            try {
                sldSound.currentTime = 0;
                const p = sldSound.play();
                if (p && p.catch) p.catch(() => { useFile = false; });
            } catch (_) { useFile = false; }
        }

        const t0 = performance.now();
        let lastTick = -1;
        const loop = () => {
            const tr = track.getBoundingClientRect();
            const mr = marker.getBoundingClientRect();
            const pct = Math.min(100, Math.max(0, ((mr.left - tr.left) / tr.width) * 100));
            label.textContent = pct.toFixed(2);
            const bucket = Math.floor(pct / 2.5);
            if (!useFile && bucket !== lastTick) { lastTick = bucket; if (typeof playTick === 'function') playTick(); }
            if (performance.now() - t0 < DURATION + 80) requestAnimationFrame(loop);
            else {
                label.textContent = roll.toFixed(2);
                if (sldSound && useFile) { try { sldSound.pause(); } catch (_) { /* ok */ } }
                resolve();
            }
        };
        requestAnimationFrame(loop);
    });
}

async function startSlider() {
    if (sldBusy) return;
    const { sel } = sldBet();
    if (sel.length === 0) return;

    sldSetBusy(true);
    const chance = sldChance;
    let data;
    try {
        const res = await fetch('/api/slider/play', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ itemIds: sldSelected, chance })
        });
        data = await res.json();
        if (!res.ok || data.error) {
            showToast(data.error || 'Could not start the Slider.', 'error', 'Slider');
            sldSetBusy(false);
            return;
        }
    } catch (e) {
        showToast('Connection error. Try again.', 'error', 'Slider');
        sldSetBusy(false);
        return;
    }

    await sldAnimateMarker(data.roll);

    const track = sldEl('sld-track');
    const marker = sldEl('sld-marker');
    marker.classList.add(data.win ? 'win' : 'lose');
    track.classList.add(data.win ? 'res-win' : 'res-lose');
    await new Promise((r) => setTimeout(r, SLD_RESULT_MS));

    // o servidor já atualizou o inventário
    if (currentUser && Array.isArray(data.inventory)) currentUser.inventory = data.inventory;
    sldSelected = [];
    sldSetBusy(false);
    sldRenderInventory();
    sldShowResult(data);
    if (typeof loadInventory === 'function') loadInventory().then(() => sldRenderInventory()).catch(() => {});
    setTimeout(() => marker.classList.remove('show', 'win', 'lose'), 600);
}

function sldShowResult(data) {
    const modal = sldEl('sld-result-modal');
    const card = sldEl('sld-result-card');
    if (!modal || !card) return;
    const itemBox = sldEl('sld-result-item-box');
    sldEl('sld-result-mult').textContent = data.win ? `${Number(data.multiplier).toFixed(2)}x` : '0.00x';
    sldEl('sld-result-roll').textContent = Number(data.roll).toFixed(2);

    if (data.win && data.skin) {
        card.className = 'result-card result-win';
        sldEl('sld-result-title').textContent = 'You won';
        if (itemBox) itemBox.style.display = '';
        sldEl('sld-result-img').src = data.skin.img;
        sldEl('sld-result-name').textContent = data.skin.name;
        sldEl('sld-result-price').textContent = `$${formatCurrency(data.skin.value)}`;
        const cond = data.skin.conditionShort || '';
        const badge = sldEl('sld-result-badge');
        badge.textContent = cond;
        badge.className = 'badge cond-' + cond;
        if (typeof upgradeWinSound !== 'undefined') upgradeWinSound.play().catch(() => {});
    } else {
        card.className = 'result-card result-loss';
        sldEl('sld-result-title').textContent = 'You lost';
        if (itemBox) itemBox.style.display = 'none';
        sldEl('sld-result-name').textContent = 'Better luck next time.';
        sldEl('sld-result-price').textContent = '';
        if (typeof upgradeLossSound !== 'undefined') upgradeLossSound.play().catch(() => {});
    }
    modal.classList.remove('closing');
    modal.style.display = 'flex';
}