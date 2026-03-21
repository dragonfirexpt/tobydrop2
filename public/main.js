const socket = io();
let currentUser = null;
let activeCaseId = 'gold';
const NODE_WIDTH = 170;

const winSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3');
winSound.volume = 0.25; // Set volume to 50%
const spinSound = new Audio('/assets/spinner.mp3');
const landSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3');
const superLandSound = new Audio('/assets/super_spin_land.mp3');
superLandSound.volume = 0.5;
const upgradeStartSound = new Audio('/assets/upgrade.mp3');
const upgradeWinSound = new Audio('/assets/upgrade_win.mp3');
const upgradeLossSound = new Audio('/assets/upgrade_lose.mp3');
upgradeLossSound.volume = 0.3;
upgradeWinSound.volume = 0.3;
upgradeStartSound.volume = 0.3;
spinSound.volume = 0.5;
landSound.volume = 0.3;
// No topo do main.js
let itemsData = {}; 
let cases = {}; 

let currentCrashState = null;
let selectedCasesForBattle = [];
let upgraderState = {
    allSkins: [],
    selectedInputs: [], // DEVE ser um array vazio
    selectedTarget: null
};
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
                <div class="badge">${item.conditionShort}</div>
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
    const isShowing = options.classList.contains('show');

    // Fechar todos antes de abrir um novo
    document.querySelectorAll('.dropdown-options').forEach(el => el.classList.remove('show'));
    document.querySelectorAll('.dropdown-selected').forEach(el => el.classList.remove('active'));

    if (!isShowing) {
        options.classList.add('show');
        options.previousElementSibling.classList.add('active');
    }
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

    const dash = (chance / 100) * 283;
    slice.style.strokeDasharray = `${dash} 283`;
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
function formatCurrency(num) {
    return Number(num).toLocaleString('pt-PT', { 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2 
    });
}

