const socket = io();
let currentUser = null;
let activeCaseId = 'gold';
const NODE_WIDTH = 170;
let bdSortMode = 'newest';
let bdPage = 0;
const winSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3');
winSound.volume = 0.25; // Set volume to 50%
const spinSound = new Audio('/assets/spinner.mp3');
const landSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3');
const superLandSound = new Audio('/assets/super_spin_land.mp3');
superLandSound.volume = 0.5;
function playSuperLand() {
    const fallback = () => { landSound.currentTime = 0; landSound.play().catch(() => {}); };
    superLandSound.currentTime = 0;
    const p = superLandSound.play();
    if (p && p.catch) p.catch(fallback);
}
const upgradeStartSound = new Audio('/assets/upgrade.mp3');
const upgradeWinSound = new Audio('/assets/upgrade_win.mp3');
const upgradeLossSound = new Audio('/assets/upgrade_lose.mp3');
const tickSoundsPool = Array.from({ length: 10 }, () => {
    const audio = new Audio('/assets/spinner.mp3');
    audio.volume = 0.5; // Volume um pouco mais baixo para a "metralhadora" não ser estridente
    return audio;
});
let bdLastSkinId = null;
let bdLastUpdateTime = 0;
let allSkinsForPreview = [];
let selectedBeatDropSkins = [];
let targetDropTime = 50;
let bdAudio = new Audio();
let bdAnimationActive = false;
let currentBetValue = 0;
upgradeLossSound.volume = 0.3;
upgradeWinSound.volume = 0.3;
upgradeStartSound.volume = 0.3;
spinSound.volume = 0.5;
landSound.volume = 0.3;

// Som de vitória da batalha — coloca o teu ficheiro em /assets/battle_win.mp3 (ou muda o caminho aqui)
const battleWinSound = new Audio('/assets/battle_win.mp3');
battleWinSound.preload = 'auto';
battleWinSound.volume = 0.4;
function playBattleWinSound() {
    try {
        battleWinSound.currentTime = 0;
        battleWinSound.play().catch(() => {});
    } catch (e) {}
}
let tickCounter = 0;
let lastTickIndex = -1; // Variável global (fora da função) para evitar repetições
let crashPageInv = 0;
let crashSortMode = 'newest';
// No topo do main.js
let itemsData = {}; 
let cases = {}; 
function playTick() {
    // Escolhe o próximo som da lista de forma circular (0, 1, 2... 9, 0...)
    const sound = tickSoundsPool[tickCounter % tickSoundsPool.length];
    sound.currentTime = 0;
    sound.play().catch(e => {});
    tickCounter++;
}
let currentCrashState = null;
let selectedCasesForBattle = [];
let upgraderState = {
    allSkins: [],
    selectedInputs: [], // DEVE ser um array vazio
    selectedTarget: null
};
let selectedCrashSkins = [];
let isUpgrading = false;
const WEAPON_TEAMS = {
    // Terroristas (TR) Only
    4: 'tr',   // Glock-18
    7: 'tr',   // AK-47
    11: 'tr',  // G3SG1
    13: 'tr',  // Galil AR
    17: 'tr',  // Mac-10
    29: 'tr',  // Sawed-Off
    30: 'tr',  // Tec-9
    39: 'tr',  // SG 553

    // Counter-Terrorists (CT) Only
    3: 'ct',   // Five-SeveN
    8: 'ct',   // AUG
    10: 'ct',  // FAMAS
    16: 'ct',  // M4A4
    27: 'ct',  // Mag-7
    32: 'ct',  // P2000
    34: 'ct',  // MP9
    38: 'ct',  // Scar-20
    60: 'ct',  // M4A1-S
    61: 'ct',  // USP-S
};
function updateBDCentralSkin(potentialValue) {
    const now = Date.now();
    // Só atualiza se passar 1000ms (1 segundo)
    if (now - bdLastUpdateTime < 1000) return;

    const skin = getClosestSkinLocal(potentialValue);
    const skinKey = skin ? skin.name + '|' + (skin.conditionShort || '') : null;
    if (!skin || skinKey === bdLastSkinId) return;

    const container = document.getElementById('bd-preview-container');
    const img = document.getElementById('bd-preview-img');
    const name = document.getElementById('bd-preview-name');
    const price = document.getElementById('bd-preview-price');

    // 1. Inicia animação de saída
    container.classList.add('skin-changing');

    setTimeout(() => {
        // 2. Troca os dados
        img.src = skin.img;
        const pp = bdParseSkin(skin.name);
        name.innerHTML = `<small>${bdEsc(pp.finish ? pp.weapon : '\u00A0')}</small><span>${bdEsc(pp.finish || pp.weapon)}</span>`;
        name.title = skin.name;
        price.innerText = `$${formatCurrency(skin.price)}`;
        container.style.setProperty('--rc', skin.color || '#4b69ff');
        bdLastSkinId = skinKey;
        bdLastUpdateTime = now;

        // 3. Finaliza animação (Fade In)
        container.classList.remove('skin-changing');
    }, 250); // Metade do tempo da transição CSS
}

function getWeaponTeamType(weaponId) {
    const id = parseInt(weaponId); // Força ser um número inteiro
    console.log("Checking weaponId:", id); // Veja isto no F12 do navegador

    if (id >= 500) return 'both'; // Facas
    
    // Se o ID estiver na lista de TR, retorna 'tr'
    if (WEAPON_TEAMS[id]) {
        return WEAPON_TEAMS[id];
    }

    // Se não estiver na lista (ex: AWP, Deagle, P250, Scouts), é para ambos
    return 'both'; 
}
let upgraderInv = [];
let upgraderPageInv = 0;
let upgraderPageTargets = 0;
const UP_PAGE_SIZE = 9; // 3x3 Grid
function renderTargets() {
    const search = document.getElementById('target-search').value.toLowerCase();
    // Filtra pela pesquisa
    let filtered = upgraderState.allSkins.filter(s => s.name.toLowerCase().includes(search));
    
    const grid = document.getElementById('upgrade-target-grid');
    const start = upgraderPageTargets * UP_PAGE_SIZE;
    const pageItems = filtered.slice(start, start + UP_PAGE_SIZE);
    
    const totalInputValue = getTotalSelectedValue();

    grid.innerHTML = pageItems.map(item => {
        const isTooCheap = totalInputValue > 0 && item.price <= totalInputValue;
        const isSelected = upgraderState.selectedTarget && 
                           upgraderState.selectedTarget.name === item.name && 
                           upgraderState.selectedTarget.displayCond === item.displayCond;

        return `
            <div class="up-card ${isSelected ? 'selected' : ''} ${isTooCheap ? 'disabled-target' : ''}" 
                 onclick="selectUpTarget(this, ${JSON.stringify(item).replace(/"/g, '&quot;')})">
                <div class="badge cond-${item.displayCond}">${item.displayCond}</div>
                <img src="${item.img}">
                <b>${item.name}</b>
                <span>$${formatCurrency(item.price)}</span>
            </div>
        `;
    }).join('');

    renderPagination('target-pagination', filtered.length, upgraderPageTargets, (p) => {
        upgraderPageTargets = p;
        renderTargets();
    });
}
function initBeatDrop() {
    if (typeof bdPreviewFromCatalog !== 'undefined' && !bdPreviewFromCatalog) loadSkinsForPreview(); // catálogo ainda não estava pronto
    resetBDUI();
    renderBeatDropInventory();
    generateWaveform();
    renderBDSlot();
    
    const wrapper = document.getElementById('bd-wrapper');
    const targetEl = document.getElementById('bd-target');
    const profitZone = document.getElementById('bd-profit-zone');

    if (wrapper) {
        wrapper.onclick = (e) => {
            if (bdAnimationActive) return;

            // só aceita cliques dentro do retângulo da waveform
            const layer = document.getElementById('bd-background-layer') || wrapper;
            const rect = layer.getBoundingClientRect();
            if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) return;
            targetDropTime = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));

            // Ambos usam o mesmo valor de 'left'
            if (targetEl) targetEl.style.left = targetDropTime + '%';
            if (profitZone) {
                profitZone.style.display = 'block';
                profitZone.style.left = targetDropTime + '%';
            }

            updateBDPreviewMultiplier(targetDropTime, targetDropTime);
            updateBDStats();
        };
    }
    setupBDFit();
}

function setupBDFit() {
    const tab = document.getElementById('beat-drop-tab');
    const box = document.getElementById('sgy');
    const main = document.querySelector('.main-content');
    if (!tab || !box || !main || tab.dataset.fitReady) return;
    tab.dataset.fitReady = '1';
    const fit = () => {
        const visible = tab.style.display !== 'none' && tab.offsetParent !== null;
        if (!visible) { main.style.removeProperty('overflow-y'); return; }
        main.style.setProperty('overflow-y', 'hidden', 'important');
        if (window.innerWidth <= 1000) { box.style.removeProperty('height'); return; }
        const cs = getComputedStyle(main);
        const h = main.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
        box.style.height = Math.max(420, h) + 'px';
    };
    new MutationObserver(() => requestAnimationFrame(fit)).observe(tab, { attributes: true, attributeFilter: ['style', 'class'] });
    window.addEventListener('resize', fit);
    fit();
}

function renderBDSlot() {
    const el = document.getElementById('bd-in-box');
    if (!el) return;
    const inv = (currentUser && currentUser.inventory) || [];
    const items = inv.filter((it) => selectedBeatDropSkins.includes(it.id));
    const total = items.reduce((sum, it) => sum + (Number(it.value) || 0), 0);
    el.innerHTML = items.length
        ? `<span class="ugx-slot-label">You put in</span>
           <div class="ugx-stack">${items.map((i) => `<img src="${bdEsc(i.img || i.image)}" alt="">`).join('')}</div>
           <div class="ugx-slot-main gold">$${formatCurrency(total)}</div>
           <div class="ugx-slot-sub">${items.length} ${items.length === 1 ? 'skin' : 'skins'}</div>`
        : `<span class="ugx-slot-label">You put in</span><div class="ugx-slot-hint">Pick up to 5 skins from your inventory</div>`;
}

async function startBeatDropGame() {
    if (selectedBeatDropSkins.length === 0) return;
    if (bdAnimationActive) return;

    const res = await fetch('/api/beatdrop/random-song');
    const songData = await res.json();
    
    bdAudio.src = songData.song;
    bdAudio.volume = 0.2; // VOLUME BAIXO
    bdAudio.load();

    socket.emit('startBeatDrop', {
        userId: currentUser._id,
        itemIds: selectedBeatDropSkins,
        targetTime: targetDropTime
    });
}

// Skins que aparecem no multiplicador do Songy: o catálogo COMPLETO (igual ao prémio do servidor).
// Se o catálogo ainda não estiver pronto, usa as skins das caixas e tenta outra vez ao abrir o Songy.
let bdPreviewFromCatalog = false;
async function loadSkinsForPreview() {
    try {
        const r = await fetch('/api/upgrader-skins');
        if (r.ok) {
            const raw = await r.json();
            const list = (Array.isArray(raw) ? raw : [])
                .filter(e => e && e.name && e.img && Number(e.price) > 0)
                .map(e => ({ name: e.name, img: e.img, color: e.color, price: Number(e.price), conditionShort: e.displayCond || e.conditionShort || '' }));
            if (list.length) { allSkinsForPreview = list; bdPreviewFromCatalog = true; return; }
        }
    } catch (e) { /* cai para as skins das caixas */ }
    try {
        const res = await fetch('/api/all-skins');
        allSkinsForPreview = await res.json();
    } catch (e) { /* mantém o que já havia */ }
}
loadSkinsForPreview();

function getClosestSkinLocal(value) {
    if (allSkinsForPreview.length === 0) return null;
    return allSkinsForPreview.reduce((prev, curr) => {
        return (Math.abs(curr.price - value) < Math.abs(prev.price - value) ? curr : prev);
    });
}
socket.on('beatDropAction', (data) => {
    bdAnimationActive = true;
    bdLastUpdateTime = 0;
    bdLastSkinId = null; // Garante que não há memória da skin anterior

    const playhead = document.getElementById('bd-playhead');
    const container = document.getElementById('bd-preview-container');
    const btn = document.getElementById('bd-start-btn');
    
    if (btn) btn.disabled = true;
    
    // Reset da barra branca
    if (playhead) {
        playhead.style.display = 'block';
        playhead.style.left = '0%';
    }

    // IMPORTANTE: O container da skin (bd-preview-container) continua com OPACIDADE 0 aqui
    
    bdAudio.volume = 0.2;
    bdAudio.currentTime = 0;
    bdAudio.play().then(() => {
        requestAnimationFrame(updateFrame);
    });

    const updateFrame = () => {
    if (!bdAnimationActive) return;

    const playhead = document.getElementById('bd-playhead');
    const playheadMult = document.getElementById('bd-playhead-mult');
    const placeholder = document.getElementById('bd-preview-placeholder');
    const skinInfo = document.getElementById('bd-preview-container');

    // 1. Segurança e Limite de 60 segundos
    if (!playhead || !bdAudio.duration) { 
        requestAnimationFrame(updateFrame); 
        return; 
    }

    // Definimos que o "fim da linha" é a duração da música OU 60 segundos (o que for menor)
    const gameDuration = Math.min(bdAudio.duration, 60);

    // 2. Calcula a posição baseada no limite de 1 minuto
    let currentPos = (bdAudio.currentTime / gameDuration) * 100;
    
    // Garante que a barra não ultrapassa os 100% visualmente
    if (currentPos > 100) currentPos = 100;
    
    if (playhead) playhead.style.left = currentPos + '%';

    // 3. Multiplicador Suave
    let liveMult = calcBDMultiplier(currentPos, data.targetTime);

    if (playheadMult) {
        playheadMult.innerText = liveMult.toFixed(2) + 'x';
        playheadMult.style.background = liveMult > 1.1 ? 'var(--accent)' : '#fff';
    }
    

    // 4. Alternância entre Radar e Skin
    if (liveMult > 1.1) {
        if (placeholder) placeholder.style.display = "none";
        if (skinInfo) { skinInfo.style.display = "block"; skinInfo.style.opacity = "1"; }
        bdToggleSlot(false);
        updateBDCentralSkin(data.totalValue * liveMult);
    } else {
        if (skinInfo) skinInfo.style.display = "none";
        if (placeholder) { placeholder.style.display = "block"; placeholder.style.opacity = "0.5"; }
        bdToggleSlot(true);
    }

    // 5. Lógica de Derrota Antecipada (Passou do Alvo)
    if (currentPos > data.targetTime + 10) {
        bdAnimationActive = false;
        bdAudio.pause();
        showBDResultModal(false);
        return;
    }

    // 6. Paragem do Servidor OU Limite de 60s atingido
    if (currentPos >= data.stopPoint || bdAudio.currentTime >= gameDuration) {
    bdAnimationActive = false;
    bdAudio.pause();
    
    // Sincroniza o multiplicador visual com o valor final real
    if (playheadMult) playheadMult.innerText = data.finalMultiplier.toFixed(2) + 'x';

    socket.emit('claimBeatDrop', {
        userId: currentUser._id,
        initialValue: data.totalValue,
        multiplier: data.finalMultiplier
    });
} else {
    requestAnimationFrame(updateFrame);
}
};
});
function showBDResultModal(win, skin = null, mult = 0) {
    const modal = document.getElementById('bd-result-modal');
    const card = document.getElementById('bd-result-card');
    const itemBox = document.getElementById('bd-result-item-box');
    const titleEl = document.getElementById('bd-result-title');
    const multEl = document.getElementById('bd-result-mult-badge');
    const nameEl = document.getElementById('bd-result-name');
    const priceEl = document.getElementById('bd-result-price');

    // Limpa o estado do jogo no fundo
    resetBDUI();

    if (!modal || !card) return;

    if (win && skin) {
        // --- VITÓRIA ---
        card.className = 'result-card result-win';
        titleEl.innerText = 'Songy successful';
        multEl.innerText = `${Number(mult).toFixed(2)}x`;

        if (itemBox) itemBox.style.display = '';
        document.getElementById('bd-result-img').src = skin.img;
        nameEl.innerText = skin.name;
        priceEl.innerText = `$${formatCurrency(skin.value)}`;
        const cond = skin.conditionShort || '';
        const badge = document.getElementById('bd-result-badge');
        badge.innerText = cond;
        badge.className = 'badge cond-' + cond;

        if (upgradeWinSound) upgradeWinSound.play().catch(e => {});
    } else {
        // --- DERROTA ---
        card.className = 'result-card result-loss';
        titleEl.innerText = 'Songy failed';
        multEl.innerText = '0.00x';

        if (itemBox) itemBox.style.display = 'none';
        nameEl.innerText = 'Unlucky! Try again.';
        priceEl.innerText = '';

        if (upgradeLossSound) upgradeLossSound.play().catch(e => {});
    }

    modal.style.display = 'flex';
}
socket.on('beatDropResult', (data) => {
    if (data.win) showBDResultModal(true, data.skin, data.multiplier);
    else showBDResultModal(false);
});
function updateBDPreviewMultiplier(current, target) {
    const multEl = document.getElementById('bd-live-multiplier');
    if (!multEl) return;
    
    let dist = Math.abs(current - target);
    let previewMult = 0;
    if (dist < 1.5) previewMult = 15;
    else if (dist < 4) previewMult = 5;
    else if (dist < 8) previewMult = 2;
    else if (dist < 15) previewMult = 1.2;
    
    multEl.innerText = previewMult > 0 ? previewMult.toFixed(2) + 'x' : '0.00x';
}
// esconde o "You put in" enquanto as skins do multiplicador aparecem
function bdToggleSlot(show) {
    const w = document.querySelector('.sgy-slot-wrap');
    if (w) w.classList.toggle('hide', !show);
}
function resetBDUI() {
    bdAnimationActive = false;
    bdLastSkinId = null;
    bdLastUpdateTime = 0;

    const btn = document.getElementById('bd-start-btn');
    const placeholder = document.getElementById('bd-preview-placeholder');
    const skinContainer = document.getElementById('bd-preview-container');
    const playhead = document.getElementById('bd-playhead');
    const playheadMult = document.getElementById('bd-playhead-mult');

    // 1. Reativa o botão
    if (btn) {
        btn.disabled = false;
        btn.querySelector('span').innerText = "START DROP";
    }
    
    // 2. MOSTRA o Placeholder (Radar) e ESCONDE a Skin
    if (placeholder) {
        placeholder.style.display = "block";
        placeholder.style.opacity = "0.5";
    }
    if (skinContainer) {
        skinContainer.style.display = "none";
        skinContainer.style.opacity = "0";
    }
    bdToggleSlot(true);

    // 3. Reseta a barra branca e o multiplicador
    if (playhead) playhead.style.display = "none";
    if (playheadMult) {
        playheadMult.innerText = "1.00x";
        playheadMult.style.background = "#fff";
    }

    // 4. Limpa as seleções
    selectedBeatDropSkins = [];
    const countEl = document.getElementById('bd-count');
    if (countEl) countEl.innerText = "0/5";
    
    renderBeatDropInventory();
}
function generateWaveform() {
    const canvas = document.getElementById('waveform-canvas');
    canvas.innerHTML = '';
    for(let i=0; i<80; i++) {
        const bar = document.createElement('div');
        bar.className = 'wave-bar';
        bar.style.height = (Math.random() * 70 + 10) + '%';
        bar.style.opacity = Math.random() * 0.5 + 0.2;
        canvas.appendChild(bar);
    }
}

