// admin.js — menu secreto de admin + receptor de sons dirigidos.
// Carregar DEPOIS do main.js (usa o `socket` global dele).
// A sequência só ABRE o menu; quem decide se és admin é o servidor (ADMIN_STEAM_IDS).
(() => {
    if (typeof socket === 'undefined') { console.warn('[admin] `socket` não existe — o admin.js tem de carregar DEPOIS do main.js'); return; }
    console.log('[admin] admin.js carregado');

    // Sequência secreta (Konami code). Troca por outra se quiseres.
    const SEQUENCE = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown'];

    // ---------------------------------------------------------------
    // 1) RECEBER SOM (qualquer utilizador; só chega a quem for o alvo)
    // ---------------------------------------------------------------
    let currentAudio = null;

    function stopCurrent() {
        if (currentAudio) {
            try { currentAudio.pause(); currentAudio.currentTime = 0; } catch (e) { /* ignora */ }
            currentAudio = null;
        }
    }

    socket.on('adminSound', (data) => {
        try {
            if (!data || typeof data.url !== 'string' || !data.url.startsWith('/admin-sounds/')) return;
            stopCurrent();
            const a = new Audio(data.url);
            a.volume = Math.min(1, Math.max(0, Number(data.volume)));
            if (Number.isNaN(a.volume)) a.volume = 1;
            currentAudio = a;
            a.play().catch(() => { /* o browser bloqueia áudio antes de haver interação com a página */ });
        } catch (e) { /* ignora */ }
    });
    socket.on('adminStopSound', stopCurrent);

    // ---------------------------------------------------------------
    // 2) MENU DE ADMIN
    // ---------------------------------------------------------------
    const css = `
    .tbd-adm{position:fixed;right:20px;bottom:20px;width:340px;max-width:calc(100vw - 40px);z-index:99999;
        background:#12141c;border:1px solid #2a2f3d;border-radius:12px;box-shadow:0 10px 40px rgba(0,0,0,.6);
        font-family:inherit;color:#e8eaf0;padding:14px;font-size:13px}
    .tbd-adm *{box-sizing:border-box}
    .tbd-adm-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
    .tbd-adm-head b{letter-spacing:2px;color:#ffb703}
    .tbd-adm-x{cursor:pointer;font-size:20px;line-height:1;opacity:.7}
    .tbd-adm-x:hover{opacity:1}
    .tbd-adm input[type=text],.tbd-adm select{width:100%;background:#0b0d13;border:1px solid #2a2f3d;color:#e8eaf0;
        border-radius:8px;padding:9px 10px;margin-bottom:8px;font-size:13px;outline:none}
    .tbd-adm input[type=text]:focus,.tbd-adm select:focus{border-color:#ffb703}
    .tbd-adm-results{max-height:150px;overflow:auto;margin-bottom:8px}
    .tbd-adm-row{display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:8px;cursor:pointer}
    .tbd-adm-row:hover{background:#1b1f2b}
    .tbd-adm-row img{width:24px;height:24px;border-radius:50%}
    .tbd-adm-row small{margin-left:auto;opacity:.6}
    .tbd-adm-dot{width:8px;height:8px;border-radius:50%;background:#555;flex:none}
    .tbd-adm-dot.on{background:#3ddc84}
    .tbd-adm-target{padding:8px 10px;border:1px dashed #2a2f3d;border-radius:8px;margin-bottom:8px;min-height:34px}
    .tbd-adm-vol{display:flex;align-items:center;gap:8px;margin-bottom:10px}
    .tbd-adm-vol input{flex:1}
    .tbd-adm-btns{display:flex;gap:8px}
    .tbd-adm-btns button{flex:1;border:0;border-radius:8px;padding:10px;font-weight:700;cursor:pointer;color:#111}
    .tbd-adm-play{background:#ffb703}
    .tbd-adm-stop{background:#eb4b4b;color:#fff!important}
    .tbd-adm-btns button:disabled{opacity:.4;cursor:not-allowed}
    .tbd-adm-status{margin-top:8px;min-height:16px;opacity:.85}`;

    function el(tag, props, ...kids) {
        const n = document.createElement(tag);
        if (props) Object.assign(n, props);
        kids.forEach(k => n.append(k));
        return n;
    }

    let panel = null;
    let target = null; // { steamId, username }
    let searchTimer = null;

    function closePanel() {
        if (panel) { panel.remove(); panel = null; }
        target = null;
    }

    async function openPanel() {
        if (panel) return closePanel();

        // Pergunta ao servidor se és mesmo admin. Se não fores, não acontece nada.
        console.log('[admin] sequência detetada, a verificar com o servidor…');
        let isAdmin = false;
        try { isAdmin = (await (await fetch('/api/admin/me')).json()).admin; } catch (e) { console.warn('[admin] erro a falar com /api/admin/me', e); }
        if (!isAdmin) {
            console.warn('[admin] o servidor diz que NÃO és admin. Confirma: 1) estás logado, 2) o teu SteamID64 está em ADMIN_STEAM_IDS, 3) reiniciaste o servidor.');
            return;
        }

        if (!document.getElementById('tbd-adm-style')) {
            document.head.append(el('style', { id: 'tbd-adm-style', textContent: css }));
        }

        const search = el('input', { type: 'text', placeholder: 'SteamID64 ou nome…', autocomplete: 'off' });
        const results = el('div', { className: 'tbd-adm-results' });
        const targetBox = el('div', { className: 'tbd-adm-target', textContent: 'Nenhum alvo selecionado' });
        const soundSel = el('select');
        const volLabel = el('span', { textContent: '100%' });
        const vol = el('input', { type: 'range', min: 0, max: 100, value: 100 });
        const playBtn = el('button', { className: 'tbd-adm-play', textContent: '▶ TOCAR', disabled: true });
        const stopBtn = el('button', { className: 'tbd-adm-stop', textContent: '■ PARAR', disabled: true });
        const status = el('div', { className: 'tbd-adm-status' });
        const close = el('span', { className: 'tbd-adm-x', textContent: '×' });

        const refreshButtons = () => {
            const ok = !!target && soundSel.value;
            playBtn.disabled = !ok;
            stopBtn.disabled = !target;
        };

        function pick(u) {
            target = { steamId: u.steamId, username: u.username };
            targetBox.textContent = `🎯 ${u.username} (${u.steamId})`;
            results.replaceChildren();
            status.textContent = '';
            refreshButtons();
        }

        async function doSearch() {
            const q = search.value.trim();
            if (!q) return results.replaceChildren();
            try {
                const users = await (await fetch('/api/admin/find-user?q=' + encodeURIComponent(q))).json();
                results.replaceChildren(...(Array.isArray(users) ? users : []).map(u => {
                    const row = el('div', { className: 'tbd-adm-row' },
                        el('span', { className: 'tbd-adm-dot' + (u.online ? ' on' : '') }),
                        el('img', { src: u.avatar || '', alt: '' }),
                        el('span', { textContent: u.username || '(sem nome)' }),
                        el('small', { textContent: u.online ? 'online' : 'offline' }));
                    row.onclick = () => pick(u);
                    return row;
                }));
                if (!results.children.length) results.textContent = 'Sem resultados';
            } catch (e) { results.textContent = 'Erro na pesquisa'; }
        }

        search.oninput = () => { clearTimeout(searchTimer); searchTimer = setTimeout(doSearch, 250); };
        vol.oninput = () => { volLabel.textContent = vol.value + '%'; };
        soundSel.onchange = refreshButtons;

        async function send(url, body) {
            const r = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            return r.json().catch(() => ({}));
        }

        playBtn.onclick = async () => {
            status.textContent = 'A enviar…';
            const r = await send('/api/admin/play-sound', {
                steamId: target.steamId, sound: soundSel.value, volume: Number(vol.value) / 100
            });
            status.textContent = r.success ? `✅ Enviado (${r.delivered} aba/s)` : `❌ ${r.error || 'Falhou'}`;
        };
        stopBtn.onclick = async () => {
            await send('/api/admin/stop-sound', { steamId: target.steamId });
            status.textContent = '■ Parado';
        };
        close.onclick = closePanel;

        panel = el('div', { className: 'tbd-adm' },
            el('div', { className: 'tbd-adm-head' }, el('b', { textContent: 'ADMIN' }), close),
            search, results, targetBox, soundSel,
            el('div', { className: 'tbd-adm-vol' }, el('span', { textContent: 'Vol' }), vol, volLabel),
            el('div', { className: 'tbd-adm-btns' }, playBtn, stopBtn),
            status);
        document.body.append(panel);
        search.focus();

        try {
            const sounds = await (await fetch('/api/admin/sounds')).json();
            if (sounds.length) {
                soundSel.replaceChildren(...sounds.map(f => el('option', { value: f, textContent: f })));
            } else {
                soundSel.replaceChildren(el('option', { value: '', textContent: 'Sem sons em public/admin-sounds/' }));
            }
        } catch (e) { /* ignora */ }
        refreshButtons();
    }

    // ---------------------------------------------------------------
    // 3) DETETAR A SEQUÊNCIA DE TECLAS
    // ---------------------------------------------------------------
    let progress = 0;
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && panel) return closePanel();

        const t = e.target;
        if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) {
            progress = 0; // não dispara enquanto estás a escrever (chat, pesquisa…)
            return;
        }

        const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
        if (key === SEQUENCE[progress]) {
            progress++;
            if (progress === SEQUENCE.length) { progress = 0; openPanel(); }
        } else {
            progress = key === SEQUENCE[0] ? 1 : 0;
        }
    }, true);
})();