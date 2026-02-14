const socket = io();
let currentUser = null;
let activeCaseId = 'starter';
const NODE_WIDTH = 160;

const cases = {
    starter: { name: "Starter Box", price: 50 },
    elite: { name: "Elite Crate", price: 250 },
    toby: { name: "TOBY SPECIAL", price: 1000 }
};

const itemsData = {
    starter: [
        { name: "Rusty Key", value: 5, color: "#888", chance: 70 },
        { name: "Iron Plate", value: 40, color: "#00f2ff", chance: 25 },
        { name: "Silver Coin", value: 300, color: "#ffb703", chance: 5 }
    ],
    elite: [
        { name: "Neon Katana", value: 50, color: "#00f2ff", chance: 60 },
        { name: "Cyber Armor", value: 400, color: "#8847ff", chance: 35 },
        { name: "Diamond Core", value: 2000, color: "#ffb703", chance: 5 }
    ],
    toby: [
        { name: "Void Essence", value: 100, color: "#8847ff", chance: 50 },
        { name: "Dragon Heart", value: 1500, color: "#ffb703", chance: 45 },
        { name: "GOD MODE", value: 15000, color: "#ff0000", chance: 5 }
    ]
};

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

function updateUI() {
    if(!currentUser) return;
    document.getElementById('balance').innerText = `$${currentUser.balance.toLocaleString()}`;
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

    try {
        const res = await fetch('/api/open-case', {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ caseId: activeCaseId })
        });
        const data = await res.json();
        
        btn.classList.remove('btn-loading');
        btn.disabled = true;

        // --- MOVE THIS PART HERE (Immediately after server response) ---
        currentUser.balance = data.newBalance; 
        updateUI();
        // ---------------------------------------------------------------

        renderTrack('spinner', data.track);
        const spinner = document.getElementById('spinner');
        const finalX = (50 * NODE_WIDTH) - (document.getElementById('main-view').offsetWidth / 2) + (NODE_WIDTH / 2);

        spinner.style.transition = 'none'; 
        spinner.style.transform = 'translateX(0)';
        
        setTimeout(() => {
            spinner.style.transition = 'transform 6s cubic-bezier(0.05, 0, 0, 1)';
            spinner.style.transform = `translateX(-${finalX}px)`;
        }, 50);

        setTimeout(() => {
            // Only re-enable the button after animation
            btn.disabled = false;
        }, 6500);
    } catch (e) {
        btn.classList.remove('btn-loading');
        alert("Transaction failed");
    }
}

socket.on('balanceUpdate', (newBalance) => {
    currentUser.balance = newBalance;
    updateUI();
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

function joinBattle(id, price) {
    const btn = event.target;
    if(currentUser.balance < price) return alert("Low balance");
    
    btn.classList.add('btn-loading');
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
    document.getElementById('p1-ava').src = data.battle.player1.avatar;
    document.getElementById('p2-ava').src = data.battle.player2.avatar;
    document.getElementById('p1-name').innerText = data.battle.player1.username;
    document.getElementById('p2-name').innerText = data.battle.player2.username;
    renderTrack('p1-spinner', data.track1);
    renderTrack('p2-spinner', data.track2);
    const tracks = [document.getElementById('p1-spinner'), document.getElementById('p2-spinner')];
    const finalX = (50 * NODE_WIDTH) - (tracks[0].parentElement.offsetWidth / 2) + (NODE_WIDTH / 2);
    tracks.forEach(t => { t.style.transition='none'; t.style.transform='translateX(0)'; });
    setTimeout(() => {
        tracks.forEach(t => {
            t.style.transition = 'transform 6s cubic-bezier(0.05, 0, 0, 1)';
            t.style.transform = `translateX(-${finalX}px)`;
        });
    }, 100);
    setTimeout(() => {
        const win = data.winnerId === data.battle.player1.id ? data.battle.player1.username : data.battle.player2.username;
        document.getElementById('battle-msg').innerText = `${win.toUpperCase()} WINS!`;
        setTimeout(init, 2000);
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