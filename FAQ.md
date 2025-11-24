# FAQ - Często Zadawane Pytania

## 🤔 Ogólne

### Czy aplikacja jest bezpieczna?
Tak! Aplikacja używa szyfrowania AES-256-GCM do przechowywania danych logowania. Wszystkie dane są przechowywane lokalnie na Twoim komputerze.

### Czy Facebook może wykryć automatyzację?
Aplikacja symuluje ludzkie zachowanie (losowe opóźnienia, naturalne tempo pisania), ale żadna automatyzacja nie jest w 100% niewykrywalna. Używaj rozsądnie!

### Czy mogę używać aplikacji komercyjnie?
Aplikacja jest dostępna na licencji MIT. Możesz jej używać, ale pamiętaj o regulaminie Facebook.

### Czy aplikacja działa na Mac/Linux/Windows?
Tak! Aplikacja jest zbudowana w Electron i działa na wszystkich systemach operacyjnych.

## 🔐 Bezpieczeństwo

### Gdzie są przechowywane moje dane logowania?
Dane są przechowywane lokalnie w zaszyfrowanej formie w folderze aplikacji. Nie są wysyłane nigdzie do internetu.

### Czy mogę zmienić hasło po zapisaniu?
Tak, po prostu wprowadź nowe dane w zakładce "Logowanie" i zapisz ponownie.

### Co się stanie jeśli zapomnę wylogować się z aplikacji?
Aplikacja automatycznie wyloguje się po zakończeniu zadań lub zamknięciu przeglądarki.

## 📝 Postowanie

### Ile postów mogę wysłać dziennie?
Zalecamy maksymalnie 30-50 postów dziennie, aby nie narażać konta na blokadę.

### Jakie opóźnienie ustawić między postami?
Minimalne bezpieczne opóźnienie to 60 sekund. Zalecamy 90-120 sekund dla większego bezpieczeństwa.

### Czy mogę używać emotikonów w postach?
Tak! Aplikacja obsługuje wszystkie znaki Unicode, w tym emotikony.

### Czy mogę dodawać zdjęcia?
Obecnie wersja 1.0 obsługuje tylko tekst. Funkcja dodawania zdjęć jest planowana w przyszłości.

### Co się stanie jeśli grupa wymaga zatwierdzenia postów?
Post zostanie wysłany do moderacji. Aplikacja nie otrzyma informacji o jego statusie.

## 🌐 Proxy

### Czy muszę używać proxy?
Nie, proxy jest opcjonalne. Zwiększa jednak bezpieczeństwo i pomaga unikać blokad.

### Jakie proxy są obsługiwane?
Aplikacja obsługuje HTTP i HTTPS proxy, z autoryzacją lub bez.

### Gdzie mogę znaleźć dobre proxy?
Możesz użyć darmowych proxy lub kupić płatne od dostawców jak:
- ProxyMesh
- Bright Data
- Oxylabs

### Czy mogę używać proxy z VPN?
Tak, ale zwykle wystarczy jedno z nich.

### Co zrobić jeśli proxy nie działa?
Sprawdź czy:
- Host i port są poprawne
- Proxy jest aktywne
- Nie wymaga autoryzacji (lub jest podana)

## 📅 Harmonogram

### Jak często mogę planować posty?
Możesz planować nieograniczoną liczbę zadań, ale pamiętaj o rozsądnych limitach dziennych.

### Czy harmonogram działa gdy komputer jest wyłączony?
Nie, aplikacja musi być uruchomiona aby wykonać zaplanowane zadania.

### Czy mogę zatrzymać zaplanowane zadanie?
Tak, możesz wyłączyć lub usunąć harmonogram w dowolnym momencie.

### Co się stanie jeśli komputer zaśnie?
Zaplanowane zadania mogą nie wykonać się. Zalecamy wyłączenie trybu uśpienia.

## 🛡️ CAPTCHA

### Co to jest CAPTCHA?
CAPTCHA to mechanizm weryfikacji, czy użytkownik jest człowiekiem, a nie botem.

### Co zrobić gdy pojawi się CAPTCHA?
Aplikacja automatycznie wykryje CAPTCHA i wyświetli powiadomienie. Rozwiąż CAPTCHA ręcznie w przeglądarce.

### Jak często może pojawić się CAPTCHA?
Zależy od wielu czynników (częstotliwość postów, IP, historia konta). Symulacja ludzkiego zachowania zmniejsza ryzyko.

### Czy mogę automatycznie rozwiązywać CAPTCHA?
Nie zalecamy używania automatycznych solverów, gdyż może to prowadzić do blokady konta.