function placeBeatDropBet() {
    if (selectedBeatDropSkins.length === 0) return alert("Select skins!");
    socket.emit('beatDropBet', {
        userId: currentUser._id,
        itemIds: selectedBeatDropSkins,
        targetTime: targetDropTime
    });
}
function selectCrashOption(val, text) {
    document.getElementById('selected-crash-inv').innerText = text;
    document.getElementById('crash-inv-options').classList.remove('show');
    crashSortMode = val;
    crashPageInv = 0;
    renderCrashInventory();
}

function getWeaponCategory(weaponId) {
    const id = parseInt(weaponId);

    // MELEE • KNIFES (IDs de facas costumam ser 500-526)
    if (id >= 500 && id <= 999) return "MELEE • KNIFE";

    // GLOVES
    if ((id >= 5027 && id <= 5035) || id === 4725) return "EQUIPMENT • GLOVES";

    // PISTOLS
    // 1: Deagle, 2: Berettas, 3: Five-SeveN, 4: Glock, 30: Tec-9, 32: P2000, 36: P250, 61: USP-S, 63: CZ75, 64: R8
    if ([1, 2, 3, 4, 30, 32, 36, 61, 63, 64].includes(id)) return "PISTOLS";

    // HEAVY • SHOTGUNS
    // 25: XM1014, 27: MAG-7, 29: Sawed-Off, 35: Nova
    if ([25, 27, 29, 35].includes(id)) return "HEAVY • SHOTGUN";

    // HEAVY • MACHINE GUNS
    // 14: M249, 28: Negev
    if ([14, 28].includes(id)) return "HEAVY • MACHINE GUN";

    // SMGs
    // 17: MAC-10, 19: P90, 23: MP5-SD, 24: UMP-45, 26: Bizon, 33: MP7, 34: MP9
    if ([17, 19, 23, 24, 26, 33, 34].includes(id)) return "SMGs";

    // RIFLES • ASSAULT RIFLES
    // 7: AK-47, 8: AUG, 10: FAMAS, 13: Galil, 16: M4A4, 39: SG 553, 60: M4A1-S
    if ([7, 8, 10, 13, 16, 39, 60].includes(id)) return "RIFLES • ASSAULT RIFLE";

    // RIFLES • SNIPER RIFLES
    // 9: AWP, 11: G3SG1, 38: SCAR-20, 40: SSG 08
    if ([9, 11, 38, 40].includes(id)) return "RIFLES • SNIPER RIFLE";

    return "OTHER";
}
// Nome e valor de uma skin do inventário (para as notificações), lido antes de o inventário recarregar
function skinToastInfo(itemId) {
    const inv = (currentUser && currentUser.inventory) || [];
    const it = inv.find(i => String(i.id) === String(itemId));
    return it ? { name: String(it.name || 'Skin'), value: Number(it.value) || 0 } : null;
}

async function toggleItemLock(itemId) {
    const info = skinToastInfo(itemId);
    const res = await fetch('/api/toggle-lock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId })
    });
    const data = await res.json();
    if (data.success) {
        const name = info ? info.name : 'Your skin';
        if (data.isLocked) {
            showToast(name + ' is now protected from Sell all.', 'success', 'Skin locked');
        } else {
            showToast(name + ' can be sold with Sell all again.', 'info', 'Skin unlocked');
        }
        closeSkinModal();
        loadInventory(); // Recarrega para mostrar o ícone de cadeado
    } else {
        showToast(data.error || 'Could not change the lock.', 'error');
    }
}
function openSkinModal(item) {
    const modal = document.getElementById('skin-action-modal');
    const container = document.getElementById('modal-actions-container');
    
    // Mapeamento de nomes completos
    const conditionNames = {
        "FN": "Factory New",
        "MW": "Minimal Wear",
        "FT": "Field-Tested",
        "WW": "Well-Worn",
        "BS": "Battle-Scarred"
    };

    document.documentElement.style.setProperty('--rarity-color', item.color);

    // Atualiza Imagem e Nomes
    document.getElementById('modal-skin-img').src = item.img;
    document.getElementById('modal-skin-name').innerText = item.name;
    
    // Condição Curta (Badge)
    const shortCond = item.conditionShort.toUpperCase();
    document.getElementById('modal-skin-cond').innerText = shortCond;
    
    // Condição Longa (Tooltip)
    document.getElementById('modal-full-cond').innerText = conditionNames[shortCond] || "Unknown";
    
    // Float (Wear) - Formata para 6 casas decimais como no CS2
    const floatVal = item.wear ? item.wear.toFixed(8) : "0.00000000";
    document.getElementById('modal-float-val').innerText = floatVal;
    document.getElementById('modal-seed-val').innerText = item.seed !== undefined ? item.seed : "0";

    document.getElementById('modal-skin-price').innerText = `$${formatCurrency(item.value)}`;
    
    const category = getWeaponCategory(item.weaponId);
    document.getElementById('modal-skin-type').innerText = category;

    // Gerar Botões (O resto do teu código de botões aqui...)
    let html = '';
    const teamType = getWeaponTeamType(item.weaponId);

    if (teamType === 'tr' || teamType === 'both') 
        html += `<button class="btn-action" onclick="executeSkinAction('${item.id}', 2)">EQUIP TERRORIST</button>`;
    
    if (teamType === 'ct' || teamType === 'both') 
        html += `<button class="btn-action" onclick="executeSkinAction('${item.id}', 3)">EQUIP COUNTER-TERRORIST</button>`;
    
    if (teamType === 'both') 
        html += `<button class="btn-action btn-full" onclick="executeSkinAction('${item.id}', 4)">EQUIP BOTH SIDES</button>`;

    if (item.equippedTeam > 0) {
        html += `<button class="btn-action btn-unequip-action btn-full" onclick="executeSkinAction('${item.id}', 0, 'unequip')">UNEQUIP FROM LOADOUT</button>`;
    }
html += `
    <button class="btn-action btn-full ${item.isLocked ? 'active-lock' : ''}" onclick="toggleItemLock('${item.id}')">
        ${item.isLocked ? 'UNLOCK ITEM' : 'LOCK ITEM'}
    </button>
`;
    html += `<button class="btn-action btn-sell-action btn-full" onclick="executeSellFromModal('${item.id}')">SELL SKIN FOR $${formatCurrency(item.value)}</button>`;

    container.innerHTML = html;
    modal.style.display = 'flex';
}
async function executeSkinAction(itemId, team, action = 'equip') {
    const res = await fetch('/api/equip-item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, team, action })
    });
    const data = await res.json();
    if (data.success) {
        closeSkinModal();
        loadInventory();
    }
}
async function executeSellFromModal(itemId) {
    // Usar a função de venda que já tens no main.js
    const info = skinToastInfo(itemId);
    const res = await fetch('/api/sell-item', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ itemId })
    });
    const data = await res.json();
    if(data.success) {
        updateBalanceUI(data.balance);
        showToast(info ? info.name + '  ·  +$' + formatCurrency(info.value) : 'Your skin was sold.', 'success', 'Skin sold');
        closeSkinModal();
        loadInventory();
    } else {
        showToast(data.error || 'Could not sell this skin.', 'error');
    }
}
function closeSkinModal() {
    closeModalWithAnim('skin-action-modal');
}

function renderInventory() {
    const grid = document.getElementById('upgrade-inv-grid');
    
    // --- ATUALIZAÇÃO AQUI ---
    const sortVal = filters.upInvSort; 
    
    let displayInv = [...upgraderInv];

    if (sortVal === 'high') {
        displayInv.sort((a, b) => b.value - a.value);
    } else if (sortVal === 'low') {
        displayInv.sort((a, b) => a.value - b.value);
    }

    const start = upgraderPageInv * UP_PAGE_SIZE;
    const pageItems = displayInv.slice(start, start + UP_PAGE_SIZE);
    
    document.getElementById('upgrade-count').innerText = `${upgraderState.selectedInputs.length}/5`;

    grid.innerHTML = pageItems.map(item => {
    const isSelected = upgraderState.selectedInputs.some(i => i.id === item.id);
    return `
        <div class="up-card ${isSelected ? 'selected' : ''}" onclick="selectUpInput(this, ${JSON.stringify(item).replace(/"/g, '&quot;')})">
            <!-- UPDATED LINE BELOW: Added cond-${item.conditionShort} -->
            <div class="badge cond-${item.conditionShort}">${item.conditionShort}</div>
            <img src="${item.img}">
            <b>${item.name}</b>
            <span>$${formatCurrency(item.value)}</span>
        </div>
    `;
}).join('');
    renderPagination('inv-pagination', displayInv.length, upgraderPageInv, (p) => {
        upgraderPageInv = p;
        renderInventory();
    });
}
const getTotalSelectedValue = () => {
    return upgraderState.selectedInputs.reduce((sum, item) => sum + item.value, 0);
};
async function initUpgrader() {
    // 1. Carrega as skins do sistema apenas UMA vez
    if (upgraderState.allSkins.length === 0) {
        const res = await fetch('/api/upgrader-skins');
        let rawSkins = await res.json();
        upgraderState.allSkins = rawSkins.sort((a,b) => a.price - b.price);
    }
    
    // 2. Chama a função de atualizar o inventário (que criamos abaixo)
    await refreshUpgraderInventory();
    
    renderTargets();
}
async function refreshUpgraderInventory() {
    const invRes = await fetch('/api/me');
    const invData = await invRes.json();
    upgraderInv = invData.user.inventory || [];
    renderInventory();
}
function renderPagination(id, totalItems, current, callback) {
    const totalPages = Math.ceil(totalItems / UP_PAGE_SIZE);
    const container = document.getElementById(id);
    if (totalPages <= 1) { container.innerHTML = ''; return; }

    let html = '';
    // Show max 5 page buttons
    let start = Math.max(0, current - 2);
    let end = Math.min(totalPages, start + 5);
    
    for (let i = start; i < end; i++) {
        html += `<button class="${i === current ? 'active' : ''}" onclick="window.upEvent(${i}, ${id === 'inv-pagination' ? 1 : 0})">${i + 1}</button>`;
    }
    container.innerHTML = html;
    
    // Global helper for pagination clicks
    window.upEvent = (page, isInv) => {
        if (isInv) { upgraderPageInv = page; renderInventory(); }
        else { upgraderPageTargets = page; renderTargets(); }
    };
}

let filters = {
    invPrice: 'newest',
    invRarity: 'all',
    battleSort: 'default',
    upInvSort: 'newest'
};


function toggleDropdown(id) {
    const options = document.getElementById(id);
    const selected = options.previousElementSibling; // Pega a div dropdown-selected

    // Fecha outros dropdowns abertos
    document.querySelectorAll('.dropdown-options').forEach(el => {
        if (el.id !== id) el.classList.remove('show');
    });
    document.querySelectorAll('.dropdown-selected').forEach(el => {
        if (el !== selected) el.classList.remove('active');
    });

    // Toggle no atual
    options.classList.toggle('show');
    selected.classList.toggle('active');
}

function selectOption(type, val, text) {
    // Atualiza o texto visual
    document.getElementById(`selected-${type}`).innerText = text;
    
    // Fecha o menu
    document.getElementById(`${type}-options`).classList.remove('show');
    document.getElementById(`${type}-options`).previousElementSibling.classList.remove('active');

    // Lógica específica para cada dropdown
    if (type === 'inv-price') {
        filters.invPrice = val;
        loadInventory();
    } else if (type === 'inv-rarity') {
        filters.invRarity = val;
        loadInventory();
    } else if (type === 'battle-sort') {
        filters.battleSort = val;
        renderAvailableCasesForBattle();
    } else if (type === 'up-inv') {
        filters.upInvSort = val;
        upgraderPageInv = 0;
        renderInventory();
    }
}

// Fechar o dropdown se clicar fora dele
window.addEventListener('click', function(e) {
    const sortContainer = document.getElementById('inv-sort-container');
    
    // VERIFICAÇÃO DE SEGURANÇA: Só executa se o container existir na página atual
    if (sortContainer) {
        const sortOptions = document.getElementById('inv-sort-options');
        if (!sortContainer.contains(e.target)) {
            if (sortOptions) sortOptions.classList.add('select-hide');
            sortContainer.querySelector('.dropdown-selected')?.classList.remove('select-arrow-active');
        }
    }
});
function jumpToMult(m) {
    if (isUpgrading) return;
    const totalVal = getTotalSelectedValue();
    
    if (totalVal === 0) {
        return alert("Select at least one item from your inventory first!");
    }
    
    const targetVal = totalVal * m;
    
    // Encontra o índice na lista global baseada no valor total somado
    const index = upgraderState.allSkins.findIndex(s => s.price >= targetVal);
    
    if (index !== -1) {
        upgraderPageTargets = Math.floor(index / UP_PAGE_SIZE);
        document.getElementById('target-search').value = "";
        
        // Auto-seleciona o primeiro item que atende ao multiplicador
        upgraderState.selectedTarget = upgraderState.allSkins[index];
        
        renderTargets();
        calcUpgradeChance();
    }
}
function selectUpInput(el, item) {
    if (isUpgrading) return;
    const index = upgraderState.selectedInputs.findIndex(i => i.id === item.id);
    
    if (index > -1) {
        // Se já estiver selecionado, remove
        upgraderState.selectedInputs.splice(index, 1);
    } else {
        // Se não estiver, adiciona se houver espaço
        if (upgraderState.selectedInputs.length < 5) {
            upgraderState.selectedInputs.push(item);
        } else {
            // Feedback visual opcional: alert("Max 5 items!")
            return;
        }
    }
    
    // Resetar alvo se o valor total agora for maior que o alvo
    const totalInputVal = upgraderState.selectedInputs.reduce((sum, i) => sum + i.value, 0);
    if (upgraderState.selectedTarget && upgraderState.selectedTarget.price <= totalInputVal) {
        upgraderState.selectedTarget = null;
    }

    renderInventory();
    renderTargets();
    calcUpgradeChance();
}

