const { ipcRenderer } = require('electron');

// ===== STAN APLIKACJI =====
let currentStatus = { isRunning: false, isPaused: false };
let accounts = [];       // Lista kont z cookies
let proxyList = [];      // Lista dostępnych proxy
let csvData = null;      // Załadowane dane CSV

// ===== INICJALIZACJA =====
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    setupNavigation();
    setupEventListeners();
    setupIpcListeners();
    loadAllData();
});

function initializeApp() {
    document.getElementById('copyrightYear').textContent = new Date().getFullYear();
}

function setupNavigation() {
    const navButtons = document.querySelectorAll('.nav-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.dataset.tab;
            navButtons.forEach(b => b.classList.remove('active'));
            tabContents.forEach(t => t.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(tabName).classList.add('active');
        });
    });
}

// ===== ŁADOWANIE DANYCH =====
async function loadAllData() {
    await loadAccounts();
    await loadProxyList();
    await loadProxyConfig();
    await loadCredentials();
    renderAccountsList();
    updatePreStartStatus();
}

async function loadAccounts() {
    try {
        const savedAccounts = await ipcRenderer.invoke('get-all-accounts');
        accounts = Array.isArray(savedAccounts) ? savedAccounts : [];
        console.log('Loaded accounts:', accounts.length);
    } catch (e) {
        console.error('Error loading accounts:', e);
        accounts = [];
    }
}

async function loadProxyList() {
    try {
        proxyList = await ipcRenderer.invoke('get-proxy-list') || [];
        console.log('Loaded proxies:', proxyList.length);
    } catch (e) {
        console.error('Error loading proxy list:', e);
        proxyList = [];
    }
}

async function loadProxyConfig() {
    try {
        const config = await ipcRenderer.invoke('get-proxy');
        if (config && config.enabled) {
            document.getElementById('proxyEnabled').checked = true;
            document.getElementById('proxyConfig').style.display = 'block';
            document.getElementById('proxyHost').value = config.host || '';
            document.getElementById('proxyPort').value = config.port || '';
            document.getElementById('proxyUsername').value = config.username || '';
            document.getElementById('proxyPassword').value = config.password || '';
        }
    } catch (e) {
        console.error('Error loading proxy config:', e);
    }
}

async function loadCredentials() {
    try {
        const creds = await ipcRenderer.invoke('get-credentials');
        if (creds) {
            document.getElementById('email').value = creds.email || '';
            document.getElementById('password').value = creds.password || '';
        }
    } catch (e) {
        console.error('Error loading credentials:', e);
    }
}

