// prices.js — vai buscar TODOS os preços à OpenSkin (1 pedido), guarda em data/prices.json
// e aplica esses preços às skins do site (caseData). A Steam é ignorada de propósito.
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const API_URL = 'https://api.openskin.dev/v1/prices/all';
const FILE = path.join(__dirname, 'data', 'prices.json');
const ICON_PREFIX = 'https://community.fastly.steamstatic.com/economy/image/';
const SOURCES = ['skinport', 'buff', 'youpin', 'csfloat']; // sem steam

const COND = {
    FN: 'Factory New',
    MW: 'Minimal Wear',
    FT: 'Field-Tested',
    WW: 'Well-Worn',
    BS: 'Battle-Scarred'
};

const round2 = n => Math.max(0.01, Math.round(n * 100) / 100);
// Campo usado como preço da skin: 'bid' = preço de COMPRA (quanto alguém paga), 'ask' = preço de venda.
// Podes mudar com a variável de ambiente PRICE_FIELD (ex.: PRICE_FIELD=ask).
const PRICE_FIELD = process.env.PRICE_FIELD || 'bid';
const numPos = v => { const n = Number(v); return n > 0 ? n : null; };
const askOf = (d, src) => numPos(d && d[src] && d[src][PRICE_FIELD]);   // preço escolhido (bid)
const rawAsk = (d, src) => numPos(d && d[src] && d[src].ask);           // ask, só para estimar o bid em falta
// ---- float / pattern (seed) do anúncio da source ----
// A API pode chamar a estes campos nomes diferentes; tentamos os mais comuns e validamos os valores.
const FLOAT_KEYS = ['float', 'float_value', 'floatvalue', 'wear', 'wear_value', 'paint_wear', 'paintwear'];
const SEED_KEYS = ['seed', 'paint_seed', 'paintseed', 'pattern_id', 'pattern_index', 'pattern'];
const numOf = v => (typeof v === 'number' || (typeof v === 'string' && v.trim() !== '')) && Number.isFinite(Number(v)) ? Number(v) : null;
const firstNum = (o, keys) => { for (const k of keys) { const n = numOf(o[k]); if (n !== null) return n; } return null; };
function listingOf(node) {
    if (!node || typeof node !== 'object') return {};
    const holders = [node, node.listing, node.cheapest, node.lowest, node.item].filter(x => x && typeof x === 'object');
    let f = null, sd = null;
    for (const o of holders) {
        if (f === null) f = firstNum(o, FLOAT_KEYS);
        if (sd === null) sd = firstNum(o, SEED_KEYS);
    }
    if (f !== null && (f < 0 || f > 1)) f = null;
    if (sd !== null && !(Number.isInteger(sd) && sd >= 0 && sd <= 1000)) sd = null;
    return { f, sd };
}
const patternOf = (d, src, pattern) => {
    const list = d && d[src] && d[src].patterns;
    return Array.isArray(list) ? (list.find(x => x.pattern === pattern) || null) : null;
};
const median = arr => {
    const s = [...arr].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

// ------------------------------------------------------------------
// 1) Construir o JSON de preços a partir da resposta da API
// ------------------------------------------------------------------
function buildPriceTable(apiData) {
    const items = Object.entries(apiData);

    // fonte principal = a que tem mais skins com preço
    const counts = {};
    SOURCES.forEach(s => { counts[s] = items.filter(([, d]) => askOf(d, s)).length; });
    const order = [...SOURCES].sort((a, b) => counts[b] - counts[a]);
    const primary = order[0];

    // fontes de reserva: ajustadas à escala da principal (mediana de fonte/principal)
    // assim o preço de reserva fica "parecido" com o da fonte principal
    const ratios = { [primary]: 1 };
    for (const src of order.slice(1)) {
        const rs = [];
        for (const [, d] of items) {
            const p = askOf(d, primary), f = askOf(d, src);
            if (p && f && p >= 1) rs.push(f / p);
        }
        ratios[src] = rs.length >= 50 ? median(rs) : 1;
    }

    // Quando uma skin não tem bid em nenhuma fonte, estimamos: ask x mediana(bid/ask) da fonte principal
    let bidAskRatio = null;
    if (PRICE_FIELD !== 'ask') {
        const rs = [];
        for (const [, d] of items) {
            const b = askOf(d, primary), a = rawAsk(d, primary);
            if (b && a && a >= 1) rs.push(b / a);
        }
        if (rs.length >= 50) bidAskRatio = Math.min(1, median(rs));
    }
    let estimated = 0;

    // getter(src) devolve { ask, node, alt } (ask = preço escolhido; alt = ask real; node = de onde se tira float/seed)
    const pick = (getter) => {
        for (const src of order) {
            const g = getter(src);
            if (g && g.ask) {
                const r = { p: round2(g.ask / ratios[src]), s: src };
                const l = listingOf(g.node);
                if (l.f !== null && l.f !== undefined) r.f = l.f;
                if (l.sd !== null && l.sd !== undefined) r.sd = l.sd;
                return r;
            }
        }
        // sem bid em nenhuma fonte -> estimativa a partir do ask
        if (bidAskRatio) {
            for (const src of order) {
                const g = getter(src);
                if (g && g.alt) {
                    estimated++;
                    const r = { p: round2((g.alt * bidAskRatio) / ratios[src]), s: src + '*est' };
                    const l = listingOf(g.node);
                    if (l.f !== null && l.f !== undefined) r.f = l.f;
                    if (l.sd !== null && l.sd !== undefined) r.sd = l.sd;
                    return r;
                }
            }
        }
        return null;
    };

    const prices = {};
    const icons = {};
    for (const [name, d] of items) {
        if (d.icon_url) icons[name] = d.icon_url.startsWith(ICON_PREFIX) ? d.icon_url.slice(ICON_PREFIX.length) : d.icon_url;
        const base = pick(src => {
            const a = askOf(d, src), alt = rawAsk(d, src);
            return (a || alt) ? { ask: a, alt, node: d[src] } : null;
        });
        if (base) prices[name] = base;

        // fases / padrões (Doppler, etc.) -> chave "Nome#Fase"
        const patterns = new Set();
        SOURCES.forEach(src => {
            if (d[src] && Array.isArray(d[src].patterns)) d[src].patterns.forEach(x => x && x.pattern && patterns.add(x.pattern));
        });
        for (const pat of patterns) {
            const r = pick(src => {
                const node = patternOf(d, src, pat);
                const a = node && numPos(node[PRICE_FIELD]);
                const alt = node && numPos(node.ask);
                return (a || alt) ? { ask: a, alt, node } : null;
            });
            if (r) prices[name + '#' + pat] = r;
        }
    }

    const vals = Object.values(prices);
    const listing = { floats: vals.filter(v => v.f != null).length, seeds: vals.filter(v => v.sd != null).length };
    return { primary, counts, ratios, prices, icons, listing, field: PRICE_FIELD, bidAskRatio, estimated, sample: items.find(([, d]) => d && d[primary]) };
}

// ------------------------------------------------------------------
// 2) Ir buscar à API e guardar o ficheiro (corre 1 vez, quando quiseres)
// ------------------------------------------------------------------
async function fetchAndSave() {
    console.log('📥 A pedir todos os preços à OpenSkin…');
    const res = await axios.get(API_URL, {
        timeout: 180000,
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        headers: { 'Accept-Encoding': 'gzip' }
    });
    const apiData = res.data && res.data.data;
    if (!apiData || typeof apiData !== 'object') throw new Error('Resposta inesperada da API');

    const table = buildPriceTable(apiData);
    const out = {
        updated_at: new Date().toISOString(),
        api_updated_at: res.data.updated_at || null,
        primary: table.primary,
        counts: table.counts,
        ratios: table.ratios,
        price_field: table.field,
        bid_ask_ratio: table.bidAskRatio,
        count: Object.keys(table.prices).length,
        icon_prefix: ICON_PREFIX,
        icons: table.icons,
        prices: table.prices
    };

    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    const tmp = FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(out));
    fs.renameSync(tmp, FILE); // escrita atómica: o servidor nunca lê um ficheiro a meio

    console.log(`✅ ${out.count} preços guardados em data/prices.json | fonte principal: ${out.primary}`);
    console.log(`   💰 campo de preço: ${table.field}` + (table.bidAskRatio ? ` | estimados via ask×${table.bidAskRatio.toFixed(3)}: ${table.estimated}` : ''));
    if (table.field !== 'ask' && !Object.values(out.counts).some(n => n > 0)) {
        console.log(`   ⚠️ Nenhuma skin tem o campo "${table.field}" na API — os preços ficaram vazios. Usa PRICE_FIELD=ask ou manda-me o exemplo cru abaixo.`);
    }
    console.log('   skins com preço por fonte:', JSON.stringify(out.counts));
    console.log('   escala das fontes de reserva vs principal:', JSON.stringify(out.ratios));
    console.log(`   🎯 float em ${table.listing.floats} preços | pattern em ${table.listing.seeds} preços`);
    if (!table.listing.floats && !table.listing.seeds && table.sample) {
        console.log('   ⚠️ A API não devolveu float/pattern com os nomes esperados. Exemplo cru de uma skin (manda-me isto):');
        console.log('   ' + JSON.stringify(table.sample, null, 0).slice(0, 900));
    }
    return out;
}