socket.on('crashTick', (state) => {
    currentCrashState = state;
    const multText = document.getElementById('crash-multiplier');
    const statusText = document.getElementById('crash-status');
    const btn = document.getElementById('crash-btn');
    const fill = document.getElementById('crash-progress-fill');

    if (state.status === 'waiting') {
        multText.style.color = 'white';
        multText.innerText = `${state.timer.toFixed(1)}s`;
        statusText.innerText = "PREPARING...";
        btn.innerText = "PLACE BET";
        btn.disabled = false;
        btn.classList.remove('btn-danger');
        fill.style.width = `${(state.timer / 10) * 100}%`;
    } else if (state.status === 'running') {
        multText.innerText = `${state.multiplier.toFixed(2)}x`;
        multText.style.color = 'var(--accent)';
        statusText.innerText = "ROCKET IS FLYING...";
        fill.style.width = '0%';
        
        const myBet = state.bets.find(b => b.userId === currentUser._id && !b.cashedOut);
        if (myBet) {
            btn.innerText = `CASH OUT ($${(myBet.amount * state.multiplier).toFixed(2)})`;
            btn.classList.add('btn-danger');
            btn.disabled = false;
        } else {
            btn.disabled = true;
        }
    } else if (state.status === 'crashed') {
        multText.innerText = `CRASHED @ ${state.multiplier.toFixed(2)}x`;
        multText.style.color = '#ff4444';
        statusText.innerText = "BOOM!";
        btn.disabled = true;
    }

    // Update player list
    const playerList = document.getElementById('crash-players');
    playerList.innerHTML = state.bets.map(b => `
        <div class="crash-player-row ${b.cashedOut ? 'cashed' : ''}">
            <img src="${b.avatar}">
            <span>${b.username}</span>
            <b>$${b.amount}</b>
            ${b.cashedOut ? `<small>+ $${b.payout.toFixed(2)}</small>` : ''}
        </div>
    `).join('');
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
    
    // --- ATUALIZAÇÃO AQUI ---
    const sortType = filters.battleSort; 
    
    let entries = Object.entries(itemsData);

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
    const tabs = document.querySelectorAll('.tab-view');
    tabs.forEach(t => {
        t.style.display = 'none';
    });

    const targetTab = document.getElementById(id);
    if (targetTab) {
        targetTab.style.display = 'block';
        // O CSS cuidará do "fade in" automaticamente ao mudar para display: block
    }

    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    if (el) el.classList.add('active');
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
    
    socket.emit('createBattle', {
        userId: currentUser._id,
        caseIds: selectedCasesForBattle,
        isBot: isBot
    });
    closeBattleModal();
}
function renderHomeCases() {
    const gridHot = document.getElementById('grid-hot');
    const gridElite = document.getElementById('grid-elite');

    if (!gridHot || !gridElite) return;

    gridHot.innerHTML = '';
    gridElite.innerHTML = '';

    Object.keys(itemsData).forEach(id => {
        const caseInfo = itemsData[id];
        const cardHtml = `
            <div class="case-card-premium" onclick="selectCase('${id}')">
                ${caseInfo.tag ? `<div class="case-card-tag ${caseInfo.tag.toLowerCase()}">${caseInfo.tag}</div>` : ''}
                <div class="case-img-wrap">
                    <img src="${caseInfo.img}" alt="${caseInfo.name}">
                </div>
                <h3>${caseInfo.name}</h3>
                <div class="case-card-price">$${formatCurrency(caseInfo.price)}</div>
            </div>
        `;

        // Adiciona à secção HOT se tiver a tag HOT
        if (caseInfo.tag === 'HOT') {
            gridHot.innerHTML += cardHtml;
        } 
        
        // Adiciona à secção ELITE se tiver a tag ELITE ou custar mais de $50
        if (caseInfo.tag === 'ELITE' || caseInfo.price >= 50) {
            gridElite.innerHTML += cardHtml;
        }
    });

    // Esconde a secção inteira se estiver vazia
    document.getElementById('grid-hot').parentElement.style.display = gridHot.innerHTML === '' ? 'none' : 'block';
    document.getElementById('grid-elite').parentElement.style.display = gridElite.innerHTML === '' ? 'none' : 'block';
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

function switchTab(id, el) {
    document.querySelectorAll('.tab-view').forEach(t => t.style.display = 'none');
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    document.getElementById(id).style.display = 'block';
    if(el) el.classList.add('active');
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
async function executeArenaSpin(playerNum, spinnerId, winnerData, casePrice, itemsPool, isBattle = false) {
    const spinner = document.getElementById(spinnerId);
    if (!spinner) return;

    const containerWidth = spinner.parentElement.offsetWidth;
    const centerPrecisionX = (50 * NODE_WIDTH) - (containerWidth / 2) + (NODE_WIDTH / 2);
    const targetX = centerPrecisionX + (Math.random() * 60 - 30);

    const isSuperWin = winnerData.value >= (casePrice * 2.5);

    // 1. Reset e Início
    spinner.style.transition = 'none';
    spinner.style.transform = 'translateX(0)';
    renderTrack(spinnerId, winnerData.track); 
    await new Promise(r => setTimeout(r, 50));

    // Giro 1
    spinner.style.transition = 'transform 5s cubic-bezier(0.05, 0, 0, 1)';
    spinner.style.transform = `translateX(-${targetX}px)`;
    trackCenterItem(spinnerId);
    spinSound.currentTime = 0;
    spinSound.play().catch(e => {});
    await new Promise(r => setTimeout(r, 5000));

    // Snap
    spinner.style.transition = 'transform 0.6s cubic-bezier(0.25, 1, 0.5, 1)';
    spinner.style.transform = `translateX(-${centerPrecisionX}px)`;
    const node = spinner.querySelector('.item-node[data-index="50"]');
    if(node) node.classList.add('is-winner');

    // Som e Interface Inicial
    if (isSuperWin) {
        superLandSound.currentTime = 0;
        superLandSound.play().catch(e => {});
    } else {
        landSound.currentTime = 0;
        landSound.play().catch(e => {});
        // Revela info se for comum
        if(node) node.classList.add('reveal-final');
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

        trackCenterItem(spinnerId); // Religa o highlight
        await new Promise(r => setTimeout(r, 5000));

        spinner.style.transition = 'transform 0.6s cubic-bezier(0.25, 1, 0.5, 1)';
        spinner.style.transform = `translateX(-${centerPrecisionX}px)`;

        const finalNode = spinner.querySelector('.item-node[data-index="50"]');
        if(finalNode) {
            finalNode.classList.add('is-winner', 'reveal-final'); 
        }

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
    
    if (currentUser.balance < caseInfo.price) return alert("Not enough credits!");
    
    btn.classList.add('btn-loading');
    btn.disabled = true;

    try {
        const res = await fetch('/api/open-case', {
            method: 'POST', 
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ caseId: activeCaseId })
        });
        const data = await res.json();

        // 1. Deduz o saldo da interface antes de girar
        updateBalanceUI(data.balanceAfterDeduction);

        // 2. Chama a função que faz o giro (e o Super Spin se necessário)
        // Passamos 'spinner' porque é o ID do nó no modo individual
        await executeArenaSpin(1, 'spinner', {
            ...data.winner,
            track: data.track
        }, caseInfo.price, caseInfo.items);

        // 3. Finaliza
        updateBalanceUI(data.finalBalance);
        loadInventory();
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

socket.on('updateBattles', (battles) => {
    const list = document.getElementById('battle-list');
    if (!list) return;

    list.innerHTML = battles.map(b => {
        const firstCaseId = b.caseIds[0];
        const firstCaseName = itemsData[firstCaseId] ? itemsData[firstCaseId].name : "Case";
        const totalCases = b.caseIds.length;
        const displayName = totalCases > 1 ? `${firstCaseName} +${totalCases - 1}` : firstCaseName;

        // Avatar logic for the lobby
        const p1Ava = b.player1.avatar;
        const p2Ava = 'https://api.dicebear.com/9.x/bottts/svg?seed=waiting';

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
                    ${b.player1.id !== currentUser._id ? 
                        `<button class="btn-primary" onclick="joinBattle('${b.id}', ${b.price})">JOIN $${formatCurrency(b.price)}</button>` : 
                        '<span class="badge-yours">YOUR BATTLE</span>'}
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
            executeArenaSpin(1, 'p1-spinner', data.p1Rolls[i], casePrice, itemsPool, true),
            executeArenaSpin(2, 'p2-spinner', data.p2Rolls[i], casePrice, itemsPool, true)
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
function trackCenterItem(spinnerId) {
    const track = document.getElementById(spinnerId);
    if (!track) return;
    
    const container = track.parentElement;
    const centerPoint = container.offsetWidth / 2;

    function update() {
        // Pega a posição X atual da track (mesmo durante a transição CSS)
        const style = window.getComputedStyle(track);
        const matrix = new WebKitCSSMatrix(style.transform);
        const translateX = matrix.m41;

        const nodes = track.querySelectorAll('.item-node');
        
        nodes.forEach((node, index) => {
            // 180 é a largura do seu item-node definido no CSS/JS
            const nodeLeft = (index * NODE_WIDTH) + translateX;
            const nodeRight = nodeLeft + NODE_WIDTH;

            // Se o ponto central do container estiver dentro da largura deste item
            if (centerPoint >= nodeLeft && centerPoint <= nodeRight) {
                node.classList.add('active-center');
            } else {
                node.classList.remove('active-center');
            }
        });

        // Continua rodando enquanto a transição não acabar
        if (style.transitionProperty !== 'none') {
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