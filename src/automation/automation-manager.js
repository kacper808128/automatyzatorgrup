/**
 * Automation Manager - Anti-Ban Stack 2025
 *
 * ZMIANY W TEJ WERSJI:
 * - PLAYWRIGHT zamiast Puppeteer (pełna migracja!)
 * - Pełny fingerprint spoofing (Canvas, WebGL, Audio, WebRTC, Chrome.runtime)
 * - Bezier curves dla ruchu myszki
 * - Delaye 4-18 minut między grupami (nie 60-90 sekund!)
 * - Limity aktywności i tryb warming
 * - Auto-pauza przy zbyt wielu banach
 */

const { chromium } = require('playwright');
const CryptoJS = require('crypto-js');
const EventEmitter = require('events');
const {
  randomDelay,
  randomTyping,
  getRandomUserAgent,
  HumanMouse,
  HumanTyping,
  HumanScroll,
  boundedGaussian,
  engageWithGroup,
  postPublishEngagement,
  performHumanError,
} = require('../utils/human-behavior');
const { ProxyManager, STICKY_SESSION_CONFIG } = require('../utils/proxy-manager');
const { FingerprintManager } = require('../utils/fingerprint-manager');
const { ActivityLimiter, LIMITS } = require('../utils/activity-limiter');

class AutomationManager extends EventEmitter {
  constructor(store) {
    super();
    this.store = store;
    this.browser = null;
    this.context = null; // Playwright context
    this.page = null;
    this.isRunning = false;
    this.isPaused = false;
    this.shouldStop = false; // Flaga do przerwania automatyzacji
    this.currentTask = null;
    this.logs = [];
    this.proxyManager = new ProxyManager();
    this.encryptionKey = 'fb-automation-secret-key-2024';

    // Anti-Ban Stack 2025
    this.fingerprintManager = new FingerprintManager();
    this.activityLimiter = new ActivityLimiter(store);
    this.postsSinceHumanError = 0;
    this.currentFingerprint = null;

    // Proxy management - obsługa wielu proxy
    this.proxyList = store.get('proxyList', []);

    // Storage state paths (dla storageState zamiast addCookies)
    this.storageStatePath = null;

    // Cookie refresh tracking
    this.cookieRefreshConfig = {
      refreshIntervalDays: 5, // 3-7 dni
      minRefreshDays: 3,
      maxRefreshDays: 7,
    };

    // Screenshot on errors
    this.screenshotsDir = require('path').join(
      require('os').homedir(),
      '.automatyzator-grup',
      'screenshots'
    );
    this.ensureScreenshotsDir();

    // Concurrent accounts limit
    this.maxConcurrentAccounts = 5;
    this.activeAccountTasks = new Map(); // accountId -> Promise
  }

  /**
   * Tworzy folder na screenshoty jeśli nie istnieje
   */
  ensureScreenshotsDir() {
    const fs = require('fs');
    if (!fs.existsSync(this.screenshotsDir)) {
      fs.mkdirSync(this.screenshotsDir, { recursive: true });
    }
  }

