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
const passport = require('passport');
const SteamStrategy = require('passport-steam').Strategy;
const mysql = require('mysql2');

const sqlConnection = mysql.createPool({
    host: 'mysql-2e9dbd1e-nottyastobusiness-6048.k.aivencloud.com',
    user: 'avnadmin',
    password: 'AVNS_kPJXVEI34RWcxvS3bnl',
    database: 'defaultdb',
    port: 23869,
    ssl: {
        rejectUnauthorized: false
    },
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
}).promise();

sqlConnection.getConnection()
    .then(conn => {
        console.log("Conectado ao MySQL com sucesso");
        conn.release();
    })
    .catch(err => {
        console.log("Erro: MySQL desligado. Ligue o XAMPP");
    });

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

passport.use(new SteamStrategy({
    returnURL: 'https://tobydrop2.onrender.com/auth/steam/return',
    realm: 'https://tobydrop2.onrender.com/',
    apiKey: 'E20E7617408679026BD8DAC7C926A5C5'
  },
  async (identifier, profile, done) => {
    let user = await User.findOne({ steamId: profile.id });
    
    if (!user) {
        user = await User.create({
            steamId: profile.id,
            username: profile.displayName,
            avatar: profile.photos[2].value,
            balance: 100
        });
    }
    return done(null, user);
  }
));
let skinCrashState = {
    multiplier: 1.00,
    status: 'waiting', 
    timer: 15,
    bets: [],
    suggestedSkin: null
};
const KNIFE_NAMES = {
    500: "weapon_bayonet",
    503: "weapon_knife_css",
    505: "weapon_knife_flip",
    506: "weapon_knife_gut",
    507: "weapon_knife_karambit",
    508: "weapon_knife_m9_bayonet",
    509: "weapon_knife_tactical", // Huntsman
    512: "weapon_knife_falchion",
    514: "weapon_knife_survival_bowie",
    515: "weapon_knife_butterfly",
    516: "weapon_knife_push", // Shadow Daggers
    518: "weapon_knife_canis",
    519: "weapon_knife_ursus",
    520: "weapon_knife_gypsy_jackknife", // Navaja
    522: "weapon_knife_stiletto",
    523: "weapon_knife_widowmaker", // Talon
    521: "weapon_knife_outdoor",
    525: "weapon_knife_skeleton",
    526: "weapon_knife_kukri" // Nomad
};
app.use(passport.initialize());
app.use(passport.session());

app.get('/auth/steam', passport.authenticate('steam'));

app.get('/auth/steam/return',
  passport.authenticate('steam', { failureRedirect: '/' }),
  (req, res) => {
    req.session.userId = req.user._id; // Mantém o padrão do seu projeto antigo
    res.redirect('/');
  }
);
const User = mongoose.model('User', new mongoose.Schema({
    username: { type: String }, // REMOVA o unique: true aqui
    steamId: { type: String, unique: true }, // Este SIM deve ser único
    password: { type: String }, // Remova o required: true
    avatar: { type: String },
    balance: { type: Number, default: 50 },
    dailyWager: { type: Number, default: 0 }, // Total apostado na semana
    rewardCases: [{ type: String }],
    // Procure o campo inventory dentro do User model e adicione o wear:
inventory: [{
    id: String,
    name: String,
    value: Number,
    img: String,
    color: String,
    conditionShort: String,
    paintKit: Number,
    weaponId: Number,
    wear: Number,
    seed: { type: Number, default: 0 },
    equippedTeam: { type: Number, default: 0 },
    isLocked: { type: Boolean, default: false } // <--- ADICIONA ESTA LINHA
}]
}));
// Função para gerar números aleatórios baseados numa semente (Seed)
// Isso garante que o mesmo ID de bot resulte sempre nos mesmos valores
function getClosestSkin(targetValue) {
    if (globalSkinPool.length === 0) return null;
    return globalSkinPool.reduce((prev, curr) => {
        return (Math.abs(curr.value - targetValue) < Math.abs(prev.value - targetValue) ? curr : prev);
    });
}
function seededRandom(seed) {
    var x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
}
const CONDITIONS = [
    { name: "Factory New", short: "FN", chance: 10, multiplier: 1.0 },
    { name: "Minimal Wear", short: "MW", chance: 15, multiplier: 0.7 },
    { name: "Field-Tested", short: "FT", chance: 20, multiplier: 0.4 },
    { name: "Well-Worn", short: "WW", chance: 25, multiplier: 0.2 },
    { name: "Battle-Scarred", short: "BS", chance: 30, multiplier: 0.0 }
];

function startSkinCrashLoop() {
    skinCrashState.status = 'waiting';
    skinCrashState.timer = 15;
    skinCrashState.multiplier = 1.00;
    skinCrashState.bets = [];
    skinCrashState.suggestedSkin = null;

    const waitInterval = setInterval(() => {
        skinCrashState.timer -= 0.1;
        io.emit('skinCrashTick', skinCrashState);

        if (skinCrashState.timer <= 0) {
            clearInterval(waitInterval);
            runSkinCrashGame();
        }
    }, 100);
}

function runSkinCrashGame() {
    skinCrashState.status = 'running';
    const crashPoint = (1 / (Math.random() || 0.001) * 0.97).toFixed(2);
    
    const gameInterval = setInterval(() => {
        skinCrashState.multiplier += 0.01 + (skinCrashState.multiplier * 0.005);
        
        // Se houver alguém jogando, pegamos a skin baseada na aposta dele
        if(skinCrashState.bets.length > 0) {
            let userBet = skinCrashState.bets[0].initialValue;
            let targetValue = userBet * skinCrashState.multiplier;
            // Função getClosestSkin deve estar definida no server.js como mandei na mensagem anterior
            skinCrashState.suggestedSkin = getClosestSkin(targetValue);
        }

        io.emit('skinCrashTick', skinCrashState);

        if (skinCrashState.multiplier >= crashPoint) {
            clearInterval(gameInterval);
            skinCrashState.status = 'crashed';
            io.emit('skinCrashTick', skinCrashState);
            setTimeout(startSkinCrashLoop, 5000);
        }
    }, 100);
}
const generateRandomWear = (conditionShort) => {
    const ranges = {
        "FN": { min: 0.00, max: 0.07 },
        "MW": { min: 0.07, max: 0.15 },
        "FT": { min: 0.15, max: 0.38 },
        "WW": { min: 0.38, max: 0.45 },
        "BS": { min: 0.45, max: 1.00 }
    };
    const range = ranges[conditionShort] || ranges["FT"];
    // Alterado de 6 para 8
    return parseFloat((Math.random() * (range.max - range.min) + range.min).toFixed(8));
};
const generateRandomSeed = () => Math.floor(Math.random() * 1001);
const rollCondition = () => {
    let rand = Math.random() * 100;
    let cum = 0;
    for (let c of CONDITIONS) {
        cum += c.chance;
        if (rand < cum) return c;
    }
    return CONDITIONS[2];
};
async function loadSkinDatabase() {
    try {
        console.log("file_download Aceder à API de skins...");
        const response = await axios.get('https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/all.json', { timeout: 15000 });
        const apiData = Array.isArray(response.data) ? response.data : Object.values(response.data);
        
        const normalize = (str) => {
            if (!str) return "";
            return str.toLowerCase()
                .normalize("NFD").replace(/[\u0300-\u036f]/g, "") 
                .replace(/★/g, "")
                .replace(/knife/g, "")
                .replace(/[^a-z0-9]/g, "")
                .trim();
        };

        console.log("🎨 A vincular imagens e IDs técnicos...");
        let found = 0;
        let missed = 0;

        for (let caseKey in caseData) {
            caseData[caseKey].items.forEach(item => {
                const searchKey = normalize(item.name);
                const isGamma = searchKey.includes('gamma');

                const match = apiData.find(s => {
                    const apiN = normalize(s.name);
                    const apiP = normalize(s.phase || "");
                    const apiHasGamma = apiN.includes('gamma');
                    if (isGamma !== apiHasGamma) return false;
                    const combined = apiN.includes(apiP) ? apiN : apiN + apiP;
                    const specialPhases = ['sapphire', 'ruby', 'blackpearl', 'emerald', 'phase1', 'phase2', 'phase3', 'phase4'];
                    const phaseToFind = specialPhases.find(p => searchKey.includes(p));
                    if (phaseToFind) {
                        const weaponType = normalize(item.name.split('|')[0]);
                        return combined.includes(weaponType) && combined.includes(phaseToFind);
                    }
                    return combined === searchKey || combined.includes(searchKey);
                });

                if (match) {
                    item.img = match.image;

                    // --- CORREÇÃO DO WEAPON ID ---
                    // Tentamos primeiro o weapon_id direto da API
                    let finalWeaponId = 0;
                    if (match.weapon && match.weapon.weapon_id) {
                        finalWeaponId = parseInt(match.weapon.weapon_id);
                    } 
                    // Se for faca e não tiver ID, tentamos mapear pelo objeto weapon.id (ex: "weapon_knife_karambit")
                    else if (match.id && match.id.includes('knife')) {
                        // Fazemos o match reverso usando o teu KNIFE_NAMES do server.js
                        const internalId = Object.keys(KNIFE_NAMES).find(id => 
                            match.weapon && match.weapon.id === KNIFE_NAMES[id]
                        );
                        finalWeaponId = internalId ? parseInt(internalId) : 500; // 500 é Bayonet (padrão)
                    }
                    item.weaponId = finalWeaponId;

                    // --- CORREÇÃO DO PAINT KIT ---
                    // O campo correto na API ByMykel é paint_index
                    item.paintKit = parseInt(match.paint_index) || 0;

                    found++;
                } else {
                    item.img = "https://via.placeholder.com/512x384?text=Not+Found";
                    item.weaponId = 0;
                    item.paintKit = 0;
                    missed++;
                }
            });
        }
        console.log(`✅ SUCESSO: ${found} skins configuradas com IDs e Imagens | ${missed} falhas.`);
        refreshSkinPool(); 
    } catch (error) {
        console.error("❌ Erro fatal:", error.message);
    }
}
function getBotData(botId) {
    // Extrai o número do ID (ex: "bot-123" -> 123)
    const idNum = parseInt(botId.replace('bot-', '')) || 0;
    const name = BOT_NAMES[idNum % BOT_NAMES.length];
    const avatar = `https://api.dicebear.com/9.x/avataaars/svg?seed=${botId}`;
    
    return { name, avatar };
}

