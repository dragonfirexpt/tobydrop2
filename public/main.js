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

function openBattleModal() {
    document.getElementById('battle-modal').style.display = 'flex';
    selectedCasesForBattle = [];
    updateModalSelected();
    
    const container = document.getElementById('modal-available-cases');
    container.innerHTML = Object.keys(itemsData).map(id => `
        <div class="modal-case-item" onclick="addCaseToBattle('${id}')">
            <img src="${itemsData[id].img}" style="width: 40px; height: 30px; object-fit: contain;">
            <div style="flex: 1; text-align: left; margin-left: 10px;">
                <b>${itemsData[id].name}</b><br>
                <span>$${formatCurrency(itemsData[id].price)}</span>
            </div>
        </div>
    `).join('');
}

function closeBattleModal() {
    document.getElementById('battle-modal').style.display = 'none';
}

function addCaseToBattle(id) {
    if (selectedCasesForBattle.length >= 10) return alert("Max 10 cases");
    selectedCasesForBattle.push(id);
    updateModalSelected();
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
    if (currentUser.balance < itemsData[activeCaseId].price) return alert("Not enough credits!");
    
    btn.classList.add('btn-loading');
    btn.disabled = true;

    try {
        const res = await fetch('/api/open-case', {
            method: 'POST', 
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ caseId: activeCaseId })
        });
        
        const data = await res.json();

        spinSound.currentTime = 0; 
        spinSound.play().catch(e => console.log("Erro ao tocar som:", e));

        // Se o servidor devolver erro (ex: 404, 500)
        if (!res.ok) {
            throw new Error(data.error || "Server Error");
        }
        
        btn.classList.remove('btn-loading');
        updateBalanceUI(data.balanceAfterDeduction);

        renderTrack('spinner', data.track);
        const spinner = document.getElementById('spinner');
        const containerWidth = document.getElementById('main-view').offsetWidth;
        const finalX = (50 * NODE_WIDTH) - (containerWidth / 2) + (NODE_WIDTH / 2);
        const targetX = finalX - (Math.floor(Math.random() * (NODE_WIDTH * 0.8)) - (NODE_WIDTH * 0.4));

        spinner.style.transition = 'none'; 
        spinner.style.transform = 'translateX(0)';
        
        setTimeout(() => {
            spinner.style.transition = 'transform 6s cubic-bezier(0.05, 0, 0, 1)';
            spinner.style.transform = `translateX(-${targetX}px)`;
        }, 50);

        setTimeout(() => {
            updateBalanceUI(data.finalBalance);
            btn.disabled = false;
        }, 6500);

    } catch (e) {
        btn.classList.remove('btn-loading');
        btn.disabled = false;
        console.error("ERRO DETALHADO:", e); // Vê isto na consola (F12)
        alert("Erro: " + e.message);
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
socket.on('startBattleSpin', async (data) => {
    switchTab('arena-tab');
    
     const timeline = document.getElementById('battle-case-timeline');
    timeline.innerHTML = data.battle.caseIds.map((cid, idx) => {
        const caseImg = itemsData[cid] ? itemsData[cid].img : 'https://via.placeholder.com/40';
        return `
            <div class="timeline-case" id="step-${idx}">
                <img src="${caseImg}" title="${itemsData[cid].name}"> 
            </div>
        `;
    }).join('');
    // Configuração inicial
    document.getElementById('p1-inventory').innerHTML = '';
    document.getElementById('p2-inventory').innerHTML = '';
    document.getElementById('total-rounds').innerText = data.p1Rolls.length;
    document.getElementById('p1-ava').src = getSafeAvatar(data.battle.player1.avatar);
    document.getElementById('p2-ava').src = getSafeAvatar(data.battle.player2.avatar);
    document.getElementById('p1-username').innerText = data.battle.player1.username;
    document.getElementById('p2-username').innerText = data.battle.player2.username;

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