// ===== ZARZĄDZANIE KONTAMI =====
function renderAccountsList() {
    const container = document.getElementById('accountsList');
    if (!container) return;

    container.innerHTML = '';

    if (accounts.length === 0) {
        // Dodaj jedno puste konto
        accounts.push({
            id: generateId(),
            name: 'Konto #1',
            cookies: '',
            proxyId: null,
            status: 'unknown'
        });
    }

    accounts.forEach((account, index) => {
        const div = document.createElement('div');
        div.className = 'account-item';
        div.dataset.accountId = account.id;
        div.style.cssText = 'background: #1a1a1a; padding: 15px; border-radius: 8px; margin-bottom: 10px; border: 1px solid #333;';

        const statusIcon = account.status === 'valid' ? '✅' :
                          account.status === 'invalid' ? '❌' : '⏳';

        div.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span class="account-status" style="font-size: 18px;">${statusIcon}</span>
                    <input type="text" class="account-name" value="${account.name || `Konto #${index + 1}`}"
                           style="background: transparent; border: none; color: #00ff88; font-weight: bold; font-size: 14px; width: 150px;">
                </div>
                <div style="display: flex; gap: 5px;">
                    <select class="account-proxy" style="padding: 5px; font-size: 11px; background: #222; border: 1px solid #444; color: #fff; border-radius: 3px;">
                        <option value="">🔓 Bez proxy</option>
                        ${proxyList.map(p => `<option value="${p.id}" ${account.proxyId === p.id ? 'selected' : ''}>🌐 ${p.name || p.host}</option>`).join('')}
                    </select>
                    <button class="btn btn-danger btn-sm remove-account-btn" style="padding: 5px 10px; font-size: 11px;">🗑️</button>
                </div>
            </div>
            <textarea class="account-cookies" rows="3" style="font-size: 11px; font-family: monospace; width: 100%; padding: 8px; background: #222; border: 1px solid #444; color: #fff; border-radius: 4px;"
                placeholder='[{"name":"c_user","value":"xxx","domain":".facebook.com"}]'>${account.cookies || ''}</textarea>
        `;

        container.appendChild(div);

        // Event listeners
        div.querySelector('.remove-account-btn').addEventListener('click', () => {
            accounts = accounts.filter(a => a.id !== account.id);
            renderAccountsList();
            updatePreStartStatus();
        });

        div.querySelector('.account-name').addEventListener('change', (e) => {
            account.name = e.target.value;
        });

        div.querySelector('.account-proxy').addEventListener('change', (e) => {
            account.proxyId = e.target.value || null;
        });

        div.querySelector('.account-cookies').addEventListener('input', (e) => {
            account.cookies = e.target.value;
            updatePreStartStatus();
        });
    });
}

function generateId() {
    return 'acc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// ===== EVENT LISTENERS =====
function setupEventListeners() {
    // === LOGOWANIE ===
    document.getElementById('credentialsForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const result = await ipcRenderer.invoke('save-credentials', { email, password });
        showToast(result.success ? 'Dane zapisane' : result.error, result.success ? 'success' : 'error');
    });

    document.getElementById('testLoginBtn')?.addEventListener('click', async () => {
        const btn = document.getElementById('testLoginBtn');
        btn.disabled = true;
        btn.textContent = '⏳ Testuję...';
        const result = await ipcRenderer.invoke('test-login', {
            email: document.getElementById('email').value,
            password: document.getElementById('password').value
        });
        btn.disabled = false;
        btn.textContent = '🔍 Testuj logowanie';
        showToast(result.success ? 'Logowanie OK!' : result.error, result.success ? 'success' : 'error');
    });

    // === KONTA ===
    document.getElementById('addAccountBtn')?.addEventListener('click', () => {
        accounts.push({
            id: generateId(),
            name: `Konto #${accounts.length + 1}`,
            cookies: '',
            proxyId: null,
            status: 'unknown'
        });
        renderAccountsList();
        updatePreStartStatus();
    });

    document.getElementById('saveAllAccountsBtn')?.addEventListener('click', async () => {
        // Aktualizuj dane z formularza
        syncAccountsFromDOM();

        const validAccounts = accounts.filter(a => a.cookies && a.cookies.trim());
        if (validAccounts.length === 0) {
            showToast('Dodaj przynajmniej jedno konto z cookies', 'error');
            return;
        }

        // Sprawdź JSON
        for (const acc of validAccounts) {
            try {
                JSON.parse(acc.cookies);
            } catch (e) {
                showToast(`Błąd JSON w "${acc.name}"`, 'error');
                return;
            }
        }

        await ipcRenderer.invoke('save-all-accounts', validAccounts);
        showToast(`✅ Zapisano ${validAccounts.length} kont`, 'success');
    });

    document.getElementById('validateAllAccountsBtn')?.addEventListener('click', async () => {
        syncAccountsFromDOM();
        showToast('Sprawdzam cookies...', 'info');

        let validCount = 0;
        for (const account of accounts) {
            if (!account.cookies || !account.cookies.trim()) {
                account.status = 'invalid';
                continue;
            }

            try {
                const result = await ipcRenderer.invoke('validate-cookies', account.cookies);
                account.status = result.valid ? 'valid' : 'invalid';
                if (result.valid) validCount++;
            } catch (e) {
                account.status = 'invalid';
            }
        }

        renderAccountsList();
        updatePreStartStatus();
        showToast(`Sprawdzono: ${validCount} ważnych kont`, validCount > 0 ? 'success' : 'warning');
    });

    // === ŹRÓDŁO POSTÓW (CSV vs Ręcznie) ===
    document.querySelectorAll('.posting-source-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const source = tab.dataset.source;
            document.querySelectorAll('.posting-source-tab').forEach(t => {
                t.classList.remove('active', 'btn-primary');
                t.classList.add('btn-secondary');
            });
            tab.classList.add('active', 'btn-primary');
            tab.classList.remove('btn-secondary');

            document.getElementById('postingSourceCsv').style.display = source === 'csv' ? 'block' : 'none';
            document.getElementById('postingSourceManual').style.display = source === 'manual' ? 'block' : 'none';
            updatePreStartStatus();
        });
    });

    // === CSV ===
    document.getElementById('loadCsvBtn')?.addEventListener('click', loadCsvFile);

    // === POSTOWANIE ===
    document.getElementById('startPostingBtn')?.addEventListener('click', startPosting);
    document.getElementById('stopPostingBtn')?.addEventListener('click', stopPosting);

    // === PROXY ===
    document.getElementById('proxyEnabled')?.addEventListener('change', (e) => {
        document.getElementById('proxyConfig').style.display = e.target.checked ? 'block' : 'none';
    });

    document.getElementById('saveProxyBtn')?.addEventListener('click', saveProxy);
    document.getElementById('testProxyBtn')?.addEventListener('click', testProxy);

    // === LOGI ===
    document.getElementById('clearLogsBtn')?.addEventListener('click', () => {
        if (confirm('Wyczyścić logi?')) {
            document.getElementById('logsContainer').innerHTML = '';
        }
    });

    document.getElementById('clearPostingLogsBtn')?.addEventListener('click', () => {
        const container = document.getElementById('postingLogsContainer');
        if (container) {
            container.innerHTML = '<p style="color: #666;">Logi pojawią się tutaj po rozpoczęciu postowania...</p>';
        }
    });

    document.getElementById('exportLogsBtn')?.addEventListener('click', () => {
        const logs = document.getElementById('logsContainer').innerText;
        const blob = new Blob([logs], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `logs-${Date.now()}.txt`;
        a.click();
    });

    // === HARMONOGRAM ===
    document.getElementById('addScheduleBtn')?.addEventListener('click', () => {
        document.getElementById('scheduleModal').style.display = 'flex';
    });

    document.getElementById('closeScheduleModal')?.addEventListener('click', () => {
        document.getElementById('scheduleModal').style.display = 'none';
    });

    document.getElementById('cancelSchedule')?.addEventListener('click', () => {
        document.getElementById('scheduleModal').style.display = 'none';
    });

    // === AKTUALIZACJA STATUSU ===
    document.getElementById('groupsList')?.addEventListener('input', updatePreStartStatus);
    document.getElementById('postMessage')?.addEventListener('input', updatePreStartStatus);
}

