# Przykłady użycia API

Ten plik zawiera przykłady programatycznego użycia aplikacji.

## Przykład 1: Podstawowe postowanie

```javascript
const { ipcRenderer } = require('electron');

async function simplePost() {
  const config = {
    message: 'To jest mój post na grupy!',
    groups: [
      'https://www.facebook.com/groups/group1',
      'https://www.facebook.com/groups/group2'
    ],
    delayBetweenPosts: 60
  };
  
  const result = await ipcRenderer.invoke('start-posting', config);
  console.log('Result:', result);
}
```

## Przykład 2: Zaplanowane postowanie

```javascript
async function schedulePost() {
  const schedule = {
    id: Date.now().toString(),
    name: 'Codzienny post',
    type: 'daily',
    hour: 10,
    minute: 0,
    message: 'Dzień dobry! Codzienne przypomnienie.',
    groups: [
      'https://www.facebook.com/groups/mygroup'
    ],
    delayBetweenPosts: 60,
    enabled: true
  };
  
  const result = await ipcRenderer.invoke('save-schedule', schedule);
  console.log('Schedule saved:', result);
}
```

## Przykład 3: Konfiguracja proxy

```javascript
async function configureProxy() {
  const proxyConfig = {
    enabled: true,
    host: '79.110.198.37',
    port: '8080',
    username: '', // opcjonalnie
    password: ''  // opcjonalnie
  };
  
  const result = await ipcRenderer.invoke('save-proxy', proxyConfig);
  console.log('Proxy configured:', result);
}
```

## Przykład 4: Monitorowanie statusu

```javascript
// Nasłuchiwanie na zmiany statusu
ipcRenderer.on('status-update', (event, status) => {
  console.log('Status changed:', status);
  console.log('Is running:', status.isRunning);
  console.log('Is paused:', status.isPaused);
});

// Nasłuchiwanie na nowe logi
ipcRenderer.on('new-log', (event, log) => {
  console.log(`[${log.timestamp}] [${log.type}] ${log.message}`);
});

// Nasłuchiwanie na powiadomienia
ipcRenderer.on('notification', (event, data) => {
  console.log('Notification:', data.title, '-', data.body);
});
```

## Przykład 5: Kontrola postowania

```javascript
// Rozpocznij postowanie
await ipcRenderer.invoke('start-posting', config);

// Wstrzymaj
await ipcRenderer.invoke('pause-posting');

// Wznów
await ipcRenderer.invoke('resume-posting');

// Zatrzymaj
await ipcRenderer.invoke('stop-posting');
```

## Przykład 6: Pobieranie danych

```javascript
// Pobierz status
const status = await ipcRenderer.invoke('get-status');
console.log('Current status:', status);

// Pobierz logi
const logs = await ipcRenderer.invoke('get-logs');
console.log('Logs:', logs);

// Pobierz harmonogramy
const schedules = await ipcRenderer.invoke('get-schedule');
console.log('Schedules:', schedules);

// Pobierz dane logowania (zaszyfrowane)
const credentials = await ipcRenderer.invoke('get-credentials');
console.log('Credentials loaded');
```

## Przykład 7: Zaawansowany harmonogram

```javascript
// Harmonogram tygodniowy
const weeklySchedule = {
  id: Date.now().toString(),
  name: 'Post w weekendy',
  type: 'weekly',
  daysOfWeek: [0, 6], // Niedziela i Sobota (0 = Niedziela, 6 = Sobota)
  hour: 12,
  minute: 0,
  message: 'Weekend post!',
  groups: [
    'https://www.facebook.com/groups/weekend-group'
  ],
  delayBetweenPosts: 90,
  enabled: true
};

await ipcRenderer.invoke('save-schedule', weeklySchedule);
```

## Przykład 8: Harmonogram z interwałem

```javascript
// Post co 2 godziny
const intervalSchedule = {
  id: Date.now().toString(),
  name: 'Post co 2h',
  type: 'interval',
  intervalMinutes: 120, // 2 godziny
  message: 'Regularny update!',
  groups: [
    'https://www.facebook.com/groups/frequent-group'
  ],
  delayBetweenPosts: 60,
  enabled: true
};

await ipcRenderer.invoke('save-schedule', intervalSchedule);
```

## Przykład 9: Test logowania z błędami

```javascript
async function testLoginWithErrorHandling() {
  try {
    const credentials = {
      email: 'test@example.com',
      password: 'password123'
    };
    
    const result = await ipcRenderer.invoke('test-login', credentials);
    
    if (result.success) {
      console.log('✅ Login successful!');
    } else if (result.requiresCaptcha) {
      console.log('⚠️ CAPTCHA required');
      // Poczekaj na ręczną weryfikację
    } else {
      console.log('❌ Login failed:', result.error);
    }
  } catch (error) {
    console.error('Error during login test:', error);
  }
}
```

## Przykład 10: Pełny workflow

```javascript
async function completeWorkflow() {
  try {
    // 1. Zapisz dane logowania
    await ipcRenderer.invoke('save-credentials', {
      email: 'your@email.com',
      password: 'yourpassword'
    });
    console.log('✅ Credentials saved');
    
    // 2. Skonfiguruj proxy
    await ipcRenderer.invoke('save-proxy', {
      enabled: true,
      host: '79.110.198.37',
      port: '8080'
    });
    console.log('✅ Proxy configured');
    
    // 3. Testuj logowanie
    const loginResult = await ipcRenderer.invoke('test-login', {
      email: 'your@email.com',
      password: 'yourpassword'
    });
    
    if (!loginResult.success) {
      throw new Error('Login failed');
    }
    console.log('✅ Login test passed');
    
    // 4. Uruchom postowanie
    const postConfig = {
      message: 'Hello from automation!',
      groups: [
        'https://www.facebook.com/groups/group1',
        'https://www.facebook.com/groups/group2'
      ],
      delayBetweenPosts: 90
    };
    
    await ipcRenderer.invoke('start-posting', postConfig);
    console.log('✅ Posting started');
    
    // 5. Monitoruj status
    ipcRenderer.on('status-update', (event, status) => {
      console.log('Status:', status.isRunning ? 'Running' : 'Stopped');
    });
    
    ipcRenderer.on('new-log', (event, log) => {
      console.log(`[${log.type}] ${log.message}`);
    });
    
  } catch (error) {
    console.error('Workflow error:', error);
  }
}
```

## Uwagi

- Wszystkie przykłady zakładają użycie w kontekście renderera Electrona
- Dane logowania są automatycznie szyfrowane
- Upewnij się, że masz poprawne URL-e grup Facebook
- Zachowuj rozsądne opóźnienia między postami (minimum 30 sekund)
- Monitoruj logi dla lepszej kontroli nad procesem