const caseData = {
yakuza_bite: {
    name: "YAKUZA BITE",
    price: 1.00,
    img: "https://key-drop.com/uploads/skins/1_YAKUZA_BITE.png",
    tag: "BOXES",
    items: [
        {
            name: "★ Survival Knife | Doppler Ruby",
            color: "#ffb703",
            rarities: [
                { short: "FN", price: 891.25, chance: 0.003 }
            ]
        },
        {
            name: "AK-47 | Aquamarine Revenge",
            color: "#eb4b4b",
            rarities: [
                { short: "MW", price: 107.38, chance: 0.003 },
                { short: "FT", price: 62.61, chance: 0.005 },
                { short: "WW", price: 56.75, chance: 0.005 },
                { short: "BS", price: 54.91, chance: 0.007 }
            ]
        },
        {
            name: "M4A1-S | Vaporwave",
            color: "#eb4b4b",
            rarities: [
                { short: "FT", price: 88.02, chance: 0.005 },
                { short: "WW", price: 87.31, chance: 0.004 },
                { short: "BS", price: 77.65, chance: 0.006 }
            ]
        },
        {
            name: "AWP | Ice Coaled",
            color: "#d32ce6",
            rarities: [
                { short: "FN", price: 74.23, chance: 0.001 },
                { short: "MW", price: 27.99, chance: 0.002 },
                { short: "FT", price: 15.73, chance: 0.007 },
                { short: "WW", price: 11.65, chance: 0.022 },
                { short: "BS", price: 7.74, chance: 0.021 }
            ]
        },
        {
            name: "AK-47 | Neon Rider",
            color: "#eb4b4b",
            rarities: [
                { short: "FT", price: 73.97, chance: 0.01 }
            ]
        },
        {
            name: "Glock-18 | Snack Attack",
            color: "#d32ce6",
            rarities: [
                { short: "MW", price: 68.97, chance: 0.002 },
                { short: "FT", price: 33.95, chance: 0.011 },
                { short: "WW", price: 30.06, chance: 0.018 },
                { short: "BS", price: 28.06, chance: 0.02 }
            ]
        },
        {
            name: "Glock-18 | Shinobu",
            color: "#d32ce6",
            rarities: [
                { short: "MW", price: 15.51, chance: 0.002 },
                { short: "FT", price: 8.33, chance: 0.028 },
                { short: "BS", price: 7.11, chance: 0.028 },
                { short: "WW", price: 6.93, chance: 0.034 }
            ]
        },
        {
            name: "USP-S | Jawbreaker",
            color: "#d32ce6",
            rarities: [
                { short: "MW", price: 11.65, chance: 0.002 },
                { short: "FT", price: 6.89, chance: 0.028 },
                { short: "WW", price: 6.13, chance: 0.058 },
                { short: "BS", price: 6.01, chance: 0.049 }
            ]
        },
        {
            name: "UMP-45 | Wild Child",
            color: "#d32ce6",
            rarities: [
                { short: "MW", price: 10.18, chance: 0.016 },
                { short: "WW", price: 5.23, chance: 0.219 },
                { short: "FT", price: 5.18, chance: 0.202 },
                { short: "BS", price: 4.90, chance: 0.263 }
            ]
        },
        {
            name: "AK-47 | Midnight Laminate",
            color: "#8847ff",
            rarities: [
                { short: "WW", price: 10.17, chance: 0.019 },
                { short: "FT", price: 9.20, chance: 0.041 }
            ]
        },
        {
            name: "Sawed-Off | Apocalypto",
            color: "#8847ff",
            rarities: [
                { short: "FN", price: 8.92, chance: 0.019 },
                { short: "MW", price: 1.85, chance: 1.623 },
                { short: "FT", price: 0.91, chance: 2.792 },
                { short: "WW", price: 0.84, chance: 2.551 },
                { short: "BS", price: 0.84, chance: 2.397 }
            ]
        },
        {
            name: "M4A1-S | Glitched Paint",
            color: "#8847ff",
            rarities: [
                { short: "WW", price: 7.37, chance: 0.01 },
                { short: "FT", price: 4.68, chance: 0.08 },
                { short: "BS", price: 4.35, chance: 0.053 }
            ]
        },
        {
            name: "Glock-18 | Block-18",
            color: "#8847ff",
            rarities: [
                { short: "FN", price: 4.19, chance: 0.02 },
                { short: "MW", price: 1.70, chance: 0.116 },
                { short: "WW", price: 0.93, chance: 2.334 },
                { short: "FT", price: 0.85, chance: 2.411 },
                { short: "BS", price: 0.80, chance: 2.485 }
            ]
        },
        {
            name: "M4A4 | Choppa",
            color: "#4b69ff",
            rarities: [
                { short: "FN", price: 4.14, chance: 0.022 },
                { short: "MW", price: 0.33, chance: 1.791 },
                { short: "FT", price: 0.15, chance: 2.331 },
                { short: "WW", price: 0.10, chance: 2.184 },
                { short: "BS", price: 0.08, chance: 2.458 }
            ]
        },
        {
            name: "MAC-10 | Saibā Oni",
            color: "#8847ff",
            rarities: [
                { short: "MW", price: 4.07, chance: 0.02 },
                { short: "WW", price: 2.21, chance: 1.424 },
                { short: "FT", price: 1.81, chance: 1.642 },
                { short: "BS", price: 1.76, chance: 1.557 }
            ]
        },
        {
            name: "Dual Berettas | Twin Turbo",
            color: "#d32ce6",
            rarities: [
                { short: "FT", price: 3.92, chance: 0.674 },
                { short: "WW", price: 2.55, chance: 2.218 }
            ]
        },
        {
            name: "SSG 08 | Calligrafaux",
            color: "#5e98d9",
            rarities: [
                { short: "FN", price: 3.85, chance: 0.102 },
                { short: "MW", price: 0.48, chance: 2.405 },
                { short: "FT", price: 0.11, chance: 2.339 },
                { short: "WW", price: 0.06, chance: 2.912 },
                { short: "BS", price: 0.05, chance: 2.621 }
            ]
        },
        {
            name: "M4A1-S | Night Terror",
            color: "#8847ff",
            rarities: [
                { short: "FN", price: 3.69, chance: 0.018 },
                { short: "WW", price: 1.50, chance: 2.124 },
                { short: "MW", price: 1.43, chance: 1.819 },
                { short: "BS", price: 1.39, chance: 2.123 },
                { short: "FT", price: 1.10, chance: 2.511 }
            ]
        },
        {
            name: "R8 Revolver | Tango",
            color: "#4b69ff",
            rarities: [
                { short: "FN", price: 3.05, chance: 1.191 },
                { short: "MW", price: 0.61, chance: 1.842 },
                { short: "FT", price: 0.36, chance: 1.792 },
                { short: "WW", price: 0.29, chance: 2.184 },
                { short: "BS", price: 0.18, chance: 1.967 }
            ]
        },
        {
            name: "UMP-45 | Continuum",
            color: "#8847ff",
            rarities: [
                { short: "MW", price: 2.47, chance: 0.547 },
                { short: "FT", price: 1.29, chance: 4.325 },
                { short: "WW", price: 1.04, chance: 3.009 }
            ]
        },
        {
            name: "AWP | Pit Viper",
            color: "#8847ff",
            rarities: [
                { short: "MW", price: 2.25, chance: 1.549 },
                { short: "WW", price: 1.78, chance: 1.637 },
                { short: "BS", price: 1.45, chance: 0.123 }
            ]
        },
        {
            name: "XM1014 | Mockingbird",
            color: "#4b69ff",
            rarities: [
                { short: "FN", price: 1.54, chance: 0.115 },
                { short: "MW", price: 0.30, chance: 2.185 },
                { short: "FT", price: 0.09, chance: 2.184 },
                { short: "WW", price: 0.08, chance: 1.965 },
                { short: "BS", price: 0.08, chance: 2.184 }
            ]
        },
        {
            name: "P90 | Freight",
            color: "#4b69ff",
            rarities: [
                { short: "FN", price: 1.44, chance: 0.116 },
                { short: "MW", price: 0.29, chance: 1.959 },
                { short: "FT", price: 0.09, chance: 2.185 },
                { short: "WW", price: 0.08, chance: 1.749 },
                { short: "BS", price: 0.10, chance: 2.184 }
            ]
        },
        {
            name: "M4A4 | Naval Shred Camo",
            color: "#5e98d9",
            rarities: [
                { short: "MW", price: 0.16, chance: 2.048 },
                { short: "FT", price: 0.06, chance: 4.677 },
                { short: "BS", price: 0.05, chance: 2.956 }
            ]
        }
    ]
},
omakase: {
    name: "OMAKASE",
    price: 2.50,
    img: "https://key-drop.com/uploads/skins/2_OMAKASE.png",
    tag: "BOXES",
    items: [
        {
            name: "★ Bowie Knife | Gamma Doppler Phase 2",
            color: "#ffb703",
            rarities: [
                { short: "FN", price: 334.70, chance: 0.009 }
            ]
        },
        {
            name: "★ Paracord Knife | Fade",
            color: "#ffb703",
            rarities: [
                { short: "FN", price: 244.12, chance: 0.011 }
            ]
        },
        {
            name: "★ Ursus Knife | Tiger Tooth",
            color: "#ffb703",
            rarities: [
                { short: "FN", price: 228.19, chance: 0.01 }
            ]
        },
        {
            name: "Desert Eagle | Ocean Drive",
            color: "#eb4b4b",
            rarities: [
                { short: "FT", price: 108.53, chance: 0.01 }
            ]
        },
        {
            name: "AWP | Printstream",
            color: "#eb4b4b",
            rarities: [
                { short: "FT", price: 82.39, chance: 0.031 }
            ]
        },
        {
            name: "AK-47 | Asiimov",
            color: "#eb4b4b",
            rarities: [
                { short: "WW", price: 65.79, chance: 0.03 },
                { short: "FT", price: 63.03, chance: 0.03 }
            ]
        },
        {
            name: "AK-47 | The Oligarch",
            color: "#eb4b4b",
            rarities: [
                { short: "BS", price: 62.42, chance: 0.042 }
            ]
        },
        {
            name: "AWP | Crakow!",
            color: "#d32ce6",
            rarities: [
                { short: "BS", price: 40.30, chance: 0.101 }
            ]
        },
        {
            name: "USP-S | Monster Mashup",
            color: "#d32ce6",
            rarities: [
                { short: "FT", price: 35.47, chance: 0.104 }
            ]
        },
        {
            name: "Glock-18 | Shinobu",
            color: "#d32ce6",
            rarities: [
                { short: "MW", price: 15.51, chance: 0.043 },
                { short: "FT", price: 8.33, chance: 0.776 },
                { short: "BS", price: 7.11, chance: 0.938 }
            ]
        },
        {
            name: "AK-47 | Searing Rage",
            color: "#d32ce6",
            rarities: [
                { short: "MW", price: 15.11, chance: 0.128 }
            ]
        },
        {
            name: "AK-47 | Ice Coaled",
            color: "#d32ce6",
            rarities: [
                { short: "MW", price: 13.60, chance: 0.137 },
                { short: "FT", price: 7.77, chance: 1.167 }
            ]
        },
        {
            name: "Dual Berettas | Twin Turbo",
            color: "#d32ce6",
            rarities: [
                { short: "MW", price: 9.06, chance: 0.203 },
                { short: "FT", price: 3.92, chance: 2.369 },
                { short: "BS", price: 2.60, chance: 3.82 }
            ]
        },
        {
            name: "R8 Revolver | Banana Cannon",
            color: "#8847ff",
            rarities: [
                { short: "FN", price: 8.90, chance: 0.101 },
                { short: "MW", price: 1.79, chance: 3.168 },
                { short: "FT", price: 0.71, chance: 2.741 },
                { short: "WW", price: 0.66, chance: 2.572 },
                { short: "BS", price: 0.60, chance: 2.949 }
            ]
        },
        {
            name: "MAG-7 | Monster Call",
            color: "#8847ff",
            rarities: [
                { short: "FN", price: 8.43, chance: 0.101 },
                { short: "MW", price: 1.64, chance: 1.375 },
                { short: "FT", price: 0.75, chance: 1.368 },
                { short: "BS", price: 0.66, chance: 3.552 },
                { short: "WW", price: 0.66, chance: 1.782 }
            ]
        },
        {
            name: "Glock-18 | Vogue",
            color: "#d32ce6",
            rarities: [
                { short: "BS", price: 5.74, chance: 2.434 },
                { short: "FT", price: 5.32, chance: 2.581 }
            ]
        },
        {
            name: "AWP | Duality",
            color: "#d32ce6",
            rarities: [
                { short: "FT", price: 5.05, chance: 6.483 }
            ]
        },
        {
            name: "M4A1-S | Night Terror",
            color: "#8847ff",
            rarities: [
                { short: "FN", price: 3.69, chance: 0.263 },
                { short: "WW", price: 1.50, chance: 0.698 },
                { short: "MW", price: 1.43, chance: 1.34 },
                { short: "BS", price: 1.39, chance: 1.008 },
                { short: "FT", price: 1.10, chance: 1.617 }
            ]
        },
        {
            name: "AWP | Phobos",
            color: "#8847ff",
            rarities: [
                { short: "FT", price: 3.50, chance: 3.852 }
            ]
        },
        {
            name: "P250 | Franklin",
            color: "#d32ce6",
            rarities: [
                { short: "MW", price: 3.44, chance: 3.306 }
            ]
        },
        {
            name: "M4A1-S | Rose Hex",
            color: "#4b69ff",
            rarities: [
                { short: "FN", price: 2.54, chance: 2.427 },
                { short: "MW", price: 1.06, chance: 0.431 },
                { short: "FT", price: 0.51, chance: 2.827 },
                { short: "BS", price: 0.49, chance: 4.111 },
                { short: "WW", price: 0.48, chance: 4.165 }
            ]
        },
        {
            name: "P250 | Inferno",
            color: "#8847ff",
            rarities: [
                { short: "MW", price: 2.18, chance: 2.275 },
                { short: "WW", price: 1.48, chance: 1.517 },
                { short: "BS", price: 0.91, chance: 3.731 },
                { short: "FT", price: 0.91, chance: 3.141 }
            ]
        },
        {
            name: "G3SG1 | Dream Glade",
            color: "#8847ff",
            rarities: [
                { short: "MW", price: 1.83, chance: 4.231 },
                { short: "FT", price: 0.98, chance: 1.476 },
                { short: "WW", price: 0.91, chance: 1.467 },
                { short: "BS", price: 0.85, chance: 1.597 }
            ]
        },
        {
            name: "MP5-SD | Picnic",
            color: "#5e98d9",
            rarities: [
                { short: "MW", price: 0.29, chance: 3.188 },
                { short: "FT", price: 0.09, chance: 3.784 },
                { short: "WW", price: 0.06, chance: 5.047 },
                { short: "BS", price: 0.06, chance: 1.335 }
            ]
        }
    ]
},
tempura_fury: {
    name: "TEMPURA FURY",
    price: 5.00,
    img: "https://key-drop.com/uploads/skins/3_TEMPURA_FURY.png",
    tag: "BOXES",
    items: [
        {
            name: "★ Nomad Knife | Doppler Phase 4",
            color: "#ffb703",
            rarities: [
                { short: "FN", price: 717.30, chance: 0.005 }
            ]
        },
        {
            name: "★ Survival Knife | Doppler Phase 1",
            color: "#ffb703",
            rarities: [
                { short: "FN", price: 319.30, chance: 0.015 }
            ]
        },
        {
            name: "★ Falchion Knife | Tiger Tooth",
            color: "#ffb703",
            rarities: [
                { short: "FN", price: 227.08, chance: 0.042 }
            ]
        },
        {
            name: "AK-47 | Bloodsport",
            color: "#eb4b4b",
            rarities: [
                { short: "FT", price: 212.09, chance: 0.024 }
            ]
        },
        {
            name: "AWP | Containment Breach",
            color: "#eb4b4b",
            rarities: [
                { short: "WW", price: 93.38, chance: 0.102 }
            ]
        },
        {
            name: "AK-47 | Neon Rider",
            color: "#eb4b4b",
            rarities: [
                { short: "WW", price: 83.03, chance: 0.024 },
                { short: "FT", price: 73.97, chance: 0.098 }
            ]
        },
        {
            name: "M4A1-S | Player Two",
            color: "#eb4b4b",
            rarities: [
                { short: "FT", price: 81.72, chance: 0.077 }
            ]
        },
        {
            name: "Desert Eagle | Printstream",
            color: "#eb4b4b",
            rarities: [
                { short: "FT", price: 57.57, chance: 0.116 }
            ]
        },
        {
            name: "AWP | Crakow!",
            color: "#d32ce6",
            rarities: [
                { short: "BS", price: 40.30, chance: 0.074 }
            ]
        },
        {
            name: "M4A4 | Desolate Space",
            color: "#d32ce6",
            rarities: [
                { short: "BS", price: 17.15, chance: 0.808 }
            ]
        },
        {
            name: "AK-47 | Searing Rage",
            color: "#d32ce6",
            rarities: [
                { short: "MW", price: 15.11, chance: 0.73 },
                { short: "WW", price: 7.52, chance: 0.992 },
                { short: "BS", price: 7.16, chance: 1.448 },
                { short: "FT", price: 6.93, chance: 0.549 }
            ]
        },
        {
            name: "M4A1-S | Leaded Glass",
            color: "#d32ce6",
            rarities: [
                { short: "FT", price: 13.98, chance: 0.889 }
            ]
        },
        {
            name: "MP7 | Smoking Kills",
            color: "#d32ce6",
            rarities: [
                { short: "FT", price: 12.90, chance: 0.893 },
                { short: "WW", price: 9.86, chance: 3.588 }
            ]
        },
        {
            name: "AWP | Ice Coaled",
            color: "#d32ce6",
            rarities: [
                { short: "WW", price: 11.65, chance: 3.455 },
                { short: "BS", price: 7.74, chance: 1.541 }
            ]
        },
        {
            name: "M4A1-S | Black Lotus",
            color: "#d32ce6",
            rarities: [
                { short: "BS", price: 10.21, chance: 3.413 }
            ]
        },
        {
            name: "AWP | Phobos",
            color: "#8847ff",
            rarities: [
                { short: "FN", price: 8.77, chance: 0.1 },
                { short: "WW", price: 7.21, chance: 0.091 },
                { short: "MW", price: 3.99, chance: 4.092 },
                { short: "FT", price: 3.50, chance: 4.655 }
            ]
        },
        {
            name: "AK-47 | Ice Coaled",
            color: "#d32ce6",
            rarities: [
                { short: "FT", price: 7.77, chance: 4.723 }
            ]
        },
        {
            name: "UMP-45 | K.O. Factory",
            color: "#d32ce6",
            rarities: [
                { short: "WW", price: 7.07, chance: 1.219 },
                { short: "BS", price: 6.64, chance: 3.537 }
            ]
        },
        {
            name: "Zeus x27 | Olympus",
            color: "#d32ce6",
            rarities: [
                { short: "BS", price: 5.68, chance: 3.424 },
                { short: "FT", price: 5.28, chance: 2.254 }
            ]
        },
        {
            name: "M4A1-S | Night Terror",
            color: "#8847ff",
            rarities: [
                { short: "FN", price: 3.69, chance: 3.132 },
                { short: "MW", price: 1.43, chance: 2.78 },
                { short: "WW", price: 1.50, chance: 0.764 },
                { short: "BS", price: 1.39, chance: 0.853 },
                { short: "FT", price: 1.10, chance: 3.22 }
            ]
        },
        {
            name: "P90 | Randy Rush",
            color: "#8847ff",
            rarities: [
                { short: "MW", price: 2.39, chance: 0.785 },
                { short: "FT", price: 1.10, chance: 6.098 },
                { short: "BS", price: 0.94, chance: 6.276 }
            ]
        },
        {
            name: "Desert Eagle | Serpent Strike",
            color: "#8847ff",
            rarities: [
                { short: "MW", price: 1.84, chance: 0.695 },
                { short: "WW", price: 0.98, chance: 3.107 },
                { short: "BS", price: 0.86, chance: 2.085 },
                { short: "FT", price: 0.84, chance: 3.179 }
            ]
        },
        {
            name: "Galil AR | Control",
            color: "#8847ff",
            rarities: [
                { short: "MW", price: 1.83, chance: 0.775 },
                { short: "WW", price: 0.76, chance: 3.185 },
                { short: "BS", price: 0.74, chance: 3.679 },
                { short: "FT", price: 0.74, chance: 3.316 }
            ]
        },
        {
            name: "Zeus x27 | Tosai",
            color: "#8847ff",
            rarities: [
                { short: "MW", price: 1.30, chance: 3.226 },
                { short: "WW", price: 0.74, chance: 3.825 },
                { short: "FT", price: 0.74, chance: 3.146 },
                { short: "BS", price: 0.74, chance: 2.896 }
            ]
        }
    ]
},
let_him_cook: {
    name: "LET HIM COOK",
    price: 20.00,
    img: "https://key-drop.com/uploads/skins/4_LET_HIM_COOK.png",
    tag: "BOXES",
    items: [
        {
            name: "AK-47 | Hydroponic",
            color: "#d32ce6",
            rarities: [
                { short: "MW", price: 4365.79, chance: 0.01 }
            ]
        },
        {
            name: "★ Nomad Knife | Doppler Ruby",
            color: "#ffb703",
            rarities: [
                { short: "FN", price: 2167.74, chance: 0.01 }
            ]
        },
        {
            name: "★ M9 Bayonet | Fade",
            color: "#ffb703",
            rarities: [
                { short: "FN", price: 1622.02, chance: 0.015 }
            ]
        },
        {
            name: "★ Karambit | Tiger Tooth",
            color: "#ffb703",
            rarities: [
                { short: "FN", price: 1480.04, chance: 0.03 }
            ]
        },
        {
            name: "★ Bayonet | Gamma Doppler Phase 2",
            color: "#ffb703",
            rarities: [
                { short: "FN", price: 1006.04, chance: 0.031 }
            ]
        },
        {
            name: "★ Sport Gloves | Amphibious",
            color: "#ffb703",
            rarities: [
                { short: "BS", price: 426.68, chance: 0.054 }
            ]
        },
        {
            name: "★ Navaja Knife | Doppler Phase 4",
            color: "#ffb703",
            rarities: [
                { short: "FN", price: 196.75, chance: 0.079 }
            ]
        },
        {
            name: "★ Survival Knife | Case Hardened",
            color: "#ffb703",
            rarities: [
                { short: "FT", price: 154.30, chance: 0.13 }
            ]
        },
        {
            name: "★ Gut Knife | Bright Water",
            color: "#ffb703",
            rarities: [
                { short: "FN", price: 124.91, chance: 0.192 }
            ]
        },
        {
            name: "★ Shadow Daggers | Lore",
            color: "#ffb703",
            rarities: [
                { short: "FT", price: 97.64, chance: 0.149 }
            ]
        },
        {
            name: "AWP | Printstream",
            color: "#eb4b4b",
            rarities: [
                { short: "FT", price: 82.39, chance: 0.104 },
                { short: "BS", price: 71.79, chance: 0.18 }
            ]
        },
        {
            name: "AK-47 | Neon Rider",
            color: "#eb4b4b",
            rarities: [
                { short: "FT", price: 73.97, chance: 0.212 },
                { short: "BS", price: 65.34, chance: 0.218 }
            ]
        },
        {
            name: "AK-47 | Asiimov",
            color: "#eb4b4b",
            rarities: [
                { short: "FT", price: 63.03, chance: 1.072 }
            ]
        },
        {
            name: "M4A4 | Temukau",
            color: "#eb4b4b",
            rarities: [
                { short: "FT", price: 56.30, chance: 0.731 },
                { short: "WW", price: 46.69, chance: 0.554 },
                { short: "BS", price: 44.69, chance: 4.832 }
            ]
        },
        {
            name: "AWP | The End",
            color: "#d32ce6",
            rarities: [
                { short: "FT", price: 46.58, chance: 1.188 }
            ]
        },
        {
            name: "SG 553 | Integrale",
            color: "#d32ce6",
            rarities: [
                { short: "MW", price: 37.13, chance: 4.389 },
                { short: "FT", price: 13.44, chance: 1.355 },
                { short: "WW", price: 6.27, chance: 1.374 },
                { short: "BS", price: 5.16, chance: 4.722 }
            ]
        },
        {
            name: "AK-47 | Nouveau Rouge",
            color: "#d32ce6",
            rarities: [
                { short: "FT", price: 30.71, chance: 2.043 },
                { short: "WW", price: 20.49, chance: 7.451 }
            ]
        },
        {
            name: "AWP | Mortis",
            color: "#d32ce6",
            rarities: [
                { short: "FN", price: 29.54, chance: 0.28 },
                { short: "MW", price: 9.23, chance: 1.312 },
                { short: "WW", price: 7.23, chance: 1.435 },
                { short: "BS", price: 6.37, chance: 1.386 },
                { short: "FT", price: 6.14, chance: 2.228 }
            ]
        },
        {
            name: "M4A4 | Tooth Fairy",
            color: "#d32ce6",
            rarities: [
                { short: "FN", price: 26.84, chance: 0.302 },
                { short: "MW", price: 9.21, chance: 0.368 },
                { short: "WW", price: 5.97, chance: 2.746 },
                { short: "FT", price: 5.82, chance: 3.686 },
                { short: "BS", price: 5.62, chance: 2.74 }
            ]
        },
        {
            name: "AK-47 | Frontside Misty",
            color: "#d32ce6",
            rarities: [
                { short: "BS", price: 26.00, chance: 6.19 }
            ]
        },
        {
            name: "M4A1-S | Stratosphere",
            color: "#d32ce6",
            rarities: [
                { short: "WW", price: 17.16, chance: 5.878 },
                { short: "FT", price: 15.31, chance: 6.11 },
                { short: "BS", price: 13.54, chance: 0.446 }
            ]
        },
        {
            name: "AK-47 | Phantom Disruptor",
            color: "#d32ce6",
            rarities: [
                { short: "MW", price: 13.41, chance: 0.428 },
                { short: "WW", price: 11.91, chance: 2.316 },
                { short: "BS", price: 8.82, chance: 2.322 },
                { short: "FT", price: 8.42, chance: 3.986 }
            ]
        },
        {
            name: "AWP | Duality",
            color: "#d32ce6",
            rarities: [
                { short: "MW", price: 9.71, chance: 0.46 },
                { short: "FT", price: 5.05, chance: 6.69 }
            ]
        },
        {
            name: "M4A1-S | Solitude",
            color: "#d32ce6",
            rarities: [
                { short: "MW", price: 7.11, chance: 0.438 },
                { short: "WW", price: 3.73, chance: 5.679 },
                { short: "FT", price: 2.93, chance: 5.648 },
                { short: "BS", price: 2.13, chance: 5.801 }
            ]
        }
    ]
},
sauce_it_up: {
    name: "SAUCE IT UP",
    price: 50.00,
    img: "https://key-drop.com/uploads/skins/5_SAUCE_IT_UP.png",
    tag: "BOXES",
    items: [
        {
            name: "AK-47 | Wild Lotus",
            color: "#eb4b4b",
            rarities: [
                { short: "WW", price: 8432.25, chance: 0.01 }
            ]
        },
        {
            name: "★ Skeleton Knife | Doppler Ruby",
            color: "#ffb703",
            rarities: [
                { short: "FN", price: 4906.58, chance: 0.022 }
            ]
        },
        {
            name: "★ M9 Bayonet | Doppler Phase 1",
            color: "#ffb703",
            rarities: [
                { short: "FN", price: 1608.16, chance: 0.035 }
            ]
        },
        {
            name: "Desert Eagle | Blaze",
            color: "#8847ff",
            rarities: [
                { short: "FN", price: 1258.08, chance: 0.113 }
            ]
        },
        {
            name: "★ Butterfly Knife | Lore",
            color: "#ffb703",
            rarities: [
                { short: "FT", price: 1062.39, chance: 0.048 }
            ]
        },
        {
            name: "★ Skeleton Knife | Fade",
            color: "#ffb703",
            rarities: [
                { short: "FN", price: 908.57, chance: 0.049 }
            ]
        },
        {
            name: "★ Skeleton Knife | Marble Fade",
            color: "#ffb703",
            rarities: [
                { short: "FN", price: 680.73, chance: 0.119 }
            ]
        },
        {
            name: "★ Survival Knife | Doppler Phase 1",
            color: "#ffb703",
            rarities: [
                { short: "FN", price: 319.30, chance: 0.144 }
            ]
        },
        {
            name: "★ Gut Knife | Gamma Doppler Phase 4",
            color: "#ffb703",
            rarities: [
                { short: "FN", price: 259.54, chance: 0.259 }
            ]
        },
        {
            name: "★ Paracord Knife | Fade",
            color: "#ffb703",
            rarities: [
                { short: "FN", price: 244.12, chance: 0.31 }
            ]
        },
        {
            name: "★ Huntsman Knife | Autotronic",
            color: "#ffb703",
            rarities: [
                { short: "FT", price: 158.73, chance: 1.741 }
            ]
        },
        {
            name: "AWP | Asiimov",
            color: "#eb4b4b",
            rarities: [
                { short: "WW", price: 140.63, chance: 1.734 },
                { short: "BS", price: 114.16, chance: 1.847 }
            ]
        },
        {
            name: "★ Survival Knife | Stained",
            color: "#ffb703",
            rarities: [
                { short: "FT", price: 105.88, chance: 1.954 }
            ]
        },
        {
            name: "★ Shadow Daggers | Lore",
            color: "#ffb703",
            rarities: [
                { short: "FT", price: 97.64, chance: 2.019 }
            ]
        },
        {
            name: "★ Gut Knife | Bright Water",
            color: "#ffb703",
            rarities: [
                { short: "FT", price: 93.62, chance: 4.016 }
            ]
        },
        {
            name: "AWP | Wildfire",
            color: "#eb4b4b",
            rarities: [
                { short: "FT", price: 73.22, chance: 0.304 },
                { short: "WW", price: 72.50, chance: 0.324 },
                { short: "BS", price: 62.68, chance: 2.427 }
            ]
        },
        {
            name: "Desert Eagle | Printstream",
            color: "#eb4b4b",
            rarities: [
                { short: "WW", price: 58.10, chance: 3.123 },
                { short: "FT", price: 57.57, chance: 4.901 },
                { short: "BS", price: 47.99, chance: 5.098 }
            ]
        },
        {
            name: "AK-47 | Head Shot",
            color: "#eb4b4b",
            rarities: [
                { short: "WW", price: 45.21, chance: 1.658 },
                { short: "BS", price: 42.10, chance: 5.231 }
            ]
        },
        {
            name: "AK-47 | Ice Coaled",
            color: "#d32ce6",
            rarities: [
                { short: "FN", price: 33.34, chance: 0.645 },
                { short: "MW", price: 13.60, chance: 2.607 },
                { short: "WW", price: 9.23, chance: 2.409 },
                { short: "FT", price: 7.77, chance: 3.449 },
                { short: "BS", price: 6.92, chance: 2.111 }
            ]
        },
        {
            name: "AK-47 | The Outsiders",
            color: "#d32ce6",
            rarities: [
                { short: "MW", price: 31.74, chance: 5.944 },
                { short: "WW", price: 13.83, chance: 2.347 },
                { short: "FT", price: 13.59, chance: 2.439 },
                { short: "BS", price: 13.56, chance: 1.353 }
            ]
        },
        {
            name: "AK-47 | Nouveau Rouge",
            color: "#d32ce6",
            rarities: [
                { short: "FT", price: 30.71, chance: 3.335 },
                { short: "WW", price: 20.49, chance: 2.959 },
                { short: "BS", price: 19.84, chance: 2.979 }
            ]
        },
        {
            name: "M4A1-S | Black Lotus",
            color: "#d32ce6",
            rarities: [
                { short: "FN", price: 30.53, chance: 0.204 },
                { short: "MW", price: 14.54, chance: 1.861 },
                { short: "WW", price: 11.20, chance: 1.963 },
                { short: "BS", price: 10.21, chance: 1.982 },
                { short: "FT", price: 9.03, chance: 2.984 }
            ]
        },
        {
            name: "AWP | Ice Coaled",
            color: "#d32ce6",
            rarities: [
                { short: "MW", price: 27.99, chance: 0.785 },
                { short: "FT", price: 15.73, chance: 2.754 },
                { short: "WW", price: 11.65, chance: 1.567 },
                { short: "BS", price: 7.74, chance: 3.909 }
            ]
        },
        {
            name: "M4A1-S | Nightmare",
            color: "#d32ce6",
            rarities: [
                { short: "WW", price: 12.59, chance: 5.907 },
                { short: "BS", price: 12.34, chance: 6.021 }
            ]
        }
    ]
},
dragon_roll: {
    name: "DRAGON ROLL",
    price: 250.00,
    img: "https://key-drop.com/uploads/skins/6_DRAGON_ROLL.png",
    tag: "BOXES",
    items: [
        {
            name: "★ M9 Bayonet | Gamma Doppler Emerald",
            color: "#ffb703",
            rarities: [
                { short: "FN", price: 13538.63, chance: 0.01 }
            ]
        },
        {
            name: "AWP | Dragon Lore",
            color: "#eb4b4b",
            rarities: [
                { short: "FT", price: 9831.80, chance: 0.021 }
            ]
        },
        {
            name: "★ Karambit | Doppler Sapphire",
            color: "#ffb703",
            rarities: [
                { short: "FN", price: 7722.23, chance: 0.04 }
            ]
        },
        {
            name: "M4A4 | Howl",
            color: "#ffb703",
            rarities: [
                { short: "FT", price: 6654.14, chance: 0.029 }
            ]
        },
        {
            name: "★ Skeleton Knife | Doppler Ruby",
            color: "#ffb703",
            rarities: [
                { short: "FN", price: 4906.58, chance: 0.062 }
            ]
        },
        {
            name: "★ Bayonet | Gamma Doppler Emerald",
            color: "#ffb703",
            rarities: [
                { short: "FN", price: 2887.30, chance: 0.051 }
            ]
        },
        {
            name: "★ Skeleton Knife | Doppler Sapphire",
            color: "#ffb703",
            rarities: [
                { short: "FN", price: 2680.08, chance: 0.05 }
            ]
        },
        {
            name: "★ Ursus Knife | Doppler Ruby",
            color: "#ffb703",
            rarities: [
                { short: "FN", price: 1300.64, chance: 0.201 }
            ]
        },
        {
            name: "★ Bowie Knife | Doppler Sapphire",
            color: "#ffb703",
            rarities: [
                { short: "FN", price: 769.91, chance: 1.999 }
            ]
        },
        {
            name: "★ Bayonet | Doppler Phase 1",
            color: "#ffb703",
            rarities: [
                { short: "FN", price: 644.51, chance: 2.04 }
            ]
        },
        {
            name: "★ Bayonet | Marble Fade",
            color: "#ffb703",
            rarities: [
                { short: "FN", price: 562.56, chance: 3.022 }
            ]
        },
        {
            name: "★ Sport Gloves | Amphibious",
            color: "#ffb703",
            rarities: [
                { short: "FT", price: 545.26, chance: 1.461 },
                { short: "WW", price: 517.36, chance: 3.862 }
            ]
        },
        {
            name: "★ Shadow Daggers | Doppler Ruby",
            color: "#ffb703",
            rarities: [
                { short: "FN", price: 524.75, chance: 3.018 }
            ]
        },
        {
            name: "AWP | Hyper Beast",
            color: "#eb4b4b",
            rarities: [
                { short: "FN", price: 404.00, chance: 0.059 },
                { short: "MW", price: 86.71, chance: 0.576 },
                { short: "FT", price: 56.56, chance: 2.946 },
                { short: "BS", price: 51.32, chance: 3.238 }
            ]
        },
        {
            name: "★ Gut Knife | Gamma Doppler Phase 2",
            color: "#ffb703",
            rarities: [
                { short: "FN", price: 273.23, chance: 4.849 }
            ]
        },
        {
            name: "★ Bayonet | Freehand",
            color: "#ffb703",
            rarities: [
                { short: "MW", price: 271.20, chance: 4.908 },
                { short: "FT", price: 238.23, chance: 4.916 }
            ]
        },
        {
            name: "★ Ursus Knife | Marble Fade",
            color: "#ffb703",
            rarities: [
                { short: "FN", price: 264.28, chance: 5.006 }
            ]
        },
        {
            name: "★ Gut Knife | Doppler Phase 1",
            color: "#ffb703",
            rarities: [
                { short: "FN", price: 207.60, chance: 17.41 }
            ]
        },
        {
            name: "AWP | Chrome Cannon",
            color: "#eb4b4b",
            rarities: [
                { short: "FN", price: 161.24, chance: 0.098 },
                { short: "MW", price: 60.19, chance: 3.111 },
                { short: "WW", price: 42.84, chance: 3.338 },
                { short: "BS", price: 41.70, chance: 0.71 },
                { short: "FT", price: 40.07, chance: 2.685 }
            ]
        },
        {
            name: "AWP | Printstream",
            color: "#eb4b4b",
            rarities: [
                { short: "MW", price: 148.35, chance: 0.105 },
                { short: "BS", price: 71.79, chance: 3.643 }
            ]
        },
        {
            name: "★ Shadow Daggers | Tiger Tooth",
            color: "#ffb703",
            rarities: [
                { short: "FN", price: 136.65, chance: 2.568 }
            ]
        },
        {
            name: "AK-47 | Neon Rider",
            color: "#eb4b4b",
            rarities: [
                { short: "MW", price: 119.89, chance: 0.097 },
                { short: "WW", price: 83.03, chance: 0.585 },
                { short: "FT", price: 73.97, chance: 3.046 },
                { short: "BS", price: 65.34, chance: 3.102 }
            ]
        },
        {
            name: "AWP | Wildfire",
            color: "#eb4b4b",
            rarities: [
                { short: "MW", price: 116.69, chance: 0.097 },
                { short: "FT", price: 73.22, chance: 3.146 },
                { short: "WW", price: 72.50, chance: 0.702 },
                { short: "BS", price: 62.68, chance: 3.132 }
            ]
        },
        {
            name: "AK-47 | Asiimov",
            color: "#eb4b4b",
            rarities: [
                { short: "MW", price: 72.81, chance: 0.577 },
                { short: "WW", price: 65.79, chance: 3.109 },
                { short: "FT", price: 63.03, chance: 3.117 },
                { short: "BS", price: 60.69, chance: 3.258 }
            ]
        }
    ]
},
agroflux: {
    name: "AGROFLUX",
    price: 1.00,
    img: "https://key-drop.com/uploads/skins/XDDDDDDDD_1.png",
    tag: "BOXES",
    items: [
        {
            name: "★ Survival Knife | Doppler Phase 3",
            color: "#ffb703",
            rarities: [
                { short: "FN", price: 328.60, chance: 0.022 }
            ]
        },
        {
            name: "M4A1-S | Chantico's Fire",
            color: "#eb4b4b",
            rarities: [
                { short: "FT", price: 176.89, chance: 0.009 },
                { short: "BS", price: 157.65, chance: 0.017 }
            ]
        },
        {
            name: "★ Broken Fang Gloves | Jade",
            color: "#ffb703",
            rarities: [
                { short: "FT", price: 137.98, chance: 0.008 }
            ]
        },
        {
            name: "AK-47 | Nightwish",
            color: "#eb4b4b",
            rarities: [
                { short: "FT", price: 91.23, chance: 0.013 }
            ]
        },
        {
            name: "Dual Berettas | Twin Turbo",
            color: "#d32ce6",
            rarities: [
                { short: "FN", price: 64.73, chance: 0.001 },
                { short: "MW", price: 9.33, chance: 0.031 },
                { short: "FT", price: 4.07, chance: 0.096 },
                { short: "WW", price: 2.50, chance: 1.007 },
                { short: "BS", price: 2.53, chance: 0.999 }
            ]
        },
        {
            name: "AWP | Neo-Noir",
            color: "#eb4b4b",
            rarities: [
                { short: "FT", price: 63.77, chance: 0.023 }
            ]
        },
        {
            name: "MP7 | Smoking Kills",
            color: "#d32ce6",
            rarities: [
                { short: "FN", price: 63.77, chance: 0.004 },
                { short: "MW", price: 22.48, chance: 0.013 },
                { short: "FT", price: 13.29, chance: 0.012 },
                { short: "WW", price: 9.71, chance: 0.025 },
                { short: "BS", price: 7.43, chance: 0.064 }
            ]
        },
        {
            name: "USP-S | Cortex",
            color: "#d32ce6",
            rarities: [
                { short: "FN", price: 48.82, chance: 0.002 },
                { short: "MW", price: 12.89, chance: 0.002 },
                { short: "FT", price: 5.65, chance: 0.035 },
                { short: "WW", price: 5.59, chance: 0.036 },
                { short: "BS", price: 5.64, chance: 0.014 }
            ]
        },
        {
            name: "AK-47 | Ice Coaled",
            color: "#d32ce6",
            rarities: [
                { short: "FN", price: 29.61, chance: 0.003 },
                { short: "FT", price: 7.88, chance: 0.057 },
                { short: "BS", price: 7.07, chance: 0.076 }
            ]
        },
        {
            name: "M4A4 | Tooth Fairy",
            color: "#d32ce6",
            rarities: [
                { short: "FN", price: 27.66, chance: 0.012 },
                { short: "MW", price: 8.72, chance: 0.019 },
                { short: "WW", price: 6.04, chance: 0.038 },
                { short: "FT", price: 5.38, chance: 0.012 },
                { short: "BS", price: 5.61, chance: 0.143 }
            ]
        },
        {
            name: "FAMAS | Neural Net",
            color: "#8847ff",
            rarities: [
                { short: "FN", price: 17.31, chance: 0.001 },
                { short: "MW", price: 3.05, chance: 0.902 },
                { short: "WW", price: 2.14, chance: 2.596 },
                { short: "FT", price: 1.54, chance: 0.09 },
                { short: "BS", price: 1.51, chance: 0.081 }
            ]
        },
        {
            name: "SSG 08 | Abyss",
            color: "#4b69ff",
            rarities: [
                { short: "FN", price: 10.51, chance: 0.012 },
                { short: "MW", price: 1.24, chance: 1.676 },
                { short: "FT", price: 0.54, chance: 0.466 },
                { short: "WW", price: 0.40, chance: 0.467 },
                { short: "BS", price: 0.40, chance: 0.425 }
            ]
        },
        {
            name: "MAG-7 | Monster Call",
            color: "#8847ff",
            rarities: [
                { short: "FN", price: 8.48, chance: 0.008 },
                { short: "MW", price: 1.64, chance: 0.078 },
                { short: "FT", price: 0.74, chance: 2.075 },
                { short: "WW", price: 0.68, chance: 0.448 },
                { short: "BS", price: 0.64, chance: 0.453 }
            ]
        },
        {
            name: "MP9 | Food Chain",
            color: "#d32ce6",
            rarities: [
                { short: "FT", price: 6.29, chance: 0.051 },
                { short: "WW", price: 5.24, chance: 0.093 },
                { short: "BS", price: 5.68, chance: 0.098 }
            ]
        },
        {
            name: "M4A1-S | Emphorosaur-S",
            color: "#8847ff",
            rarities: [
                { short: "FN", price: 5.80, chance: 0.005 },
                { short: "MW", price: 1.73, chance: 2.587 },
                { short: "WW", price: 1.16, chance: 1.918 },
                { short: "FT", price: 0.79, chance: 2.323 },
                { short: "BS", price: 0.89, chance: 2.134 }
            ]
        },
        {
            name: "Galil AR | Signal",
            color: "#8847ff",
            rarities: [
                { short: "FN", price: 5.61, chance: 0.067 },
                { short: "MW", price: 1.68, chance: 0.09 },
                { short: "WW", price: 1.18, chance: 1.747 },
                { short: "FT", price: 1.01, chance: 1.848 },
                { short: "BS", price: 1.09, chance: 1.683 }
            ]
        },
        {
            name: "Five-SeveN | Violent Daimyo",
            color: "#4b69ff",
            rarities: [
                { short: "FN", price: 4.22, chance: 1.28 },
                { short: "MW", price: 1.21, chance: 1.68 },
                { short: "FT", price: 0.78, chance: 2.264 },
                { short: "WW", price: 0.78, chance: 2.331 },
                { short: "BS", price: 0.60, chance: 0.426 }
            ]
        },
        {
            name: "M4A1-S | Night Terror",
            color: "#8847ff",
            rarities: [
                { short: "FN", price: 3.70, chance: 0.094 },
                { short: "MW", price: 1.60, chance: 0.093 },
                { short: "WW", price: 1.46, chance: 0.095 },
                { short: "BS", price: 1.39, chance: 0.085 },
                { short: "FT", price: 1.00, chance: 1.939 }
            ]
        },
        {
            name: "PP-Bizon | Space Cat",
            color: "#8847ff",
            rarities: [
                { short: "FN", price: 3.54, chance: 0.107 },
                { short: "MW", price: 1.28, chance: 1.761 },
                { short: "FT", price: 0.91, chance: 2.276 },
                { short: "WW", price: 0.89, chance: 2.396 },
                { short: "BS", price: 0.85, chance: 2.231 }
            ]
        },
        {
            name: "P90 | Grim",
            color: "#4b69ff",
            rarities: [
                { short: "FN", price: 1.94, chance: 0.071 },
                { short: "MW", price: 0.44, chance: 0.457 },
                { short: "FT", price: 0.40, chance: 0.481 },
                { short: "WW", price: 0.39, chance: 0.399 },
                { short: "BS", price: 0.35, chance: 0.372 }
            ]
        },
        {
            name: "AK-47 | VariCamo Grey",
            color: "#5e98d9",
            rarities: [
                { short: "FN", price: 1.29, chance: 0.096 },
                { short: "MW", price: 0.38, chance: 0.507 },
                { short: "BS", price: 0.30, chance: 0.502 },
                { short: "WW", price: 0.51, chance: 0.457 },
                { short: "FT", price: 0.09, chance: 11.472 }
            ]
        },
        {
            name: "M4A1-S | Wash me plz",
            color: "#5e98d9",
            rarities: [
                { short: "FN", price: 1.04, chance: 1.849 },
                { short: "MW", price: 0.18, chance: 9.382 },
                { short: "WW", price: 0.14, chance: 7.374 },
                { short: "FT", price: 0.06, chance: 20.104 },
                { short: "BS", price: 0.10, chance: 0.204 }
            ]
        }
    ]
},
magic_trick: {
    name: "MAGIC TRICK",
    price: 2.50,
    img: "https://key-drop.com/uploads/skins/2_MAGIC_TRICK.png",
    tag: "BOXES",
    items: [
        {
            name: "★ Bayonet | Tiger Tooth",
            color: "#ffb703",
            rarities: [
                { short: "FN", price: 469.03, chance: 0.006 }
            ]
        },
        {
            name: "★ Survival Knife | Marble Fade",
            color: "#ffb703",
            rarities: [
                { short: "FN", price: 224.66, chance: 0.007 }
            ]
        },
        {
            name: "M4A1-S | Hyper Beast",
            color: "#eb4b4b",
            rarities: [
                { short: "FT", price: 176.75, chance: 0.017 }
            ]
        },
        {
            name: "M4A4 | Full Throttle",
            color: "#eb4b4b",
            rarities: [
                { short: "MW", price: 148.59, chance: 0.011 },
                { short: "FT", price: 77.05, chance: 0.021 },
                { short: "WW", price: 53.34, chance: 0.039 },
                { short: "BS", price: 45.34, chance: 0.023 }
            ]
        },
        {
            name: "★ Broken Fang Gloves | Jade",
            color: "#ffb703",
            rarities: [
                { short: "FT", price: 137.98, chance: 0.014 }
            ]
        },
        {
            name: "AK-47 | Head Shot",
            color: "#eb4b4b",
            rarities: [
                { short: "MW", price: 99.52, chance: 0.004 },
                { short: "FT", price: 58.45, chance: 0.085 }
            ]
        },
        {
            name: "AK-47 | Inheritance",
            color: "#eb4b4b",
            rarities: [
                { short: "FT", price: 71.35, chance: 0.07 }
            ]
        },
        {
            name: "AK-47 | Asiimov",
            color: "#eb4b4b",
            rarities: [
                { short: "BS", price: 65.14, chance: 0.06 }
            ]
        },
        {
            name: "M4A1-S | Nightmare",
            color: "#d32ce6",
            rarities: [
                { short: "MW", price: 40.32, chance: 0.005 },
                { short: "WW", price: 12.59, chance: 0.464 },
                { short: "BS", price: 12.80, chance: 0.516 }
            ]
        },
        {
            name: "Glock-18 | Shinobu",
            color: "#d32ce6",
            rarities: [
                { short: "MW", price: 15.84, chance: 0.006 },
                { short: "FT", price: 7.37, chance: 0.54 },
                { short: "BS", price: 7.33, chance: 0.456 }
            ]
        },
        {
            name: "AK-47 | Searing Rage",
            color: "#d32ce6",
            rarities: [
                { short: "MW", price: 14.89, chance: 0.005 },
                { short: "WW", price: 7.48, chance: 0.52 },
                { short: "BS", price: 6.22, chance: 0.541 }
            ]
        },
        {
            name: "R8 Revolver | Crazy 8",
            color: "#8847ff",
            rarities: [
                { short: "FN", price: 10.41, chance: 0.193 },
                { short: "MW", price: 1.81, chance: 0.589 },
                { short: "FT", price: 0.75, chance: 3.512 },
                { short: "WW", price: 0.66, chance: 3.122 },
                { short: "BS", price: 0.64, chance: 3.213 }
            ]
        },
        {
            name: "AWP | Acheron",
            color: "#4b69ff",
            rarities: [
                { short: "FN", price: 9.96, chance: 0.396 },
                { short: "MW", price: 1.98, chance: 5.813 },
                { short: "WW", price: 1.73, chance: 0.517 },
                { short: "FT", price: 0.84, chance: 0.53 },
                { short: "BS", price: 0.85, chance: 2.933 }
            ]
        },
        {
            name: "M4A4 | Tooth Fairy",
            color: "#d32ce6",
            rarities: [
                { short: "MW", price: 8.72, chance: 0.191 },
                { short: "FT", price: 5.38, chance: 4.114 }
            ]
        },
        {
            name: "AK-47 | Ice Coaled",
            color: "#d32ce6",
            rarities: [
                { short: "FT", price: 7.88, chance: 0.384 }
            ]
        },
        {
            name: "M4A1-S | Emphorosaur-S",
            color: "#8847ff",
            rarities: [
                { short: "FN", price: 5.80, chance: 3.84 },
                { short: "MW", price: 1.73, chance: 6.318 },
                { short: "WW", price: 1.16, chance: 0.627 },
                { short: "FT", price: 0.79, chance: 0.651 },
                { short: "BS", price: 0.89, chance: 0.577 }
            ]
        },
        {
            name: "M4A1-S | Solitude",
            color: "#d32ce6",
            rarities: [
                { short: "WW", price: 3.73, chance: 0.176 },
                { short: "BS", price: 2.13, chance: 6.981 }
            ]
        },
        {
            name: "M4A1-S | Night Terror",
            color: "#8847ff",
            rarities: [
                { short: "FN", price: 3.70, chance: 0.197 },
                { short: "WW", price: 1.46, chance: 0.633 },
                { short: "FT", price: 1.00, chance: 0.665 }
            ]
        },
        {
            name: "AWP | Worm God",
            color: "#8847ff",
            rarities: [
                { short: "FT", price: 3.67, chance: 0.191 }
            ]
        },
        {
            name: "AWP | Phobos",
            color: "#8847ff",
            rarities: [
                { short: "FT", price: 3.54, chance: 0.177 }
            ]
        },
        {
            name: "P90 | Neoqueen",
            color: "#8847ff",
            rarities: [
                { short: "FN", price: 3.15, chance: 3.512 },
                { short: "MW", price: 1.14, chance: 0.57 },
                { short: "FT", price: 0.71, chance: 3.172 },
                { short: "WW", price: 0.70, chance: 3.361 },
                { short: "BS", price: 0.69, chance: 3.415 }
            ]
        },
        {
            name: "Galil AR | Crimson Tsunami",
            color: "#8847ff",
            rarities: [
                { short: "FT", price: 3.07, chance: 3.438 },
                { short: "BS", price: 2.85, chance: 3.536 },
                { short: "WW", price: 2.77, chance: 3.431 }
            ]
        },
        {
            name: "MP5-SD | Liquidation",
            color: "#4b69ff",
            rarities: [
                { short: "FN", price: 1.73, chance: 0.563 },
                { short: "MW", price: 0.30, chance: 3.02 },
                { short: "FT", price: 0.09, chance: 6.612 },
                { short: "WW", price: 0.08, chance: 0.232 },
                { short: "BS", price: 0.08, chance: 5.831 }
            ]
        },
        {
            name: "Tec-9 | Red Quartz",
            color: "#8847ff",
            rarities: [
                { short: "FN", price: 0.63, chance: 3.138 },
                { short: "MW", price: 0.49, chance: 3.083 },
                { short: "FT", price: 0.48, chance: 3.136 }
            ]
        }
    ]
},
twinkle: {
    name: "TWINKLE",
    price: 5.00,
    img: "https://key-drop.com/uploads/skins/TWINKLE.png",
    tag: "BOXES",
    items: [
        {
            name: "★ Bayonet | Gamma Doppler Phase 2",
            color: "#ffb703",
            rarities: [
                { short: "FN", price: 1006.04, chance: 0.013 }
            ]
        },
        {
            name: "AWP | Wildfire",
            color: "#eb4b4b",
            rarities: [
                { short: "FN", price: 424.57, chance: 0.006 },
                { short: "MW", price: 112.33, chance: 0.004 },
                { short: "FT", price: 73.22, chance: 0.007 },
                { short: "WW", price: 72.50, chance: 0.003 },
                { short: "BS", price: 62.88, chance: 0.011 }
            ]
        },
        {
            name: "★ Ursus Knife | Fade",
            color: "#ffb703",
            rarities: [
                { short: "FN", price: 346.00, chance: 0.009 }
            ]
        },
        {
            name: "★ Survival Knife | Doppler Phase 3",
            color: "#ffb703",
            rarities: [
                { short: "FN", price: 328.60, chance: 0.011 }
            ]
        },
        {
            name: "M4A1-S | Printstream",
            color: "#eb4b4b",
            rarities: [
                { short: "FT", price: 322.02, chance: 0.013 }
            ]
        },
        {
            name: "M4A1-S | Vaporwave",
            color: "#eb4b4b",
            rarities: [
                { short: "MW", price: 178.76, chance: 0.004 },
                { short: "FT", price: 91.38, chance: 0.006 },
                { short: "WW", price: 85.70, chance: 0.008 },
                { short: "BS", price: 84.67, chance: 0.008 }
            ]
        },
        {
            name: "M4A1-S | Hyper Beast",
            color: "#eb4b4b",
            rarities: [
                { short: "FT", price: 176.75, chance: 0.01 },
                { short: "BS", price: 150.71, chance: 0.004 }
            ]
        },
        {
            name: "AK-47 | Nightwish",
            color: "#eb4b4b",
            rarities: [
                { short: "BS", price: 97.70, chance: 0.034 },
                { short: "FT", price: 91.23, chance: 0.031 }
            ]
        },
        {
            name: "AK-47 | Neon Rider",
            color: "#eb4b4b",
            rarities: [
                { short: "WW", price: 86.56, chance: 0.003 },
                { short: "FT", price: 73.78, chance: 0.002 },
                { short: "BS", price: 69.95, chance: 0.003 }
            ]
        },
        {
            name: "SG 553 | Cyrex",
            color: "#d32ce6",
            rarities: [
                { short: "FN", price: 78.68, chance: 0.002 },
                { short: "MW", price: 14.00, chance: 0.327 },
                { short: "FT", price: 7.16, chance: 0.214 },
                { short: "WW", price: 6.96, chance: 0.201 },
                { short: "BS", price: 6.59, chance: 0.214 }
            ]
        },
        {
            name: "AWP | Ice Coaled",
            color: "#d32ce6",
            rarities: [
                { short: "FN", price: 77.64, chance: 0.003 },
                { short: "MW", price: 28.59, chance: 0.003 },
                { short: "FT", price: 15.86, chance: 0.34 },
                { short: "WW", price: 11.82, chance: 1.505 },
                { short: "BS", price: 9.03, chance: 1.907 }
            ]
        },
        {
            name: "P250 | Epicenter",
            color: "#d32ce6",
            rarities: [
                { short: "FN", price: 61.55, chance: 0.003 },
                { short: "MW", price: 20.38, chance: 0.519 },
                { short: "FT", price: 8.42, chance: 1.557 },
                { short: "WW", price: 7.58, chance: 1.776 },
                { short: "BS", price: 6.54, chance: 0.223 }
            ]
        },
        {
            name: "M4A1-S | Stratosphere",
            color: "#d32ce6",
            rarities: [
                { short: "MW", price: 41.25, chance: 0.004 },
                { short: "WW", price: 17.72, chance: 0.327 },
                { short: "FT", price: 15.34, chance: 0.362 },
                { short: "BS", price: 13.54, chance: 0.349 }
            ]
        },
        {
            name: "M4A1-S | Nightmare",
            color: "#d32ce6",
            rarities: [
                { short: "MW", price: 40.32, chance: 0.002 },
                { short: "FT", price: 17.00, chance: 0.323 },
                { short: "BS", price: 12.80, chance: 0.34 },
                { short: "WW", price: 12.59, chance: 0.321 }
            ]
        },
        {
            name: "AK-47 | The Outsiders",
            color: "#d32ce6",
            rarities: [
                { short: "MW", price: 31.65, chance: 0.003 },
                { short: "WW", price: 14.59, chance: 0.318 },
                { short: "FT", price: 14.40, chance: 0.345 },
                { short: "BS", price: 13.87, chance: 0.305 }
            ]
        },
        {
            name: "AWP | Mortis",
            color: "#d32ce6",
            rarities: [
                { short: "FN", price: 30.23, chance: 0.014 },
                { short: "MW", price: 9.22, chance: 1.44 },
                { short: "WW", price: 7.23, chance: 2.087 },
                { short: "BS", price: 6.68, chance: 2.243 },
                { short: "FT", price: 4.88, chance: 2.492 }
            ]
        },
        {
            name: "M4A4 | Tooth Fairy",
            color: "#d32ce6",
            rarities: [
                { short: "FN", price: 27.66, chance: 0.003 },
                { short: "MW", price: 8.72, chance: 1.473 },
                { short: "WW", price: 6.04, chance: 2.463 },
                { short: "BS", price: 5.61, chance: 2.388 },
                { short: "FT", price: 5.38, chance: 2.375 }
            ]
        },
        {
            name: "Dual Berettas | Hydro Strike",
            color: "#8847ff",
            rarities: [
                { short: "FN", price: 15.73, chance: 0.945 },
                { short: "MW", price: 3.48, chance: 4.444 },
                { short: "WW", price: 1.64, chance: 0.721 },
                { short: "FT", price: 1.25, chance: 2.216 },
                { short: "BS", price: 1.13, chance: 2.177 }
            ]
        },
        {
            name: "Galil AR | Control",
            color: "#8847ff",
            rarities: [
                { short: "FN", price: 10.50, chance: 0.159 },
                { short: "MW", price: 1.76, chance: 0.603 },
                { short: "FT", price: 0.76, chance: 2.368 },
                { short: "WW", price: 0.76, chance: 2.307 },
                { short: "BS", price: 0.71, chance: 2.038 }
            ]
        },
        {
            name: "Desert Eagle | Serpent Strike",
            color: "#8847ff",
            rarities: [
                { short: "FN", price: 5.72, chance: 2.322 },
                { short: "MW", price: 1.87, chance: 0.584 },
                { short: "WW", price: 1.01, chance: 1.901 },
                { short: "BS", price: 0.84, chance: 2.166 },
                { short: "FT", price: 0.78, chance: 2.349 }
            ]
        },
        {
            name: "Glock-18 | Coral Bloom",
            color: "#4b69ff",
            rarities: [
                { short: "FN", price: 5.62, chance: 2.496 },
                { short: "MW", price: 1.61, chance: 0.756 },
                { short: "WW", price: 0.68, chance: 2.091 },
                { short: "FT", price: 0.59, chance: 2.297 },
                { short: "BS", price: 0.46, chance: 2.222 }
            ]
        },
        {
            name: "SG 553 | Phantom",
            color: "#8847ff",
            rarities: [
                { short: "FN", price: 5.28, chance: 4.119 },
                { short: "MW", price: 1.58, chance: 0.683 },
                { short: "FT", price: 1.40, chance: 2.183 },
                { short: "WW", price: 1.40, chance: 2.157 },
                { short: "BS", price: 1.15, chance: 2.335 }
            ]
        },
        {
            name: "Zeus x27 | Tosai",
            color: "#8847ff",
            rarities: [
                { short: "FN", price: 5.05, chance: 4.304 },
                { short: "MW", price: 1.35, chance: 2.269 },
                { short: "FT", price: 0.75, chance: 2.248 },
                { short: "BS", price: 0.74, chance: 2.066 },
                { short: "WW", price: 0.71, chance: 2.279 }
            ]
        },
        {
            name: "M4A1-S | Night Terror",
            color: "#8847ff",
            rarities: [
                { short: "FN", price: 3.70, chance: 4.782 },
                { short: "MW", price: 1.60, chance: 0.784 },
                { short: "WW", price: 1.46, chance: 0.69 },
                { short: "BS", price: 1.39, chance: 0.761 },
                { short: "FT", price: 1.00, chance: 2.217 }
            ]
        }
    ]
},
last_game: {
    name: "LAST GAME",
    price: 20.00,
    img: "https://key-drop.com/uploads/skins/4_LAST_GAME.png",
    tag: "BOXES",
    items: [
        {
            name: "★ Skeleton Knife | Doppler Sapphire",
            color: "#ffb703",
            rarities: [
                { short: "FN", price: 2680.08, chance: 0.011 }
            ]
        },
        {
            name: "★ Flip Knife | Gamma Doppler Emerald",
            color: "#ffb703",
            rarities: [
                { short: "FN", price: 2167.74, chance: 0.005 }
            ]
        },
        {
            name: "★ M9 Bayonet | Tiger Tooth",
            color: "#ffb703",
            rarities: [
                { short: "FN", price: 1114.02, chance: 0.008 }
            ]
        },
        {
            name: "★ Skeleton Knife | Slaughter",
            color: "#ffb703",
            rarities: [
                { short: "FT", price: 610.57, chance: 0.025 }
            ]
        },
        {
            name: "★ Paracord Knife | Doppler Phase 4",
            color: "#ffb703",
            rarities: [
                { short: "FN", price: 353.77, chance: 0.025 }
            ]
        },
        {
            name: "★ Ursus Knife | Fade",
            color: "#ffb703",
            rarities: [
                { short: "FN", price: 346.00, chance: 0.03 }
            ]
        },
        {
            name: "★ Survival Knife | Fade",
            color: "#ffb703",
            rarities: [
                { short: "FN", price: 237.21, chance: 0.013 }
            ]
        },
        {
            name: "★ Gut Knife | Doppler Phase 4",
            color: "#ffb703",
            rarities: [
                { short: "FN", price: 206.71, chance: 0.048 }
            ]
        },
        {
            name: "★ Broken Fang Gloves | Jade",
            color: "#ffb703",
            rarities: [
                { short: "FT", price: 137.98, chance: 0.285 }
            ]
        },
        {
            name: "★ Gut Knife | Freehand",
            color: "#ffb703",
            rarities: [
                { short: "FT", price: 102.34, chance: 0.236 }
            ]
        },
        {
            name: "AK-47 | Neon Rider",
            color: "#eb4b4b",
            rarities: [
                { short: "WW", price: 86.56, chance: 0.107 },
                { short: "FT", price: 73.78, chance: 0.11 }
            ]
        },
        {
            name: "M4A1-S | Player Two",
            color: "#eb4b4b",
            rarities: [
                { short: "BS", price: 81.33, chance: 0.109 }
            ]
        },
        {
            name: "AK-47 | Searing Rage",
            color: "#d32ce6",
            rarities: [
                { short: "FN", price: 76.83, chance: 0.119 },
                { short: "MW", price: 14.89, chance: 8.493 },
                { short: "FT", price: 8.48, chance: 0.564 },
                { short: "WW", price: 7.48, chance: 0.586 },
                { short: "BS", price: 6.22, chance: 0.682 }
            ]
        },
        {
            name: "AWP | Printstream",
            color: "#eb4b4b",
            rarities: [
                { short: "WW", price: 71.10, chance: 0.109 }
            ]
        },
        {
            name: "AK-47 | Asiimov",
            color: "#eb4b4b",
            rarities: [
                { short: "BS", price: 65.14, chance: 0.874 },
                { short: "FT", price: 63.03, chance: 0.928 }
            ]
        },
        {
            name: "USP-S | Printstream",
            color: "#eb4b4b",
            rarities: [
                { short: "WW", price: 56.07, chance: 0.949 },
                { short: "FT", price: 48.52, chance: 1.148 }
            ]
        },
        {
            name: "USP-S | Monster Mashup",
            color: "#d32ce6",
            rarities: [
                { short: "FT", price: 35.40, chance: 11.272 }
            ]
        },
        {
            name: "AK-47 | Nouveau Rouge",
            color: "#d32ce6",
            rarities: [
                { short: "FT", price: 30.81, chance: 0.576 },
                { short: "BS", price: 19.03, chance: 8.922 },
                { short: "WW", price: 18.02, chance: 7.157 }
            ]
        },
        {
            name: "AK-47 | Frontside Misty",
            color: "#d32ce6",
            rarities: [
                { short: "FT", price: 27.05, chance: 0.585 },
                { short: "BS", price: 26.02, chance: 6.156 }
            ]
        },
        {
            name: "M4A4 | 龍王 (Dragon King)",
            color: "#d32ce6",
            rarities: [
                { short: "FT", price: 21.98, chance: 6.553 }
            ]
        },
        {
            name: "AK-47 | Ice Coaled",
            color: "#d32ce6",
            rarities: [
                { short: "WW", price: 9.75, chance: 0.549 },
                { short: "FT", price: 7.88, chance: 0.465 },
                { short: "BS", price: 7.07, chance: 0.581 }
            ]
        },
        {
            name: "Glock-18 | Vogue",
            color: "#d32ce6",
            rarities: [
                { short: "MW", price: 9.36, chance: 0.579 },
                { short: "WW", price: 5.98, chance: 5.18 },
                { short: "BS", price: 5.31, chance: 5.649 },
                { short: "FT", price: 5.28, chance: 5.914 }
            ]
        },
        {
            name: "USP-S | Bleeding Edge",
            color: "#8847ff",
            rarities: [
                { short: "MW", price: 8.42, chance: 0.681 },
                { short: "FT", price: 3.39, chance: 6.462 },
                { short: "WW", price: 3.38, chance: 6.495 }
            ]
        },
        {
            name: "M4A1-S | Solitude",
            color: "#d32ce6",
            rarities: [
                { short: "MW", price: 7.91, chance: 0.612 },
                { short: "WW", price: 3.73, chance: 4.597 },
                { short: "FT", price: 2.98, chance: 4.525 },
                { short: "BS", price: 2.13, chance: 1.026 }
            ]
        }
    ]
},
your_crush: {
    name: "YOUR CRUSH",
    price: 50.00,
    img: "https://key-drop.com/uploads/skins/5_YOUR_CRUSH.png",
    tag: "BOXES",
    items: [
        {
            name: "AWP | Dragon Lore",
            color: "#eb4b4b",
            rarities: [
                { short: "FT", price: 9831.80, chance: 0.01 }
            ]
        },
        {
            name: "★ Butterfly Knife | Gamma Doppler Phase 3",
            color: "#ffb703",
            rarities: [
                { short: "FN", price: 3311.37, chance: 0.019 }
            ]
        },
        {
            name: "★ M9 Bayonet | Fade",
            color: "#ffb703",
            rarities: [
                { short: "FN", price: 1622.02, chance: 0.035 }
            ]
        },
        {
            name: "★ Skeleton Knife | Doppler Phase 4",
            color: "#ffb703",
            rarities: [
                { short: "FN", price: 1158.33, chance: 0.123 }
            ]
        },
        {
            name: "★ Butterfly Knife | Lore",
            color: "#ffb703",
            rarities: [
                { short: "FT", price: 1062.39, chance: 0.058 }
            ]
        },
        {
            name: "★ Skeleton Knife | Fade",
            color: "#ffb703",
            rarities: [
                { short: "FN", price: 892.11, chance: 0.052 }
            ]
        },
        {
            name: "★ Skeleton Knife | Marble Fade",
            color: "#ffb703",
            rarities: [
                { short: "FN", price: 680.11, chance: 0.159 }
            ]
        },
        {
            name: "★ Survival Knife | Doppler Phase 4",
            color: "#ffb703",
            rarities: [
                { short: "FN", price: 338.33, chance: 0.138 }
            ]
        },
        {
            name: "★ Paracord Knife | Fade",
            color: "#ffb703",
            rarities: [
                { short: "FN", price: 244.12, chance: 0.217 }
            ]
        },
        {
            name: "★ Bayonet | Freehand",
            color: "#ffb703",
            rarities: [
                { short: "FT", price: 238.23, chance: 0.272 }
            ]
        },
        {
            name: "★ Gut Knife | Tiger Tooth",
            color: "#ffb703",
            rarities: [
                { short: "FN", price: 172.41, chance: 1.662 }
            ]
        },
        {
            name: "AWP | Asiimov",
            color: "#eb4b4b",
            rarities: [
                { short: "WW", price: 142.46, chance: 1.75 },
                { short: "BS", price: 114.16, chance: 2.06 }
            ]
        },
        {
            name: "★ Shadow Daggers | Freehand",
            color: "#ffb703",
            rarities: [
                { short: "FN", price: 104.64, chance: 1.885 },
                { short: "BS", price: 96.86, chance: 1.854 }
            ]
        },
        {
            name: "★ Gut Knife | Freehand",
            color: "#ffb703",
            rarities: [
                { short: "FT", price: 102.34, chance: 1.948 }
            ]
        },
        {
            name: "★ Shadow Daggers | Lore",
            color: "#ffb703",
            rarities: [
                { short: "FT", price: 94.52, chance: 2.036 }
            ]
        },
        {
            name: "AWP | Wildfire",
            color: "#eb4b4b",
            rarities: [
                { short: "FT", price: 73.22, chance: 0.339 },
                { short: "WW", price: 72.50, chance: 0.338 },
                { short: "BS", price: 62.88, chance: 0.355 }
            ]
        },
        {
            name: "Desert Eagle | Printstream",
            color: "#eb4b4b",
            rarities: [
                { short: "WW", price: 57.22, chance: 5.926 },
                { short: "FT", price: 48.74, chance: 6.243 },
                { short: "BS", price: 47.99, chance: 6.626 }
            ]
        },
        {
            name: "AK-47 | The Outsiders",
            color: "#d32ce6",
            rarities: [
                { short: "MW", price: 31.65, chance: 19.656 },
                { short: "WW", price: 14.59, chance: 2.282 },
                { short: "FT", price: 14.40, chance: 2.418 },
                { short: "BS", price: 13.87, chance: 2.242 }
            ]
        },
        {
            name: "AK-47 | Nouveau Rouge",
            color: "#d32ce6",
            rarities: [
                { short: "FT", price: 30.81, chance: 0.83 },
                { short: "WW", price: 18.02, chance: 0.863 },
                { short: "BS", price: 19.03, chance: 0.799 }
            ]
        },
        {
            name: "AK-47 | Ice Coaled",
            color: "#d32ce6",
            rarities: [
                { short: "FN", price: 29.61, chance: 0.724 },
                { short: "MW", price: 14.20, chance: 2.33 },
                { short: "WW", price: 9.75, chance: 2.366 },
                { short: "FT", price: 7.88, chance: 1.993 },
                { short: "BS", price: 7.07, chance: 2.475 }
            ]
        },
        {
            name: "AWP | Ice Coaled",
            color: "#d32ce6",
            rarities: [
                { short: "MW", price: 28.59, chance: 0.786 },
                { short: "FT", price: 15.86, chance: 0.782 },
                { short: "WW", price: 11.82, chance: 2.49 },
                { short: "BS", price: 9.03, chance: 2.751 }
            ]
        },
        {
            name: "M4A4 | Tooth Fairy",
            color: "#d32ce6",
            rarities: [
                { short: "FN", price: 27.66, chance: 0.751 },
                { short: "MW", price: 8.72, chance: 2.615 },
                { short: "FT", price: 5.38, chance: 4.658 },
                { short: "BS", price: 5.61, chance: 0.042 }
            ]
        },
        {
            name: "AK-47 | Phantom Disruptor",
            color: "#d32ce6",
            rarities: [
                { short: "MW", price: 14.89, chance: 2.401 },
                { short: "FT", price: 8.77, chance: 2.565 },
                { short: "BS", price: 9.51, chance: 2.214 }
            ]
        },
        {
            name: "M4A1-S | Nightmare",
            color: "#d32ce6",
            rarities: [
                { short: "BS", price: 12.80, chance: 2.437 },
                { short: "WW", price: 12.59, chance: 2.425 }
            ]
        }
    ]
},
halloqueen: {
    name: "HALLOQUEEN",
    price: 75.00,
    img: "https://key-drop.com/uploads/skins/HALLOQUEEN_2.png",
    tag: "BOXES",
    items: [
        {
            name: "AWP | Gungnir",
            color: "#eb4b4b",
            rarities: [
                { short: "FT", price: 12406.44, chance: 0.016 }
            ]
        },
        {
            name: "★ Butterfly Knife | Doppler Phase 4",
            color: "#ffb703",
            rarities: [
                { short: "FN", price: 4559.42, chance: 0.023 }
            ]
        },
        {
            name: "★ Bayonet | Doppler Ruby",
            color: "#ffb703",
            rarities: [
                { short: "FN", price: 3160.76, chance: 0.018 }
            ]
        },
        {
            name: "★ Karambit | Tiger Tooth",
            color: "#ffb703",
            rarities: [
                { short: "FN", price: 1450.12, chance: 0.068 }
            ]
        },
        {
            name: "★ Skeleton Knife | Doppler Phase 3",
            color: "#ffb703",
            rarities: [
                { short: "FN", price: 1071.92, chance: 0.062 }
            ]
        },
        {
            name: "★ Butterfly Knife | Lore",
            color: "#ffb703",
            rarities: [
                { short: "FT", price: 1062.39, chance: 0.063 }
            ]
        },
        {
            name: "★ Bayonet | Gamma Doppler Phase 3",
            color: "#ffb703",
            rarities: [
                { short: "FN", price: 806.40, chance: 0.055 }
            ]
        },
        {
            name: "★ Sport Gloves | Amphibious",
            color: "#ffb703",
            rarities: [
                { short: "FT", price: 599.04, chance: 0.064 }
            ]
        },
        {
            name: "AK-47 | Neon Revolution",
            color: "#eb4b4b",
            rarities: [
                { short: "FN", price: 527.14, chance: 0.023 },
                { short: "FT", price: 154.96, chance: 1.568 },
                { short: "BS", price: 148.51, chance: 1.594 }
            ]
        },
        {
            name: "★ Ursus Knife | Doppler Phase 4",
            color: "#ffb703",
            rarities: [
                { short: "FN", price: 420.00, chance: 0.091 }
            ]
        },
        {
            name: "M4A1-S | Player Two",
            color: "#eb4b4b",
            rarities: [
                { short: "FN", price: 341.92, chance: 0.101 },
                { short: "WW", price: 83.43, chance: 2.814 },
                { short: "FT", price: 81.72, chance: 2.920 },
                { short: "BS", price: 81.33, chance: 2.897 }
            ]
        },
        {
            name: "★ Survival Knife | Doppler Phase 4",
            color: "#ffb703",
            rarities: [
                { short: "FN", price: 338.33, chance: 0.459 }
            ]
        },
        {
            name: "★ Bayonet | Bright Water",
            color: "#ffb703",
            rarities: [
                { short: "WW", price: 246.13, chance: 1.062 },
                { short: "FT", price: 236.15, chance: 1.074 }
            ]
        },
        {
            name: "★ Flip Knife | Bright Water",
            color: "#ffb703",
            rarities: [
                { short: "FN", price: 216.34, chance: 1.072 }
            ]
        },
        {
            name: "★ Gut Knife | Lore",
            color: "#ffb703",
            rarities: [
                { short: "WW", price: 194.99, chance: 1.462 },
                { short: "FT", price: 137.60, chance: 1.490 }
            ]
        },
        {
            name: "AWP | Printstream",
            color: "#eb4b4b",
            rarities: [
                { short: "MW", price: 148.59, chance: 1.576 },
                { short: "FT", price: 73.81, chance: 2.845 },
                { short: "BS", price: 64.72, chance: 4.293 }
            ]
        },
        {
            name: "★ Gut Knife | Bright Water",
            color: "#ffb703",
            rarities: [
                { short: "FN", price: 125.29, chance: 0.469 },
                { short: "MW", price: 100.03, chance: 0.469 },
                { short: "FT", price: 96.07, chance: 2.844 }
            ]
        },
        {
            name: "★ Shadow Daggers | Tiger Tooth",
            color: "#ffb703",
            rarities: [
                { short: "FN", price: 119.90, chance: 1.522 }
            ]
        },
        {
            name: "AK-47 | Searing Rage",
            color: "#d32ce6",
            rarities: [
                { short: "FN", price: 76.83, chance: 2.876 },
                { short: "MW", price: 14.89, chance: 2.379 },
                { short: "FT", price: 8.48, chance: 0.920 },
                { short: "WW", price: 7.48, chance: 5.596 },
                { short: "BS", price: 6.22, chance: 0.977 }
            ]
        },
        {
            name: "★ Hydra Gloves | Emerald",
            color: "#ffb703",
            rarities: [
                { short: "FT", price: 63.77, chance: 4.789 },
                { short: "BS", price: 62.63, chance: 4.523 }
            ]
        },
        {
            name: "AK-47 | Phantom Disruptor",
            color: "#d32ce6",
            rarities: [
                { short: "FN", price: 63.49, chance: 4.735 },
                { short: "MW", price: 14.89, chance: 2.460 },
                { short: "WW", price: 12.70, chance: 2.441 },
                { short: "BS", price: 9.51, chance: 2.318 },
                { short: "FT", price: 8.77, chance: 2.327 }
            ]
        },
        {
            name: "M4A1-S | Stratosphere",
            color: "#d32ce6",
            rarities: [
                { short: "MW", price: 41.25, chance: 5.967 },
                { short: "WW", price: 17.72, chance: 2.467 },
                { short: "FT", price: 15.34, chance: 2.582 },
                { short: "BS", price: 13.54, chance: 2.488 }
            ]
        },
        {
            name: "M4A1-S | Leaded Glass",
            color: "#d32ce6",
            rarities: [
                { short: "MW", price: 15.93, chance: 2.443 },
                { short: "WW", price: 14.35, chance: 2.510 },
                { short: "FT", price: 14.02, chance: 2.370 },
                { short: "BS", price: 13.79, chance: 2.314 }
            ]
        },
        {
            name: "SG 553 | Colony IV",
            color: "#d32ce6",
            rarities: [
                { short: "FT", price: 15.13, chance: 2.529 },
                { short: "WW", price: 12.94, chance: 2.517 },
                { short: "BS", price: 12.65, chance: 2.458 }
            ]
        }
    ]
},
crocodilo: {
    name: "CROCODILO",
    price: 1.00,
    img: "https://key-drop.com/uploads/skins/CROCODILO.png",
    tag: "BOXES",
    items: [
        {
            name: "M4A1-S | Printstream",
            color: "#eb4b4b",
            rarities: [
                { short: "BS", price: 268.32, chance: 0.008 }
            ]
        },
        {
            name: "★ Paracord Knife | Fade",
            color: "#ffb703",
            rarities: [
                { short: "FN", price: 244.12, chance: 0.01 }
            ]
        },
        {
            name: "M4A4 | Full Throttle",
            color: "#eb4b4b",
            rarities: [
                { short: "WW", price: 53.34, chance: 0.011 }
            ]
        },
        {
            name: "AWP | Chromatic Aberration",
            color: "#eb4b4b",
            rarities: [
                { short: "FT", price: 46.69, chance: 0.026 }
            ]
        },
        {
            name: "AWP | Crakow!",
            color: "#d32ce6",
            rarities: [
                { short: "BS", price: 41.32, chance: 0.024 }
            ]
        },
        {
            name: "USP-S | Monster Mashup",
            color: "#d32ce6",
            rarities: [
                { short: "FT", price: 35.40, chance: 0.027 }
            ]
        },
        {
            name: "USP-S | Jawbreaker",
            color: "#d32ce6",
            rarities: [
                { short: "MW", price: 12.94, chance: 0.01 },
                { short: "FT", price: 6.73, chance: 0.032 },
                { short: "WW", price: 5.72, chance: 0.039 },
                { short: "BS", price: 6.01, chance: 0.033 }
            ]
        },
        {
            name: "AWP | Acheron",
            color: "#4b69ff",
            rarities: [
                { short: "FN", price: 9.96, chance: 0.214 },
                { short: "MW", price: 1.98, chance: 1.64 },
                { short: "WW", price: 1.73, chance: 0.161 }
            ]
        },
        {
            name: "AWP | Phobos",
            color: "#8847ff",
            rarities: [
                { short: "FN", price: 8.77, chance: 0.016 },
                { short: "MW", price: 4.08, chance: 0.049 }
            ]
        },
        {
            name: "AK-47 | Phantom Disruptor",
            color: "#d32ce6",
            rarities: [
                { short: "FT", price: 8.77, chance: 0.083 }
            ]
        },
        {
            name: "M4A4 | Tooth Fairy",
            color: "#d32ce6",
            rarities: [
                { short: "MW", price: 8.72, chance: 0.023 },
                { short: "FT", price: 5.38, chance: 0.075 },
                { short: "WW", price: 6.04, chance: 0.018 },
                { short: "BS", price: 5.61, chance: 0.026 }
            ]
        },
        {
            name: "AK-47 | Searing Rage",
            color: "#d32ce6",
            rarities: [
                { short: "FT", price: 8.48, chance: 0.043 },
                { short: "WW", price: 7.48, chance: 0.028 },
                { short: "BS", price: 6.22, chance: 0.05 }
            ]
        },
        {
            name: "MP7 | Abyssal Apparition",
            color: "#d32ce6",
            rarities: [
                { short: "FT", price: 8.46, chance: 0.074 }
            ]
        },
        {
            name: "M4A1-S | Emphorosaur-S",
            color: "#8847ff",
            rarities: [
                { short: "FN", price: 5.80, chance: 0.033 },
                { short: "MW", price: 1.73, chance: 1.851 },
                { short: "FT", price: 0.79, chance: 2.25 },
                { short: "WW", price: 1.16, chance: 3.049 },
                { short: "BS", price: 0.89, chance: 2.305 }
            ]
        },
        {
            name: "Tec-9 | Remote Control",
            color: "#d32ce6",
            rarities: [
                { short: "FT", price: 4.54, chance: 0.056 },
                { short: "WW", price: 3.17, chance: 0.06 },
                { short: "BS", price: 3.07, chance: 0.064 }
            ]
        },
        {
            name: "M4A4 | Choppa",
            color: "#4b69ff",
            rarities: [
                { short: "FN", price: 4.23, chance: 0.045 },
                { short: "MW", price: 0.38, chance: 1.812 },
                { short: "FT", price: 0.15, chance: 4.583 },
                { short: "WW", price: 0.10, chance: 4.299 },
                { short: "BS", price: 0.09, chance: 3.871 }
            ]
        },
        {
            name: "CZ75-Auto | Tigris",
            color: "#8847ff",
            rarities: [
                { short: "MW", price: 3.92, chance: 0.048 },
                { short: "FT", price: 3.09, chance: 0.474 },
                { short: "WW", price: 3.05, chance: 0.518 }
            ]
        },
        {
            name: "USP-S | Bleeding Edge",
            color: "#8847ff",
            rarities: [
                { short: "FT", price: 3.39, chance: 0.064 },
                { short: "WW", price: 3.38, chance: 0.06 },
                { short: "BS", price: 3.07, chance: 0.063 }
            ]
        },
        {
            name: "Sawed-Off | Analog Input",
            color: "#8847ff",
            rarities: [
                { short: "FN", price: 3.00, chance: 0.522 },
                { short: "MW", price: 1.18, chance: 2.709 }
            ]
        },
        {
            name: "Desert Eagle | Trigger Discipline",
            color: "#8847ff",
            rarities: [
                { short: "MW", price: 2.99, chance: 0.538 },
                { short: "FT", price: 1.23, chance: 2.759 }
            ]
        },
        {
            name: "Galil AR | Vandal",
            color: "#4b69ff",
            rarities: [
                { short: "MW", price: 2.98, chance: 1.41 },
                { short: "FT", price: 1.35, chance: 2.603 },
                { short: "WW", price: 0.99, chance: 2.222 }
            ]
        },
        {
            name: "UMP-45 | Continuum",
            color: "#8847ff",
            rarities: [
                { short: "MW", price: 2.44, chance: 0.567 },
                { short: "FT", price: 1.29, chance: 0.199 },
                { short: "WW", price: 1.05, chance: 2.956 }
            ]
        },
        {
            name: "P90 | Randy Rush",
            color: "#8847ff",
            rarities: [
                { short: "MW", price: 2.39, chance: 0.601 },
                { short: "WW", price: 1.16, chance: 2.583 }
            ]
        },
        {
            name: "MP7 | Just Smile",
            color: "#8847ff",
            rarities: [
                { short: "MW", price: 2.06, chance: 2.068 },
                { short: "FT", price: 0.85, chance: 2.348 },
                { short: "WW", price: 0.70, chance: 2.348 }
            ]
        },
        {
            name: "SSG 08 | Memorial",
            color: "#4b69ff",
            rarities: [
                { short: "FN", price: 2.02, chance: 1.728 },
                { short: "MW", price: 0.30, chance: 1.751 },
                { short: "FT", price: 0.10, chance: 4.298 },
                { short: "WW", price: 0.08, chance: 4.299 },
                { short: "BS", price: 0.08, chance: 4.84 }
            ]
        },
        {
            name: "USP-S | Tropical Breeze",
            color: "#4b69ff",
            rarities: [
                { short: "FT", price: 1.14, chance: 0.216 },
                { short: "WW", price: 1.50, chance: 0.192 }
            ]
        },
        {
            name: "Galil AR | Connexion",
            color: "#8847ff",
            rarities: [
                { short: "MW", price: 1.36, chance: 0.185 },
                { short: "FT", price: 0.70, chance: 2.381 },
                { short: "WW", price: 0.70, chance: 2.221 },
                { short: "BS", price: 0.70, chance: 1.707 }
            ]
        },
        {
            name: "M4A1-S | Wash me plz",
            color: "#5e98d9",
            rarities: [
                { short: "FN", price: 1.04, chance: 1.904 },
                { short: "MW", price: 0.18, chance: 4.027 },
                { short: "FT", price: 0.06, chance: 9.189 },
                { short: "WW", price: 0.14, chance: 4.30 },
                { short: "BS", price: 0.10, chance: 2.104 }
            ]
        }
    ]
},
sahur: {
    name: "SAHUR",
    price: 4.00,
    img: "https://key-drop.com/uploads/skins/SAHUR.png",
    tag: "BOXES",
    items: [
        {
            name: "★ Karambit | Lore",
            color: "#ffb703",
            rarities: [
                { short: "WW", price: 858.31, chance: 0.003 }
            ]
        },
        {
            name: "AWP | Oni Taiji",
            color: "#eb4b4b",
            rarities: [
                { short: "FT", price: 583.79, chance: 0.01 }
            ]
        },
        {
            name: "★ Falchion Knife | Gamma Doppler Phase 1",
            color: "#ffb703",
            rarities: [
                { short: "FN", price: 362.25, chance: 0.01 }
            ]
        },
        {
            name: "★ Navaja Knife | Fade",
            color: "#ffb703",
            rarities: [
                { short: "FN", price: 168.48, chance: 0.016 }
            ]
        },
        {
            name: "AK-47 | Inheritance",
            color: "#eb4b4b",
            rarities: [
                { short: "MW", price: 122.73, chance: 0.004 },
                { short: "WW", price: 82.78, chance: 0.007 },
                { short: "FT", price: 71.35, chance: 0.023 },
                { short: "BS", price: 63.68, chance: 0.038 }
            ]
        },
        {
            name: "AWP | Chromatic Aberration",
            color: "#eb4b4b",
            rarities: [
                { short: "MW", price: 78.12, chance: 0.003 },
                { short: "WW", price: 47.75, chance: 0.022 },
                { short: "FT", price: 46.69, chance: 0.026 },
                { short: "BS", price: 45.55, chance: 0.013 }
            ]
        },
        {
            name: "AWP | Wildfire",
            color: "#eb4b4b",
            rarities: [
                { short: "FT", price: 73.22, chance: 0.019 },
                { short: "WW", price: 72.50, chance: 0.022 },
                { short: "BS", price: 62.88, chance: 0.024 }
            ]
        },
        {
            name: "Desert Eagle | Code Red",
            color: "#eb4b4b",
            rarities: [
                { short: "FT", price: 67.41, chance: 0.041 }
            ]
        },
        {
            name: "M4A4 | Cyber Security",
            color: "#d32ce6",
            rarities: [
                { short: "FT", price: 45.94, chance: 0.02 },
                { short: "WW", price: 34.88, chance: 0.047 },
                { short: "BS", price: 32.29, chance: 0.035 }
            ]
        },
        {
            name: "SG 553 | Colony IV",
            color: "#d32ce6",
            rarities: [
                { short: "MW", price: 37.64, chance: 0.053 },
                { short: "WW", price: 12.94, chance: 0.476 },
                { short: "BS", price: 12.65, chance: 0.467 }
            ]
        },
        {
            name: "Tec-9 | Mummy's Rot",
            color: "#4b69ff",
            rarities: [
                { short: "FN", price: 34.24, chance: 0.069 },
                { short: "MW", price: 7.98, chance: 0.533 },
                { short: "FT", price: 3.37, chance: 4.702 },
                { short: "WW", price: 2.53, chance: 0.845 },
                { short: "BS", price: 2.05, chance: 0.902 }
            ]
        },
        {
            name: "MP7 | Impire",
            color: "#8847ff",
            rarities: [
                { short: "FN", price: 33.68, chance: 0.106 },
                { short: "MW", price: 5.88, chance: 0.205 },
                { short: "FT", price: 4.23, chance: 9.809 }
            ]
        },
        {
            name: "AK-47 | Nouveau Rouge",
            color: "#d32ce6",
            rarities: [
                { short: "FT", price: 30.81, chance: 0.007 },
                { short: "WW", price: 18.02, chance: 0.107 },
                { short: "BS", price: 19.03, chance: 0.099 }
            ]
        },
        {
            name: "Glock-18 | Snack Attack",
            color: "#d32ce6",
            rarities: [
                { short: "WW", price: 30.06, chance: 0.113 }
            ]
        },
        {
            name: "USP-S | Blueprint",
            color: "#4b69ff",
            rarities: [
                { short: "MW", price: 19.64, chance: 0.129 },
                { short: "FT", price: 8.00, chance: 1.365 },
                { short: "WW", price: 6.91, chance: 1.530 },
                { short: "BS", price: 7.68, chance: 0.176 }
            ]
        },
        {
            name: "M4A1-S | Nightmare",
            color: "#d32ce6",
            rarities: [
                { short: "FT", price: 17.00, chance: 0.16 },
                { short: "WW", price: 12.59, chance: 0.426 },
                { short: "BS", price: 12.80, chance: 0.427 }
            ]
        },
        {
            name: "AK-47 | Phantom Disruptor",
            color: "#d32ce6",
            rarities: [
                { short: "MW", price: 14.89, chance: 0.16 },
                { short: "FT", price: 8.77, chance: 1.461 }
            ]
        },
        {
            name: "MP9 | Hydra",
            color: "#d32ce6",
            rarities: [
                { short: "FT", price: 10.17, chance: 0.477 },
                { short: "WW", price: 8.61, chance: 0.512 },
                { short: "BS", price: 8.07, chance: 0.546 }
            ]
        },
        {
            name: "AUG | Stymphalian",
            color: "#d32ce6",
            rarities: [
                { short: "MW", price: 7.97, chance: 1.395 },
                { short: "FT", price: 5.89, chance: 0.194 },
                { short: "WW", price: 5.78, chance: 0.202 },
                { short: "BS", price: 5.58, chance: 0.203 }
            ]
        },
        {
            name: "Glock-18 | Shinobu",
            color: "#d32ce6",
            rarities: [
                { short: "WW", price: 7.57, chance: 1.377 },
                { short: "FT", price: 7.37, chance: 1.627 },
                { short: "BS", price: 7.33, chance: 1.386 }
            ]
        },
        {
            name: "AK-47 | Uncharted",
            color: "#4b69ff",
            rarities: [
                { short: "FN", price: 5.86, chance: 2.75 },
                { short: "FT", price: 1.04, chance: 7.559 },
                { short: "MW", price: 1.39, chance: 0.934 },
                { short: "WW", price: 1.95, chance: 0.842 },
                { short: "BS", price: 1.16, chance: 6.778 }
            ]
        },
        {
            name: "XM1014 | Solitude",
            color: "#8847ff",
            rarities: [
                { short: "MW", price: 5.29, chance: 7.433 }
            ]
        },
        {
            name: "USP-S | Royal Guard",
            color: "#8847ff",
            rarities: [
                { short: "WW", price: 2.58, chance: 4.84 },
                { short: "FT", price: 2.53, chance: 5.021 },
                { short: "BS", price: 2.13, chance: 1.069 }
            ]
        },
        {
            name: "R8 Revolver | Junk Yard",
            color: "#4b69ff",
            rarities: [
                { short: "FN", price: 1.85, chance: 0.809 },
                { short: "MW", price: 0.40, chance: 7.662 },
                { short: "FT", price: 0.33, chance: 5.274 },
                { short: "WW", price: 0.51, chance: 4.473 },
                { short: "BS", price: 0.25, chance: 11.927 }
            ]
        }
    ]
},
ballerina: {
    name: "BALLERINA",
    price: 7.50,
    img: "https://key-drop.com/uploads/skins/BALLERINA.png",
    tag: "BOXES",
    items: [
        {
            name: "★ Talon Knife | Fade",
            color: "#ffb703",
            rarities: [
                { short: "FN", price: 1349.47, chance: 0.014 }
            ]
        },
        {
            name: "★ Bayonet | Doppler Phase 4",
            color: "#ffb703",
            rarities: [
                { short: "FN", price: 646.50, chance: 0.017 }
            ]
        },
        {
            name: "AK-47 | Bloodsport",
            color: "#eb4b4b",
            rarities: [
                { short: "FN", price: 295.19, chance: 0.017 },
                { short: "MW", price: 241.09, chance: 0.014 },
                { short: "FT", price: 213.44, chance: 0.017 }
            ]
        },
        {
            name: "★ Survival Knife | Marble Fade",
            color: "#ffb703",
            rarities: [
                { short: "FN", price: 224.66, chance: 0.03 }
            ]
        },
        {
            name: "M4A1-S | Hyper Beast",
            color: "#eb4b4b",
            rarities: [
                { short: "FT", price: 176.75, chance: 0.04 }
            ]
        },
        {
            name: "Desert Eagle | Ocean Drive",
            color: "#eb4b4b",
            rarities: [
                { short: "FT", price: 108.53, chance: 0.02 },
                { short: "BS", price: 105.31, chance: 0.014 },
                { short: "WW", price: 105.04, chance: 0.015 }
            ]
        },
        {
            name: "AK-47 | Asiimov",
            color: "#eb4b4b",
            rarities: [
                { short: "MW", price: 83.60, chance: 0.012 },
                { short: "WW", price: 65.79, chance: 0.02 },
                { short: "BS", price: 65.14, chance: 0.015 },
                { short: "FT", price: 63.03, chance: 0.026 }
            ]
        },
        {
            name: "FAMAS | Bad Trip",
            color: "#eb4b4b",
            rarities: [
                { short: "FT", price: 66.42, chance: 0.058 }
            ]
        },
        {
            name: "AK-47 | Aquamarine Revenge",
            color: "#eb4b4b",
            rarities: [
                { short: "FT", price: 62.61, chance: 0.021 },
                { short: "WW", price: 56.81, chance: 0.059 },
                { short: "BS", price: 54.81, chance: 0.062 }
            ]
        },
        {
            name: "Glock-18 | Gold Toof",
            color: "#eb4b4b",
            rarities: [
                { short: "WW", price: 52.19, chance: 0.03 },
                { short: "FT", price: 47.78, chance: 0.028 },
                { short: "BS", price: 47.75, chance: 0.027 }
            ]
        },
        {
            name: "AK-47 | Point Disarray",
            color: "#d32ce6",
            rarities: [
                { short: "MW", price: 39.33, chance: 0.051 },
                { short: "WW", price: 28.89, chance: 0.252 },
                { short: "BS", price: 21.98, chance: 0.807 }
            ]
        },
        {
            name: "M4A4 | Desolate Space",
            color: "#d32ce6",
            rarities: [
                { short: "MW", price: 32.26, chance: 0.048 },
                { short: "FT", price: 19.79, chance: 0.854 },
                { short: "WW", price: 17.39, chance: 1.611 },
                { short: "BS", price: 17.08, chance: 1.579 }
            ]
        },
        {
            name: "Desert Eagle | Mecha Industries",
            color: "#d32ce6",
            rarities: [
                { short: "FN", price: 27.03, chance: 0.756 },
                { short: "MW", price: 13.59, chance: 0.121 }
            ]
        },
        {
            name: "M4A1-S | Black Lotus",
            color: "#d32ce6",
            rarities: [
                { short: "FN", price: 26.69, chance: 0.287 },
                { short: "MW", price: 16.23, chance: 1.593 },
                { short: "BS", price: 10.33, chance: 0.128 },
                { short: "FT", price: 8.11, chance: 3.257 }
            ]
        },
        {
            name: "Glock-18 | Mirror Mosaic",
            color: "#d32ce6",
            rarities: [
                { short: "MW", price: 21.61, chance: 0.86 },
                { short: "FT", price: 12.11, chance: 0.115 },
                { short: "WW", price: 9.57, chance: 0.136 },
                { short: "BS", price: 7.68, chance: 3.223 }
            ]
        },
        {
            name: "M4A1-S | Leaded Glass",
            color: "#d32ce6",
            rarities: [
                { short: "MW", price: 15.93, chance: 1.559 }
            ]
        },
        {
            name: "M4A4 | Etch Lord",
            color: "#8847ff",
            rarities: [
                { short: "FN", price: 15.78, chance: 1.996 },
                { short: "MW", price: 1.94, chance: 2.386 },
                { short: "FT", price: 0.80, chance: 2.556 },
                { short: "BS", price: 0.75, chance: 1.463 },
                { short: "WW", price: 0.71, chance: 0.803 }
            ]
        },
        {
            name: "AK-47 | Ice Coaled",
            color: "#d32ce6",
            rarities: [
                { short: "MW", price: 14.20, chance: 1.487 },
                { short: "FT", price: 7.88, chance: 1.599 },
                { short: "BS", price: 7.07, chance: 2.068 }
            ]
        },
        {
            name: "MP7 | Abyssal Apparition",
            color: "#d32ce6",
            rarities: [
                { short: "MW", price: 12.72, chance: 1.47 },
                { short: "WW", price: 9.22, chance: 0.14 },
                { short: "BS", price: 8.79, chance: 3.255 },
                { short: "FT", price: 8.46, chance: 0.162 }
            ]
        },
        {
            name: "AK-47 | Slate",
            color: "#8847ff",
            rarities: [
                { short: "MW", price: 11.42, chance: 0.134 },
                { short: "FT", price: 7.33, chance: 1.829 },
                { short: "WW", price: 6.52, chance: 2.126 },
                { short: "BS", price: 5.52, chance: 2.291 }
            ]
        },
        {
            name: "Galil AR | Control",
            color: "#8847ff",
            rarities: [
                { short: "FN", price: 10.50, chance: 2.059 },
                { short: "MW", price: 1.76, chance: 2.438 },
                { short: "WW", price: 0.76, chance: 2.652 },
                { short: "FT", price: 0.76, chance: 4.407 },
                { short: "BS", price: 0.71, chance: 7.703 }
            ]
        },
        {
            name: "MP5-SD | Phosphor",
            color: "#d32ce6",
            rarities: [
                { short: "MW", price: 9.75, chance: 0.129 },
                { short: "WW", price: 7.31, chance: 3.125 },
                { short: "BS", price: 6.69, chance: 2.27 },
                { short: "FT", price: 6.44, chance: 2.441 }
            ]
        },
        {
            name: "Desert Eagle | Serpent Strike",
            color: "#8847ff",
            rarities: [
                { short: "FN", price: 5.72, chance: 2.088 },
                { short: "MW", price: 1.87, chance: 2.324 },
                { short: "WW", price: 1.01, chance: 2.172 },
                { short: "BS", price: 0.84, chance: 2.645 },
                { short: "FT", price: 0.78, chance: 2.979 }
            ]
        },
        {
            name: "M4A1-S | Night Terror",
            color: "#8847ff",
            rarities: [
                { short: "FN", price: 3.70, chance: 5.773 },
                { short: "MW", price: 1.60, chance: 2.81 },
                { short: "WW", price: 1.46, chance: 2.628 },
                { short: "BS", price: 1.39, chance: 2.951 },
                { short: "FT", price: 1.00, chance: 2.848 }
            ]
        }
    ]
},
iconico: {
    name: "ICONICO",
    price: 0.80,
    img: "https://key-drop.com/uploads/skins/ICONICO1.png",
    tag: "BOXES",
    items: [
        {
            name: "★ Gut Knife | Doppler",
            color: "#ffb703", // Gold
            rarities: [
                { short: "FN", price: 191.60, chance: 0.015 }
            ]
        },
        {
            name: "AK-47 | Inheritance",
            color: "#eb4b4b", // Red
            rarities: [
                { short: "FT", price: 63.65, chance: 0.057 }
            ]
        },
        {
            name: "AK-47 | Asiimov",
            color: "#eb4b4b", // Red
            rarities: [
                { short: "FT", price: 61.56, chance: 0.048 }
            ]
        },
        {
            name: "USP-S | Ticket to Hell",
            color: "#d32ce6", // Pink/Classified
            rarities: [
                { short: "FT", price: 0.99, chance: 18.198 }
            ]
        },
        {
            name: "UMP-45 | Continuum",
            color: "#d32ce6", // Pink/Classified
            rarities: [
                { short: "BS", price: 0.78, chance: 56.785 }
            ]
        },
        {
            name: "Galil AR | Grey Smoke",
            color: "#5e98d9", // Light Blue/Consumer
            rarities: [
                { short: "FT", price: 0.01, chance: 24.897 }
            ]
        }
    ]
},
siiiiuuuu: {
    name: "SIIIIUUUU",
    price: 6.50,
    img: "https://key-drop.com/uploads/skins/SIIIIUUUU1.png",
    tag: "BOXES",
    items: [
        {
            name: "★ M9 Bayonet | Tiger Tooth",
            color: "#ffb703",
            rarities: [{ short: "FN", price: 1105.40, chance: 0.009 }]
        },
        {
            name: "AWP | Lightning Strike",
            color: "#eb4b4b",
            rarities: [{ short: "FN", price: 900.08, chance: 0.009 }]
        },
        {
            name: "★ Falchion Knife | Doppler - Phase 4",
            color: "#ffb703",
            rarities: [{ short: "FN", price: 463.12, chance: 0.029 }]
        },
        {
            name: "★ Bayonet | Lore",
            color: "#ffb703",
            rarities: [{ short: "FT", price: 372.24, chance: 0.049 }]
        },
        {
            name: "★ Bowie Knife | Fade",
            color: "#ffb703",
            rarities: [{ short: "FN", price: 313.11, chance: 0.055 }]
        },
        {
            name: "M4A1-S | Hyper Beast",
            color: "#eb4b4b",
            rarities: [{ short: "FT", price: 169.82, chance: 0.03 }]
        },
        {
            name: "AWP | Printstream",
            color: "#eb4b4b",
            rarities: [
                { short: "MW", price: 144.97, chance: 0.005 },
                { short: "FT", price: 74.61, chance: 0.019 },
                { short: "WW", price: 68.77, chance: 0.01 },
                { short: "BS", price: 59.71, chance: 0.03 }
            ]
        },
        {
            name: "AK-47 | The Empress",
            color: "#eb4b4b",
            rarities: [{ short: "FT", price: 130.55, chance: 0.054 }]
        },
        {
            name: "FAMAS | Rapid Eye Movement",
            color: "#d32ce6",
            rarities: [
                { short: "FN", price: 56.41, chance: 0.034 },
                { short: "MW", price: 10.51, chance: 3.811 }
            ]
        },
        {
            name: "AWP | Hyper Beast",
            color: "#eb4b4b",
            rarities: [{ short: "FT", price: 54.11, chance: 0.106 }]
        },
        {
            name: "M4A4 | Temukau",
            color: "#eb4b4b",
            rarities: [
                { short: "WW", price: 50.17, chance: 0.127 },
                { short: "BS", price: 41.25, chance: 0.108 }
            ]
        },
        {
            name: "AK-47 | The Outsiders",
            color: "#d32ce6",
            rarities: [
                { short: "MW", price: 30.23, chance: 0.061 },
                { short: "FT", price: 10.87, chance: 1.481 },
                { short: "WW", price: 12.37, chance: 1.03 },
                { short: "BS", price: 12.60, chance: 1.06 }
            ]
        },
        {
            name: "AK-47 | Ice Coaled",
            color: "#d32ce6",
            rarities: [
                { short: "FN", price: 26.02, chance: 0.056 },
                { short: "MW", price: 11.47, chance: 0.525 },
                { short: "WW", price: 9.30, chance: 1.489 },
                { short: "FT", price: 6.59, chance: 1.686 },
                { short: "BS", price: 6.27, chance: 1.731 }
            ]
        },
        {
            name: "AK-47 | Point Disarray",
            color: "#d32ce6",
            rarities: [
                { short: "WW", price: 25.52, chance: 0.106 },
                { short: "FT", price: 18.58, chance: 2.587 }
            ]
        },
        {
            name: "M4A4 | 龍王 (Dragon King)",
            color: "#d32ce6",
            rarities: [{ short: "FT", price: 22.76, chance: 1.901 }]
        },
        {
            name: "M4A4 | Evil Daimyo",
            color: "#8847ff",
            rarities: [
                { short: "FN", price: 22.39, chance: 0.346 },
                { short: "MW", price: 8.51, chance: 2.492 },
                { short: "FT", price: 5.20, chance: 1.912 },
                { short: "WW", price: 5.20, chance: 2.027 },
                { short: "BS", price: 5.31, chance: 1.912 }
            ]
        },
        {
            name: "Glock-18 | Shinobu",
            color: "#d32ce6",
            rarities: [
                { short: "MW", price: 15.28, chance: 0.105 },
                { short: "FT", price: 8.33, chance: 0.915 },
                { short: "WW", price: 5.93, chance: 1.14 },
                { short: "BS", price: 6.61, chance: 1.12 }
            ]
        },
        {
            name: "M4A1-S | Leaded Glass",
            color: "#d32ce6",
            rarities: [
                { short: "MW", price: 14.61, chance: 0.33 },
                { short: "FT", price: 11.06, chance: 1.202 },
                { short: "WW", price: 12.14, chance: 1.059 },
                { short: "BS", price: 11.80, chance: 1.071 }
            ]
        },
        {
            name: "Sawed-Off | Kiss♥Love",
            color: "#d32ce6",
            rarities: [
                { short: "MW", price: 10.33, chance: 0.518 },
                { short: "FT", price: 5.05, chance: 3.414 },
                { short: "WW", price: 4.90, chance: 3.174 },
                { short: "BS", price: 4.77, chance: 3.167 }
            ]
        },
        {
            name: "MP5-SD | Phosphor",
            color: "#d32ce6",
            rarities: [
                { short: "MW", price: 8.53, chance: 0.178 },
                { short: "FT", price: 5.86, chance: 2.439 },
                { short: "WW", price: 6.04, chance: 0.48 },
                { short: "BS", price: 6.52, chance: 2.295 }
            ]
        },
        {
            name: "M4A1-S | Solitude",
            color: "#d32ce6",
            rarities: [
                { short: "MW", price: 6.66, chance: 0.631 },
                { short: "FT", price: 2.44, chance: 3.087 },
                { short: "WW", price: 3.05, chance: 1.145 },
                { short: "BS", price: 1.76, chance: 5.284 }
            ]
        },
        {
            name: "MAC-10 | Cat Fight",
            color: "#8847ff",
            rarities: [
                { short: "MW", price: 2.48, chance: 2.668 },
                { short: "FT", price: 1.18, chance: 2.958 },
                { short: "WW", price: 0.95, chance: 3.683 },
                { short: "BS", price: 0.83, chance: 3.124 }
            ]
        },
        {
            name: "MP5-SD | Liquidation",
            color: "#4b69ff",
            rarities: [
                { short: "FN", price: 1.68, chance: 0.129 },
                { short: "MW", price: 0.29, chance: 7.551 },
                { short: "FT", price: 0.09, chance: 2.81 }
            ]
        },
        {
            name: "SCAR-20 | Caged",
            color: "#4b69ff",
            rarities: [
                { short: "FN", price: 1.55, chance: 0.143 },
                { short: "MW", price: 0.39, chance: 7.734 },
                { short: "FT", price: 0.18, chance: 9.559 }
            ]
        }
    ]
},
patrao: {
    name: "PATRAO",
    price: 13.50,
    img: "https://key-drop.com/uploads/skins/PATRAO1.png",
    tag: "BOXES",
    items: [
        {
            name: "★ Karambit | Doppler Phase 3",
            color: "#ffb703",
            rarities: [{ short: "FN", price: 2115.37, chance: 0.022 }]
        },
        {
            name: "★ M9 Bayonet | Lore",
            color: "#ffb703",
            rarities: [{ short: "FT", price: 773.33, chance: 0.027 }]
        },
        {
            name: "★ Bowie Knife | Gamma Doppler Phase 3",
            color: "#ffb703",
            rarities: [{ short: "FN", price: 326.31, chance: 0.04 }]
        },
        {
            name: "M4A1-S | Printstream",
            color: "#eb4b4b",
            rarities: [{ short: "FT", price: 318.42, chance: 0.053 }]
        },
        {
            name: "M4A1-S | Cyrex",
            color: "#eb4b4b",
            rarities: [{ short: "FT", price: 240.05, chance: 0.068 }]
        },
        {
            name: "★ Driver Gloves | King Snake",
            color: "#ffb703",
            rarities: [{ short: "WW", price: 238.26, chance: 0.03 }]
        },
        {
            name: "★ Survival Knife | Marble Fade",
            color: "#ffb703",
            rarities: [{ short: "FN", price: 206.67, chance: 0.053 }]
        },
        {
            name: "M4A1-S | Hyper Beast",
            color: "#eb4b4b",
            rarities: [{ short: "FT", price: 169.82, chance: 0.035 }]
        },
        {
            name: "M4A1-S | Vaporwave",
            color: "#eb4b4b",
            rarities: [
                { short: "MW", price: 166.26, chance: 0.002 },
                { short: "WW", price: 78.50, chance: 0.009 },
                { short: "FT", price: 77.86, chance: 0.007 },
                { short: "BS", price: 73.74, chance: 0.023 }
            ]
        },
        {
            name: "M4A4 | Hellish",
            color: "#d32ce6",
            rarities: [
                { short: "MW", price: 155.09, chance: 0.012 },
                { short: "FT", price: 64.96, chance: 0.053 },
                { short: "WW", price: 33.84, chance: 0.479 },
                { short: "BS", price: 31.04, chance: 0.505 }
            ]
        },
        {
            name: "★ Huntsman Knife | Autotronic",
            color: "#ffb703",
            rarities: [{ short: "FT", price: 149.45, chance: 0.045 }]
        },
        {
            name: "AWP | Printstream",
            color: "#eb4b4b",
            rarities: [
                { short: "FT", price: 74.61, chance: 0.041 },
                { short: "WW", price: 68.77, chance: 0.055 },
                { short: "BS", price: 59.71, chance: 0.118 }
            ]
        },
        {
            name: "★ Navaja Knife | Night Stripe",
            color: "#ffb703",
            rarities: [{ short: "FT", price: 70.31, chance: 0.155 }]
        },
        {
            name: "AWP | Chrome Cannon",
            color: "#eb4b4b",
            rarities: [
                { short: "MW", price: 57.22, chance: 0.048 },
                { short: "FT", price: 47.55, chance: 0.525 },
                { short: "BS", price: 41.02, chance: 0.555 },
                { short: "WW", price: 39.82, chance: 0.555 }
            ]
        },
        {
            name: "AK-47 | Frontside Misty",
            color: "#d32ce6",
            rarities: [
                { short: "MW", price: 48.94, chance: 0.113 },
                { short: "FT", price: 28.93, chance: 1.481 },
                { short: "WW", price: 23.23, chance: 1.541 }
            ]
        },
        {
            name: "AWP | Green Energy",
            color: "#d32ce6",
            rarities: [
                { short: "MW", price: 46.51, chance: 0.061 },
                { short: "FT", price: 17.78, chance: 2.207 },
                { short: "WW", price: 16.80, chance: 1.826 }
            ]
        },
        {
            name: "M4A4 | Temukau",
            color: "#eb4b4b",
            rarities: [{ short: "FT", price: 45.94, chance: 0.498 }]
        },
        {
            name: "Zeus x27 | Dragon Snore",
            color: "#d32ce6",
            rarities: [
                { short: "WW", price: 42.71, chance: 0.627 },
                { short: "FT", price: 42.24, chance: 0.646 },
                { short: "BS", price: 35.83, chance: 0.708 }
            ]
        },
        {
            name: "SG 553 | Colony IV",
            color: "#d32ce6",
            rarities: [
                { short: "MW", price: 38.86, chance: 0.046 },
                { short: "FT", price: 14.58, chance: 4.991 }
            ]
        },
        {
            name: "AK-47 | Aphrodite",
            color: "#eb4b4b",
            rarities: [
                { short: "FT", price: 36.09, chance: 0.335 },
                { short: "BS", price: 22.99, chance: 1.317 },
                { short: "WW", price: 22.37, chance: 1.461 }
            ]
        },
        {
            name: "M4A1-S | Nightmare",
            color: "#d32ce6",
            rarities: [
                { short: "MW", price: 34.44, chance: 0.059 },
                { short: "FT", price: 15.13, chance: 5.416 }
            ]
        },
        {
            name: "Desert Eagle | Mecha Industries",
            color: "#d32ce6",
            rarities: [
                { short: "FN", price: 25.53, chance: 0.038 },
                { short: "MW", price: 11.89, chance: 0.313 },
                { short: "WW", price: 10.02, chance: 1.458 },
                { short: "BS", price: 8.63, chance: 1.493 },
                { short: "FT", price: 7.88, chance: 3.305 }
            ]
        },
        {
            name: "UMP-45 | Neo-Noir",
            color: "#d32ce6",
            rarities: [
                { short: "MW", price: 22.23, chance: 0.048 },
                { short: "FT", price: 8.71, chance: 1.723 },
                { short: "WW", price: 6.46, chance: 2.685 },
                { short: "BS", price: 6.23, chance: 2.663 }
            ]
        },
        {
            name: "MP9 | Airlock",
            color: "#d32ce6",
            rarities: [
                { short: "MW", price: 17.99, chance: 0.25 },
                { short: "FT", price: 15.19, chance: 1.731 },
                { short: "WW", price: 14.32, chance: 1.811 },
                { short: "BS", price: 13.77, chance: 1.296 }
            ]
        },
        {
            name: "M4A1-S | Black Lotus",
            color: "#d32ce6",
            rarities: [
                { short: "MW", price: 12.25, chance: 0.052 },
                { short: "WW", price: 10.71, chance: 1.576 },
                { short: "FT", price: 8.58, chance: 4.018 },
                { short: "BS", price: 8.19, chance: 1.677 }
            ]
        },
        {
            name: "M4A1-S | Solitude",
            color: "#d32ce6",
            rarities: [
                { short: "MW", price: 6.66, chance: 1.03 },
                { short: "WW", price: 3.05, chance: 6.578 },
                { short: "FT", price: 2.44, chance: 8.14 },
                { short: "BS", price: 1.76, chance: 5.711 }
            ]
        },
        {
            name: "AK-47 | Elite Build",
            color: "#4b69ff",
            rarities: [
                { short: "MW", price: 4.22, chance: 4.794 },
                { short: "FT", price: 3.09, chance: 4.954 },
                { short: "WW", price: 2.21, chance: 6.539 },
                { short: "BS", price: 2.20, chance: 9.269 }
            ]
        }
    ]
},
sortudo: {
    name: "SORTUDO",
    price: 50.00,
    img: "https://key-drop.com/uploads/skins/SORTUDO1.png",
    tag: "BOXES",
    items: [
        {
            name: "AK-47 | Wild Lotus",
            color: "#eb4b4b",
            rarities: [{ short: "BS", price: 6368.69, chance: 0.005 }]
        },
        {
            name: "★ Karambit | Marble Fade",
            color: "#ffb703",
            rarities: [{ short: "FN", price: 1719.25, chance: 0.016 }]
        },
        {
            name: "★ Survival Knife | Doppler - Phase 3",
            color: "#ffb703",
            rarities: [{ short: "FN", price: 311.51, chance: 0.158 }]
        },
        {
            name: "★ Specialist Gloves | Fade",
            color: "#ffb703",
            rarities: [{ short: "WW", price: 311.05, chance: 0.082 }]
        },
        {
            name: "AK-47 | Vulcan",
            color: "#eb4b4b",
            rarities: [{ short: "FT", price: 295.53, chance: 0.057 }]
        },
        {
            name: "M4A1-S | Printstream",
            color: "#eb4b4b",
            rarities: [{ short: "BS", price: 240.66, chance: 0.336 }]
        },
        {
            name: "★ Survival Knife | Fade",
            color: "#ffb703",
            rarities: [{ short: "FN", price: 226.85, chance: 0.42 }]
        },
        {
            name: "★ Shadow Daggers | Marble Fade",
            color: "#ffb703",
            rarities: [{ short: "FN", price: 157.31, chance: 2.093 }]
        },
        {
            name: "★ Paracord Knife | Case Hardened",
            color: "#ffb703",
            rarities: [{ short: "WW", price: 147.14, chance: 2.163 }]
        },
        {
            name: "AWP | Asiimov",
            color: "#eb4b4b",
            rarities: [{ short: "BS", price: 116.21, chance: 2.14 }]
        },
        {
            name: "Zeus x27 | Dragon Snore",
            color: "#d32ce6",
            rarities: [{ short: "MW", price: 112.03, chance: 2.166 }]
        },
        {
            name: "★ Gut Knife | Freehand",
            color: "#ffb703",
            rarities: [{ short: "FT", price: 96.92, chance: 2.123 }]
        },
        {
            name: "M4A4 | In Living Color",
            color: "#eb4b4b",
            rarities: [{ short: "MW", price: 95.28, chance: 1.816 }]
        },
        {
            name: "★ Shadow Daggers | Lore",
            color: "#ffb703",
            rarities: [{ short: "FT", price: 90.38, chance: 2.151 }]
        },
        {
            name: "AK-47 | Neon Rider",
            color: "#eb4b4b",
            rarities: [{ short: "BS", price: 60.25, chance: 8.129 }]
        },
        {
            name: "M4A4 | Neo-Noir",
            color: "#eb4b4b",
            rarities: [{ short: "FT", price: 54.95, chance: 13.438 }]
        },
        {
            name: "P250 | Undertow",
            color: "#d32ce6",
            rarities: [{ short: "MW", price: 46.79, chance: 14.512 }]
        },
        {
            name: "AWP | Fever Dream",
            color: "#d32ce6",
            rarities: [{ short: "FT", price: 18.93, chance: 16.501 }]
        },
        {
            name: "MP9 | Food Chain",
            color: "#d32ce6",
            rarities: [{ short: "MW", price: 11.63, chance: 15.204 }]
        },
        {
            name: "M4A1-S | Liquidation",
            color: "#8847ff",
            rarities: [{ short: "FT", price: 4.02, chance: 16.49 }]
        }
    ]
},
fang: {
    name: "FANG",
    price: 29.21,
    img: "https://key-drop.com/uploads/skins/FANG1.png",
    tag: "BOXES",
    items: [
        {
            name: "M4A4 | Poseidon",
            color: "#d32ce6",
            rarities: [
                { short: "MW", price: 1765.85, chance: 0.02 }
            ]
        },
        {
            name: "AWP | Fade",
            color: "#eb4b4b",
            rarities: [
                { short: "FN", price: 1677.62, chance: 0.039 }
            ]
        },
        {
            name: "★ M9 Bayonet | Tiger Tooth",
            color: "#ffb703",
            rarities: [
                { short: "FN", price: 1085.36, chance: 0.05 }
            ]
        },
        {
            name: "★ Karambit | Lore",
            color: "#ffb703",
            rarities: [
                { short: "FT", price: 918.29, chance: 0.049 }
            ]
        },
        {
            name: "AK-47 | Fire Serpent",
            color: "#eb4b4b",
            rarities: [
                { short: "BS", price: 822.24, chance: 0.049 }
            ]
        },
        {
            name: "M4A4 | Bullet Rain",
            color: "#eb4b4b",
            rarities: [
                { short: "FN", price: 647.54, chance: 0.03 },
                { short: "MW", price: 158.63, chance: 0.111 },
                { short: "FT", price: 116.75, chance: 1.178 }
            ]
        },
        {
            name: "AK-47 | Neon Revolution",
            color: "#eb4b4b",
            rarities: [
                { short: "FN", price: 512.24, chance: 0.015 },
                { short: "WW", price: 157.14, chance: 0.026 },
                { short: "FT", price: 135.54, chance: 0.015 }
            ]
        },
        {
            name: "★ Flip Knife | Fade",
            color: "#ffb703",
            rarities: [
                { short: "FN", price: 476.42, chance: 0.035 }
            ]
        },
        {
            name: "AUG | Akihabara Accept",
            color: "#eb4b4b",
            rarities: [
                { short: "BS", price: 412.22, chance: 0.027 }
            ]
        },
        {
            name: "★ Gut Knife | Gamma Doppler",
            color: "#ffb703",
            rarities: [
                { short: "FN", price: 243.10, chance: 0.052 }
            ]
        },
        {
            name: "★ Bowie Knife | Tiger Tooth",
            color: "#ffb703",
            rarities: [
                { short: "FN", price: 211.54, chance: 0.048 }
            ]
        },
        {
            name: "AK-47 | Vulcan",
            color: "#eb4b4b",
            rarities: [
                { short: "WW", price: 198.57, chance: 0.105 },
                { short: "BS", price: 175.60, chance: 0.284 }
            ]
        },
        {
            name: "AK-47 | Fuel Injector",
            color: "#eb4b4b",
            rarities: [
                { short: "WW", price: 197.98, chance: 0.125 }
            ]
        },
        {
            name: "★ Navaja Knife | Slaughter",
            color: "#ffb703",
            rarities: [
                { short: "FN", price: 151.26, chance: 0.027 }
            ]
        },
        {
            name: "AK-47 | The Empress",
            color: "#eb4b4b",
            rarities: [
                { short: "FT", price: 139.99, chance: 0.06 },
                { short: "WW", price: 135.65, chance: 0.051 },
                { short: "BS", price: 131.51, chance: 0.032 }
            ]
        },
        {
            name: "AK-47 | Neon Rider",
            color: "#eb4b4b",
            rarities: [
                { short: "MW", price: 113.11, chance: 0.50 },
                { short: "FT", price: 70.02, chance: 0.286 },
                { short: "BS", price: 63.12, chance: 0.263 }
            ]
        },
        {
            name: "M4A1-S | Player Two",
            color: "#eb4b4b",
            rarities: [
                { short: "MW", price: 85.45, chance: 0.215 },
                { short: "WW", price: 82.71, chance: 0.24 },
                { short: "FT", price: 79.94, chance: 0.259 },
                { short: "BS", price: 77.10, chance: 0.27 }
            ]
        },
        {
            name: "AWP | Containment Breach",
            color: "#eb4b4b",
            rarities: [
                { short: "WW", price: 85.21, chance: 0.258 },
                { short: "BS", price: 78.54, chance: 0.264 }
            ]
        },
        {
            name: "Desert Eagle | Code Red",
            color: "#eb4b4b",
            rarities: [
                { short: "MW", price: 84.85, chance: 0.279 },
                { short: "FT", price: 63.33, chance: 0.75 },
                { short: "WW", price: 61.53, chance: 0.839 },
                { short: "BS", price: 60.29, chance: 1.949 }
            ]
        },
        {
            name: "AWP | Hyper Beast",
            color: "#eb4b4b",
            rarities: [
                { short: "MW", price: 82.81, chance: 0.291 },
                { short: "FT", price: 53.96, chance: 1.763 },
                { short: "WW", price: 48.82, chance: 1.906 },
                { short: "BS", price: 48.47, chance: 1.945 }
            ]
        },
        {
            name: "AK-47 | Nouveau Rouge",
            color: "#d32ce6",
            rarities: [
                { short: "MW", price: 79.59, chance: 0.286 },
                { short: "FT", price: 21.97, chance: 17.281 },
                { short: "BS", price: 16.55, chance: 3.103 },
                { short: "WW", price: 15.54, chance: 2.811 }
            ]
        },
        {
            name: "AWP | Neo-Noir",
            color: "#eb4b4b",
            rarities: [
                { short: "MW", price: 66.18, chance: 0.768 },
                { short: "BS", price: 63.92, chance: 1.015 },
                { short: "FT", price: 61.01, chance: 0.81 },
                { short: "WW", price: 61.01, chance: 0.923 }
            ]
        },
        {
            name: "AWP | Wildfire",
            color: "#eb4b4b",
            rarities: [
                { short: "WW", price: 63.30, chance: 0.247 },
                { short: "BS", price: 60.90, chance: 0.86 }
            ]
        },
        {
            name: "USP-S | Bleeding Edge",
            color: "#8847ff",
            rarities: [
                { short: "FN", price: 19.37, chance: 18.111 },
                { short: "MW", price: 7.51, chance: 3.347 },
                { short: "WW", price: 3.00, chance: 5.215 },
                { short: "FT", price: 2.75, chance: 5.255 },
                { short: "BS", price: 2.43, chance: 5.166 }
            ]
        },
        {
            name: "Glock-18 | Coral Bloom",
            color: "#4b69ff",
            rarities: [
                { short: "FN", price: 5.05, chance: 4.595 },
                { short: "MW", price: 1.59, chance: 4.511 },
                { short: "WW", price: 0.59, chance: 4.888 },
                { short: "FT", price: 0.49, chance: 3.805 },
                { short: "BS", price: 0.40, chance: 2.298 }
            ]
        }
    ]
},
// Adicione isto ao seu objeto caseData no server.js
razor: {
    name: "RAZOR",
    price: 8.69,
    img: "https://key-drop.com/uploads/skins/RAZOR.png",
    tag: "BOXES",
    items: [
        {
            name: "★ Butterfly Knife | Marble Fade",
            color: "#ffb703",
            rarities: [
                { short: "FN", price: 2332.19, chance: 0.01 }
            ]
        },
        {
            name: "★ Survival Knife | Doppler Phase 4",
            color: "#ffb703",
            rarities: [
                { short: "FN", price: 323.48, chance: 0.029 }
            ]
        },
        {
            name: "AK-47 | Fuel Injector",
            color: "#eb4b4b",
            rarities: [
                { short: "BS", price: 166.00, chance: 0.052 }
            ]
        },
        {
            name: "★ Ursus Knife | Blue Steel",
            color: "#ffb703",
            rarities: [
                { short: "FT", price: 153.70, chance: 0.097 }
            ]
        },
        {
            name: "AK-47 | Neon Revolution",
            color: "#eb4b4b",
            rarities: [
                { short: "FT", price: 135.54, chance: 0.108 }
            ]
        },
        {
            name: "AK-47 | The Empress",
            color: "#eb4b4b",
            rarities: [
                { short: "BS", price: 131.51, chance: 0.101 }
            ]
        },
        {
            name: "AWP | Asiimov",
            color: "#eb4b4b",
            rarities: [
                { short: "WW", price: 120.55, chance: 0.162 }
            ]
        },
        {
            name: "★ Survival Knife | Stained",
            color: "#ffb703",
            rarities: [
                { short: "FT", price: 104.64, chance: 0.271 }
            ]
        },
        {
            name: "★ Gut Knife | Bright Water",
            color: "#ffb703",
            rarities: [
                { short: "FT", price: 95.82, chance: 0.461 }
            ]
        },
        {
            name: "USP-S | Kill Confirmed",
            color: "#eb4b4b",
            rarities: [
                { short: "FT", price: 94.35, chance: 0.108 }
            ]
        },
        {
            name: "★ Shadow Daggers | Lore",
            color: "#ffb703",
            rarities: [
                { short: "FT", price: 92.08, chance: 0.351 }
            ]
        },
        {
            name: "★ Navaja Knife | Blue Steel",
            color: "#ffb703",
            rarities: [
                { short: "FT", price: 85.20, chance: 0.481 }
            ]
        },
        {
            name: "M4A4 | Radiation Hazard",
            color: "#4b69ff",
            rarities: [
                { short: "FT", price: 62.94, chance: 0.605 }
            ]
        },
        {
            name: "SSG 08 | Bloodshot",
            color: "#d32ce6",
            rarities: [
                { short: "FT", price: 29.54, chance: 1.947 }
            ]
        },
        {
            name: "AWP | Fever Dream",
            color: "#d32ce6",
            rarities: [
                { short: "MW", price: 22.93, chance: 0.502 },
                { short: "FT", price: 16.55, chance: 5.307 }
            ]
        },
        {
            name: "CZ75-Auto | Xiangliu",
            color: "#d32ce6",
            rarities: [
                { short: "FT", price: 17.57, chance: 5.386 }
            ]
        },
        {
            name: "AK-47 | Rat Rod",
            color: "#8847ff",
            rarities: [
                { short: "MW", price: 15.13, chance: 0.605 },
                { short: "BS", price: 7.12, chance: 3.111 },
                { short: "WW", price: 6.96, chance: 3.208 },
                { short: "FT", price: 6.23, chance: 4.09 }
            ]
        },
        {
            name: "Glock-18 | Mirror Mosaic",
            color: "#d32ce6",
            rarities: [
                { short: "FT", price: 10.87, chance: 5.629 },
                { short: "WW", price: 9.53, chance: 5.344 }
            ]
        },
        {
            name: "M4A1-S | Rose Hex",
            color: "#4b69ff",
            rarities: [
                { short: "FN", price: 2.47, chance: 0.63 },
                { short: "MW", price: 0.78, chance: 4.429 },
                { short: "FT", price: 0.45, chance: 13.639 },
                { short: "WW", price: 0.40, chance: 18.038 },
                { short: "BS", price: 0.40, chance: 4.619 }
            ]
        },
        {
            name: "Tec-9 | Red Quartz",
            color: "#8847ff",
            rarities: [
                { short: "FN", price: 2.05, chance: 1.906 },
                { short: "MW", price: 0.53, chance: 17.80 },
                { short: "FT", price: 0.46, chance: 0.974 }
            ]
        }
    ]
},
// Adicione isto ao seu objeto caseData no server.js
strike: {
    name: "STRIKE",
    price: 4.72,
    img: "https://key-drop.com/uploads/skins/STRIKE.png",
    tag: "BOXES",
    items: [
        {
            name: "★ Skeleton Knife | Marble Fade",
            color: "#ffb703",
            rarities: [
                { short: "FN", price: 646.93, chance: 0.036 }
            ]
        },
        {
            name: "Glock-18 | Bullet Queen",
            color: "#eb4b4b",
            rarities: [
                { short: "FN", price: 307.42, chance: 0.007 },
                { short: "MW", price: 89.71, chance: 0.026 },
                { short: "FT", price: 82.66, chance: 0.017 }
            ]
        },
        {
            name: "AK-47 | Wasteland Rebel",
            color: "#eb4b4b",
            rarities: [
                { short: "FT", price: 120.04, chance: 0.031 }
            ]
        },
        {
            name: "M4A1-S | Golden Coil",
            color: "#eb4b4b",
            rarities: [
                { short: "WW", price: 75.49, chance: 0.06 }
            ]
        },
        {
            name: "AWP | Hyper Beast",
            color: "#eb4b4b",
            rarities: [
                { short: "FT", price: 53.96, chance: 0.144 }
            ]
        },
        {
            name: "AK-47 | Redline",
            color: "#d32ce6",
            rarities: [
                { short: "WW", price: 41.91, chance: 0.158 }
            ]
        },
        {
            name: "M4A4 | Cyber Security",
            color: "#d32ce6",
            rarities: [
                { short: "FT", price: 41.49, chance: 0.173 }
            ]
        },
        {
            name: "AK-47 | Frontside Misty",
            color: "#d32ce6",
            rarities: [
                { short: "FT", price: 26.00, chance: 0.255 }
            ]
        },
        {
            name: "P2000 | Imperial Dragon",
            color: "#d32ce6",
            rarities: [
                { short: "MW", price: 23.58, chance: 0.051 },
                { short: "FT", price: 16.25, chance: 1.242 }
            ]
        },
        {
            name: "M4A4 | Desolate Space",
            color: "#d32ce6",
            rarities: [
                { short: "FT", price: 18.45, chance: 0.437 },
                { short: "WW", price: 16.89, chance: 0.45 },
                { short: "BS", price: 16.23, chance: 1.102 }
            ]
        },
        {
            name: "M4A1-S | Decimator",
            color: "#d32ce6",
            rarities: [
                { short: "FT", price: 16.31, chance: 0.891 }
            ]
        },
        {
            name: "M4A1-S | Nightmare",
            color: "#d32ce6",
            rarities: [
                { short: "FT", price: 12.41, chance: 0.504 },
                { short: "BS", price: 11.85, chance: 1.975 },
                { short: "WW", price: 10.60, chance: 1.828 }
            ]
        },
        {
            name: "AK-47 | Phantom Disruptor",
            color: "#d32ce6",
            rarities: [
                { short: "MW", price: 12.26, chance: 0.449 },
                { short: "WW", price: 11.11, chance: 0.962 },
                { short: "BS", price: 8.43, chance: 0.905 },
                { short: "FT", price: 8.42, chance: 2.576 }
            ]
        },
        {
            name: "Galil AR | Signal",
            color: "#8847ff",
            rarities: [
                { short: "FN", price: 12.11, chance: 0.152 },
                { short: "MW", price: 1.66, chance: 3.988 },
                { short: "WW", price: 1.04, chance: 5.222 },
                { short: "BS", price: 1.00, chance: 5.988 },
                { short: "FT", price: 0.90, chance: 7.615 }
            ]
        },
        {
            name: "FAMAS | ZX Spectron",
            color: "#8847ff",
            rarities: [
                { short: "MW", price: 10.42, chance: 0.446 },
                { short: "FT", price: 4.94, chance: 9.916 }
            ]
        },
        {
            name: "FAMAS | Valence",
            color: "#8847ff",
            rarities: [
                { short: "FT", price: 5.32, chance: 4.235 },
                { short: "WW", price: 5.08, chance: 2.781 },
                { short: "BS", price: 4.53, chance: 3.419 }
            ]
        },
        {
            name: "CZ75-Auto | Tigris",
            color: "#8847ff",
            rarities: [
                { short: "MW", price: 4.29, chance: 4.321 },
                { short: "FT", price: 3.08, chance: 4.234 }
            ]
        },
        {
            name: "M4A1-S | Nitro",
            color: "#8847ff",
            rarities: [
                { short: "MW", price: 1.40, chance: 5.655 },
                { short: "WW", price: 0.63, chance: 11.878 },
                { short: "FT", price: 0.61, chance: 12.086 },
                { short: "BS", price: 0.60, chance: 3.785 }
            ]
        }
    ]
},
// Adicione isto ao seu objeto caseData no server.js
dragon: {
    name: "DRAGON",
    price: 3.88,
    img: "https://key-drop.com/uploads/skins/DRAGON.png",
    tag: "BOXES",
    items: [
        {
            name: "M4A4 | Howl",
            color: "#ffb703",
            rarities: [
                { short: "FT", price: 6394.61, chance: 0.005 }
            ]
        },
        {
            name: "★ Navaja Knife | Doppler - Ruby",
            color: "#ffb703",
            rarities: [
                { short: "FN", price: 419.15, chance: 0.003 }
            ]
        },
        {
            name: "P90 | Death by Kitty",
            color: "#eb4b4b",
            rarities: [
                { short: "FT", price: 140.37, chance: 0.005 }
            ]
        },
        {
            name: "AK-47 | The Oligarch",
            color: "#eb4b4b",
            rarities: [
                { short: "WW", price: 65.78, chance: 0.021 }
            ]
        },
        {
            name: "P250 | Mehndi",
            color: "#d32ce6",
            rarities: [
                { short: "MW", price: 35.82, chance: 0.192 }
            ]
        },
        {
            name: "USP-S | Overgrowth",
            color: "#8847ff",
            rarities: [
                { short: "FT", price: 31.66, chance: 0.121 }
            ]
        },
        {
            name: "Desert Eagle | Kumicho Dragon",
            color: "#d32ce6",
            rarities: [
                { short: "FT", price: 29.70, chance: 0.244 }
            ]
        },
        {
            name: "MAC-10 | Graven",
            color: "#8847ff",
            rarities: [
                { short: "FT", price: 29.39, chance: 0.201 }
            ]
        },
        {
            name: "AK-47 | Cartel",
            color: "#d32ce6",
            rarities: [
                { short: "FT", price: 26.81, chance: 0.246 }
            ]
        },
        {
            name: "Dual Berettas | Hemoglobin",
            color: "#8847ff",
            rarities: [
                { short: "MW", price: 22.23, chance: 0.404 }
            ]
        },
        {
            name: "Nova | Rising Skull",
            color: "#8847ff",
            rarities: [
                { short: "FN", price: 17.38, chance: 0.416 },
                { short: "MW", price: 7.43, chance: 2.994 }
            ]
        },
        {
            name: "M4A1-S | Decimator",
            color: "#d32ce6",
            rarities: [
                { short: "FT", price: 16.31, chance: 0.401 }
            ]
        },
        {
            name: "M4A1-S | Leaded Glass",
            color: "#d32ce6",
            rarities: [
                { short: "MW", price: 14.31, chance: 0.918 },
                { short: "FT", price: 13.31, chance: 1.255 }
            ]
        },
        {
            name: "M4A4 | Griffin",
            color: "#8847ff",
            rarities: [
                { short: "MW", price: 13.98, chance: 0.797 }
            ]
        },
        {
            name: "Desert Eagle | Mecha Industries",
            color: "#d32ce6",
            rarities: [
                { short: "FT", price: 8.43, chance: 1.091 },
                { short: "BS", price: 8.28, chance: 0.754 }
            ]
        },
        {
            name: "FAMAS | Eye of Athena",
            color: "#d32ce6",
            rarities: [
                { short: "BS", price: 7.62, chance: 1.277 },
                { short: "FT", price: 7.36, chance: 1.261 }
            ]
        },
        {
            name: "AK-47 | Rat Rod",
            color: "#8847ff",
            rarities: [
                { short: "BS", price: 7.12, chance: 0.938 },
                { short: "WW", price: 6.96, chance: 0.946 },
                { short: "FT", price: 6.23, chance: 2.175 }
            ]
        },
        {
            name: "Glock-18 | Royal Legion",
            color: "#8847ff",
            rarities: [
                { short: "FT", price: 4.38, chance: 1.899 },
                { short: "WW", price: 3.69, chance: 3.182 }
            ]
        },
        {
            name: "SG 553 | Tiger Moth",
            color: "#8847ff",
            rarities: [
                { short: "MW", price: 4.27, chance: 0.48 },
                { short: "FT", price: 1.66, chance: 6.063 },
                { short: "WW", price: 1.39, chance: 4.549 },
                { short: "BS", price: 1.29, chance: 6.548 }
            ]
        },
        {
            name: "Sawed-Off | Serenity",
            color: "#8847ff",
            rarities: [
                { short: "MW", price: 3.69, chance: 5.098 }
            ]
        },
        {
            name: "AWP | Phobos",
            color: "#8847ff",
            rarities: [
                { short: "MW", price: 3.67, chance: 2.991 },
                { short: "FT", price: 3.35, chance: 3.075 }
            ]
        },
        {
            name: "AK-47 | Steel Delta",
            color: "#4b69ff",
            rarities: [
                { short: "WW", price: 3.60, chance: 3.36 },
                { short: "FT", price: 3.30, chance: 1.658 },
                { short: "BS", price: 3.30, chance: 2.122 }
            ]
        },
        {
            name: "SG 553 | Dragon Tech",
            color: "#8847ff",
            rarities: [
                { short: "MW", price: 1.15, chance: 4.873 },
                { short: "WW", price: 0.69, chance: 4.921 },
                { short: "BS", price: 0.63, chance: 5.551 },
                { short: "FT", price: 0.55, chance: 6.686 }
            ]
        },
        {
            name: "Nova | Dark Sigil",
            color: "#4b69ff",
            rarities: [
                { short: "FN", price: 0.78, chance: 4.044 },
                { short: "MW", price: 0.23, chance: 2.083 },
                { short: "WW", price: 0.09, chance: 7.131 },
                { short: "FT", price: 0.08, chance: 1.406 },
                { short: "BS", price: 0.08, chance: 5.615 }
            ]
        }
    ]
},
drink_me: {
    name: "DRINK ME",
    price: 1.00,
    img: "https://key-drop.com/uploads/skins/1_DRINK_ME.png",
    tag: "NEW",
    items: [
        {
            name: "★ Flip Knife | Tiger Tooth",
            color: "#ffb703",
            rarities: [
                { short: "FN", price: 317.04, chance: 0.002 }
            ]
        },
        {
            name: "AWP | Containment Breach",
            color: "#eb4b4b",
            rarities: [
                { short: "FT", price: 169.25, chance: 0.001 },
                { short: "WW", price: 87.74, chance: 0.009 },
                { short: "BS", price: 77.03, chance: 0.008 }
            ]
        },
        {
            name: "M4A1-S | Player Two",
            color: "#eb4b4b",
            rarities: [
                { short: "FT", price: 85.4, chance: 0.009 }
            ]
        },
        {
            name: "AK-47 | Asiimov",
            color: "#eb4b4b",
            rarities: [
                { short: "FT", price: 61.4, chance: 0.028 }
            ]
        },
        {
            name: "P250 | Kintsugi",
            color: "#d32ce6",
            rarities: [
                { short: "FN", price: 57.65, chance: 0.001 },
                { short: "MW", price: 22.22, chance: 0.01 },
                { short: "FT", price: 11.91, chance: 0.021 },
                { short: "WW", price: 10.33, chance: 0.011 },
                { short: "BS", price: 8.36, chance: 0.008 }
            ]
        },
        {
            name: "MP7 | Smoking Kills",
            color: "#d32ce6",
            rarities: [
                { short: "FT", price: 12.16, chance: 0.059 }
            ]
        },
        {
            name: "AWP | Ice Coaled",
            color: "#d32ce6",
            rarities: [
                { short: "WW", price: 10.26, chance: 0.021 },
                { short: "BS", price: 7.61, chance: 0.107 }
            ]
        },
        {
            name: "AK-47 | Searing Rage",
            color: "#d32ce6",
            rarities: [
                { short: "FT", price: 8.18, chance: 0.06 },
                { short: "WW", price: 7.29, chance: 0.048 },
                { short: "BS", price: 6.74, chance: 0.048 }
            ]
        },
        {
            name: "SG 553 | Cyrex",
            color: "#d32ce6",
            rarities: [
                { short: "BS", price: 7.61, chance: 0.044 },
                { short: "FT", price: 7.48, chance: 0.048 }
            ]
        },
        {
            name: "USP-S | Cortex",
            color: "#d32ce6",
            rarities: [
                { short: "FT", price: 6.12, chance: 0.052 },
                { short: "WW", price: 5.44, chance: 0.287 },
                { short: "BS", price: 5.04, chance: 0.052 }
            ]
        },
        {
            name: "AK-47 | Safety Net",
            color: "#8847ff",
            rarities: [
                { short: "BS", price: 4.69, chance: 0.251 },
                { short: "FT", price: 4.5, chance: 0.238 }
            ]
        },
        {
            name: "Galil AR | Galigator",
            color: "#8847ff",
            rarities: [
                { short: "MW", price: 4.65, chance: 0.026 },
                { short: "FT", price: 2.47, chance: 0.55 },
                { short: "WW", price: 2, chance: 1.507 },
                { short: "BS", price: 1.61, chance: 1.705 }
            ]
        },
        {
            name: "M4A1-S | Night Terror",
            color: "#8847ff",
            rarities: [
                { short: "FN", price: 4.44, chance: 0.049 },
                { short: "MW", price: 1.51, chance: 2.039 },
                { short: "WW", price: 1.21, chance: 2.052 },
                { short: "BS", price: 1.21, chance: 2.022 }
            ]
        },
        {
            name: "M4A1-S | Solitude",
            color: "#d32ce6",
            rarities: [
                { short: "WW", price: 3.43, chance: 0.596 },
                { short: "FT", price: 2.93, chance: 1.505 },
                { short: "BS", price: 1.98, chance: 1.363 }
            ]
        },
        {
            name: "PP-Bizon | Embargo",
            color: "#8847ff",
            rarities: [
                { short: "FT", price: 2.96, chance: 1.025 },
                { short: "WW", price: 2.78, chance: 0.523 },
                { short: "BS", price: 2.69, chance: 0.585 }
            ]
        },
        {
            name: "USP-S | Silent Shot",
            color: "#4b69ff",
            rarities: [
                { short: "FT", price: 2.7, chance: 0.04 },
                { short: "WW", price: 2.68, chance: 1.811 },
                { short: "BS", price: 1.33, chance: 2.374 }
            ]
        },
        {
            name: "P250 | Inferno",
            color: "#8847ff",
            rarities: [
                { short: "MW", price: 2.53, chance: 0.045 },
                { short: "BS", price: 0.89, chance: 3.974 },
                { short: "FT", price: 0.86, chance: 4.064 }
            ]
        },
        {
            name: "AWP | Pit Viper",
            color: "#8847ff",
            rarities: [
                { short: "MW", price: 2.33, chance: 0.452 },
                { short: "BS", price: 1.44, chance: 2.857 },
                { short: "FT", price: 1.14, chance: 2.851 }
            ]
        },
        {
            name: "M4A1-S | Fizzy POP",
            color: "#4b69ff",
            rarities: [
                { short: "FT", price: 2.25, chance: 1.846 }
            ]
        },
        {
            name: "AWP | Acheron",
            color: "#4b69ff",
            rarities: [
                { short: "MW", price: 2.21, chance: 0.047 },
                { short: "WW", price: 1.66, chance: 0.138 },
                { short: "FT", price: 0.94, chance: 3.711 },
                { short: "BS", price: 0.69, chance: 3.931 }
            ]
        },
        {
            name: "P250 | Bullfrog",
            color: "#4b69ff",
            rarities: [
                { short: "FN", price: 1.59, chance: 0.052 },
                { short: "MW", price: 0.38, chance: 1.478 },
                { short: "FT", price: 0.18, chance: 3.479 },
                { short: "WW", price: 0.09, chance: 3.647 },
                { short: "BS", price: 0.09, chance: 3.866 }
            ]
        },
        {
            name: "Sawed-Off | Full Stop",
            color: "#4b69ff",
            rarities: [
                { short: "FN", price: 1.29, chance: 0.056 },
                { short: "MW", price: 0.3, chance: 3.227 },
                { short: "FT", price: 0.15, chance: 2.783 },
                { short: "WW", price: 0.14, chance: 2.344 },
                { short: "BS", price: 0.11, chance: 2.71 }
            ]
        },
        {
            name: "M4A1-S | Wash me plz",
            color: "#5e98d9",
            rarities: [
                { short: "FN", price: 1.09, chance: 0.994 },
                { short: "MW", price: 0.15, chance: 2.486 },
                { short: "WW", price: 0.14, chance: 2.485 },
                { short: "FT", price: 0.06, chance: 1.9 },
                { short: "BS", price: 0.06, chance: 3.315 }
            ]
        },
        {
            name: "M4A4 | Zubastick",
            color: "#4b69ff",
            rarities: [
                { short: "MW", price: 0.84, chance: 0.082 },
                { short: "FT", price: 0.38, chance: 3.112 },
                { short: "WW", price: 0.33, chance: 1.565 },
                { short: "BS", price: 0.31, chance: 4.232 }
            ]
        },
        {
            name: "M4A4 | Choppa",
            color: "#4b69ff",
            rarities: [
                { short: "FN", price: 4.73, chance: 0.058 },
                { short: "MW", price: 0.39, chance: 3.009 },
                { short: "FT", price: 0.14, chance: 2.343 },
                { short: "WW", price: 0.1, chance: 2.981 },
                { short: "BS", price: 0.1, chance: 2.685 }
            ]
        }
    ]
},
tick_tock: {
    name: "TICK TOCK",
    price: 2.50,
    img: "https://key-drop.com/uploads/skins/2_TICK_TOCK.png",
    tag: "NEW",
    items: [
        {
            name: "★ Bowie Knife | Gamma Doppler Emerald",
            color: "#ffb703",
            rarities: [
                { short: "FN", price: 848.27, chance: 0.005 }
            ]
        },
        {
            name: "★ Paracord Knife | Fade",
            color: "#ffb703",
            rarities: [
                { short: "FN", price: 256.85, chance: 0.009 }
            ]
        },
        {
            name: "M4A1-S | Hyper Beast",
            color: "#eb4b4b",
            rarities: [
                { short: "FT", price: 182.68, chance: 0.021 }
            ]
        },
        {
            name: "AWP | Queen's Gambit",
            color: "#eb4b4b",
            rarities: [
                { short: "FT", price: 132.30, chance: 0.01 }
            ]
        },
        {
            name: "★ Broken Fang Gloves | Jade",
            color: "#ffb703",
            rarities: [
                { short: "BS", price: 127.27, chance: 0.032 }
            ]
        },
        {
            name: "AK-47 | Neon Rider",
            color: "#eb4b4b",
            rarities: [
                { short: "MW", price: 120.24, chance: 0.005 },
                { short: "WW", price: 85.81, chance: 0.009 },
                { short: "FT", price: 70.23, chance: 0.011 },
                { short: "BS", price: 68.29, chance: 0.015 }
            ]
        },
        {
            name: "AK-47 | Inheritance",
            color: "#eb4b4b",
            rarities: [
                { short: "FT", price: 73.04, chance: 0.075 }
            ]
        },
        {
            name: "AK-47 | Asiimov",
            color: "#eb4b4b",
            rarities: [
                { short: "BS", price: 62.34, chance: 0.086 }
            ]
        },
        {
            name: "P90 | Deathgaze",
            color: "#d32ce6",
            rarities: [
                { short: "FN", price: 53.56, chance: 0.006 },
                { short: "MW", price: 21.56, chance: 0.019 },
                { short: "FT", price: 11.33, chance: 0.533 }
            ]
        },
        {
            name: "Glock-18 | Shinobu",
            color: "#d32ce6",
            rarities: [
                { short: "MW", price: 15.24, chance: 0.005 },
                { short: "FT", price: 8.30, chance: 0.442 },
                { short: "BS", price: 6.96, chance: 0.473 }
            ]
        },
        {
            name: "AK-47 | Searing Rage",
            color: "#d32ce6",
            rarities: [
                { short: "MW", price: 13.60, chance: 0.005 },
                { short: "WW", price: 7.29, chance: 0.463 },
                { short: "BS", price: 6.74, chance: 0.473 }
            ]
        },
        {
            name: "MP7 | Just Smile",
            color: "#8847ff",
            rarities: [
                { short: "FN", price: 11.32, chance: 0.045 },
                { short: "MW", price: 1.73, chance: 0.472 },
                { short: "FT", price: 0.71, chance: 4.749 },
                { short: "WW", price: 0.66, chance: 3.826 },
                { short: "BS", price: 0.66, chance: 3.826 }
            ]
        },
        {
            name: "M4A4 | Tooth Fairy",
            color: "#d32ce6",
            rarities: [
                { short: "MW", price: 9.52, chance: 0.173 },
                { short: "FT", price: 5.99, chance: 2.623 }
            ]
        },
        {
            name: "M4A1-S | Liquidation",
            color: "#8847ff",
            rarities: [
                { short: "MW", price: 7.96, chance: 0.049 },
                { short: "FT", price: 4.23, chance: 0.452 },
                { short: "WW", price: 2.59, chance: 1.486 },
                { short: "BS", price: 1.76, chance: 2.455 }
            ]
        },
        {
            name: "AUG | Luxe Trim",
            color: "#4b69ff",
            rarities: [
                { short: "FN", price: 7.72, chance: 0.049 },
                { short: "MW", price: 0.64, chance: 1.806 },
                { short: "FT", price: 0.30, chance: 3.815 },
                { short: "WW", price: 0.18, chance: 2.958 },
                { short: "BS", price: 0.16, chance: 3.331 }
            ]
        },
        {
            name: "Sawed-Off | Devourer",
            color: "#d32ce6",
            rarities: [
                { short: "FT", price: 6.98, chance: 0.951 }
            ]
        },
        {
            name: "USP-S | Cortex",
            color: "#d32ce6",
            rarities: [
                { short: "FT", price: 6.12, chance: 0.199 },
                { short: "WW", price: 5.44, chance: 1.418 },
                { short: "BS", price: 5.04, chance: 1.869 }
            ]
        },
        {
            name: "AWP | Duality",
            color: "#d32ce6",
            rarities: [
                { short: "FT", price: 5.88, chance: 0.964 },
                { short: "WW", price: 5.52, chance: 0.978 },
                { short: "BS", price: 5.03, chance: 0.995 }
            ]
        },
        {
            name: "AK-47 | Elite Build",
            color: "#4b69ff",
            rarities: [
                { short: "MW", price: 4.92, chance: 0.931 },
                { short: "FT", price: 3.35, chance: 1.829 }
            ]
        },
        {
            name: "M4A4 | Poly Mag",
            color: "#4b69ff",
            rarities: [
                { short: "FN", price: 4.50, chance: 0.045 },
                { short: "MW", price: 0.30, chance: 1.863 },
                { short: "WW", price: 0.10, chance: 3.093 },
                { short: "FT", price: 0.10, chance: 2.466 },
                { short: "BS", price: 0.10, chance: 2.261 }
            ]
        },
        {
            name: "Dual Berettas | Twin Turbo",
            color: "#d32ce6",
            rarities: [
                { short: "FT", price: 4.15, chance: 0.499 },
                { short: "WW", price: 2.73, chance: 2.044 },
                { short: "BS", price: 2.60, chance: 2.588 }
            ]
        },
        {
            name: "MP9 | Urban Sovereign",
            color: "#8847ff",
            rarities: [
                { short: "MW", price: 3.90, chance: 0.611 },
                { short: "FT", price: 2.35, chance: 1.575 },
                { short: "WW", price: 1.98, chance: 5.131 },
                { short: "BS", price: 1.53, chance: 4.228 }
            ]
        },
        {
            name: "M4A1-S | Solitude",
            color: "#d32ce6",
            rarities: [
                { short: "WW", price: 3.43, chance: 0.49 },
                { short: "FT", price: 2.93, chance: 4.482 }
            ]
        },
        {
            name: "Desert Eagle | Heat Treated",
            color: "#d32ce6",
            rarities: [
                { short: "FT", price: 2.18, chance: 3.546 },
                { short: "WW", price: 1.85, chance: 3.791 },
                { short: "BS", price: 1.84, chance: 3.507 }
            ]
        },
        {
            name: "Souvenir MP5-SD | Lab Rats",
            color: "#8847ff",
            rarities: [
                { short: "FN", price: 0.75, chance: 4.000 },
                { short: "FT", price: 0.46, chance: 4.116 },
                { short: "MW", price: 0.46, chance: 4.718 }
            ]
        }
    ]
},
dream_or_real: {
    name: "DREAM OR REAL",
    price: 5.00,
    img: "https://key-drop.com/uploads/skins/3_DREAM_OR_REAL.png",
    tag: "NEW",
    items: [
        {
            name: "★ Survival Knife | Doppler Ruby",
            color: "#ffb703",
            rarities: [
                { short: "FN", price: 856.62, chance: 0.005 }
            ]
        },
        {
            name: "★ Skeleton Knife | Marble Fade",
            color: "#ffb703",
            rarities: [
                { short: "FN", price: 629.68, chance: 0.005 }
            ]
        },
        {
            name: "★ Flip Knife | Gamma Doppler Phase 3",
            color: "#ffb703",
            rarities: [
                { short: "FN", price: 629.58, chance: 0.01 }
            ]
        },
        {
            name: "AWP | CMYK",
            color: "#eb4b4b",
            rarities: [
                { short: "WW", price: 383.81, chance: 0.011 }
            ]
        },
        {
            name: "M4A1-S | Printstream",
            color: "#eb4b4b",
            rarities: [
                { short: "BS", price: 245.17, chance: 0.021 }
            ]
        },
        {
            name: "★ Ursus Knife | Tiger Tooth",
            color: "#ffb703",
            rarities: [
                { short: "FN", price: 230.17, chance: 0.011 }
            ]
        },
        {
            name: "AWP | Containment Breach",
            color: "#eb4b4b",
            rarities: [
                { short: "FT", price: 169.25, chance: 0.053 }
            ]
        },
        {
            name: "★ Survival Knife | Case Hardened",
            color: "#ffb703",
            rarities: [
                { short: "FT", price: 148.19, chance: 0.077 }
            ]
        },
        {
            name: "Glock-18 | Fully Tuned",
            color: "#eb4b4b",
            rarities: [
                { short: "FT", price: 115.10, chance: 0.023 },
                { short: "BS", price: 83.71, chance: 0.041 }
            ]
        },
        {
            name: "AK-47 | Crane Flight",
            color: "#d32ce6",
            rarities: [
                { short: "FT", price: 48.73, chance: 0.009 },
                { short: "WW", price: 31.59, chance: 0.097 },
                { short: "BS", price: 25.25, chance: 0.224 }
            ]
        },
        {
            name: "AWP | Ice Coaled",
            color: "#d32ce6",
            rarities: [
                { short: "MW", price: 22.46, chance: 0.055 },
                { short: "FT", price: 12.30, chance: 1.637 },
                { short: "WW", price: 10.26, chance: 1.561 }
            ]
        },
        {
            name: "AK-47 | Point Disarray",
            color: "#d32ce6",
            rarities: [
                { short: "FT", price: 20.75, chance: 0.541 }
            ]
        },
        {
            name: "M4A1-S | Nightmare",
            color: "#d32ce6",
            rarities: [
                { short: "FT", price: 14.94, chance: 1.382 }
            ]
        },
        {
            name: "AK-47 | Searing Rage",
            color: "#d32ce6",
            rarities: [
                { short: "MW", price: 13.60, chance: 1.433 },
                { short: "FT", price: 8.18, chance: 1.004 },
                { short: "WW", price: 7.29, chance: 0.941 },
                { short: "BS", price: 6.74, chance: 1.428 }
            ]
        },
        {
            name: "AK-47 | Phantom Disruptor",
            color: "#d32ce6",
            rarities: [
                { short: "MW", price: 13.34, chance: 0.513 },
                { short: "WW", price: 11.65, chance: 0.519 },
                { short: "FT", price: 8.90, chance: 1.980 }
            ]
        },
        {
            name: "M4A4 | Spider Lily",
            color: "#8847ff",
            rarities: [
                { short: "FT", price: 12.26, chance: 1.971 }
            ]
        },
        {
            name: "MP9 | Food Chain",
            color: "#d32ce6",
            rarities: [
                { short: "MW", price: 11.47, chance: 0.050 },
                { short: "FT", price: 6.12, chance: 1.260 },
                { short: "WW", price: 5.35, chance: 1.436 },
                { short: "BS", price: 5.13, chance: 1.520 }
            ]
        },
        {
            name: "M4A1-S | Electrum",
            color: "#8847ff",
            rarities: [
                { short: "MW", price: 9.76, chance: 1.127 },
                { short: "FT", price: 5.80, chance: 4.737 }
            ]
        },
        {
            name: "USP-S | Jawbreaker",
            color: "#d32ce6",
            rarities: [
                { short: "FT", price: 6.54, chance: 2.076 },
                { short: "WW", price: 5.43, chance: 2.067 },
                { short: "BS", price: 4.82, chance: 2.137 }
            ]
        },
        {
            name: "Zeus x27 | Charged Up",
            color: "#8847ff",
            rarities: [
                { short: "FT", price: 6.54, chance: 1.256 },
                { short: "WW", price: 4.84, chance: 4.288 },
                { short: "BS", price: 3.97, chance: 4.059 }
            ]
        },
        {
            name: "USP-S | Guardian",
            color: "#8847ff",
            rarities: [
                { short: "MW", price: 5.65, chance: 0.484 },
                { short: "FT", price: 4.57, chance: 7.715 }
            ]
        },
        {
            name: "USP-S | Tropical Breeze",
            color: "#4b69ff",
            rarities: [
                { short: "FN", price: 4.32, chance: 0.437 },
                { short: "MW", price: 2.23, chance: 2.049 },
                { short: "WW", price: 1.21, chance: 4.834 },
                { short: "FT", price: 0.93, chance: 4.857 },
                { short: "BS", price: 0.45, chance: 4.733 }
            ]
        },
        {
            name: "M249 | Downtown",
            color: "#8847ff",
            rarities: [
                { short: "FN", price: 3.33, chance: 0.514 },
                { short: "MW", price: 1.10, chance: 1.464 },
                { short: "FT", price: 0.63, chance: 4.965 },
                { short: "WW", price: 0.61, chance: 3.647 },
                { short: "BS", price: 0.60, chance: 4.881 }
            ]
        },
        {
            name: "M4A1-S | Rose Hex",
            color: "#4b69ff",
            rarities: [
                { short: "FN", price: 2.68, chance: 0.926 },
                { short: "MW", price: 0.83, chance: 2.155 },
                { short: "WW", price: 0.40, chance: 3.024 },
                { short: "BS", price: 0.40, chance: 5.707 },
                { short: "FT", price: 0.39, chance: 6.043 }
            ]
        }
    ]
},
mad_tea: {
    name: "MAD TEA",
    price: 20.00,
    img: "https://key-drop.com/uploads/skins/4_MAD_TEA.png",
    tag: "NEW",
    items: [
        {
            name: "★ Talon Knife | Doppler Sapphire",
            color: "#ffb703",
            rarities: [
                { short: "FN", price: 2807.95, chance: 0.01 }
            ]
        },
        {
            name: "★ Butterfly Knife | Tiger Tooth",
            color: "#ffb703",
            rarities: [
                { short: "FN", price: 1860.77, chance: 0.021 }
            ]
        },
        {
            name: "★ Bayonet | Gamma Doppler Phase 2",
            color: "#ffb703",
            rarities: [
                { short: "FN", price: 975.79, chance: 0.022 }
            ]
        },
        {
            name: "★ Gut Knife | Doppler Ruby",
            color: "#ffb703",
            rarities: [
                { short: "FN", price: 687.69, chance: 0.03 }
            ]
        },
        {
            name: "★ Survival Knife | Doppler Phase 2",
            color: "#ffb703",
            rarities: [
                { short: "FN", price: 363.12, chance: 0.042 }
            ]
        },
        {
            name: "★ Bowie Knife | Fade",
            color: "#ffb703",
            rarities: [
                { short: "FN", price: 333.37, chance: 0.03 }
            ]
        },
        {
            name: "★ Survival Knife | Fade",
            color: "#ffb703",
            rarities: [
                { short: "FN", price: 231.71, chance: 0.038 }
            ]
        },
        {
            name: "★ Gut Knife | Doppler Phase 4",
            color: "#ffb703",
            rarities: [
                { short: "FN", price: 206.30, chance: 0.045 }
            ]
        },
        {
            name: "★ Driver Gloves | Rezan the Red",
            color: "#ffb703",
            rarities: [
                { short: "FT", price: 145.30, chance: 0.097 }
            ]
        },
        {
            name: "★ Survival Knife | Ultraviolet",
            color: "#ffb703",
            rarities: [
                { short: "FT", price: 104.43, chance: 0.207 }
            ]
        },
        {
            name: "USP-S | Kill Confirmed",
            color: "#eb4b4b",
            rarities: [
                { short: "BS", price: 87.20, chance: 0.254 }
            ]
        },
        {
            name: "M4A1-S | Vaporwave",
            color: "#eb4b4b",
            rarities: [
                { short: "FT", price: 87.02, chance: 0.052 },
                { short: "WW", price: 78.84, chance: 0.052 },
                { short: "BS", price: 77.68, chance: 0.824 }
            ]
        },
        {
            name: "AK-47 | The Oligarch",
            color: "#eb4b4b",
            rarities: [
                { short: "WW", price: 75.54, chance: 0.101 },
                { short: "BS", price: 64.78, chance: 1.391 }
            ]
        },
        {
            name: "AWP | Printstream",
            color: "#eb4b4b",
            rarities: [
                { short: "WW", price: 68.26, chance: 0.769 },
                { short: "BS", price: 66.26, chance: 0.508 }
            ]
        },
        {
            name: "M4A4 | Full Throttle",
            color: "#eb4b4b",
            rarities: [
                { short: "WW", price: 57.74, chance: 0.499 },
                { short: "BS", price: 43.30, chance: 4.386 }
            ]
        },
        {
            name: "AK-47 | Crane Flight",
            color: "#d32ce6",
            rarities: [
                { short: "FT", price: 48.73, chance: 0.097 },
                { short: "WW", price: 31.59, chance: 1.278 },
                { short: "BS", price: 25.25, chance: 1.637 }
            ]
        },
        {
            name: "M4A4 | Cyber Security",
            color: "#d32ce6",
            rarities: [
                { short: "FT", price: 40.05, chance: 5.579 }
            ]
        },
        {
            name: "AK-47 | Frontside Misty",
            color: "#d32ce6",
            rarities: [
                { short: "FT", price: 27.32, chance: 0.517 },
                { short: "WW", price: 26.00, chance: 1.037 },
                { short: "BS", price: 23.76, chance: 3.755 }
            ]
        },
        {
            name: "Glock-18 | Snack Attack",
            color: "#d32ce6",
            rarities: [
                { short: "WW", price: 24.08, chance: 2.127 },
                { short: "BS", price: 23.12, chance: 2.006 }
            ]
        },
        {
            name: "SSG 08 | Big Iron",
            color: "#d32ce6",
            rarities: [
                { short: "MW", price: 23.82, chance: 0.466 },
                { short: "WW", price: 16.74, chance: 1.455 },
                { short: "FT", price: 15.39, chance: 5.719 },
                { short: "BS", price: 15.31, chance: 3.781 }
            ]
        },
        {
            name: "AWP | Ice Coaled",
            color: "#d32ce6",
            rarities: [
                { short: "MW", price: 22.46, chance: 4.574 }
            ]
        },
        {
            name: "M4A4 | Desolate Space",
            color: "#d32ce6",
            rarities: [
                { short: "FT", price: 20.26, chance: 1.910 },
                { short: "WW", price: 18.45, chance: 4.653 },
                { short: "BS", price: 16.80, chance: 4.779 }
            ]
        },
        {
            name: "Glock-18 | Glockingbird",
            color: "#8847ff",
            rarities: [
                { short: "FN", price: 16.08, chance: 0.052 },
                { short: "MW", price: 4.73, chance: 0.519 },
                { short: "FT", price: 1.87, chance: 3.851 },
                { short: "WW", price: 1.84, chance: 3.190 },
                { short: "BS", price: 1.69, chance: 3.217 }
            ]
        },
        {
            name: "Desert Eagle | Heat Treated",
            color: "#d32ce6",
            rarities: [
                { short: "MW", price: 5.09, chance: 3.176 },
                { short: "FT", price: 2.18, chance: 4.022 },
                { short: "WW", price: 1.85, chance: 1.702 },
                { short: "BS", price: 1.84, chance: 2.058 }
            ]
        },
        {
            name: "M4A1-S | Night Terror",
            color: "#8847ff",
            rarities: [
                { short: "FN", price: 4.44, chance: 0.505 },
                { short: "MW", price: 1.51, chance: 3.112 },
                { short: "WW", price: 1.21, chance: 2.031 },
                { short: "BS", price: 1.21, chance: 2.975 },
                { short: "FT", price: 0.95, chance: 4.387 }
            ]
        },
        {
            name: "AWP | Pit Viper",
            color: "#8847ff",
            rarities: [
                { short: "MW", price: 2.33, chance: 3.761 },
                { short: "WW", price: 1.93, chance: 1.869 },
                { short: "BS", price: 1.44, chance: 2.929 },
                { short: "FT", price: 1.14, chance: 1.896 }
            ]
        }
    ]
},
checkmate: {
    name: "CHECKMATE",
    price: 50.00,
    img: "https://key-drop.com/uploads/skins/5_CHECKMATE.png",
    tag: "NEW",
    items: [
        {
            name: "★ Specialist Gloves | Emerald Web",
            color: "#ffb703",
            rarities: [
                { short: "MW", price: 3851.48, chance: 0.011 }
            ]
        },
        {
            name: "Glock-18 | Fade",
            color: "#8847ff",
            rarities: [
                { short: "FN", price: 2807.54, chance: 0.01 }
            ]
        },
        {
            name: "★ Karambit | Tiger Tooth",
            color: "#ffb703",
            rarities: [
                { short: "FN", price: 1450.14, chance: 0.019 }
            ]
        },
        {
            name: "★ Flip Knife | Doppler Sapphire",
            color: "#ffb703",
            rarities: [
                { short: "FN", price: 1410.22, chance: 0.022 }
            ]
        },
        {
            name: "★ Falchion Knife | Doppler Ruby",
            color: "#ffb703",
            rarities: [
                { short: "FN", price: 1104.09, chance: 0.03 }
            ]
        },
        {
            name: "★ Skeleton Knife | Doppler Phase 1",
            color: "#ffb703",
            rarities: [
                { short: "FN", price: 1044.99, chance: 0.029 }
            ]
        },
        {
            name: "★ Skeleton Knife | Fade",
            color: "#ffb703",
            rarities: [
                { short: "FN", price: 874.56, chance: 0.041 }
            ]
        },
        {
            name: "★ Flip Knife | Gamma Doppler Phase 4",
            color: "#ffb703",
            rarities: [
                { short: "FN", price: 604.62, chance: 0.235 }
            ]
        },
        {
            name: "★ Nomad Knife | Marble Fade",
            color: "#ffb703",
            rarities: [
                { short: "FN", price: 378.53, chance: 0.304 }
            ]
        },
        {
            name: "★ Bowie Knife | Gamma Doppler Phase 3",
            color: "#ffb703",
            rarities: [
                { short: "FN", price: 316.57, chance: 0.286 }
            ]
        },
        {
            name: "★ Survival Knife | Fade",
            color: "#ffb703",
            rarities: [
                { short: "FN", price: 231.71, chance: 0.378 }
            ]
        },
        {
            name: "★ Navaja Knife | Marble Fade",
            color: "#ffb703",
            rarities: [
                { short: "FN", price: 159.21, chance: 3.442 }
            ]
        },
        {
            name: "★ Huntsman Knife | Bright Water",
            color: "#ffb703",
            rarities: [
                { short: "FN", price: 131.61, chance: 0.506 },
                { short: "MW", price: 111.04, chance: 1.484 },
                { short: "FT", price: 97.21, chance: 1.936 }
            ]
        },
        {
            name: "★ Survival Knife | Damascus Steel",
            color: "#ffb703",
            rarities: [
                { short: "FT", price: 101.20, chance: 2.951 }
            ]
        },
        {
            name: "★ Falchion Knife | Rust Coat",
            color: "#ffb703",
            rarities: [
                { short: "BS", price: 96.78, chance: 2.938 }
            ]
        },
        {
            name: "★ Shadow Daggers | Bright Water",
            color: "#ffb703",
            rarities: [
                { short: "FT", price: 68.46, chance: 3.983 }
            ]
        },
        {
            name: "Desert Eagle | Printstream",
            color: "#eb4b4b",
            rarities: [
                { short: "MW", price: 67.76, chance: 0.437 },
                { short: "FT", price: 55.63, chance: 3.095 },
                { short: "WW", price: 55.45, chance: 1.497 }
            ]
        },
        {
            name: "M4A4 | Temukau",
            color: "#eb4b4b",
            rarities: [
                { short: "FT", price: 56.20, chance: 1.819 },
                { short: "WW", price: 50.27, chance: 0.984 },
                { short: "BS", price: 43.32, chance: 7.069 }
            ]
        },
        {
            name: "Glock-18 | Mirror Mosaic",
            color: "#d32ce6",
            rarities: [
                { short: "FN", price: 53.90, chance: 0.494 },
                { short: "MW", price: 19.27, chance: 1.533 },
                { short: "FT", price: 11.18, chance: 2.010 },
                { short: "WW", price: 9.86, chance: 2.885 },
                { short: "BS", price: 7.46, chance: 2.769 }
            ]
        },
        {
            name: "AWP | Hyper Beast",
            color: "#eb4b4b",
            rarities: [
                { short: "FT", price: 53.37, chance: 5.115 }
            ]
        },
        {
            name: "UMP-45 | K.O. Factory",
            color: "#d32ce6",
            rarities: [
                { short: "FN", price: 51.18, chance: 0.243 },
                { short: "MW", price: 12.34, chance: 1.688 },
                { short: "FT", price: 7.87, chance: 2.529 },
                { short: "WW", price: 6.93, chance: 5.954 },
                { short: "BS", price: 6.22, chance: 2.320 }
            ]
        },
        {
            name: "AK-47 | Redline",
            color: "#d32ce6",
            rarities: [
                { short: "FT", price: 48.92, chance: 3.282 },
                { short: "WW", price: 42.31, chance: 2.004 },
                { short: "BS", price: 41.34, chance: 3.774 }
            ]
        },
        {
            name: "AK-47 | The Outsiders",
            color: "#d32ce6",
            rarities: [
                { short: "MW", price: 30.05, chance: 0.478 },
                { short: "WW", price: 13.26, chance: 2.911 },
                { short: "FT", price: 12.51, chance: 3.244 },
                { short: "BS", price: 12.44, chance: 3.119 }
            ]
        },
        {
            name: "M4A4 | Spider Lily",
            color: "#8847ff",
            rarities: [
                { short: "MW", price: 29.20, chance: 0.507 },
                { short: "FT", price: 12.26, chance: 1.404 },
                { short: "WW", price: 8.53, chance: 4.174 },
                { short: "BS", price: 8.28, chance: 3.713 }
            ]
        },
        {
            name: "AWP | Ice Coaled",
            color: "#d32ce6",
            rarities: [
                { short: "MW", price: 22.46, chance: 0.491 },
                { short: "FT", price: 12.30, chance: 3.703 },
                { short: "WW", price: 10.26, chance: 2.991 },
                { short: "BS", price: 7.61, chance: 3.159 }
            ]
        }
    ]
},
utopia: {
    name: "UTOPIA",
    price: 250.00,
    img: "https://key-drop.com/uploads/skins/6_UTOPIA.png",
    tag: "NEW",
    items: [
        {
            name: "★ M9 Bayonet | Doppler Ruby",
            color: "#ffb703",
            rarities: [
                { short: "FN", price: 13286.44, chance: 0.01 }
            ]
        },
        {
            name: "AWP | Gungnir",
            color: "#eb4b4b",
            rarities: [
                { short: "FT", price: 11903.48, chance: 0.03 }
            ]
        },
        {
            name: "AWP | Dragon Lore",
            color: "#eb4b4b",
            rarities: [
                { short: "FT", price: 9712.90, chance: 0.038 }
            ]
        },
        {
            name: "★ Butterfly Knife | Gamma Doppler Phase 3",
            color: "#ffb703",
            rarities: [
                { short: "FN", price: 3176.86, chance: 0.142 }
            ]
        },
        {
            name: "★ Bayonet | Doppler Ruby",
            color: "#ffb703",
            rarities: [
                { short: "FN", price: 3109.59, chance: 0.143 }
            ]
        },
        {
            name: "★ Skeleton Knife | Doppler Sapphire",
            color: "#ffb703",
            rarities: [
                { short: "FN", price: 2558.80, chance: 0.203 }
            ]
        },
        {
            name: "★ Ursus Knife | Doppler Ruby",
            color: "#ffb703",
            rarities: [
                { short: "FN", price: 1255.77, chance: 0.257 }
            ]
        },
        {
            name: "★ Bowie Knife | Gamma Doppler Emerald",
            color: "#ffb703",
            rarities: [
                { short: "FN", price: 848.27, chance: 0.784 }
            ]
        },
        {
            name: "★ Skeleton Knife | Slaughter",
            color: "#ffb703",
            rarities: [
                { short: "FN", price: 677.46, chance: 0.812 },
                { short: "FT", price: 588.98, chance: 4.848 }
            ]
        },
        {
            name: "★ Bayonet | Doppler Phase 3",
            color: "#ffb703",
            rarities: [
                { short: "FN", price: 624.40, chance: 0.922 }
            ]
        },
        {
            name: "★ M9 Bayonet | Lore",
            color: "#ffb703",
            rarities: [
                { short: "BS", price: 611.94, chance: 0.996 }
            ]
        },
        {
            name: "★ Shadow Daggers | Doppler Ruby",
            color: "#ffb703",
            rarities: [
                { short: "FN", price: 523.22, chance: 4.643 }
            ]
        },
        {
            name: "★ Survival Knife | Doppler Phase 4",
            color: "#ffb703",
            rarities: [
                { short: "FN", price: 316.25, chance: 8.894 }
            ]
        },
        {
            name: "★ Ursus Knife | Marble Fade",
            color: "#ffb703",
            rarities: [
                { short: "FN", price: 259.05, chance: 8.258 }
            ]
        },
        {
            name: "★ Paracord Knife | Fade",
            color: "#ffb703",
            rarities: [
                { short: "FN", price: 256.85, chance: 7.189 }
            ]
        },
        {
            name: "★ Driver Gloves | King Snake",
            color: "#ffb703",
            rarities: [
                { short: "FT", price: 243.80, chance: 9.095 }
            ]
        },
        {
            name: "★ Falchion Knife | Bright Water",
            color: "#ffb703",
            rarities: [
                { short: "FN", price: 143.42, chance: 0.627 },
                { short: "FT", price: 116.61, chance: 2.925 }
            ]
        },
        {
            name: "AWP | Printstream",
            color: "#eb4b4b",
            rarities: [
                { short: "MW", price: 142.47, chance: 0.122 },
                { short: "FT", price: 79.33, chance: 0.540 },
                { short: "WW", price: 68.26, chance: 2.855 },
                { short: "BS", price: 66.26, chance: 3.003 }
            ]
        },
        {
            name: "★ Gut Knife | Lore",
            color: "#ffb703",
            rarities: [
                { short: "FT", price: 137.98, chance: 3.466 }
            ]
        },
        {
            name: "AK-47 | Neon Rider",
            color: "#eb4b4b",
            rarities: [
                { short: "MW", price: 120.24, chance: 0.610 },
                { short: "WW", price: 85.81, chance: 0.563 },
                { short: "FT", price: 70.23, chance: 2.907 },
                { short: "BS", price: 68.29, chance: 2.754 }
            ]
        },
        {
            name: "M4A4 | Neo-Noir",
            color: "#eb4b4b",
            rarities: [
                { short: "MW", price: 92.02, chance: 0.595 },
                { short: "FT", price: 58.25, chance: 5.746 }
            ]
        },
        {
            name: "AWP | Neo-Noir",
            color: "#eb4b4b",
            rarities: [
                { short: "FN", price: 90.26, chance: 0.618 },
                { short: "MW", price: 67.91, chance: 2.827 },
                { short: "BS", price: 64.29, chance: 2.823 },
                { short: "FT", price: 63.92, chance: 2.615 }
            ]
        },
        {
            name: "AWP | Fever Dream",
            color: "#d32ce6",
            rarities: [
                { short: "FN", price: 43.86, chance: 0.953 },
                { short: "MW", price: 22.86, chance: 1.896 },
                { short: "FT", price: 20.53, chance: 1.896 },
                { short: "WW", price: 20.08, chance: 1.832 },
                { short: "BS", price: 20.08, chance: 1.752 }
            ]
        },
        {
            name: "AK-47 | Nouveau Rouge",
            color: "#d32ce6",
            rarities: [
                { short: "BS", price: 16.73, chance: 3.895 },
                { short: "WW", price: 16.34, chance: 4.916 }
            ]
        }
    ]
}
};
const rewardCases = {
    rank1_reward: {
        name: "CHAMPION BOX",
        price: 0, // Grátis para o vencedor
        img: "https://key-drop.com/uploads/skins/high_premium_1.png", // Imagem da caixa Emerald
        tag: "REWARD",
        items: [
            {
                name: "★ Butterfly Knife | Gamma Doppler Emerald",
                color: "#ffb703",
                rarities: [{ short: "FN", price: 14495.72, chance: 0.352 }]
            },
            {
                name: "AWP | Medusa",
                color: "#eb4b4b",
                rarities: [{ short: "MW", price: 4341.87, chance: 0.175 }]
            },
            {
                name: "M4A1-S | Welcome to the Jungle",
                color: "#eb4b4b",
                rarities: [{ short: "FN", price: 4127.71, chance: 0.186 }]
            },
            {
                name: "★ Butterfly Knife | Fade",
                color: "#ffb703",
                rarities: [{ short: "FN", price: 3761.11, chance: 0.199 }]
            },
            {
                name: "★ Karambit | Fade",
                color: "#ffb703",
                rarities: [{ short: "FN", price: 3146.53, chance: 0.805 }]
            },
            {
                name: "★ Specialist Gloves | Fade",
                color: "#ffb703",
                rarities: [{ short: "FN", price: 3126.55, chance: 0.872 }]
            },
            {
                name: "★ Bayonet | Doppler Ruby",
                color: "#ffb703",
                rarities: [{ short: "FN", price: 3124.81, chance: 0.762 }]
            },
            {
                name: "★ Specialist Gloves | Crimson Kimono",
                color: "#ffb703",
                rarities: [{ short: "WW", price: 2988.49, chance: 0.873 }]
            },
            {
                name: "AK-47 | Gold Arabesque",
                color: "#eb4b4b",
                rarities: [{ short: "WW", price: 2570.04, chance: 0.82 }]
            },
            {
                name: "★ Butterfly Knife | Slaughter",
                color: "#ffb703",
                rarities: [{ short: "MW", price: 2033.19, chance: 5.752 }]
            },
            {
                name: "★ Butterfly Knife | Tiger Tooth",
                color: "#ffb703",
                rarities: [{ short: "FN", price: 1769.78, chance: 6.105 }]
            },
            {
                name: "AWP | Fade",
                color: "#eb4b4b",
                rarities: [{ short: "FN", price: 1575.89, chance: 1.031 }]
            },
            {
                name: "Desert Eagle | Blaze",
                color: "#d32ce6",
                rarities: [{ short: "FN", price: 1144.07, chance: 5.688 }]
            },
            {
                name: "★ Falchion Knife | Doppler Ruby",
                color: "#ffb703",
                rarities: [{ short: "FN", price: 1046.81, chance: 5.31 }]
            },
            {
                name: "AK-47 | Fuel Injector",
                color: "#eb4b4b",
                rarities: [{ short: "FN", price: 991.48, chance: 5.233 }]
            },
            {
                name: "★ Sport Gloves | Omega",
                color: "#ffb703",
                rarities: [{ short: "MW", price: 961.53, chance: 5.63 }]
            },
            {
                name: "AWP | Lightning Strike",
                color: "#eb4b4b",
                rarities: [{ short: "FN", price: 880.60, chance: 6.281 }]
            },
            {
                name: "★ Falchion Knife | Gamma Doppler Emerald",
                color: "#ffb703",
                rarities: [{ short: "FN", price: 869.43, chance: 5.472 }]
            },
            {
                name: "AK-47 | X-Ray",
                color: "#eb4b4b",
                rarities: [{ short: "WW", price: 784.92, chance: 5.656 }]
            },
            {
                name: "★ Skeleton Knife | Case Hardened",
                color: "#ffb703",
                rarities: [{ short: "MW", price: 501.58, chance: 0.975 }]
            },
            {
                name: "★ Bayonet | Lore",
                color: "#ffb703",
                rarities: [{ short: "MW", price: 498.87, chance: 1.004 }]
            },
            {
                name: "★ Shadow Daggers | Doppler Sapphire",
                color: "#ffb703",
                rarities: [{ short: "FN", price: 370.42, chance: 0.976 }]
            },
            {
                name: "★ Bowie Knife | Gamma Doppler Phase 3",
                color: "#ffb703",
                rarities: [{ short: "FN", price: 321.46, chance: 1.019 }]
            },
            {
                name: "M4A1-S | Printstream",
                color: "#eb4b4b",
                rarities: [{ short: "FT", price: 307.73, chance: 1.133 }]
            },
            {
                name: "★ Moto Gloves | Polygon",
                color: "#ffb703",
                rarities: [{ short: "FT", price: 193.10, chance: 7.555 }]
            },
            {
                name: "★ Paracord Knife | Case Hardened",
                color: "#ffb703",
                rarities: [{ short: "MW", price: 192.31, chance: 6.385 }]
            },
            {
                name: "M4A1-S | Vaporwave",
                color: "#eb4b4b",
                rarities: [
                    { short: "MW", price: 169.82, chance: 7.46 },
                    { short: "FT", price: 83.84, chance: 5.689 },
                    { short: "WW", price: 82.78, chance: 3.305 }
                ]
            },
            {
                name: "★ Huntsman Knife | Autotronic",
                color: "#ffb703",
                rarities: [{ short: "FT", price: 145.39, chance: 7.297 }]
            }
        ]
    },
    rank2_reward: {
        name: "CHALLENGER BOX",
        price: 0,
        img: "https://key-drop.com/uploads/skins/1_5.png", // Imagem da caixa Bloodshot
        tag: "REWARD",
        items: [
            {
                name: "AWP | Dragon Lore",
                color: "#eb4b4b",
                rarities: [{ short: "FT", price: 9843.56, chance: 0.072 }]
            },
            {
                name: "M4A4 | Howl",
                color: "#ffb703",
                rarities: [{ short: "FT", price: 6652.74, chance: 0.111 }]
            },
            {
                name: "AK-47 | Wild Lotus",
                color: "#eb4b4b",
                rarities: [{ short: "BS", price: 6341.58, chance: 0.157 }]
            },
            {
                name: "AWP | The Prince",
                color: "#eb4b4b",
                rarities: [{ short: "MW", price: 3857.09, chance: 0.157 }]
            },
            {
                name: "★ Specialist Gloves | Crimson Kimono",
                color: "#ffb703",
                rarities: [{ short: "FT", price: 3278.02, chance: 0.231 }]
            },
            {
                name: "★ Butterfly Knife | Tiger Tooth",
                color: "#ffb703",
                rarities: [{ short: "FN", price: 1769.78, chance: 0.163 }]
            },
            {
                name: "★ Karambit | Tiger Tooth",
                color: "#ffb703",
                rarities: [{ short: "FN", price: 1435.84, chance: 0.365 }]
            },
            {
                name: "★ M9 Bayonet | Marble Fade",
                color: "#ffb703",
                rarities: [{ short: "FN", price: 1300.02, chance: 0.222 }]
            },
            {
                name: "★ Karambit | Blue Steel",
                color: "#ffb703",
                rarities: [{ short: "FT", price: 1218.39, chance: 0.218 }]
            },
            {
                name: "AK-47 | Asiimov",
                color: "#eb4b4b",
                rarities: [
                    { short: "FN", price: 1031.45, chance: 0.604 },
                    { short: "MW", price: 83.57, chance: 6.998 },
                    { short: "WW", price: 62.43, chance: 6.367 },
                    { short: "BS", price: 60.93, chance: 7.755 },
                    { short: "FT", price: 53.71, chance: 3.263 }
                ]
            },
            {
                name: "★ Talon Knife | Slaughter",
                color: "#ffb703",
                rarities: [
                    { short: "MW", price: 873.28, chance: 0.589 },
                    { short: "FT", price: 751.49, chance: 0.64 }
                ]
            },
            {
                name: "★ Bowie Knife | Gamma Doppler Emerald",
                color: "#ffb703",
                rarities: [{ short: "FN", price: 837.00, chance: 0.604 }]
            },
            {
                name: "★ Bayonet | Gamma Doppler Phase 3",
                color: "#ffb703",
                rarities: [{ short: "FN", price: 814.76, chance: 0.603 }]
            },
            {
                name: "★ M9 Bayonet | Lore",
                color: "#ffb703",
                rarities: [
                    { short: "WW", price: 717.59, chance: 4.51 },
                    { short: "BS", price: 609.95, chance: 4.313 }
                ]
            },
            {
                name: "★ Nomad Knife | Fade",
                color: "#ffb703",
                rarities: [{ short: "FN", price: 492.65, chance: 0.307 }]
            },
            {
                name: "M4A1-S | Vaporwave",
                color: "#eb4b4b",
                rarities: [
                    { short: "FN", price: 439.43, chance: 0.341 },
                    { short: "MW", price: 169.82, chance: 0.96 },
                    { short: "FT", price: 83.84, chance: 1.102 },
                    { short: "WW", price: 82.78, chance: 6.716 },
                    { short: "BS", price: 72.16, chance: 6.781 }
                ]
            },
            {
                name: "★ Classic Knife | Fade",
                color: "#ffb703",
                rarities: [{ short: "FN", price: 423.50, chance: 0.326 }]
            },
            {
                name: "AWP | Containment Breach",
                color: "#eb4b4b",
                rarities: [
                    { short: "MW", price: 353.45, chance: 5.143 },
                    { short: "FT", price: 177.96, chance: 0.991 },
                    { short: "WW", price: 86.65, chance: 1.014 },
                    { short: "BS", price: 75.08, chance: 6.966 }
                ]
            },
            {
                name: "★ Ursus Knife | Fade",
                color: "#ffb703",
                rarities: [{ short: "FN", price: 332.73, chance: 4.985 }]
            },
            {
                name: "★ Specialist Gloves | Fade",
                color: "#ffb703",
                rarities: [
                    { short: "WW", price: 305.06, chance: 5.617 },
                    { short: "BS", price: 207.49, chance: 6.907 }
                ]
            },
            {
                name: "★ Shadow Daggers | Doppler Phase 2",
                color: "#ffb703",
                rarities: [{ short: "FN", price: 288.52, chance: 5.921 }]
            },
            {
                name: "★ Gut Knife | Gamma Doppler Phase 2",
                color: "#ffb703",
                rarities: [{ short: "FN", price: 275.02, chance: 6.06 }]
            },
            {
                name: "★ Gut Knife | Tiger Tooth",
                color: "#ffb703",
                rarities: [{ short: "FN", price: 159.25, chance: 0.961 }]
            },
            {
                name: "★ Navaja Knife | Marble Fade",
                color: "#ffb703",
                rarities: [{ short: "FN", price: 147.14, chance: 0.96 }]
            }
        ]
    },
    rank3_reward: {
        name: "CONTENDER BOX",
        price: 0,
        img: "https://key-drop.com/uploads/skins/1_4.png", // Imagem da caixa VEST
        tag: "REWARD",
        items: [
            {
                name: "AWP | Medusa",
                color: "#eb4b4b",
                rarities: [{ short: "FN", price: 7520.88, chance: 0.062 }]
            },
            {
                name: "★ Butterfly Knife | Gamma Doppler Phase 2",
                color: "#ffb703",
                rarities: [{ short: "FN", price: 4126.06, chance: 0.053 }]
            },
            {
                name: "★ Butterfly Knife | Tiger Tooth",
                color: "#ffb703",
                rarities: [{ short: "FN", price: 1769.78, chance: 0.044 }]
            },
            {
                name: "★ Karambit | Autotronic",
                color: "#ffb703",
                rarities: [{ short: "FT", price: 1431.43, chance: 0.061 }]
            },
            {
                name: "M4A1-S | Blue Phosphor",
                color: "#d32ce6",
                rarities: [{ short: "FN", price: 1243.06, chance: 0.103 }]
            },
            {
                name: "AK-47 | Vulcan",
                color: "#eb4b4b",
                rarities: [
                    { short: "FN", price: 1100.87, chance: 0.029 },
                    { short: "MW", price: 627.89, chance: 0.47 },
                    { short: "FT", price: 294.30, chance: 1.563 },
                    { short: "WW", price: 208.45, chance: 2.5 },
                    { short: "BS", price: 180.26, chance: 2.647 }
                ]
            },
            {
                name: "★ Karambit | Lore",
                color: "#ffb703",
                rarities: [{ short: "FT", price: 904.26, chance: 0.07 }]
            },
            {
                name: "★ Talon Knife | Marble Fade",
                color: "#ffb703",
                rarities: [{ short: "FN", price: 901.45, chance: 0.096 }]
            },
            {
                name: "AWP | Lightning Strike",
                color: "#eb4b4b",
                rarities: [{ short: "FN", price: 880.60, chance: 0.161 }]
            },
            {
                name: "AUG | Akihabara Accept",
                color: "#eb4b4b",
                rarities: [
                    { short: "FT", price: 837.88, chance: 0.138 },
                    { short: "WW", price: 509.85, chance: 0.728 },
                    { short: "BS", price: 387.40, chance: 1.656 }
                ]
            },
            {
                name: "★ Bayonet | Autotronic",
                color: "#ffb703",
                rarities: [{ short: "FN", price: 782.83, chance: 0.095 }]
            },
            {
                name: "★ Flip Knife | Gamma Doppler Phase 3",
                color: "#ffb703",
                rarities: [{ short: "FN", price: 614.68, chance: 0.669 }]
            },
            {
                name: "★ Nomad Knife | Fade",
                color: "#ffb703",
                rarities: [{ short: "FN", price: 492.65, chance: 0.683 }]
            },
            {
                name: "★ Flip Knife | Doppler Phase 1",
                color: "#ffb703",
                rarities: [{ short: "FN", price: 481.28, chance: 0.681 }]
            },
            {
                name: "AK-47 | Case Hardened",
                color: "#d32ce6",
                rarities: [
                    { short: "MW", price: 403.70, chance: 1.646 },
                    { short: "WW", price: 246.23, chance: 0.355 }
                ]
            },
            {
                name: "★ Sport Gloves | Amphibious",
                color: "#ffb703",
                rarities: [{ short: "BS", price: 403.34, chance: 0.618 }]
            },
            {
                name: "AWP | Containment Breach",
                color: "#eb4b4b",
                rarities: [
                    { short: "MW", price: 353.45, chance: 1.77 },
                    { short: "FT", price: 177.96, chance: 2.878 },
                    { short: "WW", price: 86.65, chance: 0.288 },
                    { short: "BS", price: 75.08, chance: 0.292 }
                ]
            },
            {
                name: "★ Flip Knife | Autotronic",
                color: "#ffb703",
                rarities: [
                    { short: "MW", price: 311.96, chance: 1.68 },
                    { short: "FT", price: 256.51, chance: 0.281 }
                ]
            },
            {
                name: "★ Specialist Gloves | Fade",
                color: "#ffb703",
                rarities: [{ short: "WW", price: 305.06, chance: 1.442 }]
            },
            {
                name: "★ Falchion Knife | Marble Fade",
                color: "#ffb703",
                rarities: [{ short: "FN", price: 287.49, chance: 0.317 }]
            },
            {
                name: "USP-S | Printstream",
                color: "#eb4b4b",
                rarities: [
                    { short: "FN", price: 208.04, chance: 2.986 },
                    { short: "MW", price: 94.41, chance: 0.355 },
                    { short: "FT", price: 56.18, chance: 0.329 },
                    { short: "WW", price: 53.83, chance: 0.272 },
                    { short: "BS", price: 51.19, chance: 42.795 }
                ]
            },
            {
                name: "★ Paracord Knife | Case Hardened",
                color: "#ffb703",
                rarities: [
                    { short: "MW", price: 192.31, chance: 2.365 },
                    { short: "FT", price: 159.75, chance: 2.427 },
                    { short: "BS", price: 147.02, chance: 2.401 },
                    { short: "WW", price: 146.25, chance: 2.726 }
                ]
            },
            {
                name: "USP-S | Kill Confirmed",
                color: "#eb4b4b",
                rarities: [
                    { short: "MW", price: 183.09, chance: 2.536 },
                    { short: "FT", price: 98.46, chance: 0.261 },
                    { short: "WW", price: 89.94, chance: 0.296 },
                    { short: "BS", price: 83.24, chance: 0.309 }
                ]
            },
            {
                name: "★ Gut Knife | Autotronic",
                color: "#ffb703",
                rarities: [
                    { short: "MW", price: 182.45, chance: 2.348 },
                    { short: "FT", price: 154.58, chance: 2.342 },
                    { short: "BS", price: 148.32, chance: 2.605 }
                ]
            },
            {
                name: "★ Shadow Daggers | Lore",
                color: "#ffb703",
                rarities: [
                    { short: "FN", price: 169.22, chance: 2.731 },
                    { short: "MW", price: 118.85, chance: 0.245 },
                    { short: "FT", price: 92.32, chance: 0.327 },
                    { short: "WW", price: 91.25, chance: 0.3 },
                    { short: "BS", price: 87.77, chance: 0.269 }
                ]
            },
            {
                name: "M4A1-S | Golden Coil",
                color: "#eb4b4b",
                rarities: [
                    { short: "MW", price: 159.41, chance: 2.705 },
                    { short: "FT", price: 97.36, chance: 0.288 },
                    { short: "WW", price: 82.94, chance: 0.244 },
                    { short: "BS", price: 73.59, chance: 0.313 }
                ]
            },
            {
                name: "AK-47 | Neon Rider",
                color: "#eb4b4b",
                rarities: [
                    { short: "MW", price: 109.85, chance: 0.296 },
                    { short: "WW", price: 75.21, chance: 0.288 },
                    { short: "FT", price: 68.61, chance: 0.277 },
                    { short: "BS", price: 62.15, chance: 0.288 }
                ]
            }
        ]
    }
    // Adicione isto dentro do seu objeto caseData no server.js
};

