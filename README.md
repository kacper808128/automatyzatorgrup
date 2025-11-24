# Facebook Group Automation - Aplikacja Desktopowa

✅ **Pełnofunkcjonalna aplikacja do automatyzacji postowania na grupach Facebook**

> 🎉 **Nowa wersja 1.0.6!** - Naprawiono weryfikację Facebook, pisanie w komentarzach i Shift+Enter. [Zobacz szczegóły](UPDATE_GUIDE_v1.0.6.md)

## 🎯 Funkcjonalności

### ✅ Prawdziwa automatyzacja
- **Puppeteer** - pełna automatyzacja przeglądarki
- Automatyczne logowanie do Facebook
- Automatyczne postowanie na wielu grupach
- Obsługa różnych typów treści

### 🔒 Szyfrowanie
- **AES-256-GCM** - wojskowy standard szyfrowania
- Bezpieczne przechowywanie danych logowania
- Lokalne przechowywanie (brak wysyłania danych)

### 🌐 Proxy Support
- Integracja z dowolnym proxy HTTP/HTTPS
- Przykład: 79.110.198.37:8080
- Obsługa proxy z autoryzacją (username/password)
- Rotacja proxy (opcjonalna)

### 🤖 Symulacja ludzkiego zachowania
- **Random delays** - losowe opóźnienia między akcjami
- **Typing patterns** - naturalne tempo pisania
- **Reading simulation** - symulacja czytania treści
- Losowe przerwy i aktywność na stronie
- Różne wzorce zachowania (szybki/normalny/wolny/myślący)

### 🛡️ Detekcja CAPTCHA
- Automatyczne wykrywanie CAPTCHA
- Real-time alerty o konieczności weryfikacji
- Możliwość wstrzymania procesu
- Powiadomienia systemowe

### 📅 Planowanie tasków
- **Schedule** - harmonogram zadań
- Jednokrotowe wykonanie
- Codzienne wykonanie (daily)
- Tygodniowe (weekly) - wybrane dni
- Co X minut (interval)
- **Pause/Resume** - wstrzymanie i wznowienie
- **Cancel** - anulowanie zadania

### 🔔 Notyfikacje
- Real-time powiadomienia systemowe
- Alerty o problemach
- Status operacji
- Historia logów

## 📦 Instalacja

### Wymagania
- Node.js 16+ 
- npm lub yarn
- Windows / macOS / Linux

### Kroki instalacji

1. **Instalacja zależności:**
```bash
npm install
```

2. **Uruchomienie w trybie deweloperskim:**
```bash
npm run dev
```

3. **Budowanie aplikacji:**
```bash
# Windows
npm run build:win

# macOS
npm run build:mac

# Linux
npm run build:linux
```

## 🚀 Użytkowanie

### 1. Konfiguracja danych logowania
- Przejdź do zakładki **"🔐 Logowanie"**
- Wprowadź email/telefon i hasło do Facebook
- Kliknij **"💾 Zapisz dane"**
- Opcjonalnie: kliknij **"🔍 Testuj logowanie"** aby sprawdzić poprawność

### 2. Konfiguracja Proxy (opcjonalnie)
- Przejdź do zakładki **"🌐 Proxy"**
- Zaznacz **"Włącz proxy"**
- Wprowadź dane proxy (host, port)
- Opcjonalnie: username i hasło
- Kliknij **"💾 Zapisz konfigurację proxy"**

### 3. Postowanie manualne
- Przejdź do zakładki **"📝 Postowanie"**
- Wpisz treść posta
- Dodaj URL-e grup (każdy w nowej linii)
- Ustaw opóźnienie między postami (rekomendowane: 60-120 sekund)
- Kliknij **"▶️ Rozpocznij postowanie"**