function selectUpTarget(el, item) {
    if (isUpgrading) return;
    const totalInputValue = getTotalSelectedValue();

    // 1. Impede seleção se for mais barato que o total selecionado
    if (totalInputValue > 0 && item.price <= totalInputValue) return;

    // 2. Toggle selection
    if (upgraderState.selectedTarget && 
        upgraderState.selectedTarget.name === item.name && 
        upgraderState.selectedTarget.displayCond === item.displayCond) {
        upgraderState.selectedTarget = null;
    } else {
        upgraderState.selectedTarget = item;
    }
    
    renderTargets();
    calcUpgradeChance();
}


function calcUpgradeChance() {
    const slice = document.getElementById('win-slice');
    const display = document.getElementById('chance-display');
    const btn = document.getElementById('btn-do-upgrade');

    if (upgraderState.selectedInputs.length === 0 || !upgraderState.selectedTarget) {
        slice.style.strokeDasharray = `0 283`;
        display.innerText = "0.00%";
        btn.disabled = true;
        return;
    }
    
    const totalInputVal = upgraderState.selectedInputs.reduce((sum, i) => sum + i.value, 0);
    const targetVal = upgraderState.selectedTarget.price;
    
    let chance = (totalInputVal / targetVal) * 95;
    if (chance > 95) chance = 95;

    const dash = (chance / 100) * 282.74;
    slice.style.strokeDasharray = `${dash} 282.74`;
    display.innerText = chance.toFixed(2) + "%";
    btn.disabled = false;
}

function filterByMult(m) {
    if (!upgraderState.selectedInput) return alert("Select an item from your inventory first!");
    const targetPrice = upgraderState.selectedInput.value * m;
    
    // Find skins that are +/- 20% of the target price
    const filtered = upgraderState.allSkins.filter(s => 
        s.price >= targetPrice * 0.8 && s.price <= targetPrice * 1.2
    ).sort((a,b) => a.price - b.price);

    renderTargets(filtered);
}
let currentBeatDropState = null;


// ---------- Songy: inventário (mesmo visual do upgrader / inventário) ----------
let bdSearch = '';
let bdRenderLimit = 48;
let bdBound = false;
let bdSearchTimer = null;
const BD_BATCH = 48;
const bdEsc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const bdHasNum = (v) => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v));

function bdParseSkin(name) {
    const n = String(name || '');
    const st = /stattrak/i.test(n), sv = /souvenir/i.test(n);
    const base = n.replace(/stattrak™?\s*/ig, '').replace(/souvenir\s*/ig, '').replace(/\s{2,}/g, ' ').trim();
    const i = base.indexOf(' | ');
    return { st, sv, base, weapon: i > 0 ? base.slice(0, i) : base, finish: i > 0 ? base.slice(i + 3) : '' };
}

// "ak  >50  <200  10-100" -> texto + limites de preço
function bdParseQ(q) {
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

function bdCardHTML(it) {
    const p = bdParseSkin(it.name);
    const cond = it.conditionShort || '';
    const tag = p.st ? '<span class="ugx-tag st">StatTrak™</span>' : p.sv ? '<span class="ugx-tag sv">Souvenir</span>' : '';
    const parts = [];
    if (bdHasNum(it.wear)) parts.push(`<span title="Float">${Number(it.wear).toFixed(5)}</span>`);
    if (bdHasNum(it.seed)) parts.push(`<span class="seed" title="Pattern">#${Number(it.seed)}</span>`);
    const picked = selectedBeatDropSkins.includes(it.id);
    return `<div class="ugx-card sgy-card${picked ? ' sel' : ''}" data-id="${bdEsc(it.id)}" role="button" tabindex="0" aria-pressed="${picked}" aria-label="${bdEsc(p.base)}" style="--rc:${bdEsc(it.color || '#4b69ff')}" onclick="toggleBeatDropSkin(this.dataset.id)" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();toggleBeatDropSkin(this.dataset.id);}">
        <div class="ugx-card-top"><span class="ugx-wear ${bdEsc(cond)}">${bdEsc(cond)}</span>${tag}</div>
        <img src="${bdEsc(it.img)}" alt="" loading="lazy" decoding="async">
        <div class="ugx-weapon">${bdEsc(p.finish ? p.weapon : '\u00A0')}</div>
        <div class="ugx-finish" title="${bdEsc(p.base)}">${bdEsc(p.finish || p.weapon)}</div>
        <div class="ugx-price">$${formatCurrency(Number(it.value) || 0)}</div>
        <div class="ugx-meta">${parts.join('')}</div>
    </div>`;
}

function bdVisibleItems() {
    let items = [...((currentUser && currentUser.inventory) || [])].filter((it) => !it.isLocked).reverse(); // mais recentes primeiro, sem skins locked
    const q = bdParseQ(bdSearch);
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
    if (bdSortMode === 'high') items.sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0));
    else if (bdSortMode === 'low') items.sort((a, b) => (Number(a.value) || 0) - (Number(b.value) || 0));
    else if (bdSortMode === 'float') items.sort((a, b) => (bdHasNum(a.wear) ? Number(a.wear) : Infinity) - (bdHasNum(b.wear) ? Number(b.wear) : Infinity));
    return items;
}

// animação de "a atualizar" (igual ao upgrader)
function bdRefreshAnim(grid) {
    const now = performance.now();
    if (grid._an && now - grid._an < 350) return;
    grid._an = now;
    grid.classList.remove('ugx-refresh');
    void grid.offsetWidth;
    grid.classList.add('ugx-refresh');
    clearTimeout(grid._at);
    grid._at = setTimeout(() => grid.classList.remove('ugx-refresh'), 950);
}

// dropdowns de vidro (iguais ao upgrader): o <select> fica escondido e em sincronia
function bdEnhanceSelects(rootId = 'sgy') {
    const root = document.getElementById(rootId);
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
            el.innerHTML = `<span>${bdEsc(o.textContent)}</span>`;
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
    document.addEventListener('pointerdown', (e) => { if (!e.target.closest || !e.target.closest('.ugx-dd')) closeAll(); });
}

function bdMore(grid) {
    const items = grid._bdItems || [];
    const have = grid.querySelectorAll('.sgy-card').length;
    if (have >= items.length) return;
    grid.insertAdjacentHTML('beforeend', items.slice(have, have + BD_BATCH).map(bdCardHTML).join(''));
    bdRenderLimit = Math.max(bdRenderLimit, have + BD_BATCH);
}

function bdBindInv(grid) {
    if (bdBound) return;
    bdBound = true;
    bdEnhanceSelects();
    grid.addEventListener('scroll', () => {
        if (grid.scrollTop + grid.clientHeight >= grid.scrollHeight - 300) bdMore(grid);
    }, { passive: true });
    const search = document.getElementById('bd-search');
    const sort = document.getElementById('bd-sort');
    if (search) search.addEventListener('input', () => {
        clearTimeout(bdSearchTimer);
        bdSearchTimer = setTimeout(() => {
            bdSearch = search.value;
            bdRenderLimit = BD_BATCH;
            grid.scrollTop = 0;
            renderBeatDropInventory();
        }, 150);
    });
    if (sort) sort.addEventListener('change', () => {
        bdSortMode = sort.value;
        bdRenderLimit = BD_BATCH;
        grid.scrollTop = 0;
        renderBeatDropInventory();
    });
}

function renderBeatDropInventory() {
    const grid = document.getElementById('bd-inv-grid');
    if (!grid || !currentUser) return;
    bdBindInv(grid);

    // tira da seleção skins que entretanto ficaram locked
    selectedBeatDropSkins = selectedBeatDropSkins.filter((id) => !((currentUser.inventory || []).find((i) => i.id === id) || {}).isLocked);
    const items = bdVisibleItems();
    grid._bdItems = items;
    const top = grid.scrollTop;
    bdRefreshAnim(grid);
    if (!items.length) {
        const all = (currentUser.inventory) || [];
        const total = all.length;
        const free = all.filter((i) => !i.isLocked).length;
        grid.innerHTML = total === 0
            ? '<div class="ugx-empty"><b>Your inventory is empty</b>Open a case to get your first skin.</div>'
            : free === 0
                ? '<div class="ugx-empty"><b>All your skins are locked</b>Unlock some to use them here.</div>'
                : '<div class="ugx-empty"><b>No skins found</b>Try another search.</div>';
    } else {
        grid.innerHTML = items.slice(0, bdRenderLimit).map(bdCardHTML).join('');
        grid.scrollTop = top;
    }
    updateBDStats();
}

// Contador, valor da aposta, alvo e estado do botão
function updateBDStats() {
    renderBDSlot();
    const inv = (currentUser && currentUser.inventory) || [];
    const sel = inv.filter((it) => selectedBeatDropSkins.includes(it.id));
    const total = sel.reduce((sum, it) => sum + (Number(it.value) || 0), 0);
    const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
    set('bd-count', `${selectedBeatDropSkins.length}/5`);
    set('bd-sel-count', selectedBeatDropSkins.length + (selectedBeatDropSkins.length === 1 ? ' skin' : ' skins'));
    set('bd-bet', '$' + formatCurrency(total));
    set('bd-target-val', Math.round(targetDropTime) + '%');
    const btn = document.getElementById('bd-start-btn');
    if (btn) btn.disabled = bdAnimationActive || selectedBeatDropSkins.length === 0;
}

function calcBDMultiplier(current, target) {
    const dist = Math.abs(current - target);
    const radius = 10;
    if (dist >= radius) return 1.00;
    return 1 + (14 * (1 - dist / radius)); // 1x a 20x
}
function toggleBeatDropSkin(id) {
    if (bdAnimationActive) return;
    const idx = selectedBeatDropSkins.indexOf(id);
    if (idx > -1) {
        selectedBeatDropSkins.splice(idx, 1);
    } else if (selectedBeatDropSkins.length < 5) {
        selectedBeatDropSkins.push(id);
    } else {
        showToast('You can pick up to 5 skins per drop.', 'warn', 'Limit reached');
    }

    const grid = document.getElementById('bd-inv-grid');
    if (grid) grid.querySelectorAll('.sgy-card').forEach((c) => {
        const on = selectedBeatDropSkins.includes(c.dataset.id);
        c.classList.toggle('sel', on);
        c.setAttribute('aria-pressed', on);
    });
    updateBDStats();
}
function showUpgradeResult(win, item) {
    const modal = document.getElementById('upgrade-modal');
    const card = document.getElementById('upgrade-result-card');
    const title = document.getElementById('result-title');
    const img = document.getElementById('result-img');
    const name = document.getElementById('result-name');
    const price = document.getElementById('result-price');
    const badge = document.getElementById('result-badge');

    modal.style.display = 'flex';
    
    // Use .price (targets) or .value (inventory) to avoid NaN
    const displayPrice = item.price || item.value || 0;
    // Use displayCond (targets) or conditionShort (inventory)
    const displayCond = item.displayCond || item.conditionShort || "FN";

    if (win) {
        card.className = 'result-card result-win';
        title.innerText = "UPGRADED";
        img.src = item.img;
        name.innerText = item.name;
        price.innerText = `$${formatCurrency(displayPrice)}`; // FIXES NaN
        badge.innerText = displayCond;
        badge.className = `badge cond-${displayCond}`;
    } else {
        card.className = 'result-card result-loss';
        title.innerText = "FAILED";
        img.src = item.img;
        name.innerText = item.name;
        price.innerText = `$${formatCurrency(displayPrice)}`; // FIXES NaN
        badge.innerText = displayCond;
        badge.className = `badge cond-${displayCond}`;
    }
}
function closeUpgradeModal() {
    closeModalWithAnim('upgrade-modal');
    initUpgrader();
}
async function startUpgrade() {
    if (upgraderState.selectedInputs.length === 0 || !upgraderState.selectedTarget) return;
isUpgrading = true;
    const btn = document.getElementById('btn-do-upgrade');
    btn.disabled = true;

    const wrapper = document.getElementById('upgrade-needle-wrapper');
    
    // 1. Reset IMEDIATO da agulha (sem animação)
    wrapper.style.transition = 'none';
    wrapper.style.transform = 'rotate(0deg)';

    try {
        const res = await fetch('/api/upgrade', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                inputItemIds: upgraderState.selectedInputs.map(i => i.id),
                targetSkinName: upgraderState.selectedTarget.name,
                targetPrice: upgraderState.selectedTarget.price,
                targetCondition: upgraderState.selectedTarget.displayCond 
            })
        });

        const data = await res.json();
        if (!data.success) throw new Error(data.error);

        // 2. Cálculo da rotação (7 voltas completas + a posição do roll)
        const randomSpins = 7 + Math.floor(Math.random() * 3);
        const finalDeg = (data.roll / 100) * 360;
        const totalRotation = (randomSpins * 360) + finalDeg;

        // 3. Iniciar a animação com um pequeno delay para o navegador processar o reset
        setTimeout(() => {
            wrapper.style.transition = 'transform 5s cubic-bezier(0.15, 0, 0.15, 1)';
            wrapper.style.transform = `rotate(${totalRotation}deg)`;
            
            if (upgradeStartSound) {
                upgradeStartSound.currentTime = 0;
                upgradeStartSound.play().catch(e => {});
            }
        }, 50);

        // 4. Mostrar o resultado após a agulha parar (5.5 segundos)
        setTimeout(async () => { // Adicionamos async aqui para o await funcionar
            if (data.win) {
                if (upgradeWinSound) upgradeWinSound.play().catch(e => {});
                showUpgradeResult(true, upgraderState.selectedTarget);
            } else {
                if (upgradeLossSound) upgradeLossSound.play().catch(e => {});
                showUpgradeResult(false, upgraderState.selectedTarget);
            }

            if (data.balance !== undefined) updateBalanceUI(data.balance);
            
            // Resetar estados de seleção
            upgraderState.selectedInputs = [];
            upgraderState.selectedTarget = null;
            isUpgrading = false;
            btn.disabled = false;
            
            // --- CORREÇÃO AQUI ---
            // Recarrega o inventário do servidor para remover os itens usados e adicionar o novo (se ganhou)
            await refreshUpgraderInventory(); 
            renderTargets();
        }, 5500);

    } catch (e) {
        alert(e.message);
        btn.disabled = false;
    }
}
function handleSkinCrashAction() {
    // 1. Verifica se temos o estado do jogo
    if (!currentCrashState) return;

    const btn = document.getElementById('skincrash-btn');

    // 2. Se o jogo estiver à espera de apostas (Waiting)
    if (currentCrashState.status === 'waiting') {
        if (selectedCrashSkins.length === 0) return alert("Selecione skins primeiro!");
        
        socket.emit('skinCrashBet', { 
            userId: currentUser._id, 
            itemIds: selectedCrashSkins 
        });
        
        // Feedback visual imediato
        if (btn) {
            btn.disabled = true;
            btn.querySelector('span').innerText = "BET PLACED...";
        }
    } 
    // 3. Se o jogo estiver a decorrer (Running)
    else if (currentCrashState.status === 'running') {
        socket.emit('skinCrashCashOut', { userId: currentUser._id });
    }
}

