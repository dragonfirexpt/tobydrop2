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
    // URL atualizada para a versão 9 (mais estável)
    avatar: { type: String, default: 'https://api.dicebear.com/9.x/bottts/svg?seed=identicon' }
}));

const CONDITIONS = [
    { name: "Factory New", short: "FN", chance: 10, multiplier: 1.0 },
    { name: "Minimal Wear", short: "MW", chance: 15, multiplier: 0.7 },
    { name: "Field-Tested", short: "FT", chance: 20, multiplier: 0.4 },
    { name: "Well-Worn", short: "WW", chance: 25, multiplier: 0.2 },
    { name: "Battle-Scarred", short: "BS", chance: 30, multiplier: 0.0 }
];

const rollCondition = () => {
    let rand = Math.random() * 100;
    let cum = 0;
    for (let c of CONDITIONS) {
        cum += c.chance;
        if (rand < cum) return c;
    }
    return CONDITIONS[2];
};

const caseData = {
    bronze: {
        name: "Recoil Box", 
        price: 1.00, 
        items: [
            { name: "Gut Knife | Doppler Ruby", maxVal: 672.74, minVal: 672.74, color: "#ffb703", chance: 0.005, fixedCondition: "FN", img: "https://cs2-cdn.pricempire.com/panorama/images/econ/default_generated/weapon_knife_gut_am_ruby_marbleized_light_png.png" },
            { name: "AK-47 | Nightwish", maxVal: 108.45, minVal: 102.44, color: "#eb4b4b", chance: 0.018 },
            { name: "AWP | Ice Coaled", maxVal: 83.42, minVal: 9.67, color: "#d32ce6", chance: 0.053 },
            { name: "M4A1-S | Player Two", maxVal: 83.42, minVal: 82.04, color: "#eb4b4b", chance: 0.013 },
            { name: "AK-47 | Inheritance", maxVal: 69.72, minVal: 69.72, color: "#eb4b4b", chance: 0.012, fixedCondition: "FT" },
            { name: "AWP | Exothermic", maxVal: 31.14, minVal: 19.88, color: "#d32ce6", chance: 0.050 },
            { name: "USP-S | Sleeping Potion", maxVal: 17.72, minVal: 6.28, color: "#d32ce6", chance: 0.106 },
            { name: "USP-S | Jawbreaker", maxVal: 12.59, minVal: 5.89, color: "#d32ce6", chance: 0.159 },
            { name: "AK-47 | Midnight Laminate", maxVal: 10.76, minVal: 10.55, color: "#8847ff", chance: 0.055 },
            { name: "UMP-45 | Wild Child", maxVal: 9.95, minVal: 4.93, color: "#d32ce6", chance: 0.890 },
            { name: "Sawed-Off | Apocalypto", maxVal: 8.71, minVal: 0.79, color: "#8847ff", chance: 6.479 },
            { name: "M4A1-S | Glitched Paint", maxVal: 7.85, minVal: 4.83, color: "#8847ff", chance: 0.039 },
            { name: "Dual Berettas | Twin Turbo", maxVal: 4.09, minVal: 2.89, color: "#d32ce6", chance: 1.987 },
            { name: "M4A1-S | Night Terror", maxVal: 4.05, minVal: 1.08, color: "#8847ff", chance: 5.422 },
            { name: "MAC-10 | Saibā Oni", maxVal: 4.05, minVal: 1.64, color: "#8847ff", chance: 6.147 },
            { name: "Glock-18 | Block-18", maxVal: 4.05, minVal: 0.79, color: "#8847ff", chance: 9.307 },
            { name: "M4A4 | Choppa", maxVal: 3.88, minVal: 0.08, color: "#8847ff", chance: 15.339 },
            { name: "USP-S | Tropical Breeze", maxVal: 2.96, minVal: 1.35, color: "#8847ff", chance: 8.070 },
            { name: "R8 Revolver | Tango", maxVal: 2.53, minVal: 0.20, color: "#4b69ff", chance: 6.933 },
            { name: "AWP | Pit Viper", value: 2.13, maxVal: 2.13, minVal: 1.50, color: "#8847ff", chance: 5.128 },
            { name: "XM1014 | Mockingbird", maxVal: 1.48, minVal: 0.08, color: "#4b69ff", chance: 6.373 },
            { name: "P90 | Freight", maxVal: 1.40, minVal: 0.09, color: "#4b69ff", chance: 7.763 },
            { name: "Zeus x27 | Electric Blue", maxVal: 0.83, minVal: 0.05, color: "#4b69ff", chance: 11.372 },
            { name: "M4A4 | Naval Shred Camo", maxVal: 0.18, minVal: 0.05, color: "#4b69ff", chance: 8.280 }
        ]
    },
    phoenix: {
        name: "Phoenix Vault",
        price: 3.00, // Preço sugerido para a caixa
        items: [
            { name: "Talon Knife | Tiger Tooth", maxVal: 750.37, minVal: 750.37, color: "#ffb703", chance: 0.005, fixedCondition: "FN" },
            { name: "Survival Knife | Doppler Phase 4", maxVal: 315.24, minVal: 315.24, color: "#ffb703", chance: 0.016, fixedCondition: "FN" },
            { name: "Gut Knife | Doppler Phase 4", maxVal: 197.01, minVal: 197.01, color: "#ffb703", chance: 0.057, fixedCondition: "FN" },
            { name: "AK-47 | Vulcan", maxVal: 183.63, minVal: 183.63, color: "#eb4b4b", chance: 0.011, fixedCondition: "FN" },
            { name: "AWP | Containment Breach", maxVal: 92.33, minVal: 92.33, color: "#eb4b4b", chance: 0.122, fixedCondition: "MW" },
            { name: "AK-47 | Neon Rider", maxVal: 82.60, minVal: 71.71, color: "#eb4b4b", chance: 0.154 },
            { name: "AK-47 | Inheritance", maxVal: 81.78, minVal: 81.78, color: "#eb4b4b", chance: 0.088, fixedCondition: "FT" },
            { name: "AWP | The End", maxVal: 55.06, minVal: 55.06, color: "#d32ce6", chance: 0.120, fixedCondition: "FN" },
            { name: "AWP | Crakow!", maxVal: 40.16, minVal: 40.16, color: "#d32ce6", chance: 0.072, fixedCondition: "MW" },
            { name: "M4A4 | Desolate Space", maxVal: 16.95, minVal: 16.95, color: "#d32ce6", chance: 3.530, fixedCondition: "FT" },
            { name: "AK-47 | Searing Rage", maxVal: 14.26, minVal: 7.12, color: "#d32ce6", chance: 4.610 },
            { name: "M4A1-S | Leaded Glass", maxVal: 13.41, minVal: 13.41, color: "#d32ce6", chance: 2.538, fixedCondition: "MW" },
            { name: "M4A1-S | Control Panel", maxVal: 11.95, minVal: 11.80, color: "#d32ce6", chance: 2.081 },
            { name: "AWP | Ice Coaled", maxVal: 11.29, minVal: 9.75, color: "#d32ce6", chance: 1.946 },
            { name: "M4A1-S | Black Lotus", maxVal: 10.32, minVal: 10.32, color: "#8847ff", chance: 2.922, fixedCondition: "FN" },
            { name: "UMP-45 | K.O. Factory", maxVal: 6.99, minVal: 6.81, color: "#8847ff", chance: 3.848 },
            { name: "AK-47 | Ice Coaled", maxVal: 6.28, minVal: 6.28, color: "#8847ff", chance: 4.355, fixedCondition: "MW" },
            { name: "Zeus x27 | Olympus", maxVal: 6.12, minVal: 5.67, color: "#8847ff", chance: 4.039 },
            { name: "M4A1-S | Night Terror", maxVal: 4.09, minVal: 1.10, color: "#4b69ff", chance: 15.065 },
            { name: "P90 | Randy Rush", maxVal: 2.58, minVal: 0.98, color: "#4b69ff", chance: 9.070 },
            { name: "Desert Eagle | Serpent Strike", maxVal: 1.74, minVal: 0.83, color: "#4b69ff", chance: 11.462 },
            { name: "Galil AR | Control", maxVal: 1.69, minVal: 0.70, color: "#4b69ff", chance: 13.863 },
            { name: "AWP | Pit Viper", maxVal: 1.50, minVal: 1.33, color: "#4b69ff", chance: 7.869 },
            { name: "Zeus x27 | Tosai", maxVal: 1.33, minVal: 0.70, color: "#4b69ff", chance: 12.157 }
        ]
    }

};