const axios = require('axios'); // Você pode precisar instalar: npm install axios
Object.assign(caseData, rewardCases);
let skinDatabase = []; // Agora é um Array


const getConditionForItem = (rolledItem) => {
    // We already picked the rarity during rollItem, so we just return its metadata
    return {
        short: rolledItem.pickedRarity.short,
        name: rolledItem.pickedRarity.short // You can expand this to full names if needed
    };
};

loadSkinDatabase();

// Chame a função no final do arquivo ou antes do server.listen



const rollItem = (caseItems) => {
    // We calculate the total chance of all items and all their rarities
    let totalChance = 0;
    caseItems.forEach(item => {
        item.rarities.forEach(r => {
            totalChance += r.chance;
        });
    });

    let rand = Math.random() * totalChance;
    let cum = 0;

    for (let item of caseItems) {
        for (let rarity of item.rarities) {
            cum += rarity.chance;
            if (rand < cum) {
                // We return a combined object of the item and the specific rarity picked
                return {
                    ...item,
                    pickedRarity: rarity
                };
            }
        }
    }
    return caseItems[0]; // Fallback
};

const calculateValue = (rolledItem) => {
    // Now we just take the literal price from the picked rarity
    return parseFloat(rolledItem.pickedRarity.price.toFixed(2));
};
const isItemSuperSpin = (itemValue, casePrice) => {
    // If the case is free (price 0), it is NEVER a super spin
    if (casePrice <= 0) return false; 
    return itemValue >= (casePrice * 2.5);
};
const generateTrack = (winner, items, casePrice) => {
    let track = [];
    for(let i=0; i<60; i++) {
        if (i === 50) {
            track.push({ ...winner, isSuperSpin: isItemSuperSpin(winner.value, casePrice) });
        } else {
            // Pick a random item
            const baseItem = items[Math.floor(Math.random() * items.length)];
            // Pick a random rarity from that item
            const randomRarity = baseItem.rarities[Math.floor(Math.random() * baseItem.rarities.length)];
            
            const finalPrice = randomRarity.price;
            let visualSuper = isItemSuperSpin(finalPrice, casePrice);
            if (visualSuper && Math.random() > 0.25) visualSuper = false;

            track.push({
                ...baseItem,
                conditionShort: randomRarity.short,
                value: finalPrice,
                isSuperSpin: visualSuper
            });
        }
    }
    return track;
};

