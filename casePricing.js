// casePricing.js — recalcula o preço de cada caixa a partir dos itens que tem lá dentro.
//
// Preço = valor esperado da caixa (EV) / RTP alvo
//   EV  = soma de (probabilidade de cada skin+desgaste × preço dessa skin)
//   RTP = quanto "devolve" em média (0.90 = em média o jogador recebe 90% do que gastou)
//
// Usa as MESMAS probabilidades do rollItem() do server.js (chance relativa ao total da caixa),
// por isso o preço da caixa acompanha sempre os preços atuais das skins (OpenSkin).
// É idempotente: não depende do preço anterior, podes chamar quantas vezes quiseres.

const TARGET_RTP = Number(process.env.CASE_RTP) || 0.90;  // 0.90 = 10% de margem da casa
const MIN_PRICE = 0.10;
const SKIP = new Set(['rank1_reward', 'rank2_reward', 'rank3_reward']); // caixas grátis de recompensa

// arredondamento "bonito" consoante o valor da caixa
function niceRound(p) {
    if (p < 10) return Math.round(p * 100) / 100;      // 1.37
    if (p < 50) return Math.round(p * 10) / 10;        // 18.4
    if (p < 200) return Math.round(p * 2) / 2;         // 62.5
    return Math.round(p);                              // 742
}

function expectedValue(items) {
    let total = 0, sum = 0;
    for (const it of items || []) {
        for (const r of it.rarities || []) {
            const c = Number(r.chance) || 0, p = Number(r.price) || 0;
            total += c;
            sum += c * p;
        }
    }
    return total > 0 ? sum / total : 0;
}

function recalc(caseData, rtp = TARGET_RTP) {
    const changes = [];
    for (const key in caseData) {
        if (SKIP.has(key)) continue;
        const c = caseData[key];
        if (!c || !Array.isArray(c.items) || !c.items.length) continue;

        const ev = expectedValue(c.items);
        if (!(ev > 0)) continue;

        const old = Number(c.price) || 0;
        const next = Math.max(MIN_PRICE, niceRound(ev / rtp));
        c.price = next;
        c.ev = Math.round(ev * 100) / 100; // útil para debug/admin
        if (Math.abs(next - old) >= 0.005) changes.push({ key, name: c.name, old, price: next, ev: c.ev });
    }
    console.log(`📦 Preços das caixas recalculados (RTP alvo ${(rtp * 100).toFixed(0)}%): ${changes.length} alterados`);
    changes.slice(0, 40).forEach(x =>
        console.log(`   ${String(x.name || x.key).padEnd(18)} $${x.old.toFixed(2)} → $${x.price.toFixed(2)}  (EV $${x.ev.toFixed(2)})`));
    return changes;
}

module.exports = { recalc, expectedValue, TARGET_RTP };