# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.6] - 2025-10-23 - IMPORTANT VERIFICATION & POSTING FIX

### Fixed
- 🔥 **CRITICAL:** Naprawiono zbyt szybkie wznowienie po weryfikacji Facebook
  - Problem: Bot wznawiał akcję przed faktycznym zalogowaniem, co powodowało błędy
  - Rozwiązanie: 
    - Zwiększono czas sprawdzania (8-12s między sprawdzeniami)
    - Dodano dokładną weryfikację logowania (minimum 2 wskaźniki zalogowanej sesji)
    - Dodano 10-sekundowe oczekiwanie na pełne załadowanie po weryfikacji
    - Dodano 3-5 sekundową przerwę przed kontynuacją automatyzacji
  - Teraz bot czeka aż konto faktycznie się zaloguje ✅

- 🐛 **CRITICAL:** Naprawiono problem z pisaniem w komentarzach zamiast w postach
  - Problem: Bot klikał w pole komentarzy zamiast w pole tworzenia posta
  - Rozwiązanie:
    - Dodano filtrowanie elementów - wykluczenie pól z "komentarz"/"comment"
    - Dodano sprawdzanie struktury DOM (parent elements)
    - Bot szuka tylko głównego pola "Co słychać"/"What's on your mind"
    - Scrollowanie do góry strony przed próbą znalezienia pola
  - Teraz bot zawsze pisze w polu tworzenia posta, nie w komentarzach ✅

- 🐛 **FIX:** Naprawiono używanie Enter zamiast Shift+Enter
  - Problem: Bot używał Enter co powodowało natychmiastową publikację
  - Rozwiązanie:
    - Przebudowano wpisywanie tekstu linia po linii
    - Używa Shift+Enter dla nowych linii
    - Zwykły Enter nie jest używany podczas pisania
    - Wieloliniowe posty działają poprawnie
  - Teraz wieloliniowe posty działają bez przedwczesnej publikacji ✅

### Changed
- Zwiększono opóźnienia po przejściu do grupy (5-7s)
- Ulepszono wykrywanie przycisków publikacji
- Dodano bardziej szczegółowe logi procesu
- Ulepszono sprawdzanie widoczności przycisków

### Technical
- Refactored `handleVerificationScreen()` - dodano multi-indicator verification
- Refactored `postToGroup()` - kompletne przepisanie logiki tworzenia posta
- Dodano filtrowanie elementów DOM dla pól komentarzy
- Zaimplementowano linia-po-linii wpisywanie z Shift+Enter

## [1.0.2] - 2025-10-23 - CRITICAL HOTFIX

### Fixed
- 🔥 **CRITICAL:** Zmieniono `puppeteer-core` na `puppeteer` (zawiera Chromium)
  - Problem: "An `executablePath` or `channel` must be specified for `puppeteer-core`"
  - Rozwiązanie: Użycie pełnej wersji puppeteer z wbudowanym Chromium
  - Test logowania teraz działa ✅
  - Postowanie działa ✅
  - Proxy działa ✅
- 🐛 Dodano brakujący handler `delete-schedule` w main.js
  - Usuwanie harmonogramów teraz działa ✅

### Changed
- Zmieniono dependency: `puppeteer-core` → `puppeteer`
- Dodano IPC handler dla usuwania harmonogramów

### Important
- **MUSISZ** ponownie uruchomić `npm install` aby pobrać Chromium!
- Pierwsze uruchomienie pobierze ~150MB (Chromium)

## [1.0.1] - 2025-10-23 - HOTFIX

### Fixed
- 🐛 **CRITICAL FIX:** Naprawiono błąd uruchamiania aplikacji
  - Problem: "TypeError: Cannot read properties of undefined (reading 'on')"
  - Rozwiązanie: Przeniesiono event listeners do funkcji setupAutomationListeners()
  - Event listeners są teraz ustawiane PO utworzeniu automationManager
  - Dodano sprawdzenie bezpieczeństwa przed dostępem do automationManager

### Technical
- Refactored src/main.js to properly initialize event listeners
- Added setupAutomationListeners() function
- Fixed initialization order in app.whenReady()

## [1.0.0] - 2025-10-23

### Added
- ✅ **Prawdziwa automatyzacja** z Puppeteer
  - Automatyczne logowanie do Facebook
  - Automatyczne postowanie na grupach
  - Obsługa wielu grup jednocześnie
  
- 🔒 **Szyfrowanie AES-256-GCM**
  - Bezpieczne przechowywanie danych logowania
  - Lokalne przechowywanie (brak wysyłania do sieci)
  - Klucz szyfrowania generowany lokalnie
  