let activeBattles = [];
app.get('/api/all-skins', (req, res) => {
    let allSkins = [];

    // Percorre todas as caixas
    for (let key in caseData) {
        caseData[key].items.forEach(item => {
            // Verifica se o item tem o novo array de raridades
            if (item.rarities && Array.isArray(item.rarities)) {
                item.rarities.forEach(r => {
                    allSkins.push({ 
                        name: item.name,
                        img: item.img,
                        color: item.color,
                        weaponId: item.weaponId,
                        paintKit: item.paintKit,
                        price: parseFloat(r.price.toFixed(2)), // Preço real da raridade
                        displayCond: r.short // Condição real (ex: FN, FT)
                    });
                });
            }
        });
    }

    // Remover duplicados (skins que aparecem em várias caixas com o mesmo preço/condição)
    const unique = allSkins.filter((v, i, a) => 
        a.findIndex(t => t.name === v.name && t.displayCond === v.displayCond) === i
    ).sort((a, b) => a.price - b.price);

    res.json(unique);
});
// --- START OF FAKE ACTIVITY ENGINE ---
const BOT_NAMES = [
    "S1mple_Fanboy", "DragonLord99", "Matrix_CS", "Kinguin_King", "GlobalElite_PT", 
    "Toxic_Player", "Knife_Hunter", "CS2_Rich_Kid", "PashaBiceps_Fan", "Gaules_Subscriber",
    "FalleN_The_God", "Coldzera_Legacy", "KennyS_Magic", "ZywOo_Clone", "NikO_Corner",
    "Donk_Entry", "M0nesy_Aim", "Dev1ce_Sniper", "S1ren_7", "Ropz_Lurker",
    "Xyp9x_Clutch", "Gla1ve_IGL", "Zonic_Coach", "GTR_Legend", "F0rest_King",
    "Olof_Boost", "JW_Pig", "Flusha_Mouse", "Krimz_Bald", "Guardian_AWP",
    "Rain_Entry", "Twistzz_Hair", "Karrigan_Brain", "Broky_Aim", "Elige_LUL",
    "Stewie2k_Smoke", "Tarik_Content", "Shroud_God", "Lurppis_Analyst", "Thorin_Bantz"
];