// Synchronizuj dane kont z DOM
function syncAccountsFromDOM() {
    const items = document.querySelectorAll('.account-item');
    items.forEach(item => {
        const id = item.dataset.accountId;
        const account = accounts.find(a => a.id === id);
        if (account) {
            account.name = item.querySelector('.account-name')?.value || account.name;
            account.cookies = item.querySelector('.account-cookies')?.value || '';
            account.proxyId = item.querySelector('.account-proxy')?.value || null;
        }
    });
}

// ===== POSTOWANIE =====
async function startPosting() {
    syncAccountsFromDOM();

    // Pobierz konta z cookies
    const accountsWithCookies = accounts.filter(a => a.cookies && a.cookies.trim());

    if (accountsWithCookies.length === 0) {
        showToast('Dodaj przynajmniej jedno konto z cookies', 'error');
        return;
    }

    // Waliduj JSON
    for (const acc of accountsWithCookies) {
        try {
            JSON.parse(acc.cookies);
        } catch (e) {
            showToast(`Błąd JSON w "${acc.name}"`, 'error');
            return;
        }
    }

    // Pobierz posty
    let posts = [];
    const csvActive = document.querySelector('.posting-source-tab[data-source="csv"]')?.classList.contains('active');

    if (csvActive && csvData && csvData.length > 0) {
        posts = csvData;
    } else {
        const message = document.getElementById('postMessage')?.value?.trim();
        const groupsList = document.getElementById('groupsList')?.value?.trim();

        if (!message || !groupsList) {
            showToast('Wypełnij treść posta i listę grup', 'error');
            return;
        }

        const groups = groupsList.split('\n').filter(g => g.trim());
        posts = groups.map(g => ({ groupLink: g.trim(), postCopy: message }));
    }

    if (posts.length === 0) {
        showToast('Brak postów do opublikowania', 'error');
        return;
    }

    // Wyłącz przyciski
    document.getElementById('startPostingBtn').disabled = true;
    document.getElementById('stopPostingBtn').disabled = false;
    document.getElementById('progressInfo').style.display = 'block';

    showToast(`🚀 Uruchamiam ${accountsWithCookies.length} kont z ${posts.length} postami`, 'info');

    try {
        // Wyczyść logi postowania
        const logsContainer = document.getElementById('postingLogsContainer');
        if (logsContainer) {
            logsContainer.innerHTML = '';
        }

        const result = await ipcRenderer.invoke('start-posting-multi', {
            posts: posts,
            accounts: accountsWithCookies.map(a => ({
                id: a.id,
                name: a.name,
                cookies: a.cookies,
                proxyId: a.proxyId
            }))
            // Delay automatyczny 4-18 min - ustawiany w automation-manager
        });

        if (result.success) {
            showToast('✅ Postowanie zakończone!', 'success');
        } else {
            showToast(`Błąd: ${result.error}`, 'error');
        }
    } catch (e) {
        showToast(`Błąd: ${e.message}`, 'error');
    } finally {
        document.getElementById('startPostingBtn').disabled = false;
        document.getElementById('stopPostingBtn').disabled = true;
    }
}

