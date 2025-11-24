#!/bin/bash

echo "🚀 Facebook Group Automation - Instalacja"
echo "=========================================="
echo ""

# Sprawdź Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js nie jest zainstalowany!"
    echo "Zainstaluj przez: brew install node"
    exit 1
fi

echo "✅ Node.js: $(node --version)"
echo ""

# Sprawdź czy mamy Chrome
echo "🔍 Szukam Google Chrome..."
if [ -f "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" ]; then
    echo "✅ Znaleziono Google Chrome"
    CHROME_FOUND=true
else
    echo "⚠️  Nie znaleziono Google Chrome"
    echo "Aplikacja użyje Puppeteer Chromium (zostanie pobrany)"
    CHROME_FOUND=false
fi
echo ""

# Instalacja
echo "📦 Instaluję zależności..."
echo "To może potrwać kilka minut ☕"
echo ""

# Wyczyść cache jeśli są problemy
if [ -d "node_modules" ]; then
    echo "🧹 Czyszczę stare pliki..."
    rm -rf node_modules package-lock.json
fi

# Instaluj z timeout
echo "Instaluję npm packages..."
npm install --prefer-offline --no-audit --progress=true

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Instalacja zakończona!"
    echo ""
    echo "🚀 Uruchom aplikację:"
    echo "   npm start"
    echo ""
    echo "   lub:"
    echo "   ./run.sh"
    echo ""
else
    echo ""
    echo "❌ Instalacja nie powiodła się"
    echo ""
    echo "Spróbuj:"
    echo "1. npm cache clean --force"
    echo "2. rm -rf node_modules package-lock.json"
    echo "3. npm install"
    echo ""
fi
