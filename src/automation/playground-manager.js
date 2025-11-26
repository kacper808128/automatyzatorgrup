/**
 * Playground Manager - Migrated to Playwright
 * Anti-Ban Stack 2025
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const { chromium } = require('playwright');
const { getRandomUserAgent } = require('../utils/human-behavior');
const { FingerprintManager } = require('../utils/fingerprint-manager');

// Helper function for delays
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

class PlaygroundManager {
  constructor(store) {
    this.store = store;
    this.browser = null;
    this.context = null;
    this.page = null;
    this.isRunning = false;
    this.logs = [];
    this.fingerprintManager = new FingerprintManager();

    const apiKey = this.store.get('geminiApiKey');
    const modelName = this.store.get('geminiModel', 'gemini-1.5-flash-latest');

    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
      this.model = this.genAI.getGenerativeModel({ model: modelName });
    }
  }

  setApiKey(apiKey, modelName = 'gemini-1.5-flash-latest') {
    this.store.set('geminiApiKey', apiKey);
    this.store.set('geminiModel', modelName);
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: modelName });
    this.addLog(`API Key i model (${modelName}) zapisane`, 'success');
  }

  addLog(message, type = 'info') {
    const log = {
      timestamp: new Date().toISOString(),
      message,
      type
    };
    this.logs.push(log);
    if (this.logs.length > 100) this.logs.shift();
    return log;
  }

  async convertToCode(instructions, url = 'https://example.com') {
    if (!this.model) {
      throw new Error('Brak API Key - ustaw w Playground');
    }

    this.addLog('Konwertuję instrukcje na kod...', 'info');

    const prompt = `Jesteś ekspertem Playwright. Przekonwertuj instrukcje na CZYSTY KOD JavaScript bez funkcji.

KONTEKST:
- Przeglądarka JUŻ JEST OTWARTA na URL: ${url}
- NIE używaj page.goto() - strona już jest załadowana
- Zmienna 'page' jest dostępna (Playwright page object)
- Masz cookies użytkownika - jesteś zalogowany

KRYTYCZNE ZASADY:
1. TYLKO kod JavaScript - bez markdown, bez \`\`\`, bez komentarzy
2. NIE twórz funkcji - kod musi być bezpośrednio wykonywalny
3. Zaczynaj od 'await page.waitForSelector()' lub 'await page.click()'
4. NIE używaj page.goto() - strona już jest otwarta
5. JEDEN return na końcu
6. W page.evaluate() używaj TYLKO standardowego querySelector

SKŁADNIA PLAYWRIGHT:
- Czekanie: await page.waitForSelector('selector', {timeout: 10000})
- Kliknięcia: await page.click('selector')
- Odczyt tekstu: await page.evaluate(() => document.querySelector('selector').textContent)
- Opóźnienia: await new Promise(r => setTimeout(r, 1000))
- Zwracanie: return { pole: wartość }

WAŻNE SELEKTORY:
- Klikanie po tekście (gdy selector nie działa):
  await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('a, button, span')).find(x => x.textContent.trim() === 'Profile');
    if(el) el.click();
  });
- Instagram Profile: użyj metody wyżej z tekstem "Profile"
- Instagram Reels: podobnie, szukaj po tekście "Reels"
- Ogólne nagłówki: 'h1, h2, h3'
- Gdy nie wiesz jak kliknąć - użyj page.evaluate() i znajdź po tekście

PRZYKŁAD 1 - Klikanie gdy nie znasz selektora (INSTAGRAM):
await new Promise(r => setTimeout(r, 2000));
await page.evaluate(() => {
  const profileBtn = Array.from(document.querySelectorAll('a, span')).find(x => x.textContent.trim() === 'Profile');
  if(profileBtn) profileBtn.click();
});
await new Promise(r => setTimeout(r, 2000));

PRZYKŁAD 2 - Czytanie nagłówków:
await page.waitForSelector('h1', {timeout: 5000});
const headers = await page.evaluate(() => {
  const h = Array.from(document.querySelectorAll('h1, h2, h3'));
  return h.map(x => x.textContent.trim());
});
return { headers };

PRZYKŁAD 3 - Klikanie i odczyt:
await page.waitForSelector('button', {timeout: 5000});
await page.click('button');
await new Promise(r => setTimeout(r, 2000));
const views = await page.evaluate(() => {
  const el = Array.from(document.querySelectorAll('span')).find(x => x.textContent.includes('Views'));
  return el ? el.nextElementSibling.textContent : null;
});
return { views: views ? parseInt(views.replace(/[^0-9]/g, '')) : null };

INSTRUKCJE:
${instructions}

CZYSTY KOD (bez page.goto, strona już otwarta):`;

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      let code = response.text().trim();

      // Usuń markdown
      code = code.replace(/```javascript\n?/g, '').replace(/```\n?/g, '');

      // Usuń deklarację funkcji jeśli Gemini ją dodało
      code = code.replace(/^async\s+function\s+\w+\s*\(\s*\)\s*\{/m, '');

      // Usuń zamykające nawiasy funkcji na końcu
      const lines = code.split('\n');
      while (lines.length > 0 && lines[lines.length - 1].trim() === '}') {
        lines.pop();
      }
      code = lines.join('\n').trim();

      // Napraw podwójne returny
      code = code.replace(/return\s+[^;]+;\s+return\s+null;/g, (match) => {
        return match.split('return')[1].trim();
      });

      this.addLog('Kod wygenerowany', 'success');
      return code;

    } catch (error) {
      this.addLog(`Błąd Gemini: ${error.message}`, 'error');
      throw error;
    }
  }

  async runPlayground(config, proxy = null) {
    if (this.isRunning) {
      throw new Error('Playground już działa');
    }

    try {
      this.isRunning = true;
      this.logs = [];

      this.addLog('Uruchamiam...', 'info');

      const code = await this.convertToCode(config.instructions, config.url);
      this.addLog('Kod:', 'code');
      this.addLog(code, 'code');

      this.addLog('Przeglądarka Playwright...', 'info');

      const fingerprint = this.fingerprintManager.generateFingerprint();

      const launchOptions = {
        headless: false,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-blink-features=AutomationControlled'
        ]
      };

      // Dodaj proxy jeśli zostało wybrane
      if (proxy && proxy.host && proxy.port) {
        launchOptions.proxy = {
          server: `http://${proxy.host}:${proxy.port}`,
          username: proxy.username || undefined,
          password: proxy.password || undefined
        };
        this.addLog(`🌐 Używam proxy: ${proxy.name || proxy.host}:${proxy.port}`, 'info');
      } else {
        this.addLog('🔓 Bez proxy', 'info');
      }

      this.browser = await chromium.launch(launchOptions);

      // Playwright: context z fingerprint settings
      this.context = await this.browser.newContext({
        viewport: { width: 1366, height: 768 },
        userAgent: fingerprint.userAgent,
        locale: fingerprint.locale,
        timezoneId: fingerprint.timezone
      });

      // Wstrzyknij skrypty stealth
      const stealthScripts = this.fingerprintManager.getStealthScripts(fingerprint);
      for (const script of stealthScripts) {
        await this.context.addInitScript(script);
      }

      this.page = await this.context.newPage();

      if (config.cookies && config.cookies.length > 0) {
        this.addLog('Ładuję cookies...', 'info');
        try {
          const cookiesRaw = JSON.parse(config.cookies);

          // Normalizuj cookies dla Playwright
          const cookies = cookiesRaw.map(cookie => ({
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

          // Playwright: addCookies na context
          await this.context.addCookies(cookies);
          this.addLog(`Załadowano ${cookies.length} cookies`, 'success');
        } catch (e) {
          this.addLog(`Błąd cookies: ${e.message}`, 'warning');
        }
      }

      this.addLog(`Otwieram: ${config.url}`, 'info');
      // Playwright: networkidle zamiast networkidle2
      await this.page.goto(config.url, { waitUntil: 'networkidle' });
      await delay(2000);

      this.addLog('Wykonuję...', 'info');

      // Walidacja i cleanup kodu
      let cleanCode = code;

      // Fix: Usuń page.goto (strona już jest otwarta)
      cleanCode = cleanCode.replace(/await\s+page\.goto\([^)]+\);?\s*/g, '');

      // Fix: Usuń podwójne return w closurach
      cleanCode = cleanCode.replace(/return\s+numberElement.*return\s+null;/g, 'return numberElement ? numberElement.textContent : null;');

      // Fix: Usuń zbędne return null przed głównym return
      const lines = cleanCode.split(';').map(l => l.trim()).filter(l => l);
      const lastReturnIndex = lines.map((l, i) => l.startsWith('return {') ? i : -1).filter(i => i !== -1).pop();

      if (lastReturnIndex !== undefined) {
        // Usuń wszystkie return null przed ostatnim return
        const filtered = lines.filter((line, idx) => {
          if (idx < lastReturnIndex && line === 'return null') {
            return false;
          }
          return true;
        });
        cleanCode = filtered.join('; ') + ';';
      }

      this.addLog('Czysty kod:', 'code');
      this.addLog(cleanCode, 'code');

      const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
      const executableFunction = new AsyncFunction('page', cleanCode);

      const result = await executableFunction(this.page);

      this.addLog('Wykonano!', 'success');

      if (result) {
        this.addLog('Wynik:', 'result');
        this.addLog(JSON.stringify(result, null, 2), 'result');
      }

      this.addLog('Przeglądarka pozostaje otwarta', 'info');

      this.isRunning = false;
      return { success: true, result, logs: this.logs };

    } catch (error) {
      this.addLog(`Błąd: ${error.message}`, 'error');
      this.isRunning = false;
      throw error;
    }
  }

  async stop() {
    if (this.context) {
      await this.context.close();
      this.context = null;
    }
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
    this.isRunning = false;
    this.addLog('Zatrzymano', 'warning');
  }

  getLogs() {
    return this.logs;
  }

  getConfig() {
    return {
      apiKey: this.store.get('geminiApiKey', ''),
      modelName: this.store.get('geminiModel', 'gemini-1.5-flash-latest')
    };
  }
}

module.exports = PlaygroundManager;
