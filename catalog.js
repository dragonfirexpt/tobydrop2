// catalog.js — lista de TODAS as skins para o upgrader (não só as das caixas).
// Junta: preços (data/prices.json, da OpenSkin) + dados das skins (data/skins.json: imagem, weaponId, paintKit).
// Skins sem dados em skins.json ficam de fora, porque sem weaponId/paintKit não dá para as equipar.
const fs = require('fs');
const path = require('path');
const { chain } = require('stream-chain');
const { parser } = require('stream-json');
const { streamArray } = require('stream-json/streamers/StreamArray');
const prices = require('./prices');

const SKINS_FILE = path.join(__dirname, 'data', 'skins.json');
const INCLUDE_STATTRAK = true;  // mete false para tirar as StatTrak™ do upgrader
const INCLUDE_SOUVENIR = true;  // mete false para tirar as Souvenir do upgrader

const WEARS = { 'Factory New': 'FN', 'Minimal Wear': 'MW', 'Field-Tested': 'FT', 'Well-Worn': 'WW', 'Battle-Scarred': 'BS' };
const WEAR_RE = /^(.*) \((Factory New|Minimal Wear|Field-Tested|Well-Worn|Battle-Scarred)\)$/;
const DOPPLER_RE = /\|\s*(?:Gamma )?Doppler$/;
const PHASES = new Set(['Phase 1', 'Phase 2', 'Phase 3', 'Phase 4', 'Ruby', 'Sapphire', 'Black Pearl', 'Emerald']);

// igual ao normalize do loadSkinDatabase (server.js)
const normalize = (str) => {
    if (!str) return '';
    return str.toLowerCase()
        .replace(/stattrak™?|souvenir/g, '')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/★/g, '')
        .replace(/knife/g, '')
        .replace(/[^a-z0-9]/g, '')
        .trim();
};

// float de cada desgaste (igual ao generateRandomWear do server.js) — usado para validar o float do anúncio
const WEAR_RANGE = { FN: [0, 0.07], MW: [0.07, 0.15], FT: [0.15, 0.38], WW: [0.38, 0.45], BS: [0.45, 1] };
const cleanFloat = (f, cond) => {
    const n = Number(f), r = WEAR_RANGE[cond];
    return f != null && Number.isFinite(n) && r && n >= r[0] && n <= r[1] ? n : null;
};
const cleanSeed = (s) => (s != null && Number.isInteger(Number(s)) && Number(s) >= 0 && Number(s) <= 1000 ? Number(s) : null);

// chave única de uma skin+desgaste (StatTrak e Souvenir NÃO se misturam com a versão normal)
const keyOf = (name, cond) =>
    (/stattrak/i.test(name) ? 'st:' : '') + (/souvenir/i.test(name) ? 'sv:' : '') + normalize(name) + '|' + cond;

async function loadMeta(knifeNames) {
    const meta = new Map();
    if (!fs.existsSync(SKINS_FILE)) return meta;
    const pipeline = chain([fs.createReadStream(SKINS_FILE), parser(), streamArray()]);
    for await (const entry of pipeline) {
        const s = entry.value;
        const n = normalize(s.name);
        const key = s.phase ? n + normalize(s.phase) : n;

        let weaponId = s.weapon && s.weapon.weapon_id ? Number(s.weapon.weapon_id) : 0;
        if (!weaponId && s.weapon && s.weapon.id) {
            const id = Object.keys(knifeNames).find(k => knifeNames[k] === s.weapon.id);
            weaponId = id ? Number(id) : 0;
        }
        meta.set(key, {
            image: s.image,
            paintKit: Number(s.paint_index) || 0,
            weaponId,
            color: (s.rarity && s.rarity.color) || '#ffffff'
        });
    }
    return meta;
}

async function buildCatalog(caseData, knifeNames = {}) {
    const map = new Map(); // keyOf -> entry

    // 1) skins das caixas (têm prioridade; já levam os preços atualizados)
    for (const k in caseData) {
        for (const item of caseData[k].items || []) {
            for (const r of item.rarities || []) {
                const key = keyOf(item.name, r.short);
                const price = parseFloat(r.price.toFixed(2));
                const old = map.get(key);
                if (!old || price < old.price) {
                    map.set(key, {
                        name: item.name, img: item.img, color: item.color,
                        weaponId: item.weaponId, paintKit: item.paintKit,
                        price, displayCond: r.short,
                        float: cleanFloat(r.float, r.short), seed: cleanSeed(r.seed)
                    });
                }
            }
        }
    }
    const fromCases = map.size;

    // 2) todas as outras skins do CS
    let added = 0, unmatched = 0;
    const data = prices.readTable();
    if (data) {
        const table = data.prices || {};
        const icons = data.icons || {};
        const meta = await loadMeta(knifeNames);

        const phasesOf = new Map(); // hash -> [fases]
        for (const k of Object.keys(table)) {
            const i = k.indexOf('#');
            if (i < 0) continue;
            const hash = k.slice(0, i), pat = k.slice(i + 1);
            if (!PHASES.has(pat)) continue; // só Doppler/Gamma Doppler (Fade e Case Hardened ficam com o preço base)
            if (!phasesOf.has(hash)) phasesOf.set(hash, []);
            phasesOf.get(hash).push(pat);
        }

        for (const hash of Object.keys(table)) {
            if (hash.includes('#')) continue;
            const m = hash.match(WEAR_RE);
            if (!m) continue; // sem desgaste = stickers, caixas, facas lisas, etc.
            const [, nameBase, wear] = m;
            const cond = WEARS[wear];
            if (!INCLUDE_STATTRAK && /stattrak/i.test(nameBase)) continue;
            if (!INCLUDE_SOUVENIR && /souvenir/i.test(nameBase)) continue;

            const variants = [];
            const phases = phasesOf.get(hash);
            if (DOPPLER_RE.test(nameBase) && phases) {
                phases.forEach(p => { const e = table[hash + '#' + p]; variants.push({ name: `${nameBase} ${p}`, price: e.p, f: e.f, sd: e.sd }); });
            } else {
                variants.push({ name: nameBase, price: table[hash].p, f: table[hash].f, sd: table[hash].sd });
            }

            for (const v of variants) {
                const key = keyOf(v.name, cond);
                if (map.has(key)) continue;
                const mm = meta.get(normalize(v.name));
                if (!mm || !mm.weaponId || !mm.paintKit) { unmatched++; continue; }
                const icon = icons[hash] ? (icons[hash].startsWith('http') ? icons[hash] : (data.icon_prefix || '') + icons[hash]) : '';
                map.set(key, {
                    name: v.name,
                    img: mm.image || icon || 'https://via.placeholder.com/512x384?text=Not+Found',
                    color: mm.color,
                    weaponId: mm.weaponId,
                    paintKit: mm.paintKit,
                    price: v.price,
                    displayCond: cond,
                    float: cleanFloat(v.f, cond),
                    seed: cleanSeed(v.sd)
                });
                added++;
            }
        }
    }

    const list = [...map.values()].sort((a, b) => a.price - b.price);
    const withFloat = list.filter(x => x.float != null).length, withSeed = list.filter(x => x.seed != null).length;
    console.log(`🎯 Upgrader: ${list.length} skins (${fromCases} das caixas + ${added} novas) | ${unmatched} ignoradas por falta de dados em skins.json | float em ${withFloat}, pattern em ${withSeed}`);
    return { list, index: map, stats: { fromCases, added, unmatched } };
}

module.exports = { buildCatalog, keyOf, normalize };