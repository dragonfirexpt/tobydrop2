const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const http = require('http');
const { Server } = require('socket.io');
const bcrypt = require('bcryptjs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

mongoose.connect('mongodb+srv://admin:rapazin@cluster0.2nsczvm.mongodb.net/?appName=Cluster0');

app.use(express.json({ limit: '10mb' })); 
app.use(express.static('public'));
app.use(session({
    secret: 'toby_pro_secret_888',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 1000 * 60 * 60 * 24 }
}));

const User = mongoose.model('User', new mongoose.Schema({
    username: { type: String, unique: true },
    password: { type: String, required: true },
    balance: { type: Number, default: 5000 },
    avatar: { type: String, default: 'https://api.dicebear.com/7.x/bottts/svg?seed=default' }
}));

const caseData = {
    bronze: {
        name: "Bronze Box", price: 20,
        items: [
            { name: "Paper Clip", value: 1, color: "#888", chance: 60 },
            { name: "Rusty Key", value: 5, color: "#888", chance: 25 },
            { name: "Bronze Coin", value: 45, color: "#00f2ff", chance: 12 },
            { name: "Silver Ingot", value: 150, color: "#ffb703", chance: 3 }
        ]
    },
    silver: {
        name: "Silver Safe", price: 100,
        items: [
            { name: "Old Watch", value: 20, color: "#888", chance: 50 },
            { name: "Chrome Blade", value: 80, color: "#00f2ff", chance: 35 },
            { name: "Gold Nugget", value: 450, color: "#8847ff", chance: 12 },
            { name: "Diamond Ring", value: 1200, color: "#ffb703", chance: 3 }
        ]
    },
    gold: {
        name: "Gold Vault", price: 500,
        items: [
            { name: "Onyx Shard", value: 100, color: "#888", chance: 55 },
            { name: "Titanium Core", value: 400, color: "#00f2ff", chance: 30 },
            { name: "Golden Apple", value: 2500, color: "#ff00ff", chance: 12 },
            { name: "Ether Crystal", value: 6500, color: "#ffb703", chance: 3 }
        ]
    },
    diamond: {
        name: "Diamond Crate", price: 2500,
        items: [
            { name: "Prism Glass", value: 500, color: "#00f2ff", chance: 50 },
            { name: "Plasma Core", value: 2200, color: "#8847ff", chance: 35 },
            { name: "Diamond Blade", value: 12000, color: "#ff00ff", chance: 12 },
            { name: "Black Matter", value: 35000, color: "#ff0000", chance: 3 }
        ]
    },
    cyber: {
        name: "Cyber Void", price: 10000,
        items: [
            { name: "Circuitry", value: 2000, color: "#8847ff", chance: 45 },
            { name: "Neural Link", value: 8500, color: "#ff00ff", chance: 40 },
            { name: "Cyber Katana", value: 45000, color: "#ffb703", chance: 12 },
            { name: "AI Overlord", value: 150000, color: "#ff0000", chance: 3 }
        ]
    },
    toby: {
        name: "TOBY GOD", price: 50000,
        items: [
            { name: "God's Dust", value: 10000, color: "#ff00ff", chance: 40 },
            { name: "Infinity Star", value: 45000, color: "#ffb703", chance: 40 },
            { name: "Dragon Spirit", value: 250000, color: "#ff0000", chance: 15 },
            { name: "TOBY'S CROWN", value: 1000000, color: "#ff0000", chance: 5 }
        ]
    }
};

const rollItem = (items) => {
    let rand = Math.random() * 100;
    let cum = 0;
    for(let s of items) { cum += s.chance; if(rand < cum) return s; }
    return items[0];
};

const generateTrack = (winner, items) => {
    let track = [];
    for(let i=0; i<60; i++) track.push(i === 50 ? winner : items[Math.floor(Math.random() * items.length)]);
    return track;
};

let activeBattles = [];

app.post('/api/register', async (req, res) => {
    try {
        const hashed = await bcrypt.hash(req.body.password, 10);
        const user = await User.create({ username: req.body.username, password: hashed });
        req.session.userId = user._id;
        res.json({ success: true, user });
    } catch (e) { res.status(400).json({ error: "Username exists" }); }
});