const axios = require('axios'); // Você pode precisar instalar: npm install axios

let skinDatabase = []; // Agora é um Array

function autoLinkImages() {
    console.log("🎨 Vinculando imagens às skins (Correção Doppler Ruby/Sapphire)...");
    
    // Função para limpar strings (remove estrelas, acentos e carateres especiais)
    const simplify = (str) => {
        if (!str) return "";
        return str.normalize("NFD")
                  .replace(/[\u0300-\u036f]/g, "") // Remove acentos
                  .replace(/★/g, "")              // Remove a estrela
                  .toLowerCase()
                  .replace(/[^a-z0-9]/g, "");      // Remove tudo o que não é letra/número
    };

    for (let caseKey in caseData) {
        caseData[caseKey].items.forEach(item => {
            const originalName = item.name.trim().toLowerCase();
            
            // 1. Identificar se é uma fase especial
            const specialPhases = ["ruby", "sapphire", "emerald", "black pearl"];
            const detectedPhase = specialPhases.find(p => originalName.includes(p));

            let foundItem = skinDatabase.find(dbItem => {
                if (!dbItem.name) return false;
                const dbNameLower = dbItem.name.toLowerCase();

                // Se detetamos uma fase (ex: Ruby)
                if (detectedPhase) {
                    const weaponName = originalName.split('|')[0].trim(); // ex: "gut knife"
                    
                    // O item do banco DEVE ter o nome da arma E a palavra "doppler" E a fase (ruby)
                    return dbNameLower.includes(weaponName) && 
                           dbNameLower.includes("doppler") && 
                           dbNameLower.includes(detectedPhase);
                }

                // Busca normal para as outras skins
                return simplify(dbItem.name).includes(simplify(item.name));
            });

            // 2. Se não achou com a busca acima (fallback)
            if (!foundItem) {
                foundItem = skinDatabase.find(dbItem => simplify(dbItem.name).includes(simplify(item.name)));
            }

            if (foundItem) {
                item.img = foundItem.image;
            } else {
                console.warn(`⚠️ Imagem não encontrada: "${item.name}"`);
                item.img = "https://via.placeholder.com/512x384?text=Skin+Not+Found";
            }
        });
    }
    console.log("✅ Imagens sincronizadas com as fases corretas!");
}

