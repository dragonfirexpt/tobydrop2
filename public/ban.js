// ===================== BAN: ecrã do jogador banido + painel de admin =====================
(function () {
    const $ = id => document.getElementById(id);

    // "2d 03:14:09" ou "03:14:09"
    function formatRemaining(ms) {
        const total = Math.max(0, Math.ceil(ms / 1000));
        const d = Math.floor(total / 86400);
        const h = Math.floor((total % 86400) / 3600);
        const m = Math.floor((total % 3600) / 60);
        const s = total % 60;
        const pad = n => String(n).padStart(2, '0');
        return (d > 0 ? d + 'd ' : '') + pad(h) + ':' + pad(m) + ':' + pad(s);
    }

    // "45s", "30 min", "2h", "7d"
    function formatDuration(seconds) {
        if (seconds % 86400 === 0) return (seconds / 86400) + 'd';
        if (seconds % 3600 === 0) return (seconds / 3600) + 'h';
        if (seconds % 60 === 0) return (seconds / 60) + ' min';
        return seconds + 's';
    }

    // ---------- 1. O que o jogador banido vê ----------
    let overlay = null, reasonEl = null, timerEl = null;
    let tickTimer = null;
    let banUntil = 0;     // fim do ban (ms), no relógio do SERVIDOR
    let clockOffset = 0;  // serverNow - Date.now(): corrige relógios de PC mal acertados
    let lastText = '';

    function buildOverlay() {
        const el = document.createElement('div');
        el.id = 'ban-overlay';
        el.innerHTML =
            '<div class="ban-box">' +
                '<svg class="ban-icon" viewBox="0 0 24 24" width="54" height="54" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                    '<circle cx="12" cy="12" r="10"></circle><line x1="4.9" y1="4.9" x2="19.1" y2="19.1"></line>' +
                '</svg>' +
                '<h2 class="ban-title">YOU HAVE BEEN BANNED</h2>' +
                '<div class="ban-sub">You can\'t play or chat until the timer runs out.</div>' +
                '<div class="ban-label">REASON</div>' +
                '<div class="ban-reason" id="ban-reason"></div>' +
                '<div class="ban-label">TIME REMAINING</div>' +
                '<div class="ban-timer" id="ban-timer">--:--:--</div>' +
            '</div>';
        document.body.appendChild(el);
        reasonEl = el.querySelector('#ban-reason');
        timerEl = el.querySelector('#ban-timer');
        return el;
    }

    function hideBan() {
        clearInterval(tickTimer);
        tickTimer = null;
        if (overlay) overlay.classList.remove('show');
        document.body.classList.remove('is-banned');
    }

    function renderTick() {
        const left = banUntil - (Date.now() + clockOffset);
        if (left <= 0) { hideBan(); return; }   // acabou: o servidor também avisa, mas não esperamos por ele
        const text = formatRemaining(left);
        if (text !== lastText) {
            timerEl.textContent = text;
            lastText = text;
        }
    }

    function showBan(data) {
        if (!overlay) overlay = buildOverlay();
        banUntil = Number(data.until);
        clockOffset = (Number(data.serverNow) || Date.now()) - Date.now();
        reasonEl.textContent = data.reason || 'No reason provided';   // textContent: nunca HTML
        lastText = '';
        overlay.classList.add('show');
        document.body.classList.add('is-banned');

        clearInterval(tickTimer);
        tickTimer = null;
        renderTick();
        if (overlay.classList.contains('show')) tickTimer = setInterval(renderTick, 250);
    }

    if (typeof socket !== 'undefined') {
        // O servidor envia isto ao ligar/reconectar, quando és banido e quando o ban acaba ou é removido
        socket.on('banStatus', data => {
            if (data && data.banned) showBan(data);
            else hideBan();
        });
    }

    // ---------- 2. Painel de admin (Settings) ----------
    let adminPromise = null;
    function isAdmin() {
        if (!adminPromise) {
            adminPromise = fetch('/api/admin/me').then(r => r.json()).then(d => !!d.admin).catch(() => false);
        }
        return adminPromise;
    }

    let selected = null;       // { steamId, username, ... }
    let searchTimer = null;
    let leftTimer = null;

    function setMsg(text, isError) {
        const el = $('aban-msg');
        if (!el) return;
        el.textContent = text || '';
        el.className = 'aban-msg' + (text ? (isError ? ' err' : ' ok') : '');
    }

    async function loadPlayers(q) {
        const list = $('aban-list');
        if (!list) return;
        try {
            const res = await fetch('/api/admin/users?q=' + encodeURIComponent(q || ''));
            if (!res.ok) return;
            const users = await res.json();

            list.innerHTML = '';
            if (!users.length) {
                const none = document.createElement('div');
                none.className = 'abh-none';
                none.textContent = 'No players found.';
                list.appendChild(none);
                return;
            }
            users.forEach(u => {
                const row = document.createElement('div');
                row.className = 'abh-row' + (selected && selected.steamId === u.steamId ? ' active' : '');
                row.dataset.steamid = u.steamId;

                const img = document.createElement('img');
                img.src = u.avatar || '';
                const name = document.createElement('span');
                name.className = 'abh-name';
                name.textContent = u.username || u.steamId;
                row.appendChild(img);
                row.appendChild(name);
                if (u.banned) {
                    const tag = document.createElement('span');
                    tag.className = 'abh-banned';
                    tag.textContent = 'BANNED';
                    row.appendChild(tag);
                }
                if (u.online) {
                    const dot = document.createElement('span');
                    dot.className = 'abh-dot';
                    dot.title = 'Online';
                    row.appendChild(dot);
                }
                row.onclick = () => selectPlayer(u);
                list.appendChild(row);
            });
        } catch (e) {
            console.log('Erro ao listar jogadores:', e);
        }
    }

    function selectPlayer(u) {
        selected = u;
        document.querySelectorAll('#aban-list .abh-row').forEach(r => {
            r.classList.toggle('active', r.dataset.steamid === u.steamId);
        });
        const label = $('aban-selected');
        label.textContent = 'Banning: ';
        const b = document.createElement('b');
        b.textContent = u.username || u.steamId;
        label.appendChild(b);
        $('aban-form').style.display = 'block';
        setMsg('');
    }

    async function submitBan() {
        if (!selected) return;
        const amount = Number($('aban-amount').value);
        const unit = Number($('aban-unit').value);
        const seconds = Math.round(amount * unit);
        const reason = $('aban-reason').value.trim();
        if (!(seconds >= 1)) return setMsg('Enter a valid duration.', true);

        const btn = $('aban-btn');
        btn.disabled = true;
        try {
            const res = await fetch('/api/admin/ban', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ steamId: selected.steamId, seconds, reason })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.success) {
                setMsg(data.error || 'Could not apply the ban.', true);
            } else {
                setMsg((selected.username || selected.steamId) + ' banned for ' + formatDuration(seconds) + '.', false);
                $('aban-reason').value = '';
                loadPlayers($('aban-search').value);
                loadActiveBans();
            }
        } catch (e) {
            setMsg('Network error.', true);
        } finally {
            btn.disabled = false;
        }
    }

    async function unban(steamId) {
        try {
            const res = await fetch('/api/admin/unban', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ steamId })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.success) return setMsg(data.error || 'Could not remove the ban.', true);
            setMsg('Ban removed.', false);
            loadPlayers($('aban-search').value);
            loadActiveBans();
        } catch (e) {
            setMsg('Network error.', true);
        }
    }

    async function loadActiveBans() {
        const list = $('aban-active');
        if (!list) return;
        try {
            const res = await fetch('/api/admin/bans');
            if (!res.ok) return;
            const bans = await res.json();

            list.innerHTML = '';
            if (!bans.length) {
                const none = document.createElement('div');
                none.className = 'abh-none';
                none.textContent = 'No active bans.';
                list.appendChild(none);
                return;
            }
            bans.forEach(b => {
                const row = document.createElement('div');
                row.className = 'abh-row aban-item';

                const img = document.createElement('img');
                img.src = b.avatar || '';
                const info = document.createElement('div');
                info.className = 'aban-info';
                const name = document.createElement('span');
                name.className = 'abh-name';
                name.textContent = b.username || b.steamId;
                const why = document.createElement('span');
                why.className = 'aban-why';
                why.textContent = b.reason || '';
                info.appendChild(name);
                info.appendChild(why);

                const left = document.createElement('span');
                left.className = 'aban-left';
                left.dataset.until = b.until;
                left.textContent = formatRemaining(b.until - Date.now());

                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'aban-unban';
                btn.textContent = 'UNBAN';
                btn.onclick = () => unban(b.steamId);

                row.appendChild(img);
                row.appendChild(info);
                row.appendChild(left);
                row.appendChild(btn);
                list.appendChild(row);
            });
        } catch (e) {
            console.log('Erro ao listar bans:', e);
        }
    }

    // Atualiza o "tempo restante" da lista de bans ativos a cada segundo
    function startLeftTicker() {
        if (leftTimer) return;
        leftTimer = setInterval(() => {
            let expired = false;
            document.querySelectorAll('#aban-active .aban-left').forEach(el => {
                const left = Number(el.dataset.until) - Date.now();
                if (left <= 0) expired = true;
                else el.textContent = formatRemaining(left);
            });
            if (expired) { loadActiveBans(); loadPlayers($('aban-search').value); }
        }, 1000);
    }

    // Chamado pelo main.js sempre que abres a aba Settings
    async function initAdminBanCard() {
        const card = $('admin-ban-card');
        if (!card) return;
        if (!(await isAdmin())) { card.style.display = 'none'; return; }
        card.style.display = 'block';

        if (!card.dataset.ready) {
            card.dataset.ready = '1';
            const input = $('aban-search');
            input.addEventListener('input', () => {
                clearTimeout(searchTimer);
                searchTimer = setTimeout(() => loadPlayers(input.value), 250);
            });
            $('aban-btn').addEventListener('click', submitBan);
            $('aban-reason').addEventListener('keydown', e => { if (e.key === 'Enter') submitBan(); });
            startLeftTicker();
        }
        loadPlayers($('aban-search').value);
        loadActiveBans();
    }
    window.initAdminBanCard = initAdminBanCard;
})();