  /**
   * Zapisuje screenshot błędu
   * @param {Page} page - Playwright page
   * @param {string} errorType - Typ błędu
   * @param {string} accountId - ID konta (opcjonalne)
   * @returns {string} Ścieżka do screenshota
   */
  async captureErrorScreenshot(page, errorType, accountId = 'unknown') {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `error_${errorType}_${accountId}_${timestamp}.png`;
      const filepath = require('path').join(this.screenshotsDir, filename);

      await page.screenshot({ path: filepath, fullPage: true });
      this.addLog(`📸 Screenshot zapisany: ${filename}`, 'info');
      return filepath;
    } catch (err) {
      this.addLog(`⚠️ Nie udało się zapisać screenshota: ${err.message}`, 'warning');
      return null;
    }
  }

  // =============================================
  // COOKIE VALIDATION - sprawdzanie ważności cookies
  // =============================================

  /**
   * Sprawdza czy cookies są ważne (zawierają wymagane tokeny FB)
   * @param {string|Array} cookies - JSON string lub array cookies
   * @returns {Object} { valid: boolean, reason: string, expiresIn?: number }
   */
  validateCookies(cookies) {
    try {
      const cookieArray = typeof cookies === 'string' ? JSON.parse(cookies) : cookies;

      if (!cookieArray || !Array.isArray(cookieArray) || cookieArray.length === 0) {
        return { valid: false, reason: 'Brak cookies' };
      }

      // Kluczowe cookies Facebook
      const requiredCookies = {
        'c_user': null,  // User ID - najważniejszy
        'xs': null,      // Session token - najważniejszy
        'datr': null,    // Device token
      };

      const now = Date.now() / 1000; // Current time in seconds
      let earliestExpiry = Infinity;

      for (const cookie of cookieArray) {
        if (requiredCookies.hasOwnProperty(cookie.name)) {
          requiredCookies[cookie.name] = cookie;

          // Sprawdź expiry
          const expiry = cookie.expirationDate || cookie.expires;
          if (expiry && expiry < earliestExpiry) {
            earliestExpiry = expiry;
          }
        }
      }

      // Sprawdź czy mamy c_user i xs (minimalne wymagania)
      if (!requiredCookies['c_user'] || !requiredCookies['c_user'].value) {
        return { valid: false, reason: 'Brak cookie c_user (User ID)' };
      }

      if (!requiredCookies['xs'] || !requiredCookies['xs'].value) {
        return { valid: false, reason: 'Brak cookie xs (Session token)' };
      }

      // Sprawdź czy cookies nie wygasły
      if (earliestExpiry !== Infinity && earliestExpiry < now) {
        return { valid: false, reason: 'Cookies wygasły' };
      }

      // Oblicz ile dni do wygaśnięcia
      let expiresInDays = null;
      if (earliestExpiry !== Infinity) {
        expiresInDays = Math.floor((earliestExpiry - now) / 86400);
      }

      // Ostrzeżenie jeśli cookies wygasają w ciągu 7 dni
      if (expiresInDays !== null && expiresInDays < 7) {
        return {
          valid: true,
          reason: `Cookies ważne, ale wygasają za ${expiresInDays} dni!`,
          expiresIn: expiresInDays,
          warning: true
        };
      }

      return {
        valid: true,
        reason: 'Cookies ważne',
        expiresIn: expiresInDays,
        userId: requiredCookies['c_user'].value
      };

    } catch (error) {
      return { valid: false, reason: `Błąd parsowania cookies: ${error.message}` };
    }
  }

  /**
   * Weryfikuje cookies online (sprawdza czy sesja jest aktywna)
   * @param {string|Array} cookies - cookies do sprawdzenia
   * @returns {Promise<Object>} { valid: boolean, reason: string }
   */
  async validateCookiesOnline(cookies) {
    const { chromium } = require('playwright');

    // Najpierw walidacja offline
    const offlineCheck = this.validateCookies(cookies);
    if (!offlineCheck.valid) {
      return offlineCheck;
    }

    let browser = null;
    let context = null;

    try {
      browser = await chromium.launch({ headless: true });
      context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      });

      const cookieArray = typeof cookies === 'string' ? JSON.parse(cookies) : cookies;
      const normalizedCookies = cookieArray.map(cookie => ({
        name: cookie.name,
        value: cookie.value,
        domain: cookie.domain,
        path: cookie.path || '/',
        secure: cookie.secure || false,
        httpOnly: cookie.httpOnly || false,
        sameSite: cookie.sameSite === 'no_restriction' ? 'None' :
                 cookie.sameSite === 'lax' ? 'Lax' :
                 cookie.sameSite === 'strict' ? 'Strict' : 'None',
        expires: cookie.expirationDate ? cookie.expirationDate : undefined
      }));

      await context.addCookies(normalizedCookies);
      const page = await context.newPage();

      await page.goto('https://www.facebook.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
      const currentUrl = page.url();

      // Sprawdź czy nie przekierowało na login
      const isLoggedIn = !currentUrl.includes('login') &&
                        !currentUrl.includes('checkpoint') &&
                        currentUrl.includes('facebook.com');

      await context.close();
      await browser.close();

      if (isLoggedIn) {
        return { valid: true, reason: 'Sesja aktywna', ...offlineCheck };
      } else {
        return { valid: false, reason: 'Sesja wygasła - cookies nieważne online' };
      }

    } catch (error) {
      if (context) await context.close().catch(() => {});
      if (browser) await browser.close().catch(() => {});
      return { valid: false, reason: `Błąd walidacji online: ${error.message}` };
    }
  }

  /**
   * Filtruje konta - zwraca tylko te z ważnymi cookies
   * @param {Array} accounts - lista kont
   * @param {boolean} checkOnline - czy sprawdzać online (wolniejsze)
   * @returns {Promise<Object>} { validAccounts: [], invalidAccounts: [] }
   */
  async filterValidAccounts(accounts, checkOnline = false) {
    const validAccounts = [];
    const invalidAccounts = [];

    for (const account of accounts) {
      if (!account.cookies) {
        invalidAccounts.push({
          ...account,
          validationError: 'Brak cookies'
        });
        continue;
      }

      let validation;
      if (checkOnline) {
        this.addLog(`🔍 Sprawdzam online: ${account.name || account.email || `Konto #${account.id}`}...`, 'info');
        validation = await this.validateCookiesOnline(account.cookies);
      } else {
        validation = this.validateCookies(account.cookies);
      }

      if (validation.valid) {
        if (validation.warning) {
          this.addLog(`⚠️ ${account.name || account.email}: ${validation.reason}`, 'warning');
        }
        validAccounts.push({
          ...account,
          cookieValidation: validation
        });
      } else {
        this.addLog(`❌ ${account.name || account.email}: ${validation.reason}`, 'error');
        invalidAccounts.push({
          ...account,
          validationError: validation.reason
        });
      }
    }

    return { validAccounts, invalidAccounts };
  }

  // =============================================
  // STORAGE STATE - lepsza persystencja sesji
  // =============================================

  /**
   * Zapisuje stan sesji używając storageState (zamiast addCookies)
   * @param {BrowserContext} context - Playwright context
   * @param {string} accountId - ID konta
   * @returns {string} Ścieżka do pliku stanu
   */
  async saveStorageState(context, accountId) {
    const fs = require('fs');
    const path = require('path');

    const stateDir = path.join(
      require('os').homedir(),
      '.automatyzator-grup',
      'storage-states'
    );

    if (!fs.existsSync(stateDir)) {
      fs.mkdirSync(stateDir, { recursive: true });
    }

    const statePath = path.join(stateDir, `account_${accountId}_state.json`);

    // Playwright: storageState() zapisuje cookies + localStorage + sessionStorage
    await context.storageState({ path: statePath });

    // Zapisz timestamp ostatniego odświeżenia
    const metaPath = path.join(stateDir, `account_${accountId}_meta.json`);
    const meta = {
      accountId,
      lastSaved: new Date().toISOString(),
      lastRefresh: new Date().toISOString(),
      statePath
    };
    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));

    this.addLog(`💾 StorageState zapisany dla konta ${accountId}`, 'success');
    return statePath;
  }

  /**
   * Ładuje stan sesji z pliku storageState
   * @param {string} accountId - ID konta
   * @returns {string|null} Ścieżka do pliku stanu lub null
   */
  getStorageStatePath(accountId) {
    const fs = require('fs');
    const path = require('path');

    const stateDir = path.join(
      require('os').homedir(),
      '.automatyzator-grup',
      'storage-states'
    );

    const statePath = path.join(stateDir, `account_${accountId}_state.json`);

    if (fs.existsSync(statePath)) {
      return statePath;
    }
    return null;
  }

  /**
   * Tworzy context z zapisanym storageState
   * @param {Browser} browser - Playwright browser
   * @param {string} accountId - ID konta
   * @param {Object} options - Dodatkowe opcje context
   * @returns {BrowserContext}
   */
  async createContextWithStorageState(browser, accountId, options = {}) {
    const statePath = this.getStorageStatePath(accountId);

    const contextOptions = {
      ...options,
    };

    if (statePath) {
      contextOptions.storageState = statePath;
      this.addLog(`📂 Ładuję storageState dla konta ${accountId}`, 'info');
    }

    return await browser.newContext(contextOptions);
  }

  // =============================================
  // COOKIE REFRESH - automatyczne odświeżanie
  // =============================================

  /**
   * Sprawdza czy cookies wymagają odświeżenia
   * @param {string} accountId - ID konta
   * @returns {Object} { needsRefresh: boolean, daysSinceRefresh: number }
   */
  checkCookieRefreshNeeded(accountId) {
    const fs = require('fs');
    const path = require('path');

    const stateDir = path.join(
      require('os').homedir(),
      '.automatyzator-grup',
      'storage-states'
    );

    const metaPath = path.join(stateDir, `account_${accountId}_meta.json`);

    if (!fs.existsSync(metaPath)) {
      return { needsRefresh: true, daysSinceRefresh: Infinity, reason: 'Brak zapisanego stanu' };
    }

    try {
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
      const lastRefresh = new Date(meta.lastRefresh);
      const now = new Date();
      const daysSinceRefresh = (now - lastRefresh) / (1000 * 60 * 60 * 24);

      // Losowy próg między 3-7 dni
      const refreshThreshold = this.cookieRefreshConfig.minRefreshDays +
        Math.random() * (this.cookieRefreshConfig.maxRefreshDays - this.cookieRefreshConfig.minRefreshDays);

      if (daysSinceRefresh >= refreshThreshold) {
        return {
          needsRefresh: true,
          daysSinceRefresh: Math.round(daysSinceRefresh * 10) / 10,
          reason: `Minęło ${Math.round(daysSinceRefresh)} dni od ostatniego odświeżenia (próg: ${Math.round(refreshThreshold)} dni)`
        };
      }

      return {
        needsRefresh: false,
        daysSinceRefresh: Math.round(daysSinceRefresh * 10) / 10,
        nextRefreshIn: Math.round((refreshThreshold - daysSinceRefresh) * 10) / 10
      };

    } catch (error) {
      return { needsRefresh: true, daysSinceRefresh: Infinity, reason: 'Błąd odczytu metadanych' };
    }
  }

  /**
   * Odświeża cookies poprzez zalogowanie się i zapisanie nowego stanu
   * @param {string} accountId - ID konta
   * @param {Object} account - Dane konta (z cookies)
   * @returns {boolean} Czy odświeżenie się powiodło
   */
  async refreshAccountCookies(accountId, account) {
    this.addLog(`🔄 Odświeżam cookies dla konta ${accountId}...`, 'info');

    const { chromium } = require('playwright');
    let browser = null;
    let context = null;

    try {
      browser = await chromium.launch({ headless: true });

      // Użyj istniejącego storageState lub cookies
      const statePath = this.getStorageStatePath(accountId);
      const contextOptions = {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      };

      if (statePath) {
        contextOptions.storageState = statePath;
      }

      context = await browser.newContext(contextOptions);

      // Jeśli brak storageState, załaduj cookies
      if (!statePath && account.cookies) {
        const cookieArray = typeof account.cookies === 'string' ? JSON.parse(account.cookies) : account.cookies;
        const normalizedCookies = cookieArray.map(cookie => ({
          name: cookie.name,
          value: cookie.value,
          domain: cookie.domain,
          path: cookie.path || '/',
          secure: cookie.secure || false,
          httpOnly: cookie.httpOnly || false,
          sameSite: cookie.sameSite === 'no_restriction' ? 'None' :
                   cookie.sameSite === 'lax' ? 'Lax' :
                   cookie.sameSite === 'strict' ? 'Strict' : 'None',
          expires: cookie.expirationDate ? cookie.expirationDate : undefined
        }));
        await context.addCookies(normalizedCookies);
      }

      const page = await context.newPage();

      // Odwiedź Facebook żeby odświeżyć sesję
      await page.goto('https://www.facebook.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
      const currentUrl = page.url();

      if (currentUrl.includes('login') || currentUrl.includes('checkpoint')) {
        this.addLog(`❌ Sesja wygasła dla konta ${accountId} - wymagane ponowne logowanie`, 'error');
        await context.close();
        await browser.close();
        return false;
      }

      // Zapisz nowy storageState
      await this.saveStorageState(context, accountId);

      this.addLog(`✅ Cookies odświeżone dla konta ${accountId}`, 'success');

      await context.close();
      await browser.close();
      return true;

    } catch (error) {
      this.addLog(`❌ Błąd odświeżania cookies: ${error.message}`, 'error');
      if (context) await context.close().catch(() => {});
      if (browser) await browser.close().catch(() => {});
      return false;
    }
  }

  /**
   * Pobiera listę kont wymagających odświeżenia cookies
   * @returns {Array} Lista kont z informacją o odświeżeniu
   */
  getAccountsNeedingRefresh() {
    const accounts = this.store.get('facebookAccounts', []);
    const needsRefresh = [];

    for (const account of accounts) {
      const refreshStatus = this.checkCookieRefreshNeeded(account.id);
      if (refreshStatus.needsRefresh) {
        needsRefresh.push({
          account,
          ...refreshStatus
        });
      }
    }

    return needsRefresh;
  }

  // =============================================
  // PROXY MANAGEMENT - zarządzanie wieloma proxy
  // =============================================

  /**
   * Dodaje proxy do listy
   * @param {Object} proxy - { name, host, port, username?, password? }
   */
  addProxy(proxy) {
    const proxyWithId = {
      id: Date.now().toString(),
      ...proxy,
      createdAt: new Date().toISOString()
    };
    this.proxyList.push(proxyWithId);
    this.store.set('proxyList', this.proxyList);
    this.addLog(`Dodano proxy: ${proxy.name || proxy.host}:${proxy.port}`, 'success');
    return proxyWithId;
  }

  /**
   * Usuwa proxy z listy
   * @param {string} proxyId - ID proxy do usunięcia
   */
  removeProxy(proxyId) {
    this.proxyList = this.proxyList.filter(p => p.id !== proxyId);
    this.store.set('proxyList', this.proxyList);
    this.addLog(`Usunięto proxy #${proxyId}`, 'info');
  }

  /**
   * Aktualizuje istniejące proxy
   * @param {string} proxyId - ID proxy do aktualizacji
   * @param {Object} updates - Nowe dane { name?, host?, port?, username?, password? }
   */
  updateProxy(proxyId, updates) {
    const index = this.proxyList.findIndex(p => p.id === proxyId);
    if (index >= 0) {
      this.proxyList[index] = {
        ...this.proxyList[index],
        ...updates,
        updatedAt: new Date().toISOString()
      };
      this.store.set('proxyList', this.proxyList);
      this.addLog(`Zaktualizowano proxy #${proxyId}`, 'info');
      return this.proxyList[index];
    }
    return null;
  }

  /**
   * Pobiera listę wszystkich proxy
   */
  getProxyList() {
    return this.proxyList;
  }

  /**
   * Przypisuje proxy do konta
   * @param {string} accountId - ID konta
   * @param {string} proxyId - ID proxy (lub null aby usunąć)
   */
  assignProxyToAccount(accountId, proxyId) {
    const accounts = this.store.get('facebookAccounts', []);
    const accountIndex = accounts.findIndex(a => a.id === accountId);

    if (accountIndex >= 0) {
      accounts[accountIndex].proxyId = proxyId;
      this.store.set('facebookAccounts', accounts);

      const proxy = proxyId ? this.proxyList.find(p => p.id === proxyId) : null;
      this.addLog(`Konto #${accountId} → Proxy: ${proxy ? proxy.name || proxy.host : 'brak'}`, 'info');
    }
  }

  /**
   * Pobiera proxy przypisane do konta
   * @param {string} accountId - ID konta
   * @returns {Object|null} proxy lub null
   */
  getProxyForAccount(accountId) {
    const accounts = this.store.get('facebookAccounts', []);
    const account = accounts.find(a => a.id === accountId);

    if (account && account.proxyId) {
      return this.proxyList.find(p => p.id === account.proxyId) || null;
    }
    return null;
  }

  /**
   * Testuje proxy używając Playwright
   * @param {Object} proxy - { host, port, username?, password? }
   */
  async testProxy(proxy) {
    const { chromium } = require('playwright');
    let browser = null;
    let context = null;

    try {
      // Przygotuj konfigurację proxy dla Playwright
      // Playwright wymaga oddzielnej konfiguracji server i auth
      const proxyConfig = {
        server: `http://${proxy.host}:${proxy.port}`
      };

      // Jeśli proxy ma autentykację, dodaj osobno
      if (proxy.username && proxy.password) {
        proxyConfig.username = proxy.username;
        proxyConfig.password = proxy.password;
      }

      // Uruchom przeglądarkę z proxy
      browser = await chromium.launch({
        headless: true,
        proxy: proxyConfig,
        // Dodatkowe flagi dla lepszej kompatybilności proxy
        args: [
          '--ignore-certificate-errors',
          '--ignore-certificate-errors-spki-list'
        ]
      });

      context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        ignoreHTTPSErrors: true // Ignoruj błędy SSL przez proxy
      });

      const page = await context.newPage();

      // Przechwytujemy response bezpośrednio - ipify zwraca plain text JSON, nie HTML
      let responseBody = null;

      page.on('response', async (response) => {
        if (response.url().includes('ipify.org') && response.status() === 200) {
          try {
            responseBody = await response.text();
          } catch (e) {
            // Ignoruj błędy odczytu
          }
        }
      });

      // Użyj HTTP zamiast HTTPS dla testowania proxy (unikamy problemów z tunelem)
      await page.goto('http://api.ipify.org?format=json', {
        waitUntil: 'domcontentloaded',
        timeout: 15000
      });

      // Poczekaj na response
      await page.waitForTimeout(2000);

      // Jeśli nie złapaliśmy response, spróbuj pobrać z DOM
      if (!responseBody) {
        // Najpierw spróbuj innerText
        responseBody = await page.evaluate(() => document.body.innerText).catch(() => '');

        // Jeśli nadal puste, spróbuj innerHTML
        if (!responseBody || responseBody.trim() === '') {
          responseBody = await page.evaluate(() => document.body.innerHTML).catch(() => '');
        }
      }

      await page.close();
      await context.close();
      await browser.close();

      // Sprawdź czy mamy jakąkolwiek odpowiedź
      if (!responseBody || responseBody.trim() === '') {
        return {
          success: false,
          error: 'Pusta odpowiedź',
          message: 'Proxy zwraca pustą odpowiedź - może być zablokowane lub nie obsługuje HTTP'
        };
      }

      // Sprawdź czy to jest JSON
      let data;
      try {
        data = JSON.parse(responseBody.trim());
      } catch (jsonError) {
        // Jeśli nie JSON, sprawdź czy to HTML (błąd proxy)
        const isHTML = responseBody.trim().startsWith('<');

        if (isHTML || responseBody.length > 200) {
          return {
            success: false,
            error: 'Proxy zwraca HTML zamiast danych',
            message: `Proxy może wymagać uwierzytelnienia lub jest zablokowane. Odpowiedź: ${responseBody.substring(0, 100)}...`
          };
        }

        return {
          success: false,
          error: 'Nieprawidłowa odpowiedź',
          message: `Proxy zwróciło nieprawidłowe dane: "${responseBody.substring(0, 100)}"`
        };
      }

      // Sprawdź czy odpowiedź zawiera IP
      if (data && data.ip) {
        return {
          success: true,
          ip: data.ip,
          message: `Proxy działa! IP: ${data.ip}`
        };
      } else {
        return {
          success: false,
          error: 'Brak IP w odpowiedzi',
          message: `Proxy odpowiedziało, ale bez IP: ${JSON.stringify(data)}`
        };
      }
    } catch (error) {
      // Zamknij zasoby w razie błędu
      try {
        if (context) await context.close();
        if (browser) await browser.close();
      } catch (e) {
        // Ignoruj błędy zamykania
      }

      return {
        success: false,
        error: error.message,
        message: `Proxy nie działa: ${error.message}`
      };
    }
  }

  findChromePath() {
    const fs = require('fs');
    const os = require('os');
    const path = require('path');
    
    // Możliwe ścieżki Chrome/Chromium na różnych systemach
    const possiblePaths = [];
    
    if (os.platform() === 'darwin') { // macOS
      possiblePaths.push(
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/Applications/Chromium.app/Contents/MacOS/Chromium',
        '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
        '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser'
      );
    } else if (os.platform() === 'win32') { // Windows
      const programFiles = process.env['PROGRAMFILES'];
      const programFilesX86 = process.env['PROGRAMFILES(X86)'];
      const localAppData = process.env['LOCALAPPDATA'];
      
      possiblePaths.push(
        `${programFiles}\\Google\\Chrome\\Application\\chrome.exe`,
        `${programFilesX86}\\Google\\Chrome\\Application\\chrome.exe`,
        `${localAppData}\\Google\\Chrome\\Application\\chrome.exe`,
        `${programFiles}\\BraveSoftware\\Brave-Browser\\Application\\brave.exe`
      );
    } else { // Linux
      possiblePaths.push(
        '/usr/bin/google-chrome',
        '/usr/bin/chromium-browser',
        '/usr/bin/chromium',
        '/usr/bin/brave-browser',
        '/snap/bin/chromium'
      );
    }
    
    // Sprawdź która ścieżka istnieje
    for (const chromePath of possiblePaths) {
      if (fs.existsSync(chromePath)) {
        this.addLog(`Znaleziono przeglądarkę: ${chromePath}`, 'success');
        return chromePath;
      }
    }
    
    // Jeśli nie znaleziono, zwróć undefined (Puppeteer użyje swojego Chromium)
    this.addLog('Nie znaleziono lokalnej przeglądarki, używam Puppeteer Chromium', 'info');
    return undefined;
  }

  async saveCredentials(credentials) {
    const encrypted = {
      email: CryptoJS.AES.encrypt(credentials.email, this.encryptionKey).toString(),
      password: CryptoJS.AES.encrypt(credentials.password, this.encryptionKey).toString()
    };
    this.store.set('credentials', encrypted);
    this.addLog('Dane logowania zapisane bezpiecznie', 'success');
  }

  async getCredentials() {
    const encrypted = this.store.get('credentials');
    if (!encrypted) return null;

    try {
      const email = CryptoJS.AES.decrypt(encrypted.email, this.encryptionKey).toString(CryptoJS.enc.Utf8);
      const password = CryptoJS.AES.decrypt(encrypted.password, this.encryptionKey).toString(CryptoJS.enc.Utf8);
      return { email, password };
    } catch (error) {
      this.addLog('Błąd odszyfrowywania danych logowania', 'error');
      return null;
    }
  }

  async initBrowser() {
    const proxyConfig = this.store.get('proxy', { enabled: false });

    const executablePath = this.findChromePath();

    // Wygeneruj unikalny fingerprint dla tej sesji
    this.currentFingerprint = this.fingerprintManager.generateFingerprint();
    this.addLog(`🔐 Wygenerowano fingerprint: ${this.currentFingerprint.screen.width}x${this.currentFingerprint.screen.height}, GPU: ${this.currentFingerprint.webgl.renderer.substring(0, 30)}...`, 'info');

    // Playwright launch options
    const launchOptions = {
      headless: false,
      executablePath: executablePath || undefined,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
        '--disable-blink-features=AutomationControlled',
        '--start-maximized',
        '--disable-infobars',
        '--disable-dev-shm-usage',
        '--no-first-run',
        // WebRTC leak prevention
        '--disable-webrtc-encryption',
        '--disable-webrtc-hw-encoding',
        '--disable-webrtc-hw-decoding',
        '--enforce-webrtc-ip-permission-check'
      ]
    };

    // Proxy configuration for Playwright
    if (proxyConfig.enabled && proxyConfig.host && proxyConfig.port) {
      launchOptions.proxy = {
        server: `http://${proxyConfig.host}:${proxyConfig.port}`,
        username: proxyConfig.username || undefined,
        password: proxyConfig.password || undefined
      };
      this.addLog(`Używam proxy: ${proxyConfig.host}:${proxyConfig.port}`, 'info');
    }

    // Playwright browser launch
    this.browser = await chromium.launch(launchOptions);

    // Create context with fingerprint settings
    this.context = await this.browser.newContext({
      viewport: {
        width: this.currentFingerprint.screen.width,
        height: this.currentFingerprint.screen.height
      },
      userAgent: this.currentFingerprint.userAgent,
      locale: this.currentFingerprint.locale,
      timezoneId: this.currentFingerprint.timezone,
      deviceScaleFactor: 1,
      hasTouch: false,
      javaScriptEnabled: true,
      ignoreHTTPSErrors: true
    });

    this.page = await this.context.newPage();

    // Wstrzyknij skrypty stealth PRZED jakąkolwiek nawigacją
    await this.injectStealthScripts();

    // Załaduj zapisane cookies jeśli istnieją
    await this.loadCookies();

    this.addLog('✅ Przeglądarka Playwright zainicjalizowana z fingerprint spoofing', 'success');
  }

  // Wstrzykuje skrypty stealth do strony (Playwright)
  async injectStealthScripts() {
    const stealthScripts = this.fingerprintManager.getStealthScripts(this.currentFingerprint);

    // Playwright: użyj addInitScript zamiast evaluateOnNewDocument
    for (const script of stealthScripts) {
      await this.context.addInitScript(script);
    }

    this.addLog('🛡️ Wstrzyknięto skrypty stealth (Canvas, WebGL, Audio, WebRTC, Chrome.runtime)', 'info');
  }

  async saveCookies() {
    try {
      // Playwright: cookies są w context, nie w page
      const cookies = await this.context.cookies();
      this.store.set('cookies', cookies);
      this.addLog('Sesja zapisana (cookies)', 'success');
    } catch (error) {
      this.addLog(`Błąd zapisu sesji: ${error.message}`, 'warning');
    }
  }

  async loadCookies() {
    try {
      const cookies = this.store.get('cookies');
      if (cookies && cookies.length > 0) {
        // Playwright: addCookies zamiast setCookie
        await this.context.addCookies(cookies);
        this.addLog('Załadowano zapisaną sesję', 'success');
        return true;
      }
      return false;
    } catch (error) {
      this.addLog(`Nie można załadować sesji: ${error.message}`, 'info');
      return false;
    }
  }

  async clearCookies() {
    this.store.delete('cookies');
    this.addLog('Sesja wyczyszczona', 'info');
  }

  async testLogin(credentials) {
    try {
      this.addLog('Rozpoczynam test logowania...', 'info');

      await this.initBrowser();
      // Playwright: domcontentloaded for faster loading
      await this.page.goto('https://www.facebook.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await randomDelay(2000, 4000);

      // Wpisywanie emaila - Playwright style
      const emailSelector = '#email';
      await this.page.waitForSelector(emailSelector, { timeout: 10000 });
      await this.page.fill(emailSelector, '');
      await this.page.type(emailSelector, credentials.email, { delay: 100 });
      await randomDelay(1000, 2000);

      // Wpisywanie hasła
      const passwordSelector = '#pass';
      await this.page.fill(passwordSelector, '');
      await this.page.type(passwordSelector, credentials.password, { delay: 100 });
      await randomDelay(1000, 2000);

      // Kliknięcie przycisku logowania
      const loginButton = 'button[name="login"]';
      await this.page.click(loginButton);
      await randomDelay(3000, 5000);

      // Playwright: waitForLoadState zamiast waitForNavigation
      await this.page.waitForLoadState('networkidle', { timeout: 15000 });

      const currentUrl = this.page.url();

      // Sprawdzenie CAPTCHA
      if (currentUrl.includes('checkpoint') || currentUrl.includes('captcha')) {
        this.emit('captcha-detected');
        this.addLog('Wykryto CAPTCHA - wymagana weryfikacja', 'warning');
        await this.closeBrowser();
        return { success: false, error: 'CAPTCHA detected', requiresCaptcha: true };
      }

      // Sprawdzenie czy jesteśmy zalogowani
      if (currentUrl.includes('facebook.com') && !currentUrl.includes('login')) {
        this.addLog('Logowanie zakończone sukcesem!', 'success');
        await this.closeBrowser();
        return { success: true };
      }

      this.addLog('Logowanie nie powiodło się', 'error');
      await this.closeBrowser();
      return { success: false, error: 'Login failed' };

    } catch (error) {
      this.addLog(`Błąd podczas testu logowania: ${error.message}`, 'error');
      await this.closeBrowser();
      return { success: false, error: error.message };
    }
  }

  async startPosting(config) {
    if (this.isRunning) {
      throw new Error('Automatyzacja jest już uruchomiona');
    }

    try {
      this.isRunning = true;
      this.isPaused = false;
      this.currentTask = config;
      this.emit('status-change', this.getStatus());
      
      this.addLog('Rozpoczynam automatyzację postowania...', 'info');
      
      // Inicjalizuj przeglądarkę
      await this.initBrowser();
      
      // Załaduj cookies jeśli są podane
      if (config.cookies) {
        try {
          const cookies = JSON.parse(config.cookies);
          this.addLog(`Ładuję ${cookies.length} cookies...`, 'info');

          // Normalizuj cookies dla Playwright
          const normalizedCookies = cookies.map(cookie => ({
            name: cookie.name,
            value: cookie.value,
            domain: cookie.domain,
            path: cookie.path || '/',
            secure: cookie.secure !== undefined ? cookie.secure : false,
            httpOnly: cookie.httpOnly !== undefined ? cookie.httpOnly : false,
            sameSite: cookie.sameSite === 'no_restriction' ? 'None' :
                     cookie.sameSite === 'lax' ? 'Lax' :
                     cookie.sameSite === 'strict' ? 'Strict' : 'None',
            expires: cookie.expirationDate ? cookie.expirationDate : undefined
          }));

          // Playwright: addCookies zamiast setCookie
          await this.context.addCookies(normalizedCookies);
          this.addLog('✅ Cookies załadowane', 'success');

          // Przejdź na Facebook żeby cookies zadziałały
          await this.page.goto('https://www.facebook.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
          await randomDelay(3000, 5000);

          const currentUrl = this.page.url();
          if (currentUrl.includes('facebook.com') && !currentUrl.includes('login')) {
            this.addLog('✅ Zalogowano przez cookies!', 'success');
          } else {
            throw new Error('Cookies nie zadziałały - zaloguj się ręcznie w przeglądarce');
          }

        } catch (cookieError) {
          this.addLog(`⚠️ Błąd cookies: ${cookieError.message}`, 'warning');
          this.addLog('Spróbuj zalogować się ręcznie w przeglądarce...', 'info');
          throw new Error(`Błąd cookies: ${cookieError.message}`);
        }
      } else {
        // Tradycyjne logowanie
        const credentials = await this.getCredentials();
        if (!credentials) {
          throw new Error('Brak zapisanych danych logowania ani cookies');
        }
        await this.login(credentials);
      }
      
      // Pobierz accountId z cookies lub użyj domyślnego
      const accountId = config.accountId || 'default';

      // Główna pętla postowania
      for (let i = 0; i < config.groups.length; i++) {
        const group = config.groups[i];
        if (!this.isRunning) break;

        while (this.isPaused) {
          await randomDelay(1000, 2000);
        }

        // ANTY-BAN: Sprawdź czy powinniśmy zatrzymać automatyzację
        const pauseCheck = this.activityLimiter.shouldPauseAutomation();
        if (pauseCheck.shouldPause) {
          this.addLog(`🛑 AUTO-PAUZA: ${pauseCheck.reason}`, 'error');
          this.emit('auto-pause', pauseCheck);
          this.isRunning = false;
          break;
        }

        // ANTY-BAN: Sprawdź limity aktywności
        const canPostResult = this.activityLimiter.canPost(accountId);
        if (!canPostResult.allowed) {
          this.addLog(`⏸️ Limit osiągnięty: ${canPostResult.reason}`, 'warning');
          break;
        }

        // Wyświetl statystyki przed postem
        const stats = this.activityLimiter.getStats(accountId);
        this.addLog(`📊 Posty dziś: ${stats.today.posts}/${stats.today.maxPosts}, Akcje: ${stats.today.totalActions}/${stats.today.maxActions}`, 'info');

        await this.postToGroup(group, config.message);

        // Zapisz akcję postu
        this.activityLimiter.recordAction(accountId, 'post');

        // ANTY-BAN: Delay 4-18 minut między grupami (zamiast 60-90 sekund!)
        if (i < config.groups.length - 1) {
          const delayMs = this.activityLimiter.getDelayBetweenGroups();
          const delayMinutes = Math.round(delayMs / 60000 * 10) / 10;
          this.addLog(`⏳ Czekam ${delayMinutes} minut przed następną grupą...`, 'info');
          await randomDelay(delayMs * 0.9, delayMs * 1.1); // +/- 10% variacja
        }
      }

      this.addLog('Automatyzacja zakończona pomyślnie!', 'success');
      await this.closeBrowser();
      this.isRunning = false;
      this.emit('status-change', this.getStatus());
      
      return { success: true };

    } catch (error) {
      this.addLog(`Błąd podczas postowania: ${error.message}`, 'error');
      this.emit('error', error);
      await this.closeBrowser();
      this.isRunning = false;
      this.emit('status-change', this.getStatus());
      throw error;
    }
  }

  async startPostingFromCSV(config) {
    if (this.isRunning) {
      throw new Error('Automatyzacja jest już uruchomiona');
    }

    try {
      this.isRunning = true;
      this.isPaused = false;
      this.currentTask = config;
      this.emit('status-change', this.getStatus());
      
      this.addLog(`Rozpoczynam automatyzację z CSV (${config.posts.length} postów)...`, 'info');
      
      // Inicjalizuj przeglądarkę
      await this.initBrowser();
      
      // Załaduj cookies jeśli są podane
      if (config.cookies) {
        try {
          const cookies = JSON.parse(config.cookies);
          this.addLog(`Ładuję ${cookies.length} cookies...`, 'info');
          
          const normalizedCookies = cookies.map(cookie => ({
            name: cookie.name,
            value: cookie.value,
            domain: cookie.domain,
            path: cookie.path || '/',
            secure: cookie.secure !== undefined ? cookie.secure : false,
            httpOnly: cookie.httpOnly !== undefined ? cookie.httpOnly : false,
            sameSite: cookie.sameSite === 'no_restriction' ? 'None' : 
                     cookie.sameSite === 'lax' ? 'Lax' : 
                     cookie.sameSite === 'strict' ? 'Strict' : 'None',
            expires: cookie.expirationDate ? cookie.expirationDate : undefined
          }));
          
          await this.context.addCookies(normalizedCookies);
          this.addLog('✅ Cookies załadowane', 'success');

          await this.page.goto('https://www.facebook.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
          await randomDelay(3000, 5000);
          
          const currentUrl = this.page.url();
          if (currentUrl.includes('facebook.com') && !currentUrl.includes('login')) {
            this.addLog('✅ Zalogowano przez cookies!', 'success');
          } else {
            throw new Error('Cookies nie zadziałały');
          }
          
        } catch (cookieError) {
          this.addLog(`⚠️ Błąd cookies: ${cookieError.message}`, 'warning');
          throw new Error(`Błąd cookies: ${cookieError.message}`);
        }
      } else {
        const credentials = await this.getCredentials();
        if (!credentials) {
          throw new Error('Brak zapisanych danych logowania ani cookies');
        }
        await this.login(credentials);
      }
      
      // Pobierz accountId z cookies lub użyj domyślnego
      const accountId = config.accountId || 'default';

      // Główna pętla postowania z CSV
      for (let i = 0; i < config.posts.length; i++) {
        if (!this.isRunning) break;

        while (this.isPaused) {
          await randomDelay(1000, 2000);
        }

        // ANTY-BAN: Sprawdź czy powinniśmy zatrzymać automatyzację
        const pauseCheck = this.activityLimiter.shouldPauseAutomation();
        if (pauseCheck.shouldPause) {
          this.addLog(`🛑 AUTO-PAUZA: ${pauseCheck.reason}`, 'error');
          this.emit('auto-pause', pauseCheck);
          this.isRunning = false;
          break;
        }

        // ANTY-BAN: Sprawdź limity aktywności
        const canPostResult = this.activityLimiter.canPost(accountId);
        if (!canPostResult.allowed) {
          this.addLog(`⏸️ Limit osiągnięty: ${canPostResult.reason}`, 'warning');
          break;
        }

        // Wyświetl statystyki przed postem
        const stats = this.activityLimiter.getStats(accountId);
        this.addLog(`📊 Posty dziś: ${stats.today.posts}/${stats.today.maxPosts}, Akcje: ${stats.today.totalActions}/${stats.today.maxActions}`, 'info');

        const post = config.posts[i];
        this.addLog(`\n[${i + 1}/${config.posts.length}] Postuję do: ${post.groupLink}`, 'info');

        await this.postToGroup(post.groupLink, post.postCopy);

        // Zapisz akcję postu
        this.activityLimiter.recordAction(accountId, 'post');

        // ANTY-BAN: Delay 4-18 minut między grupami (zamiast 60-90 sekund!)
        if (i < config.posts.length - 1) {
          const delayMs = this.activityLimiter.getDelayBetweenGroups();
          const delayMinutes = Math.round(delayMs / 60000 * 10) / 10;
          this.addLog(`⏳ Czekam ${delayMinutes} minut przed następną grupą...`, 'info');
          await randomDelay(delayMs * 0.9, delayMs * 1.1);
        }
      }

      this.addLog(`\n✅ Zakończono postowanie z CSV! (${config.posts.length} postów)`, 'success');
      await this.closeBrowser();
      this.isRunning = false;
      this.emit('status-change', this.getStatus());
      
      return { success: true };

    } catch (error) {
      this.addLog(`❌ Błąd podczas postowania z CSV: ${error.message}`, 'error');
      this.emit('error', error);
      await this.closeBrowser();
      this.isRunning = false;
      this.emit('status-change', this.getStatus());
      throw error;
    }
  }

  async startPostingMultiAccount(config) {
    const { posts, accounts, validateCookiesOnline = false } = config;
    // delayBetweenPosts usunięte - używamy automatycznego 4-18 min z activity-limiter

    this.addLog(`🚀 Rozpoczynam postowanie wielokontowe`, 'info');
    this.addLog(`📊 Konta do sprawdzenia: ${accounts.length}`, 'info');
    this.addLog(`📝 Posty: ${posts.length}`, 'info');
    this.addLog(`⚙️ Max jednoczesnych kont: ${this.maxConcurrentAccounts}`, 'info');

    // =============================================
    // WALIDACJA COOKIES - przed rozpoczęciem
    // =============================================
    this.addLog(`\n🔍 Sprawdzam ważność cookies...`, 'info');

    const { validAccounts, invalidAccounts } = await this.filterValidAccounts(
      accounts,
      validateCookiesOnline
    );

    // Podsumowanie walidacji
    if (invalidAccounts.length > 0) {
      this.addLog(`\n⚠️ Konta z nieważnymi cookies (pominięte):`, 'warning');
      for (const acc of invalidAccounts) {
        this.addLog(`   ❌ ${acc.name || acc.email || `Konto #${acc.id}`}: ${acc.validationError}`, 'error');
      }
    }

    if (validAccounts.length === 0) {
      throw new Error('Brak kont z ważnymi cookies! Odśwież cookies i spróbuj ponownie.');
    }

    this.addLog(`\n✅ Konta z ważnymi cookies: ${validAccounts.length}/${accounts.length}`, 'success');

    // =============================================
    // KOLEJKA: Współdzielona kolejka postów
    // =============================================
    this.addLog(`\n📋 Tworzę wspólną kolejkę postów...`, 'info');

    // Współdzielona kolejka - wszystkie posty w jednym miejscu
    const postQueue = [...posts]; // Kopia wszystkich postów
    const stoppedAccounts = new Set(); // Zestaw ID zatrzymanych kont
    let globalStopFlag = false; // Flag do zatrzymania wszystkich

    // Funkcja pobierająca post z kolejki (atomowa operacja)
    const getNextPost = () => {
      if (globalStopFlag || postQueue.length === 0) return null;
      return postQueue.shift();
    };

    // Funkcja zwracająca post do kolejki
    const returnPostToQueue = (post) => {
      postQueue.unshift(post); // Na początek kolejki
    };

    // Funkcja zwracająca liczbę postów w kolejce
    const getQueueLength = () => postQueue.length;

    // Funkcja zatrzymująca konto (zostanie pełni zdefiniowana później po activateReserveAccount)
    let stopAccount;

    const accountTasks = [];
    for (let i = 0; i < validAccounts.length; i++) {
      const account = validAccounts[i];

      // Pobierz proxy przypisane do konta
      const accountProxy = account.proxyId
        ? this.proxyList.find(p => p.id === account.proxyId)
        : null;

      accountTasks.push({
        accountIndex: i + 1,
        accountId: account.id,
        accountName: account.name || account.email || `Konto #${account.id}`,
        cookies: account.cookies,
        posts: null, // Brak przydzielonych postów - będą pobierane z kolejki
        proxy: accountProxy,  // Proxy per konto
        cookieValidation: account.cookieValidation,
        // Przekaż funkcje do zarządzania kolejką
        getNextPost,
        returnPostToQueue,
        stopAccount: (id, name, reason) => stopAccount(id, name, reason), // Function wrapper to resolve at call time
        stoppedAccounts,
        getGlobalStopFlag: () => globalStopFlag,
        getQueueLength
      });

      const proxyInfo = accountProxy ? `🌐 ${accountProxy.name || accountProxy.host}` : '🔓 bez proxy';
      this.addLog(`🔹 ${account.name || `Konto #${i + 1}`}: gotowe do pracy | ${proxyInfo}`, 'info');
    }

    this.addLog(`\n✅ Utworzono kolejkę z ${posts.length} postami, uruchamiam ${accountTasks.length} instancji...`, 'success');

    // =============================================
    // SYSTEM REZERWY: Podział na aktywne i rezerwowe konta
    // =============================================
    const activeTasks = accountTasks.slice(0, this.maxConcurrentAccounts);
    const reserveTasks = accountTasks.slice(this.maxConcurrentAccounts);

    if (reserveTasks.length > 0) {
      this.addLog(`\n🔄 System rezerwy: ${activeTasks.length} kont aktywnych, ${reserveTasks.length} w rezerwie`, 'info');
    }

    // =============================================
    // MAX 5 KONT JEDNOCZEŚNIE - kontrola przepustowości
    // =============================================
    this.isRunning = true;
    this.emit('status-change', this.getStatus());

    const results = [];
    const accountsStats = []; // Szczegółowe statystyki każdego konta
    const executing = new Set(); // Współdzielony Set dla wszystkich kont (aktywnych + rezerwa)

    // Funkcja aktywująca konto z rezerwy
    const activateReserveAccount = () => {
      if (reserveTasks.length === 0) return null;

      const reserveTask = reserveTasks.shift();
      this.addLog(`\n🔄 AKTYWUJĘ KONTO Z REZERWY: ${reserveTask.accountName}`, 'info');

      // Uruchom konto w tle (fire-and-forget)
      const taskPromise = (async () => {
        try {
          this.addLog(`▶️ Uruchamiam konto z rezerwy: ${reserveTask.accountName}`, 'info');
          const stats = await this.runAccountTaskIsolated(reserveTask);
          accountsStats.push(stats);

          const hasError = stats.criticalError || stats.failedPosts.length > 0;
          results.push({
            accountId: reserveTask.accountId,
            success: !hasError,
            stats: stats
          });
        } catch (error) {
          this.addLog(`❌ Błąd konta z rezerwy ${reserveTask.accountName}: ${error.message}`, 'error');
          accountsStats.push({
            accountId: reserveTask.accountId,
            accountName: reserveTask.accountName,
            successfulPosts: [],
            failedPosts: [],
            totalAttempted: 0,
            criticalError: error.message
          });
        }
      })().finally(() => {
        executing.delete(taskPromise);
      });

      executing.add(taskPromise);
      return reserveTask.accountName;
    };

    // Pełna definicja funkcji zatrzymującej konto (teraz mamy dostęp do activateReserveAccount)
    stopAccount = (accountId, accountName, reason) => {
      if (stoppedAccounts.has(accountId)) return; // Już zatrzymane

      stoppedAccounts.add(accountId);
      this.addLog(`❌ KONTO ZATRZYMANE: ${accountName} - ${reason}`, 'error');

      // Aktywuj konto z rezerwy jeśli dostępne
      const activatedAccount = activateReserveAccount();
      if (activatedAccount) {
        this.addLog(`✅ Aktywowano konto z rezerwy: ${activatedAccount}`, 'success');
      }

      // NOWA ZASADA STOPU: 70% kont zatrzymane + brak rezerwy
      const totalAccounts = validAccounts.length;
      const stoppedPercentage = (stoppedAccounts.size / totalAccounts) * 100;
      const hasReserve = reserveTasks.length > 0;

      if (stoppedPercentage >= 70 && !hasReserve) {
        globalStopFlag = true;
        this.isRunning = false;
        this.addLog(`\n🛑 STOP AUTOMATYZACJI - ${stoppedPercentage.toFixed(0)}% kont zatrzymane i brak rezerwy`, 'error');
        this.addLog(`   Zatrzymane konta: ${stoppedAccounts.size}/${totalAccounts}`, 'error');
      }
    };

    // Funkcja do uruchamiania zadań z limitem
    const runWithConcurrencyLimit = async (tasks, maxConcurrent) => {

      for (const task of tasks) {
        // ⚠️ SPRAWDŹ CZY NIE ZATRZYMANO
        if (!this.isRunning) {
          this.addLog(`⏹️ Automatyzacja zatrzymana - nie uruchamiam więcej kont`, 'warning');
          break;
        }

        // Czekaj jeśli osiągnięto limit
        while (executing.size >= maxConcurrent && this.isRunning) {
          await Promise.race(executing);
        }

        // Ponownie sprawdź po czekaniu
        if (!this.isRunning) {
          this.addLog(`⏹️ Automatyzacja zatrzymana`, 'warning');
          break;
        }

        const taskPromise = (async () => {
          try {
            this.addLog(`▶️ Uruchamiam konto ${task.accountName} (${executing.size + 1}/${maxConcurrent} aktywnych)`, 'info');
            const stats = await this.runAccountTaskIsolated(task);
            accountsStats.push(stats);

            const hasError = stats.criticalError || stats.failedPosts.length > 0;
            results.push({
              accountId: task.accountId,
              success: !hasError,
              stats: stats
            });
          } catch (error) {
            this.addLog(`❌ Błąd konta ${task.accountName}: ${error.message}`, 'error');
            accountsStats.push({
              accountId: task.accountId,
              accountName: task.accountName,
              successfulPosts: [],
              failedPosts: [],
              totalAttempted: 0,
              criticalError: error.message
            });
          }
        })().finally(() => {
          executing.delete(taskPromise);
        });

        executing.add(taskPromise);

        // Delay między uruchamianiem kolejnych kont (30-60s) - jeśli są jeszcze konta
        const remainingTasks = tasks.indexOf(task) < tasks.length - 1;
        if (remainingTasks && this.isRunning) {
          const delayMs = 30000 + Math.random() * 30000; // 30-60s
          const delaySec = Math.round(delayMs / 1000);
          this.addLog(`⏳ Czekam ${delaySec}s przed następnym kontem...`, 'info');

          // Czekaj z możliwością przerwania
          const waitStart = Date.now();
          while (Date.now() - waitStart < delayMs && this.isRunning) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }

      // Czekaj na zakończenie wszystkich aktywnych zadań
      if (executing.size > 0) {
        this.addLog(`⏳ Czekam na zakończenie ${executing.size} aktywnych kont...`, 'info');
        await Promise.all(executing);
      }
    };

    try {
      await runWithConcurrencyLimit(activeTasks, this.maxConcurrentAccounts);

      // Poczekaj na wszystkie konta (włącznie z tymi z rezerwy)
      if (executing.size > 0) {
        this.addLog(`⏳ Czekam na zakończenie ${executing.size} kont (włącznie z rezerwą)...`, 'info');
        await Promise.all(executing);
      }

      const successCount = results.filter(r => r.success).length;
      const failedAccounts = results.filter(r => !r.success).length;

      // Oblicz całkowite statystyki postów
      let totalSuccessfulPosts = 0;
      let totalFailedPosts = 0;
      const groupStats = new Map(); // Grupuj posty per grupa

      for (const stats of accountsStats) {
        totalSuccessfulPosts += stats.successfulPosts.length;
        totalFailedPosts += stats.failedPosts.length;

        // Zlicz posty per grupa
        for (const post of stats.successfulPosts) {
          const groupKey = post.groupLink;
          groupStats.set(groupKey, (groupStats.get(groupKey) || 0) + 1);
        }
      }

      // ========================================
      // SZCZEGÓŁOWE PODSUMOWANIE KOŃCOWE
      // ========================================
      this.addLog(`\n${'='.repeat(60)}`, 'info');
      this.addLog(`📊 PODSUMOWANIE AUTOMATYZACJI`, 'info');
      this.addLog(`${'='.repeat(60)}`, 'info');

      if (this.isRunning) {
        this.addLog(`\n✅ Status: Zakończono pomyślnie`, 'success');
      } else {
        this.addLog(`\n⏹️ Status: Zatrzymano przez użytkownika`, 'warning');
      }

      // Statystyki kont
      this.addLog(`\n👥 KONTA:`, 'info');
      this.addLog(`   • Kont ogółem: ${accountTasks.length}`, 'info');
      this.addLog(`   • Kont aktywnych na start: ${activeTasks.length}`, 'info');
      if (accountTasks.length > activeTasks.length) {
        const reserveUsed = activeTasks.length + (accountTasks.length - activeTasks.length - reserveTasks.length);
        this.addLog(`   • Kont z rezerwy użytych: ${reserveUsed}/${accountTasks.length - activeTasks.length}`, 'info');
      }
      this.addLog(`   • Kont z sukcesem: ${successCount}`, 'success');
      this.addLog(`   • Kont z błędami: ${failedAccounts}`, failedAccounts > 0 ? 'warning' : 'info');
      this.addLog(`   • Kont zatrzymanych: ${stoppedAccounts.size}`, stoppedAccounts.size > 0 ? 'error' : 'info');

      // Statystyki postów
      this.addLog(`\n📝 POSTY:`, 'info');
      this.addLog(`   • Opublikowane pomyślnie: ${totalSuccessfulPosts}`, 'success');
      this.addLog(`   • Błędy publikacji: ${totalFailedPosts}`, totalFailedPosts > 0 ? 'warning' : 'info');
      this.addLog(`   • Pozostało w kolejce: ${postQueue.length}`, postQueue.length > 0 ? 'warning' : 'info');
      this.addLog(`   • Całkowita liczba prób: ${totalSuccessfulPosts + totalFailedPosts}`, 'info');
      if (totalSuccessfulPosts + totalFailedPosts > 0) {
        const successRate = ((totalSuccessfulPosts / (totalSuccessfulPosts + totalFailedPosts)) * 100).toFixed(1);
        this.addLog(`   • Wskaźnik sukcesu: ${successRate}%`, 'info');
      }

      // Posty per grupa
      if (groupStats.size > 0) {
        this.addLog(`\n🎯 POSTY PER GRUPA:`, 'info');
        const sortedGroups = Array.from(groupStats.entries())
          .sort((a, b) => b[1] - a[1]);

        for (const [groupLink, count] of sortedGroups) {
          const groupName = groupLink.split('/').pop() || groupLink;
          this.addLog(`   • ${groupName}: ${count} postów`, 'info');
        }
      }

      // Posty per konto
      this.addLog(`\n👤 POSTY PER KONTO:`, 'info');
      for (const stats of accountsStats) {
        const status = stats.criticalError ? '❌' : stats.failedPosts.length > 0 ? '⚠️' : '✅';
        const postsInfo = `${stats.successfulPosts.length} sukces, ${stats.failedPosts.length} błąd`;
        this.addLog(`   ${status} ${stats.accountName}: ${postsInfo}`, stats.criticalError ? 'error' : 'info');

        if (stats.criticalError) {
          this.addLog(`      └─ Błąd krytyczny: ${stats.criticalError}`, 'error');
        }
      }

      this.addLog(`\n${'='.repeat(60)}\n`, 'info');

      return {
        success: failedAccounts === 0 && totalFailedPosts === 0,
        totalAccounts: accountTasks.length,
        successfulAccounts: successCount,
        failedAccounts: failedAccounts,
        validAccounts: validAccounts.length,
        invalidAccounts: invalidAccounts.length,
        totalSuccessfulPosts: totalSuccessfulPosts,
        totalFailedPosts: totalFailedPosts,
        groupStats: Object.fromEntries(groupStats),
        accountsStats: accountsStats,
        skippedAccounts: invalidAccounts.map(a => ({
          name: a.name || a.email,
          reason: a.validationError
        })),
        stoppedByUser: !this.isRunning
      };
    } catch (error) {
      this.addLog(`\n❌ Krytyczny błąd: ${error.message}`, 'error');
      throw error;
    } finally {
      // Zawsze resetuj stan
      this.isRunning = false;
      this.emit('status-change', this.getStatus());
    }
  }

  async runAccountTaskIsolated(task) {
    const { accountIndex, accountName, cookies, posts, proxy } = task;
    const { chromium } = require('playwright');

    // SPRAWDŹ CZY AUTOMATYZACJA NIE ZOSTAŁA ZATRZYMANA
    if (!this.isRunning) {
      this.addLog(`[${accountName}] ⏹️ Automatyzacja zatrzymana - pomijam`, 'warning');
      return;
    }

    const logPrefix = `[${accountName}]`;
    this.addLog(`\n${logPrefix} Inicjalizuję przeglądarkę Playwright...`, 'info');

    // Znajdź Chrome
    const executablePath = this.findChromePath();

    // Wygeneruj fingerprint dla tego konta
    const fingerprint = this.fingerprintManager.generateFingerprint(accountIndex);

    // Playwright launch options z proxy per konto
    const launchOptions = {
      headless: false,
      executablePath: executablePath || undefined,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
        '--disable-blink-features=AutomationControlled',
        '--start-maximized',
        '--disable-infobars',
        '--disable-dev-shm-usage',
        '--no-first-run'
      ]
    };

    // Dodaj proxy jeśli przypisane do konta
    if (proxy && proxy.host && proxy.port) {
      launchOptions.proxy = {
        server: `http://${proxy.host}:${proxy.port}`,
        username: proxy.username || undefined,
        password: proxy.password || undefined
      };
      this.addLog(`${logPrefix} 🌐 Używam proxy: ${proxy.name || proxy.host}:${proxy.port}`, 'info');
    } else {
      this.addLog(`${logPrefix} 🔓 Bez proxy`, 'info');
    }

    let browser = null;
    let context = null;
    let page = null;

    try {
      // Uruchom osobną instancję przeglądarki dla tego konta (Playwright)
      browser = await chromium.launch(launchOptions);

      // Playwright: context z fingerprint settings
      context = await browser.newContext({
        viewport: { width: 1366, height: 768 },
        userAgent: fingerprint.userAgent,
        locale: fingerprint.locale,
        timezoneId: fingerprint.timezone
      });

      // Wstrzyknij skrypty stealth
      const stealthScripts = this.fingerprintManager.getStealthScripts(fingerprint);
      for (const script of stealthScripts) {
        await context.addInitScript(script);
      }

      page = await context.newPage();

      // Załaduj cookies
      const parsedCookies = JSON.parse(cookies);
      const normalizedCookies = parsedCookies.map(cookie => ({
        name: cookie.name,
        value: cookie.value,
        domain: cookie.domain,
        path: cookie.path || '/',
        secure: cookie.secure !== undefined ? cookie.secure : false,
        httpOnly: cookie.httpOnly !== undefined ? cookie.httpOnly : false,
        sameSite: cookie.sameSite === 'no_restriction' ? 'None' :
                 cookie.sameSite === 'lax' ? 'Lax' :
                 cookie.sameSite === 'strict' ? 'Strict' : 'None',
        expires: cookie.expirationDate ? cookie.expirationDate : undefined
      }));

      // Playwright: addCookies na context
      await context.addCookies(normalizedCookies);
      this.addLog(`${logPrefix} ✅ Cookies załadowane`, 'success');

      // Przejdź na Facebook z lepszym timeout handling
      this.addLog(`${logPrefix} Otwieram Facebook...`, 'info');

      try {
        // Użyj domcontentloaded zamiast networkidle (szybsze i stabilniejsze)
        await page.goto('https://www.facebook.com/', {
          waitUntil: 'domcontentloaded',
          timeout: 45000
        });
        // Poczekaj na załadowanie strony
        await page.waitForLoadState('load', { timeout: 30000 }).catch(() => {});
      } catch (navError) {
        this.addLog(`${logPrefix} ⚠️ Timeout nawigacji: ${navError.message}`, 'warning');
        // Spróbuj kontynuować jeśli strona częściowo się załadowała
      }

      await randomDelay(3000, 5000);

      // SPRAWDŹ CZY AUTOMATYZACJA NIE ZOSTAŁA ZATRZYMANA
      if (!this.isRunning) {
        this.addLog(`${logPrefix} ⏹️ Automatyzacja zatrzymana`, 'warning');
        await browser.close();
        return;
      }

      // DOKŁADNA WERYFIKACJA CZY ZALOGOWANO
      const currentUrl = page.url();
      const isOnLoginPage = currentUrl.includes('login') ||
                           currentUrl.includes('checkpoint') ||
                           currentUrl.includes('/recover');

      // Sprawdź dodatkowe wskaźniki logowania
      const isLoggedIn = await page.evaluate(() => {
        // Sprawdź czy są elementy zalogowanego użytkownika
        const hasNavigation = document.querySelector('[role="navigation"]') !== null;
        const hasLoginForm = document.querySelector('#email') !== null &&
                            document.querySelector('#pass') !== null;
        const hasProfileLinks = document.querySelector('[aria-label*="profil"]') !== null ||
                               document.querySelector('[aria-label*="Profile"]') !== null ||
                               document.querySelector('[aria-label*="konto"]') !== null ||
                               document.querySelector('[aria-label*="Account"]') !== null;

        return hasNavigation && !hasLoginForm;
      }).catch(() => false);

      if (isOnLoginPage || !isLoggedIn) {
        this.addLog(`${logPrefix} ❌ NIE ZALOGOWANO - cookies nieważne!`, 'error');
        this.addLog(`${logPrefix} URL: ${currentUrl}`, 'info');

        // Screenshot błędu
        await this.captureErrorScreenshot(page, 'login_failed', task.accountId);

        throw new Error(`Cookies nieważne dla konta ${accountName} - wymagane ponowne logowanie`);
      }

      this.addLog(`${logPrefix} ✅ Zalogowano pomyślnie!`, 'success');

      // Statystyki dla tego konta
      const accountStats = {
        accountId: task.accountId,
        accountName: accountName,
        successfulPosts: [],
        failedPosts: [],
        totalAttempted: 0
      };

      // =============================================
      // SYSTEM KOLEJKOWANIA: Pobieraj posty z współdzielonej kolejki
      // =============================================
      let postIndex = 0;

      while (true) {
        // SPRAWDŹ CZY AUTOMATYZACJA NIE ZOSTAŁA ZATRZYMANA
        if (!this.isRunning) {
          this.addLog(`${logPrefix} ⏹️ Automatyzacja zatrzymana - przerywam postowanie`, 'warning');
          break;
        }

        // Sprawdź czy to konto nie zostało zatrzymane
        if (task.stoppedAccounts.has(task.accountId)) {
          this.addLog(`${logPrefix} ⏹️ Konto zatrzymane - przerywam postowanie`, 'warning');
          break;
        }

        // Sprawdź globalny flag stopu
        if (task.getGlobalStopFlag()) {
          this.addLog(`${logPrefix} 🛑 Globalny stop - przerywam postowanie`, 'error');
          break;
        }

        // Pobierz następny post z kolejki
        const post = task.getNextPost();
        if (!post) {
          this.addLog(`${logPrefix} ✅ Kolejka pusta - zakończono postowanie`, 'success');
          break;
        }

        postIndex++;
        accountStats.totalAttempted++;
        this.addLog(`${logPrefix} [Post #${postIndex}] Postuję do: ${post.groupLink}`, 'info');

        try {
          await this.postToGroupInline(page, post.groupLink, post.postCopy, accountName);
          accountStats.successfulPosts.push({
            groupLink: post.groupLink,
            groupName: post.groupName || post.groupLink
          });
          const remainingPosts = task.getQueueLength();
          this.addLog(`${logPrefix} ✅ Post opublikowany pomyślnie | Pozostało w kolejce: ${remainingPosts}`, 'success');
        } catch (postError) {
          this.addLog(`${logPrefix} ❌ Błąd publikacji: ${postError.message}`, 'error');

          // Zwróć post do kolejki
          task.returnPostToQueue(post);
          this.addLog(`${logPrefix} 🔄 Post wrócił do kolejki`, 'info');

          // Zatrzymaj to konto
          task.stopAccount(task.accountId, accountName, postError.message);

          accountStats.failedPosts.push({
            groupLink: post.groupLink,
            groupName: post.groupName || post.groupLink,
            error: postError.message
          });

          // Przerwij pętlę dla tego konta
          break;
        }

        // Opóźnienie między postami (jeśli są jeszcze posty)
        if (this.isRunning && !task.getGlobalStopFlag()) {
          // Użyj automatycznego opóźnienia 4-18 min z gaussian distribution
          const delayMs = this.activityLimiter.getDelayBetweenGroups();
          const delayMin = Math.round(delayMs / 60000 * 10) / 10;
          this.addLog(`${logPrefix} ⏳ Czekam ${delayMin} min przed następnym postem...`, 'info');
          await randomDelay(delayMs * 0.95, delayMs * 1.05); // Małe losowe odchylenie ±5%
        }
      }

      this.addLog(`${logPrefix} ✅ Zakończono postowanie (sukces: ${accountStats.successfulPosts.length}, błędy: ${accountStats.failedPosts.length})`, 'success');

      // Zapisz storageState po udanym postowaniu
      try {
        await this.saveStorageState(context, task.accountId);
      } catch (e) {
        // Ignoruj błędy zapisu stanu
      }

      return accountStats; // Zwróć statystyki

    } catch (error) {
      this.addLog(`${logPrefix} ❌ Błąd krytyczny: ${error.message}`, 'error');

      // 📸 SCREENSHOT NA BŁĘDZIE
      if (page) {
        await this.captureErrorScreenshot(page, 'task_error', task.accountId).catch(() => {});
      }

      // Zatrzymaj konto przy błędzie krytycznym (np. złe cookies, timeout logowania)
      if (task.stopAccount) {
        task.stopAccount(task.accountId, accountName, `Błąd krytyczny: ${error.message}`);
      }

      // Zwróć puste statystyki w razie błędu krytycznego
      return {
        accountId: task.accountId,
        accountName: accountName,
        successfulPosts: [],
        failedPosts: [],
        totalAttempted: 0,
        criticalError: error.message
      };
    } finally {
      // Zawsze zamknij przeglądarkę
      if (browser) {
        await browser.close().catch(() => {});
      }
    }
  }

  /**
   * Reaguje na losowe posty w grupie (like/love)
   * @param {Page} page - Playwright page
   * @param {string} logPrefix - Prefix do logów
   * @param {number} count - Ile reakcji dać
   */
  async reactToGroupPosts(page, logPrefix, count = 2) {
    try {
      // Sprawdź czy nie zatrzymano
      if (!this.isRunning) {
        this.addLog(`${logPrefix} ⏹️ Pomijam reakcje - automatyzacja zatrzymana`, 'warning');
        return 0;
      }

      this.addLog(`${logPrefix} 👍 Daję reakcje na posty w grupie...`, 'info');

      // Scrolluj trochę żeby załadować posty
      await page.evaluate(() => window.scrollBy(0, 300));
      await randomDelay(1500, 2500);

      // Znajdź przyciski reakcji - używamy DWÓCH metod (różne wersje Facebooka)
      const reactionButtons = await page.evaluate(() => {
        const buttons = [];

        // METODA 1: Przez aria-label (różne wersje tekstu)
        const candidates = document.querySelectorAll(
          '[aria-label*="Like"], [aria-label*="like"], ' +
          '[aria-label*="Lubię to"], [aria-label*="lubię to"], ' +
          '[aria-label*="Lubię to!"], [aria-label*="lubię to!"]'
        );

        for (const el of candidates) {
          // 1. Musi być w elemencie z role="button"
          const buttonParent = el.closest('[role="button"]') || (el.getAttribute('role') === 'button' ? el : null);
          if (!buttonParent) continue;

          // 2. NIE może być linkiem lub wewnątrz linka
          const isLink = el.tagName === 'A' ||
                        buttonParent.tagName === 'A' ||
                        el.matches('a[role="link"]') ||
                        el.closest('a[role="link"]') ||
                        el.closest('a[href]') ||
                        buttonParent.closest('a[href]');
          if (isLink) continue;

          // 3. NIE może zawierać liczby (licznik reakcji)
          const text = buttonParent.textContent || '';
          const hasNumber = /\d/.test(text);
          if (hasNumber) continue;

          // 4. aria-label NIE może wskazywać na listę
          const ariaLabel = el.getAttribute('aria-label') || buttonParent.getAttribute('aria-label') || '';
          const isReactionList = ariaLabel.toLowerCase().includes('see who reacted') ||
                                ariaLabel.toLowerCase().includes('zobacz kto zareag') ||
                                ariaLabel.toLowerCase().includes('who reacted') ||
                                ariaLabel.toLowerCase().includes('view') ||
                                ariaLabel.toLowerCase().includes('zobacz');
          if (isReactionList) continue;

          // 5. NIE może mieć href ani onclick z href
          const hasHref = buttonParent.hasAttribute('href') ||
                         el.hasAttribute('href') ||
                         (buttonParent.getAttribute('onclick') || '').includes('href');
          if (hasHref) continue;

          // 6. Przycisk musi być widoczny i klikalny
          const rect = buttonParent.getBoundingClientRect();
          const isVisible = rect.width > 0 && rect.height > 0 &&
                          window.getComputedStyle(buttonParent).visibility !== 'hidden' &&
                          window.getComputedStyle(buttonParent).display !== 'none';
          if (!isVisible) continue;

          // Znaleziono właściwy przycisk!
          buttonParent.setAttribute('data-reaction-button', 'true');
          buttons.push(true);
          console.log('DEBUG: Znaleziono przycisk reakcji (aria-label):', ariaLabel);
        }

        // METODA 2: Przez data-ad-rendering-role="like_button" (nowe Facebooki)
        const likeButtons = document.querySelectorAll('[data-ad-rendering-role="like_button"]');
        for (const likeBtn of likeButtons) {
          const buttonParent = likeBtn.closest('[role="button"]');
          if (!buttonParent) continue;

          // Sprawdź czy już nie oznaczyliśmy
          if (buttonParent.hasAttribute('data-reaction-button')) continue;

          // NIE może być linkiem lub wewnątrz linka
          const isLink = likeBtn.tagName === 'A' ||
                        buttonParent.tagName === 'A' ||
                        likeBtn.closest('a[href]') ||
                        buttonParent.closest('a[href]');
          if (isLink) continue;

          // Sprawdź czy nie ma liczby
          const text = buttonParent.textContent || '';
          const hasNumber = /\d/.test(text);
          if (hasNumber) continue;

          // NIE może mieć href
          const hasHref = buttonParent.hasAttribute('href') ||
                         likeBtn.hasAttribute('href');
          if (hasHref) continue;

          // Musi być widoczny
          const rect = buttonParent.getBoundingClientRect();
          const isVisible = rect.width > 0 && rect.height > 0 &&
                          window.getComputedStyle(buttonParent).visibility !== 'hidden' &&
                          window.getComputedStyle(buttonParent).display !== 'none';
          if (!isVisible) continue;

          buttonParent.setAttribute('data-reaction-button', 'true');
          buttons.push(true);
          console.log('DEBUG: Znaleziono przycisk reakcji (data-role)');
        }

        console.log(`DEBUG: Łącznie znaleziono ${buttons.length} przycisków reakcji`);
        return buttons.length;
      });

      if (reactionButtons === 0) {
        this.addLog(`${logPrefix} Nie znaleziono przycisków reakcji`, 'info');
        return 0;
      }

      this.addLog(`${logPrefix} Znaleziono ${reactionButtons} przycisków reakcji`, 'info');

      // Pobierz zaznaczone przyciski
      const markedButtons = await page.$$('[data-reaction-button="true"]');

      // Wybierz losowe przyciski (max count)
      const shuffled = markedButtons.sort(() => 0.5 - Math.random());
      const toReact = shuffled.slice(0, Math.min(count, shuffled.length));

      let reactedCount = 0;
      for (const btn of toReact) {
        // Sprawdź czy nie zatrzymano
        if (!this.isRunning) {
          this.addLog(`${logPrefix} ⏹️ Przerywam reakcje - automatyzacja zatrzymana`, 'warning');
          break;
        }

        try {
          // Sprawdź czy już nie zareagowaliśmy LUB czy to przycisk "Usuń reakcję" / "Zmień reakcję"
          const beforeClick = await btn.evaluate(el => {
            const parent = el.closest('[role="button"]') || el;
            const ariaLabel = parent.getAttribute('aria-label') || '';
            const lowerLabel = ariaLabel.toLowerCase();

            // Sprawdź czy zawiera liczby (np. "Lubię to!: 9 osób")
            const hasNumbers = /\d/.test(ariaLabel);

            return {
              ariaPressed: parent.getAttribute('aria-pressed'),
              ariaLabel: ariaLabel,
              isRemove: lowerLabel.includes('usuń') ||
                       lowerLabel.includes('remove') ||
                       lowerLabel.includes('unlike') ||
                       lowerLabel.includes('zmień') ||
                       lowerLabel.includes('change'),
              hasNumbers: hasNumbers
            };
          }).catch(err => {
            // Element zniknął z DOM
            this.addLog(`${logPrefix} ⚠️ Element zniknął z DOM (${err.message})`, 'warning');
            return { ariaPressed: 'skip', isRemove: false, hasNumbers: false, ariaLabel: 'unknown' };
          });

          if (beforeClick.ariaPressed === 'skip') continue;
          if (beforeClick.ariaPressed === 'true') continue;
          if (beforeClick.isRemove) {
            this.addLog(`${logPrefix} ⏭️ Pomijam - post już ma reakcję (${beforeClick.ariaLabel})`, 'info');
            continue;
          }
          if (beforeClick.hasNumbers) {
            this.addLog(`${logPrefix} ⏭️ Pomijam - to link do listy reakcji (${beforeClick.ariaLabel})`, 'info');
            continue;
          }

          this.addLog(`${logPrefix} 🖱️ Klikam przycisk reakcji (${beforeClick.ariaLabel})`, 'info');

          // Przewiń do widoku i poczekaj (obsługa błędów DOM)
          try {
            await btn.scrollIntoViewIfNeeded();
            await randomDelay(300, 500);
          } catch (scrollErr) {
            this.addLog(`${logPrefix} ⚠️ Scroll failed - element detached (${scrollErr.message})`, 'warning');
            continue; // Skip ten przycisk
          }

          // PRÓBA 1: Użyj HumanMouse do naturalnego kliku
          try {
            const humanMouse = new HumanMouse(page);
            await humanMouse.clickElement(btn, { curve: 'bezier' });
            await randomDelay(4000, 5000); // Zwiększony delay - Facebook potrzebuje czasu
          } catch (mouseErr) {
            // Jeśli HumanMouse zawiedzie, użyj zwykłego click
            this.addLog(`${logPrefix} ⚠️ HumanMouse failed, używam click()`, 'warning');
            await btn.click();
            await randomDelay(4000, 5000);
          }

          // SPRAWDŹ CZY LIKE SIĘ UDAŁ (zmiana stanu)
          const afterClick = await btn.evaluate(el => {
            const parent = el.closest('[role="button"]') || el;
            const newLabel = (parent.getAttribute('aria-label') || '').toLowerCase();
            const ariaPressed = parent.getAttribute('aria-pressed');
            return {
              ariaPressed: ariaPressed,
              ariaLabel: parent.getAttribute('aria-label'),
              success: newLabel.includes('unlike') ||
                      newLabel.includes('cofnij') ||
                      newLabel.includes('remove') ||
                      newLabel.includes('usuń') ||
                      newLabel.includes('zmień') ||
                      ariaPressed === 'true'
            };
          }).catch(err => {
            // Element zniknął/zmienił się - prawdopodobnie like zadziałał
            return { success: true, ariaLabel: 'detached (prawdopodobnie sukces)', ariaPressed: null };
          });

          if (afterClick.success) {
            reactedCount++;
            this.addLog(`${logPrefix} ❤️ Like ${reactedCount}/${count} (${afterClick.ariaLabel})`, 'success');
            await randomDelay(1500, 2500);
            continue;
          }

          // PRÓBA 2: Jeśli nie udało się, sprawdź element ponownie (może zmienił się z opóźnieniem)
          this.addLog(`${logPrefix} 🔄 Sprawdzam ponownie po dodatkowym oczekiwaniu...`, 'info');
          await randomDelay(3000, 4000); // Dodatkowe czekanie

          const recheckAfterDelay = await btn.evaluate(el => {
            const parent = el.closest('[role="button"]') || el;
            const newLabel = (parent.getAttribute('aria-label') || '').toLowerCase();
            const ariaPressed = parent.getAttribute('aria-pressed');
            return {
              ariaPressed: ariaPressed,
              ariaLabel: parent.getAttribute('aria-label'),
              success: newLabel.includes('unlike') ||
                      newLabel.includes('cofnij') ||
                      newLabel.includes('remove') ||
                      newLabel.includes('usuń') ||
                      newLabel.includes('zmień') ||
                      ariaPressed === 'true'
            };
          }).catch(err => {
            // Element zniknął - prawdopodobnie like zadziałał
            return { success: true, ariaLabel: 'detached po delay', ariaPressed: null };
          });

          if (recheckAfterDelay.success) {
            reactedCount++;
            this.addLog(`${logPrefix} ❤️ Like ${reactedCount}/${count} (opóźniona zmiana: ${recheckAfterDelay.ariaLabel})`, 'success');
            await randomDelay(1500, 2500);
            continue;
          }

          // PRÓBA 3: Jeśli NADAL nie zadziałało, spróbuj retry (ALE OSTROŻNIE - może odkliknąć)
          this.addLog(`${logPrefix} 🔄 Ostatnia próba - click retry...`, 'info');

          try {
            await btn.click();
            await randomDelay(3000, 4000);
          } catch (clickErr) {
            this.addLog(`${logPrefix} ⚠️ Click retry failed: ${clickErr.message}`, 'warning');
            continue;
          }

          // Sprawdź ponownie
          const afterRetry = await btn.evaluate(el => {
            const parent = el.closest('[role="button"]') || el;
            const newLabel = (parent.getAttribute('aria-label') || '').toLowerCase();
            const ariaPressed = parent.getAttribute('aria-pressed');
            return {
              ariaPressed: ariaPressed,
              ariaLabel: parent.getAttribute('aria-label'),
              success: newLabel.includes('unlike') ||
                      newLabel.includes('cofnij') ||
                      newLabel.includes('remove') ||
                      newLabel.includes('usuń') ||
                      newLabel.includes('zmień') ||
                      ariaPressed === 'true'
            };
          }).catch(err => {
            return { success: false, ariaLabel: 'detached', ariaPressed: null };
          });

          if (afterRetry.success) {
            reactedCount++;
            this.addLog(`${logPrefix} ❤️ Like ${reactedCount}/${count} (retry sukces)`, 'success');
            await randomDelay(1500, 2500);
            continue;
          }

          // Jeśli nie udało się bezpośrednio, sprawdź czy otworzyło się menu reakcji (picker)
          const pickerHandled = await page.evaluate(() => {
            // Szukaj reaction pickera (nie pełnego modala, ale małe popup menu)
            const picker = document.querySelector('[role="dialog"][aria-label*="React"], [role="toolbar"][aria-label*="React"]') ||
                          Array.from(document.querySelectorAll('[role="dialog"]')).find(d => {
                            const rect = d.getBoundingClientRect();
                            if (rect.width === 0 || rect.height === 0) return false;
                            // Picker jest mały (max ~400px szerokości), lista reakcji jest duża
                            if (rect.width > 500) return false;
                            const text = d.textContent || '';
                            return text.includes('Like') || text.includes('Lubię') ||
                                   text.includes('Love') || text.includes('Haha');
                          });

            if (picker) {
              console.log('DEBUG: Znaleziono reaction picker, wybieram Like');
              // Szukaj przycisku Like w pickerze
              const likeInPicker = picker.querySelector('[aria-label*="Like"], [aria-label*="Lubię to"]');
              if (likeInPicker) {
                likeInPicker.click();
                return 'selected';
              }
              // Jeśli nie znaleziono, zamknij picker
              document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27 }));
              return 'closed';
            }

            // Sprawdź czy to duży modal z listą osób (nie picker)
            const reactionListModal = Array.from(document.querySelectorAll('[role="dialog"]')).find(d => {
              const rect = d.getBoundingClientRect();
              if (rect.width === 0 || rect.height === 0) return false;
              if (rect.width < 500) return false; // Za mały na listę osób
              const text = d.textContent || '';
              return text.includes('All') || text.includes('Wszyscy');
            });

            if (reactionListModal) {
              console.log('DEBUG: Otworzyło się okno z listą reakcji (nie picker), zamykam');
              const closeBtn = reactionListModal.querySelector('[aria-label*="Close"], [aria-label*="Zamknij"]');
              if (closeBtn) closeBtn.click();
              else document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27 }));
              return 'wrongModal';
            }

            return false;
          });

          if (pickerHandled === 'selected') {
            reactedCount++;
            this.addLog(`${logPrefix} ❤️ Like ${reactedCount}/${count} (przez picker)`, 'success');
            await randomDelay(1500, 2500);
          } else if (pickerHandled === 'wrongModal') {
            this.addLog(`${logPrefix} ⚠️ Kliknięto w listę reakcji (nie przycisk)`, 'warning');
            await randomDelay(800, 1200);
          } else if (pickerHandled === 'closed') {
            this.addLog(`${logPrefix} ⚠️ Picker otwarty ale nie znaleziono Like`, 'warning');
            await randomDelay(800, 1200);
          } else {
            this.addLog(`${logPrefix} ⚠️ Reakcja zawiodła (brak pickera)`, 'warning');
            await randomDelay(500, 1000);
          }

        } catch (e) {
          this.addLog(`${logPrefix} ⚠️ Błąd reakcji: ${e.message}`, 'warning');
        }
      }

      // Scrolluj z powrotem na górę
      await page.evaluate(() => window.scrollTo(0, 0));
      await randomDelay(1000, 2000);

      return reactedCount;
    } catch (error) {
      this.addLog(`${logPrefix} ⚠️ Błąd reakcji: ${error.message}`, 'warning');
      return 0;
    }
  }

  async postToGroupInline(page, groupUrl, message, accountName) {
    // KOPIA postToGroup ale używa page zamiast this.page
    const logPrefix = `[${accountName}]`;

    try {
      this.addLog(`${logPrefix} Postuję do grupy: ${groupUrl}`, 'info');

      // Nawigacja z lepszym timeout handling
      try {
        await page.goto(groupUrl, {
          waitUntil: 'domcontentloaded',
          timeout: 45000
        });
        // Poczekaj na załadowanie treści
        await page.waitForLoadState('load', { timeout: 30000 }).catch(() => {});
      } catch (navError) {
        this.addLog(`${logPrefix} ⚠️ Wolne ładowanie strony: ${navError.message}`, 'warning');
        // Kontynuuj mimo timeout
      }

      await randomDelay(5000, 7000);

      const currentUrl = page.url();
      if (!currentUrl.includes('facebook.com/groups')) {
        throw new Error('Nie udało się przejść do grupy');
      }

      // =============================================
      // REAKCJE PRZED POSTOWANIEM (1-3 losowych reakcji)
      // =============================================
      const reactCount = 1 + Math.floor(Math.random() * 3); // 1-3
      await this.reactToGroupPosts(page, logPrefix, reactCount);

      // Scrolluj na górę
      await page.evaluate(() => window.scrollTo(0, 0));
      await randomDelay(2000, 3000);

      this.addLog(`${logPrefix} Szukam przycisku do tworzenia posta...`, 'info');

      // METODA 1: Znajdź przycisk "Napisz coś..."
      const createPostButton = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('div[role="button"]'));
        
        for (const button of buttons) {
          const text = button.innerText || '';
          const ariaLabel = button.getAttribute('aria-label') || '';
          
          const hasCreateText = 
            text.toLowerCase().includes('napisz coś') ||
            text.toLowerCase().includes('write something') ||
            text.toLowerCase().includes('what\'s on your mind') ||
            text.toLowerCase().includes('co słychać') ||
            ariaLabel.toLowerCase().includes('napisz') ||
            ariaLabel.toLowerCase().includes('write');
          
          const isNotComment = 
            !text.toLowerCase().includes('komentarz') &&
            !text.toLowerCase().includes('comment') &&
            !ariaLabel.toLowerCase().includes('komentarz') &&
            !ariaLabel.toLowerCase().includes('comment');
          
          if (hasCreateText && isNotComment) {
            const rect = button.getBoundingClientRect();
            if (rect.top < window.innerHeight / 2) {
              button.setAttribute('data-post-create-button', 'true');
              return true;
            }
          }
        }
        return false;
      });

      if (createPostButton) {
        await page.evaluate(() => {
          const button = document.querySelector('[data-post-create-button="true"]');
          if (button) button.click();
        });
        this.addLog(`${logPrefix} ✅ Kliknięto przycisk tworzenia posta`, 'success');
      } else {
        this.addLog(`${logPrefix} Próbuję alternatywnej metody (XPath)...`, 'info');
        
        const clicked = await page.evaluate(() => {
          const getElementByXpath = (xpath) => {
            return document.evaluate(
              xpath, 
              document, 
              null, 
              XPathResult.FIRST_ORDERED_NODE_TYPE, 
              null
            ).singleNodeValue;
          };
          
          const xpaths = [
            "//span[contains(text(), 'Napisz coś')]",
            "//span[contains(text(), 'Write something')]",
            "//div[contains(text(), 'Napisz coś')]",
            "//div[contains(text(), 'Write something')]"
          ];
          
          for (const xpath of xpaths) {
            const element = getElementByXpath(xpath);
            if (element) {
              let parent = element.parentElement;
              let depth = 0;
              while (parent && depth < 10) {
                if (parent.getAttribute('role') === 'button') {
                  parent.click();
                  return true;
                }
                parent = parent.parentElement;
                depth++;
              }
            }
          }
          return false;
        });
        
        if (clicked) {
          this.addLog(`${logPrefix} ✅ Kliknięto przycisk (XPath)`, 'success');
        } else {
          this.addLog(`${logPrefix} Nie znaleziono przycisku, próbuję klawiaturą...`, 'warning');
          await page.keyboard.press('Tab');
          await randomDelay(500, 1000);
          await page.keyboard.press('Enter');
        }
      }

      // Poczekaj na modal - zwiększony czas dla wolniejszych połączeń
      this.addLog(`${logPrefix} Czekam na otwarcie okna...`, 'info');
      await randomDelay(5000, 7000);

      // Znajdź pole tekstowe - TYLKO w modalu, NIE w komentarzach
      this.addLog(`${logPrefix} Szukam pola tekstowego w modalu...`, 'info');

      // Facebook ma wiele modali [role="dialog"] jednocześnie (cookies, powiadomienia, etc)
      // NIE możemy użyć waitForSelector('[role="dialog"]') bo czeka na PIERWSZY
      // Musimy przeszukać WSZYSTKIE modale i znaleźć ten z polem tekstowym

      // Poczekaj aż pole textarea pojawi się W JAKIMKOLWIEK widocznym modalu
      // Facebook ładuje pole tekstowe dynamicznie - używamy retry logic
      let textAreaFound = { found: false };
      let attempts = 0;
      const maxAttempts = 15; // 15 prób x 1 sekunda = 15 sekund

      while (!textAreaFound.found && attempts < maxAttempts) {
        await randomDelay(1000, 1200);
        attempts++;

        textAreaFound = await page.evaluate((attemptNum) => {
          // Znajdź WSZYSTKIE modale (może być 3+ jednocześnie!)
          const modals = Array.from(document.querySelectorAll('[role="dialog"]'));
          console.log(`DEBUG: Próba ${attemptNum}: Znaleziono ${modals.length} modali na stronie`);

          if (modals.length === 0) {
            return { found: false, reason: 'Brak modali [role="dialog"]' };
          }

          // Przeszukaj KAŻDY modal szukając pola tekstowego
          for (let modalIndex = 0; modalIndex < modals.length; modalIndex++) {
            const modal = modals[modalIndex];

            // Sprawdź czy modal jest widoczny
            const modalRect = modal.getBoundingClientRect();
            const isModalVisible = modalRect.width > 0 && modalRect.height > 0;

            console.log(`DEBUG: Modal ${modalIndex}: visible=${isModalVisible}`);

            if (!isModalVisible) continue;

            // Szukaj textarea W TYM modalu
            const textAreas = Array.from(modal.querySelectorAll('div[contenteditable="true"][role="textbox"]'));
            console.log(`DEBUG: Modal ${modalIndex}: ${textAreas.length} pól textarea`);

            for (let i = 0; i < textAreas.length; i++) {
              const area = textAreas[i];
              const rect = area.getBoundingClientRect();
              const isVisible = rect.width > 0 && rect.height > 0 &&
                              rect.top >= 0 && rect.top < window.innerHeight;

              // Sprawdź czy to NIE jest pole komentarza
              const ariaLabel = area.getAttribute('aria-label') || '';
              const placeholder = area.getAttribute('aria-placeholder') || '';
              const isCommentField = ariaLabel.toLowerCase().includes('komentarz') ||
                                    ariaLabel.toLowerCase().includes('comment') ||
                                    placeholder.toLowerCase().includes('komentarz') ||
                                    placeholder.toLowerCase().includes('comment');

              console.log(`DEBUG: Modal ${modalIndex}, Pole ${i}: visible=${isVisible}, isComment=${isCommentField}, label="${ariaLabel}"`);

              if (isVisible && !isCommentField) {
                area.setAttribute('data-post-textarea', 'true');
                console.log(`DEBUG: ✅ Znaleziono pole w modalu ${modalIndex}`);
                return { found: true, modalIndex: modalIndex };
              }
            }
          }

          return { found: false, reason: `Sprawdzono ${modals.length} modali - brak widocznego pola tekstowego` };
        }, attempts).catch(err => {
          return { found: false, reason: `Błąd evaluate: ${err.message}` };
        });

        if (textAreaFound.found) {
          this.addLog(`${logPrefix} ✅ Pole tekstowe znalezione po ${attempts} próbach (modal #${textAreaFound.modalIndex || 0})`, 'success');
          break;
        }
      }

      if (!textAreaFound.found) {
        // Debug screenshot przed błędem
        await this.captureErrorScreenshot(page, 'modal_textarea_not_found', accountName).catch(() => {});

        this.addLog(`${logPrefix} ❌ Debug: ${textAreaFound.reason} (po ${attempts} próbach)`, 'error');
        throw new Error(`Nie znaleziono pola tekstowego w modalu: ${textAreaFound.reason}`);
      }

      // Kliknij w pole i upewnij się że jest NAPRAWDĘ aktywne
      this.addLog(`${logPrefix} Aktywuję pole tekstowe...`, 'info');

      // Wielokrotne próby aktywacji pola
      let activationAttempts = 0;
      let fieldActivated = null;

      while (activationAttempts < 3) {
        fieldActivated = await page.evaluate(() => {
          const area = document.querySelector('[data-post-textarea="true"]');
          if (!area) return { success: false };

          // Kliknij wielokrotnie i focus
          area.scrollIntoView({ behavior: 'smooth', block: 'center' });
          area.click();
          area.focus();

          // Poczekaj chwilę na aktywację
          return new Promise(resolve => {
            setTimeout(() => {
              const rect = area.getBoundingClientRect();
              const isFocused = document.activeElement === area;
              const isEditable = area.getAttribute('contenteditable') === 'true';

              resolve({
                success: isFocused && isEditable,
                visible: rect.width > 0 && rect.height > 0,
                focused: isFocused,
                editable: isEditable
              });
            }, 500);
          });
        });

        if (fieldActivated.success) {
          this.addLog(`${logPrefix} ✅ Pole aktywne: widoczne=${fieldActivated.visible}, focus=${fieldActivated.focused}, editable=${fieldActivated.editable}`, 'success');
          break;
        }

        activationAttempts++;
        this.addLog(`${logPrefix} ⚠️ Próba aktywacji ${activationAttempts}/3...`, 'warning');
        await randomDelay(1000, 1500);
      }

      if (!fieldActivated || !fieldActivated.success) {
        throw new Error('Nie udało się aktywować pola tekstowego po 3 próbach');
      }

      await randomDelay(1000, 1500);
      
      this.addLog(`${logPrefix} Wklejam treść posta...`, 'info');
      
      // keyboard.type() z Shift+Enter dla wieloliniowego tekstu
      try {
        await page.evaluate(() => {
          const area = document.querySelector('[data-post-textarea="true"]');
          if (area) {
            area.focus();
            area.click();
          }
        });
        
        await randomDelay(500, 1000);
        
        // Wpisz tekst używając keyboard - po linii
        const lines = message.split('\n');
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          
          if (line.length > 0) {
            await page.keyboard.type(line, { delay: 50 });
          }
          
          // Jeśli nie ostatnia linia, dodaj nową linię (Shift+Enter)
          if (i < lines.length - 1) {
            await page.keyboard.down('Shift');
            await page.keyboard.press('Enter');
            await page.keyboard.up('Shift');
            await randomDelay(100, 200);
          }
        }
        
        this.addLog(`${logPrefix} ✅ Wpisano ${message.length} znaków`, 'success');
        
        // Weryfikuj że tekst jest w polu
        await randomDelay(1000, 1500);
        
        const verifyText = await page.evaluate(() => {
          const area = document.querySelector('[data-post-textarea="true"]');
          if (!area) return '';
          return (area.textContent || area.innerText || '').trim();
        });
        
        if (verifyText.length < 10) {
          throw new Error(`Tekst nie pojawił się w polu - tylko ${verifyText.length} znaków`);
        }
        
        this.addLog(`${logPrefix} ✅ Weryfikacja OK: ${verifyText.length} znaków w polu`, 'success');
        
      } catch (error) {
        this.addLog(`${logPrefix} ❌ Błąd wpisywania: ${error.message}`, 'error');
        throw new Error(`Nie udało się wpisać treści: ${error.message}`);
      }
      
      // Czekaj 10 sekund
      this.addLog(`${logPrefix} Czekam 10 sekund...`, 'info');
      await randomDelay(10000, 10500);

      // Znajdź przycisk Opublikuj
      this.addLog(`${logPrefix} Szukam przycisku publikacji...`, 'info');
      
      const publishClicked = await page.evaluate(() => {
        const getElementByXpath = (xpath) => {
          return document.evaluate(
            xpath, 
            document, 
            null, 
            XPathResult.FIRST_ORDERED_NODE_TYPE, 
            null
          ).singleNodeValue;
        };
        
        // Spróbuj XPath najpierw
        const xpaths = [
          "//span[text()='Opublikuj']",
          "//span[text()='Post']",
          "//div[text()='Opublikuj']",
          "//div[text()='Post']"
        ];
        
        for (const xpath of xpaths) {
          const element = getElementByXpath(xpath);
          if (element) {
            let parent = element.parentElement;
            let depth = 0;
            while (parent && depth < 10) {
              if (parent.getAttribute('role') === 'button') {
                parent.click();
                return true;
              }
              parent = parent.parentElement;
              depth++;
            }
          }
        }
        
        // Fallback - znajdź przycisk w modalu
        const modal = document.querySelector('[role="dialog"]');
        if (modal) {
          const buttons = Array.from(modal.querySelectorAll('div[role="button"]'));
          for (const btn of buttons) {
            const text = btn.innerText || '';
            const ariaLabel = btn.getAttribute('aria-label') || '';
            
            if (text.includes('Opublikuj') || text.includes('Post') ||
                ariaLabel.includes('Opublikuj') || ariaLabel.includes('Post')) {
              btn.click();
              return true;
            }
          }
        }
        
        return false;
      });
      
      if (!publishClicked) {
        throw new Error('Nie znaleziono przycisku Opublikuj');
      }
      
      this.addLog(`${logPrefix} ✅ Kliknięto publikuj`, 'success');

      // Czekaj dłużej - Facebook może ładować komunikat z opóźnieniem
      this.addLog(`${logPrefix} ⏳ Czekam na potwierdzenie publikacji lub błąd...`, 'info');
      await randomDelay(15000, 20000); // Zwiększone z 8-12s do 15-20s

      // =============================================
      // SPRAWDŹ CZY FACEBOOK NIE POKAZAŁ OGRANICZENIA
      // =============================================
      const restriction = await page.evaluate(() => {
        console.log('DEBUG: Sprawdzam ograniczenia FB...');

        // Polskie i angielskie wersje komunikatów o ograniczeniach
        const restrictionKeywords = [
          'ograniczeni',
          'ograniczamy liczbę',
          'liczbę publikowanych',
          'chronić społeczność',
          'temporarily blocked',
          'tymczasowo zablokowa',
          'can\'t post',
          'nie możesz publikować',
          'nie można opublikować',
          'something went wrong',
          'coś poszło nie tak',
          'try again later',
          'spróbuj później',
          'spróbuj ponownie',
          'action blocked',
          'akcja zablokowana',
          'posting too',
          'zbyt wiele',
          'you\'re posting',
          'publikujesz zbyt',
          'slow down',
          'zwolnij',
          'spam',
          'inappropriate',
          'niewłaściwe',
          'violat', // violation, naruszenie
          'naruszen',
          'against our',
          'sprzeczn',
          'rate limit',
          'limit'
        ];

        // Znajdź WSZYSTKIE modale
        const modals = Array.from(document.querySelectorAll('[role="dialog"]'));
        console.log(`DEBUG: Znaleziono ${modals.length} modali`);

        for (let i = 0; i < modals.length; i++) {
          const modal = modals[i];
          const rect = modal.getBoundingClientRect();
          const isVisible = rect.width > 0 && rect.height > 0;

          if (!isVisible) continue;

          const text = modal.textContent || modal.innerText || '';
          const lowerText = text.toLowerCase();

          // WAŻNE: Modal "Utwórz post" zawiera treść posta użytkownika
          // Sprawdzaj TYLKO w alertach/error messages, NIE w textarea z postem
          const heading = modal.querySelector('[role="heading"], h2, h3, [aria-label*="Create"], [aria-label*="Utwórz"]');
          const headingText = heading ? heading.textContent.toLowerCase() : '';
          const isCreatePostModal = headingText.includes('utwórz post') ||
                                   headingText.includes('create post') ||
                                   headingText.includes('create a post') ||
                                   headingText.includes('publishing') ||
                                   headingText.includes('publikuj');

          if (isCreatePostModal) {
            console.log(`DEBUG: Modal ${i + 1} to modal tworzenia posta, sprawdzam wszystkie divy (z wyjątkiem textarea/input)`);

            // Zbierz treść z textarea/input (treść posta użytkownika) aby ją pominąć
            const userInputs = modal.querySelectorAll('textarea, input[type="text"], [contenteditable="true"]');
            const userTexts = Array.from(userInputs).map(el => (el.value || el.textContent || '').toLowerCase());

            // Sprawdzaj WSZYSTKIE divy w modalu (nie tylko z role="alert")
            const allDivs = modal.querySelectorAll('div, span, p');
            console.log(`DEBUG: Znaleziono ${allDivs.length} elementów w modalu tworzenia posta`);

            for (const div of allDivs) {
              // Pomiń puste elementy
              const divText = (div.textContent || '').trim();
              if (divText.length < 50) continue; // Komunikat o ograniczeniu ma więcej niż 50 znaków

              const divLower = divText.toLowerCase();

              // Pomiń jeśli to treść posta użytkownika
              let isUserContent = false;
              for (const userText of userTexts) {
                if (userText.length > 10 && divLower.includes(userText)) {
                  isUserContent = true;
                  break;
                }
              }
              if (isUserContent) continue;

              // Sprawdź słowa kluczowe
              for (const keyword of restrictionKeywords) {
                if (divLower.includes(keyword)) {
                  console.log(`DEBUG: WYKRYTO OGRANICZENIE W MODALU TWORZENIA POSTA: "${keyword}"`);
                  console.log(`DEBUG: Tekst: "${divText.substring(0, 200)}..."`);
                  return {
                    detected: true,
                    message: divText.substring(0, 400),
                    keyword: keyword,
                    source: 'createPostModalDiv',
                    fullText: divText
                  };
                }
              }
            }

            continue; // Jeśli nie znaleziono, kontynuuj do następnego modala
          }

          console.log(`DEBUG: Modal ${i + 1} (${rect.width}x${rect.height}): "${text.substring(0, 100)}..."`);

          for (const keyword of restrictionKeywords) {
            if (lowerText.includes(keyword)) {
              console.log(`DEBUG: WYKRYTO SŁOWO KLUCZOWE: "${keyword}"`);

              // Znajdź dokładny tekst komunikatu
              const errorDiv = modal.querySelector('[role="heading"]') ||
                              modal.querySelector('h2') ||
                              modal.querySelector('h3') ||
                              modal.querySelector('div[style*="font-weight"]') ||
                              modal.querySelector('span[dir="auto"]');

              const message = errorDiv ? errorDiv.textContent : text.substring(0, 300);

              return {
                detected: true,
                message: message.trim(),
                keyword: keyword,
                fullText: text.substring(0, 500)
              };
            }
          }
        }

        // Sprawdź alerty/bannery (nie całą stronę - może być false positive z treścią posta)
        const alerts = document.querySelectorAll('[role="alert"], [role="alertdialog"], [role="banner"]');
        console.log(`DEBUG: Znaleziono ${alerts.length} alertów/bannerów`);

        for (const alert of alerts) {
          const alertText = (alert.textContent || '').toLowerCase();
          if (alertText.length > 10) { // Tylko niepuste alerty
            for (const keyword of restrictionKeywords) {
              if (alertText.includes(keyword)) {
                console.log(`DEBUG: WYKRYTO SŁOWO W ALERCIE: "${keyword}"`);
                return {
                  detected: true,
                  message: alert.textContent.substring(0, 300),
                  keyword: keyword,
                  source: 'alert'
                };
              }
            }
          }
        }

        console.log('DEBUG: Nie wykryto ograniczenia');
        return {
          detected: false,
          modalsCount: modals.length,
          modalsText: modals.map(m => (m.textContent || '').substring(0, 100)).join(' | ')
        };
      });

      // Loguj wynik detekcji
      this.addLog(`${logPrefix} 🔍 Detekcja ograniczenia: ${restriction.detected ? 'TAK' : 'NIE'}`, 'info');

      if (!restriction.detected && restriction.modalsCount > 0) {
        this.addLog(`${logPrefix} 📋 Znaleziono ${restriction.modalsCount} modali bez słów kluczowych`, 'info');
        this.addLog(`${logPrefix} 📝 Fragmenty: ${restriction.modalsText}`, 'info');
      }

      if (restriction.detected) {
        this.addLog(`${logPrefix} 🚫 FACEBOOK OGRANICZENIE WYKRYTE!`, 'error');
        this.addLog(`${logPrefix} 🔑 Słowo kluczowe: "${restriction.keyword}"`, 'error');
        this.addLog(`${logPrefix} 📄 Komunikat: ${restriction.message}`, 'error');

        if (restriction.fullText) {
          this.addLog(`${logPrefix} 📋 Pełny tekst: ${restriction.fullText}`, 'error');
        }

        // 📸 SCREENSHOT OGRANICZENIA
        await this.captureErrorScreenshot(page, 'facebook_restriction', accountName).catch(() => {});

        // Oznacz konto jako zbanowane
        this.activityLimiter.markAsBanned();

        throw new Error(`Facebook ograniczył postowanie: ${restriction.message}`);
      }

      this.addLog(`${logPrefix} ✅ Post opublikowany pomyślnie!`, 'success');

      // =============================================
      // REAKCJE PO POSTOWANIU (1-2 losowych reakcji)
      // =============================================
      await randomDelay(3000, 5000); // Poczekaj chwilę po publikacji
      const postReactCount = 1 + Math.floor(Math.random() * 2); // 1-2
      await this.reactToGroupPosts(page, logPrefix, postReactCount);

    } catch (error) {
      this.addLog(`${logPrefix} ❌ Błąd postowania: ${error.message}`, 'error');

      // 📸 SCREENSHOT NA BŁĘDZIE
      await this.captureErrorScreenshot(page, 'posting_error', accountName).catch(() => {});

      throw error;
    }
  }

  getRandomUserAgent() {
    const userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    ];
    return userAgents[Math.floor(Math.random() * userAgents.length)];
  }

  async login(credentials) {
    this.addLog('Loguję się do Facebooka...', 'info');
    
    const hasCookies = this.store.get('cookies');
    
    if (hasCookies) {
      this.addLog('Sprawdzam zapisaną sesję...', 'info');
      await this.page.goto('https://www.facebook.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await randomDelay(3000, 5000);
      
      // Sprawdź URL - jeśli nie przekierowuje na login, prawdopodobnie jesteśmy zalogowani
      const currentUrl = this.page.url();
      const notOnLoginPage = !currentUrl.includes('/login') && 
                            !currentUrl.includes('login.php');
      
      // Sprawdź czy są pola logowania
      const loginFieldsExist = await this.page.evaluate(() => {
        return document.querySelector('#email') !== null &&
               document.querySelector('#pass') !== null;
      });
      
      // Jeśli NIE MA pól logowania i NIE jesteśmy na stronie login = zalogowani
      if (notOnLoginPage && !loginFieldsExist) {
        this.addLog('✅ Zalogowano używając zapisanej sesji!', 'success');
        return;
      } else {
        this.addLog('Zapisana sesja wygasła, loguję od nowa...', 'info');
        await this.clearCookies();
      }
    }
    
    // Standardowe logowanie
    const currentUrl = this.page.url();
    
    // Jeśli już jesteśmy na Facebooku, sprawdź czy są pola logowania
    if (!currentUrl.includes('facebook.com')) {
      await this.page.goto('https://www.facebook.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await randomDelay(2000, 4000);
    }
    
    // Sprawdź czy pola logowania istnieją
    try {
      await this.page.waitForSelector('#email', { timeout: 5000 });
    } catch (e) {
      // Brak pól logowania = jesteśmy już zalogowani
      this.addLog('✅ Już zalogowany!', 'success');
      await this.saveCookies();
      return;
    }

    await randomTyping(this.page, '#email', credentials.email);
    await randomDelay(800, 1500);
    
    await randomTyping(this.page, '#pass', credentials.password);
    await randomDelay(800, 1500);
    
    await this.page.click('button[name="login"]');
    await this.page.waitForLoadState('networkidle', { timeout: 15000 });
    
    await this.checkForVerification();
    
    await this.saveCookies();
    
    this.addLog('Zalogowano pomyślnie!', 'success');
  }

  async checkForVerification() {
    const currentUrl = this.page.url();
    
    // Lista możliwych checkpointów Facebook (TYLKO URL)
    const checkpointPatterns = [
      'checkpoint',
      'captcha',
      'two_step_verification',
      'auth/2fa',
      'secure_account',
      'login/device-based',
      'login/identify',
      'checkpoint/block'
    ];
    
    // Sprawdź URL - to najbardziej pewny wskaźnik
    const hasCheckpoint = checkpointPatterns.some(pattern => currentUrl.includes(pattern));
    
    if (hasCheckpoint) {
      this.addLog('⚠️  WYKRYTO WERYFIKACJĘ FACEBOOK (URL)!', 'warning');
      this.addLog(`URL: ${currentUrl}`, 'info');
      await this.handleVerificationScreen();
      return;
    }
    
    // Sprawdź TYLKO specyficzne kombinacje tekstu (false positive prevention)
    try {
      const needsVerification = await this.page.evaluate(() => {
        const pageText = document.body.innerText.toLowerCase();
        
        // KLUCZOWE frazy które NAPRAWDĘ oznaczają weryfikację
        const criticalPhrases = [
          'potwierdź swoją tożsamość',
          'confirm your identity',
          'nietypowa aktywność została wykryta',
          'unusual activity detected',
          'zabezpiecz swoje konto',
          'secure your account now',
          'wprowadź kod z sms',
          'enter the code we sent',
          'dwuetapowa weryfikacja jest włączona',
          'two-factor authentication is on',
          'zatwierdź logowanie',
          'approve this login',
          'captcha verification'
        ];
        
        // Sprawdź czy któraś z kluczowych fraz występuje
        for (const phrase of criticalPhrases) {
          if (pageText.includes(phrase)) {
            return { detected: true, phrase };
          }
        }
        
        // Sprawdź czy jest input na kod weryfikacyjny (6 cyfr)
        const codeInputs = Array.from(document.querySelectorAll('input[type="text"], input[type="tel"]'));
        const hasVerificationCodeInput = codeInputs.some(input => {
          const placeholder = (input.placeholder || '').toLowerCase();
          const ariaLabel = (input.getAttribute('aria-label') || '').toLowerCase();
          return placeholder.includes('kod') || 
                 placeholder.includes('code') ||
                 ariaLabel.includes('verification') ||
                 ariaLabel.includes('weryfikacj');
        });
        
        if (hasVerificationCodeInput) {
          // Dodatkowo sprawdź czy jest tekst o weryfikacji w pobliżu
          const hasVerifyText = pageText.includes('weryfikacj') || 
                               pageText.includes('verification') ||
                               pageText.includes('2fa');
          
          if (hasVerifyText) {
            return { detected: true, phrase: 'input weryfikacyjny wykryty' };
          }
        }
        
        return { detected: false };
      });
      
      if (needsVerification.detected) {
        this.addLog('⚠️  WYKRYTO PROŚBĘ O WERYFIKACJĘ!', 'warning');
        this.addLog(`Fraza: ${needsVerification.phrase}`, 'info');
        await this.handleVerificationScreen();
        return;
      }
      
    } catch (error) {
      // Kontynuuj jeśli nie można sprawdzić tekstu
    }
    
    // WYŁĄCZONE: Zbyt czułe selektory powodują false positive
    // Sprawdzanie URL i tekstu jest wystarczające
    //
    // // Sprawdź selektory weryfikacyjne
    // const verificationSelectors = [
    //   'div[role="dialog"]', // ❌ Modalne okna - WSZĘDZIE na FB!
    //   'input[name="approvals_code"]', // Kod 2FA
    //   'button[value="dont_save"]', // Nie zapisuj przeglądarki
    //   'button[value="OK"]', // ❌ Przyciski OK - WSZĘDZIE!
    //   'div[data-testid="sec_ac_button"]' // Przyciski bezpieczeństwa
    // ];
    //
    // for (const selector of verificationSelectors) {
    //   try {
    //     const element = await this.page.$(selector);
    //     if (element) {
    //       const elementText = await this.page.evaluate(el => el.innerText, element);
    //       if (elementText && elementText.length > 0) {
    //         this.addLog('⚠️  WYKRYTO ELEMENT WERYFIKACYJNY!', 'warning');
    //         await this.handleVerificationScreen();
    //         return;
    //       }
    //     }
    //   } catch (e) {
    //     // Kontynuuj sprawdzanie
    //   }
    // }
  }

  async handleVerificationScreen() {
    this.addLog('═════════════════════════════════════', 'warning');
    this.addLog('🛑 WYMAGANA JEST TWOJA INTERWENCJA!', 'warning');
    this.addLog('═════════════════════════════════════', 'warning');
    this.addLog('', 'info');
    this.addLog('Facebook wymaga weryfikacji:', 'warning');
    this.addLog('• Potwierdź logowanie na innym urządzeniu', 'info');
    this.addLog('• Wprowadź kod 2FA (jeśli masz)', 'info');
    this.addLog('• Rozwiąż CAPTCHA', 'info');
    this.addLog('• Zatwierdź nietypową aktywność', 'info');
    this.addLog('', 'info');
    this.addLog('🖱️  INSTRUKCJA:', 'warning');
    this.addLog('1. Przejdź do okna przeglądarki', 'info');
    this.addLog('2. Wykonaj wymaganą weryfikację', 'info');
    this.addLog('3. Poczekaj aż Facebook Cię wpuści', 'info');
    this.addLog('4. Automatyzacja wznowi się automatycznie', 'info');
    this.addLog('', 'info');
    this.addLog('⏰ Czekam na Ciebie... (max 5 minut)', 'warning');
    this.addLog('═════════════════════════════════════', 'warning');
    
    // Powiadomienie systemowe
    this.emit('verification-required', {
      message: 'Facebook wymaga weryfikacji!',
      details: 'Przejdź do przeglądarki i potwierdź logowanie'
    });
    
    // Wstrzymaj automatyzację
    this.isPaused = true;
    this.emit('status-change', this.getStatus());
    
    // Czekaj aż użytkownik przejdzie weryfikację (max 5 minut)
    const maxWaitTime = 5 * 60 * 1000; // 5 minut
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitTime) {
      await randomDelay(8000, 12000); // Zwiększone opóźnienie między sprawdzeniami
      
      const currentUrl = this.page.url();
      
      // Sprawdź czy użytkownik przeszedł weryfikację
      const isOnFacebook = currentUrl.includes('facebook.com') && 
                          !currentUrl.includes('checkpoint') &&
                          !currentUrl.includes('captcha') &&
                          !currentUrl.includes('verify');
      
      if (isOnFacebook) {
        // DOKŁADNA WERYFIKACJA - czy faktycznie jesteśmy zalogowani
        try {
          // Sprawdzenie 1: Czy mamy element nawigacyjny Facebooka
          const hasNavigation = await this.page.evaluate(() => {
            return document.querySelector('[aria-label="Facebook"]') !== null ||
                   document.querySelector('div[role="navigation"]') !== null ||
                   document.querySelector('a[href*="/profile"]') !== null;
          });
          
          if (!hasNavigation) {
            this.addLog('⏳ Strona się ładuje, czekam dalej...', 'info');
            continue;
          }
          
          // Sprawdzenie 2: Czy możemy znaleźć typowe elementy zalogowanego użytkownika
          const isLoggedIn = await this.page.evaluate(() => {
            // Szukamy elementów charakterystycznych dla zalogowanej sesji
            const indicators = [
              document.querySelector('div[role="feed"]'), // News feed
              document.querySelector('[data-pagelet="LeftRail"]'), // Lewa kolumna
              document.querySelector('[aria-label*="Profil"]'), // Link do profilu
              document.querySelector('[aria-label*="Profile"]'),
              document.querySelector('a[href*="/friends"]'), // Znajomi
              document.querySelector('svg[aria-label="Twój profil"]'),
              document.querySelector('svg[aria-label="Your profile"]')
            ];
            
            // Musimy mieć przynajmniej 2 z tych elementów
            const foundIndicators = indicators.filter(el => el !== null).length;
            return foundIndicators >= 2;
          });
          
          if (isLoggedIn) {
            this.addLog('✅ Weryfikacja zakończona pomyślnie!', 'success');
            this.addLog('Potwierdzono, że jesteś zalogowany', 'success');
            this.addLog('Czekam jeszcze 10 sekund na pełne załadowanie strony...', 'info');
            
            // WAŻNE: Poczekaj dodatkowe 10 sekund na pełne załadowanie
            await randomDelay(10000, 12000);
            
            this.addLog('Wznawianie automatyzacji...', 'info');
            this.isPaused = false;
            this.emit('status-change', this.getStatus());
            
            // Jeszcze jedna krótka przerwa przed kontynuacją
            await randomDelay(3000, 5000);
            return;
          } else {
            this.addLog('⏳ Strona Facebooka załadowana, ale nie potwierdzono logowania. Czekam dalej...', 'info');
          }
        } catch (e) {
          this.addLog(`⏳ Błąd sprawdzania: ${e.message}. Kontynuuję czekanie...`, 'info');
          // Kontynuuj czekanie
        }
      }
      
      const remainingSeconds = Math.floor((maxWaitTime - (Date.now() - startTime)) / 1000);
      this.addLog(`⏳ Nadal czekam... (${remainingSeconds}s pozostało)`, 'info');
    }
    
    // Timeout
    this.addLog('⏰ Upłynął czas oczekiwania (5 minut)', 'error');
    this.addLog('Przerywam automatyzację - spróbuj ponownie', 'error');
    throw new Error('Timeout oczekiwania na weryfikację użytkownika');
  }

  async postToGroup(groupUrl, message) {
    try {
      this.addLog(`Postuję do grupy: ${groupUrl}`, 'info');

      await this.page.goto(groupUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await randomDelay(3000, 5000);

      await this.checkForVerification();

      const currentUrl = this.page.url();
      if (!currentUrl.includes('facebook.com/groups')) {
        throw new Error('Nie udało się przejść do grupy');
      }

      // ANTY-BAN: Engagement przed postem (15-60 sekund scroll + ewentualne lajki)
      this.addLog('🔄 Wykonuję engagement przed postem (15-60s scroll)...', 'info');
      await engageWithGroup(this.page);

      // Scrolluj na górę przed postem
      await this.page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
      await randomDelay(2000, 3000);

      this.addLog('Szukam przycisku do tworzenia posta...', 'info');

      // METODA 1: Znajdź przycisk "Napisz coś..." używając evaluate
      const createPostButton = await this.page.evaluate(() => {
        // Znajdź wszystkie div z role="button"
        const buttons = Array.from(document.querySelectorAll('div[role="button"]'));
        
        for (const button of buttons) {
          const text = button.innerText || '';
          const ariaLabel = button.getAttribute('aria-label') || '';
          
          // Szukamy tekstu "Napisz coś" lub podobnego
          const hasCreateText = 
            text.toLowerCase().includes('napisz coś') ||
            text.toLowerCase().includes('write something') ||
            text.toLowerCase().includes('what\'s on your mind') ||
            text.toLowerCase().includes('co słychać') ||
            ariaLabel.toLowerCase().includes('napisz') ||
            ariaLabel.toLowerCase().includes('write');
          
          // Upewnij się że to NIE komentarz
          const isNotComment = 
            !text.toLowerCase().includes('komentarz') &&
            !text.toLowerCase().includes('comment') &&
            !ariaLabel.toLowerCase().includes('komentarz') &&
            !ariaLabel.toLowerCase().includes('comment');
          
          if (hasCreateText && isNotComment) {
            // Sprawdź pozycję na stronie - przycisk do posta jest na górze
            const rect = button.getBoundingClientRect();
            if (rect.top < window.innerHeight / 2) { // Górna połowa ekranu
              button.setAttribute('data-post-create-button', 'true');
              return true;
            }
          }
        }
        return false;
      });

      if (createPostButton) {
        // Kliknij przycisk używając JavaScript (pewniejsze niż .click())
        await this.page.evaluate(() => {
          const button = document.querySelector('[data-post-create-button="true"]');
          if (button) button.click();
        });
        this.addLog('✅ Kliknięto przycisk tworzenia posta', 'success');
      } else {
        // METODA 2: Fallback - użyj XPath do znalezienia tekstu
        this.addLog('Próbuję alternatywnej metody (XPath)...', 'info');
        
        const clicked = await this.page.evaluate(() => {
          // Funkcja pomocnicza XPath
          const getElementByXpath = (xpath) => {
            return document.evaluate(
              xpath, 
              document, 
              null, 
              XPathResult.FIRST_ORDERED_NODE_TYPE, 
              null
            ).singleNodeValue;
          };
          
          // Spróbuj różne XPath queries
          const xpaths = [
            "//span[contains(text(), 'Napisz coś')]",
            "//span[contains(text(), 'Write something')]",
            "//div[contains(text(), 'Napisz coś')]",
            "//div[contains(text(), 'Write something')]"
          ];
          
          for (const xpath of xpaths) {
            const element = getElementByXpath(xpath);
            if (element) {
              // Znajdź najbliższy przycisk (parent z role="button")
              let parent = element.parentElement;
              let depth = 0;
              while (parent && depth < 10) {
                if (parent.getAttribute('role') === 'button') {
                  parent.click();
                  return true;
                }
                parent = parent.parentElement;
                depth++;
              }
            }
          }
          return false;
        });
        
        if (clicked) {
          this.addLog('✅ Kliknięto przycisk (XPath)', 'success');
        } else {
          this.addLog('Nie znaleziono przycisku, próbuję klawiaturą...', 'warning');
          // METODA 3: Ostatnia deska ratunku - Tab + Enter
          await this.page.keyboard.press('Tab');
          await randomDelay(500, 1000);
          await this.page.keyboard.press('Enter');
        }
      }

      // Poczekaj na modal
      this.addLog('Czekam na otwarcie okna...', 'info');
      await randomDelay(4000, 6000);

      // Znajdź pole tekstowe
      this.addLog('Szukam pola tekstowego...', 'info');
      
      const textAreaSelector = 'div[contenteditable="true"][role="textbox"]';
      await this.page.waitForSelector(textAreaSelector, { timeout: 15000 });
      
      // Znajdź widoczne pole w modalu
      const textAreaFound = await this.page.evaluate(() => {
        const textAreas = Array.from(document.querySelectorAll('div[contenteditable="true"][role="textbox"]'));
        
        for (const area of textAreas) {
          const rect = area.getBoundingClientRect();
          const isVisible = rect.width > 0 && rect.height > 0 && 
                          rect.top >= 0 && rect.top < window.innerHeight;
          
          if (isVisible) {
            area.setAttribute('data-post-textarea', 'true');
            return true;
          }
        }
        return false;
      });
      
      if (!textAreaFound) {
        throw new Error('Nie znaleziono pola tekstowego');
      }
      
      // Kliknij w pole i upewnij się że jest aktywne
      this.addLog('Aktywuję pole tekstowe...', 'info');
      
      const fieldActivated = await this.page.evaluate(() => {
        const area = document.querySelector('[data-post-textarea="true"]');
        if (!area) return false;
        
        // Kliknij kilka razy żeby być pewnym
        area.click();
        area.focus();
        
        // Sprawdź czy pole jest widoczne i aktywne
        const rect = area.getBoundingClientRect();
        const isVisible = rect.width > 0 && rect.height > 0;
        const isFocused = document.activeElement === area;
        
        return { 
          found: true, 
          visible: isVisible, 
          focused: isFocused,
          hasAttribute: area.hasAttribute('contenteditable'),
          contenteditable: area.getAttribute('contenteditable')
        };
      });
      
      if (!fieldActivated || !fieldActivated.found) {
        throw new Error('Nie znaleziono pola tekstowego');
      }
      
      this.addLog(`Pole: widoczne=${fieldActivated.visible}, focus=${fieldActivated.focused}, editable=${fieldActivated.contenteditable}`, 'info');
      
      if (!fieldActivated.visible) {
        throw new Error('Pole tekstowe nie jest widoczne');
      }
      
      await randomDelay(1000, 1500);
      
      this.addLog('Wklejam treść posta...', 'info');
      
      // Po wielu próbach okazało się że JEDYNA metoda która działa to keyboard.type()
      // Facebook blokuje:
      // - textContent/innerHTML - wykrywa manipulację DOM
      // - clipboard + Ctrl+V - nie działa w automation
      // 
      // keyboard.type() z delay=0 jest wystarczająco szybkie i Facebook tego nie blokuje
      
      try {
        await this.page.evaluate(() => {
          const area = document.querySelector('[data-post-textarea="true"]');
          if (area) {
            area.focus();
            area.click();
          }
        });
        
        await randomDelay(500, 1000);
        
        // Wpisz tekst używając keyboard - szybko ale bezpiecznie
        const lines = message.split('\n');
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          
          if (line.length > 0) {
            // Wpisz linię - delay=50 to dobry kompromis (nie za szybko, nie za wolno)
            await this.page.keyboard.type(line, { delay: 50 });
          }
          
          // Jeśli nie ostatnia linia, dodaj nową linię (Shift+Enter)
          if (i < lines.length - 1) {
            await this.page.keyboard.down('Shift');
            await this.page.keyboard.press('Enter');
            await this.page.keyboard.up('Shift');
            await randomDelay(100, 200);
          }
        }
        
        this.addLog(`✅ Wpisano ${message.length} znaków`, 'success');
        
        // Weryfikuj że tekst jest w polu
        await randomDelay(1000, 1500);
        
        const verifyText = await this.page.evaluate(() => {
          const area = document.querySelector('[data-post-textarea="true"]');
          if (!area) return '';
          return (area.textContent || area.innerText || '').trim();
        });
        
        if (verifyText.length < 10) {
          throw new Error(`Tekst nie pojawił się w polu - tylko ${verifyText.length} znaków`);
        }
        
        this.addLog(`✅ Weryfikacja OK: ${verifyText.length} znaków w polu`, 'success');
        
      } catch (error) {
        this.addLog(`❌ Błąd wpisywania: ${error.message}`, 'error');
        throw new Error(`Nie udało się wpisać treści: ${error.message}`);
      }
      
      // ZMIANA: Czekaj 10 sekund po wklejeniu
      this.addLog('Czekam 10 sekund...', 'info');
      await randomDelay(10000, 10500);

      // Znajdź przycisk "Opublikuj"
      this.addLog('Szukam przycisku publikacji...', 'info');
      
      // ZMIANA: Uproszczona funkcja klikania - tylko .click(), bez multiple attempts
      const publishClicked = await this.page.evaluate(() => {
        // Funkcja pomocnicza XPath
        const getElementByXpath = (xpath) => {
          return document.evaluate(
            xpath, 
            document, 
            null, 
            XPathResult.FIRST_ORDERED_NODE_TYPE, 
            null
          ).singleNodeValue;
        };
        
        // METODA 1: Szukaj w modalu
        const modal = document.querySelector('[role="dialog"]');
        if (modal) {
          const buttons = Array.from(modal.querySelectorAll('div[role="button"]'));
          
          for (const button of buttons) {
            const text = button.innerText || '';
            const ariaLabel = button.getAttribute('aria-label') || '';
            
            if (text.includes('Opublikuj') || text.includes('Post') ||
                ariaLabel.includes('Opublikuj') || ariaLabel.includes('Post')) {
              button.click(); // ZMIANA: Tylko .click(), bez wielokrotnych prób
              return true;
            }
          }
        }
        
        // METODA 2: XPath - szukaj tekstu "Opublikuj" lub "Post"
        const xpaths = [
          "//span[text()='Opublikuj']",
          "//span[text()='Post']",
          "//div[text()='Opublikuj']",
          "//div[text()='Post']",
          "//span[contains(text(), 'Opublikuj')]",
          "//span[contains(text(), 'Post')]"
        ];
        
        for (const xpath of xpaths) {
          const element = getElementByXpath(xpath);
          if (element) {
            // Znajdź najbliższy przycisk
            let parent = element.parentElement;
            let depth = 0;
            while (parent && depth < 10) {
              if (parent.getAttribute('role') === 'button') {
                parent.click(); // ZMIANA: Tylko .click()
                return true;
              }
              parent = parent.parentElement;
              depth++;
            }
            // Jeśli nie znaleziono przycisku, kliknij sam element
            element.click(); // ZMIANA: Tylko .click()
            return true;
          }
        }
        
        // METODA 3: Znajdź WSZYSTKIE przyciski i szukaj po tekście
        const allButtons = Array.from(document.querySelectorAll('div[role="button"], span[role="button"]'));
        for (const button of allButtons) {
          const text = button.innerText || button.textContent || '';
          if (text.trim() === 'Opublikuj' || text.trim() === 'Post') {
            button.click(); // ZMIANA: Tylko .click()
            return true;
          }
        }
        
        return false;
      });

      if (!publishClicked) {
        this.addLog('Nie znaleziono przycisku publikacji', 'warning');
        throw new Error('Nie znaleziono przycisku Opublikuj');
      }
      
      this.addLog('✅ Kliknięto publikuj', 'success');
      
      // ZMIANA: Czekaj na publikację i sprawdź czy nie ma błędu
      this.addLog('Czekam na publikację...', 'info');
      await randomDelay(3000, 4000);
      
      // Sprawdź czy nie pojawił się komunikat o błędzie
      const errorDetected = await this.page.evaluate(() => {
        // KLUCZOWE frazy błędów (muszą występować razem lub w specyficznym kontekście)
        const criticalErrorPhrases = [
          'Ograniczamy liczbę publikowanych postów',
          'We\'re limiting how often you can post',
          'chronić społeczność przed spamem',
          'reducing spam',
          'nie jest to sprzeczne z naszymi Standardami',
          'against our Community Standards'
        ];
        
        // Sprawdź cały dokument
        const bodyText = document.body.innerText || document.body.textContent;
        
        // Sprawdź kluczowe frazy (te wystarczą same w sobie)
        for (const phrase of criticalErrorPhrases) {
          if (bodyText.toLowerCase().includes(phrase.toLowerCase())) {
            return {
              detected: true,
              message: phrase
            };
          }
        }
        
        // Sprawdź dialogi i alerty (mogą zawierać błąd)
        const alertSelectors = [
          '[role="dialog"]',
          '[role="alert"]',
          '[role="alertdialog"]'
        ];
        
        for (const selector of alertSelectors) {
          const elements = document.querySelectorAll(selector);
          for (const el of elements) {
            const text = (el.innerText || el.textContent || '').toLowerCase();
            
            // Sprawdź czy dialog zawiera kombinację słów wskazujących na błąd
            const hasSpam = text.includes('spam');
            const hasLimit = text.includes('limit') || text.includes('ogranicza');
            const hasBlock = text.includes('block') || text.includes('blok');
            const hasStandards = text.includes('standard') || text.includes('społeczność');
            
            // Jeśli dialog ma min. 2 z tych słów - to prawdopodobnie błąd
            const errorIndicators = [hasSpam, hasLimit, hasBlock, hasStandards].filter(x => x).length;
            
            if (errorIndicators >= 2) {
              return {
                detected: true,
                message: text.substring(0, 150)
              };
            }
          }
        }
        
        return { detected: false };
      });
      
      if (errorDetected.detected) {
        const errorMsg = `⚠️ Facebook zablokował publikację: "${errorDetected.message}"`;
        this.addLog(errorMsg, 'error');

        // ANTY-BAN: Zapisz event bana do śledzenia (dla auto-pauzy)
        const accountId = this.currentTask?.accountId || 'default';
        this.activityLimiter.markAsBanned(accountId, 'posting_limit');
        this.addLog(`🚨 Konto ${accountId} oznaczone jako zbanowane`, 'error');

        this.emit('facebook-block-detected', {
          groupUrl,
          message: errorDetected.message,
          timestamp: new Date().toISOString(),
          accountId
        });

        // Zatrzymaj automatyzację
        this.isRunning = false;
        this.isPaused = false;

        throw new Error(`Facebook zablokował publikację: ${errorDetected.message}`);
      }
      
      // ANTY-BAN: Post-publish engagement (45-240 sekund)
      // Zostań na stronie i scrolluj - wygląda bardziej naturalnie
      this.addLog('🔄 Wykonuję post-publish engagement (45-240s)...', 'info');
      await postPublishEngagement(this.page);

      this.addLog(`✅ Post opublikowany: ${groupUrl}`, 'success');

      // ANTY-BAN: Losowo wykonaj "ludzki błąd" (raz na 10-15 postów)
      this.postsSinceHumanError++;
      if (this.activityLimiter.shouldMakeHumanError(this.postsSinceHumanError)) {
        this.addLog('🤷 Wykonuję losowy "ludzki błąd"...', 'info');
        await performHumanError(this.page);
        this.postsSinceHumanError = 0;
      }

    } catch (error) {
      this.addLog(`❌ Błąd: ${error.message}`, 'error');

      // 📸 SCREENSHOT NA BŁĘDZIE
      if (this.page) {
        const accountId = this.currentTask?.accountId || 'default';
        await this.captureErrorScreenshot(this.page, 'postToGroup_error', accountId);
      }

      throw error;
    }
  }

  async stopPosting() {
    this.isRunning = false;
    this.isPaused = false;
    this.currentTask = null;
    await this.closeBrowser();
    this.addLog('Automatyzacja zatrzymana', 'warning');
    this.emit('status-change', this.getStatus());
  }

  async pausePosting() {
    if (!this.isRunning) {
      throw new Error('Automatyzacja nie jest uruchomiona');
    }
    this.isPaused = true;
    this.addLog('Automatyzacja wstrzymana', 'warning');
    this.emit('status-change', this.getStatus());
  }

  async resumePosting() {
    if (!this.isRunning) {
      throw new Error('Automatyzacja nie jest uruchomiona');
    }
    this.isPaused = false;
    this.addLog('Automatyzacja wznowiona', 'info');
    this.emit('status-change', this.getStatus());
  }

  async closeBrowser() {
    if (this.context) {
      await this.context.close();
      this.context = null;
    }
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      isPaused: this.isPaused,
      currentTask: this.currentTask,
      timestamp: new Date().toISOString()
    };
  }

  getLogs() {
    return this.logs;
  }

  addLog(message, type = 'info') {
    const log = {
      timestamp: new Date().toISOString(),
      message,
      type
    };
    this.logs.push(log);
    
    // Ogranicz logi do ostatnich 100
    if (this.logs.length > 100) {
      this.logs.shift();
    }
    
    this.emit('log', log);
  }
}

module.exports = AutomationManager;