const getConditionForItem = (item) => {
    // 1. Verifica se você definiu uma condição fixa no caseData (ex: "FN")
    if (item.fixedCondition) {
        const found = CONDITIONS.find(c => c.short === item.fixedCondition.toUpperCase());
        if (found) return found; // Se encontrou (FN, MW, etc), retorna ela
    }

    // 2. Se não houver fixedCondition, faz o sorteio aleatório normal
    return rollCondition();
};

// A generateTrack e a rota /api/open-case devem usar a getConditionForItem atualizada

async function loadSkinDatabase() {
    try {
        console.log("file_download Baixando base de dados de skins...");
        const response = await axios.get('https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/all.json');
        
        let rawData = Array.isArray(response.data) ? response.data : Object.values(response.data);
        
        // Criar um Índice para busca rápida (Ocupa RAM temporariamente, mas é MUITO mais rápido)
        const skinLookup = {};
        const simplify = (str) => str ? str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, '') : "";

        console.log("⚡ Indexando skins...");
        rawData.forEach(s => {
            const key = simplify(s.name);
            // Guardamos apenas a imagem para poupar RAM
            if (!skinLookup[key]) skinLookup[key] = s.image;
            
            // Lógica especial para Dopplers (Ruby, etc) dentro do índice
            if (s.name.includes("Doppler")) {
                const phase = s.name.toLowerCase().match(/\((.*?)\)/);
                if (phase) {
                    const specializedKey = simplify(s.name.split('|')[0]) + "doppler" + simplify(phase[1]);
                    skinLookup[specializedKey] = s.image;
                }
            }
        });

        // Agora vinculamos as imagens usando o Índice (O(1) em vez de O(N))
        console.log("🎨 Vinculando imagens às caixas...");
        for (let caseKey in caseData) {
            caseData[caseKey].items.forEach(item => {
                 if (item.img && item.img !== "" && !item.img.includes("via.placeholder")) {
            return; // Se já tem imagem manual, pula para o próximo item e não substitui
        }
                const searchKey = simplify(item.name);
                
                if (skinLookup[searchKey]) {
                    item.img = skinLookup[searchKey];
                } else {
                    // Tenta uma busca parcial rápida no índice
                    const fallbackKey = Object.keys(skinLookup).find(k => k.includes(searchKey));
                    item.img = fallbackKey ? skinLookup[fallbackKey] : "https://via.placeholder.com/512x384?text=Not+Found";
                }
            });
        }

        // --- O PASSO MAIS IMPORTANTE ---
        // Libertar a memória. Apagamos os dados brutos e o índice.
        rawData = null;
        console.log("🧹 Memória limpa. SkinDatabase removido da RAM.");
        console.log("✅ Servidor pronto e leve!");

    } catch (error) {
        console.error("Erro na Database:", error.message);
    }
}

