const { app, BrowserWindow, ipcMain, Notification } = require('electron');
const path = require('path');
const Store = require('electron-store');
const AutomationManager = require('./automation/automation-manager');
const ScheduleManager = require('./automation/schedule-manager');
const PlaygroundManager = require('./automation/playground-manager');
const InstagramChecker = require('./automation/instagram-checker');
const http = require('http');

const store = new Store();
let mainWindow;
let automationManager;
let scheduleManager;
let playgroundManager;
let instagramChecker;
let apiServer;

// Kolejka postów z API
let postQueue = [];

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    icon: path.join(__dirname, '../assets/icon.png')
  });

  mainWindow.loadFile(path.join(__dirname, 'ui/index.html'));

  // Otwórz DevTools w trybie deweloperskim
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();
  
  automationManager = new AutomationManager(store);
  scheduleManager = new ScheduleManager(store, automationManager);
  playgroundManager = new PlaygroundManager(store);
  instagramChecker = new InstagramChecker(store);
  
  // Setup event listeners after automationManager is created
  setupAutomationListeners();
  setupPlaygroundHandlers();
  setupInstagramHandlers();
  
  // Start API server
  startApiServer();
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (apiServer) {
    apiServer.close();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handlers
ipcMain.handle('save-credentials', async (event, credentials) => {
  try {
    await automationManager.saveCredentials(credentials);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-credentials', async () => {
  try {
    return await automationManager.getCredentials();
  } catch (error) {
    return null;
  }
});

ipcMain.handle('save-facebook-cookies', async (event, cookies) => {
  store.set('facebookCookies', cookies);
  return { success: true };
});

ipcMain.handle('get-facebook-cookies', async () => {
  return store.get('facebookCookies', '');
});

ipcMain.handle('test-login', async (event, credentials) => {
  try {
    const result = await automationManager.testLogin(credentials);
    return result;
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('start-posting', async (event, config) => {
  try {
    const result = await automationManager.startPosting(config);
    sendNotification('Postowanie rozpoczęte', 'Automatyzacja została uruchomiona');
    return result;
  } catch (error) {
    sendNotification('Błąd', error.message);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('start-posting-csv', async (event, config) => {
  try {
    const result = await automationManager.startPostingFromCSV(config);
    sendNotification('Postowanie z CSV rozpoczęte', `Załadowano ${config.posts.length} postów`);
    return result;
  } catch (error) {
    sendNotification('Błąd', error.message);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('start-posting-multi', async (event, config) => {
  try {
    const result = await automationManager.startPostingMultiAccount(config);
    sendNotification('Postowanie wielokontowe rozpoczęte', `${config.accounts.length} kont, ${config.posts.length} postów`);
    return result;
  } catch (error) {
    sendNotification('Błąd', error.message);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('save-all-accounts', async (event, accounts) => {
  store.set('facebookAccounts', accounts);
  return { success: true };
});

ipcMain.handle('get-all-accounts', async () => {
  return store.get('facebookAccounts', []);
});

ipcMain.handle('stop-posting', async () => {
  try {
    await automationManager.stopPosting();
    sendNotification('Postowanie zatrzymane', 'Automatyzacja została zatrzymana');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('pause-posting', async () => {
  try {
    await automationManager.pausePosting();
    sendNotification('Postowanie wstrzymane', 'Automatyzacja została wstrzymana');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('resume-posting', async () => {
  try {
    await automationManager.resumePosting();
    sendNotification('Postowanie wznowione', 'Automatyzacja została wznowiona');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-status', async () => {
  return automationManager.getStatus();
});

ipcMain.handle('get-logs', async () => {
  return automationManager.getLogs();
});

ipcMain.handle('save-schedule', async (event, schedule) => {
  try {
    await scheduleManager.saveSchedule(schedule);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-schedule', async () => {
  return scheduleManager.getSchedule();
});

ipcMain.handle('delete-schedule', async (event, scheduleId) => {
  try {
    await scheduleManager.deleteSchedule(scheduleId);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('save-proxy', async (event, proxyConfig) => {
  try {
    store.set('proxy', proxyConfig);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-proxy', async () => {
  return store.get('proxy', { enabled: false, host: '', port: '' });
});

// =============================================
// COOKIE VALIDATION HANDLERS
// =============================================

ipcMain.handle('validate-cookies', async (event, cookies) => {
  return automationManager.validateCookies(cookies);
});

ipcMain.handle('validate-cookies-online', async (event, cookies) => {
  return await automationManager.validateCookiesOnline(cookies);
});

ipcMain.handle('filter-valid-accounts', async (event, { accounts, checkOnline }) => {
  return await automationManager.filterValidAccounts(accounts, checkOnline);
});

// =============================================
// PROXY LIST HANDLERS - wiele proxy
// =============================================

ipcMain.handle('add-proxy', async (event, proxy) => {
  try {
    const result = automationManager.addProxy(proxy);
    return { success: true, proxy: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('remove-proxy', async (event, proxyId) => {
  try {
    automationManager.removeProxy(proxyId);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-proxy-list', async () => {
  return automationManager.getProxyList();
});

ipcMain.handle('test-proxy', async (event, proxy) => {
  return await automationManager.testProxy(proxy);
});

ipcMain.handle('assign-proxy-to-account', async (event, { accountId, proxyId }) => {
  try {
    automationManager.assignProxyToAccount(accountId, proxyId);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-proxy-for-account', async (event, accountId) => {
  return automationManager.getProxyForAccount(accountId);
});

function sendNotification(title, body) {
  if (Notification.isSupported()) {
    new Notification({ title, body }).show();
  }
  
  if (mainWindow) {
    mainWindow.webContents.send('notification', { title, body });
  }
}

// Setup automation event listeners
function setupAutomationListeners() {
  if (!automationManager) return;
  
  automationManager.on('status-change', (status) => {
    if (mainWindow) {
      mainWindow.webContents.send('status-update', status);
    }
  });

  automationManager.on('log', (log) => {
    if (mainWindow) {
      mainWindow.webContents.send('new-log', log);
    }
  });

  automationManager.on('captcha-detected', () => {
    sendNotification('CAPTCHA wykryta!', 'Wymagana jest weryfikacja');
  });

  automationManager.on('verification-required', (data) => {
    sendNotification('⚠️ Weryfikacja wymagana!', data.message);
    if (mainWindow) {
      mainWindow.webContents.send('verification-required', data);
    }
  });

  automationManager.on('facebook-block-detected', (data) => {
    sendNotification('🚫 Facebook zablokował publikację!', data.message);
    if (mainWindow) {
      mainWindow.webContents.send('facebook-block-detected', data);
    }
  });

  automationManager.on('error', (error) => {
    sendNotification('Błąd', error.message);
  });
}

// Playground IPC Handlers
function setupPlaygroundHandlers() {
  ipcMain.handle('playground-set-api-key', async (event, apiKey, modelName) => {
    playgroundManager.setApiKey(apiKey, modelName);
    return { success: true };
  });

  ipcMain.handle('playground-run', async (event, config) => {
    try {
      const result = await playgroundManager.runPlayground(config);
      return result;
    } catch (error) {
      return { success: false, error: error.message, logs: playgroundManager.getLogs() };
    }
  });

  ipcMain.handle('playground-stop', async () => {
    await playgroundManager.stop();
    return { success: true };
  });

  ipcMain.handle('playground-get-logs', async () => {
    return playgroundManager.getLogs();
  });

  ipcMain.handle('playground-get-config', async () => {
    return playgroundManager.getConfig();
  });
}

// Instagram Checker IPC Handlers
function setupInstagramHandlers() {
  ipcMain.handle('instagram-save-config', async (event, config) => {
    store.set('instagramWebhook', config.webhookUrl);
    store.set('instagramCookies', config.cookies);
    return { success: true };
  });

  ipcMain.handle('instagram-get-config', async () => {
    return {
      webhookUrl: store.get('instagramWebhook', ''),
      cookies: store.get('instagramCookies', '')
    };
  });

  ipcMain.handle('instagram-start-check', async (event, data) => {
    try {
      const cookies = data.cookies ? JSON.parse(data.cookies) : null;
      const urls = data.urls.split('\n').map(u => u.trim()).filter(u => u);
      
      // Uruchom w tle
      instagramChecker.checkMultipleReels(urls, data.webhookUrl, cookies)
        .then(results => {
          if (mainWindow) {
            mainWindow.webContents.send('instagram-check-complete', results);
          }
        })
        .catch(error => {
          if (mainWindow) {
            mainWindow.webContents.send('instagram-check-error', error.message);
          }
        });
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('instagram-stop', async () => {
    await instagramChecker.stop();
    return { success: true };
  });

  ipcMain.handle('instagram-get-results', async () => {
    return instagramChecker.getResults();
  });
}

// API Token handlers
ipcMain.handle('get-api-token', async () => {
  return store.get('apiToken', '');
});

ipcMain.handle('regenerate-api-token', async () => {
  const newToken = require('crypto').randomBytes(32).toString('hex');
  store.set('apiToken', newToken);
  console.log(`[API] 🔑 Wygenerowano nowy token: ${newToken}`);
  return newToken;
});

// API Server dla n8n
function startApiServer() {
  const PORT = 3737;
  
  // Sprawdź czy port jest zajęty
  const testServer = http.createServer();
  testServer.once('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`[API] Port ${PORT} jest już zajęty - pomijam start servera`);
      return;
    }
  });
  
  testServer.once('listening', () => {
    testServer.close();
    startActualServer(PORT);
  });
  
  testServer.listen(PORT);
}

function startActualServer(PORT) {
  
  // Wygeneruj lub załaduj API token
  let apiToken = store.get('apiToken');
  if (!apiToken) {
    apiToken = require('crypto').randomBytes(32).toString('hex');
    store.set('apiToken', apiToken);
    console.log(`[API] 🔑 Wygenerowano nowy API token: ${apiToken}`);
    console.log(`[API] Token zapisany w konfiguracji. Użyj go w headerze: Authorization: Bearer ${apiToken}`);
  } else {
    console.log(`[API] 🔑 Używam zapisanego tokenu: ${apiToken}`);
  }
  
  apiServer = http.createServer((req, res) => {
    // CORS headers - zezwalaj na wszystkie originy
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }
    
    // Autoryzacja (pomijamy dla /api/status)
    if (req.url !== '/api/status') {
      const authHeader = req.headers['authorization'];
      const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
      
      if (!token || token !== apiToken) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          success: false, 
          error: 'Unauthorized. Use header: Authorization: Bearer YOUR_TOKEN',
          hint: 'Get your token from the app logs or Settings tab'
        }));
        return;
      }
    }
    
    // POST /api/post - dodaj post do kolejki
    if (req.method === 'POST' && req.url === '/api/post') {
      let body = '';
      
      req.on('data', chunk => {
        body += chunk.toString();
      });
      
      req.on('end', () => {
        try {
          const data = JSON.parse(body);
          
          // Walidacja
          if (!data.group_link || !data.post_copy) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
              success: false, 
              error: 'Missing required fields: group_link, post_copy' 
            }));
            return;
          }
          
          // Dodaj do kolejki
          postQueue.push({
            id: Date.now(),
            groupUrl: data.group_link,
            message: data.post_copy,
            metadata: {
              rowNumber: data.row_number,
              groupName: data.group_name,
              groupId: data.group_id,
              jobTitle: data.job_title,
              jobUrl: data.job_url,
              jobCompany: data.job_company,
              generatedAt: data.generated_at,
              readyToPublish: data.ready_to_publish
            },
            status: 'pending',
            addedAt: new Date().toISOString()
          });
          
          console.log(`[API] Dodano post do kolejki: ${data.group_name} (${postQueue.length} w kolejce)`);
          
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ 
            success: true, 
            message: 'Post added to queue',
            queueLength: postQueue.length,
            postId: postQueue[postQueue.length - 1].id
          }));
          
        } catch (error) {
          console.error('[API] Błąd parsowania JSON:', error);
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Invalid JSON' }));
        }
      });
    }
    
    // GET /api/queue - sprawdź kolejkę
    else if (req.method === 'GET' && req.url === '/api/queue') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        success: true,
        queueLength: postQueue.length,
        queue: postQueue
      }));
    }
    
    // GET /api/status - status aplikacji
    else if (req.method === 'GET' && req.url === '/api/status') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        success: true,
        isRunning: automationManager?.isRunning || false,
        isPaused: automationManager?.isPaused || false,
        queueLength: postQueue.length
      }));
    }
    
    // POST /api/start - uruchom automatyzację z kolejki
    else if (req.method === 'POST' && req.url === '/api/start') {
      if (postQueue.length === 0) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Queue is empty' }));
        return;
      }
      
      // Uruchom automatyzację dla postów z kolejki
      processQueue();
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        success: true, 
        message: 'Processing queue started',
        postsToProcess: postQueue.length
      }));
    }
    
    // DELETE /api/queue - wyczyść kolejkę
    else if (req.method === 'DELETE' && req.url === '/api/queue') {
      postQueue = [];
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: 'Queue cleared' }));
    }
    
    else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Not found' }));
    }
  });
  
  apiServer.listen(PORT, '0.0.0.0', () => {
    console.log(`[API] 🚀 Server listening on:`);
    console.log(`[API]    Local:    http://localhost:${PORT}`);
    console.log(`[API]    Network:  http://0.0.0.0:${PORT}`);
    console.log(`[API] `);
    console.log(`[API] 🔑 Authorization: Bearer ${apiToken}`);
    console.log(`[API] `);
    console.log(`[API] 📡 Endpoints:`);
    console.log(`[API]   POST   /api/post    - Add post to queue (requires auth)`);
    console.log(`[API]   GET    /api/queue   - View queue (requires auth)`);
    console.log(`[API]   GET    /api/status  - App status (public)`);
    console.log(`[API]   POST   /api/start   - Process queue (requires auth)`);
    console.log(`[API]   DELETE /api/queue   - Clear queue (requires auth)`);
  });
}

// Przetwarzaj kolejkę postów
async function processQueue() {
  if (automationManager.isRunning) {
    console.log('[API] Automation already running');
    return;
  }
  
  if (postQueue.length === 0) {
    console.log('[API] Queue is empty');
    return;
  }
  
  console.log(`[API] Processing ${postQueue.length} posts from queue`);
  
  try {
    const credentials = await automationManager.getCredentials();
    if (!credentials) {
      console.error('[API] No credentials saved');
      return;
    }
    
    automationManager.isRunning = true;
    
    await automationManager.initBrowser();
    await automationManager.login(credentials);
    
    // Przetwarzaj każdy post z kolejki
    while (postQueue.length > 0) {
      const post = postQueue.shift(); // Pobierz pierwszy post
      
      try {
        console.log(`[API] Posting to: ${post.groupUrl}`);
        post.status = 'processing';
        
        await automationManager.postToGroup(post.groupUrl, post.message);
        
        post.status = 'completed';
        post.completedAt = new Date().toISOString();

        // ANTI-BAN: Opóźnienie między postami (4-18 minut zamiast 60-90s!)
        if (postQueue.length > 0) {
          // Gaussian random dla bardziej naturalnej dystrybucji
          const min = 4 * 60 * 1000;  // 4 minuty
          const max = 18 * 60 * 1000; // 18 minut
          const mean = (min + max) / 2;
          const stdDev = (max - min) / 6;

          let u = 0, v = 0;
          while (u === 0) u = Math.random();
          while (v === 0) v = Math.random();
          const num = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
          let delay = Math.max(min, Math.min(max, num * stdDev + mean));

          const delayMinutes = Math.round(delay / 60000 * 10) / 10;
          console.log(`[API] ⏳ Czekam ${delayMinutes} minut przed następnym postem (Anti-Ban Stack 2025)...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
      } catch (error) {
        console.error(`[API] Error posting to ${post.groupUrl}:`, error.message);
        post.status = 'failed';
        post.error = error.message;
        post.failedAt = new Date().toISOString();
      }
    }
    
    await automationManager.closeBrowser();
    automationManager.isRunning = false;
    
    console.log('[API] Queue processing completed');
    
  } catch (error) {
    console.error('[API] Error processing queue:', error);
    automationManager.isRunning = false;
  }
}
