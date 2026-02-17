const socket = io();
let currentUser = null;
let activeCaseId = 'gold';
const NODE_WIDTH = 170;

const winSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3');
winSound.volume = 0.25; // Set volume to 50%
const spinSound = new Audio('/assets/spinner.mp3');
const landSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3');
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

let upgraderInv = [];
let upgraderPageInv = 0;
let upgraderPageTargets = 0;
const UP_PAGE_SIZE = 9; // 3x3 Grid
function renderTargets() {
    const search = document.getElementById('target-search').value.toLowerCase();
    let filtered = upgraderState.allSkins.filter(s => s.name.toLowerCase().includes(search));
    
    const grid = document.getElementById('upgrade-target-grid');
    const start = upgraderPageTargets * UP_PAGE_SIZE;
    const pageItems = filtered.slice(start, start + UP_PAGE_SIZE);
    
    // PEGA O VALOR TOTAL SOMADO AQUI
    const totalInputValue = getTotalSelectedValue();

    grid.innerHTML = pageItems.map(item => {
        // COMPARA COM O VALOR TOTAL
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
function renderInventory() {
    const grid = document.getElementById('upgrade-inv-grid');
    const start = upgraderPageInv * UP_PAGE_SIZE;
    const pageItems = upgraderInv.slice(start, start + UP_PAGE_SIZE);
    
    // Atualiza o contador visual
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

    renderPagination('inv-pagination', upgraderInv.length, upgraderPageInv, (p) => {
        upgraderPageInv = p;
        renderInventory();
    });
}
const getTotalSelectedValue = () => {
    return upgraderState.selectedInputs.reduce((sum, item) => sum + item.value, 0);
};
async function initUpgrader() {
    if (upgraderState.allSkins.length === 0) {
        const res = await fetch('/api/all-skins');
        let rawSkins = await res.json();
        // ALWAYS SORT BY PRICE LOW TO HIGH
        upgraderState.allSkins = rawSkins.sort((a,b) => a.price - b.price);
    }
    
    const invRes = await fetch('/api/me');
    const invData = await invRes.json();
    upgraderInv = invData.user.inventory || [];
    
    renderInventory();
    renderTargets();
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
    document.getElementById('upgrade-modal').style.display = 'none';
    // Refresh lists
    initUpgrader();
}
async function startUpgrade() {
    if (upgraderState.selectedInputs.length === 0 || !upgraderState.selectedTarget) return;

    const btn = document.getElementById('btn-do-upgrade');
    btn.disabled = true;

    // Toca o som de início

    const wrapper = document.getElementById('upgrade-needle-wrapper');
    wrapper.style.transition = 'none';
    wrapper.style.transform = 'rotate(0deg)';

    try {
        const res = await fetch('/api/upgrade', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                inputItemIds: upgraderState.selectedInputs.map(i => i.id), // Array de IDs
                targetSkinName: upgraderState.selectedTarget.name,
                targetPrice: upgraderState.selectedTarget.price,
                targetCondition: upgraderState.selectedTarget.displayCond 
            })
        });

        const data = await res.json();
        if (!data.success) throw new Error(data.error);

        const randomSpins = 7 + Math.floor(Math.random() * 5);
        const finalDeg = (data.roll / 100) * 360;
        const totalRotation = (randomSpins * 360) + finalDeg;

        setTimeout(() => {
            wrapper.style.transition = 'transform 5s cubic-bezier(0.15, 0, 0.15, 1)';
            wrapper.style.transform = `rotate(${totalRotation}deg)`;
                upgradeStartSound.currentTime = 0;
    upgradeStartSound.play();
        }, 50);

        setTimeout(() => {
            if (data.win) {
                upgradeWinSound.currentTime = 0;
                upgradeWinSound.play();
                showUpgradeResult(true, upgraderState.selectedTarget);
            } else {
                upgradeLossSound.currentTime = 0;
                upgradeLossSound.play();
                showUpgradeResult(false, upgraderState.selectedTarget);
            }

            if (data.balance !== undefined) updateBalanceUI(data.balance);
            
            // Resetar seleção
            upgraderState.selectedInputs = [];
            upgraderState.selectedTarget = null;
            btn.disabled = false;

            wrapper.style.transition = 'none';
            wrapper.style.transform = 'rotate(0deg)';

        }, 5500);

    } catch (e) {
        console.error(e);
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
    const sortType = document.getElementById('battle-case-sort').value;
    
    // Transformamos o objeto itemsData em um array para poder ordenar
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
    document.getElementById('battle-modal').style.display = 'flex';
    selectedCasesForBattle = [];
    updateModalSelected();
    renderAvailableCasesForBattle(); // Chama a função de renderização
}


function closeBattleModal() {
    document.getElementById('battle-modal').style.display = 'none';
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
    document.getElementById('sell-all-modal').style.display = 'none';
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
            // Sound effect
            if(landSound) {
                landSound.currentTime = 0;
                landSound.play();
            }
            
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
    const grid = document.getElementById('home-case-grid');
    grid.innerHTML = Object.keys(itemsData).map(id => `
        <div class="case-card" onclick="selectCase('${id}')">
            <img src="${itemsData[id].img}" class="case-card-img">
            <h3>${itemsData[id].name}</h3>
            <p>$${formatCurrency(itemsData[id].price)}</p>
        </div>
    `).join('');
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

    landSound.currentTime = 0;
    landSound.play();

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
    // Adicionamos a classe 'anim-entry' para disparar o CSS
    itemCard.className = 'won-item-card anim-entry';
    itemCard.style.borderLeft = `4px solid ${item.color}`;
    
    // Efeito de brilho baseado na cor da skin
    itemCard.style.boxShadow = `inset 50px 0 30px -30px ${item.color}22`; 

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

function updateUI() {
    if(!currentUser) return;
    // UPDATED: Use formatCurrency
    document.getElementById('balance').innerText = `$${formatCurrency(currentUser.balance)}`;
    document.getElementById('user-avatar-top').src = currentUser.avatar;
    document.getElementById('settings-avatar-prev').src = currentUser.avatar;
}

function showHome() {
    document.querySelectorAll('.tab-view').forEach(t => t.style.display = 'none');
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    document.getElementById('home-tab').style.display = 'block';
    document.querySelector('button[onclick="showHome()"]').classList.add('active');
}

function selectCase(id) {
    activeCaseId = id;
    
    // 1. Verificar se a caixa existe no que veio do servidor
    if (!itemsData || !itemsData[id]) {
        console.error("Caixa não encontrada no sistema:", id);
        alert("Erro: Dados da caixa não carregados. Recarregue a página.");
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
    document.getElementById('open-btn').innerText = `OPEN FOR $${caseInfo.price}`;
    
    const preview = document.getElementById('preview-items');

    // Ordenar por chance (raros no topo)
    const sortedItems = [...caseInfo.items].sort((a, b) => a.chance - b.chance);

    preview.innerHTML = sortedItems.map(item => {
    let priceDisplay = formatCurrency(item.minVal) + " - " + formatCurrency(item.maxVal);
    if (item.minVal === item.maxVal) priceDisplay = formatCurrency(item.minVal);

    return `
        <div class="preview-item" style="border-color: ${item.color}">
            <img src="${item.img || 'https://via.placeholder.com/80x60?text=CSGO'}" style="width: 100%; height: 80px; object-fit: contain; margin-bottom: 10px;">
            <div class="preview-info">
                <b style="font-size: 12px; display: block; height: 30px; overflow: hidden;">${item.name}</b>
                <span style="display: block; margin-top: 5px; color: var(--accent); font-weight: 800;">$${priceDisplay}</span>
                <small style="color: #666; display: block; margin-top: 5px;">${item.chance}% Drop</small>
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
        const val = item.value || item.maxVal || item.minVal || 0;
        
        let rarityClass = '';
        const color = item.color ? item.color.toLowerCase() : '';
        if (color === '#ffb703') rarityClass = 'rarity-gold';
        else if (color === '#eb4b4b') rarityClass = 'rarity-red';
        else if (color === '#d32ce6') rarityClass = 'rarity-pink';
        else if (color === '#8847ff') rarityClass = 'rarity-purple';
        else if (color === '#4b69ff') rarityClass = 'rarity-blue';

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

        updateBalanceUI(data.balanceAfterDeduction);
        renderTrack('spinner', data.track);
        
        const spinner = document.getElementById('spinner');
        const containerWidth = document.getElementById('main-view').offsetWidth;

        // CÁLCULO DO CENTRO EXATO
        const centerPrecisionX = (50 * NODE_WIDTH) - (containerWidth / 2) + (NODE_WIDTH / 2);

        // CÁLCULO DO OFFSET ALEATÓRIO (para cair fora do centro inicialmente)
        const randomLandingOffset = (Math.random() * (NODE_WIDTH * 0.7)) - (NODE_WIDTH * 0.35);
        const targetX = centerPrecisionX + randomLandingOffset;
        spinSound.currentTime = 0;
        spinSound.play();

        spinner.style.transition = 'none'; 
        spinner.style.transform = 'translateX(0)';
        
        setTimeout(() => {
            // Giro principal (9 segundos)
            spinner.style.transition = 'transform 5s cubic-bezier(0.05, 0, 0, 1)';
            spinner.style.transform = `translateX(-${targetX}px)`;
            trackCenterItem('spinner'); 
        }, 50);

        // --- MOMENTO DO SNAP E REVELAÇÃO SIMULTÂNEA ---
        setTimeout(() => {
            // 1. Iniciamos o ajuste para o centro exato (Snap)
            spinner.style.transition = 'transform 0.6s cubic-bezier(0.25, 1, 0.5, 1)';
            spinner.style.transform = `translateX(-${centerPrecisionX}px)`;

            // 2. No MESMO instante, adicionamos a classe de vencedor
            // Isso vai fazer o nome, preço e a imagem de raridade (pequena) aparecerem via CSS
            const winnerNode = spinner.querySelector('.item-node[data-index="50"]');
            if(winnerNode) {
                winnerNode.classList.add('is-winner');
            }

            landSound.currentTime = 0;
            landSound.play();

            // 3. Finaliza os dados após a animação de 0.6s
            setTimeout(() => {
                updateBalanceUI(data.finalBalance);
                loadInventory();
                btn.disabled = false;
                btn.classList.remove('btn-loading');
            }, 600);

        }, 5000); 

    } catch (e) {
        btn.classList.remove('btn-loading');
        btn.disabled = false;
        alert(e.message);
    }
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
    let items = data.user.inventory;
    const grid = document.getElementById('inventory-grid');

    // 1. FILTRAR POR RARIDADE
    const rarityFilter = document.getElementById('filter-rarity').value;
    if (rarityFilter !== 'all') {
        items = items.filter(item => item.color === rarityFilter);
    }

    // 2. ORDENAR (PREÇO OU DATA)
    const sortType = document.getElementById('sort-price').value;
    if (sortType === 'high') {
        items.sort((a, b) => b.value - a.value);
    } else if (sortType === 'low') {
        items.sort((a, b) => a.value - b.value);
    } else if (sortType === 'newest') {
        // Como o Mongoose guarda por ordem de inserção, o loadInventory antigo já fazia reverse()
        items = items.reverse(); 
    }

    // 3. RENDERIZAR
    if (items.length === 0) {
        grid.innerHTML = '<p style="color:#555; grid-column: 1/-1; text-align:center; padding: 50px;">No items found with these filters.</p>';
        return;
    }

    grid.innerHTML = items.map(item => `
        <div class="inventory-card" style="border-bottom: 3px solid ${item.color}">
            <img src="${item.img}">
            <div class="inv-info">
                <b>${item.name}</b>
                <small style="color: ${item.color}">${item.conditionShort}</small>
                <span>$${formatCurrency(item.value)}</span>
            </div>
            <button class="btn-sell" onclick="sellItem(event, '${item.id}')">SELL</button>
        </div>
    `).join('');
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
            // 3. Som de dinheiro (opcional, usa o landSound se quiseres)
            landSound.currentTime = 0;
            landSound.play();

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
    
    // Reset de UI
    document.getElementById('battle-msg').innerText = "FIGHT!"; 
    document.getElementById('p1-total-val').innerText = "0,00"; 
    document.getElementById('p2-total-val').innerText = "0,00"; 
    document.getElementById('p1-inventory').innerHTML = '';
    document.getElementById('p2-inventory').innerHTML = '';
    document.getElementById('total-rounds').innerText = data.p1Rolls.length;
    
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
        document.querySelectorAll('.timeline-case').forEach(el => el.classList.remove('active'));
        const currentStep = document.getElementById(`step-${i}`);
        if(currentStep) currentStep.classList.add('active', 'passed');
        document.getElementById('current-round').innerText = i + 1;

        spinSound.currentTime = 0; 
        spinSound.play().catch(e => {});

        // 1. Renderizar trilhas
        renderTrack('p1-spinner', data.p1Rolls[i].track);
        renderTrack('p2-spinner', data.p2Rolls[i].track);

        const t1 = document.getElementById('p1-spinner');
        const t2 = document.getElementById('p2-spinner');

        // --- CORREÇÃO DO ERRO 't is not defined' ---
        // Pegamos o container de um dos spinners (ambos têm o mesmo tamanho)
        const containerWidth = document.querySelector('.spinner-container.sm').offsetWidth;

        // Lógica de Cálculo exata do Case Opening
        const centerPrecisionX = (50 * NODE_WIDTH) - (containerWidth / 2) + (NODE_WIDTH / 2);
        const randomLandingOffset = (Math.random() * (NODE_WIDTH * 0.7)) - (NODE_WIDTH * 0.35);
        const targetX = centerPrecisionX + randomLandingOffset;

        // Reset de posição
        [t1, t2].forEach(t => { 
            t.style.transition = 'none'; 
            t.style.transform = 'translateX(0)'; 
        });

        await new Promise(r => setTimeout(r, 50));

        // Ativa highlight em tempo real (zoom ao passar no meio)
        trackCenterItem('p1-spinner');
        trackCenterItem('p2-spinner');

        // 2. Giro Principal (4 segundos)
        [t1, t2].forEach(t => {
            t.style.transition = 'transform 5s cubic-bezier(0.05, 0, 0, 1)';
            t.style.transform = `translateX(-${targetX}px)`;
        });

        await new Promise(r => setTimeout(r, 5000));

        // 3. O SNAP (Ajuste Final) + REVELAÇÃO PREMIUM
        [t1, t2].forEach(t => {
            t.style.transition = 'transform 0.6s cubic-bezier(0.25, 1, 0.5, 1)';
            t.style.transform = `translateX(-${centerPrecisionX}px)`;
            
            const winnerNode = t.querySelector('.item-node[data-index="50"]');
            if(winnerNode) winnerNode.classList.add('is-winner'); // Ativa zoom e subida da raridade
        });

        landSound.currentTime = 0;
        landSound.play().catch(e => {});

        // Atualizar valores acumulados e itens ganhos
        showBattleGain(1, data.p1Rolls[i].value);
        showBattleGain(2, data.p2Rolls[i].value);
        addWonItemToArena(1, data.p1Rolls[i]);
        addWonItemToArena(2, data.p2Rolls[i]);

        p1Acc += data.p1Rolls[i].value;
        p2Acc += data.p2Rolls[i].value;

        document.getElementById('p1-total-val').innerText = formatCurrency(p1Acc);
        document.getElementById('p2-total-val').innerText = formatCurrency(p2Acc);
        
        await new Promise(r => setTimeout(r, 1500)); 
    }

    // Resultado Final
    const winnerName = data.winnerId === data.battle.player1.id ? data.battle.player1.username : data.battle.player2.username;
    document.getElementById('battle-msg').innerText = `${winnerName.toUpperCase()} WINS!`;

    const myFinalBalance = (currentUser._id === data.battle.player1.id) ? data.p1FinalBalance : data.p2FinalBalance;
    if (myFinalBalance !== undefined) updateBalanceUI(myFinalBalance);
});
// Chat
document.getElementById('chat-input').addEventListener('keypress', (e) => {
    if(e.key === 'Enter' && e.target.value.trim() !== '') {
        socket.emit('chatMessage', { user: currentUser.username, msg: e.target.value, avatar: currentUser.avatar });
        e.target.value = '';
    }
});

socket.on('chatMessage', (data) => {
    const div = document.createElement('div');
    div.className = 'chat-line';
    div.innerHTML = `<img src="${data.avatar}"><div class="chat-bubble"><b>${data.user}</b>${data.msg}</div>`;
    const box = document.getElementById('chat-msgs');
    box.appendChild(div); box.scrollTop = box.scrollHeight;
});

// Settings & Auth
document.getElementById('avatar-input').onchange = function(e) {
    const reader = new FileReader();
    reader.onload = function() { document.getElementById('settings-avatar-prev').src = reader.result; };
    reader.readAsDataURL(e.target.files[0]);
};

async function uploadAvatar() {
    const btn = event.target;
    btn.classList.add('btn-loading');
    try {
        const res = await fetch('/api/update-avatar', {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ avatar: document.getElementById('settings-avatar-prev').src })
        });
        const data = await res.json();
        if(data.success) { 
            currentUser = data.user; 
            updateUI(); 
            alert("Saved!"); 
        }
    } finally {
        btn.classList.remove('btn-loading');
    }
}

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