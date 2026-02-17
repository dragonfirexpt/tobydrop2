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
    avatar: { type: String, default: 'https://api.dicebear.com/9.x/bottts/svg?seed=identicon' },
    // New Inventory Array
    inventory: [{
        name: String,
        value: Number,
        img: String,
        color: String,
        conditionShort: String,
        id: String // Unique ID for selling
    }]
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
        img: "https://img.clash.gg/standard/2baff90986532bdaf70802fd3aeacf4e.png",
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
        price: 5.00,
        img: "https://img.clash.gg/standard/23379c598b6ad75fba36a055843a156b.png#hash=lsWJHQg7aLmXWHB7qIpfqrv2CCiHh3WIVw==",
        items: [
            { name: "Talon Knife | Tiger Tooth", maxVal: 750.37, minVal: 750.37, color: "#ffb703", chance: 0.005, fixedCondition: "FN" },
            { name: "Survival Knife | Doppler Phase 4", maxVal: 315.24, minVal: 315.24, color: "#ffb703", chance: 0.016, fixedCondition: "FN", img: "https://cdn.csgoskins.gg/public/uih/products/aHR0cHM6Ly9jZG4uY3Nnb3NraW5zLmdnL3B1YmxpYy9pbWFnZXMvYnVja2V0cy9lY29uL2RlZmF1bHRfZ2VuZXJhdGVkL3dlYXBvbl9rbmlmZV9jYW5pc19hbV9kb3BwbGVyX3BoYXNlNF9saWdodC5jNDQ3MThlNzQ1MDNhOGY2NTg0MzM2MzQzNDU1NDI1YjNiYTRkNTI5LnBuZw--/auto/auto/85/notrim/38f33dd23029871b7105d5753682124c.webp"},
            { name: "Gut Knife | Doppler Phase 4", maxVal: 197.01, minVal: 197.01, color: "#ffb703", chance: 0.057, fixedCondition: "FN", img: "https://cdn.csgoskins.gg/public/uih/products/aHR0cHM6Ly9jZG4uY3Nnb3NraW5zLmdnL3B1YmxpYy9pbWFnZXMvYnVja2V0cy9lY29uL2RlZmF1bHRfZ2VuZXJhdGVkL3dlYXBvbl9rbmlmZV9ndXRfYW1fZG9wcGxlcl9waGFzZTRfbGlnaHQuNjdjYWJkNDYwNTdiZTE4YjgxOTA3MDBjMjg1ZGQ3NzcwZGFiZmZjMC5wbmc-/auto/auto/85/notrim/057d957e26e949ec78b95c3f4571d6c3.webp" },
            { name: "AK-47 | Vulcan", maxVal: 183.63, minVal: 183.63, color: "#eb4b4b", chance: 0.011, fixedCondition: "BS" },
            { name: "AWP | Containment Breach", maxVal: 92.33, minVal: 92.33, color: "#eb4b4b", chance: 0.122, fixedCondition: "WW" },
            { name: "AK-47 | Neon Rider", maxVal: 82.60, minVal: 71.71, color: "#eb4b4b", chance: 0.154 },
            { name: "AK-47 | Inheritance", maxVal: 81.78, minVal: 81.78, color: "#eb4b4b", chance: 0.088, fixedCondition: "FT" },
            { name: "AWP | The End", maxVal: 55.06, minVal: 55.06, color: "#d32ce6", chance: 0.120, fixedCondition: "FN" },
            { name: "AWP | Crakow!", maxVal: 40.16, minVal: 40.16, color: "#d32ce6", chance: 0.072, fixedCondition: "BS" },
            { name: "M4A4 | Desolate Space", maxVal: 16.95, minVal: 16.95, color: "#d32ce6", chance: 3.530, fixedCondition: "BS" },
            { name: "AK-47 | Searing Rage", maxVal: 14.26, minVal: 7.12, color: "#d32ce6", chance: 4.610 },
            { name: "M4A1-S | Leaded Glass", maxVal: 13.41, minVal: 13.41, color: "#d32ce6", chance: 2.538, fixedCondition: "FT" },
            { name: "M4A1-S | Control Panel", maxVal: 11.95, minVal: 11.80, color: "#d32ce6", chance: 2.081 },
            { name: "AWP | Ice Coaled", maxVal: 11.29, minVal: 9.75, color: "#d32ce6", chance: 1.946 },
            { name: "M4A1-S | Black Lotus", maxVal: 10.32, minVal: 10.32, color: "#8847ff", chance: 2.922, fixedCondition: "BS" },
            { name: "UMP-45 | K.O. Factory", maxVal: 6.99, minVal: 6.81, color: "#8847ff", chance: 3.848 },
            { name: "AK-47 | Ice Coaled", maxVal: 6.28, minVal: 6.28, color: "#8847ff", chance: 4.355, fixedCondition: "FT" },
            { name: "Zeus x27 | Olympus", maxVal: 6.12, minVal: 5.67, color: "#8847ff", chance: 4.039 },
            { name: "M4A1-S | Night Terror", maxVal: 4.09, minVal: 1.10, color: "#4b69ff", chance: 15.065 },
            { name: "P90 | Randy Rush", maxVal: 2.58, minVal: 0.98, color: "#4b69ff", chance: 9.070 },
            { name: "Desert Eagle | Serpent Strike", maxVal: 1.74, minVal: 0.83, color: "#4b69ff", chance: 11.462 },
            { name: "Galil AR | Control", maxVal: 1.69, minVal: 0.70, color: "#4b69ff", chance: 13.863 },
            { name: "AWP | Pit Viper", maxVal: 1.50, minVal: 1.33, color: "#4b69ff", chance: 7.869 },
            { name: "Zeus x27 | Tosai", maxVal: 1.33, minVal: 0.70, color: "#4b69ff", chance: 12.157 }
        ]
    },
    royal: {
        name: "Royal Legacy",
        price: 20.00,
        img: "https://img.clash.gg/cases/?q=https://clash.gg/assets/csgo/cases/AWP-Heaven.webp",
        items: [
            { name: "AWP | Medusa", maxVal: 3281.48, minVal: 3281.48, color: "#eb4b4b", chance: 0.012, fixedCondition: "FT"},
            { name: "Nomad Knife | Doppler Ruby", maxVal: 2220.06, minVal: 2220.06, color: "#ffb703", chance: 0.016, fixedCondition: "FN", img: "https://cdn.csgoskins.gg/public/uih/products/aHR0cHM6Ly9jZG4uY3Nnb3NraW5zLmdnL3B1YmxpYy9pbWFnZXMvYnVja2V0cy9lY29uL2RlZmF1bHRfZ2VuZXJhdGVkL3dlYXBvbl9rbmlmZV9vdXRkb29yX2FtX3J1YnlfbWFyYmxlaXplZF9saWdodC5hMDUxYWE3MmEwNzEwMzllMGY2MTYyMjRkNDY5ZmY3MDViZmNlOTI5LnBuZw--/auto/auto/85/notrim/9b21cf901c664ad3fc824d11a2fd005d.webp"},
            { name: "M9 Bayonet | Fade", maxVal: 1613.09, minVal: 1613.09, color: "#ffb703", chance: 0.014, fixedCondition: "FN"},
            { name: "Karambit | Tiger Tooth", maxVal: 1478.52, minVal: 1478.52, color: "#ffb703", chance: 0.028, fixedCondition: "FN"},
            { name: "Bayonet | Gamma Doppler Phase 2", maxVal: 1010.18, minVal: 1010.18, color: "#ffb703", chance: 0.028, fixedCondition: "FN", img: "https://cdn.csgoskins.gg/public/uih/products/aHR0cHM6Ly9jZG4uY3Nnb3NraW5zLmdnL3B1YmxpYy9pbWFnZXMvYnVja2V0cy9lY29uL2RlZmF1bHRfZ2VuZXJhdGVkL3dlYXBvbl9iYXlvbmV0X2FtX2dhbW1hX2RvcHBsZXJfcGhhc2UyX2xpZ2h0LmIzNGRjMjdkMDUzMGRkNDNlZTJmYzFiZjE3Y2MwYzVhOWI0MWI0MjMucG5n/auto/auto/85/notrim/bd638ec178949f856962fb2cc0891044.webp"},
            { name: "Sport Gloves | Amphibious", maxVal: 451.48, minVal: 451.48, color: "#ffb703", chance: 0.052, fixedCondition: "BS"},
            { name: "Navaja Knife | Doppler Phase 4", maxVal: 182.23, minVal: 182.23, color: "#ffb703", chance: 0.114, fixedCondition: "FN", img: "https://cdn.csgoskins.gg/public/uih/products/aHR0cHM6Ly9jZG4uY3Nnb3NraW5zLmdnL3B1YmxpYy9pbWFnZXMvYnVja2V0cy9lY29uL2RlZmF1bHRfZ2VuZXJhdGVkL3dlYXBvbl9rbmlmZV9neXBzeV9qYWNra25pZmVfYW1fZG9wcGxlcl9waGFzZTRfbGlnaHQuMDk0Y2FjZmRhMTJiOGU2Yjk1MDlmNjcxYWZjMzExZmFiM2ExZTczYS5wbmc-/auto/auto/85/notrim/8b2c3580cdd2f6e91dc75bd90d6d51e4.webp"},
            { name: "Survival Knife | Case Hardened", maxVal: 148.75, minVal: 148.75, color: "#ffb703", chance: 0.131, fixedCondition: "FT" },
            { name: "Gut Knife | Bright Water", maxVal: 124.40, minVal: 124.40, color: "#ffb703", chance: 0.222, fixedCondition: "FN" },
            { name: "Shadow Daggers | Lore", maxVal: 94.45, minVal: 94.45, color: "#ffb703", chance: 0.147, fixedCondition: "FT" },
            { name: "AWP | Printstream", maxVal: 84.20, minVal: 70.31, color: "#eb4b4b", chance: 0.919 },
            { name: "AK-47 | Neon Rider", maxVal: 71.39, minVal: 70.17, color: "#eb4b4b", chance: 1.005 },
            { name: "AK-47 | Asiimov", maxVal: 61.01, minVal: 61.01, color: "#eb4b4b", chance: 1.079, fixedCondition: "FT" },
            { name: "USP-S | Printstream", maxVal: 55.63, minVal: 55.63, color: "#eb4b4b", chance: 1.011, fixedCondition: "FT" },
            { name: "AWP | Chrome Cannon", maxVal: 51.86, minVal: 39.82, color: "#eb4b4b", chance: 8.375 },
            { name: "SG 553 | Integrale", maxVal: 41.70, minVal: 5.72, color: "#d32ce6", chance: 11.984 },
            { name: "M4A4 | Tooth Fairy", maxVal: 27.22, minVal: 5.54, color: "#d32ce6", chance: 9.782 },
            { name: "AK-47 | Frontside Misty", maxVal: 25.92, minVal: 25.92, color: "#d32ce6", chance: 6.871, fixedCondition: "BS" },
            { name: "AWP | Mortis", maxVal: 23.91, minVal: 6.03, color: "#d32ce6", chance: 11.782 },
            { name: "AK-47 | Point Disarray", maxVal: 22.67, minVal: 22.67, color: "#d32ce6", chance: 7.560, fixedCondition: "FT" },
            { name: "M4A1-S | Stratosphere", maxVal: 15.61, minVal: 13.66, color: "#8847ff", chance: 7.966 },
            { name: "AK-47 | Phantom Disruptor", maxVal: 13.96, minVal: 8.67, color: "#8847ff", chance: 10.545 },
            { name: "AWP | Duality", maxVal: 10.07, minVal: 5.08, color: "#8847ff", chance: 9.786 },
            { name: "M4A1-S | Solitude", maxVal: 8.15, minVal: 2.04, color: "#8847ff", chance: 10.571 }
        ]
    },
    dragon_hoard: {
        name: "Dragon's Hoard",
        price: 50.00, // Preço sugerido com base no valor médio dos itens
        img: "https://img.clash.gg/cases/?q=https://clash.gg/assets/csgo/cases/Eclipse.webp",
        items: [
            { name: "AWP | Dragon Lore", maxVal: 10061.34, minVal: 10061.34, color: "#ffb703", chance: 0.010, fixedCondition: "FT" },
            { name: "★ Butterfly Knife | Gamma Doppler Phase 3", maxVal: 3401.02, minVal: 3401.02, color: "#ffb703", chance: 0.019, fixedCondition: "FN", img: "https://cdn.csgoskins.gg/public/uih/products/aHR0cHM6Ly9jZG4uY3Nnb3NraW5zLmdnL3B1YmxpYy9pbWFnZXMvYnVja2V0cy9lY29uL2RlZmF1bHRfZ2VuZXJhdGVkL3dlYXBvbl9rbmlmZV9idXR0ZXJmbHlfYW1fZ2FtbWFfZG9wcGxlcl9waGFzZTNfbGlnaHQuM2RhZjU3N2Q5OWU3N2E4ZjZkNTYzNDEyZWEwNTJiMWM2MmQ1NWMwNC5wbmc-/auto/auto/85/notrim/2c25258be3e263f9f578102515aae500.webp" },
            { name: "★ M9 Bayonet | Fade", maxVal: 1613.09, minVal: 1613.09, color: "#ffb703", chance: 0.034, fixedCondition: "FN" },
            { name: "★ Skeleton Knife | Doppler Phase 4", maxVal: 1130.23, minVal: 1130.23, color: "#ffb703", chance: 0.124, fixedCondition: "FN", img: "https://cdn.csgoskins.gg/public/uih/products/aHR0cHM6Ly9jZG4uY3Nnb3NraW5zLmdnL3B1YmxpYy9pbWFnZXMvYnVja2V0cy9lY29uL2RlZmF1bHRfZ2VuZXJhdGVkL3dlYXBvbl9rbmlmZV9za2VsZXRvbl9hbV9kb3BwbGVyX3BoYXNlNF9saWdodC4zMmM1NjY3MjJhNDRlY2VjZDRkZTA2YjVhMjNkMDUyMjE1NTY4ZjA2LnBuZw--/auto/auto/85/notrim/8f45a6034bd22089476ccfde0fb147d9.webp" },
            { name: "★ Butterfly Knife | Lore", maxVal: 1070.51, minVal: 1070.51, color: "#ffb703", chance: 0.056, fixedCondition: "FT" },
            { name: "★ Skeleton Knife | Fade", maxVal: 903.96, minVal: 903.96, color: "#ffb703", chance: 0.046, fixedCondition: "FN" },
            { name: "★ Skeleton Knife | Marble Fade", maxVal: 683.56, minVal: 683.56, color: "#ffb703", chance: 0.158, fixedCondition: "FN" },
            { name: "★ Survival Knife | Doppler Phase 4", maxVal: 315.24, minVal: 315.24, color: "#ffb703", chance: 0.148, fixedCondition: "FN", img: "https://cdn.csgoskins.gg/public/uih/products/aHR0cHM6Ly9jZG4uY3Nnb3NraW5zLmdnL3B1YmxpYy9pbWFnZXMvYnVja2V0cy9lY29uL2RlZmF1bHRfZ2VuZXJhdGVkL3dlYXBvbl9rbmlmZV9jYW5pc19hbV9kb3BwbGVyX3BoYXNlNF9saWdodC5jNDQ3MThlNzQ1MDNhOGY2NTg0MzM2MzQzNDU1NDI1YjNiYTRkNTI5LnBuZw--/auto/auto/85/notrim/38f33dd23029871b7105d5753682124c.webp" },
            { name: "★ Paracord Knife | Fade", maxVal: 258.24, minVal: 258.24, color: "#ffb703", chance: 0.207, fixedCondition: "FN" },
            { name: "★ Bayonet | Freehand", maxVal: 251.00, minVal: 251.00, color: "#ffb703", chance: 0.263, fixedCondition: "FT" },
            { name: "★ Gut Knife | Tiger Tooth", maxVal: 164.31, minVal: 164.31, color: "#ffb703", chance: 3.813, fixedCondition: "FN" },
            { name: "AWP | Asiimov", maxVal: 137.95, minVal: 118.37, color: "#eb4b4b", chance: 1.963 },
            { name: "★ Shadow Daggers | Freehand", maxVal: 96.66, minVal: 89.64, color: "#ffb703", chance: 2.851 },
            { name: "★ Shadow Daggers | Lore", maxVal: 94.45, minVal: 94.45, color: "#ffb703", chance: 3.599, fixedCondition: "FT" },
            { name: "★ Gut Knife | Freehand", maxVal: 94.41, minVal: 94.41, color: "#ffb703", chance: 2.657, fixedCondition: "FT" },
            { name: "AWP | Wildfire", maxVal: 74.74, minVal: 63.72, color: "#eb4b4b", chance: 8.148 },
            { name: "Desert Eagle | Printstream", maxVal: 54.56, minVal: 49.09, color: "#eb4b4b", chance: 8.988 },
            { name: "AK-47 | The Outsiders", maxVal: 34.65, minVal: 12.36, color: "#d32ce6", chance: 8.914 },
            { name: "AK-47 | Nouveau Rouge", maxVal: 31.36, minVal: 19.70, color: "#d32ce6", chance: 7.723 },
            { name: "AWP | Ice Coaled", maxVal: 29.70, minVal: 9.71, color: "#d32ce6", chance: 9.475 },
            { name: "AK-47 | Ice Coaled", maxVal: 27.90, minVal: 6.43, color: "#8847ff", chance: 11.544 },
            { name: "M4A4 | Tooth Fairy", maxVal: 27.22, minVal: 5.54, color: "#8847ff", chance: 12.133 },
            { name: "AK-47 | Phantom Disruptor", maxVal: 13.96, minVal: 8.67, color: "#8847ff", chance: 8.509 },
            { name: "M4A1-S | Nightmare", maxVal: 12.25, minVal: 12.10, color: "#4b69ff", chance: 8.618 }
        ]
    },
    slaughter_neon: {
        name: "Slaughter & Neon",
        price: 12.00,
        img: "https://img.clash.gg/cases?q=https%3A%2F%2Fmedia.discordapp.net%2Fattachments%2F449030703426961418%2F1300938472080543754%2FThief.png%3Fex%3D6722a8de%26is%3D6721575e%26hm%3D43cb6c5894cd97f186381c90f379d6cb2564bed8fd543117b80a9a5946ee7724%26%3D%26format%3Dwebp%26quality%3Dlossless",
        items: [
            { name: "★ Bayonet | Gamma Doppler Phase 2", maxVal: 1010.18, minVal: 1010.18, color: "#ffb703", chance: 0.020, fixedCondition: "FN", img: "https://cdn.csgoskins.gg/public/uih/products/aHR0cHM6Ly9jZG4uY3Nnb3NraW5zLmdnL3B1YmxpYy9pbWFnZXMvYnVja2V0cy9lY29uL2RlZmF1bHRfZ2VuZXJhdGVkL3dlYXBvbl9iYXlvbmV0X2FtX2dhbW1hX2RvcHBsZXJfcGhhc2UyX2xpZ2h0LmIzNGRjMjdkMDUzMGRkNDNlZTJmYzFiZjE3Y2MwYzVhOWI0MWI0MjMucG5n/auto/auto/85/notrim/bd638ec178949f856962fb2cc0891044.webp" },
            { name: "★ Skeleton Knife | Slaughter", maxVal: 624.73, minVal: 624.73, color: "#ffb703", chance: 0.039, fixedCondition: "FT" },
            { name: "★ Nomad Knife | Doppler Phase 3", maxVal: 602.47, minVal: 602.47, color: "#ffb703", chance: 0.041, fixedCondition: "FN", img: "https://cdn.csgoskins.gg/public/uih/products/aHR0cHM6Ly9jZG4uY3Nnb3NraW5zLmdnL3B1YmxpYy9pbWFnZXMvYnVja2V0cy9lY29uL2RlZmF1bHRfZ2VuZXJhdGVkL3dlYXBvbl9rbmlmZV9vdXRkb29yX2FtX2RvcHBsZXJfcGhhc2UzX2xpZ2h0LmE5NTZkNTlmYzA0MGYzNWM3YzUwZTZhZjhhZjlhNDJiNWJhYzJjNTUucG5n/auto/auto/85/notrim/9eb1a7ef8add83ac52666d0fab4e6d49.webp" },
            { name: "★ Navaja Knife | Doppler Ruby", maxVal: 419.58, minVal: 419.58, color: "#ffb703", chance: 0.048, fixedCondition: "FN", img: "https://cdn.csgoskins.gg/public/uih/products/aHR0cHM6Ly9jZG4uY3Nnb3NraW5zLmdnL3B1YmxpYy9pbWFnZXMvYnVja2V0cy9lY29uL2RlZmF1bHRfZ2VuZXJhdGVkL3dlYXBvbl9rbmlmZV9neXBzeV9qYWNra25pZmVfYW1fcnVieV9tYXJibGVpemVkX2xpZ2h0LjJiNzEyZDBhMDE1MTM4ZWQ4NDFiNWU0ZjVjZjQ1ZDE1YTA0YjJhNWIucG5n/auto/auto/85/notrim/5dd35a477c7d81f9bb69821ac787c325.webp"},
            { name: "★ Bowie Knife | Gamma Doppler Phase 2", maxVal: 324.51, minVal: 324.51, color: "#ffb703", chance: 0.050, fixedCondition: "FN", img: "https://cdn.csgoskins.gg/public/uih/products/aHR0cHM6Ly9jZG4uY3Nnb3NraW5zLmdnL3B1YmxpYy9pbWFnZXMvYnVja2V0cy9lY29uL2RlZmF1bHRfZ2VuZXJhdGVkL3dlYXBvbl9rbmlmZV9zdXJ2aXZhbF9ib3dpZV9hbV9nYW1tYV9kb3BwbGVyX3BoYXNlMl9saWdodC4zMWFiYmZmZDRiOWJmZTE4NWFiNjkxZGI1Mjg1MDE0ZDg3Y2Q4YjQ0LnBuZw--/auto/auto/85/notrim/d102b94b267ab44fd9f2f60bf5bfb6f1.webp" },
            { name: "★ Survival Knife | Marble Fade", maxVal: 219.56, minVal: 219.56, color: "#ffb703", chance: 0.077, fixedCondition: "FN" },
            { name: "USP-S | Kill Confirmed", maxVal: 90.86, minVal: 90.86, color: "#eb4b4b", chance: 0.479, fixedCondition: "WW" },
            { name: "AK-47 | The Oligarch", maxVal: 68.59, minVal: 68.59, color: "#eb4b4b", chance: 0.481 },
            { name: "AK-47 | Aquamarine Revenge", maxVal: 64.68, minVal: 64.68, color: "#eb4b4b", chance: 0.465 },
            { name: "AWP | Neo-Noir", maxVal: 61.55, minVal: 61.55, color: "#eb4b4b", chance: 0.491 },
            { name: "USP-S | Printstream", maxVal: 55.63, minVal: 55.63, color: "#eb4b4b", chance: 0.696 },
            { name: "AK-47 | Point Disarray", maxVal: 22.67, minVal: 22.67, color: "#d32ce6", chance: 4.253 },
            { name: "M4A1-S | Decimator", maxVal: 21.61, minVal: 21.61, color: "#d32ce6", chance: 4.472 },
            { name: "M4A4 | 龍王 (Dragon King)", maxVal: 21.38, minVal: 21.38, color: "#d32ce6", chance: 4.363 },
            { name: "AWP | Exothermic", maxVal: 20.02, minVal: 20.02, color: "#d32ce6", chance: 4.733 },
            { name: "P2000 | Wicked Sick", maxVal: 10.05, minVal: 10.05, color: "#8847ff", chance: 5.278 },
            { name: "Charm | Piñatita", maxVal: 10.03, minVal: 10.03, color: "#8847ff", chance: 5.574 },
            { name: "M4A1-S | Black Lotus", maxVal: 9.82, minVal: 8.37, color: "#8847ff", chance: 5.110 },
            { name: "AK-47 | Ice Coaled", maxVal: 9.45, minVal: 9.45, color: "#8847ff", chance: 4.863 },
            { name: "UMP-45 | Neo-Noir", maxVal: 9.38, minVal: 9.38, color: "#8847ff", chance: 5.776 },
            { name: "MP7 | Neon Ply", maxVal: 4.45, minVal: 4.45, color: "#4b69ff", chance: 7.314 },
            { name: "Tec-9 | Remote Control", maxVal: 4.43, minVal: 3.59, color: "#4b69ff", chance: 7.340 },
            { name: "AWP | PAW", maxVal: 3.68, minVal: 3.68, color: "#4b69ff", chance: 8.027 },
            { name: "SG 553 | Pulse", maxVal: 3.62, minVal: 3.62, color: "#4b69ff", chance: 8.373 },
            { name: "P2000 | Acid Etched", maxVal: 0.93, minVal: 0.93, color: "#4b69ff", chance: 9.012 },
            { name: "M4A4 | Etch Lord", maxVal: 0.85, minVal: 0.85, color: "#4b69ff", chance: 12.625 }
        ]
    },
    neon_blade: {
        name: "Neon Blade Box",
        price: 2.50,
        img: "https://img.clash.gg/cases?q=https%3A%2F%2Fmedia.discordapp.net%2Fattachments%2F449030703426961418%2F1230909108526383204%2FSurvival_Guide.png%3Fex%3D66350870%26is%3D66229370%26hm%3Dce48650d53dbcc8f318b65e8f5c13dffdc971d5842d2052368d79fc54adca2e9%26%3D%26format%3Dwebp%26quality%3Dlossless%26width%3D924%26height%3D978",
        items: [
            { name: "★ Survival Knife | Doppler Phase 3", maxVal: 309.73, minVal: 309.73, color: "#ffb703", chance: 0.010, fixedCondition: "FN", img: "https://cdn.csgoskins.gg/public/uih/products/aHR0cHM6Ly9jZG4uY3Nnb3NraW5zLmdnL3B1YmxpYy9pbWFnZXMvYnVja2V0cy9lY29uL2RlZmF1bHRfZ2VuZXJhdGVkL3dlYXBvbl9rbmlmZV9jYW5pc19hbV9kb3BwbGVyX3BoYXNlM19saWdodC5kOGFkZTQ2ZWQ0ZmY3MGY4YjcxMzI3MDMyZTM1NDE5MjhhYWIxYTA5LnBuZw--/auto/auto/85/notrim/d62bb8ac23e9ff4da34f8e74ddb2fbc9.webp" },
            { name: "★ Flip Knife | Autotronic", maxVal: 252.51, minVal: 252.51, color: "#ffb703", chance: 0.010, fixedCondition: "FT" },
            { name: "★ Ursus Knife | Tiger Tooth", maxVal: 227.18, minVal: 227.18, color: "#ffb703", chance: 0.010, fixedCondition: "FN" },
            { name: "AK-47 | Neon Rider", maxVal: 127.36, minVal: 127.36, color: "#eb4b4b", chance: 0.011, fixedCondition: "MW" },
            { name: "M4A4 | Full Throttle", maxVal: 83.20, minVal: 83.20, color: "#eb4b4b", chance: 0.029, fixedCondition: "FT" },
            { name: "AWP | Wildfire", maxVal: 74.74, minVal: 74.74, color: "#eb4b4b", chance: 0.047, fixedCondition: "FT" },
            { name: "AK-47 | Asiimov", maxVal: 65.90, minVal: 61.01, color: "#eb4b4b", chance: 0.061 },
            { name: "AK-47 | Point Disarray", maxVal: 37.66, minVal: 37.66, color: "#d32ce6", chance: 0.099, fixedCondition: "MW" },
            { name: "M4A1-S | Party Animal", maxVal: 34.97, minVal: 34.97, color: "#d32ce6", chance: 0.124, fixedCondition: "FT" },
            { name: "AK-47 | Searing Rage", maxVal: 14.40, minVal: 14.40, color: "#d32ce6", chance: 0.108, fixedCondition: "MW" },
            { name: "AK-47 | Ice Coaled", maxVal: 11.33, minVal: 6.43, color: "#d32ce6", chance: 3.032 },
            { name: "MAG-7 | Monster Call", maxVal: 8.81, minVal: 0.66, color: "#8847ff", chance: 10.958 },
            { name: "R8 Revolver | Banana Cannon", maxVal: 8.66, minVal: 0.63, color: "#8847ff", chance: 10.197 },
            { name: "P250 | Inferno", maxVal: 8.36, minVal: 0.98, color: "#8847ff", chance: 9.583 },
            { name: "Dual Berettas | Twin Turbo", maxVal: 8.11, minVal: 2.89, color: "#8847ff", chance: 6.817 },
            { name: "Glock-18 | Shinobu", maxVal: 7.08, minVal: 6.98, color: "#8847ff", chance: 2.628 },
            { name: "Glock-18 | Vogue", maxVal: 5.93, minVal: 5.89, color: "#8847ff", chance: 2.408 },
            { name: "AWP | Duality", maxVal: 5.08, minVal: 5.08, color: "#8847ff", chance: 3.394, fixedCondition: "FT" },
            { name: "M4A1-S | Night Terror", maxVal: 4.12, minVal: 1.01, color: "#4b69ff", chance: 9.921 },
            { name: "AWP | Phobos", maxVal: 3.45, minVal: 3.45, color: "#4b69ff", chance: 5.614, fixedCondition: "FT" },
            { name: "P250 | Franklin", maxVal: 3.30, minVal: 3.30, color: "#4b69ff", chance: 6.037, fixedCondition: "MW" },
            { name: "M4A1-S | Rose Hex", maxVal: 2.88, minVal: 0.51, color: "#4b69ff", chance: 10.015 },
            { name: "G3SG1 | Dream Glade", maxVal: 1.73, minVal: 0.91, color: "#4b69ff", chance: 8.344 },
            { name: "Glock-18 | Ocean Topo", maxVal: 0.91, minVal: 0.08, color: "#4b69ff", chance: 10.543 }
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
app.get('/api/all-skins', (req, res) => {
    let allSkins = [];

    // The standard conditions from your server.js
    const standardConditions = [
        { name: "Factory New", short: "FN", multiplier: 1.0 },
        { name: "Minimal Wear", short: "MW", multiplier: 0.7 },
        { name: "Field-Tested", short: "FT", multiplier: 0.4 },
        { name: "Well-Worn", short: "WW", multiplier: 0.2 },
        { name: "Battle-Scarred", short: "BS", multiplier: 0.1 } // Adjusted to 0.1 so it has some value
    ];

    for (let key in caseData) {
        caseData[key].items.forEach(item => {
            if (item.fixedCondition) {
                // If the item only exists in one condition (e.g. some Knives)
                const condObj = standardConditions.find(c => c.short === item.fixedCondition) || standardConditions[0];
                const price = item.minVal + ((item.maxVal - item.minVal) * condObj.multiplier);
                
                allSkins.push({ 
                    ...item, 
                    price: parseFloat(price.toFixed(2)), 
                    displayCond: item.fixedCondition 
                });
            } else {
                // Generate all 5 conditions for the skin
                standardConditions.forEach(c => {
                    const price = item.minVal + ((item.maxVal - item.minVal) * c.multiplier);
                    
                    allSkins.push({ 
                        ...item, 
                        name: item.name,
                        price: parseFloat(price.toFixed(2)), 
                        displayCond: c.short 
                    });
                });
            }
        });
    }

    // Remove duplicates (same name AND same condition) and sort by price
    const unique = allSkins.filter((v, i, a) => 
        a.findIndex(t => t.name === v.name && t.displayCond === v.displayCond) === i
    ).sort((a, b) => a.price - b.price);

    res.json(unique);
});
app.post('/api/upgrade', async (req, res) => {
    try {
        const { inputItemIds, targetSkinName, targetPrice, targetCondition } = req.body;
        const user = await User.findById(req.session.userId);
        if (!user) return res.status(401).json({ error: "Não autorizado" });

        if (!Array.isArray(inputItemIds) || inputItemIds.length > 5 || inputItemIds.length === 0) {
            return res.status(400).json({ error: "Selecione entre 1 e 5 itens" });
        }

        // Filtrar itens do inventário que correspondem aos IDs enviados
        const itemsToSacrifice = user.inventory.filter(i => inputItemIds.includes(i.id));
        
        if (itemsToSacrifice.length !== inputItemIds.length) {
            return res.status(400).json({ error: "Um ou mais itens não encontrados" });
        }

        const totalInputValue = itemsToSacrifice.reduce((sum, item) => sum + item.value, 0);
        const chance = (totalInputValue / targetPrice) * 0.95;
        const roll = Math.random();
        const win = roll < chance;

        // Remover todos os itens sacrificados
        user.inventory = user.inventory.filter(i => !inputItemIds.includes(i.id));

        let wonItem = null;
        if (win) {
            let template = null;
            for (let k in caseData) {
                let found = caseData[k].items.find(i => i.name === targetSkinName);
                if (found) { template = found; break; }
            }
            
            wonItem = {
                name: targetSkinName,
                value: targetPrice,
                img: template.img,
                color: template.color,
                conditionShort: targetCondition || "FN",
                id: Math.random().toString(36).substr(2, 9)
            };
            user.inventory.push(wonItem);
        }

        await user.save();
        res.json({ 
            success: true, 
            win, 
            roll: roll * 100, 
            chance: (chance * 100).toFixed(2), 
            balance: user.balance 
        });

    } catch (e) {
        res.status(500).json({ error: "Erro no servidor" });
    }
});
app.post('/api/sell-all-items', async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);
        if (!user || user.inventory.length === 0) {
            return res.status(400).json({ error: "Inventário vazio" });
        }

        // Calcula o valor total de todas as skins
        const totalValue = user.inventory.reduce((sum, item) => sum + (Number(item.value) || 0), 0);
        
        // Atualiza saldo e limpa array
        user.balance = parseFloat((user.balance + totalValue).toFixed(2));
        user.inventory = [];
        
        await user.save();
        res.json({ success: true, balance: user.balance });
    } catch (e) {
        res.status(500).json({ error: "Erro ao vender tudo" });
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

app.post('/api/update-avatar', async (req, res) => {
    const user = await User.findByIdAndUpdate(req.session.userId, { avatar: req.body.avatar }, { new: true });
    res.json({ success: true, user });
});

app.post('/api/logout', (req, res) => req.session.destroy(() => res.json({ success: true })));

app.post('/api/sell-item', async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);
        if (!user) return res.status(401).json({ error: "Não autorizado" });

        const itemIdx = user.inventory.findIndex(i => i.id === req.body.itemId);
        
        if (itemIdx > -1) {
            const itemValue = Number(user.inventory[itemIdx].value) || 0;
            
            // Adiciona o valor ao saldo
            user.balance = parseFloat((Number(user.balance) + itemValue).toFixed(2));
            
            // Remove do inventário
            user.inventory.splice(itemIdx, 1);
            
            await user.save();
            res.json({ success: true, balance: user.balance });
        } else {
            res.status(400).json({ error: "Item não encontrado no inventário" });
        }
    } catch (e) {
        res.status(500).json({ error: "Erro ao vender item" });
    }
});
app.post('/api/open-case', async (req, res) => {
    try {
        const { caseId } = req.body;
        const user = await User.findById(req.session.userId);
        const selectedCase = caseData[caseId];

        if (!user || !selectedCase) return res.status(400).json({ error: "Erro ao carregar dados" });

        const casePrice = Number(selectedCase.price);
        if (user.balance < casePrice) return res.status(400).json({ error: "Saldo insuficiente" });

        // Sorteio
        const baseItem = rollItem(selectedCase.items);
        const cond = getConditionForItem(baseItem);
        const finalValue = calculateValue(baseItem, cond);

        // 1. Tira o dinheiro da caixa
        user.balance = parseFloat((user.balance - casePrice).toFixed(2));
        
        // 2. Cria o item para o inventário
        const newItem = { 
            name: baseItem.name, 
            conditionShort: cond.short, 
            value: finalValue, 
            img: baseItem.img, 
            color: baseItem.color,
            id: Math.random().toString(36).substr(2, 9)
        };

        user.inventory.push(newItem);
        await user.save();

        // 3. ENVIAR RESPOSTA (Garantindo que balanceAfterDeduction existe)
        res.json({ 
            winner: newItem, 
            track: generateTrack(newItem, selectedCase.items), 
            balanceAfterDeduction: user.balance, // <-- IMPORTANTE: O saldo já sem o preço da caixa
            finalBalance: user.balance // Como a skin vai para o inventário, o saldo final é o mesmo
        });

    } catch (e) {
        res.status(500).json({ error: "Erro interno" });
    }
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
        isBot: data.isBot
    };

    if (data.isBot) {
        const p1Rolls = await resolveBattleRolls(b.caseIds);
        const p2Rolls = await resolveBattleRolls(b.caseIds);
        const p1Total = p1Rolls.reduce((sum, r) => sum + r.value, 0);
        const p2Total = p2Rolls.reduce((sum, r) => sum + r.value, 0);
        
        const winId = p1Total >= p2Total ? b.player1.id : "bot";
        
        // --- LOGICA DE INVENTÁRIO (BOT) ---
        if (winId !== "bot") {
            const allSkins = [...p1Rolls, ...p2Rolls].map(s => ({
                name: s.name,
                value: s.value,
                img: s.img,
                color: s.color,
                conditionShort: s.conditionShort,
                id: Math.random().toString(36).substr(2, 9)
            }));
            
            // Adiciona todas as skins ao inventário do criador
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
        await user2.save();
        socket.emit('balanceUpdate', user2.balance);

        socket.join(b.id);
        b.player2 = { username: user2.username, id: user2._id.toString(), avatar: user2.avatar };

        const p1Rolls = await resolveBattleRolls(b.caseIds);
        const p2Rolls = await resolveBattleRolls(b.caseIds);
        const p1Total = p1Rolls.reduce((sum, r) => sum + r.value, 0);
        const p2Total = p2Rolls.reduce((sum, r) => sum + r.value, 0);

        const winId = p1Total >= p2Total ? b.player1.id : b.player2.id;
        
        // --- LOGICA DE INVENTÁRIO (PVP) ---
        const allSkins = [...p1Rolls, ...p2Rolls].map(s => ({
            name: s.name,
            value: s.value,
            img: s.img,
            color: s.color,
            conditionShort: s.conditionShort,
            id: Math.random().toString(36).substr(2, 9)
        }));

        // O vencedor recebe TODAS as skins no inventário
        await User.findByIdAndUpdate(winId, { 
            $push: { inventory: { $each: allSkins } } 
        });

        // Pegar saldos para manter a UI sincronizada (o saldo não deve aumentar, apenas as skins entram no inv)
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


