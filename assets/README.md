# Assets Directory

Ten katalog zawiera zasoby graficzne aplikacji.

## Wymagane pliki

Aby aplikacja działała poprawnie, potrzebne są następujące pliki ikon:

### Windows
- `icon.ico` - Ikona dla systemu Windows (256x256px, format ICO)

### macOS
- `icon.icns` - Ikona dla systemu macOS (512x512px, format ICNS)

### Linux
- `icon.png` - Ikona dla systemu Linux (512x512px, format PNG)

## Tworzenie ikon

### Z pliku PNG na wszystkie formaty

Jeśli masz plik `icon.png` (512x512px), możesz użyć następujących narzędzi:

#### Windows (.ico)
```bash
# Użyj ImageMagick
convert icon.png -define icon:auto-resize=256,128,96,64,48,32,16 icon.ico
```

#### macOS (.icns)
```bash
# Użyj iconutil (wbudowane w macOS)
mkdir icon.iconset
sips -z 16 16 icon.png --out icon.iconset/icon_16x16.png
sips -z 32 32 icon.png --out icon.iconset/icon_16x16@2x.png
sips -z 32 32 icon.png --out icon.iconset/icon_32x32.png
sips -z 64 64 icon.png --out icon.iconset/icon_32x32@2x.png
sips -z 128 128 icon.png --out icon.iconset/icon_128x128.png
sips -z 256 256 icon.png --out icon.iconset/icon_128x128@2x.png
sips -z 256 256 icon.png --out icon.iconset/icon_256x256.png
sips -z 512 512 icon.png --out icon.iconset/icon_256x256@2x.png
sips -z 512 512 icon.png --out icon.iconset/icon_512x512.png
cp icon.png icon.iconset/icon_512x512@2x.png
iconutil -c icns icon.iconset
```

## Design Guidelines

### Rekomendacje dla ikony aplikacji:
- **Rozmiar bazowy:** 512x512px
- **Format:** PNG z przezroczystością
- **Styl:** Prosty, rozpoznawalny, współczesny
- **Kolory:** Zgodne z paletą aplikacji (niebieski #1877f2, zielony #42b72a)
- **Motyw:** Ikona powinna sugerować automatyzację/Facebook/grupy

### Przykładowe elementy:
- Checkmark (✓) - symbol automatyzacji/sukcesu
- Facebook "f" lub podobny element
- Grupa ludzi (symbolicznie)
- Mechanizm/koło zębate - automatyzacja
- Kombinacja powyższych

## Placeholder Icons

Do czasu stworzenia właściwych ikon, możesz użyć:
- Darmowych ikon z flaticon.com
- Material Design Icons
- Font Awesome icons

## Status

⚠️ **Uwaga:** Obecnie katalog zawiera placeholdery. 
Dodaj właściwe ikony przed budowaniem aplikacji dla produkcji.
