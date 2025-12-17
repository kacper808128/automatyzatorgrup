/**
 * Menedżer obsługi proxy - Anti-Ban Stack 2025
 *
 * Implementuje:
 * - Sticky sessions (60 minut)
 * - Rotacja proxy
 * - Per-account proxy assignment
 */

// Konfiguracja sticky sessions
const STICKY_SESSION_CONFIG = {
  sessionDuration: 60 * 60 * 1000, // 60 minut w ms
  maxSessionsPerProxy: 5,          // Max jednoczesnych sesji na proxy
};

class ProxyManager {
  constructor() {
    this.currentProxy = null;
    this.proxyList = [];
    this.failedProxies = new Set();

    // Sticky sessions tracking
    this.activeSessions = new Map(); // proxyId -> [{ accountId, startTime, sessionId }]
    this.accountSessions = new Map(); // accountId -> { proxyId, sessionId, startTime }
  }

  /**
   * Rozpoczyna sticky session dla konta
   * @param {string} accountId - ID konta
   * @param {string} proxyId - ID proxy
   * @returns {Object} Session info z sessionId
   */
  startStickySession(accountId, proxyId) {
    const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();

    const sessionInfo = {
      accountId,
      proxyId,
      sessionId,
      startTime,
      expiresAt: startTime + STICKY_SESSION_CONFIG.sessionDuration
    };

    // Zapisz sesję dla konta
    this.accountSessions.set(accountId, sessionInfo);

    // Dodaj do listy sesji proxy
    if (!this.activeSessions.has(proxyId)) {
      this.activeSessions.set(proxyId, []);
    }
    this.activeSessions.get(proxyId).push(sessionInfo);

    console.log(`[ProxyManager] Started sticky session ${sessionId} for account ${accountId} on proxy ${proxyId}`);
    return sessionInfo;
  }

  /**
   * Sprawdza czy konto ma aktywną sticky session
   * @param {string} accountId
   * @returns {Object|null} Session info lub null jeśli brak/wygasła
   */
  getActiveSession(accountId) {
    const session = this.accountSessions.get(accountId);

    if (!session) {
      return null;
    }

    // Sprawdź czy sesja nie wygasła
    if (Date.now() > session.expiresAt) {
      this.endStickySession(accountId);
      return null;
    }

    return session;
  }

  /**
   * Kończy sticky session dla konta
   * @param {string} accountId
   */
  endStickySession(accountId) {
    const session = this.accountSessions.get(accountId);

    if (session) {
      // Usuń z listy sesji proxy
      const proxySessions = this.activeSessions.get(session.proxyId);
      if (proxySessions) {
        const index = proxySessions.findIndex(s => s.sessionId === session.sessionId);
        if (index >= 0) {
          proxySessions.splice(index, 1);
        }
      }

      // Usuń sesję konta
      this.accountSessions.delete(accountId);
      console.log(`[ProxyManager] Ended sticky session ${session.sessionId} for account ${accountId}`);
    }
  }

  /**
   * Czyści wygasłe sesje
   */
  cleanupExpiredSessions() {
    const now = Date.now();

    for (const [accountId, session] of this.accountSessions.entries()) {
      if (now > session.expiresAt) {
        this.endStickySession(accountId);
      }
    }
  }

  /**
   * Zwraca ile czasu zostało do końca sesji (w minutach)
   * @param {string} accountId
   * @returns {number} Minuty do wygaśnięcia lub 0
   */
  getSessionTimeRemaining(accountId) {
    const session = this.getActiveSession(accountId);
    if (!session) return 0;

    return Math.max(0, Math.floor((session.expiresAt - Date.now()) / 60000));
  }

  /**
   * Pobiera proxy z zachowaniem sticky session
   * @param {string} accountId
   * @param {Object|null} assignedProxy - Przypisane proxy do konta
   * @returns {Object|null} Proxy config dla Playwright
   */
  getProxyWithStickySession(accountId, assignedProxy) {
    // Sprawdź czy jest aktywna sesja
    let session = this.getActiveSession(accountId);

    if (session && assignedProxy && session.proxyId !== assignedProxy.id) {
      // Proxy zostało zmienione - zakończ starą sesję
      this.endStickySession(accountId);
      session = null;
    }

    // Jeśli brak sesji i jest przypisane proxy, utwórz nową
    if (!session && assignedProxy) {
      session = this.startStickySession(accountId, assignedProxy.id);
    }

    if (!assignedProxy) {
      return null;
    }

    // Zwróć config proxy dla Playwright
    return {
      server: `http://${assignedProxy.host}:${assignedProxy.port}`,
      username: assignedProxy.username || undefined,
      password: assignedProxy.password || undefined,
      sessionId: session?.sessionId
    };
  }

  setProxy(host, port, username = null, password = null) {
    this.currentProxy = {
      host,
      port,
      username,
      password
    };
  }

  getProxyString() {
    if (!this.currentProxy) return null;

    const { host, port, username, password } = this.currentProxy;

    if (username && password) {
      return `http://${username}:${password}@${host}:${port}`;
    }

    return `http://${host}:${port}`;
  }

  addProxyToList(proxy) {
    this.proxyList.push(proxy);
  }

  getRandomProxy() {
    const availableProxies = this.proxyList.filter(
      proxy => !this.failedProxies.has(proxy)
    );

    if (availableProxies.length === 0) {
      return null;
    }

    const randomIndex = Math.floor(Math.random() * availableProxies.length);
    return availableProxies[randomIndex];
  }

  markProxyAsFailed(proxy) {
    this.failedProxies.add(proxy);
  }

  resetFailedProxies() {
    this.failedProxies.clear();
  }

  async testProxy(proxy) {
    // Implementacja testowania proxy
    // Można użyć axios lub innej biblioteki do testowania
    try {
      const axios = require('axios');
      const proxyConfig = {
        host: proxy.host,
        port: proxy.port
      };

      if (proxy.username && proxy.password) {
        proxyConfig.auth = {
          username: proxy.username,
          password: proxy.password
        };
      }

      const response = await axios.get('https://www.google.com', {
        proxy: proxyConfig,
        timeout: 10000
      });

      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  rotateProxy() {
    const newProxy = this.getRandomProxy();
    if (newProxy) {
      this.setProxy(newProxy.host, newProxy.port, newProxy.username, newProxy.password);
      return true;
    }
    return false;
  }
}

module.exports = { ProxyManager, STICKY_SESSION_CONFIG };
