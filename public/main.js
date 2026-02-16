const socket = io();
let currentUser = null;
let activeCaseId = 'gold';
const NODE_WIDTH = 180;

const winSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3');
winSound.volume = 0.25; // Set volume to 50%

// No topo do main.js
let itemsData = {}; 
let cases = {}; 

let currentCrashState = null;

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
async function init() {
    // 1. Ir buscar os dados das caixas ao Servidor
    const caseRes = await fetch('/api/cases');
    itemsData = await caseRes.json();
    
    // 2. Preencher o objeto cases automaticamente para o menu
    for (let id in itemsData) {
        cases[id] = { name: itemsData[id].name, price: itemsData[id].price };
    }

    // 3. Verificar login do utilizador
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
    document.getElementById('case-title').innerText = caseInfo.name.toUpperCase();
    document.getElementById('open-btn').innerText = `OPEN FOR $${caseInfo.price}`;
    
    const preview = document.getElementById('preview-items');

    // Ordenar por chance (raros no topo)
    const sortedItems = [...caseInfo.items].sort((a, b) => a.chance - b.chance);

    preview.innerHTML = sortedItems.map(item => {
    let priceDisplay = "$0,00";
    
    if (item.minVal !== undefined && item.maxVal !== undefined) {
        priceDisplay = (item.minVal === item.maxVal) 
            ? `$${formatCurrency(item.minVal)}` 
            : `$${formatCurrency(item.minVal)} - $${formatCurrency(item.maxVal)}`;
    } 
    else if (item.value !== undefined) {
        priceDisplay = `$${formatCurrency(item.value)}`;
    }

        return `
            <div class="preview-item" style="border-color: ${item.color}">
                <img src="${item.img || 'https://via.placeholder.com/80x60?text=CSGO'}" style="width: 100%; height: 80px; object-fit: contain; margin-bottom: 10px;">
                <b style="font-size: 12px; display: block; height: 30px; overflow: hidden;">${item.name}</b>
                <span style="display: block; margin-top: 5px; color: var(--accent); font-weight: 800;">${priceDisplay}</span>
                <small style="color: #666; display: block; margin-top: 5px;">${item.chance}% Drop</small>
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
        // UPDATED: Use formatCurrency for spinner items
        const formattedVal = formatCurrency(val);
        
        return `
            <div class="item-node" style="border-bottom: 4px solid ${item.color}">
                <img src="${item.img || 'https://via.placeholder.com/110x80?text=Skin'}" style="width: 110px; height: 80px; object-fit: contain; margin-bottom: 5px;">
                <b style="font-size: 11px; text-align: center; display: block; width: 100%; overflow: hidden; white-space: nowrap; text-overflow: ellipsis;">${item.name}</b>
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
    // Check balance locally before even telling the server
    if(currentUser.balance < price) return alert("Low balance");
    
    // Find the button and show loading
    const btn = event.target;
    if(btn && btn.classList) btn.classList.add('btn-loading');
    
    socket.emit('joinBattle', { battleId: id, userId: currentUser._id });
}

socket.on('updateBattles', (battles) => {
    document.getElementById('battle-list').innerHTML = battles.map(b => `
        <div class="battle-card">
            <div class="users">
                <img src="${b.player1.avatar}">
                <div><b>${b.player1.username}</b> <small style="color:#444">vs</small> <b>WAITING</b></div>
            </div>
            <div style="text-align:center"><small style="color:#555">CASE</small><br><b>${b.caseId.toUpperCase()}</b></div>
            ${b.player1.id !== currentUser._id ? `<button class="btn-primary" onclick="joinBattle('${b.id}', ${b.price})">JOIN $${b.price}</button>` : '<span>YOURS</span>'}
        </div>
    `).join('');
});

socket.on('startBattleSpin', (data) => {
    switchTab('arena-tab');
    
    // Set UI elements
    document.getElementById('p1-ava').src = data.battle.player1.avatar;
    document.getElementById('p2-ava').src = data.battle.player2.avatar;
    document.getElementById('p1-name').innerText = data.battle.player1.username;
    document.getElementById('p2-name').innerText = data.battle.player2.username;
    document.getElementById('battle-msg').innerText = "FIGHT!";

    renderTrack('p1-spinner', data.track1);
    renderTrack('p2-spinner', data.track2);

    const tracks = [document.getElementById('p1-spinner'), document.getElementById('p2-spinner')];
    const containerWidth = document.querySelector('.spinner-container.sm').offsetWidth;
    const finalX = (50 * NODE_WIDTH) - (containerWidth / 2) + (NODE_WIDTH / 2);

    tracks.forEach(t => { 
        t.style.transition = 'none'; 
        t.style.transform = 'translateX(0)'; 
    });

    setTimeout(() => {
        tracks.forEach(t => {
            t.style.transition = 'transform 6s cubic-bezier(0.05, 0, 0, 1)';
            t.style.transform = `translateX(-${finalX}px)`;
        });
    }, 100);

    // END OF BATTLE
    setTimeout(() => {
        const winnerName = data.winnerId === data.battle.player1.id ? data.battle.player1.username : data.battle.player2.username;
        document.getElementById('battle-msg').innerText = `${winnerName.toUpperCase()} WINS!`;
        
        // After showing the winner name, refresh the balance to trigger animation
        setTimeout(async () => {
            const res = await fetch('/api/me');
            const refresh = await res.json();
            if(refresh.loggedIn) {
                // This will trigger the Green animation if you are the winner
                updateBalanceUI(refresh.user.balance); 
            }
        }, 1500);
    }, 6500);
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