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
function selectBDOption(val, text) {
    document.getElementById('selected-bd-inv').innerText = text;
    document.getElementById('bd-inv-options').classList.remove('show');
    bdSortMode = val;
    bdPage = 0;
    renderBeatDropInventory();
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
    if (!skin || skin.name === bdLastSkinId) return;

    const container = document.getElementById('bd-preview-container');
    const img = document.getElementById('bd-preview-img');
    const name = document.getElementById('bd-preview-name');
    const price = document.getElementById('bd-preview-price');

    // 1. Inicia animação de saída
    container.classList.add('skin-changing');

    setTimeout(() => {
        // 2. Troca os dados
        img.src = skin.img;
        name.innerText = skin.name;
        price.innerText = `$${formatCurrency(skin.price)}`;
        bdLastSkinId = skin.name;
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
    resetBDUI();
    renderBeatDropInventory();
    generateWaveform();
    
    const wrapper = document.getElementById('bd-wrapper');
    const targetEl = document.getElementById('bd-target');
    const profitZone = document.getElementById('bd-profit-zone');

    if (wrapper) {
        wrapper.onclick = (e) => {
            if (bdAnimationActive) return;
            
            const rect = wrapper.getBoundingClientRect();
            targetDropTime = ((e.clientX - rect.left) / rect.width) * 100;
            
            // Ambos usam o mesmo valor de 'left'
            if (targetEl) targetEl.style.left = targetDropTime + '%';
            if (profitZone) {
                profitZone.style.display = 'block';
                profitZone.style.left = targetDropTime + '%';
            }

            updateBDPreviewMultiplier(targetDropTime, targetDropTime);
        };
    }
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

async function loadSkinsForPreview() {
    const res = await fetch('/api/all-skins');
    allSkinsForPreview = await res.json();
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
        updateBDCentralSkin(data.totalValue * liveMult);
    } else {
        if (skinInfo) skinInfo.style.display = "none";
        if (placeholder) { placeholder.style.display = "block"; placeholder.style.opacity = "0.5"; }
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
    const itemBox = document.getElementById('bd-result-item-box'); // Container da Imagem
    const infoBox = document.querySelector('#bd-result-card .result-info'); // Container do Nome/Preço
    const titleEl = document.getElementById('bd-result-title');
    const multBadge = document.getElementById('bd-result-mult-badge');

    // Limpa o estado do jogo no fundo
    resetBDUI();

    if (!modal || !card) return;

    if (win && skin) {
        // --- ESTADO DE VITÓRIA ---
        card.className = "result-card result-win";
        titleEl.innerText = "SUCCESS!";
        multBadge.innerText = `${mult}x`;
        multBadge.style.display = "inline-block";

        // MOSTRA a skin e os detalhes
        if (itemBox) itemBox.style.display = "block";
        if (infoBox) infoBox.style.display = "block";

        document.getElementById('bd-result-img').src = skin.img;
        document.getElementById('bd-result-name').innerText = skin.name;
        document.getElementById('bd-result-price').innerText = `$${formatCurrency(skin.value)}`;
        document.getElementById('bd-result-badge').innerText = skin.conditionShort;

        if (upgradeWinSound) upgradeWinSound.play().catch(e => {});
    } else {
        // --- ESTADO DE DERROTA (LIMPO) ---
        card.className = "result-card result-loss";
        titleEl.innerText = "MISSED!";
        multBadge.innerText = `0.00x`;
        
        // ESCONDE TUDO o que tem a ver com skins
        if (itemBox) itemBox.style.display = "none";
        if (infoBox) {
            infoBox.style.display = "block"; // Mantemos o bloco mas mudamos o texto
            document.getElementById('bd-result-name').innerText = "UNLUCKY! TRY AGAIN.";
            document.getElementById('bd-result-price').innerText = ""; // Preço vazio
        }

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
async function toggleItemLock(itemId) {
    const res = await fetch('/api/toggle-lock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId })
    });
    const data = await res.json();
    if (data.success) {
        closeSkinModal();
        loadInventory(); // Recarrega para mostrar o ícone de cadeado
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
    const res = await fetch('/api/sell-item', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ itemId })
    });
    const data = await res.json();
    if(data.success) {
        updateBalanceUI(data.balance);
        closeSkinModal();
        loadInventory();
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
        const res = await fetch('/api/all-skins');
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


function renderBeatDropInventory() {
    const grid = document.getElementById('bd-inv-grid');
    if (!grid || !currentUser) return;

    let items = [...currentUser.inventory];

    // Ordenação igual ao Upgrade
    if (bdSortMode === 'high') items.sort((a, b) => b.value - a.value);
    else if (bdSortMode === 'low') items.sort((a, b) => a.value - b.value);
    else items.reverse();

    const start = bdPage * 9;
    const pageItems = items.slice(start, start + 9);

    grid.innerHTML = pageItems.map(item => {
        const isSelected = selectedBeatDropSkins.includes(item.id);
        return `
            <div class="up-card ${isSelected ? 'selected' : ''}" onclick="toggleBeatDropSkin('${item.id}')">
                <div class="badge cond-${item.conditionShort}">${item.conditionShort}</div>
                <img src="${item.img}">
                <b>${item.name}</b>
                <span>$${formatCurrency(item.value)}</span>
            </div>`;
    }).join('');

    renderBDPagination(items.length);
}

function renderBDPagination(total) {
    const container = document.getElementById('bd-pagination');
    const totalPages = Math.ceil(total / 9);
    if (totalPages <= 1) { container.innerHTML = ''; return; }
    let html = '';
    for (let i = 0; i < totalPages; i++) {
        html += `<button class="${i === bdPage ? 'active' : ''}" onclick="bdPage=${i}; renderBeatDropInventory();">${i + 1}</button>`;
    }
    container.innerHTML = html;
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
    } else {
        if (selectedBeatDropSkins.length < 5) selectedBeatDropSkins.push(id);
    }
    
    renderBeatDropInventory();
    document.getElementById('bd-count').innerText = `${selectedBeatDropSkins.length}/5`;
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
        <div class="modal-case-item" onclick="addCaseToBattle('${id}')">
            <img src="${data.img}">
            <div class="info">
                <b>${data.name}</b>
                <span>$${formatCurrency(data.price)}</span>
            </div>
        </div>
    `).join('');
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
function switchTab(id, el) {
    // Esconder todas as views
    document.querySelectorAll('.tab-view').forEach(t => t.style.display = 'none');
    // Remover active de todos os links
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    
    // Mostrar a view correta
    const target = document.getElementById(id);
    if(target) target.style.display = 'block';
    // Marcar botão como ativo
    if(el) el.classList.add('active');

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

// Atualize também a função showHome para manter a consistência
function showHome() {
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
        return alert("Max 20 cases per battle!");
    }
    selectedCasesForBattle.push(id);
    updateModalSelected();
}
function sellAllItems() {
    if (!currentUser || currentUser.inventory.length === 0) {
        return alert("Your inventory is already empty!");
    }
    document.getElementById('sell-all-modal').style.display = 'flex';
}

function closeSellAllModal() {
    closeModalWithAnim('sell-all-modal');
}
function openChangelog() {
    const modal = document.getElementById('changelog-modal');
    modal.style.display = 'flex';
}

function closeChangelog() {
    // Usamos a função de animação que já tens no site
    closeModalWithAnim('changelog-modal');
}
async function confirmSellAll() {
    const btn = document.getElementById('confirm-sell-all-btn');
    const mainBtn = document.getElementById('btn-sell-all');
    
    btn.classList.add('btn-loading');
    btn.disabled = true;

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
        btn.classList.remove('btn-loading');
        btn.disabled = false;
    }
}

// Função para filtrar as caixas no modal
function filterBattleCases() {
    const term = document.getElementById('battle-case-search').value.toLowerCase();
    const cards = document.querySelectorAll('.modal-case-item');
    
    cards.forEach(card => {
        const name = card.getAttribute('data-name').toLowerCase();
        card.style.display = name.includes(term) ? 'flex' : 'none';
    });
}
function updateModalSelected() {
    const container = document.getElementById('modal-selected-cases');
    let total = 0;
    container.innerHTML = selectedCasesForBattle.map((id, index) => {
        total += itemsData[id].price;
        return `
            <div class="selected-item">
                <img src="${itemsData[id].img}" style="width: 20px; margin-right: 5px;">
                ${itemsData[id].name} 
                <span onclick="selectedCasesForBattle.splice(${index},1);updateModalSelected()">×</span>
            </div>`;
    }).join('');
    
    // Atualiza o texto do preço total e a contagem (Ex: Battle Cases 5/20)
    document.getElementById('total-battle-price').innerText = `$${formatCurrency(total)}`;
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

function addWonItemToArena(playerNum, item) {
    const inv = document.getElementById(`p${playerNum}-inventory`);
    const nameData = parseSkinName(item.name);
    
    const itemCard = document.createElement('div');
    itemCard.className = 'won-item-card anim-entry';
    
    // Define a cor para o CSS usar no brilho e na borda
    itemCard.style.setProperty('--rarity-color', item.color); 

    itemCard.innerHTML = `
        <div class="card-img-wrap">
            <img src="${item.img || ''}">
        </div>
        <div class="card-details">
            <div class="weapon-type">${nameData.weapon}</div>
            <div class="skin-name">${nameData.skin}</div>
            <div class="skin-meta">${item.conditionShort}</div>
        </div>
        <div class="card-value">$${formatCurrency(item.value)}</div>
    `;
    
    inv.prepend(itemCard); 
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

        return `
            <div class="preview-item" style="border-color: ${item.color}">
                <img src="${item.img || ''}" style="width: 100%; height: 80px; object-fit: contain; margin-bottom: 10px;">
                <div class="preview-info">
                    <b style="font-size: 12px; display: block; height: 30px; overflow: hidden;">${item.name}</b>
                    <span style="display: block; margin-top: 5px; color: var(--accent); font-weight: 800;">$${priceDisplay}</span>
                    <small style="color: #666; display: block; margin-top: 5px;">${totalChance.toFixed(3)}% Drop</small>
                </div>
            </div>
        `;
    }).join('');
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
    trackCenterItem(spinnerId, isLocalPlayer); 
    spinSound.currentTime = 0;
    spinSound.play().catch(e => {});
    await new Promise(r => setTimeout(r, 5000));

    // Snap
    spinner.style.transition = 'transform 0.6s cubic-bezier(0.25, 1, 0.5, 1)';
    spinner.style.transform = `translateX(-${centerPrecisionX}px)`;
    const node = spinner.querySelector('.item-node[data-index="50"]');
    if(node) node.classList.add('is-winner');

    if (isSuperWin) {
        // Se for Super Spin, NÃO adicionamos o item ao inventário lateral ainda
        superLandSound.currentTime = 0;
        superLandSound.play().catch(e => {});
    } else {
        landSound.currentTime = 0;
        landSound.play().catch(e => {});
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
        spinSound.currentTime = 0;
    spinSound.play().catch(e => {}); 
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

        trackCenterItem(spinnerId, isLocalPlayer); // Religa o highlight
        await new Promise(r => setTimeout(r, 5000));

        spinner.style.transition = 'transform 0.6s cubic-bezier(0.25, 1, 0.5, 1)';
        spinner.style.transform = `translateX(-${centerPrecisionX}px)`;

        const finalNode = spinner.querySelector('.item-node[data-index="50"]');
        if(finalNode) finalNode.classList.add('is-winner', 'reveal-final'); 

        if(isBattle) {
            addWonItemToArena(playerNum, winnerData);
            showBattleGain(playerNum, winnerData.value);
        }

        landSound.currentTime = 0;
        landSound.play();
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

    list.innerHTML = battles.map(b => {
        const firstCaseId = b.caseIds[0];
        const firstCaseName = itemsData[firstCaseId] ? itemsData[firstCaseId].name : "Case";
        const totalCases = b.caseIds.length;
        const displayName = totalCases > 1 ? `${firstCaseName} +${totalCases - 1}` : firstCaseName;

        const p1Ava = b.player1.avatar;
        const p2Ava = 'https://api.dicebear.com/9.x/bottts/svg?seed=waiting';

        // CORREÇÃO: Verificar se o currentUser existe antes de tentar ler o ._id
        let actionButton = "";
        if (!currentUser) {
            actionButton = `<button class="btn-primary" disabled>LOGIN TO JOIN</button>`;
        } else if (b.player1.id === currentUser._id.toString()) {
            actionButton = '<span class="badge-yours">YOUR BATTLE</span>';
        } else {
            actionButton = `<button class="btn-primary" onclick="joinBattle('${b.id}', ${b.price})">JOIN $${formatCurrency(b.price)}</button>`;
        }

        return `
            <div class="battle-card">
                <div class="users">
                    <div class="avatar-stack">
                        <img src="${p1Ava}" class="p1-img">
                        <div class="vs-circle">VS</div>
                        <img src="${p2Ava}" class="p2-img grayscale">
                    </div>
                    <div class="user-info">
                        <b>${b.player1.username}</b>
                        <small>WAITING FOR PLAYER</small>
                    </div>
                </div>
                <div class="battle-details">
                    <small>${totalCases} CAIXA(S)</small><br>
                    <b style="color: var(--accent)">${displayName.toUpperCase()}</b>
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
        document.getElementById('cur-case-name').innerText = currentCase.name.toUpperCase();
        document.getElementById('cur-case-price').innerText = formatCurrency(casePrice);

        document.querySelectorAll('.timeline-case').forEach(el => el.classList.remove('active'));
        const currentStep = document.getElementById(`step-${i}`);
        if(currentStep) 
            currentStep.classList.add('active', 'passed');
        currentStep.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        document.getElementById('current-round').innerText = i + 1;

        spinSound.currentTime = 0; 
        spinSound.play().catch(e => {});

        await Promise.all([
            // Passamos o resultado da verificação amIPlayerX para o spin
            executeArenaSpin(1, 'p1-spinner', data.p1Rolls[i], casePrice, itemsPool, true, data.p1Rolls[i].isSuperSpin, amIPlayer1),
            executeArenaSpin(2, 'p2-spinner', data.p2Rolls[i], casePrice, itemsPool, true, data.p2Rolls[i].isSuperSpin, amIPlayer2)
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
// ===================== CATCH (pares / memória) =====================
let catchSortMode = 'newest';
let catchPage = 0;
let selectedCatchSkins = [];
let catchGame = null; // { tiles, matched:Set, openId, locked, offset, deadline, state }
let catchTimerInterval = null;
let catchFlashTimeout = null;

function catchIdleHTML() {
    return `
        <div id="catch-map-idle" class="catch-map-idle">
            <svg viewBox="0 0 24 24" width="46" height="46" fill="none" stroke="#2a2f3d" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="13" width="8" height="8" rx="2"/><path d="M13 7h8M3 17h8"/></svg>
            <span>Select your skins and start</span>
            <small>All cards are face down. Flip two to find identical skins. Each pair raises your multiplier. Too many misses or no time left = you lose everything.</small>
        </div>`;
}

// ---------- inventário ----------
function selectCatchOption(val, text) {
    document.getElementById('selected-catch-inv').innerText = text;
    document.getElementById('catch-inv-options').classList.remove('show');
    catchSortMode = val;
    catchPage = 0;
    renderCatchInventory();
}

function renderCatchInventory() {
    const grid = document.getElementById('catch-inv-grid');
    if (!grid || !currentUser) return;

    let items = [...currentUser.inventory];
    if (catchSortMode === 'high') items.sort((a, b) => b.value - a.value);
    else if (catchSortMode === 'low') items.sort((a, b) => a.value - b.value);
    else items.reverse();

    const start = catchPage * 9;
    const pageItems = items.slice(start, start + 9);
    const busy = !!catchGame;

    grid.innerHTML = pageItems.map(item => {
        const isSelected = selectedCatchSkins.includes(item.id);
        const equipped = item.equippedTeam > 0;
        const dim = equipped || busy ? 'opacity:0.35; pointer-events:none;' : '';
        return `
            <div class="up-card ${isSelected ? 'selected' : ''}" style="${dim}" title="${equipped ? 'Equipped in CS2 loadout' : ''}" onclick="toggleCatchSkin('${item.id}')">
                <div class="badge cond-${item.conditionShort}">${item.conditionShort}</div>
                <img src="${item.img}">
                <b>${item.name}</b>
                <span>$${formatCurrency(item.value)}</span>
            </div>`;
    }).join('');

    const container = document.getElementById('catch-pagination');
    const totalPages = Math.ceil(items.length / 9);
    if (totalPages <= 1) { container.innerHTML = ''; }
    else {
        let html = '';
        for (let i = 0; i < totalPages; i++) {
            html += `<button class="${i === catchPage ? 'active' : ''}" onclick="catchPage=${i}; renderCatchInventory();">${i + 1}</button>`;
        }
        container.innerHTML = html;
    }
    updateCatchBetUI();
}

function toggleCatchSkin(id) {
    if (catchGame) return;
    const idx = selectedCatchSkins.indexOf(id);
    if (idx > -1) selectedCatchSkins.splice(idx, 1);
    else if (selectedCatchSkins.length < 5) selectedCatchSkins.push(id);
    renderCatchInventory();
}

function catchBetValue() {
    if (!currentUser) return 0;
    return currentUser.inventory
        .filter(i => selectedCatchSkins.includes(i.id))
        .reduce((sum, i) => sum + i.value, 0);
}

function updateCatchBetUI() {
    const countEl = document.getElementById('catch-count');
    if (countEl) countEl.innerText = `${selectedCatchSkins.length}/5`;
    if (!catchGame) updateCatchPreview(catchBetValue());
}

function updateCatchPreview(value) {
    const empty = document.getElementById('catch-preview-empty');
    const box = document.getElementById('catch-preview-box');
    if (!empty || !box) return;
    const skin = value > 0 ? getClosestSkinLocal(value) : null;
    if (!skin) {
        empty.style.display = 'block';
        box.style.display = 'none';
        return;
    }
    empty.style.display = 'none';
    box.style.display = 'flex';
    document.getElementById('catch-preview-img').src = skin.img;
    document.getElementById('catch-preview-name').innerText = skin.name;
    document.getElementById('catch-preview-price').innerText = `$${formatCurrency(skin.price)}`;
}

function catchFlash(text, color) {
    const el = document.getElementById('catch-flash');
    if (!el) return;
    el.innerText = text;
    el.style.color = color || '#fff';
    el.classList.add('show');
    clearTimeout(catchFlashTimeout);
    catchFlashTimeout = setTimeout(() => el.classList.remove('show'), 1400);
}

// ---------- ciclo do jogo ----------
async function initCatch() {
    renderCatchInventory();
    if (catchGame) return; // jogo já a decorrer, não mexer no mapa
    try {
        const res = await fetch('/api/catch/state');
        const data = await res.json();
        if (data.active) {
            beginCatch(data.tiles, data.state, data.matched, data.opened);
        } else if (data.over) {
            showCatchResult(false, null, 0, 'time');
            loadInventory();
        }
    } catch (e) { /* sem jogo ativo */ }
}

async function startCatchGame() {
    if (catchGame) return;
    if (selectedCatchSkins.length === 0) return catchFlash('Select at least 1 skin', '#ffb703');

    const btn = document.getElementById('catch-start-btn');
    btn.disabled = true;
    try {
        const res = await fetch('/api/catch/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ itemIds: selectedCatchSkins })
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
            btn.disabled = false;
            return catchFlash(data.error || 'Could not start', '#eb4b4b');
        }
        currentUser.inventory = data.inventory;
        selectedCatchSkins = [];
        beginCatch(data.tiles, data.state, [], null);
    } catch (e) {
        btn.disabled = false;
        catchFlash('Connection error', '#eb4b4b');
    }
}

function beginCatch(tiles, state, matched, opened) {
    catchGame = {
        tiles,
        matched: new Set((matched || []).map(m => m.id)),
        openId: opened ? opened.id : null,
        locked: false,
        offset: state.now - Date.now(),
        deadline: state.deadline,
        state
    };

    document.getElementById('catch-start-btn').style.display = 'none';
    document.getElementById('catch-cash-btn').style.display = 'block';

    renderCatchMap();
    // cartas que já estavam reveladas (jogo retomado)
    (matched || []).forEach(m => revealCatchTile(m.id, m.img, m.name, false));
    if (opened) revealCatchTile(opened.id, opened.img, opened.name, false);

    applyCatchState(state);
    renderCatchInventory();

    clearInterval(catchTimerInterval);
    catchTimerInterval = setInterval(catchTick, 100);
}

function renderCatchMap() {
    const map = document.getElementById('catch-map');
    map.innerHTML = catchGame.tiles.map(t => `
        <div class="catch-tile ${catchGame.matched.has(t.id) ? 'matched' : ''}" id="catch-tile-${t.id}"
             style="left:${t.x}%; top:${t.y}%; --rot:${t.rot}deg;" onclick="clickCatchTile(${t.id})">
            <div class="catch-card">
                <div class="catch-face catch-back"><span>?</span></div>
                <div class="catch-face catch-front"><img src="" draggable="false" alt=""></div>
            </div>
        </div>`).join('');
}

function revealCatchTile(id, img, name, animate = true) {
    const tile = document.getElementById(`catch-tile-${id}`);
    if (!tile) return;
    const image = tile.querySelector('.catch-front img');
    image.src = img;
    image.alt = name || '';
    tile.title = name || '';
    tile.classList.add('flipped');
}

function hideCatchTile(id) {
    const tile = document.getElementById(`catch-tile-${id}`);
    if (!tile) return;
    tile.classList.remove('flipped');
    // só apaga a foto depois de a carta voltar a ficar de costas
    setTimeout(() => {
        if (!tile.classList.contains('flipped')) {
            tile.querySelector('.catch-front img').src = '';
            tile.title = '';
        }
    }, 450);
}

function applyCatchState(state) {
    catchGame.state = state;
    catchGame.deadline = state.deadline;
    catchGame.offset = state.now - Date.now();

    const multEl = document.getElementById('catch-mult');
    multEl.innerText = state.multiplier.toFixed(2) + 'x';
    multEl.classList.remove('bump'); void multEl.offsetWidth; multEl.classList.add('bump');

    document.getElementById('catch-pairs').innerText = state.pairs;

    const missEl = document.getElementById('catch-misses');
    missEl.innerText = `${state.misses}/${state.maxMisses}`;
    missEl.style.color = state.misses >= state.maxMisses - 2 ? '#eb4b4b' : '#fff';

    const potential = state.betValue * state.multiplier;
    const cashBtn = document.getElementById('catch-cash-btn');
    const minPairs = state.minPairs || 1;
    cashBtn.disabled = state.pairs < minPairs;
    cashBtn.querySelector('span').innerHTML = state.pairs < minPairs
        ? `<small>CASH OUT LOCKED</small><b>MATCH ${minPairs} ${minPairs === 1 ? 'PAIR' : 'PAIRS'}</b>`
        : `<small>CASH OUT</small><b>$${formatCurrency(potential)}</b>`;

    updateCatchPreview(potential);
}

function catchTick() {
    if (!catchGame) return;
    const remaining = catchGame.deadline - (Date.now() + catchGame.offset);
    const timeEl = document.getElementById('catch-time');
    const fill = document.getElementById('catch-timebar-fill');

    if (remaining <= 0) {
        timeEl.innerText = '0.0s';
        fill.style.width = '0%';
        clearInterval(catchTimerInterval);
        catchTimeout();
        return;
    }
    timeEl.innerText = (remaining / 1000).toFixed(1) + 's';
    timeEl.style.color = remaining < 10000 ? '#eb4b4b' : '#fff';
    fill.style.width = Math.min(100, (remaining / 60000) * 100) + '%';
}

async function catchTimeout() {
    if (!catchGame) return;
    catchGame.locked = true;
    try {
        // O servidor dá 1s de tolerância; confirma o fim do jogo
        for (let i = 0; i < 4; i++) {
            const res = await fetch('/api/catch/state');
            const data = await res.json();
            if (!data.active) return finishCatch({ win: false, reason: 'time' });
            if (data.state && data.state.deadline > Date.now() + catchGame.offset) {
                // relógio dessincronizado: o servidor ainda tem tempo, retoma
                applyCatchState(data.state);
                catchGame.locked = false;
                catchTimerInterval = setInterval(catchTick, 100);
                return;
            }
            await new Promise(r => setTimeout(r, 400));
        }
    } catch (e) { /* ignora */ }
    finishCatch({ win: false, reason: 'time' });
}

const catchWait = ms => new Promise(r => setTimeout(r, ms));

async function clickCatchTile(id) {
    if (!catchGame || catchGame.locked || catchGame.matched.has(id) || catchGame.openId === id) return;
    catchGame.locked = true;

    try {
        const res = await fetch('/api/catch/flip', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
        });
        const data = await res.json();

        if (!res.ok) {
            catchGame.locked = false;
            return catchFlash(data.error || 'Invalid move', '#ffb703');
        }
        if (data.over && data.reason === 'time') return finishCatch(data);

        // 1ª carta do par
        if (data.opened) {
            revealCatchTile(id, data.opened.img, data.opened.name);
            catchGame.openId = id;
            applyCatchState(data.state);
            catchGame.locked = false;
            return;
        }

        // 2ª carta do par
        revealCatchTile(id, data.second.img, data.second.name);
        const [firstId, secondId] = data.ids;
        catchGame.openId = null;

        if (data.correct) {
            await catchWait(550);
            data.ids.forEach(i => {
                catchGame.matched.add(i);
                document.getElementById(`catch-tile-${i}`).classList.add('matched');
            });
            if (typeof upgradeWinSound !== 'undefined') { upgradeWinSound.currentTime = 0; upgradeWinSound.play().catch(() => {}); }
            if (data.over) return finishCatch(data);
            applyCatchState(data.state);
            catchFlash('+ PAIR!', '#00ff88');
        } else {
            [firstId, secondId].forEach(i => document.getElementById(`catch-tile-${i}`).classList.add('wrong'));
            await catchWait(950);
            [firstId, secondId].forEach(i => {
                const t = document.getElementById(`catch-tile-${i}`);
                if (t) t.classList.remove('wrong');
                hideCatchTile(i);
            });
            if (typeof upgradeLossSound !== 'undefined') { upgradeLossSound.currentTime = 0; upgradeLossSound.play().catch(() => {}); }
            if (data.over) return finishCatch(data);
            applyCatchState(data.state);
            catchFlash('NO MATCH', '#eb4b4b');
        }
        if (catchGame) catchGame.locked = false;
    } catch (e) {
        if (catchGame) catchGame.locked = false;
        catchFlash('Connection error', '#eb4b4b');
    }
}

async function cashOutCatch() {
    if (!catchGame || catchGame.locked || catchGame.state.pairs < (catchGame.state.minPairs || 1)) return;
    catchGame.locked = true;
    try {
        const res = await fetch('/api/catch/cashout', { method: 'POST' });
        const data = await res.json();
        if (!res.ok) {
            catchGame.locked = false;
            return catchFlash(data.error || 'Could not cash out', '#eb4b4b');
        }
        finishCatch(data);
    } catch (e) {
        catchGame.locked = false;
        catchFlash('Connection error', '#eb4b4b');
    }
}

function finishCatch(data) {
    clearInterval(catchTimerInterval);
    if (data.inventory && currentUser) currentUser.inventory = data.inventory;
    catchGame = null;
    selectedCatchSkins = [];

    // repõe o ecrã
    document.getElementById('catch-start-btn').style.display = 'block';
    document.getElementById('catch-start-btn').disabled = false;
    document.getElementById('catch-cash-btn').style.display = 'none';
    document.getElementById('catch-mult').innerText = '1.00x';
    document.getElementById('catch-pairs').innerText = '0';
    const missEl = document.getElementById('catch-misses');
    missEl.innerText = '0/6';
    missEl.style.color = '#fff';
    document.getElementById('catch-time').innerText = '--';
    document.getElementById('catch-time').style.color = '#fff';
    document.getElementById('catch-timebar-fill').style.width = '0%';
    document.getElementById('catch-map').innerHTML = catchIdleHTML();

    showCatchResult(!!data.win, data.skin || null, data.multiplier || 0, data.reason);
    renderCatchInventory();
    if (typeof loadInventory === 'function') loadInventory();
}

function showCatchResult(win, skin, mult, reason) {
    const modal = document.getElementById('catch-result-modal');
    const card = document.getElementById('catch-result-card');
    if (!modal || !card) return;

    const itemBox = document.getElementById('catch-result-item-box');
    const titleEl = document.getElementById('catch-result-title');
    const multBadge = document.getElementById('catch-result-mult-badge');

    if (win && skin) {
        card.className = 'result-card result-win';
        titleEl.innerText = reason === 'cleared' ? 'MAP CLEARED!' : 'CASHED OUT!';
        multBadge.innerText = `${Number(mult).toFixed(2)}x`;
        multBadge.style.display = 'inline-block';
        itemBox.style.display = 'block';
        document.getElementById('catch-result-img').src = skin.img;
        document.getElementById('catch-result-name').innerText = skin.name;
        document.getElementById('catch-result-price').innerText = `$${formatCurrency(skin.value)}`;
        document.getElementById('catch-result-badge').innerText = skin.conditionShort;
        if (typeof upgradeWinSound !== 'undefined') upgradeWinSound.play().catch(() => {});
    } else {
        card.className = 'result-card result-loss';
        titleEl.innerText = reason === 'misses' ? 'TOO MANY MISSES!' : "TIME'S UP!";
        multBadge.innerText = '0.00x';
        itemBox.style.display = 'none';
        document.getElementById('catch-result-name').innerText = 'YOU LOST YOUR SKINS. TRY AGAIN.';
        document.getElementById('catch-result-price').innerText = '';
        if (typeof upgradeLossSound !== 'undefined') upgradeLossSound.play().catch(() => {});
    }
    modal.style.display = 'flex';
}
// ===================== FIM CATCH =====================

// ===================== GRÁFICO DO HISTÓRICO DE SALDO =====================
// Usado nas Settings (o teu saldo) e no painel de perfil (só admins veem o de outro jogador).
const BH_UP = '#00ff88';
const BH_DOWN = '#ff4444';
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
            ctx.fillStyle = '#666';
            ctx.fillText('$' + formatCurrency(v), padL - 8, y);
        }

        // Eixo X: primeiro e último ponto
        ctx.fillStyle = '#666';
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
            grad.addColorStop(0, up ? 'rgba(0,255,136,0.20)' : 'rgba(255,68,68,0.20)');
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