// Renderiza o inventário do utilizador na lateral do crash
function renderCrashInventory() {
    const grid = document.getElementById('crash-inv-grid');
    if (!grid) return;

    if (!currentUser || !currentUser.inventory || currentUser.inventory.length === 0) {
        grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: #444; padding: 40px; font-weight: 800;">INVENTORY EMPTY</div>';
        return;
    }

    // Verifica se já apostou para aplicar estilo visual (bloqueio)
    const hasBet = currentCrashState?.bets.some(b => b.userId === currentUser._id.toString());

    // 1. Clonar e Ordenar os itens
    let items = [...currentUser.inventory];
    if (crashSortMode === 'high') {
        items.sort((a, b) => b.value - a.value);
    } else if (crashSortMode === 'low') {
        items.sort((a, b) => a.value - b.value);
    } else {
        items.reverse(); // Newest (Padrão)
    }

    // 2. Lógica de Paginação (9 itens por página)
    const start = crashPageInv * 9; 
    const pageItems = items.slice(start, start + 9);

    // 3. Renderizar
    grid.innerHTML = pageItems.map(item => {
        const isSelected = selectedCrashSkins.includes(item.id);
        return `
            <div class="up-card ${isSelected ? 'selected' : ''} ${hasBet ? 'locked-inv' : ''}" 
                 onclick="toggleCrashSkin('${item.id}')">
                <div class="badge cond-${item.conditionShort}">${item.conditionShort}</div>
                <img src="${item.img}">
                <b>${item.name}</b>
                <span>$${formatCurrency(item.value)}</span>
            </div>
        `;
    }).join('');

    renderCrashPagination(items.length);
}
function renderCrashPagination(totalItems) {
    const totalPages = Math.ceil(totalItems / 9);
    const container = document.getElementById('crash-inv-pagination');
    if (totalPages <= 1) { container.innerHTML = ''; return; }

    let html = '';
    for (let i = 0; i < totalPages; i++) {
        html += `<button class="${i === crashPageInv ? 'active' : ''}" onclick="crashPageInv=${i}; renderCrashInventory();">${i + 1}</button>`;
    }
    container.innerHTML = html;
}
function updateCrashBetUI() {
    const betSumEl = document.getElementById('current-bet-sum');
    const countEl = document.getElementById('crash-upgrade-count'); // Certifica que este ID existe
    const btn = document.getElementById('skincrash-btn');

    if (!currentUser) return;

    const sum = selectedCrashSkins.reduce((acc, itemId) => {
        const item = currentUser.inventory.find(i => i.id === itemId);
        return acc + (item ? item.value : 0);
    }, 0);
    
    if (betSumEl) betSumEl.innerText = `$${formatCurrency(sum)}`;
    if (countEl) countEl.innerText = `${selectedCrashSkins.length}/5`;

    if (btn && currentCrashState && currentCrashState.status === 'waiting') {
        btn.disabled = selectedCrashSkins.length === 0;
    }
}
function toggleCrashSkin(id) {
    if (!currentCrashState) return;

    // Bloqueia se o jogo já estiver a correr ou se o utilizador já tiver apostado
    if (currentCrashState.status !== 'waiting') return;

    const hasBet = currentCrashState.bets.some(b => b.userId === currentUser._id.toString());
    if (hasBet) return; // <-- Não deixa selecionar se já apostou

    const index = selectedCrashSkins.indexOf(id);
    if (index > -1) {
        selectedCrashSkins.splice(index, 1);
    } else {
        if (selectedCrashSkins.length < 5) {
            selectedCrashSkins.push(id);
        }
    }
    
    updateCrashBetUI();
    renderCrashInventory(); 
}
function formatCurrency(num) {
    return Number(num).toLocaleString('pt-PT', { 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2 
    });
}
// Escutar o evento do servidor
socket.on('skinCrashTick', (state) => {
    currentCrashState = state;
    const multText = document.getElementById('skincrash-multiplier');
    const statusText = document.getElementById('skincrash-status');
    const btn = document.getElementById('skincrash-btn');

    const rewardCard = document.getElementById('crash-reward-card');
    
    if (!multText || !btn) return;

    // Verifica se EU (usuário logado) já apostei nesta rodada
    const myBet = state.bets.find(b => b.userId === currentUser._id.toString());

    if (state.status === 'waiting') {
        multText.innerText = state.timer.toFixed(1) + "s";
        multText.style.color = "white";
        statusText.innerText = "ACCEPTING BETS";
        
        if (myBet) {
            // Se eu já apostei, desativa o botão e mostra que estou "Dentro"
            btn.disabled = true;
            btn.style.filter = "grayscale(1)";
            btn.querySelector('span').innerText = "BET PLACED";
        } else {
            // Se não apostei, deixa o botão normal
            btn.disabled = selectedCrashSkins.length === 0;
            btn.style.filter = "none";
            btn.querySelector('span').innerText = "PLACE BET";
        }
        
        if (rewardCard) rewardCard.style.opacity = "0.3";
    } 
    else if (state.status === 'running') {
        multText.innerText = state.multiplier.toFixed(2) + "x";
        multText.style.color = "#ffb703";
        statusText.innerText = "FLYING...";

        const myBet = state.bets.find(b => b.userId === currentUser._id.toString());
        
        if (myBet && !myBet.cashedOut) {
            btn.disabled = false;
            btn.style.filter = "none"; // MANTÉM AZUL NO CASH OUT
            btn.querySelector('span').innerText = `CASH OUT ($${formatCurrency(myBet.initialValue * state.multiplier)})`;
            if (rewardCard) rewardCard.style.opacity = "1";

            if (state.suggestedSkin) {
                document.getElementById('crash-reward-img').src = state.suggestedSkin.img;
                document.getElementById('crash-reward-name').innerText = state.suggestedSkin.name;
                document.getElementById('crash-reward-value').innerText = `$${formatCurrency(myBet.initialValue * state.multiplier)}`;
                const badge = document.getElementById('crash-reward-badge');
                badge.innerText = state.suggestedSkin.conditionShort;
                badge.className = `badge cond-${state.suggestedSkin.conditionShort}`;
            }
        } else {
            btn.disabled = true;
            btn.style.filter = "grayscale(1)"; // Cinzento apenas se não estiver a jogar
            btn.querySelector('span').innerText = myBet?.cashedOut ? "CASHED OUT" : "IN PROGRESS";
        }
    } 
    else if (state.status === 'crashed') {
        multText.innerText = "CRASHED";
        multText.style.color = "#ff4444";
        statusText.innerText = "@ " + state.multiplier.toFixed(2) + "x";
        btn.disabled = true;
        btn.style.filter = "grayscale(1)";
        btn.querySelector('span').innerText = "BOOM";
        
        selectedCrashSkins = [];
        updateCrashBetUI();
    }
    if (document.getElementById('skin-crash-tab').style.display !== 'none') {
        renderCrashInventory();
    }
});
socket.on('inventoryUpdate', (newInventory) => {
    if (currentUser) {
        currentUser.inventory = newInventory;
        if (typeof sldOnInventory === 'function') sldOnInventory(); // Slider: refresca a lista de skins

        // Limpa IDs selecionados que já não existem no inventário novo
        selectedCrashSkins = selectedCrashSkins.filter(id => 
            newInventory.some(item => item.id === id)
        );

        if (document.getElementById('skin-crash-tab').style.display !== 'none') {
            updateCrashBetUI();
            renderCrashInventory();
        }
        loadInventory();
    }
});
function handleCrashAction() {
    if (currentCrashState.status === 'waiting') {
        const amount = parseFloat(document.getElementById('crash-amount').value);
        if (amount > currentUser.balance || amount <= 0) return alert("Invalid Bet");
        socket.emit('crashBet', { userId: currentUser._id, amount });
    } else if (currentCrashState.status === 'running') {
        socket.emit('crashCashOut', { userId: currentUser._id });
    }
}
function renderAvailableCasesForBattle() {
    const container = document.getElementById('modal-available-cases');
    const sortType = filters.battleSort; 
    
    // FILTRO ADICIONADO AQUI: Filtra apenas caixas que NÃO sejam do tipo "REWARD"
    let entries = Object.entries(itemsData).filter(([id, data]) => data.tag !== "REWARD");

    if (sortType === 'high') {
        entries.sort((a, b) => b[1].price - a[1].price);
    } else if (sortType === 'low') {
        entries.sort((a, b) => a[1].price - b[1].price);
    }

    container.innerHTML = entries.map(([id, data]) => `
        <div class="modal-case-item" data-id="${id}" data-name="${escapeHTML(String(data.name))}" onclick="addCaseToBattle('${id}')">
            <i class="btl-qty"></i>
            <img src="${data.img}" alt="">
            <div class="info">
                <b>${escapeHTML(String(data.name))}</b>
                <span>$${formatCurrency(data.price)}</span>
            </div>
        </div>
    `).join('');
    updateBattleQty();
    const s = document.getElementById('battle-case-search');
    if (s && s.value) filterBattleCases(true);
    battleRefreshAnim();
}
// animação de "a atualizar" da lista de caixas (igual ao upgrader)
function battleRefreshAnim() {
    const grid = document.getElementById('modal-available-cases');
    if (!grid) return;
    const now = performance.now();
    if (grid._an && now - grid._an < 350) return;
    grid._an = now;
    let i = 0;
    grid.querySelectorAll('.modal-case-item').forEach(c => {
        if (c.style.display === 'none') return;
        c.style.animationDelay = (Math.min(i++, 24) * 22) + 'ms';
    });
    grid.classList.remove('btl-refresh');
    void grid.offsetWidth;
    grid.classList.add('btl-refresh');
    clearTimeout(grid._at);
    grid._at = setTimeout(() => grid.classList.remove('btl-refresh'), 950);
}
// mostra ×N nas caixas já escolhidas e desativa o botão sem caixas
function updateBattleQty() {
    const counts = {};
    selectedCasesForBattle.forEach(id => { counts[id] = (counts[id] || 0) + 1; });
    document.querySelectorAll('#modal-available-cases .modal-case-item').forEach(card => {
        const n = counts[card.dataset.id] || 0;
        const q = card.querySelector('.btl-qty');
        if (q) q.textContent = n ? `×${n}` : '';
        card.classList.toggle('picked', n > 0);
    });
    const btn = document.getElementById('confirm-battle-btn');
    if (btn) btn.disabled = selectedCasesForBattle.length === 0;
}
function openBattleModal() {
    const modal = document.getElementById('battle-modal');
    modal.style.display = 'flex'; // Isso vai disparar as animações do CSS
    selectedCasesForBattle = [];
    updateModalSelected();
    renderAvailableCasesForBattle(); // Chama a função de renderização
}
// Função genérica para fechar qualquer modal com animação
function closeModalWithAnim(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;

    // Adiciona a classe de animação de saída
    modal.classList.add('closing');

    // Espera 300ms (o tempo definido no CSS) para remover o elemento
    setTimeout(() => {
        modal.style.display = 'none';
        modal.classList.remove('closing');
    }, 300);
}

// Atualize suas funções específicas para usar a nova lógica:
function closeBattleModal() {
    closeModalWithAnim('battle-modal');
}

function closeSellAllModal() {
    closeModalWithAnim('sell-all-modal');
}

function closeUpgradeModal() {
    closeModalWithAnim('upgrade-modal');
}

// Função de troca de abas (SwitchTab)
// Já deve funcionar com o CSS novo, mas vamos garantir que ela limpe animações anteriores
function openSettings() {
    switchTab('settings-tab', null);
}

function switchTab(id, el) {
    // Esconder todas as views
    document.querySelectorAll('.tab-view').forEach(t => t.style.display = 'none');
    // Remover active de todos os links
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    
    // Mostrar a view correta
    const target = document.getElementById(id);
    if(target) target.style.display = 'block';
    if (id !== 'beat-drop-tab') {
        const _main = document.querySelector('.main-content');
        if (_main) _main.style.removeProperty('overflow-y'); // o Beat Drop força overflow hidden; não pode ficar noutras tabs
    }
    // Marcar botão como ativo
    if(el) el.classList.add('active');
    const _pfp = document.querySelector('.pfp-wrap');
    if (_pfp) _pfp.classList.toggle('active', id === 'settings-tab');

    // CARREGAR INVENTÁRIO SE FOR A ABA DE CRASH
   if (id === 'skin-crash-tab') {
    crashPageInv = 0;
    selectedCrashSkins = []; // Limpa seleções ao entrar
    document.getElementById('current-bet-sum').innerText = "$0.00";
    renderCrashInventory();
}
    
    // Outras inicializações
    if (id === 'upgrade-tab') initUpgrader();
    if (id === 'inventory-tab') loadInventory();
    if (id === 'settings-tab') { loadBalanceHistory(); initAdminBalanceCard(); if (typeof initAdminBanCard === 'function') initAdminBanCard(); }
}

// Ranking desativado: sem scroll na página.
// Usa uma classe (.lb-lock) em vez de style inline, para não se misturar com o bloqueio de scroll do Upgrader / Songy.
// Acompanha a visibilidade da aba, por isso funciona seja qual for a forma como se sai do ranking.
(function () {
    const tab = document.getElementById('leaderboard-tab');
    const main = document.querySelector('.main-content');
    if (!tab || !main) return;
    const sync = () => {
        const open = tab.style.display !== 'none';
        main.classList.toggle('lb-lock', open);
        if (open) main.scrollTop = 0;
    };
    new MutationObserver(sync).observe(tab, { attributes: true, attributeFilter: ['style'] });
    sync();
})();

// Atualize também a função showHome para manter a consistência
function showHome() {
    const _pfp = document.querySelector('.pfp-wrap');
    if (_pfp) _pfp.classList.remove('active');
    document.querySelectorAll('.tab-view').forEach(t => t.style.display = 'none');
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    
    const homeTab = document.getElementById('home-tab');
    homeTab.style.display = 'block';
    
    const btnHome = document.querySelector('button[onclick="showHome()"]');
    if (btnHome) btnHome.classList.add('active');
}

function closeBattleModal() {
    closeModalWithAnim('battle-modal');
}

function addCaseToBattle(id) {
    if (selectedCasesForBattle.length >= 20) { // Alterado de 10 para 20
        const now = Date.now();
        if (!addCaseToBattle._t || now - addCaseToBattle._t > 1200) {
            addCaseToBattle._t = now; // evita notificações em cadeia ao clicar várias vezes
            showToast('You can add up to 20 cases per battle. Remove one to add another.', 'warn', 'Case limit reached');
        }
        const pill = document.getElementById('btl-sel-count');
        if (pill) {
            pill.classList.remove('btl-shake');
            void pill.offsetWidth;
            pill.classList.add('btl-shake');
        }
        return;
    }
    selectedCasesForBattle.push(id);
    updateModalSelected();
}
// Som da notificação: o mesmo ficheiro para todos os tipos, pré-carregado
const toastSound = new Audio('/assets/notify.mp3');
toastSound.preload = 'auto';
toastSound.volume = 0.5;
function playToastSound() {
    try {
        toastSound.currentTime = 0;
        toastSound.play().catch(() => {});
    } catch (e) { /* sem áudio: ignora */ }
}

// Notificação (toast) glass no topo do ecrã
function showToast(message, type = 'info', title = '', duration = 4200, sound = true) {
    let wrap = document.getElementById('toast-wrap');
    if (!wrap) {
        wrap = document.createElement('div');
        wrap.id = 'toast-wrap';
        wrap.setAttribute('aria-live', 'polite');
        document.body.appendChild(wrap);
    }
    const icons = {
        warn: '<path d="M12 8.5v4.5M12 16.6v.01"/><path d="M10.3 3.9L2.4 17.5A2 2 0 0 0 4.1 20.5h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>',
        error: '<circle cx="12" cy="12" r="9"/><path d="M15 9l-6 6M9 9l6 6"/>',
        success: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5-6"/>',
        info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8v.01"/>'
    };
    const titles = { warn: 'Heads up', error: 'Something went wrong', success: 'Done', info: 'Info' };
    if (!icons[type]) type = 'info';

    const toast = document.createElement('div');
    toast.className = 'toast ' + type;
    toast.setAttribute('role', 'status');
    toast.style.setProperty('--dur', duration + 'ms');
    toast.innerHTML =
        '<div class="toast-ic"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + icons[type] + '</svg></div>' +
        '<div class="toast-body"><b></b><span></span></div>' +
        '<button type="button" class="toast-x" aria-label="Dismiss"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" aria-hidden="true"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/></svg></button>' +
        '<i class="toast-bar"></i>';
    toast.querySelector('b').textContent = title || titles[type];
    toast.querySelector('span').textContent = message;
    wrap.appendChild(toast);
    if (sound) playToastSound();

    let closed = false, timer;
    const close = () => {
        if (closed) return;
        closed = true;
        clearTimeout(timer);
        toast.classList.add('out');
        setTimeout(() => toast.remove(), 380);
    };
    toast.addEventListener('click', close);
    timer = setTimeout(close, duration);
    while (wrap.children.length > 3) wrap.firstChild.remove();
}