async function stopPosting() {
    const result = await ipcRenderer.invoke('stop-posting');
    if (result.success) {
        showToast('⏹️ Zatrzymano', 'warning');
        document.getElementById('startPostingBtn').disabled = false;
        document.getElementById('stopPostingBtn').disabled = true;
    }
}

// ===== CSV =====
function loadCsvFile() {
    const fileInput = document.getElementById('csvFileInput');
    const file = fileInput?.files?.[0];

    if (!file) {
        showToast('Wybierz plik CSV', 'error');
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const text = e.target.result;

            // Lepszy parser CSV obsługujący wieloliniowe wartości w cudzysłowach
            const parseCSV = (csvText) => {
                const rows = [];
                let currentRow = [];
                let currentField = '';
                let inQuotes = false;

                for (let i = 0; i < csvText.length; i++) {
                    const char = csvText[i];
                    const nextChar = csvText[i + 1];

                    if (inQuotes) {
                        if (char === '"' && nextChar === '"') {
                            // Escaped quote
                            currentField += '"';
                            i++;
                        } else if (char === '"') {
                            // End of quoted field
                            inQuotes = false;
                        } else {
                            currentField += char;
                        }
                    } else {
                        if (char === '"') {
                            inQuotes = true;
                        } else if (char === ',') {
                            currentRow.push(currentField.trim());
                            currentField = '';
                        } else if (char === '\n' || (char === '\r' && nextChar === '\n')) {
                            currentRow.push(currentField.trim());
                            if (currentRow.some(f => f)) { // Skip empty rows
                                rows.push(currentRow);
                            }
                            currentRow = [];
                            currentField = '';
                            if (char === '\r') i++; // Skip \n in \r\n
                        } else if (char !== '\r') {
                            currentField += char;
                        }
                    }
                }

                // Last field/row
                if (currentField || currentRow.length > 0) {
                    currentRow.push(currentField.trim());
                    if (currentRow.some(f => f)) {
                        rows.push(currentRow);
                    }
                }

                return rows;
            };

            const rows = parseCSV(text);

            if (rows.length < 2) {
                showToast('CSV jest pusty', 'error');
                return;
            }

            const headers = rows[0].map(h => h.toLowerCase().trim());
            const groupLinkIdx = headers.indexOf('group_link');
            const postCopyIdx = headers.indexOf('post_copy');

            if (groupLinkIdx === -1 || postCopyIdx === -1) {
                showToast('CSV musi zawierać kolumny: group_link i post_copy', 'error');
                console.log('Headers found:', headers);
                return;
            }

            const posts = [];
            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                const groupLink = row[groupLinkIdx]?.trim();
                const postCopy = row[postCopyIdx]?.trim();

                // Sprawdź czy to prawidłowy link do grupy FB
                if (groupLink && postCopy && groupLink.includes('facebook.com/groups')) {
                    posts.push({ groupLink, postCopy });
                }
            }

            if (posts.length === 0) {
                showToast('Nie znaleziono prawidłowych postów', 'error');
                return;
            }

            csvData = posts;
            document.getElementById('csvPreview').style.display = 'block';
            document.getElementById('csvStats').textContent = `${posts.length} postów do ${new Set(posts.map(p => p.groupLink)).size} grup`;
            showToast(`✅ Załadowano ${posts.length} postów`, 'success');
            updatePreStartStatus();

        } catch (err) {
            showToast(`Błąd CSV: ${err.message}`, 'error');
            console.error('CSV parse error:', err);
        }
    };
    reader.readAsText(file);
}