## ⚙️ Ustawienia

### Jaką prędkość pisania wybrać?
- **Normalna** - dla większości przypadków
- **Szybka** - gdy chcesz przyspieszyć proces (większe ryzyko)
- **Wolna** - dla maksymalnego bezpieczeństwa
- **Z zastanowieniem** - najbardziej naturalna, najdłuższa

### Czy powinienem włączyć symulację czytania?
Tak, to sprawia, że zachowanie jest bardziej naturalne.

### Co to są losowe opóźnienia?
To przerwy między akcjami (kliknięcia, wpisywanie), które sprawiają, że zachowanie wygląda bardziej ludzko.

## 🐛 Rozwiązywanie problemów

### Aplikacja się nie uruchamia
1. Sprawdź czy masz zainstalowany Node.js 16+
2. Wykonaj `npm install` w katalogu aplikacji
3. Sprawdź logi w konsoli

### Nie mogę się zalogować
1. Sprawdź czy dane są poprawne
2. Wyłącz 2FA (lub użyj kodu aplikacji)
3. Sprawdź czy Facebook nie wymaga weryfikacji

### Posty nie są publikowane
1. Sprawdź logi w zakładce "Logi"
2. Upewnij się, że URL-e grup są poprawne
3. Sprawdź czy nie wykryto CAPTCHA

### Aplikacja się zawiesza
1. Zamknij i uruchom ponownie
2. Sprawdź czy masz wystarczająco pamięci RAM
3. Wyłącz inne aplikacje

### Przegląda się nie otwiera
1. Sprawdź czy Puppeteer pobrał Chromium
2. Wykonaj `npm install puppeteer --force`
3. Sprawdź logi błędów

## 💡 Wskazówki

### Jak zwiększyć bezpieczeństwo?
- Używaj proxy
- Ustaw dłuższe opóźnienia (120+ sekund)
- Wybierz wolniejszą prędkość pisania
- Włącz symulację czytania
- Nie wysyłaj zbyt wielu postów dziennie

### Jak przyspieszyć postowanie?
- Zmniejsz opóźnienia (min. 30 sekund)
- Wybierz szybszą prędkość pisania
- Wyłącz symulację czytania
- **Uwaga:** Większe ryzyko wykrycia!

### Najlepsze praktyki
1. Zaczynaj od małej liczby postów (5-10 dziennie)
2. Stopniowo zwiększaj liczbę
3. Używaj różnych treści postów
4. Monitoruj konto pod kątem ostrzeżeń
5. Zachowuj przerwy między sesjami
6. Nie spamuj tych samych grup

## 📊 Limity

### Ile grup mogę dodać jednocześnie?
Technicznie nie ma limitu, ale zalecamy maksymalnie 50 grup na sesję.

### Jak długi może być post?
Facebook ogranicza posty do ~63,206 znaków.

### Ile harmonogramów mogę utworzyć?
Nieograniczona liczba, ale pamiętaj o zasobach systemu.

## 🔄 Aktualizacje

### Jak zaktualizować aplikację?
1. Pobierz najnowszą wersję
2. Zastąp pliki (zachowaj folder user-data)
3. Wykonaj `npm install`

### Czy stracę dane po aktualizacji?
Nie, dane są przechowywane w folderze user-data i pozostają nietknięte.

### Jak sprawdzić wersję aplikacji?
Wersja jest wyświetlana w stopce aplikacji.

## 📞 Wsparcie

### Gdzie mogę zgłosić bug?
Otwórz issue na GitHubie lub skontaktuj się z deweloperem.

### Gdzie znajdę więcej dokumentacji?
Sprawdź pliki:
- README.md - Główna dokumentacja
- INSTALL.md - Instrukcja instalacji
- EXAMPLES.md - Przykłady użycia
- CONTRIBUTING.md - Jak współtworzyć

### Czy jest dostępne wsparcie techniczne?
Projekt jest open-source i community-driven. Pomoc dostępna poprzez issues na GitHubie.

## ⚖️ Prawne

### Czy używanie aplikacji jest legalne?
Używanie automatyzacji może łamać regulamin Facebook. Używaj na własne ryzyko.

### Czy mogę sprzedawać tę aplikację?
Aplikacja jest na licencji MIT - możesz ją modyfikować i dystrybuować, ale musisz zachować informacje o licencji.

### Kto odpowiada za nadużycia?
Użytkownik ponosi pełną odpowiedzialność za sposób użycia aplikacji.

---

**Masz inne pytanie?** Otwórz issue na GitHubie lub sprawdź dokumentację!