// ------------------------------------------------------------------
// 3) Aplicar os preços às skins do site
// ------------------------------------------------------------------
// "★ Bayonet | Doppler Phase 1", "Doppler - Phase 4", "Gamma Doppler Emerald" -> base + fase
function parseName(name) {
    let base = String(name).trim();
    let pattern = null;
    const m = base.match(/^(.*\|\s*(?:Gamma )?Doppler)\s*(?:-\s*)?(Phase\s*\d|Ruby|Sapphire|Black Pearl|Emerald)$/i);
    if (m) {
        base = m[1].trim();
        pattern = m[2].replace(/\s+/g, ' ').replace(/^phase/i, 'Phase');
        pattern = pattern.charAt(0).toUpperCase() + pattern.slice(1);
        if (/^black pearl$/i.test(pattern)) pattern = 'Black Pearl';
    }
    return { base, pattern };
}

function readTable() {
    try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch (e) { return null; }
}

function applyPrices(caseData) {
    const data = readTable();
    if (!data) {
        console.log('ℹ️ data/prices.json não existe (ou está inválido) — a manter os preços manuais. Corre: npm run prices');
        return null;
    }
    const table = data.prices || {};
    let updated = 0;
    const missing = new Set();

    for (const key in caseData) {
        for (const item of caseData[key].items || []) {
            const { base, pattern } = parseName(item.name);
            for (const r of item.rarities || []) {
                const cond = COND[r.short];
                if (!cond) continue;
                const hash = `${base} (${cond})`;
                let hit = null;
                if (pattern) hit = table[hash + '#' + pattern];
                if (!hit && !pattern) hit = table[hash];
                if (!hit && !pattern) hit = table[base]; // facas lisas sem desgaste
                if (hit) { r.price = hit.p; r.float = hit.f != null ? hit.f : null; r.seed = hit.sd != null ? hit.sd : null; updated++; }
                else missing.add(`${item.name} (${r.short})`);
            }
        }
    }

    console.log(`💲 Preços aplicados: ${updated} atualizados | ${missing.size} sem preço (mantêm o valor manual) | ficheiro de ${data.updated_at}`);
    if (missing.size) console.log('   Sem preço (primeiras 15):', [...missing].slice(0, 15).join(' ; '));
    return { updated, missing: [...missing], updated_at: data.updated_at, primary: data.primary };
}

// Recarrega sozinho quando o data/prices.json muda (ex.: depois de correres `npm run prices`)
function watch(onChange) {
    fs.watchFile(FILE, { interval: 5000 }, (cur, prev) => {
        if (cur.mtimeMs && cur.mtimeMs !== prev.mtimeMs) onChange();
    });
}

module.exports = { fetchAndSave, applyPrices, readTable, watch, buildPriceTable, parseName, FILE };