function sellAllItems() {
    if (!currentUser || !currentUser.inventory || currentUser.inventory.length === 0) {
        return showToast("There are no skins to sell yet.", "warn", "Inventory empty");
    }
    const sellable = currentUser.inventory.filter(it => !it.isLocked);
    const locked = currentUser.inventory.length - sellable.length;
    if (sellable.length === 0) {
        return showToast("All your skins are locked. Unlock some to sell them.", "warn", "Nothing to sell");
    }
    const total = sellable.reduce((sum, it) => sum + (Number(it.value) || 0), 0);

    document.getElementById('sam-count').textContent = sellable.length;
    document.getElementById('sam-total').textContent = '$' + formatCurrency(total);
    const note = document.getElementById('sam-note');
    if (locked > 0) {
        note.textContent = locked + (locked === 1 ? ' locked skin stays' : ' locked skins stay') + ' in your inventory.';
        note.hidden = false;
    } else {
        note.hidden = true;
    }

    const modal = document.getElementById('sell-all-modal');
    if (!modal._sam) {
        modal._sam = true;
        // clicar fora e Escape fecham (igual ao modal da skin)
        modal.addEventListener('mousedown', (e) => {
            const btn = document.getElementById('confirm-sell-all-btn');
            if (e.target === modal && !btn.disabled) closeSellAllModal();
        });
        document.addEventListener('keydown', (e) => {
            const btn = document.getElementById('confirm-sell-all-btn');
            if (e.key === 'Escape' && modal.style.display !== 'none' && !modal.classList.contains('closing') && !btn.disabled) closeSellAllModal();
        });
    }
    modal.classList.remove('closing');
    modal.style.display = 'flex';
    const cancel = modal.querySelector('.sam-btn');
    if (cancel) cancel.focus({ preventScroll: true });
}

function closeSellAllModal() {
    closeModalWithAnim('sell-all-modal');
}
function openChangelog() {
    const modal = document.getElementById('changelog-modal');
    if (!modal._clg) {
        modal._clg = true;
        // clicar fora e Escape fecham (igual aos outros modais)
        modal.addEventListener('mousedown', (e) => { if (e.target === modal) closeChangelog(); });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal.style.display !== 'none' && !modal.classList.contains('closing')) closeChangelog();
        });
    }
    modal.classList.remove('closing');
    modal.style.display = 'flex';
    const sc = modal.querySelector('.changelog-scroll');
    if (sc) sc.scrollTop = 0;
    const x = modal.querySelector('.clg-close');
    if (x) x.focus({ preventScroll: true });
}

function closeChangelog() {
    // Usamos a função de animação que já tens no site
    closeModalWithAnim('changelog-modal');
}
async function confirmSellAll() {
    const btn = document.getElementById('confirm-sell-all-btn');
    const cancelBtn = document.querySelector('#sell-all-modal .sam-btn:not(.danger)');
    
    btn.classList.add('loading');
    btn.disabled = true;
    if (cancelBtn) cancelBtn.disabled = true;

    try {
        const res = await fetch('/api/sell-all-items', { method: 'POST' });
        const data = await res.json();
        
        if (data.success) {
            
            // Update balance and refresh UI
            updateBalanceUI(data.balance);
            await loadInventory();
            
            // Close the modal
            closeSellAllModal();
        } else {
            alert("Error: " + data.error);
        }
    } catch (e) {
        console.error(e);
        alert("Server connection error");
    } finally {
        btn.classList.remove('loading');
        btn.disabled = false;
        if (cancelBtn) cancelBtn.disabled = false;
    }
}

// Função para filtrar as caixas no modal
function filterBattleCases(noAnim) {
    const term = document.getElementById('battle-case-search').value.toLowerCase().trim();
    const grid = document.getElementById('modal-available-cases');
    const cards = grid.querySelectorAll('.modal-case-item');
    let visible = 0;

    cards.forEach(card => {
        const name = (card.getAttribute('data-name') || '').toLowerCase();
        const show = name.includes(term);
        card.style.display = show ? 'flex' : 'none';
        if (show) visible++;
    });

    const old = grid.querySelector('.btl-no-res');
    if (old) old.remove();
    if (!visible && cards.length) {
        grid.insertAdjacentHTML('beforeend', '<div class="btl-empty-sm btl-no-res">No cases match your search.</div>');
    }
    if (noAnim !== true) battleRefreshAnim();
}
function updateModalSelected() {
    const container = document.getElementById('modal-selected-cases');
    let total = 0;
    container.innerHTML = selectedCasesForBattle.length === 0
        ? '<div class="btl-empty-sm">No cases yet. Click a case to add it.</div>'
        : selectedCasesForBattle.map((id, index) => {
            total += itemsData[id].price;
            return `
            <div class="selected-item">
                <img src="${itemsData[id].img}" alt="">
                <b>${escapeHTML(itemsData[id].name)}</b>
                <em>$${formatCurrency(itemsData[id].price)}</em>
                <span role="button" aria-label="Remove" onclick="selectedCasesForBattle.splice(${index},1);updateModalSelected()">&times;</span>
            </div>`;
        }).join('');

    // Preço total das caixas escolhidas
    document.getElementById('total-battle-price').innerText = `$${formatCurrency(total)}`;
    const cnt = document.getElementById('btl-sel-count');
    if (cnt) {
        cnt.innerText = `${selectedCasesForBattle.length}/20`;
        cnt.classList.toggle('full', selectedCasesForBattle.length >= 20);
    }
    updateBattleQty();
}
function getSafeAvatar(url) {
    if (!url || url === "" || url === "undefined") {
        return 'https://api.dicebear.com/9.x/bottts/svg?seed=fallback';
    }
    return url;
}
function confirmCreateBattle() {
    if (selectedCasesForBattle.length === 0) return alert("Add at least one case!");
    const isBot = document.getElementById('bot-checkbox').checked;
    const isUnderdog = document.getElementById('underdog-checkbox').checked; // <--- ADICIONADO
    
    socket.emit('createBattle', {
        userId: currentUser._id,
        caseIds: selectedCasesForBattle,
        isBot: isBot,
        isUnderdog: isUnderdog // <--- ADICIONADO
    });
    closeBattleModal();
}
async function checkUserRewards(user) {
    const rewardSection = document.getElementById('reward-section');
    const rewardGrid = document.getElementById('reward-grid');
    
    if (user.rewardCases && user.rewardCases.length > 0) {
        rewardSection.style.display = 'block';
        rewardGrid.innerHTML = user.rewardCases.map((caseId, index) => {
            const data = itemsData[caseId];
            return `
                <div class="case-card-premium reward-box" onclick="selectCase('${caseId}')">
                    <div class="case-card-tag">WINNER</div>
                    <img src="${data.img}">
                    <h3>${data.name}</h3>
                    <div class="case-card-price">CLAIM FOR FREE</div>
                </div>
            `;
        }).join('');
    } else {
        rewardSection.style.display = 'none';
    }
}
async function loadLeaderboard() {
    const res = await fetch('/api/leaderboard');
    const allUsers = await res.json();
    
    const podiumEl = document.getElementById('leaderboard-podium');
    const listEl = document.getElementById('leaderboard-list');
    
    podiumEl.innerHTML = '';
    listEl.innerHTML = '';

    const winners = allUsers.filter(u => (Number(u.dailyWager) || 0) > 0);
    const labels = ["CHAMPION", "CHALLENGER", "CONTENDER"];
    const prizes = ["CHAMPION BOX", "CHALLENGER BOX", "CONTENDER BOX"];

    for (let i = 0; i < 3; i++) {
        const user = winners[i];

        if (user) {
            podiumEl.innerHTML += `
                <div class="tier-card rank-${i + 1}">
                    <div class="rank-badge">${i + 1}</div>
                    <div class="tier-label">${labels[i]}</div>
                    <div class="avatar-wrapper">
                        <img src="${user.avatar}" class="tier-pfp">
                    </div>
                    <div class="user-info">
                        <div class="username">${user.username}</div>
                        <div class="wager-val">$${formatCurrency(user.dailyWager)}</div>
                    </div>
                    <div class="prize-section">
                        <small>DAILY PRIZE</small>
                        <span>${prizes[i]}</span>
                    </div>
                </div>
            `;
        } else {
            podiumEl.innerHTML += `
                <div class="tier-card rank-${i + 1} is-empty">
                    <div class="rank-badge">${i + 1}</div>
                    <div class="tier-label">${labels[i]}</div>
                    <div class="avatar-wrapper">
                        <div class="empty-avatar">
                            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                        </div>
                    </div>
                    <div class="user-info">
                        <div class="username">EMPTY SLOT</div>
                        <div class="wager-val">$0.00</div>
                    </div>
                    <div class="prize-section">
                        <small>REWARD</small>
                        <span style="opacity: 0.2">${prizes[i]}</span>
                    </div>
                </div>
            `;
        }
    }

    allUsers.forEach((user, index) => {
        listEl.innerHTML += `
            <div class="leaderboard-row">
                <div class="row-pos">${index + 1}</div>
                <img src="${user.avatar}" class="row-pfp">
                <div class="row-name">${user.username}</div>
                <div class="row-val">$${formatCurrency(user.dailyWager)}</div>
            </div>
        `;
    });
}
function renderHomeCases() {
    const gridHot = document.getElementById('grid-new');
    const gridElite = document.getElementById('grid-boxes');

    if (!gridHot || !gridElite) return;

    gridHot.innerHTML = '';
    gridElite.innerHTML = '';

    Object.keys(itemsData).forEach(id => {
        const caseInfo = itemsData[id];
        
        // CORREÇÃO: A definição deve estar dentro do loop forEach
        const priceDisplay = caseInfo.price === 0 ? "FREE" : `$${formatCurrency(caseInfo.price)}`;

        const cardHtml = `
            <div class="case-card-premium" onclick="selectCase('${id}')">
                ${caseInfo.tag ? `<div class="case-card-tag ${caseInfo.tag.toLowerCase()}">${caseInfo.tag}</div>` : ''}
                <div class="case-img-wrap">
                    <img src="${caseInfo.img}" alt="${caseInfo.name}">
                </div>
                <h3>${caseInfo.name}</h3>
                <div class="case-card-price">${priceDisplay}</div>
            </div>
        `;

        if (caseInfo.tag === 'NEW') {
            gridHot.innerHTML += cardHtml;
        } 
        
        if (caseInfo.tag === 'BOXES') {
            gridElite.innerHTML += cardHtml;
        }
    });

    const _cnt = document.getElementById('cases-count');
    if (_cnt) {
        const n = gridHot.children.length + gridElite.children.length;
        _cnt.textContent = n + (n === 1 ? ' case' : ' cases');
    }
    document.getElementById('grid-new').parentElement.style.display = gridHot.innerHTML === '' ? 'none' : 'block';
    document.getElementById('grid-boxes').parentElement.style.display = gridElite.innerHTML === '' ? 'none' : 'block';
}
async function init() {
    const caseRes = await fetch('/api/cases');
    itemsData = await caseRes.json();
    
    // Desenha as caixas na página inicial
    renderHomeCases();

     const res = await fetch('/api/me');
    const data = await res.json();
    if (data.loggedIn) {
        currentUser = data.user;
        // AGORA PODES VER O TEU PERFIL
        console.log("Logado como:", currentUser.username, "ID:", currentUser.steamId);
        
        document.getElementById('auth-screen').style.display = 'none';
        document.getElementById('game-screen').style.display = 'flex';
        loadLeaderboard(); // Carrega o ranking
    checkUserRewards(currentUser); // Mostra as caixas de prêmio se houver
        updateUI();
    }
}
init();

// Function to handle the animation and update
function updateBalanceUI(newBalance) {
    if (!currentUser) return;

    const oldBalance = currentUser.balance;
    const difference = newBalance - oldBalance;

    if (difference !== 0) {
        showBalanceAnimation(difference);
        if (difference > 0) {
            winSound.currentTime = 0;
            winSound.play().catch(e => console.log("Sound play failed:", e));
        }
    }

    currentUser.balance = newBalance;
    // UPDATED: Use formatCurrency instead of Math.floor
    document.getElementById('balance').innerText = `$${formatCurrency(newBalance)}`;
}

function showBalanceAnimation(amount) {
    const container = document.getElementById('balance-indicator-container');
    if (!container) return;

    const el = document.createElement('div');
    const isGain = amount > 0;
    el.className = `balance-indicator ${isGain ? 'indicator-gain' : 'indicator-loss'}`;
    
    // UPDATED: Use formatCurrency for the floating number
    const formattedAmount = formatCurrency(Math.abs(amount));
    el.innerText = (isGain ? '+ ' : '- ') + `$${formattedAmount}`;
    
    container.appendChild(el);
    setTimeout(() => el.remove(), 1500);
}
function showBattleGain(playerNum, amount) {
    const balanceSpan = document.getElementById(`p${playerNum}-total-val`);
    const rect = balanceSpan.getBoundingClientRect();

    const el = document.createElement('div');
    el.className = 'battle-floating-gain';
    el.innerText = `+ $${formatCurrency(amount)}`;
    
    // Posiciona dinamicamente ao lado do elemento
    document.body.appendChild(el);
    el.style.left = `${rect.right + 10}px`;
    el.style.top = `${rect.top - 5}px`;


    setTimeout(() => el.remove(), 1500);
}
function parseSkinName(fullName) {
    const parts = fullName.split(' | ');
    return {
        weapon: parts[0] || "",
        skin: parts[1] || fullName
    };
}

function getDropTier(color) {
    const c = (color || '').toLowerCase();
    if (c === '#ffb703') return 'gold';
    if (c === '#eb4b4b') return 'red';
    if (c === '#d32ce6') return 'pink';
    if (c === '#8847ff') return 'purple';
    return 'common';
}

function addWonItemToArena(playerNum, item) {
    const inv = document.getElementById(`p${playerNum}-inventory`);
    if (!inv) return;

    const nameData = parseSkinName(item.name);
    const round = inv.children.length + 1; // 1 drop por ronda, por jogador
    const value = Number(item.value) || 0;
    const color = item.color || '#4b69ff';
    const wearCode = String(item.conditionShort || '').replace(/[^A-Za-z]/g, '');

    const itemCard = document.createElement('div');
    itemCard.className = 'won-item-card anim-entry';
    itemCard.dataset.tier = item.isSuperSpin ? 'super' : getDropTier(color);
    itemCard.dataset.value = value;
    itemCard.dataset.round = round;
    if (item.isSuperSpin) itemCard.classList.add('is-super');

    // Define a cor para o CSS usar no brilho e na borda
    itemCard.style.setProperty('--rarity-color', color);

    itemCard.innerHTML = `
        <div class="card-img-wrap">
            <img src="${item.img || ''}" alt="" loading="lazy">
        </div>
        <div class="card-details">
            <div class="weapon-type">${escapeHTML(nameData.weapon)}</div>
            <div class="skin-name">${escapeHTML(nameData.skin)}</div>
            <div class="skin-meta">${wearCode ? `<span class="ugx-wear ${wearCode}">${escapeHTML(item.conditionShort)}</span>` : ''}${item.isSuperSpin ? '<span class="drop-super">Gold</span>' : ''}</div>
        </div>
        <div class="card-value">$${formatCurrency(value)}</div>
    `;
    itemCard.querySelector('.skin-name').title = nameData.skin;

    inv.prepend(itemCard);

    const cnt = document.getElementById(`p${playerNum}-drop-count`);
    if (cnt) {
        cnt.innerText = inv.children.length;
        cnt.classList.remove('bump');
        void cnt.offsetWidth; // reinicia a animação
        cnt.classList.add('bump');
    }
}

// No fim da batalha, destaca o melhor drop de cada jogador
function markBestDrops() {
    [1, 2].forEach(n => {
        const inv = document.getElementById(`p${n}-inventory`);
        if (!inv || inv.children.length < 2) return;
        let best = null;
        inv.querySelectorAll('.won-item-card').forEach(card => {
            const v = Number(card.dataset.value) || 0;
            if (!best || v > best.v) best = { card, v };
        });
        if (!best) return;
        best.card.classList.add('is-best');
        const tag = document.createElement('span');
        tag.className = 'drop-best';
        tag.textContent = 'Best drop';
        const meta = best.card.querySelector('.skin-meta');
        if (meta) meta.appendChild(tag);
    });
}
function animateBattleValue(elementId, start, end, duration) {
    const obj = document.getElementById(elementId);
    if (!obj) return;

    let startTime = null;

    function step(timestamp) {
        if (!startTime) startTime = timestamp;
        const progress = Math.min((timestamp - startTime) / duration, 1);
        
        // Calcula o valor atual baseado no progresso (0 a 1)
        const current = start + (end - start) * progress;
        
        obj.innerText = formatCurrency(current);

        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
    }

    window.requestAnimationFrame(step);
}
function updateUI() {
    if(!currentUser) return;
    
    // Atualiza o saldo
    document.getElementById('balance').innerText = `$${formatCurrency(currentUser.balance)}`;
    
    // Atualiza o avatar na barra superior
    document.getElementById('user-avatar-top').src = currentUser.avatar;
    
    // ATUALIZAÇÃO: Novos IDs da aba Settings
    const settingsImg = document.getElementById('steam-avatar-display');
    const settingsName = document.getElementById('steam-username-display');
    
    if(settingsImg) settingsImg.src = currentUser.avatar;
    if(settingsName) settingsName.innerText = currentUser.username;
}