// ===== STATUS =====
function updatePreStartStatus() {
    syncAccountsFromDOM();

    const validAccounts = accounts.filter(a => {
        if (!a.cookies || !a.cookies.trim()) return false;
        try {
            JSON.parse(a.cookies);
            return true;
        } catch { return false; }
    });

    let postsCount = 0;
    const csvActive = document.querySelector('.posting-source-tab[data-source="csv"]')?.classList.contains('active');

    if (csvActive && csvData) {
        postsCount = csvData.length;
    } else {
        const groups = document.getElementById('groupsList')?.value?.trim();
        if (groups) postsCount = groups.split('\n').filter(g => g.trim()).length;
    }

    document.getElementById('validAccountsCount').textContent = validAccounts.length;
    document.getElementById('postsToPublishCount').textContent = postsCount;
    document.getElementById('postsPerAccountCount').textContent =
        validAccounts.length > 0 && postsCount > 0
            ? `~${Math.ceil(postsCount / validAccounts.length)}`
            : '-';
}

// ===== PROXY =====
async function saveProxy() {
    const config = {
        enabled: document.getElementById('proxyEnabled').checked,
        host: document.getElementById('proxyHost').value.trim(),
        port: document.getElementById('proxyPort').value.trim(),
        username: document.getElementById('proxyUsername').value.trim(),
        password: document.getElementById('proxyPassword').value.trim()
    };

    // Jeśli enabled, dodaj też do listy proxy
    if (config.enabled && config.host && config.port) {
        const newProxy = {
            id: 'proxy_' + Date.now(),
            name: `${config.host}:${config.port}`,
            host: config.host,
            port: config.port,
            username: config.username,
            password: config.password
        };
        await ipcRenderer.invoke('add-proxy', newProxy);
        await loadProxyList();
        renderAccountsList();
    }

    const result = await ipcRenderer.invoke('save-proxy', config);
    showToast(result.success ? 'Proxy zapisane' : result.error, result.success ? 'success' : 'error');
}

