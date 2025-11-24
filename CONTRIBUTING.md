# Contributing to Facebook Group Automation

Dziękujemy za zainteresowanie współtworzeniem projektu! 🎉

## 🤝 Jak możesz pomóc

- 🐛 Zgłaszanie bugów
- 💡 Proponowanie nowych funkcji
- 📝 Poprawianie dokumentacji
- 💻 Dodawanie nowego kodu
- 🌍 Tłumaczenia

## 📋 Zasady współpracy

### Zgłaszanie błędów

Przed zgłoszeniem błędu:
1. Sprawdź czy problem nie został już zgłoszony
2. Upewnij się, że używasz najnowszej wersji
3. Sprawdź logi aplikacji

W zgłoszeniu zawrzyj:
- Opis problemu
- Kroki do reprodukcji
- Oczekiwane zachowanie
- Rzeczywiste zachowanie
- System operacyjny
- Wersja Node.js
- Logi (jeśli dostępne)

### Proponowanie funkcji

1. Sprawdź czy funkcja nie jest już planowana
2. Opisz przypadek użycia
3. Uzasadnij dlaczego funkcja jest potrzebna
4. Zaproponuj jak powinna działać

### Proces dodawania kodu

1. **Fork** repozytorium
2. Stwórz **branch** dla swojej funkcji: `git checkout -b feature/nazwa-funkcji`
3. **Commit** zmian: `git commit -m 'Add: opis zmian'`
4. **Push** do brancha: `git push origin feature/nazwa-funkcji`
5. Stwórz **Pull Request**

### Konwencje kodowania

#### JavaScript/Node.js
- Używaj ES6+ (const, let, arrow functions)
- Formatowanie: 2 spacje (nie taby)
- Nazewnictwo: camelCase dla zmiennych, PascalCase dla klas
- Dodaj komentarze do skomplikowanej logiki
- Unikaj global variables

#### Struktura commitów
```
Type: Krótki opis (max 50 znaków)

Dłuższy opis jeśli potrzebny.

Przykłady typu:
- Add: Dodanie nowej funkcji
- Fix: Naprawa buga
- Update: Aktualizacja istniejącej funkcji
- Refactor: Refaktoryzacja kodu
- Docs: Zmiany w dokumentacji
- Style: Formatowanie, białe znaki
- Test: Dodanie testów
```

### Testy

Przed wysłaniem Pull Requesta:
1. Przetestuj zmiany lokalnie
2. Upewnij się, że aplikacja się uruchamia
3. Sprawdź czy nie zepsułeś istniejących funkcji
4. Dodaj testy dla nowych funkcji (jeśli możliwe)

### Code Review

Twój PR zostanie sprawdzony pod kątem:
- Jakości kodu
- Zgodności z konwencjami
- Działania funkcjonalności
- Dokumentacji
- Bezpieczeństwa

## 📚 Struktura projektu

```
src/
├── main.js              # Główny proces Electron
├── automation/          # Logika automatyzacji
│   ├── automation-manager.js
│   └── schedule-manager.js
├── utils/               # Narzędzia pomocnicze
│   ├── human-behavior.js
│   └── proxy-manager.js
├── ui/                  # Interfejs użytkownika
│   ├── index.html
│   ├── styles.css
│   └── renderer.js
└── config/              # Konfiguracja
    ├── config.js
    └── selectors.js
```

## 🔒 Bezpieczeństwo

Jeśli znajdziesz lukę bezpieczeństwa:
1. **NIE** zgłaszaj publicznie
2. Skontaktuj się prywatnie z maintainerami
3. Opisz problem szczegółowo
4. Daj czas na naprawę przed publicznym ujawnieniem

## 📝 Dokumentacja

Dokumentując kod:
- Używaj JSDoc dla funkcji
- Dodaj README w nowych modułach
- Aktualizuj główny README.md
- Dodaj przykłady użycia

## 🌟 Dobre praktyki

- **Keep it simple** - prosty kod to lepszy kod
- **DRY** - Don't Repeat Yourself
- **KISS** - Keep It Simple, Stupid
- **YAGNI** - You Aren't Gonna Need It
- **Testing** - przetestuj przed wysłaniem
- **Documentation** - udokumentuj co niejasne

## ❓ Pytania

Masz pytania? 
- Otwórz issue z pytaniem
- Sprawdź dokumentację
- Przejrzyj istniejące issues

## 📜 Licencja

Wysyłając kod zgadzasz się na licencję MIT.

## 🙏 Podziękowania

Dziękujemy wszystkim kontrybutom za pomoc w rozwoju projektu!

---

Miłego kodowania! 💻✨