function showHome() {
    const _pfp = document.querySelector('.pfp-wrap');
    if (_pfp) _pfp.classList.remove('active');
    document.querySelectorAll('.tab-view').forEach(t => t.style.display = 'none');
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    document.getElementById('home-tab').style.display = 'block';
    document.querySelector('button[onclick="showHome()"]').classList.add('active');
}

function selectCase(id) {
    activeCaseId = id;
    
    if (!itemsData || !itemsData[id]) {
        console.error("Caixa não encontrada no sistema:", id);
        return;
    }

    document.querySelectorAll('.tab-view').forEach(t => t.style.display = 'none');
    document.getElementById('opening-tab').style.display = 'block';
    
    const caseInfo = itemsData[id]; 
    
    document.getElementById('case-title').innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; gap: 20px;">
            <img src="${caseInfo.img}" style="width: 80px; filter: drop-shadow(0 0 10px rgba(0,0,0,0.5))">
            ${caseInfo.name.toUpperCase()}
        </div>
    `;
    document.getElementById('open-btn').innerText = `OPEN FOR $${formatCurrency(caseInfo.price)}`;
    document.getElementById('open-btn').disabled = false;

    // --- PREVIEW TRACK GENERATION ---
    const spinner = document.getElementById('spinner');
    spinner.style.transition = 'none';
    spinner.style.transform = 'translateX(0)';

    let previewTrack = [];
    const itemsPool = caseInfo.items;
    
    for (let i = 0; i < 80; i++) {
        const item = itemsPool[i % itemsPool.length];
        // Pick the first rarity as a visual placeholder for the static preview
        const firstRarity = item.rarities[0];
        previewTrack.push({
            ...item,
            value: firstRarity.price,
            conditionShort: firstRarity.short
        });
    }
    renderTrack('spinner', previewTrack);

    // --- CASE CONTENTS LIST (FIX FOR NaN AND UNDEFINED) ---
    const preview = document.getElementById('preview-items');
    
    // Sort items by total drop chance (sum of all rarities)
    const sortedItems = [...caseInfo.items].sort((a, b) => {
        const chanceA = a.rarities.reduce((sum, r) => sum + r.chance, 0);
        const chanceB = b.rarities.reduce((sum, r) => sum + r.chance, 0);
        return chanceA - chanceB;
    });

    preview.innerHTML = sortedItems.map(item => {
        // Calculate the lowest and highest price from the rarities array
        const prices = item.rarities.map(r => r.price);
        const minP = Math.min(...prices);
        const maxP = Math.max(...prices);
        
        // Calculate the total drop chance for this skin
        const totalChance = item.rarities.reduce((sum, r) => sum + r.chance, 0);

        let priceDisplay = formatCurrency(minP) + " - " + formatCurrency(maxP);
        if (minP === maxP) priceDisplay = formatCurrency(minP);

        const pp = bdParseSkin(item.name);
        const tag = pp.st ? 'StatTrak™ ' : pp.sv ? 'Souvenir ' : '';
        return `
            <div class="preview-item" style="--rc: ${bdEsc(item.color || '#4b69ff')}" title="${bdEsc(item.name)}">
                <span class="pv-chance">${totalChance.toFixed(totalChance < 1 ? 3 : 2)}%</span>
                <div class="pv-img"><img src="${bdEsc(item.img || '')}" alt="" loading="lazy" decoding="async"></div>
                <div class="pv-name">
                    <small>${bdEsc(tag + (pp.finish ? pp.weapon : '\u00A0'))}</small>
                    <b>${bdEsc(pp.finish || pp.weapon)}</b>
                </div>
                <div class="pv-price">$${priceDisplay}</div>
            </div>
        `;
    }).join('');
    const _pc = document.getElementById('preview-count');
    if (_pc) _pc.textContent = sortedItems.length + (sortedItems.length === 1 ? ' skin' : ' skins');
}


function renderTrack(trackId, trackData) {
    const track = document.getElementById(trackId);
    if(!track) return;

    track.innerHTML = trackData.map((item, index) => {
        const val = item.value || 0;
        
        if (item.isSuperSpin) {
            // Adicionamos preload e removemos o 'autoplay' para ele ficar parado
            return `
                <div class="item-node super-spin-node" data-index="${index}">
                    <video muted playsinline class="super-spin-video" preload="auto">
                        <source src="./assets/super_spin.webm" type="video/webm">
                    </video>
                    <div class="winner-info-box">
                        <span class="win-condition">${item.conditionShort || ''}</span>
                        <b class="win-name">${item.name}</b>
                        <span class="win-price">$${formatCurrency(val)}</span>
                    </div>
                </div>
            `;
        }

        let rarityClass = '';
        const color = item.color ? item.color.toLowerCase() : '';
        if (color === '#ffb703') rarityClass = 'rarity-gold';
        else if (color === '#eb4b4b') rarityClass = 'rarity-red';
        else if (color === '#d32ce6') rarityClass = 'rarity-pink';
        else if (color === '#8847ff') rarityClass = 'rarity-purple';
        else if (color === '#4b69ff') rarityClass = 'rarity-blue';
        else if (color === '#5e98d9') rarityClass = 'rarity-light-blue';
        return `
            <div class="item-node ${rarityClass}" data-index="${index}">
                <img src="${item.img || ''}" alt="">
                <div class="winner-info-box">
                    <span class="win-condition">${item.conditionShort || ''}</span>
                    <b class="win-name">${item.name}</b>
                    <span class="win-price">$${formatCurrency(val)}</span>
                </div>
            </div>
        `;
    }).join('');
}
function updateLeaderboardCountdown() {
    const now = new Date();
    const target = new Date();

    // HORA DO TEU TESTE (Ex: 17:16)
    target.setHours(19, 0, 0, 0); 

    // SEGREDO: Se a hora atual já passou do target, o target passa a ser AMANHÃ
    if (now > target) {
        target.setDate(target.getDate() + 1);
    }

    const diff = target - now;

    // Se faltarem menos de 10 segundos para o reset (opcional, para dar efeito)
    if (diff <= 0) {
    document.getElementById('leaderboard-countdown').innerText = "DISTRIBUTING...";
    return;
}

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    const display = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    const el = document.getElementById('leaderboard-countdown');
    if (el) el.innerText = display;
}

setInterval(updateLeaderboardCountdown, 1000);
updateLeaderboardCountdown();
async function executeArenaSpin(playerNum, spinnerId, winnerData, casePrice, itemsPool, isBattle = false, forcedSuperSpin = null, isLocalPlayer = true) {
    const spinner = document.getElementById(spinnerId);
    if (!spinner) return;

    const containerWidth = spinner.parentElement.offsetWidth;
    const centerPrecisionX = (50 * NODE_WIDTH) - (containerWidth / 2) + (NODE_WIDTH / 2);
    const serverOffset = winnerData.offset !== undefined ? winnerData.offset : 0;
     const targetX = centerPrecisionX + serverOffset;

    let isSuperWin = !!forcedSuperSpin;


    // 1. Reset e Início
    spinner.style.transition = 'none';
    lastTickIndex = -1; // Reseta o rastreador de som para o novo giro
    spinner.style.transform = 'translateX(0)';
    renderTrack(spinnerId, winnerData.track); 
    await new Promise(r => setTimeout(r, 50));

    // Giro 1
    spinner.style.transition = 'transform 5s cubic-bezier(0.05, 0, 0, 1)';
    spinner.style.transform = `translateX(-${targetX}px)`;
    trackCenterItem(spinnerId, isLocalPlayer); // isLocalPlayer = este é o spinner que se ouve
    if (isLocalPlayer) { spinSound.currentTime = 0; spinSound.play().catch(e => {}); }
    await new Promise(r => setTimeout(r, 5000));

    // Snap
    spinner.style.transition = 'transform 0.6s cubic-bezier(0.25, 1, 0.5, 1)';
    spinner.style.transform = `translateX(-${centerPrecisionX}px)`;
    const node = spinner.querySelector('.item-node[data-index="50"]');
    if(node) node.classList.add('is-winner');

    if (isSuperWin) {
        // Se for Super Spin, NÃO adicionamos o item ao inventário lateral ainda
        if (isLocalPlayer) playSuperLand();
    } else {
        if (isLocalPlayer) { landSound.currentTime = 0; landSound.play().catch(e => {}); }
        if(node) node.classList.add('reveal-final');
        
        // APENAS adiciona aqui se NÃO for super spin
        if(isBattle) {
            addWonItemToArena(playerNum, winnerData);
            showBattleGain(playerNum, winnerData.value);
        }
    }

    await new Promise(r => setTimeout(r, 600));

    // 2. Lógica do Super Spin
    if (isSuperWin) {
        const video = node ? node.querySelector('video') : null;
        if(video) { video.currentTime = 0; video.play(); }

        // ESPERA 3 SEGUNDOS DE VÍDEO
        await new Promise(r => setTimeout(r, 3000));
        if (isLocalPlayer) { spinSound.currentTime = 0; spinSound.play().catch(e => {}); }
        lastTickIndex = -1;
        // Monta track do segundo giro (skins caras)
        const topItems = itemsPool.filter(item => {
        const maxPriceInRarities = Math.max(...item.rarities.map(r => r.price));
        return maxPriceInRarities >= (casePrice * 2.5);
    });

    const superTrack = [];
    for(let i=0; i<60; i++) {
        const pick = topItems[Math.floor(Math.random() * topItems.length)];
        const highestRarity = pick.rarities[0]; // Just a placeholder for visual super track
        superTrack.push(i === 50 ? { ...winnerData, isSuperSpin: false } : { 
            ...pick, 
            value: highestRarity.price, 
            conditionShort: highestRarity.short, 
            isSuperSpin: false 
        });
    }

        spinner.style.transition = 'none';
        spinner.style.transform = 'translateX(0)';
        renderTrack(spinnerId, superTrack); 
        await new Promise(r => setTimeout(r, 50));

        const superTargetX = centerPrecisionX + (Math.random() * 60 - 30);

        // Segundo Giro (Rápido)
        spinner.style.transition = 'transform 5s cubic-bezier(0.05, 0, 0, 1)';
        spinner.style.transform = `translateX(-${superTargetX}px)`;

        trackCenterItem(spinnerId, isLocalPlayer); // Religa o highlight (+ som só se for o spinner audível)
        await new Promise(r => setTimeout(r, 5000));

        spinner.style.transition = 'transform 0.6s cubic-bezier(0.25, 1, 0.5, 1)';
        spinner.style.transform = `translateX(-${centerPrecisionX}px)`;

        const finalNode = spinner.querySelector('.item-node[data-index="50"]');
        if(finalNode) finalNode.classList.add('is-winner', 'reveal-final'); 

        if(isBattle) {
            addWonItemToArena(playerNum, { ...winnerData, isSuperSpin: true });
            showBattleGain(playerNum, winnerData.value);
        }

        if (isLocalPlayer) { landSound.currentTime = 0; landSound.play().catch(e => {}); }
        await new Promise(r => setTimeout(r, 800));
    }
}
async function openCase() {
    const btn = document.getElementById('open-btn');
    const caseInfo = itemsData[activeCaseId];
    
    // Se não for FREE e não tiver saldo
    if (caseInfo.price > 0 && currentUser.balance < caseInfo.price) return alert("Not enough credits!");
    
    btn.classList.add('btn-loading');
    btn.disabled = true;

    try {
        const res = await fetch('/api/open-case', {
            method: 'POST', 
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ caseId: activeCaseId })
        });
        const data = await res.json();

        if (data.error) {
            alert(data.error);
            btn.classList.remove('btn-loading');
            btn.disabled = false;
            return;
        }

        // 1. Atualiza o saldo localmente
        updateBalanceUI(data.finalBalance);

        // 2. Executa o giro
      // Dentro da função openCase
await executeArenaSpin(1, 'spinner', {
    ...data.winner,
    track: data.track
}, caseInfo.price, caseInfo.items, false, data.isSuperSpin, true); // O 'true' final garante o som

        // 3. Atualiza o inventário e as recompensas
        loadInventory();
        
        // Atualiza a lista de recompensas do usuário logado
        currentUser.rewardCases = data.rewardCases;
        checkUserRewards(currentUser); 

        btn.disabled = false;
        btn.classList.remove('btn-loading');

    } catch (e) {
        console.error(e);
        btn.classList.remove('btn-loading');
        btn.disabled = false;
    }
}

function openEquipMenu(event, itemId, weaponId) {
    // Remove menu anterior se existir
    const oldMenu = document.querySelector('.mini-equip-menu');
    if (oldMenu) oldMenu.remove();

    const teamType = getWeaponTeamType(weaponId);
    const menu = document.createElement('div');
    menu.className = 'mini-equip-menu';
    
    let buttons = '';
    if (teamType === 'tr' || teamType === 'both') 
        buttons += `<button onclick="handleEquip('${itemId}', 2)">EQUIP T</button>`;
    if (teamType === 'ct' || teamType === 'both') 
        buttons += `<button onclick="handleEquip('${itemId}', 3)">EQUIP CT</button>`;
    if (teamType === 'both') 
        buttons += `<button onclick="handleEquip('${itemId}', 4)">EQUIP BOTH</button>`;
    
    buttons += `<button class="btn-unequip" onclick="handleEquip('${itemId}', 0, 'unequip')">UNEQUIP</button>`;

    menu.innerHTML = buttons;
    document.body.appendChild(menu);

    // Posicionar o menu onde clicou
    menu.style.left = `${event.pageX}px`;
    menu.style.top = `${event.pageY}px`;

    // Fechar menu ao clicar fora
    setTimeout(() => {
        window.onclick = () => { menu.remove(); window.onclick = null; };
    }, 100);
}

async function handleEquip(itemId, team, action = 'equip') {
    const res = await fetch('/api/equip-item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, team, action })
    });
    const data = await res.json();
    if (data.success) loadInventory();
}
socket.on('balanceUpdate', (newBalance) => {
   updateBalanceUI(newBalance); 
    refreshBalanceHistorySoon();
    // Remove loading from the "New Battle" button if it exists
    const createBtn = document.querySelector('.lobby-create .btn-primary');
    if(createBtn) createBtn.classList.remove('btn-loading');
});

function createBattle() {
    const btn = event.target; // Note: using event.target is fine here
    const cid = document.getElementById('battle-case-select').value;
    if(currentUser.balance < cases[cid].price) return alert("Low balance");
    
    btn.classList.add('btn-loading');
    socket.emit('createBattle', { userId: currentUser._id, caseId: cid });
}

// main.js - Update joinBattle slightly for safety
function joinBattle(id, price) {
    if (!currentUser) return alert("Please log in first!");
    
    // Verificação básica de saldo no front-end
    if (currentUser.balance < price) return alert("Low balance!");

    // Mostra feedback visual no botão que foi clicado
    const btn = event.target;
    if (btn && btn.tagName === 'BUTTON') {
        btn.classList.add('btn-loading');
        btn.innerText = "JOINING...";
        btn.disabled = true;
    }

    // Envia para o servidor. O servidor vai validar se você pode entrar ou não.
    socket.emit('joinBattle', { battleId: id, userId: currentUser._id });
}
socket.on('leaderboardReset', async () => {
    console.log("Recebido aviso de reset do servidor!");
    
    // 1. Atualiza os dados do utilizador (para a caixa aparecer)
    const res = await fetch('/api/me');
    const data = await res.json();
    if (data.loggedIn) {
        currentUser = data.user;
        checkUserRewards(currentUser); // Faz a caixa aparecer no topo
    }

    // 2. Atualiza o Ranking (para os valores voltarem a $0.00)
    loadLeaderboard();
});
socket.on('updateBattles', (battles) => {
    const list = document.getElementById('battle-list');
    if (!list) return;

    const countEl = document.getElementById('battle-count');
    if (countEl) countEl.innerText = `${battles.length} open`;

    if (!battles.length) {
        list.innerHTML = '<div class="btl-empty"><b>No open battles</b>Create one and wait for an opponent.</div>';
        return;
    }

    list.innerHTML = battles.map(b => {
        const firstCaseId = b.caseIds[0];
        const firstCaseName = itemsData[firstCaseId] ? itemsData[firstCaseId].name : "Case";
        const totalCases = b.caseIds.length;
        const displayName = totalCases > 1 ? `${firstCaseName} +${totalCases - 1}` : firstCaseName;

        const p1Ava = getSafeAvatar(b.player1.avatar);
        const p2Ava = 'https://api.dicebear.com/9.x/bottts/svg?seed=waiting';

        // miniaturas das primeiras caixas
        const thumbs = b.caseIds.slice(0, 4).map(cid =>
            itemsData[cid] ? `<img src="${itemsData[cid].img}" alt="">` : ''
        ).join('');
        const more = totalCases > 4 ? `<span class="btl-more">+${totalCases - 4}</span>` : '';

        // CORREÇÃO: Verificar se o currentUser existe antes de tentar ler o ._id
        let actionButton = "";
        if (!currentUser) {
            actionButton = `<button class="btl-btn" disabled>Login to join</button>`;
        } else if (b.player1.id === currentUser._id.toString()) {
            actionButton = '<span class="badge-yours">Your battle</span>';
        } else {
            actionButton = `<button class="btl-btn" onclick="joinBattle('${b.id}', ${b.price})">Join $${formatCurrency(b.price)}</button>`;
        }

        return `
            <div class="battle-card">
                <div class="users">
                    <div class="avatar-stack">
                        <img src="${p1Ava}" class="p1-img" alt="">
                        <div class="vs-circle">VS</div>
                        <img src="${p2Ava}" class="p2-img grayscale" alt="">
                    </div>
                    <div class="user-info">
                        <b>${escapeHTML(String(b.player1.username))}</b>
                        <small><i class="btl-dot"></i>Waiting for player</small>
                    </div>
                </div>
                <div class="battle-details">
                    <div class="btl-thumbs">${thumbs}${more}</div>
                    <div class="btl-case-txt">
                        <small>${totalCases} ${totalCases === 1 ? 'case' : 'cases'}</small>
                        <b>${escapeHTML(displayName)}</b>
                    </div>
                </div>
                <div class="battle-actions">
                    ${actionButton}
                </div>
            </div>
        `;
    }).join('');
});
async function loadInventory() {
    const res = await fetch('/api/me');
    const data = await res.json();
    if (!data.loggedIn) return;
    
    currentUser = data.user;
    const grid = document.getElementById('inventory-grid');
    
    // --- ATUALIZAÇÃO AQUI ---
    // Em vez de ler do document.getElementById('sort-price').value
    const sortBy = filters.invPrice; 
    const filterRarity = filters.invRarity;

    let items = [...data.user.inventory];

    // Aplicar Filtro de Raridade
    if (filterRarity !== 'all') {
        items = items.filter(item => item.color === filterRarity);
    }

    // Aplicar Ordenação
    if (sortBy === 'low') {
        items.sort((a, b) => a.value - b.value);
    } else if (sortBy === 'high') {
        items.sort((a, b) => b.value - a.value);
    } else if (sortBy === 'newest') {
        items.reverse();
    }

    if (items.length === 0) {
        grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: #555; padding: 40px;">No items found.</div>`;
        return;
    }

    grid.innerHTML = items.map(item => {
        const itemJson = JSON.stringify(item).replace(/'/g, "&apos;");
        let badgesHtml = '<div class="loadout-badges">';
if (item.equippedTeam === 2 || item.equippedTeam === 4) badgesHtml += '<span class="l-badge t">T</span>';
if (item.equippedTeam === 3 || item.equippedTeam === 4) badgesHtml += '<span class="l-badge ct">CT</span>';
if (item.isLocked) badgesHtml += `
    <span class="l-badge lock">
        <svg viewBox="0 0 24 24" width="10" height="10" fill="currentColor">
            <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM9 6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9V6zm9 14H6V10h12v10zm-6-3c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2z"></path>
        </svg>
    </span>`;
badgesHtml += '</div>';

        return `
            <div class="inventory-card" style="--rarity-color: ${item.color};" onclick='openSkinModal(${itemJson})'>
                ${badgesHtml}
                <img src="${item.img}">
                <div class="inv-info">
                    <b>${item.name}</b>
                    <small style="color: ${item.color}">${item.conditionShort}</small>
                    <span>$${formatCurrency(item.value)}</span>
                </div>
            </div>
        `;
    }).join('');
}