- 🌐 **Obsługa Proxy**
  - Integracja z HTTP/HTTPS proxy
  - Obsługa autoryzacji (username/password)
  - Przykładowa konfiguracja: 79.110.198.37:8080
  - Możliwość rotacji proxy
  
- 🤖 **Symulacja ludzkiego zachowania**
  - Random delays - losowe opóźnienia między akcjami
  - Typing patterns - naturalne tempo pisania (szybkie/normalne/wolne/z zastanowieniem)
  - Reading simulation - symulacja czytania treści
  - Mouse movements - naturalne ruchy myszką
  - Scrolling - losowe przewijanie strony
  - Random breaks - losowe przerwy
  
- 🛡️ **Detekcja CAPTCHA**
  - Automatyczne wykrywanie CAPTCHA na stronie
  - Real-time alerty o konieczności weryfikacji
  - Powiadomienia systemowe
  - Automatyczne wstrzymanie procesu
  - Obsługa różnych typów CAPTCHA
  
- 📅 **Planowanie tasków**
  - Schedule - zaawansowany harmonogram zadań
  - Jednokrotowe wykonanie (once)
  - Codzienne wykonanie (daily)
  - Tygodniowe wykonanie (weekly) z wyborem dni
  - Interwałowe wykonanie (co X minut)
  - Pause/Resume - wstrzymanie i wznowienie zadań
  - Cancel - anulowanie zadań
  
- 🔔 **Notyfikacje**
  - Real-time powiadomienia systemowe
  - Alerty o problemach i błędach
  - Status operacji
  - Historia logów
  - Toast notifications w UI
  
- 🎨 **Interfejs użytkownika**
  - Nowoczesny dark theme
  - Responsywny design
  - Intuicyjna nawigacja
  - Zakładki: Logowanie, Postowanie, Harmonogram, Proxy, Logi, Ustawienia
  - Wizualizacja statusu
  - Progress bar dla operacji
  
- 📊 **System logowania**
  - Kolorowe logi z typami (info/success/warning/error)
  - Historia ostatnich 100 logów
  - Export logów do pliku
  - Filtrowanie logów
  - Timestampy dla każdego wpisu
  
- ⚙️ **Zaawansowane ustawienia**
  - Konfiguracja prędkości pisania
  - Włączanie/wyłączanie symulacji
  - Ustawienia powiadomień
  - Konfiguracja detekcji CAPTCHA
  
- 📦 **Build system**
  - Electron Builder
  - Budowanie dla Windows (.exe)
  - Budowanie dla macOS (.dmg)
  - Budowanie dla Linux (.AppImage)
  
- 📝 **Dokumentacja**
  - README.md - główna dokumentacja
  - INSTALL.md - instrukcja instalacji
  - EXAMPLES.md - przykłady użycia
  - FAQ.md - często zadawane pytania
  - CONTRIBUTING.md - jak współtworzyć
  - CHANGELOG.md - historia zmian

### Security
- AES-256-GCM encryption for credentials
- PBKDF2 key derivation
- Local-only data storage
- No external data transmission
- Secure credential management

### Technical
- Electron 27+
- Puppeteer with Stealth plugin
- Node.js 16+ required
- Cross-platform compatibility
- Modular architecture
- Event-driven design
- IPC communication
- Electron Store for persistence

### Known Issues
- Facebook may change selectors requiring updates
- CAPTCHA requires manual intervention
- Some groups may require post approval
- Image posting not yet supported (planned for v1.1)

### Future Plans
- 📸 Image/video posting support
- 🔄 Account switching
- 📈 Analytics dashboard
- 🌍 Multi-language support
- 🎯 Advanced targeting
- 📱 Mobile app version
- ☁️ Cloud sync option
- 🤝 Group management features

---

## [Unreleased]

### Planned for v1.1.0
- Image and video posting support
- Multiple account management
- Enhanced analytics
- Improved error handling
- Better CAPTCHA detection
- Performance optimizations

### Planned for v1.2.0
- Multi-language support (EN, PL, ES, FR, DE)
- Cloud backup option
- Advanced scheduling features
- Group analytics
- A/B testing for posts

### Planned for v2.0.0
- Complete UI redesign
- Mobile companion app
- Team collaboration features
- Advanced AI-powered features
- Enterprise features

---

## Version History

- **1.0.0** (2025-10-23) - Initial release with all core features

---

For more information about updates and roadmap, visit the project repository.
