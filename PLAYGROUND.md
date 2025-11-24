# 🎮 Playground - Dokumentacja

## Czym jest Playground?

Playground to tryb automatyzacji oparty na AI (Claude), gdzie opisujesz co chcesz zrobić **językiem naturalnym**, a Claude:
1. Konwertuje to na kod Puppeteer
2. Wykonuje kod automatycznie
3. Zwraca wyniki

## Konfiguracja

### 1. Pobierz API Key
1. Przejdź do: https://aistudio.google.com/app/apikey
2. Zaloguj się kontem Google
3. Kliknij "Create API Key"
4. Skopiuj klucz (format: `AIza...`)

**DARMOWY:** 15 zapytań/min, 1500/dzień (Flash), 2 zapytań/min (Pro)

### 2. Ustaw w aplikacji
1. Otwórz zakładkę "🎮 Playground"
2. Wklej API Key
3. Kliknij "💾 Zapisz API Key"

## Użycie

### Podstawowy przykład

**Strona:** `https://instagram.com`

**Czynności:**
```
kliknij profile
włącz rolkę z shortcode DQL4CaljyYW
kliknij View insights
odczytaj wartość liczbową obok napisu Views
```

**Co się stanie:**
1. AI wygeneruje kod Puppeteer
2. Otworzy przeglądarkę
3. Przejdzie na instagram.com
4. Wykona kroki
5. Zwróci wynik (liczba Views)

### Z cookies (bez logowania)

**Cookies:**
```json
[
  {
    "name": "sessionid",
    "value": "twoj_session_id",
    "domain": ".instagram.com",
    "path": "/"
  }
]
```

Bot użyje cookies zamiast logować się.

## Przykłady instrukcji

### Facebook - sprawdź notyfikacje
```
kliknij ikonę dzwonka (notifications)
policz czerwone kropki (nowe notyfikacje)
zwróć liczbę jako notifications_count
```

### LinkedIn - znajdź ogłoszenie
```
wpisz "Software Engineer Warsaw" w pole wyszukiwania
kliknij pierwszy wynik
odczytaj tytuł stanowiska
odczytaj nazwę firmy
zwróć jako job_title i company_name
```

### Twitter - sprawdź tweet
```
przejdź do tweeta o ID 1234567890
odczytaj liczbę polubień
odczytaj liczbę retweetów
zwróć jako likes i retweets
```

### E-commerce - sprawdź cenę
```
kliknij przycisk "Dodaj do koszyka"
przejdź do koszyka
odczytaj całkowitą cenę
zwróć jako total_price
```

## Zasady pisania instrukcji

### ✅ Dobre:
- **Konkretne:** "kliknij przycisk Opublikuj"
- **Opisowe:** "odczytaj liczebę obok tekstu 'Views'"
- **Sekwencyjne:** krok po kroku
- **Zwracaj wyniki:** "zwróć jako nazwa_zmiennej"

### ❌ Złe:
- Zbyt ogólne: "zrób coś z profilem"
- Niejasne: "kliknij to"
- Za skomplikowane: "wykonaj 20 kroków jednocześnie"

## Cookies - jak pobrać?

### Chrome DevTools
1. Otwórz stronę (np. instagram.com)
2. Zaloguj się
3. F12 → Application → Cookies
4. Skopiuj ważne cookies (sessionid, csrftoken, etc.)

### Format JSON
```json
[
  {
    "name": "nazwa_cookie",
    "value": "wartość",
    "domain": ".domena.com",
    "path": "/",
    "secure": true,
    "httpOnly": false
  }
]
```

**Wymagane pola:**
- `name` - nazwa cookie
- `value` - wartość
- `domain` - domena (z kropką na początku)

**Opcjonalne:**
- `path` - ścieżka (domyślnie "/")
- `secure` - HTTPS (domyślnie false)
- `httpOnly` - JavaScript (domyślnie false)

## Ograniczenia

### Co działa:
- ✅ Klikanie elementów
- ✅ Wpisywanie tekstu
- ✅ Scrollowanie
- ✅ Odczytywanie treści
- ✅ Czekanie na elementy
- ✅ Cookies

### Co NIE działa:
- ❌ Captcha (musisz ręcznie)
- ❌ 2FA (musisz ręcznie)
- ❌ Bardzo skomplikowane scenariusze
- ❌ Pobieranie plików

## Koszty API

**Google Gemini (DARMOWY!):**
- **Gemini 1.5 Flash:** 15 zapytań/min, 1500/dzień
- **Gemini 1.5 Pro:** 2 zapytań/min, 50/dzień
- **Gemini 2.0 Flash:** 10 zapytań/min, 1500/dzień

**Aplikacja używa: Gemini 1.5 Flash (darmowy!)**

**Typowa automatyzacja:**
- Prompt: ~500 tokens
- Odpowiedź: ~200 tokens
- **Koszt: $0 (DARMOWE!)**

Limit: 1500 automatyzacji/dzień

## Troubleshooting

### "Brak API Key"
- Ustaw API Key w zakładce Playground
- Sprawdź czy klucz jest poprawny (format: sk-ant-...)

### "Element not found"
- Instrukcje zbyt ogólne
- Użyj dokładniejszych opisów
- Spróbuj innego selektora

### "Timeout"
- Strona ładuje się za długo
- Dodaj: "poczekaj 5 sekund"
- Sprawdź internet

### Bot wykonuje niewłaściwe akcje
- Instrukcje są niejednoznaczne
- Bądź bardziej precyzyjny
- Opisz dokładniej co kliknąć

## Przykłady użycia

### 1. Monitor Instagram Insights
```javascript
// Strona: https://instagram.com
// Cookies: [twoje cookies z zalogowanej sesji]
// Instrukcje:
kliknij profile
włącz pierwszy post
kliknij View insights
odczytaj Views
odczytaj Likes
odczytaj Shares
zwróć jako views, likes, shares
```

### 2. Sprawdź cenę produktu
```javascript
// Strona: https://allegro.pl/oferta/...
// Instrukcje:
odczytaj aktualną cenę
odczytaj oryginalną cenę
oblicz % rabatu
zwróć jako current_price, original_price, discount
```

### 3. Monitor konkurencji
```javascript
// Strona: https://competitor.com
// Instrukcje:
przejdź do sekcji pricing
odczytaj cenę planu Basic
odczytaj cenę planu Pro
zwróć jako basic_price, pro_price
```

## FAQ

**Q: Czy mogę używać Playground do Facebook postowania?**  
A: Tak, ale lepiej użyj standardowej zakładki "Postowanie" - jest zoptymalizowana.

**Q: Czy cookies są bezpieczne?**  
A: Cookies są przechowywane lokalnie, nigdzie nie są wysyłane poza użycie w przeglądarce.

**Q: Czy mogę zautomatyzować logowanie?**  
A: Lepiej użyj cookies - szybsze i bezpieczniejsze.

**Q: Ile kosztuje API?**  
A: **DARMOWE!** 1500 automatyzacji dziennie (Gemini Flash)

**Q: Czy mogę wykonać wiele zadań naraz?**  
A: Nie, Playground wykonuje jedno zadanie naraz.

## Wsparcie

Problemy? Zgłoś z:
- Instrukcjami (co chciałeś zrobić)
- Logami z Playground
- URL strony
- Screenshotem