// Nova função para chamar a API de equipar
async function equipItem(id) {
    const res = await fetch('/api/equip-item', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ itemId: id })
    });
    const data = await res.json();
    if(data.success) {
        loadInventory(); // Recarrega para mostrar o status novo
    }
}

async function sellItem(event, id) {
    const info = skinToastInfo(id);
    // 1. Identificar o botão que foi clicado
    const btn = event.target;
    
    // 2. Adicionar o estado de loading
    btn.classList.add('btn-loading');
    btn.disabled = true; // Impede cliques duplos

    try {
        const res = await fetch('/api/sell-item', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ itemId: id })
        });
        
        const data = await res.json();
        
        if (data.success) {

            // 4. Atualizar o saldo com animação
            updateBalanceUI(data.balance);
            showToast(info ? info.name + '  ·  +$' + formatCurrency(info.value) : 'Your skin was sold.', 'success', 'Skin sold');
            
            // 5. Recarregar o inventário (o item desaparecerá)
            await loadInventory(); 
        } else {
            alert("Error selling item: " + data.error);
            btn.classList.remove('btn-loading');
            btn.disabled = false;
        }
    } catch (e) {
        console.error(e);
        btn.classList.remove('btn-loading');
        btn.disabled = false;
    }
}
socket.on('startBattleSpin', async (data) => {
    switchTab('arena-tab');
    
    // 1. Reset de UI e Cálculo do Valor Total
    document.getElementById('battle-msg').innerText = "FIGHT!"; 
    document.getElementById('p1-total-val').innerText = "0.00"; 
    document.getElementById('p2-total-val').innerText = "0.00"; 
    document.getElementById('p1-inventory').innerHTML = '';
    document.getElementById('p2-inventory').innerHTML = '';
    document.getElementById('total-rounds').innerText = data.p1Rolls.length;

    // Reset do estado visual da arena (vencedor/perdedor, drops, progresso)
    ['lane-p1', 'lane-p2'].forEach(id => {
        const l = document.getElementById(id);
        if (l) l.classList.remove('is-winner-lane', 'is-loser-lane');
    });
    ['p1-drop-count', 'p2-drop-count'].forEach(id => { const e = document.getElementById(id); if (e) e.innerText = '0'; });
    const statsBar = document.querySelector('#arena-tab .battle-stats-bar');
    if (statsBar) statsBar.style.setProperty('--prog', '0%');
    const msgEl = document.getElementById('battle-msg');
    if (msgEl) msgEl.classList.remove('decided');

    // Calcula e exibe o preço total da batalha
    let totalBattlePrice = data.battle.caseIds.reduce((sum, cid) => sum + (itemsData[cid]?.price || 0), 0);
    document.getElementById('arena-total-battle-price').innerText = formatCurrency(totalBattlePrice);
    
    // Timeline das caixas
    const timeline = document.getElementById('battle-case-timeline');
    timeline.innerHTML = data.battle.caseIds.map((cid, idx) => {
        const caseImg = itemsData[cid] ? itemsData[cid].img : '';
        return `<div class="timeline-case" id="step-${idx}"><img src="${caseImg}"></div>`;
    }).join('');

    document.getElementById('p1-username').innerText = data.battle.player1.username;
    document.getElementById('p2-username').innerText = data.battle.player2.username;
    document.getElementById('p1-ava').src = getSafeAvatar(data.battle.player1.avatar);
    document.getElementById('p2-ava').src = getSafeAvatar(data.battle.player2.avatar);

    let p1Acc = 0;
    let p2Acc = 0;
const amIPlayer1 = currentUser && currentUser._id === data.battle.player1.id;
    const amIPlayer2 = currentUser && currentUser._id === data.battle.player2.id;

    // LOOP DAS RONDAS
    for (let i = 0; i < data.p1Rolls.length; i++) {
        const currentCaseId = data.battle.caseIds[i];
        const currentCase = itemsData[currentCaseId]; // Pega os dados da caixa atual
        const casePrice = currentCase.price;
        const itemsPool = currentCase.items;

        // --- ATUALIZA NOME E PREÇO DA CAIXA ATUAL ---
        document.getElementById('cur-case-name').innerText = currentCase.name;
        document.getElementById('cur-case-price').innerText = formatCurrency(casePrice);
        const curCaseBanner = document.querySelector('#arena-tab .current-case-banner');
        if (curCaseBanner) { curCaseBanner.classList.remove('swap'); void curCaseBanner.offsetWidth; curCaseBanner.classList.add('swap'); }

        document.querySelectorAll('.timeline-case').forEach(el => el.classList.remove('active'));
        const currentStep = document.getElementById(`step-${i}`);
        if (currentStep) currentStep.classList.add('active', 'passed');
        // scroll só DENTRO da timeline (horizontal) — scrollIntoView mexia na página toda e puxava-a de volta ao topo
        if (currentStep && timeline) {
            const left = currentStep.offsetLeft - (timeline.clientWidth - currentStep.offsetWidth) / 2;
            timeline.scrollTo({ left: Math.max(0, left), behavior: 'smooth' });
        }
        document.getElementById('current-round').innerText = i + 1;
        if (statsBar) statsBar.style.setProperty('--prog', (((i + 1) / data.p1Rolls.length) * 100) + '%');

        spinSound.currentTime = 0; 
        spinSound.play().catch(e => {});

        // Só UM spinner faz som por ronda: se só um deles é super spin ouve-se esse;
        // caso contrário ouve-se o do jogador local (ou o do P1 se for espectador)
        const p1Super = !!data.p1Rolls[i].isSuperSpin, p2Super = !!data.p2Rolls[i].isSuperSpin;
        let audible;
        if (p1Super !== p2Super) audible = p1Super ? 1 : 2;
        else audible = amIPlayer2 && !amIPlayer1 ? 2 : 1;

        await Promise.all([
            executeArenaSpin(1, 'p1-spinner', data.p1Rolls[i], casePrice, itemsPool, true, data.p1Rolls[i].isSuperSpin, audible === 1),
            executeArenaSpin(2, 'p2-spinner', data.p2Rolls[i], casePrice, itemsPool, true, data.p2Rolls[i].isSuperSpin, audible === 2)
        ]);
        const oldP1 = p1Acc;
        const oldP2 = p2Acc;
        p1Acc += data.p1Rolls[i].value;
        p2Acc += data.p2Rolls[i].value;
        document.getElementById('p1-total-val').innerText = formatCurrency(p1Acc);
        document.getElementById('p2-total-val').innerText = formatCurrency(p2Acc);
        animateBattleValue('p1-total-val', oldP1, p1Acc, 1000); // 1000ms = 1 segundo de animação
        animateBattleValue('p2-total-val', oldP2, p2Acc, 1000);
        await new Promise(r => setTimeout(r, 500)); 
    }

    // Resultado Final
    const winnerName = data.winnerId === data.battle.player1.id ? data.battle.player1.username : data.battle.player2.username;
    document.getElementById('battle-msg').innerText = `${winnerName.toUpperCase()} WINS!`;
    if (msgEl) msgEl.classList.add('decided');
    const p1Won = data.winnerId === data.battle.player1.id;
    const laneW = document.getElementById(p1Won ? 'lane-p1' : 'lane-p2');
    const laneL = document.getElementById(p1Won ? 'lane-p2' : 'lane-p1');
    if (laneW) laneW.classList.add('is-winner-lane');
    if (laneL) laneL.classList.add('is-loser-lane');

    markBestDrops();
    playBattleWinSound();

    const myFinalBalance = (currentUser._id === data.battle.player1.id) ? data.p1FinalBalance : data.p2FinalBalance;
    if (myFinalBalance !== undefined) updateBalanceUI(myFinalBalance);
});
function escapeHTML(str) {
    const p = document.createElement('p');
    p.textContent = str;
    return p.innerHTML;
}
// Chat
document.getElementById('chat-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && e.target.value.trim() !== '') {
        // CORREÇÃO 1: Verificar se o usuário está logado antes de enviar
        if (!currentUser) {
            alert("Você precisa estar logado para usar o chat!");
            e.target.value = '';
            return;
        }

        const message = e.target.value.trim();
        
        socket.emit('chatMessage', { 
            user: currentUser.username, 
            msg: message, 
            avatar: currentUser.avatar || 'https://api.dicebear.com/9.x/bottts/svg?seed=Guest' 
        });
        
        e.target.value = '';
    }
});

socket.on('chatMessage', (data) => {
    if (!data.user || !data.msg) return;

    const box = document.getElementById('chat-msgs');
    const isAtBottom = box.scrollHeight - box.clientHeight <= box.scrollTop + 50;

    const div = document.createElement('div');
    div.className = 'chat-line';

    const safeUser = escapeHTML(data.user);
    const safeMsg = escapeHTML(data.msg);
    
    // Verificamos se existe steamId para evitar o erro de 'undefined'
    const steamId = data.steamId;
    const clickAction = steamId ? `onclick="openProfileModal('${steamId}')"` : "";

    div.innerHTML = `
        <div class="chat-profile-link" ${clickAction} style="cursor: pointer;">
            <img src="${data.avatar}" onerror="this.src='https://api.dicebear.com/9.x/bottts/svg?seed=Error'">
        </div>
        <div class="chat-bubble">
            <div class="chat-user-name" ${clickAction} style="cursor: pointer;">
                <b>${safeUser}</b>
            </div>
            <div class="chat-text">${safeMsg}</div>
        </div>
    `;
    
    box.appendChild(div);
    if (isAtBottom) box.scrollTop = box.scrollHeight;
});
async function showUserProfile(steamId) {
    if(!steamId) return;
    
    // Mostra o separador e limpa o anterior
    switchTab('profile-tab');
    document.getElementById('view-profile-name').innerText = "Carregando...";
    document.getElementById('view-profile-inventory-grid').innerHTML = "";

    try {
        const res = await fetch(`/api/profile/${steamId}`);
        const user = await res.json();

        if (user.error) return alert(user.error);

        // Preenche o Cabeçalho
        document.getElementById('view-profile-avatar').src = user.avatar;
        document.getElementById('view-profile-name').innerText = user.username.toUpperCase();
        
        // Calcula valores
        const totalValue = user.inventory.reduce((sum, item) => sum + item.value, 0);
        document.getElementById('view-profile-count').innerText = `${user.inventory.length} ITENS`;
        document.getElementById('view-profile-value').innerText = `$${formatCurrency(totalValue)}`;

        // Renderiza o Inventário (apenas visualização, sem botões de vender)
        const grid = document.getElementById('view-profile-inventory-grid');
        grid.innerHTML = user.inventory.map(item => `
            <div class="inventory-card" style="--rarity-color: ${item.color};">
                <img src="${item.img}">
                <div class="inv-info">
                    <b>${item.name}</b>
                    <small style="color: ${item.color}">${item.conditionShort}</small>
                    <span>$${formatCurrency(item.value)}</span>
                </div>
            </div>
        `).join('');

    } catch (e) {
        console.error("Erro ao carregar perfil:", e);
    }
}
async function openProfileModal(steamId) {
    if(!steamId || steamId === 'undefined') return;

    const modal = document.getElementById('profile-modal');
    modal.classList.remove('closing'); 
    modal.style.display = 'flex';
    
    
    // Reset
    document.getElementById('p-name').innerText = "CARREGANDO...";
    document.getElementById('p-grid').innerHTML = "";

    try {
        const res = await fetch(`/api/profile/${steamId}`);
        const user = await res.json();

        document.getElementById('p-ava').src = user.avatar;
        document.getElementById('p-name').innerText = user.username;
        
        const totalValue = user.inventory.reduce((sum, item) => sum + item.value, 0);
        document.getElementById('p-count').innerText = user.inventory.length;
        document.getElementById('p-value').innerText = `$${formatCurrency(totalValue)}`;

        const grid = document.getElementById('p-grid');
        grid.innerHTML = user.inventory.map(item => `
            <div class="inventory-card" style="--rarity-color: ${item.color};">
                <img src="${item.img}">
                <div class="inv-info">
                    <b>${item.name}</b>
                    <small style="color: ${item.color}">${item.conditionShort}</small>
                    <span>$${formatCurrency(item.value)}</span>
                </div>
            </div>
        `).join('');

    } catch (e) {
        console.error(e);
    }
}

function closeProfile() {
    const modal = document.getElementById('profile-modal');
    
    // 1. Adiciona a classe que dispara as animações de saída
    modal.classList.add('closing');

    // 2. Espera 500ms (o mesmo tempo da animação no CSS) para esconder o modal
    setTimeout(() => {
        modal.style.display = 'none';
        
        // 3. Remove a classe closing para que ele possa abrir corretamente da próxima vez
        modal.classList.remove('closing');
    }, 500); 
}
// Settings & Auth
function sendMessage() {
    const input = document.getElementById('chat-input');
    const message = input.value.trim();

    if (message !== '') {
        if (!currentUser || !currentUser.steamId) {
            alert("Faça login via Steam para usar o chat!");
            input.value = '';
            return;
        }

        socket.emit('chatMessage', { 
            user: currentUser.username, 
            msg: message, 
            avatar: currentUser.avatar,
            steamId: currentUser.steamId // <--- ENVIA O SEU ID AQUI
        });
        
        input.value = '';
    }
}