const CHAT_PHRASES = [
    "OMG!", "VAMOOOS!", "ROULETTE IS RIGGED LOL", "W", "L", "EZ PROFIT", "CLIP IT!!", 
    "Anyone battle?", "Just lost 100$, rip", "Ruby survival knife looks so clean",
    "Check my profile", "How do I upgrade?", "5% works!", "TOBYDROP BEST SITE", 
    "Scammed by the bot again", "POG", "POGGERS", "Vem pro pai", "Que sorte!", 
    "AHAHAAH", "No way...", "I'm rich now", "Bye bye balance", "Road to Dragon Lore",
    "Mãe, sou famoso", "Tuga power!", "Sorte de principiante", "GG", "GGWP", "F",
    "Donk is better than s1mple", "CS2 > CSGO", "Fix the game valve", "Drop me something!",
    "Sapphire? No way!", "Look at that drop", "This chat is crazy", "Hahaha", "LUL", "KEKW"
];

function generateBotProfile(input) {
    // If input is a string "bot-5", extract the 5. If it's already a number, use it.
    let index;
    if (typeof input === 'string' && input.startsWith('bot-')) {
        index = parseInt(input.split('-')[1]);
    } else {
        index = parseInt(input);
    }

    // Safety check: if parsing failed, default to 0
    if (isNaN(index)) index = 0;

    const nameIndex = index % BOT_NAMES.length;
    const name = BOT_NAMES[nameIndex];
    const botId = `bot-${nameIndex}`; 
    const avatar = `https://api.dicebear.com/9.x/avataaars/svg?seed=${name}`;
    
    let seed = nameIndex; 

    // Deterministic Stats
    const wealthFactor = Math.floor(seededRandom(seed++) * 10); 
    const inventorySize = 12 + (nameIndex % 10);
    const balance = (wealthFactor * 450) + (nameIndex * 15);

    const botInventory = [];
    if (globalSkinPool.length > 0) {
        for (let i = 0; i < inventorySize; i++) {
            const itemSeed = nameIndex + i; // Use nameIndex so items stay same for "S1mple_Fanboy"
            let item;
            
            if (wealthFactor > 7 && seededRandom(itemSeed) > 0.6) {
                const highTier = globalSkinPool.filter(s => s.color === '#ffb703' || s.color === '#eb4b4b');
                item = highTier[Math.floor(seededRandom(itemSeed) * highTier.length)];
            } 
            
            if (!item) {
                item = globalSkinPool[Math.floor(seededRandom(itemSeed) * globalSkinPool.length)];
            }

            if (item) {
                botInventory.push({
                    ...item,
                    id: `item-${botId}-${i}`,
                    wear: parseFloat((0.001 + seededRandom(itemSeed + 1) * 0.7).toFixed(8)),
                    seed: Math.floor(seededRandom(itemSeed + 2) * 1000)
                });
            }
        }
    }

    return {
        username: name,
        avatar: avatar,
        steamId: botId,
        balance: parseFloat(balance.toFixed(2)),
        inventory: botInventory
    };
}

