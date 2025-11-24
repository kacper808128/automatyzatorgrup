# Instrukcja Instalacji - Facebook Group Automation

## 📋 Wymagania wstępne

Przed instalacją upewnij się, że masz zainstalowane:

1. **Node.js** (wersja 16 lub nowsza)
   - Pobierz z: https://nodejs.org/
   - Sprawdź wersję: `node --version`

2. **npm** (instalowane automatycznie z Node.js)
   - Sprawdź wersję: `npm --version`

3. **Git** (opcjonalnie, do klonowania repozytorium)
   - Pobierz z: https://git-scm.com/

## 🚀 Instalacja krok po kroku

### Krok 1: Pobierz kod źródłowy

Jeśli masz Git:
```bash
git clone <url-repozytorium>
cd facebook-automation
```

Lub po prostu rozpakuj archiwum ZIP w wybranym folderze.

### Krok 2: Zainstaluj zależności

W katalogu głównym projektu wykonaj:

```bash
npm install
```

To polecenie:
- Pobierze wszystkie wymagane pakiety
- Zainstaluje Electron
- Zainstaluje Puppeteer i inne biblioteki
- Może potrwać 2-5 minut

### Krok 3: Uruchom aplikację w trybie deweloperskim

```bash
npm run dev
```

lub

```bash
npm start
```

Aplikacja powinna się uruchomić i otworzyć okno.

## 📦 Budowanie aplikacji (kompilacja)

Jeśli chcesz stworzyć standalone aplikację:

### Windows
```bash
npm run build:win
```
Wynik: `dist/Facebook Group Automation Setup.exe`

### macOS
```bash
npm run build:mac
```
Wynik: `dist/Facebook Group Automation.dmg`

### Linux
```bash
npm run build:linux
```
Wynik: `dist/Facebook Group Automation.AppImage`

## 🔧 Rozwiązywanie problemów

### Problem: "npm: command not found"
**Rozwiązanie:** Zainstaluj Node.js ze strony nodejs.org

### Problem: "Cannot find module 'electron'"
**Rozwiązanie:** 
```bash
npm install
```

### Problem: Puppeteer nie pobiera Chromium
**Rozwiązanie:**
```bash
npm install puppeteer --force
```

### Problem: Błędy przy budowaniu na Windows
**Rozwiązanie:** Zainstaluj Windows Build Tools:
```bash
npm install --global windows-build-tools
```

### Problem: Błędy przy budowaniu na macOS
**Rozwiązanie:** Zainstaluj Xcode Command Line Tools:
```bash
xcode-select --install
```

### Problem: Brak uprawnień na Linux
**Rozwiązanie:**
```bash
sudo npm install
```

### Problem: Port zajęty
**Rozwiązanie:** Zamknij inne instancje Electron lub zmień port

## 📝 Weryfikacja instalacji

Po instalacji sprawdź czy:
1. ✅ Aplikacja się uruchamia
2. ✅ Interfejs ładuje się poprawnie
3. ✅ Wszystkie zakładki działają
4. ✅ Możesz zapisać dane logowania

## 🎯 Pierwsze uruchomienie

Po pierwszym uruchomieniu:
1. Przejdź do zakładki "🔐 Logowanie"
2. Wprowadź dane Facebook
3. Kliknij "Testuj logowanie" aby sprawdzić
4. Skonfiguruj pozostałe ustawienia według potrzeb

## 🆘 Pomoc

Jeśli napotkasz problemy:
1. Sprawdź logi w konsoli: `Ctrl+Shift+I` (Windows/Linux) lub `Cmd+Opt+I` (Mac)
2. Usuń folder `node_modules` i wykonaj ponownie `npm install`
3. Upewnij się, że masz najnowszą wersję Node.js
4. Sprawdź czy nie blokuje firewall lub antywirus

## 📌 Uwagi dodatkowe

- Pierwsze uruchomienie może trwać dłużej (Puppeteer pobiera Chromium)
- Zalecane jest użycie najnowszej stabilnej wersji Node.js
- Na systemach Linux może być potrzebne zainstalowanie dodatkowych bibliotek dla Chromium

## ✅ Gotowe!

Po pomyślnej instalacji możesz rozpocząć korzystanie z aplikacji. Przeczytaj README.md aby dowiedzieć się więcej o funkcjonalnościach.
