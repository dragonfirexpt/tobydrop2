// Uso: npm run prices   (ou: node update-prices.js)
// Vai à OpenSkin 1 vez, cria data/prices.json. Se o servidor estiver a correr, ele recarrega sozinho.
require('./prices').fetchAndSave().catch(e => {
    console.error('❌ Falhou:', e.message);
    process.exit(1);
});