setInterval(() => {
    const botIndex = Math.floor(Math.random() * BOT_NAMES.length);
    const botProfile = generateBotProfile(botIndex);

    io.emit('chatMessage', {
        user: botProfile.username,
        avatar: botProfile.avatar,
        msg: CHAT_PHRASES[Math.floor(Math.random() * CHAT_PHRASES.length)],
        steamId: botProfile.steamId 
    });
}, 4500);
setInterval(() => {
    if (globalSkinPool.length === 0) return;

    const botIndex = Math.floor(Math.random() * BOT_NAMES.length);
    const botProfile = generateBotProfile(botIndex);
    
    if (botProfile.inventory.length > 0) {
        const skin = botProfile.inventory[Math.floor(Math.random() * botProfile.inventory.length)];

        io.emit('newLiveDrop', {
            user: botProfile.username,
            avatar: botProfile.avatar,
            steamId: botProfile.steamId,
            item: skin
        });
    }
}, 7000);

// --- END OF simulation ENGINE ---
app.post('/api/upgrade', async (req, res) => {
    try {
        const { inputItemIds, targetSkinName, targetPrice, targetCondition } = req.body;
        const user = await User.findById(req.session.userId);
        if (!user) return res.status(401).json({ error: "Não autorizado" });

        // Identify which items the user is sacrificing
        const itemsToSacrifice = user.inventory.filter(i => inputItemIds.includes(i.id));
        
        if (itemsToSacrifice.length === 0) {
            return res.status(400).json({ error: "Nenhum item de sacrifício encontrado" });
        }

        // --- NEW: CLEANUP SACRIFICED ITEMS FROM CS2 LOADOUT (MySQL) ---
        for (let item of itemsToSacrifice) {
            if (item.equippedTeam > 0) {
                const weaponId = parseInt(item.weaponId);
                const isKnife = weaponId >= 500 && weaponId <= 999;
                const isGlove = (weaponId >= 5027 && weaponId <= 5035) || weaponId === 4725;

                try {
                    // Preparamos as equipes para remover (vale para todos: armas, facas e luvas)
                    let teamsToRemove = [];
                    if (item.equippedTeam === 2) teamsToRemove = [2];
                    if (item.equippedTeam === 3) teamsToRemove = [3];
                    if (item.equippedTeam === 4) teamsToRemove = [2, 3];

                    for (let tId of teamsToRemove) {
                        if (isGlove) {
                            await sqlConnection.query("DELETE FROM wp_player_gloves WHERE steamid = ? AND weapon_team = ?", [user.steamId, tId]);
                            await sqlConnection.query("DELETE FROM wp_player_skins WHERE steamid = ? AND weapon_defindex = ? AND weapon_team = ?", [user.steamId, weaponId, tId]);
                        } else if (isKnife) {
                            await sqlConnection.query("DELETE FROM wp_player_knife WHERE steamid = ? AND weapon_team = ?", [user.steamId, tId]);
                            await sqlConnection.query("DELETE FROM wp_player_skins WHERE steamid = ? AND weapon_defindex = ? AND weapon_team = ?", [user.steamId, weaponId, tId]);
                        } else {
                            // Armas normais (AK, M4, etc)
                            await sqlConnection.query("DELETE FROM wp_player_skins WHERE steamid = ? AND weapon_defindex = ? AND weapon_team = ?", [user.steamId, weaponId, tId]);
                        }
                    }
                } catch (sqlErr) {
                    console.error("Erro ao remover item equipado do MySQL durante upgrade:", sqlErr);
                }
            }
        }

        const totalInputValue = itemsToSacrifice.reduce((sum, item) => sum + item.value, 0);
        const chance = (totalInputValue / targetPrice) * 0.95;
        const roll = Math.random();
        const win = roll < chance;

        // Remove the sacrificed items from the MongoDB inventory
        user.inventory = user.inventory.filter(i => !inputItemIds.includes(i.id));

        if (win) {
            let template = null;
            for (let k in caseData) {
                let found = caseData[k].items.find(i => i.name === targetSkinName);
                if (found) { template = found; break; }
            }
            
            const wonItem = {
                name: targetSkinName,
                value: targetPrice,
                img: template ? template.img : "",
                color: template ? template.color : "#fff",
                conditionShort: targetCondition || "FN",
                weaponId: template ? Number(template.weaponId) : 0, 
                paintKit: template ? Number(template.paintKit) : 0,
                wear: generateRandomWear(targetCondition || "FN"),
                seed: generateRandomSeed(),
                equippedTeam: 0, // New items are NEVER equipped by default
                id: Math.random().toString(36).substr(2, 9)
            };
            user.inventory.push(wonItem);
        }

        user.markModified('inventory'); // Tell Mongoose the array changed
        await user.save();

        res.json({ 
            success: true, 
            win, 
            roll: roll * 100, 
            chance: (chance * 100).toFixed(2), 
            balance: user.balance 
        });
    } catch (e) {
        console.error("Upgrade Error:", e);
        res.status(500).json({ error: "Erro no upgrade" });
    }
});
app.post('/api/sell-all-items', async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);
        if (!user) return res.status(401).json({ error: "Não autorizado" });

        // 1. Separar o inventário
        const itemsToSell = user.inventory.filter(item => !item.isLocked);
        const itemsToKeep = user.inventory.filter(item => item.isLocked);

        if (itemsToSell.length === 0) {
            return res.status(400).json({ error: "Não tens itens desbloqueados para vender!" });
        }

        // 2. Loop APENAS nos itens que vão ser vendidos
        for (let item of itemsToSell) {
            // Só precisamos limpar o MySQL se o item que está a ser vendido estiver equipado
            if (item.equippedTeam > 0) {
                const weaponId = parseInt(item.weaponId);
                const isKnife = weaponId >= 500 && weaponId <= 999;
                const isGlove = (weaponId >= 5027 && weaponId <= 5035) || weaponId === 4725;

                try {
                    // Remove do MySQL apenas se a skin vendida estiver no loadout
                    if (isGlove) {
                        await sqlConnection.query("DELETE FROM wp_player_gloves WHERE steamid = ? AND weapon_defindex = ?", [user.steamId, weaponId]);
                    } else if (isKnife) {
                        // Se vender uma faca equipada, remove o modelo da faca
                        await sqlConnection.query("DELETE FROM wp_player_knife WHERE steamid = ?", [user.steamId]);
                    }
                    
                    // Remove a pintura da tabela geral de skins
                    await sqlConnection.query("DELETE FROM wp_player_skins WHERE steamid = ? AND weapon_defindex = ?", [user.steamId, weaponId]);
                } catch (sqlErr) {
                    console.error("Erro ao limpar MySQL para o item:", item.name, sqlErr);
                }
            }
        }

        // 3. Calcular valor total dos itens vendidos
        const totalProfit = itemsToSell.reduce((sum, item) => sum + (Number(item.value) || 0), 0);

        // 4. Atualizar o utilizador no MongoDB
        user.balance = parseFloat((user.balance + totalProfit).toFixed(2));
        user.inventory = itemsToKeep; // Substitui o inventário apenas pelas skins que estavam LOCKED

        user.markModified('inventory');
        await user.save();

        res.json({ 
            success: true, 
            balance: user.balance, 
            message: `Vendeste ${itemsToSell.length} itens por $${totalProfit.toFixed(2)}` 
        });

    } catch (e) {
        console.error("Erro no Sell All:", e);
        res.status(500).json({ error: "Erro interno ao processar venda total" });
    }
});
app.post('/api/toggle-lock', async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);
        const item = user.inventory.find(i => i.id === req.body.itemId);
        if (!item) return res.status(404).json({ error: "Item não encontrado" });

        item.isLocked = !item.isLocked;
        user.markModified('inventory');
        await user.save();
        res.json({ success: true, isLocked: item.isLocked });
    } catch (e) {
        res.status(500).json({ error: "Erro ao trancar item" });
    }
});
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