async function testProxy() {
    const config = {
        host: document.getElementById('proxyHost').value.trim(),
        port: document.getElementById('proxyPort').value.trim(),
        username: document.getElementById('proxyUsername').value.trim(),
        password: document.getElementById('proxyPassword').value.trim()
    };

    if (!config.host || !config.port) {
        showToast('Podaj host i port proxy', 'error');
        return;
    }

    showToast('Testuję proxy...', 'info');
    const result = await ipcRenderer.invoke('test-proxy', config);
    showToast(result.success ? '✅ Proxy działa!' : `❌ ${result.error || 'Proxy nie działa'}`, result.success ? 'success' : 'error');
}

// ===== IPC LISTENERS =====
function setupIpcListeners() {
    ipcRenderer.on('status-update', (event, status) => {
        currentStatus = status;
        updateStatusIndicator();
    });

    ipcRenderer.on('new-log', (event, log) => {
        addLogEntry(log);
        // Dodaj też do logów postowania jeśli dotyczy postowania
        addPostingLogEntry(log);
    });

    ipcRenderer.on('notification', (event, data) => {
        showToast(data.title, data.body);
    });

    ipcRenderer.on('verification-required', (event, data) => {
        showToast('⚠️ WERYFIKACJA!', data.message, 'warning');
    });

    ipcRenderer.on('facebook-block-detected', (event, data) => {
        showToast('🚫 ZABLOKOWANO!', data.message, 'error');
    });
}

// Dodaj log do sekcji postowania
function addPostingLogEntry(log) {
    const container = document.getElementById('postingLogsContainer');
    if (!container) return;

    // Usuń placeholder jeśli jest
    const placeholder = container.querySelector('p');
    if (placeholder && placeholder.textContent.includes('Logi pojawią się')) {
        placeholder.remove();
    }

    const entry = document.createElement('div');
    entry.style.marginBottom = '5px';
    entry.style.padding = '3px 0';
    entry.style.borderBottom = '1px solid #222';

    const timestamp = new Date(log.timestamp).toLocaleTimeString('pl-PL');
    const colors = {
        'info': '#4a9eff',
        'success': '#00ff88',
        'warning': '#ffaa00',
        'error': '#ff4444'
    };
    const color = colors[log.type] || '#888';

    entry.innerHTML = `<span style="color: #666;">[${timestamp}]</span> <span style="color: ${color};">${log.message}</span>`;
    container.appendChild(entry);
    container.scrollTop = container.scrollHeight;
}

function updateStatusIndicator() {
    const dot = document.getElementById('statusDot');
    const text = document.getElementById('statusText');

    dot.className = 'status-dot';

    if (currentStatus.isRunning) {
        if (currentStatus.isPaused) {
            dot.classList.add('paused');
            text.textContent = 'Wstrzymany';
        } else {
            dot.classList.add('active');
            text.textContent = 'Aktywny';
        }
    } else {
        text.textContent = 'Nieaktywny';
    }
}

function addLogEntry(log) {
    const container = document.getElementById('logsContainer');
    if (!container) return;

    const entry = document.createElement('div');
    entry.className = `log-entry ${log.type || 'info'}`;
    const timestamp = new Date(log.timestamp).toLocaleString('pl-PL');
    entry.innerHTML = `<span class="log-timestamp">[${timestamp}]</span> ${log.message}`;
    container.appendChild(entry);
    container.scrollTop = container.scrollHeight;
}

// ===== TOAST =====
function showToast(title, message, type = 'info') {
    // Obsługa starego formatu (2 argumenty)
    if (arguments.length === 2 && typeof message === 'string' && ['success', 'error', 'warning', 'info'].includes(message)) {
        type = message;
        message = title;
        title = '';
    }

    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = title ? `<div class="toast-title">${title}</div><div class="toast-message">${message}</div>` : `<div class="toast-message">${message}</div>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s';
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}

// Expose for global access
window.showToast = showToast;