loadSkinDatabase();

// Chame a função no final do arquivo ou antes do server.listen



const rollItem = (items) => {
    let rand = Math.random() * 100;
    let cum = 0;
    for(let s of items) { cum += s.chance; if(rand < cum) return s; }
    return items[0];
};

const calculateValue = (item, condition) => {
    const min = Number(item.minVal) || 0;
    const max = Number(item.maxVal) || min;
    return parseFloat((min + ((max - min) * condition.multiplier)).toFixed(2));
};

const generateTrack = (winner, items) => {
    let track = [];
    for(let i=0; i<60; i++) {
        if (i === 50) {
            track.push(winner);
        } else {
            const baseItem = items[Math.floor(Math.random() * items.length)];
            
            // Verifica a regra de fixedCondition para cada item do rolete
            const cond = getConditionForItem(baseItem); 
            const finalPrice = calculateValue(baseItem, cond);
            
            track.push({
                ...baseItem,
                condition: cond.name,
                conditionShort: cond.short,
                value: finalPrice
            });
        }
    }
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

app.get('/api/cases', (req, res) => {
    res.json(caseData);
});

app.post('/api/update-avatar', async (req, res) => {
    const user = await User.findByIdAndUpdate(req.session.userId, { avatar: req.body.avatar }, { new: true });
    res.json({ success: true, user });
});

app.post('/api/logout', (req, res) => req.session.destroy(() => res.json({ success: true })));

app.post('/api/open-case', async (req, res) => {
    try {
        const { caseId } = req.body;
        const user = await User.findById(req.session.userId);
        const selectedCase = caseData[caseId];
        if (!user || !selectedCase || user.balance < selectedCase.price) return res.status(400).json({ error: "Saldo insuficiente" });

        const baseItem = rollItem(selectedCase.items);
        const cond = getConditionForItem(baseItem);
        
        const min = Number(baseItem.minVal) || 0;
        const max = Number(baseItem.maxVal) || min;
        
        // BETTER PRICING: min price + (range * multiplier)
       const finalValue = calculateValue(baseItem, cond);
        
        user.balance = parseFloat(((user.balance - selectedCase.price) + finalValue).toFixed(2));
        await user.save();

        // FIX: Keep name original, add condition as a separate property
        const winner = { 
    ...baseItem, 
    condition: cond.name, 
    conditionShort: cond.short, 
    value: finalValue 
};

        res.json({ 
            winner, 
            track: generateTrack(winner, selectedCase.items), 
            balanceAfterDeduction: user.balance - finalValue, 
            finalBalance: user.balance 
        });
    } catch (e) { res.status(500).json({ error: "Erro interno" }); }
});
async function resolveBattleRolls(caseIds) {
    let rolls = [];
    for (let cid of caseIds) {
        const selectedCase = caseData[cid];
        if (!selectedCase) continue; // Pula se a caixa não existir

        const its = selectedCase.items;
        const baseItem = rollItem(its);
        const cond = getConditionForItem(baseItem);
        const val = calculateValue(baseItem, cond);
        
        // Criamos o objeto completo da skin sorteada
        const winnerObj = { 
            ...baseItem, 
            conditionShort: cond.short, 
            value: val 
        };

        rolls.push({
            ...winnerObj,
            track: generateTrack(winnerObj, its)
        });
    }
    return rolls;
}

io.on('connection', (socket) => {
    socket.emit('updateBattles', activeBattles);
    
    socket.on('chatMessage', (data) => io.emit('chatMessage', data));

    socket.on('createBattle', async (data) => {
    const user = await User.findById(data.userId);
    if (!user) return;

    let totalPrice = 0;
    data.caseIds.forEach(cid => { if(caseData[cid]) totalPrice += caseData[cid].price });
    if (user.balance < totalPrice) return;

    // 1. DEDUZIR O DINHEIRO IMEDIATAMENTE
    user.balance = parseFloat((user.balance - totalPrice).toFixed(2));
    await user.save();

    // 2. ENVIAR ATUALIZAÇÃO DE SALDO (MOSTRAR O DINHEIRO SAINDO)
    socket.emit('balanceUpdate', user.balance); 

    const battleId = Math.random().toString(36).substr(2, 9);
    socket.join(battleId);

    const b = {
    id: battleId,
    player1: { 
        username: user.username, 
        id: user._id.toString(), 
        avatar: user.avatar || 'https://api.dicebear.com/9.x/bottts/svg?seed=player1' 
    },
    player2: data.isBot ? { 
        username: "TOBY BOT 🤖", 
        id: "bot", 
        avatar: "https://api.dicebear.com/9.x/bottts/svg?seed=TobyBot" // Avatar fixo para o Bot
    } : null,
    caseIds: data.caseIds,
    price: totalPrice,
    isBot: data.isBot
};

    if (data.isBot) {
        const p1Rolls = await resolveBattleRolls(b.caseIds);
        const p2Rolls = await resolveBattleRolls(b.caseIds);
        const p1Total = p1Rolls.reduce((sum, r) => sum + r.value, 0);
        const p2Total = p2Rolls.reduce((sum, r) => sum + r.value, 0);
        
        const winId = p1Total >= p2Total ? b.player1.id : "bot";
        
        // SALVAR VITÓRIA NO BANCO MAS NÃO ENVIAR balanceUpdate AINDA
        let balanceAfterWin = user.balance;
        if (winId !== "bot") {
            const winAmount = p1Total + p2Total;
            // Atualizamos no banco mas não emitimos o evento via socket aqui
            await User.findByIdAndUpdate(user._id, { $inc: { balance: winAmount } });
            balanceAfterWin = parseFloat((user.balance + winAmount).toFixed(2));
        }

        io.to(battleId).emit('startBattleSpin', {
            battle: b, p1Rolls, p2Rolls, winnerId: winId,
            p1FinalBalance: balanceAfterWin, // O front-end vai "segurar" esse valor
            p2FinalBalance: 0
        });
    } else {
        activeBattles.push(b);
        io.emit('updateBattles', activeBattles);
    }
});

    socket.on('joinBattle', async (data) => {
    const idx = activeBattles.findIndex(b => b.id === data.battleId);
    const b = activeBattles[idx];

    if (b && !b.player2 && b.player1.id !== data.userId.toString()) {
        const user2 = await User.findById(data.userId);
        if (!user2 || user2.balance < b.price) return;

        // 1. DEDUZIR DINHEIRO DO P2
        user2.balance = parseFloat((user2.balance - b.price).toFixed(2));
        await user2.save();
        socket.emit('balanceUpdate', user2.balance); // P2 vê o dinheiro saindo

        socket.join(b.id);
        b.player2 = { username: user2.username, id: user2._id.toString(), avatar: user2.avatar };

        const p1Rolls = await resolveBattleRolls(b.caseIds);
        const p2Rolls = await resolveBattleRolls(b.caseIds);
        const p1Total = p1Rolls.reduce((sum, r) => sum + r.value, 0);
        const p2Total = p2Rolls.reduce((sum, r) => sum + r.value, 0);

        const winId = p1Total >= p2Total ? b.player1.id : b.player2.id;
        
        // PROCESSAR VENCEDOR NO BANCO (SILENCIOSAMENTE)
        const totalPot = parseFloat((p1Total + p2Total).toFixed(2));
        await User.findByIdAndUpdate(winId, { $inc: { balance: totalPot } });

        // Pegar saldos finais para o Payload
        const p1Obj = await User.findById(b.player1.id);
        const p2Obj = await User.findById(b.player2.id);

        io.to(b.id).emit('startBattleSpin', {
            battle: b, p1Rolls, p2Rolls, winnerId: winId,
            p1FinalBalance: p1Obj.balance,
            p2FinalBalance: p2Obj.balance
        });

        activeBattles.splice(idx, 1);
        io.emit('updateBattles', activeBattles);
    }
});
});

let crashState = {
    multiplier: 1.00,
    status: 'waiting', // waiting, running, crashed
    timer: 10,
    bets: [], // { userId, username, amount, avatar, cashedOut: false }
};

function startCrashLoop() {
    crashState.status = 'waiting';
    crashState.timer = 10;
    crashState.multiplier = 1.00;
    crashState.bets = [];

    const waitInterval = setInterval(() => {
        crashState.timer -= 0.1;
        io.emit('crashTick', crashState);

        if (crashState.timer <= 0) {
            clearInterval(waitInterval);
            runCrashGame();
        }
    }, 100);
}

function runCrashGame() {
    crashState.status = 'running';
    // House edge: 3% chance to crash at 1.00x instantly
    const crashPoint = Math.random() < 0.03 ? 1.00 : (1 / (Math.random() || 0.001) * 0.97).toFixed(2);
    
    const gameInterval = setInterval(() => {
        crashState.multiplier += 0.01 + (crashState.multiplier * 0.005); // Exponential growth
        io.emit('crashTick', crashState);

        if (crashState.multiplier >= crashPoint) {
            clearInterval(gameInterval);
            crashState.status = 'crashed';
            io.emit('crashTick', crashState);
            setTimeout(startCrashLoop, 4000); // 4s delay before next round
        }
    }, 100);
}

startCrashLoop(); // Initialize the loop

io.on('connection', (socket) => {
    socket.on('crashBet', async (data, callback) => {
        const user = await User.findById(data.userId);
        const amount = Number(data.amount); // Forçar número
        const alreadyBet = crashState.bets.some(b => b.userId === user._id.toString());

        if (crashState.status === 'waiting' && user && !isNaN(amount) && amount > 0 && user.balance >= amount && !alreadyBet) {
            user.balance = parseFloat((user.balance - amount).toFixed(2));
            await user.save();
            crashState.bets.push({ userId: user._id.toString(), username: user.username, amount: amount, avatar: user.avatar, cashedOut: false });
            socket.emit('balanceUpdate', user.balance);
            io.emit('crashTick', crashState);
            if (callback) callback({ success: true });
        } else if (callback) callback({ success: false });
    });

    socket.on('crashCashOut', async (data, callback) => {
        const bet = crashState.bets.find(b => b.userId === data.userId && !b.cashedOut);
        if (crashState.status === 'running' && bet) {
            const mult = Number(crashState.multiplier) || 1;
            const payout = parseFloat((bet.amount * mult).toFixed(2));
            
            if (isNaN(payout)) return; // Trava de segurança

            bet.cashedOut = true;
            bet.payout = payout;
            const user = await User.findById(data.userId);
            user.balance = parseFloat((user.balance + payout).toFixed(2));
            await user.save();
            
            socket.emit('balanceUpdate', user.balance);
            io.emit('crashTick', crashState);
            if (callback) callback({ success: true });
        }
    });
});

server.listen(3000, "0.0.0.0", () => {
  console.log("🚀 TOBYDROP Running");
});