app.post('/api/logout', (req, res) => req.session.destroy(() => res.json({ success: true })));

app.post('/api/sell-item', async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);
        if (!user) return res.status(401).json({ error: "Não autorizado" });

        const itemIdx = user.inventory.findIndex(i => i.id === req.body.itemId);
        if (itemIdx > -1) {
            const item = user.inventory[itemIdx];

            // --- CORREÇÃO: DELETE ESPECÍFICO POR EQUIPA ---
            if (item.equippedTeam > 0) {
                const tableName = item.weaponId >= 500 ? 'wp_player_knife' : 'wp_player_skins';
                
                // Determina quais equipas remover com base no equipado do item
                let teamsToRemove = [];
                if (item.equippedTeam === 2) teamsToRemove = [2]; // Lado T
                if (item.equippedTeam === 3) teamsToRemove = [3]; // Lado CT
                if (item.equippedTeam === 4) teamsToRemove = [2, 3]; // Ambos

                for (let tId of teamsToRemove) {
                    await sqlConnection.query(
                        `DELETE FROM ${tableName} WHERE steamid = ? AND weapon_defindex = ? AND weapon_team = ?`,
                        [user.steamId, item.weaponId, tId]
                    );
                }
            }

            const itemValue = Number(item.value) || 0;
            user.balance = parseFloat((Number(user.balance) + itemValue).toFixed(2));
            user.inventory.splice(itemIdx, 1);
            
            await user.save();
            res.json({ success: true, balance: user.balance });
        } else {
            res.status(400).json({ error: "Item não encontrado" });
        }
    } catch (e) {
        res.status(500).json({ error: "Erro ao vender item" });
    }
});
// Rota para ver o perfil de outro utilizador
app.get('/api/profile/:steamId', async (req, res) => {
    try {
        const steamId = req.params.steamId;

        if (steamId && steamId.startsWith('bot-')) {
            // The function now handles the "bot-X" string correctly
            return res.json(generateBotProfile(steamId));
        }
        
        const user = await User.findOne({ steamId: steamId }, 'username avatar inventory balance steamId');
        if (!user) return res.status(404).json({ error: "Utilizador não encontrado" });
        
        res.json(user);
    } catch (e) {
        res.status(500).json({ error: "Erro ao carregar perfil" });
    }
});
// ROTA DE TESTE: Distribui os prêmios agora (chame isso para testar)
app.post('/api/admin/force-rewards', async (req, res) => {
    try {
        console.log("🛠️ FORCING REWARD DISTRIBUTION...");
        
        // 1. Pega os top 3 atuais
        const winners = await User.find({ dailyWager: { $gt: 0 } })
            .sort({ dailyWager: -1 })
            .limit(3);

        if (winners.length === 0) return res.json({ msg: "No players with wagers today." });

        // 2. Entrega as caixas correspondentes
        if (winners[0]) {
            await User.findByIdAndUpdate(winners[0]._id, { $push: { rewardCases: 'rank1_reward' } });
        }
        if (winners[1]) {
            await User.findByIdAndUpdate(winners[1]._id, { $push: { rewardCases: 'rank2_reward' } });
        }
        if (winners[2]) {
            await User.findByIdAndUpdate(winners[2]._id, { $push: { rewardCases: 'rank3_reward' } });
        }

        res.json({ 
            success: true, 
            msg: "Rewards sent to top players!",
            winners: winners.map(w => w.username)
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});
app.post('/api/open-case', async (req, res) => {
    try {
        const { caseId } = req.body;
        const user = await User.findById(req.session.userId);
        const selectedCase = caseData[caseId];

        if (!user || !selectedCase) return res.status(400).json({ error: "Erro ao carregar dados" });

        const rewardIds = ['rank1_reward', 'rank2_reward', 'rank3_reward'];
        const isRewardCase = rewardIds.includes(caseId);

        // Se for caixa de recompensa, verifica se o usuário realmente a tem
        if (isRewardCase) {
            const rewardIndex = user.rewardCases.indexOf(caseId);
            if (rewardIndex === -1) {
                return res.status(400).json({ error: "You don't have this reward case or it was already opened." });
            }
            // Remove a caixa das recompensas (ela desaparece após abrir)
            user.rewardCases.splice(rewardIndex, 1);
        } else {
            // Se for caixa normal, cobra o saldo
            const casePrice = Number(selectedCase.price);
            if (user.balance < casePrice) return res.status(400).json({ error: "Saldo insuficiente" });
            user.balance = parseFloat((user.balance - casePrice).toFixed(2));
            user.dailyWager = (user.dailyWager || 0) + casePrice;
        }

        const rolledResult = rollItem(selectedCase.items);
        const cond = getConditionForItem(rolledResult);
        const finalValue = calculateValue(rolledResult);

        const newItem = { 
            name: rolledResult.name, 
            conditionShort: cond.short, 
            value: finalValue, 
            img: rolledResult.img, 
            color: rolledResult.color,
            weaponId: rolledResult.weaponId,
            paintKit: rolledResult.paintKit,
            wear: generateRandomWear(cond.short),
            seed: generateRandomSeed(),
            id: Math.random().toString(36).substr(2, 9)
        };

        user.inventory.push(newItem);
        await user.save();

        // REGRA: Super Spin apenas se NÃO for caixa de recompensa e o valor for alto
        const isSuperSpin = !isRewardCase && newItem.value >= (selectedCase.price * 2.5);
        
        const dropDelay = isSuperSpin ? 13500 : 5500;

        setTimeout(() => {
            io.emit('newLiveDrop', {
                user: user.username,
                avatar: user.avatar,
                steamId: user.steamId,
                item: {
                    name: newItem.name,
                    img: newItem.img,
                    color: newItem.color,
                    value: newItem.value
                }
            });
        }, dropDelay);

        res.json({ 
            winner: newItem, 
            track: generateTrack(newItem, selectedCase.items, selectedCase.price),
            finalBalance: user.balance,
            rewardCases: user.rewardCases, // Envia a lista atualizada para o front
            isSuperSpin: isSuperSpin // Informa o front se deve fazer o super spin
        });

    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Erro interno" });
    }
});
async function resolveBattleRolls(caseIds) {
    let rolls = [];
    for (let cid of caseIds) {
        const selectedCase = caseData[cid];
        if (!selectedCase) continue;

        const its = selectedCase.items;
        const baseItem = rollItem(its);
        const cond = getConditionForItem(baseItem);
        const val = calculateValue(baseItem); // Removido 'cond' extra se não usado
        
        const winnerObj = { 
            ...baseItem, 
            conditionShort: cond.short, 
            value: val 
        };

        // CORREÇÃO: Verificar se este item específico é um Super Spin
        const isSuper = isItemSuperSpin(val, selectedCase.price);

        rolls.push({
            ...winnerObj,
            isSuperSpin: isSuper, // Envia o booleano para o front-end
            track: generateTrack(winnerObj, its, selectedCase.price)
        });
    }
    return rolls;
}

io.on('connection', (socket) => {
    socket.emit('updateBattles', activeBattles);
    
    socket.on('chatMessage', (data) => {
    if (!data.msg || data.msg.length > 200) return;
    
    const payload = {
        user: data.user || "Anônimo",
        msg: data.msg,
        avatar: data.avatar || "https://api.dicebear.com/9.x/bottts/svg?seed=Guest",
        steamId: data.steamId // <--- Adicionamos isto
    };

    io.emit('chatMessage', payload);
});
socket.on('skinCrashBet', async (data) => {
        const user = await User.findById(data.userId);
        if (!user || skinCrashState.status !== 'waiting') return;

        const itemsToBet = user.inventory.filter(i => data.itemIds.includes(i.id));
        if (itemsToBet.length === 0) return;

        const totalValue = itemsToBet.reduce((sum, i) => sum + i.value, 0);

        // Remove do inventário
        user.inventory = user.inventory.filter(i => !data.itemIds.includes(i.id));
        await user.save();

        skinCrashState.bets.push({
            userId: user._id.toString(),
            username: user.username,
            avatar: user.avatar,
            initialValue: totalValue,
            itemsCount: itemsToBet.length,
            cashedOut: false
        });

        socket.emit('inventoryUpdate', user.inventory);
        io.emit('skinCrashTick', skinCrashState);
    });

    socket.on('skinCrashCashOut', async (data) => {
        const bet = skinCrashState.bets.find(b => b.userId === data.userId && !b.cashedOut);
        if (skinCrashState.status === 'running' && bet) {
            const finalValue = bet.initialValue * skinCrashState.multiplier;
            const wonSkinTemplate = getClosestSkin(finalValue);

            bet.cashedOut = true;
            bet.payout = finalValue;
            bet.wonSkin = wonSkinTemplate;

            const user = await User.findById(data.userId);
            const newSkin = {
                ...wonSkinTemplate,
                id: Math.random().toString(36).substr(2, 9),
                wear: generateRandomWear(wonSkinTemplate.conditionShort),
                seed: generateRandomSeed(),
                equippedTeam: 0
            };

            user.inventory.push(newSkin);
            await user.save();

            socket.emit('inventoryUpdate', user.inventory);
            io.emit('skinCrashTick', skinCrashState);
        }
    });
    socket.on('createBattle', async (data) => {
    const user = await User.findById(data.userId);
    if (!user) return;

    let totalPrice = 0;
    data.caseIds.forEach(cid => { if(caseData[cid]) totalPrice += caseData[cid].price });
    if (user.balance < totalPrice) return;

    // 1. DEDUZIR O DINHEIRO IMEDIATAMENTE
    user.balance = parseFloat((user.balance - totalPrice).toFixed(2));
    await user.save();
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
            username: "BOT", 
            id: "bot", 
            avatar: "https://api.dicebear.com/9.x/bottts/svg?seed=TobyBot" 
        } : null,
        caseIds: data.caseIds,
        price: totalPrice,
        isBot: data.isBot,
        isUnderdog: data.isUnderdog
    };

    if (data.isBot) {
        const p1Rolls = await resolveBattleRolls(b.caseIds);
        const p2Rolls = await resolveBattleRolls(b.caseIds);
        const p1Total = p1Rolls.reduce((sum, r) => sum + r.value, 0);
        const p2Total = p2Rolls.reduce((sum, r) => sum + r.value, 0);
        
        let winId;
if (b.isUnderdog) {
    // Underdog: quem tem MENOS ganha. Em caso de empate, p1 ganha.
    winId = p1Total <= p2Total ? b.player1.id : b.player2.id;
} else {
    // Normal: quem tem MAIS ganha.
    winId = p1Total >= p2Total ? b.player1.id : b.player2.id;
}
        
        // --- LOGICA DE INVENTÁRIO (BOT) ---
        if (winId !== "bot") {
    const allSkins = [...p1Rolls, ...p2Rolls].map(s => ({
        name: s.name,
        value: s.value,
        img: s.img,
        color: s.color,
        conditionShort: s.conditionShort,
        weaponId: Number(s.weaponId) || 0, // ADICIONADO
        paintKit: Number(s.paintKit) || 0, // ADICIONADO
        wear: generateRandomWear(s.conditionShort), // ADICIONADO
        equippedTeam: 0,
        seed: generateRandomSeed(),
        id: Math.random().toString(36).substr(2, 9)
    }));
    
    await User.findByIdAndUpdate(user._id, { 
        $push: { inventory: { $each: allSkins } } 
    });
}

        io.to(battleId).emit('startBattleSpin', {
            battle: b, p1Rolls, p2Rolls, winnerId: winId,
            p1FinalBalance: user.balance, // O saldo não muda no fim, as skins vão para o inv
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
            user2.dailyWager = (user2.dailyWager || 0) + b.price; // ADICIONE ESTA LINHA
            await user2.save();
            socket.emit('balanceUpdate', user2.balance);

            socket.join(b.id);
            b.player2 = { username: user2.username, id: user2._id.toString(), avatar: user2.avatar };

            const p1Rolls = await resolveBattleRolls(b.caseIds);
            const p2Rolls = await resolveBattleRolls(b.caseIds);
            const p1Total = p1Rolls.reduce((sum, r) => sum + r.value, 0);
            const p2Total = p2Rolls.reduce((sum, r) => sum + r.value, 0);

            let winId;
if (b.isUnderdog) {
    // Underdog: quem tem MENOS ganha. Em caso de empate, p1 ganha.
    winId = p1Total <= p2Total ? b.player1.id : b.player2.id;
} else {
    // Normal: quem tem MAIS ganha.
    winId = p1Total >= p2Total ? b.player1.id : b.player2.id;
}
            
            // --- 2. DEFINIÇÃO DE ALLSKINS (TEM DE VIR ANTES DE SER USADA) ---
            const allSkins = [...p1Rolls, ...p2Rolls].map(s => ({
                name: s.name,
                value: s.value,
                img: s.img,
                color: s.color,
                conditionShort: s.conditionShort,
                weaponId: Number(s.weaponId) || 0,
                paintKit: Number(s.paintKit) || 0,
                wear: generateRandomWear(s.conditionShort),
                equippedTeam: 0,
                seed: generateRandomSeed(),
                id: Math.random().toString(36).substr(2, 9)
            }));

            // --- 3. LOGICA DE INVENTÁRIO E LIVE FEED ---
            if (winId && !winId.startsWith('bot')) {
                // Vencedor Real
                await User.findByIdAndUpdate(winId, { 
                    $push: { inventory: { $each: allSkins } } 
                });
                
                // Enviar para o Live Feed
                allSkins.forEach(skin => {
                    if (skin.value > 10) { // Opcional: só mostra drops > $10 para não inundar
                        io.emit('newLiveDrop', {
                            user: winId === b.player1.id ? b.player1.username : b.player2.username,
                            avatar: winId === b.player1.id ? b.player1.avatar : b.player2.avatar,
                            steamId: winId === b.player1.id ? (user2.steamId /* assume p1 is real if not bot */) : user2.steamId,
                            item: skin
                        });
                    }
                });
            } else if (winId && winId.startsWith('bot')) {
                // Vencedor Bot (Não salva no DB, apenas mostra no feed)
                const botInfo = getBotData(winId);
                allSkins.forEach(skin => {
                    if (skin.value > 10) {
                        io.emit('newLiveDrop', {
                            user: botInfo.name,
                            avatar: botInfo.avatar,
                            steamId: winId,
                            item: skin
                        });
                    }
                });
            }

            // Pegar saldos para manter a UI sincronizada
            let p1Balance = 0;
            if (!b.player1.id.startsWith('bot')) {
                const p1Obj = await User.findById(b.player1.id);
                p1Balance = p1Obj ? p1Obj.balance : 0;
            }

            io.to(b.id).emit('startBattleSpin', {
                battle: b, p1Rolls, p2Rolls, winnerId: winId,
                p1FinalBalance: p1Balance,
                p2FinalBalance: user2.balance
            });

            activeBattles.splice(idx, 1);
            io.emit('updateBattles', activeBattles);
        }
    });
});

let globalSkinPool = [];
// Criar uma lista plana de todas as skins disponíveis para os bots usarem
function refreshSkinPool() {
    globalSkinPool = [];
    Object.keys(caseData).forEach(key => {
        caseData[key].items.forEach(item => {
            globalSkinPool.push({
                name: item.name,
                img: item.img,
                color: item.color,
                // Pega o preço da primeira raridade como base
                value: item.rarities[0].price,
                conditionShort: item.rarities[0].short
            });
        });
    });
}
// Chama a função após carregar a skinDatabase
setTimeout(refreshSkinPool, 5000);
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
setTimeout(startSkinCrashLoop, 10000);
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
app.post('/api/equip-item', async (req, res) => {
    try {
        const { itemId, team, action } = req.body;
        const user = await User.findById(req.session.userId);
        if (!user) return res.status(401).json({ error: "Não autorizado" });

        const item = user.inventory.find(i => i.id === itemId);
        if (!item) return res.status(404).json({ error: "Item não encontrado" });

        const weaponId = parseInt(item.weaponId);
        const paintKit = parseInt(item.paintKit);
        const wear = parseFloat(item.wear) || 0.15;
        const oldTeamStatus = item.equippedTeam; // Estado antes da mudança

        const isKnife = weaponId >= 500 && weaponId <= 999;
        const isGlove = (weaponId >= 5027 && weaponId <= 5035) || weaponId === 4725;
        
        // --- 1. AÇÃO: DESEQUIPAR ---
        if (action === 'unequip') {
            if (isGlove) {
                await sqlConnection.query("DELETE FROM wp_player_gloves WHERE steamid = ? AND weapon_defindex = ?", [user.steamId, weaponId]);
                await sqlConnection.query("DELETE FROM wp_player_skins WHERE steamid = ? AND weapon_defindex = ?", [user.steamId, weaponId]);
            } else if (isKnife) {
                await sqlConnection.query("DELETE FROM wp_player_knife WHERE steamid = ?", [user.steamId]);
                await sqlConnection.query("DELETE FROM wp_player_skins WHERE steamid = ? AND weapon_defindex BETWEEN 500 AND 999", [user.steamId]);
            } else {
                await sqlConnection.query("DELETE FROM wp_player_skins WHERE steamid = ? AND weapon_defindex = ?", [user.steamId, weaponId]);
            }
            item.equippedTeam = 0;
        } 
        
        // --- 2. AÇÃO: EQUIPAR ---
        else {
            // LÓGICA DE EXCLUSIVIDADE DO ITEM:
            // Se estou a equipar APENAS num lado (2 ou 3) e este item estava no lado oposto ou em AMBOS,
            // temos de o remover do lado onde ele não vai estar mais.
            if (team === 2 || team === 3) {
                const oppositeTeam = (team === 2) ? 3 : 2;
                
                // SÓ APAGA DO SQL SE FOR O MESMO ITEM A SER MOVIDO
                if (oldTeamStatus === oppositeTeam || oldTeamStatus === 4) {
                    if (isGlove) {
                        await sqlConnection.query("DELETE FROM wp_player_gloves WHERE steamid = ? AND weapon_team = ?", [user.steamId, oppositeTeam]);
                        await sqlConnection.query("DELETE FROM wp_player_skins WHERE steamid = ? AND weapon_team = ? AND weapon_defindex = ?", [user.steamId, oppositeTeam, weaponId]);
                    } else if (isKnife) {
                        await sqlConnection.query("DELETE FROM wp_player_knife WHERE steamid = ? AND weapon_team = ?", [user.steamId, oppositeTeam]);
                        await sqlConnection.query("DELETE FROM wp_player_skins WHERE steamid = ? AND weapon_team = ? AND weapon_defindex BETWEEN 500 AND 999", [user.steamId, oppositeTeam]);
                    } else {
                        await sqlConnection.query("DELETE FROM wp_player_skins WHERE steamid = ? AND weapon_team = ? AND weapon_defindex = ?", [user.steamId, oppositeTeam, weaponId]);
                    }
                }
            }

            const teamsToOccupy = (team === 4) ? [2, 3] : [team];

            for (let tId of teamsToOccupy) {
                // RESOLUÇÃO DE CONFLITOS NO MONGODB
                // Se eu equipar a Skin B no CT, a Skin A (que estava no CT) tem de perder o CT.
                user.inventory.forEach(i => {
                    const iId = parseInt(i.weaponId);
                    const iIsGlove = (iId >= 5027 && iId <= 5035) || iId === 4725;
                    const iIsKnife = iId >= 500 && iId <= 999;

                    const isSameWeapon = (iId === weaponId);
                    const isConflictGlove = (isGlove && iIsGlove);
                    const isConflictKnife = (isKnife && iIsKnife);

                    if (i.id !== item.id && (isSameWeapon || isConflictGlove || isConflictKnife)) {
                        if (i.equippedTeam === tId) {
                            i.equippedTeam = 0;
                        } else if (i.equippedTeam === 4) {
                            i.equippedTeam = (tId === 2 ? 3 : 2); // Mantém o lado oposto
                        }
                    }
                });

                // SINCRONIZAÇÃO SQL (Substitui o que quer que esteja no slot de destino)
                if (isGlove) {
                    await sqlConnection.query("DELETE FROM wp_player_gloves WHERE steamid = ? AND weapon_team = ?", [user.steamId, tId]);
                    await sqlConnection.query("INSERT INTO wp_player_gloves (steamid, weapon_team, weapon_defindex) VALUES (?, ?, ?)", [user.steamId, tId, weaponId]);
                    await sqlConnection.query("DELETE FROM wp_player_skins WHERE steamid = ? AND weapon_team = ? AND weapon_defindex = ?", [user.steamId, tId, weaponId]);
                    await sqlConnection.query("INSERT INTO wp_player_skins (steamid, weapon_team, weapon_defindex, weapon_paint_id, weapon_wear, weapon_seed) VALUES (?, ?, ?, ?, ?, ?)", [user.steamId, tId, weaponId, paintKit, wear, item.seed || 0]);
                } else if (isKnife) {
                    await sqlConnection.query("DELETE FROM wp_player_knife WHERE steamid = ? AND weapon_team = ?", [user.steamId, tId]);
                    const knifeName = KNIFE_NAMES[weaponId] || "weapon_knife";
                    await sqlConnection.query("INSERT INTO wp_player_knife (steamid, weapon_team, knife) VALUES (?, ?, ?)", [user.steamId, tId, knifeName]);
                    await sqlConnection.query("DELETE FROM wp_player_skins WHERE steamid = ? AND weapon_team = ? AND weapon_defindex BETWEEN 500 AND 999", [user.steamId, tId]);
                    await sqlConnection.query("INSERT INTO wp_player_skins (steamid, weapon_team, weapon_defindex, weapon_paint_id, weapon_wear, weapon_seed) VALUES (?, ?, ?, ?, ?, ?)", [user.steamId, tId, weaponId, paintKit, wear, item.seed || 0]);
                } else {
                    await sqlConnection.query("DELETE FROM wp_player_skins WHERE steamid = ? AND weapon_team = ? AND weapon_defindex = ?", [user.steamId, tId, weaponId]);
                    await sqlConnection.query("INSERT INTO wp_player_skins (steamid, weapon_team, weapon_defindex, weapon_paint_id, weapon_wear, weapon_seed) VALUES (?, ?, ?, ?, ?, ?)", [user.steamId, tId, weaponId, paintKit, wear, item.seed || 0]);
                }
            }
            item.equippedTeam = team;
        }

        user.markModified('inventory');
        await user.save();
        res.json({ success: true, inventory: user.inventory });

    } catch (e) {
        console.error("ERRO LOADOUT:", e);
        res.status(500).json({ error: "Erro interno" });
    }
});
app.get('/api/leaderboard', async (req, res) => {
    // Retorna todos os utilizadores (ou os top 50), ordenados por aposta
    const top = await User.find({}, 'username avatar dailyWager')
        .sort({ dailyWager: -1 })
        .limit(50); 
    res.json(top);
});

Object.assign(caseData, rewardCases);

const cron = require('node-cron');
cron.schedule('0 19 * * *', async () => {
    console.log("🏆 A PROCESSAR RANKING DIÁRIO...");
    
    // 1. Procura apenas utilizadores que apostaram MAIS do que 0
    const winners = await User.find({ dailyWager: { $gt: 0 } })
        .sort({ dailyWager: -1 })
        .limit(3);

    // Se ninguém apostou nada, o array 'winners' virá vazio []
    if (winners.length === 0) {
        console.log("⚠️ Ninguém apostou hoje. Ranking resetado sem prémios.");
    } else {
        // 2. Distribui os prémios apenas para quem está no array (quem apostou > 0)
        if (winners[0]) {
            await User.findByIdAndUpdate(winners[0]._id, { $push: { rewardCases: 'rank1_reward' } });
            console.log(`🥇 Rank 1 entregue a: ${winners[0].username}`);
        }
        if (winners[1]) {
            await User.findByIdAndUpdate(winners[1]._id, { $push: { rewardCases: 'rank2_reward' } });
            console.log(`🥈 Rank 2 entregue a: ${winners[1].username}`);
        }
        if (winners[2]) {
            await User.findByIdAndUpdate(winners[2]._id, { $push: { rewardCases: 'rank3_reward' } });
            console.log(`🥉 Rank 3 entregue a: ${winners[2].username}`);
        }
    }

    // 3. Reseta o Wager de TODO o servidor para o dia seguinte
    await User.updateMany({}, { $set: { dailyWager: 0 } });

    // 4. Avisa o site para atualizar a UI dos utilizadores online
    io.emit('leaderboardReset');
    console.log("✅ Ciclo diário concluído.");
});
app.get('/api/plugin/skins/:steamId', async (req, res) => {
    try {
        const user = await User.findOne({ steamId: req.params.steamId });
        if (!user) return res.status(404).json({ error: "User not found" });

        const equippedSkins = user.inventory.filter(i => i.isEquipped);

        const response = equippedSkins.map(s => ({
            weaponId: s.weaponId,
            paintKit: s.paintKit,
            wear: s.wear || 0.15,
            seed: s.seed || 0
        }));

        res.json(response);
    } catch (e) {
        res.status(500).json({ error: "Internal Error" });
    }
});
server.listen(3000, "0.0.0.0", () => {
  console.log("🚀 TOBYDROP Running");
});


