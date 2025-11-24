/**
 * Moduł symulujący naturalne, ludzkie zachowanie
 */

// Losowe opóźnienie w milisekundach
function randomDelay(min, max) {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => setTimeout(resolve, delay));
}

// Naturalne wpisywanie tekstu z losowymi opóźnieniami między znakami
async function randomTyping(page, selector, text, isContentEditable = false) {
  await page.waitForSelector(selector);
  await page.click(selector);
  await randomDelay(300, 600);

  if (isContentEditable) {
    // Dla contenteditable używamy innej metody
    for (let char of text) {
      await page.keyboard.type(char);
      // Losowe opóźnienie między znakami (40-150ms)
      const charDelay = Math.floor(Math.random() * 110) + 40;
      await randomDelay(charDelay, charDelay + 20);
      
      // Czasami dłuższa pauza (symulacja myślenia)
      if (Math.random() < 0.05) {
        await randomDelay(500, 1500);
      }
    }
  } else {
    // Dla zwykłych input
    for (let char of text) {
      await page.type(selector, char, { 
        delay: Math.floor(Math.random() * 100) + 50 
      });
      
      // Czasami dłuższa pauza
      if (Math.random() < 0.05) {
        await randomDelay(300, 800);
      }
    }
  }
}

// Naturalne ruchy myszki (symulacja)
async function naturalMouseMovement(page, x, y) {
  // Puppeteer nie ma built-in natural mouse movement,
  // ale możemy dodać małe opóźnienie przed kliknięciem
  await randomDelay(100, 300);
  await page.mouse.move(x, y);
  await randomDelay(50, 150);
}

// Symulacja scrollowania
async function naturalScroll(page, distance = 300) {
  await page.evaluate((dist) => {
    window.scrollBy({
      top: dist,
      behavior: 'smooth'
    });
  }, distance);
  await randomDelay(500, 1000);
}

// Wzorce wpisywania - różne style pisania
const typingPatterns = {
  fast: { min: 30, max: 80, pauseChance: 0.02 },
  normal: { min: 50, max: 150, pauseChance: 0.05 },
  slow: { min: 100, max: 250, pauseChance: 0.08 },
  thinking: { min: 80, max: 200, pauseChance: 0.15 }
};

function getTypingPattern(patternName = 'normal') {
  return typingPatterns[patternName] || typingPatterns.normal;
}

// Losowy User Agent
function getRandomUserAgent() {
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  ];
  
  return userAgents[Math.floor(Math.random() * userAgents.length)];
}

// Symulacja czasu czytania (na podstawie długości tekstu)
function calculateReadingTime(text) {
  // Średnio 200-250 słów na minutę
  const words = text.split(/\s+/).length;
  const wordsPerMinute = 200 + Math.random() * 50;
  const minutes = words / wordsPerMinute;
  const milliseconds = minutes * 60 * 1000;
  
  // Dodaj losową wariancję (±30%)
  const variance = milliseconds * 0.3;
  return milliseconds + (Math.random() * variance * 2 - variance);
}

// Sprawdzenie obecności CAPTCHA
async function detectCaptcha(page) {
  const captchaSelectors = [
    'iframe[src*="captcha"]',
    'div[id*="captcha"]',
    'div[class*="captcha"]',
    '#recaptcha',
    '.g-recaptcha',
    'iframe[src*="recaptcha"]'
  ];

  for (const selector of captchaSelectors) {
    try {
      const element = await page.$(selector);
      if (element) {
        return true;
      }
    } catch (e) {
      continue;
    }
  }
  
  return false;
}

// Losowa przerwa na "odpoczynek"
async function randomBreak() {
  // 5% szans na dłuższą przerwę
  if (Math.random() < 0.05) {
    const breakTime = Math.floor(Math.random() * 30000) + 10000; // 10-40 sekund
    await randomDelay(breakTime, breakTime + 5000);
  }
}

// Symulacja aktywności na stronie (ruch myszką, scroll)
async function simulateActivity(page) {
  const actions = Math.floor(Math.random() * 3) + 1;
  
  for (let i = 0; i < actions; i++) {
    const action = Math.random();
    
    if (action < 0.5) {
      // Scroll
      const scrollDistance = (Math.random() * 400) + 100;
      await naturalScroll(page, scrollDistance);
    } else {
      // Ruch myszką
      const x = Math.floor(Math.random() * 800) + 100;
      const y = Math.floor(Math.random() * 600) + 100;
      await naturalMouseMovement(page, x, y);
    }
    
    await randomDelay(300, 1000);
  }
}

module.exports = {
  randomDelay,
  randomTyping,
  naturalMouseMovement,
  naturalScroll,
  getTypingPattern,
  getRandomUserAgent,
  calculateReadingTime,
  detectCaptcha,
  randomBreak,
  simulateActivity
};