### 4. Planowanie automatyczne
- Przejdź do zakładki **"📅 Harmonogram"**
- Kliknij **"➕ Dodaj harmonogram"**
- Wypełnij formularz:
  - Nazwa harmonogramu
  - Typ (jednorazowo/codziennie/co tydzień/co X minut)
  - Godzina wykonania
  - Treść posta
  - Lista grup
- Kliknij **"Zapisz"**

### 5. Monitorowanie
- Zakładka **"📋 Logi"** - podgląd wszystkich operacji
- Status w prawym górnym rogu
- Powiadomienia systemowe o ważnych wydarzeniach

## ⚙️ Ustawienia

### Symulacja ludzkiego zachowania
- **Prędkość pisania** - szybka/normalna/wolna/z zastanowieniem
- **Losowe opóźnienia** - naturalne przerwy między akcjami
- **Symulacja czytania** - czas na "przeczytanie" treści

### Detekcja CAPTCHA
- **Alerty o CAPTCHA** - powiadomienia o wykryciu
- **Auto-pause** - automatyczne wstrzymanie przy CAPTCHA

### Powiadomienia
- **Powiadomienia systemowe** - desktop notifications
- **Dźwiękowe alerty** - opcjonalne

## 🔧 Struktura projektu

```
facebook-automation/
├── src/
│   ├── main.js                    # Główny proces Electron
│   ├── automation/
│   │   ├── automation-manager.js  # Menedżer automatyzacji
│   │   └── schedule-manager.js    # Menedżer harmonogramu
│   ├── utils/
│   │   ├── human-behavior.js      # Symulacja ludzkiego zachowania
│   │   └── proxy-manager.js       # Obsługa proxy
│   └── ui/
│       ├── index.html             # Interfejs użytkownika
│       ├── styles.css             # Style
│       └── renderer.js            # Logika UI
├── assets/                        # Ikony i zasoby
├── package.json                   # Konfiguracja projektu
└── README.md                      # Dokumentacja
```

## 🛡️ Bezpieczeństwo

### Szyfrowanie danych
- Wszystkie dane logowania są szyfrowane AES-256-GCM
- Klucz szyfrowania przechowywany lokalnie
- Brak wysyłania danych na zewnętrzne serwery

### Proxy
- Opcjonalne użycie proxy dla dodatkowej anonimowości
- Obsługa proxy z autoryzacją
- Możliwość rotacji proxy

### Symulacja ludzkiego zachowania
- Losowe opóźnienia chroniące przed wykryciem jako bot
- Naturalne tempo pisania
- Różne wzorce zachowania

## ⚠️ Ważne uwagi

1. **Odpowiedzialność** - używaj aplikacji zgodnie z regulaminem Facebook
2. **Limity** - nie spamuj, zachowuj rozsądne przerwy między postami
3. **CAPTCHA** - może wymagać ręcznej interwencji
4. **Bezpieczeństwo konta** - używaj na własne ryzyko
5. **Proxy** - zwiększa bezpieczeństwo, ale nie gwarantuje pełnej anonimowości

## 📝 Changelog

### v1.0.0 (2025-10-23)
- ✅ Pierwsza wersja aplikacji
- ✅ Wszystkie kluczowe funkcjonalności zaimplementowane
- ✅ Pełne szyfrowanie AES-256
- ✅ Obsługa proxy
- ✅ Symulacja ludzkiego zachowania
- ✅ Detekcja CAPTCHA
- ✅ Harmonogram zadań
- ✅ Powiadomienia real-time

## 🤝 Wsparcie

Jeśli napotkasz problemy:
1. Sprawdź logi w zakładce **"📋 Logi"**
2. Upewnij się, że masz najnowszą wersję Node.js
3. Sprawdź czy dane logowania są poprawne
4. Testuj proxy przed użyciem

## 📄 Licencja

MIT License - Użytkuj na własne ryzyko.

---

**Uwaga:** Ta aplikacja jest narzędziem edukacyjnym. Używaj jej odpowiedzialnie i zgodnie z regulaminem Facebook oraz obowiązującymi przepisami prawa.