app.post('/api/login', async (req, res) => {
    const user = await User.findOne({ username: req.body.username });
    if (user && await bcrypt.compare(req.body.password, user.password)) {
        req.session.userId = user._id;
        res.json({ success: true, user });
    } else res.status(401).json({ error: "Invalid login" });
});

app.get('/api/me', async (req, res) => {
    if (!req.session.userId) return res.json({ loggedIn: false });
    const user = await User.findById(req.session.userId);
    res.json({ loggedIn: !!user, user });
});

app.post('/api/update-avatar', async (req, res) => {
    const user = await User.findByIdAndUpdate(req.session.userId, { avatar: req.body.avatar }, { new: true });
    res.json({ success: true, user });
});

app.post('/api/logout', (req, res) => req.session.destroy(() => res.json({ success: true })));

app.post('/api/open-case', async (req, res) => {
    const user = await User.findById(req.session.userId);
    const selectedCase = caseData[req.body.caseId];
    if (!user || user.balance < selectedCase.price) return res.status(400).json({ error: "No funds" });

    // Deduct price immediately
    user.balance -= selectedCase.price;
    
    const winner = rollItem(selectedCase.items);
    
    // Add the winner value to the database balance immediately (for safety)
    // but we will tell the client the balance BEFORE the win so they can animate it
    const balanceAfterDeduction = user.balance; 
    user.balance += winner.value;
    
    await user.save();

    res.json({ 
        winner, 
        track: generateTrack(winner, selectedCase.items), 
        balanceAfterDeduction: balanceAfterDeduction, // Money after paying
        finalBalance: user.balance                    // Money after winning
    });
});

io.on('connection', (socket) => {
    socket.emit('updateBattles', activeBattles);
    
    socket.on('chatMessage', (data) => io.emit('chatMessage', data));

    socket.on('createBattle', async (data) => {
        const user = await User.findById(data.userId);
        const price = caseData[data.caseId].price;

        if (!user || user.balance < price) return;

        user.balance -= price;
        await user.save();

        const b = {
            id: Math.random().toString(36).substr(2, 9),
            player1: { 
                username: user.username, 
                id: user._id, 
                avatar: user.avatar,
                socketId: socket.id // <-- Store the creator's socket ID
            },
            player2: null, 
            caseId: data.caseId, 
            price: price
        };
        
        activeBattles.push(b);
        
        io.emit('updateBattles', activeBattles); // Everyone still needs to see the lobby update
        socket.emit('balanceUpdate', user.balance);
    });

    socket.on('joinBattle', async (data) => {
        const idx = activeBattles.findIndex(b => b.id === data.battleId);
        const b = activeBattles[idx];

        if (b && !b.player2 && b.player1.id.toString() !== data.userId) {
            const user = await User.findById(data.userId);
            if (!user || user.balance < b.price) return;

            user.balance -= b.price;
            await user.save();

            // Store the joiner's info and socket ID
            b.player2 = { 
                username: user.username, 
                id: user._id, 
                avatar: user.avatar,
                socketId: socket.id // <-- Store the joiner's socket ID
            };

            const its = caseData[b.caseId].items;
            const r1 = rollItem(its); 
            const r2 = rollItem(its);
            const winId = r1.value >= r2.value ? b.player1.id : b.player2.id;
            
            const winner = await User.findById(winId);
            winner.balance += (r1.value + r2.value);
            await winner.save();

            // --- THE FIX: Send ONLY to the two players involved ---
            const battlePayload = { 
                battle: b, 
                track1: generateTrack(r1, its), 
                track2: generateTrack(r2, its), 
                winnerId: winId 
            };

            io.to(b.player1.socketId).emit('startBattleSpin', battlePayload);
            io.to(b.player2.socketId).emit('startBattleSpin', battlePayload);
            // -------------------------------------------------------

            activeBattles.splice(idx, 1);
            io.emit('updateBattles', activeBattles);
            socket.emit('balanceUpdate', user.balance);
        }
    });
});

server.listen(3000, () => console.log('🚀 TOBYDROP Running'));