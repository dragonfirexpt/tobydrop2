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
    starter: {
        name: "Starter Box", price: 50,
        items: [
            { name: "Rusty Key", value: 5, color: "#888", chance: 70 },
            { name: "Iron Plate", value: 40, color: "#00f2ff", chance: 25 },
            { name: "Silver Coin", value: 300, color: "#ffb703", chance: 5 }
        ]
    },
    elite: {
        name: "Elite Crate", price: 250,
        items: [
            { name: "Neon Katana", value: 50, color: "#00f2ff", chance: 60 },
            { name: "Cyber Armor", value: 400, color: "#8847ff", chance: 35 },
            { name: "Diamond Core", value: 2000, color: "#ffb703", chance: 5 }
        ]
    },
    toby: {
        name: "TOBY SPECIAL", price: 1000,
        items: [
            { name: "Void Essence", value: 100, color: "#8847ff", chance: 50 },
            { name: "Dragon Heart", value: 1500, color: "#ffb703", chance: 45 },
            { name: "GOD MODE", value: 15000, color: "#ff0000", chance: 5 }
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
    const winner = rollItem(selectedCase.items);
    user.balance = (user.balance - selectedCase.price) + winner.value;
    await user.save();
    res.json({ winner, track: generateTrack(winner, selectedCase.items), newBalance: user.balance });
});

io.on('connection', (socket) => {
    socket.emit('updateBattles', activeBattles);
    socket.on('chatMessage', (data) => io.emit('chatMessage', data));
    socket.on('createBattle', async (data) => {
        const user = await User.findById(data.userId);
        const price = caseData[data.caseId].price;

        // 1. Check if user can afford it
        if (!user || user.balance < price) return;

        // 2. Deduct the balance immediately in DB
        user.balance -= price;
        await user.save();

        const b = {
            id: Math.random().toString(36).substr(2, 9),
            player1: { username: user.username, id: user._id, avatar: user.avatar },
            player2: null, 
            caseId: data.caseId, 
            price: price
        };
        
        activeBattles.push(b);
        
        // 3. Inform everyone (including the creator) to update their UI/Balance
        io.emit('updateBattles', activeBattles);
        socket.emit('balanceUpdate', user.balance); // Send new balance back to creator
    });
    socket.on('joinBattle', async (data) => {
        const idx = activeBattles.findIndex(b => b.id === data.battleId);
        const b = activeBattles[idx];
        if (b && !b.player2 && b.player1.id.toString() !== data.userId) {
            const user = await User.findById(data.userId);
            if (user.balance < b.price) return;
            const its = caseData[b.caseId].items;
            b.player2 = { username: user.username, id: user._id, avatar: user.avatar };
            const r1 = rollItem(its); const r2 = rollItem(its);
            const winId = r1.value >= r2.value ? b.player1.id : b.player2.id;
            const winner = await User.findById(winId);
            const loser = await User.findById(winId == b.player1.id ? b.player2.id : b.player1.id);
            winner.balance += (r1.value + r2.value - b.price);
            loser.balance -= b.price;
            await winner.save(); await loser.save();
            io.emit('startBattleSpin', { battle: b, track1: generateTrack(r1, its), track2: generateTrack(r2, its), winnerId: winId });
            activeBattles.splice(idx, 1);
            io.emit('updateBattles', activeBattles);
        }
    });
});

server.listen(3000, () => console.log('🚀 TOBYDROP Running'));