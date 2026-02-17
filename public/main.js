const socket = io();
let currentUser = null;
let activeCaseId = 'gold';
const NODE_WIDTH = 180;

const winSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3');
winSound.volume = 0.25; // Set volume to 50%
const spinSound = new Audio('/assets/spin.mp3');
const landSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3');
spinSound.volume = 0.3;
landSound.volume = 0.4;
// No topo do main.js
let itemsData = {}; 
let cases = {}; 

let currentCrashState = null;
let selectedCasesForBattle = [];
let upgraderState = {
    allSkins: [],
    selectedInput: null,
    selectedTarget: null
};

let upgraderInv = [];
let upgraderPageInv = 0;
let upgraderPageTargets = 0;
const UP_PAGE_SIZE = 9; // 3x3 Grid
function renderTargets() {
    const search = document.getElementById('target-search').value.toLowerCase();
    
    // Filter by search
    let filtered = upgraderState.allSkins.filter(s => s.name.toLowerCase().includes(search));
    
    const grid = document.getElementById('upgrade-target-grid');
    const start = upgraderPageTargets * UP_PAGE_SIZE;
    const pageItems = filtered.slice(start, start + UP_PAGE_SIZE);
    
    grid.innerHTML = pageItems.map(item => {
        // Can't upgrade to cheaper items
        const isTooCheap = upgraderState.selectedInput && item.price <= upgraderState.selectedInput.value;
        // Check if selected by comparing Name + Condition
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
    const pagin = document.getElementById('inv-pagination');
    
    const start = upgraderPageInv * UP_PAGE_SIZE;
    const pageItems = upgraderInv.slice(start, start + UP_PAGE_SIZE);
    
    grid.innerHTML = pageItems.map(item => `
        <div class="up-card ${upgraderState.selectedInput?.id === item.id ? 'selected' : ''}" onclick="selectUpInput(this, ${JSON.stringify(item).replace(/"/g, '&quot;')})">
            <div class="badge">${item.conditionShort}</div>
            <img src="${item.img}">
            <b>${item.name}</b>
            <span>$${formatCurrency(item.value)}</span>
        </div>
    `).join('');

    renderPagination('inv-pagination', upgraderInv.length, upgraderPageInv, (p) => {
        upgraderPageInv = p;
        renderInventory();
    });
}
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
    if (!upgraderState.selectedInput) return alert("Select an item from your inventory first!");
    
    const targetVal = upgraderState.selectedInput.value * m;
    
    // Find index in the fully sorted global list
    const index = upgraderState.allSkins.findIndex(s => s.price >= targetVal);
    
    if (index !== -1) {
        upgraderPageTargets = Math.floor(index / UP_PAGE_SIZE);
        // Clear search to ensure we are looking at the main list
        document.getElementById('target-search').value = "";
        
        // Auto-select the first item that meets the multiplier
        upgraderState.selectedTarget = upgraderState.allSkins[index];
        
        renderTargets();
        calcUpgradeChance();
    }
}
function selectUpInput(el, item) {
    // If clicking the same item, unselect it
    if (upgraderState.selectedInput?.id === item.id) {
        upgraderState.selectedInput = null;
    } else {
        upgraderState.selectedInput = item;
    }
    
    // If the currently selected target is now cheaper than the new input, unselect target
    if (upgraderState.selectedInput && upgraderState.selectedTarget && 
        upgraderState.selectedTarget.price <= upgraderState.selectedInput.value) {
        upgraderState.selectedTarget = null;
    }

    renderInventory();
    renderTargets(); // Re-render to update price-disabled states
    calcUpgradeChance();
}

function selectUpTarget(el, item) {
    // 1. Prevent selecting if too cheap
    if (upgraderState.selectedInput && item.price <= upgraderState.selectedInput.value) return;

    // 2. Toggle selection: If already selected, unselect it
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

    if (!upgraderState.selectedInput || !upgraderState.selectedTarget) {
        slice.style.strokeDasharray = `0 283`;
        display.innerText = "0.00%";
        btn.disabled = true;
        return;
    }
    
    const inputVal = upgraderState.selectedInput.value;
    const targetVal = upgraderState.selectedTarget.price;
    
    let chance = (inputVal / targetVal) * 95;
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
    if (!upgraderState.selectedInput || !upgraderState.selectedTarget) return;

    const btn = document.getElementById('btn-do-upgrade');
    btn.disabled = true;

    const wrapper = document.getElementById('upgrade-needle-wrapper');
    wrapper.style.transition = 'none';
    wrapper.style.transform = 'rotate(0deg)';

    try {
        const res = await fetch('/api/upgrade', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                inputItemId: upgraderState.selectedInput.id,
                targetSkinName: upgraderState.selectedTarget.name,
                targetPrice: upgraderState.selectedTarget.price,
                // ADD THIS LINE TO FIX THE FN BUG:
                targetCondition: upgraderState.selectedTarget.displayCond 
            })
        });

        const data = await res.json();
        if (!data.success) throw new Error(data.error);

        const randomSpins = 7 + Math.floor(Math.random() * 5);
        const finalDeg = (data.roll / 100) * 360;
        const totalRotation = (randomSpins * 360) + finalDeg;

        setTimeout(() => {
            wrapper.style.transition = 'transform 4.5s cubic-bezier(0.15, 0, 0.15, 1)';
            wrapper.style.transform = `rotate(${totalRotation}deg)`;
        }, 50);

        // AFTER THE SPIN FINISHES
        setTimeout(() => {
            if (data.win) {
                // Only play the win sound if they actually won
                if (typeof winSound !== 'undefined') {
                    winSound.currentTime = 0;
                    winSound.play();
                }
                showUpgradeResult(true, upgraderState.selectedTarget);
            } else {
                // REMOVED landSound.play() from here
                // We just show the result modal silently or you could add a 'fail' sound
                showUpgradeResult(false, upgraderState.selectedTarget);
            }

            // Update user balance UI globally
            if (data.balance !== undefined) updateBalanceUI(data.balance);
            
            // Clear current selections
            upgraderState.selectedInput = null;
            upgraderState.selectedTarget = null;
            btn.disabled = false;

            // Reset needle wrapper for next time
            wrapper.style.transition = 'none';
            wrapper.style.transform = 'rotate(0deg)';

        }, 5000);

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

    track.innerHTML = trackData.map(item => {
        const val = item.value || item.maxVal || item.minVal || 0;
        const formattedVal = formatCurrency(val);
        
        // Show condition short text if it exists (for the winner/track items)
        const conditionHtml = item.conditionShort 
            ? `<div class="item-cond">${item.conditionShort}</div>` 
            : '';

        return `
            <div class="item-node" style="border-bottom: 4px solid ${item.color}">
                ${conditionHtml}
                <img src="${item.img || 'https://via.placeholder.com/110x80?text=Skin'}" style="width: 110px; height: 80px; object-fit: contain; margin-bottom: 5px;">
                <b title="${item.name}">${item.name}</b>
                <span style="color: var(--accent); font-weight: 800; font-size: 14px;">$${formattedVal}</span>
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
        if (!res.ok) throw new Error(data.error);

        // SOM E ANIMAÇÃO DE DESCIDA DE SALDO (Pagar a caixa)
        // Aqui usamos o balanceAfterDeduction que agora o servidor envia
        updateBalanceUI(data.balanceAfterDeduction);

        // Inicia o som da roleta
        spinSound.playbackRate = 0.65; // Som lento para animação longa
        spinSound.currentTime = 0; 
        spinSound.play().catch(e => {});

        renderTrack('spinner', data.track);
        const spinner = document.getElementById('spinner');
        const containerWidth = document.getElementById('main-view').offsetWidth;
        const finalX = (50 * NODE_WIDTH) - (containerWidth / 2) + (NODE_WIDTH / 2);
        const targetX = finalX - (Math.floor(Math.random() * (NODE_WIDTH * 0.8)) - (NODE_WIDTH * 0.4));

        spinner.style.transition = 'none'; 
        spinner.style.transform = 'translateX(0)';
        
        setTimeout(() => {
            spinner.style.transition = 'transform 9s cubic-bezier(0.05, 0, 0, 1)';
            spinner.style.transform = `translateX(-${targetX}px)`;
        }, 50);

        // FINAL DA ROLETA
        setTimeout(() => {
            landSound.currentTime = 0;
            landSound.play();
            
            // ATUALIZAÇÃO FINAL
            updateBalanceUI(data.finalBalance);
            loadInventory(); // Atualiza a aba de inventário automaticamente
            
            btn.disabled = false;
            btn.classList.remove('btn-loading');
        }, 9500);

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
    document.getElementById('battle-msg').innerText = ""; // Reseta o texto de vitória
    document.getElementById('p1-total-val').innerText = "0,00"; // Reseta o saldo do P1
    document.getElementById('p2-total-val').innerText = "0,00"; // Reseta o saldo do P2
    document.getElementById('current-round').innerText = "1"; // Reseta o contador de rondas
    // Configuração inicial
    document.getElementById('p1-inventory').innerHTML = '';
    document.getElementById('p2-inventory').innerHTML = '';
    document.getElementById('total-rounds').innerText = data.p1Rolls.length;
    document.getElementById('p1-ava').src = getSafeAvatar(data.battle.player1.avatar);
    document.getElementById('p2-ava').src = getSafeAvatar(data.battle.player2.avatar);
    document.getElementById('p1-username').innerText = data.battle.player1.username;
    document.getElementById('p2-username').innerText = data.battle.player2.username;
     const timeline = document.getElementById('battle-case-timeline');
    timeline.innerHTML = data.battle.caseIds.map((cid, idx) => {
        const caseImg = itemsData[cid] ? itemsData[cid].img : 'https://via.placeholder.com/40';
        return `
            <div class="timeline-case" id="step-${idx}">
                <img src="${caseImg}" title="${itemsData[cid].name}"> 
            </div>
        `;
    }).join('');

    let p1Acc = 0;
    let p2Acc = 0;

    for (let i = 0; i < data.p1Rolls.length; i++) {
        document.querySelectorAll('.timeline-case').forEach(el => el.classList.remove('active'));
        const currentStep = document.getElementById(`step-${i}`);
        currentStep.classList.add('active');
        currentStep.classList.add('passed');
        document.getElementById('current-round').innerText = i + 1;
        spinSound.currentTime = 0; 
        spinSound.play().catch(e => console.log("Erro ao tocar som:", e));
        renderTrack('p1-spinner', data.p1Rolls[i].track);
        renderTrack('p2-spinner', data.p2Rolls[i].track);

        const tracks = [document.getElementById('p1-spinner'), document.getElementById('p2-spinner')];
        tracks.forEach(t => { t.style.transition = 'none'; t.style.transform = 'translateX(0)'; });

        await new Promise(r => setTimeout(r, 100));
        const containerWidth = document.querySelector('.spinner-container.sm').offsetWidth;
        const finalX = (50 * NODE_WIDTH) - (containerWidth / 2) + (NODE_WIDTH / 2);
        
        tracks.forEach(t => {
            t.style.transition = 'transform 4s cubic-bezier(0.05, 0, 0, 1)';
            t.style.transform = `translateX(-${finalX}px)`;
        });

        await new Promise(r => setTimeout(r, 4200));

        // Animações de Dinheiro e Inventário
        showBattleGain(1, data.p1Rolls[i].value);
        showBattleGain(2, data.p2Rolls[i].value);
        addWonItemToArena(1, data.p1Rolls[i]);
        addWonItemToArena(2, data.p2Rolls[i]);

        p1Acc += data.p1Rolls[i].value;
        p2Acc += data.p2Rolls[i].value;

        document.getElementById('p1-total-val').innerText = formatCurrency(p1Acc);
        document.getElementById('p2-total-val').innerText = formatCurrency(p2Acc);
        
        await new Promise(r => setTimeout(r, 800));
    }

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

async function logout() { await fetch('/api/logout', {method: 'POST'}); location.reload(); }