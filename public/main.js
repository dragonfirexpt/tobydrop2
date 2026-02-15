const socket = io();
let currentUser = null;
let activeCaseId = 'starter';
const NODE_WIDTH = 160;

const winSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3');
winSound.volume = 0.25; // Set volume to 50%

const cases = {
    bronze: { name: "Bronze Box", price: 20 },
    silver: { name: "Silver Safe", price: 100 },
    gold: { name: "Gold Vault", price: 500 },
    diamond: { name: "Diamond Crate", price: 2500 },
    cyber: { name: "Cyber Void", price: 10000 },
    toby: { name: "TOBY GOD", price: 50000 }
};

const itemsData = {
    bronze: [
        { name: "Paper Clip", value: 1, color: "#888", chance: 60 },
        { name: "Rusty Key", value: 5, color: "#888", chance: 25 },
        { name: "Bronze Coin", value: 45, color: "#00f2ff", chance: 12 },
        { name: "Silver Ingot", value: 150, color: "#ffb703", chance: 3 }
    ],
    silver: [
        { name: "Old Watch", value: 20, color: "#888", chance: 50 },
        { name: "Chrome Blade", value: 80, color: "#00f2ff", chance: 35 },
        { name: "Gold Nugget", value: 450, color: "#8847ff", chance: 12 },
        { name: "Diamond Ring", value: 1200, color: "#ffb703", chance: 3 }
    ],
    gold: [
        { name: "Onyx Shard", value: 100, color: "#888", chance: 55 },
        { name: "Titanium Core", value: 400, color: "#00f2ff", chance: 30 },
        { name: "Golden Apple", value: 2500, color: "#ff00ff", chance: 12 },
        { name: "Ether Crystal", value: 6500, color: "#ffb703", chance: 3 }
    ],
    diamond: [
        { name: "Prism Glass", value: 500, color: "#00f2ff", chance: 50 },
        { name: "Plasma Core", value: 2200, color: "#8847ff", chance: 35 },
        { name: "Diamond Blade", value: 12000, color: "#ff00ff", chance: 12 },
        { name: "Black Matter", value: 35000, color: "#ff0000", chance: 3 }
    ],
    cyber: [
        { name: "Circuitry", value: 2000, color: "#8847ff", chance: 45 },
        { name: "Neural Link", value: 8500, color: "#ff00ff", chance: 40 },
        { name: "Cyber Katana", value: 45000, color: "#ffb703", chance: 12 },
        { name: "AI Overlord", value: 150000, color: "#ff0000", chance: 3 }
    ],
    toby: [
        { name: "God's Dust", value: 10000, color: "#ff00ff", chance: 40 },
        { name: "Infinity Star", value: 45000, color: "#ffb703", chance: 40 },
        { name: "Dragon Spirit", value: 250000, color: "#ff0000", chance: 15 },
        { name: "TOBY'S CROWN", value: 1000000, color: "#ff0000", chance: 5 }
    ]
};

let currentCrashState = null;

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
            winSound.currentTime = 0; // Reset sound to start (in case it's already playing)
            winSound.play().catch(e => console.log("Sound play failed:", e));
        }
    }

    currentUser.balance = newBalance;
    // Format as a whole number with commas
    document.getElementById('balance').innerText = `$${Math.floor(newBalance).toLocaleString()}`;
}

function showBalanceAnimation(amount) {
    const container = document.getElementById('balance-indicator-container');
    if (!container) return;

    const el = document.createElement('div');
    const isGain = amount > 0;
    
    el.className = `balance-indicator ${isGain ? 'indicator-gain' : 'indicator-loss'}`;
    
    // Math.abs turns -50 into 50, then we add the sign manually
    const formattedAmount = Math.floor(Math.abs(amount)).toLocaleString();
    el.innerText = (isGain ? '+ ' : '- ') + `$${formattedAmount}`;
    
    container.appendChild(el);

    setTimeout(() => el.remove(), 1500);
}


function updateUI() {
    if(!currentUser) return;
    // Format as whole number
    document.getElementById('balance').innerText = `$${Math.floor(currentUser.balance).toLocaleString()}`;
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
    document.querySelectorAll('.tab-view').forEach(t => t.style.display = 'none');
    document.getElementById('opening-tab').style.display = 'block';
    document.getElementById('case-title').innerText = cases[id].name.toUpperCase();
    document.getElementById('open-btn').innerText = `OPEN FOR $${cases[id].price}`;
    
    // Fill Preview
    const preview = document.getElementById('preview-items');
    preview.innerHTML = itemsData[id].map(item => `
        <div class="preview-item" style="border-color: ${item.color}">
            <b>${item.name}</b>
            <span>$${item.value}</span>
            <small>${item.chance}% Drop</small>
        </div>
    `).join('');
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
    track.innerHTML = trackData.map(item => `
        <div class="item-node" style="background: linear-gradient(180deg, #0e1015 0%, ${item.color}15 100%)">
            <b>${item.name}</b><span>$${item.value}</span>
        </div>
    `).join('');
}

async function openCase() {
    const btn = document.getElementById('open-btn');
    const price = cases[activeCaseId].price;
    
    if (currentUser.balance < price) return alert("Not enough credits!");
    
    btn.classList.add('btn-loading');
    btn.disabled = true;

    try {
        const res = await fetch('/api/open-case', {
            method: 'POST', 
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ caseId: activeCaseId })
        });
        const data = await res.json();
        
        btn.classList.remove('btn-loading');

        // 1. ANIMATE LOSS IMMEDIATELY (The price of the case)
        updateBalanceUI(data.balanceAfterDeduction);

        renderTrack('spinner', data.track);
        const spinner = document.getElementById('spinner');
        const containerWidth = document.getElementById('main-view').offsetWidth;
        const finalX = (50 * NODE_WIDTH) - (containerWidth / 2) + (NODE_WIDTH / 2);

        spinner.style.transition = 'none'; 
        spinner.style.transform = 'translateX(0)';
        
        setTimeout(() => {
            spinner.style.transition = 'transform 6s cubic-bezier(0.05, 0, 0, 1)';
            spinner.style.transform = `translateX(-${finalX}px)`;
        }, 50);

        // 2. ANIMATE GAIN AFTER SPIN (When the item is "received")
        setTimeout(() => {
            updateBalanceUI(data.finalBalance);
            btn.disabled = false;
        }, 6500);

    } catch (e) {
        btn.classList.remove('btn-loading');
        btn.disabled = false;
        alert("Transaction failed");
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