// Enter para enviar
document.getElementById('chat-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

// Clique no botão redondo para enviar
document.getElementById('btn-chat-send').addEventListener('click', sendMessage);

async function auth(type) {
    const btn = event.target; // Get the clicked button
    btn.classList.add('btn-loading');
    
    try {
        const res = await fetch(`/api/${type}`, {
            method: 'POST', 
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                username: document.getElementById('user').value, 
                password: document.getElementById('pass').value
            })
        });
        const data = await res.json();
        if(data.success) location.reload(); 
        else alert("Error: " + (data.error || "Login failed"));
    } catch (e) {
        alert("Server connection error");
    } finally {
        btn.classList.remove('btn-loading');
    }
}

// Função para destacar o item no centro em tempo real
function trackCenterItem(spinnerId, isLocalPlayer) {
    const track = document.getElementById(spinnerId);
    if (!track) return;
    
    const container = track.parentElement;
    const centerPoint = container.offsetWidth / 2;
    let localLastTickIndex = -1;

    function update() {
        const style = window.getComputedStyle(track);
        const transform = style.transform || style.webkitTransform;
        
        if (!transform || transform === 'none') {
            requestAnimationFrame(update);
            return;
        }

        const matrix = new WebKitCSSMatrix(transform);
        const translateX = matrix.m41;
        const currentIndex = Math.floor((Math.abs(translateX) + centerPoint) / 170);

        // SOM: Só toca se for o jogador local
        if (currentIndex !== localLastTickIndex) {
            localLastTickIndex = currentIndex;
            if (isLocalPlayer) {
                playTick(); 
            }
        }

        // VISUAL: O highlight continua para ambos (para sabermos onde a roleta do outro está)
        const nodes = track.querySelectorAll('.item-node');
        nodes.forEach((node, index) => {
            const nodeLeft = (index * 170) + translateX;
            const nodeRight = nodeLeft + 170;
            if (centerPoint >= nodeLeft && centerPoint <= nodeRight) {
                node.classList.add('active-center');
            } else {
                node.classList.remove('active-center');
            }
        });

        if (style.transitionProperty.includes('transform')) {
            requestAnimationFrame(update);
        }
    }
    requestAnimationFrame(update);
}

async function logout() { await fetch('/api/logout', {method: 'POST'}); location.reload(); }

// Listen for Live Drops
socket.on('newLiveDrop', (data) => {
    const track = document.getElementById('live-drops-track');
    if (!track) return;

    const drop = document.createElement('div');
    drop.className = 'drop-item';
    drop.style.setProperty('--item-color', data.item.color);
    // Adiciona evento de clique para abrir perfil
    drop.onclick = () => openProfileModal(data.steamId);
    drop.style.cursor = "pointer";
    
    drop.innerHTML = `
        <img src="${data.item.img}">
        <div class="drop-info">
            <b>${data.item.name}</b>
            <small>${data.user}</small>
        </div>
    `;

    track.prepend(drop);
    if (track.children.length > 15) track.removeChild(track.lastChild);
});
// Update Online Count
socket.on('updateOnlineCount', (count) => {
    const el = document.getElementById('users-online');
    if (el) el.innerText = count;
});
// ===================== GRÁFICO DO HISTÓRICO DE SALDO =====================
// Usado nas Settings (o teu saldo) e no painel de perfil (só admins veem o de outro jogador).
const BH_UP = '#4fe8b0';
const BH_DOWN = '#ff5d6c';
const BH_MAX_POINTS = 300;

function bhFormatTime(t) {
    return new Date(t).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

// Lifetime: usa todos os pontos; se forem muitos, reduz para o gráfico ficar leve
function bhDownsample(arr, max) {
    if (arr.length <= max) return arr.slice();
    const out = [arr[0]];
    const step = (arr.length - 1) / (max - 1);
    for (let i = 1; i < max - 1; i++) out.push(arr[Math.round(i * step)]);
    out.push(arr[arr.length - 1]);
    return out;
}

const bhCharts = [];

function createBalanceChart(ids) {
    const chart = { all: [], points: [], hover: -1, geom: null, bound: false };
    const el = k => document.getElementById(ids[k]);

    chart.setData = function (all) {
        chart.all = all || [];
        chart.points = bhDownsample(chart.all, BH_MAX_POINTS);
        chart.hover = -1;
        chart.bind();
        chart.updateSummary();
        chart.draw();
    };

    chart.updateSummary = function () {
        const sub = el('sub'), chg = el('change');
        if (!sub || !chg) return;
        const all = chart.all;
        if (all.length < 2) {
            sub.innerText = all.length ? `Current: $${formatCurrency(all[0].b)}` : '—';
            chg.className = 'bh-change';
            chg.innerHTML = '—';
            return;
        }
        const first = all[0].b;
        const last = all[all.length - 1].b;
        const diff = last - first;
        const pct = first > 0 ? (diff / first) * 100 : 0;
        const up = diff >= 0;
        sub.innerText = `Lifetime · Current: $${formatCurrency(last)} · ${all.length} changes`;
        chg.className = 'bh-change ' + (diff === 0 ? '' : (up ? 'up' : 'down'));
        chg.innerHTML = `${up ? '▲ +' : '▼ -'}$${formatCurrency(Math.abs(diff))}<small>${up ? '+' : '-'}${Math.abs(pct).toFixed(1)}%</small>`;
    };

    chart.draw = function () {
        const canvas = el('canvas');
        const empty = el('empty');
        if (!canvas) return;

        const wrap = canvas.parentElement;
        const W = wrap.clientWidth;
        const H = wrap.clientHeight;
        if (!W || !H) return; // escondido

        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.round(W * dpr);
        canvas.height = Math.round(H * dpr);
        const ctx = canvas.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, W, H);

        const pts = chart.points;
        if (pts.length < 2) {
            if (empty) empty.style.display = 'flex';
            chart.geom = null;
            return;
        }
        if (empty) empty.style.display = 'none';

        const padL = 62, padR = 12, padT = 12, padB = 24;
        const cw = W - padL - padR;
        const ch = H - padT - padB;

        let min = Math.min(...pts.map(p => p.b));
        let max = Math.max(...pts.map(p => p.b));
        if (min === max) { min -= 1; max += 1; }
        const pad = (max - min) * 0.1;
        min -= pad; max += pad;

        const xAt = i => padL + (i / (pts.length - 1)) * cw;
        const yAt = v => padT + (1 - (v - min) / (max - min)) * ch;

        // Grelha + labels do eixo Y
        ctx.font = '11px Outfit, sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        for (let g = 0; g <= 4; g++) {
            const v = min + ((max - min) * g) / 4;
            const y = yAt(v);
            ctx.strokeStyle = 'rgba(255,255,255,0.06)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(padL, y);
            ctx.lineTo(W - padR, y);
            ctx.stroke();
            ctx.fillStyle = 'rgba(235,240,255,0.45)';
            ctx.fillText('$' + formatCurrency(v), padL - 8, y);
        }

        // Eixo X: primeiro e último ponto
        ctx.fillStyle = 'rgba(235,240,255,0.45)';
        ctx.textBaseline = 'alphabetic';
        ctx.textAlign = 'left';
        ctx.fillText(bhFormatTime(pts[0].t), padL, H - 6);
        ctx.textAlign = 'right';
        ctx.fillText(bhFormatTime(pts[pts.length - 1].t), W - padR, H - 6);

        // Verde quando sobe, vermelho quando desce
        const baseY = padT + ch;
        for (let i = 1; i < pts.length; i++) {
            const up = pts[i].b >= pts[i - 1].b;
            const x0 = xAt(i - 1), y0 = yAt(pts[i - 1].b);
            const x1 = xAt(i), y1 = yAt(pts[i].b);

            const grad = ctx.createLinearGradient(0, Math.min(y0, y1), 0, baseY);
            grad.addColorStop(0, up ? 'rgba(79,232,176,0.22)' : 'rgba(255,93,108,0.22)');
            grad.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.moveTo(x0, baseY);
            ctx.lineTo(x0, y0);
            ctx.lineTo(x1, y1);
            ctx.lineTo(x1, baseY);
            ctx.closePath();
            ctx.fill();

            ctx.strokeStyle = up ? BH_UP : BH_DOWN;
            ctx.lineWidth = 2.5;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(x0, y0);
            ctx.lineTo(x1, y1);
            ctx.stroke();
        }

        // Ponto final
        const lastUp = pts[pts.length - 1].b >= pts[pts.length - 2].b;
        ctx.fillStyle = lastUp ? BH_UP : BH_DOWN;
        ctx.beginPath();
        ctx.arc(xAt(pts.length - 1), yAt(pts[pts.length - 1].b), 4, 0, Math.PI * 2);
        ctx.fill();

        // Hover
        const hv = chart.hover;
        if (hv >= 0 && hv < pts.length) {
            const hx = xAt(hv), hy = yAt(pts[hv].b);
            ctx.strokeStyle = 'rgba(255,255,255,0.25)';
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(hx, padT);
            ctx.lineTo(hx, baseY);
            ctx.stroke();
            ctx.setLineDash([]);

            const hUp = hv === 0 ? true : pts[hv].b >= pts[hv - 1].b;
            ctx.fillStyle = '#0e1015';
            ctx.strokeStyle = hUp ? BH_UP : BH_DOWN;
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.arc(hx, hy, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        }

        chart.geom = { padL, padR, cw, W, xAt, yAt };
    };

    chart.handleMove = function (clientX) {
        const g = chart.geom;
        if (!g || chart.points.length < 2) return;
        const canvas = el('canvas');
        const tip = el('tip');
        const x = clientX - canvas.getBoundingClientRect().left;

        let idx = Math.round(((x - g.padL) / g.cw) * (chart.points.length - 1));
        idx = Math.max(0, Math.min(chart.points.length - 1, idx));
        chart.hover = idx;
        chart.draw();

        const p = chart.points[idx];
        const prev = idx > 0 ? chart.points[idx - 1] : null;
        let diffHtml = '';
        if (prev) {
            const d = p.b - prev.b;
            diffHtml = `<div class="${d >= 0 ? 'up' : 'down'}">${d >= 0 ? '▲ +' : '▼ -'}$${formatCurrency(Math.abs(d))}</div>`;
        }
        tip.innerHTML = `<b>$${formatCurrency(p.b)}</b>${diffHtml}<div style="color:#777">${bhFormatTime(p.t)}</div>`;
        tip.style.display = 'block';

        const px = g.xAt(idx);
        const tw = tip.offsetWidth;
        let left = px + 12;
        if (left + tw > g.W - 4) left = px - tw - 12;
        tip.style.left = Math.max(4, left) + 'px';
        tip.style.top = '8px';
    };

    chart.handleLeave = function () {
        chart.hover = -1;
        const tip = el('tip');
        if (tip) tip.style.display = 'none';
        chart.draw();
    };

    // Liga os eventos só quando o canvas existe (o painel de perfil vem depois deste script no HTML)
    chart.bind = function () {
        if (chart.bound) return;
        const canvas = el('canvas');
        if (!canvas) return;
        canvas.addEventListener('pointermove', e => chart.handleMove(e.clientX));
        canvas.addEventListener('pointerdown', e => chart.handleMove(e.clientX));
        canvas.addEventListener('pointerleave', chart.handleLeave);
        chart.bound = true;
    };

    bhCharts.push(chart);
    return chart;
}

window.addEventListener('resize', () => bhCharts.forEach(c => c.draw()));

// ---------- Settings: o teu próprio saldo ----------
const bhSettings = createBalanceChart({
    canvas: 'balance-chart', tip: 'bh-tooltip', empty: 'bh-empty', sub: 'bh-sub', change: 'bh-change'
});
let bhRefreshTimer = null;

async function loadBalanceHistory() {
    try {
        const res = await fetch('/api/balance-history?limit=20000');
        if (!res.ok) return;
        const data = await res.json();
        if (!data.success) return;
        bhSettings.setData(data.points);
    } catch (e) {
        console.log('Erro ao carregar histórico de saldo:', e);
    }
}

// Chamado quando o saldo muda; só atualiza se a aba Settings estiver aberta
function refreshBalanceHistorySoon() {
    const tab = document.getElementById('settings-tab');
    if (!tab || tab.style.display === 'none') return;
    clearTimeout(bhRefreshTimer);
    bhRefreshTimer = setTimeout(loadBalanceHistory, 1200);
}

// ---------- Settings (só admins): escolher um jogador e ver o gráfico dele ----------
let bhAdminPromise = null;
function bhIsAdmin() {
    if (!bhAdminPromise) {
        bhAdminPromise = fetch('/api/admin/me').then(r => r.json()).then(d => !!d.admin).catch(() => false);
    }
    return bhAdminPromise;
}

let bhAdminChart = null;
let bhAdminSelected = null;   // { steamId, username, ... }
let bhAdminToken = 0;
let bhAdminSearchTimer = null;

async function initAdminBalanceCard() {
    const card = document.getElementById('admin-balance-card');
    if (!card) return;
    if (!(await bhIsAdmin())) { card.style.display = 'none'; return; }
    card.style.display = 'block';

    if (!bhAdminChart) {
        bhAdminChart = createBalanceChart({
            canvas: 'abh-canvas', tip: 'abh-tooltip', empty: 'abh-empty', sub: 'abh-sub', change: 'abh-change'
        });
        const input = document.getElementById('abh-search');
        input.addEventListener('input', () => {
            clearTimeout(bhAdminSearchTimer);
            bhAdminSearchTimer = setTimeout(() => loadAdminUserList(input.value), 250);
        });
    }
    loadAdminUserList(document.getElementById('abh-search').value);
    if (bhAdminSelected) selectAdminPlayer(bhAdminSelected); // atualiza o gráfico do jogador já escolhido
}

async function loadAdminUserList(q) {
    const list = document.getElementById('abh-list');
    if (!list) return;
    try {
        const res = await fetch('/api/admin/users?q=' + encodeURIComponent(q || ''));
        if (!res.ok) return;
        const users = await res.json();

        list.innerHTML = '';
        if (!users.length) {
            const none = document.createElement('div');
            none.className = 'abh-none';
            none.textContent = 'No players found.';
            list.appendChild(none);
            return;
        }
        users.forEach(u => {
            const row = document.createElement('div');
            row.className = 'abh-row' + (bhAdminSelected && bhAdminSelected.steamId === u.steamId ? ' active' : '');
            row.dataset.steamid = u.steamId;

            const img = document.createElement('img');
            img.src = u.avatar || '';
            const name = document.createElement('span');
            name.className = 'abh-name';
            name.textContent = u.username || u.steamId;   // textContent: nomes vêm do Steam
            row.appendChild(img);
            row.appendChild(name);
            if (u.banned) {
                const tag = document.createElement('span');
                tag.className = 'abh-banned';
                tag.textContent = 'BANNED';
                row.appendChild(tag);
            }
            if (u.online) {
                const dot = document.createElement('span');
                dot.className = 'abh-dot';
                dot.title = 'Online';
                row.appendChild(dot);
            }
            const bal = document.createElement('span');
            bal.className = 'abh-bal';
            bal.textContent = '$' + formatCurrency(u.balance || 0);
            row.appendChild(bal);

            row.onclick = () => selectAdminPlayer(u);
            list.appendChild(row);
        });
    } catch (e) {
        console.log('Erro ao listar jogadores:', e);
    }
}

async function selectAdminPlayer(u) {
    bhAdminSelected = u;
    const token = ++bhAdminToken;

    document.querySelectorAll('#abh-list .abh-row').forEach(r => {
        r.classList.toggle('active', r.dataset.steamid === u.steamId);
    });
    const label = document.getElementById('abh-selected');
    label.textContent = 'Viewing: ';
    const b = document.createElement('b');
    b.textContent = u.username || u.steamId;
    label.appendChild(b);

    try {
        const res = await fetch('/api/admin/balance-history/' + encodeURIComponent(u.steamId) + '?limit=20000');
        if (!res.ok || token !== bhAdminToken) return;
        const data = await res.json();
        if (!data.success || token !== bhAdminToken) return;
        bhAdminChart.setData(data.points);
    } catch (e) {
        console.log('Erro ao carregar histórico do jogador:', e);
    }
}