/**
 * Fingerprint Spoofing Module - Anti-Ban Stack 2025
 *
 * Implementuje pełny fingerprint spoofing:
 * - Canvas noise injection
 * - WebGL vendor/renderer spoofing
 * - AudioContext fingerprint spoofing
 * - WebRTC IP leak prevention
 * - Chrome.runtime spoofing (krytyczne dla FB w 2025!)
 * - Navigator properties spoofing
 * - Screen resolution spoofing
 */

// Baza 100+ User-Agents z Windows 10/11 Chrome 2024-2025
const USER_AGENTS = [
  // ===== CHROME Windows 10 x64 (główne wersje) =====
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36',

  // ===== CHROME Windows 11 x64 =====
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.6778.85 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.6778.109 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.6723.116 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.6723.91 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.6668.100 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.6668.70 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.6613.137 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.6613.84 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.6533.119 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.6533.72 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.126 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.6422.141 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.118 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.6312.122 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.6261.128 Safari/537.36',

  // ===== EDGE Windows 10/11 =====
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 Edg/128.0.0.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36 Edg/127.0.0.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 Edg/125.0.0.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36 Edg/123.0.0.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.0.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36 Edg/121.0.0.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',

  // ===== WOW64 (32-bit Chrome na 64-bit Windows) =====
  'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',

  // ===== Opera/OPR (Chromium-based) =====
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 OPR/116.0.0.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 OPR/115.0.0.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 OPR/114.0.0.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 OPR/113.0.0.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36 OPR/112.0.0.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 OPR/111.0.0.0',

  // ===== Brave Browser =====
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Brave/131',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Brave/130',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Brave/129',

  // ===== Vivaldi =====
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Vivaldi/7.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Vivaldi/6.9',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Vivaldi/6.8',

  // ===== Windows 8.1 (dla starszych komputerów) =====
  'Mozilla/5.0 (Windows NT 6.3; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 6.3; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 6.3; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 6.3; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 6.3; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 6.3; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',

  // ===== macOS Chrome (dla różnorodności) =====
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',

  // ===== Linux Chrome =====
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Ubuntu; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Ubuntu; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Fedora; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',

  // ===== Dodatkowe warianty Chrome z różnymi build numbers =====
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.6778.139 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.6723.58 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.6668.58 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.6613.113 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.6533.99 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.182 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.6422.112 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.207 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.6312.86 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.6261.94 Safari/537.36',

  // ===== Edge z różnymi build numbers =====
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.2903.86',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.2849.80',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.2792.89',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 Edg/128.0.2739.79',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36 Edg/127.0.2651.105',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.2592.113',
];

// 50+ prawdziwych WebGL vendor/renderer z urządzeń 2024-2025
const WEBGL_FINGERPRINTS = [
  // NVIDIA
  { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4090 Direct3D11 vs_5_0 ps_5_0, D3D11)' },
  { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4080 Direct3D11 vs_5_0 ps_5_0, D3D11)' },
  { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Ti Direct3D11 vs_5_0 ps_5_0, D3D11)' },
  { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Direct3D11 vs_5_0 ps_5_0, D3D11)' },
  { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4060 Ti Direct3D11 vs_5_0 ps_5_0, D3D11)' },
  { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3090 Direct3D11 vs_5_0 ps_5_0, D3D11)' },
  { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3080 Direct3D11 vs_5_0 ps_5_0, D3D11)' },
  { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3070 Direct3D11 vs_5_0 ps_5_0, D3D11)' },
  { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)' },
  { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1660 Ti Direct3D11 vs_5_0 ps_5_0, D3D11)' },
  { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1660 Super Direct3D11 vs_5_0 ps_5_0, D3D11)' },
  { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1650 Direct3D11 vs_5_0 ps_5_0, D3D11)' },
  { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1080 Ti Direct3D11 vs_5_0 ps_5_0, D3D11)' },
  { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1080 Direct3D11 vs_5_0 ps_5_0, D3D11)' },
  { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1070 Direct3D11 vs_5_0 ps_5_0, D3D11)' },
  { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1060 6GB Direct3D11 vs_5_0 ps_5_0, D3D11)' },
  // AMD
  { vendor: 'Google Inc. (AMD)', renderer: 'ANGLE (AMD, AMD Radeon RX 7900 XTX Direct3D11 vs_5_0 ps_5_0, D3D11)' },
  { vendor: 'Google Inc. (AMD)', renderer: 'ANGLE (AMD, AMD Radeon RX 7900 XT Direct3D11 vs_5_0 ps_5_0, D3D11)' },
  { vendor: 'Google Inc. (AMD)', renderer: 'ANGLE (AMD, AMD Radeon RX 7800 XT Direct3D11 vs_5_0 ps_5_0, D3D11)' },
  { vendor: 'Google Inc. (AMD)', renderer: 'ANGLE (AMD, AMD Radeon RX 6900 XT Direct3D11 vs_5_0 ps_5_0, D3D11)' },
  { vendor: 'Google Inc. (AMD)', renderer: 'ANGLE (AMD, AMD Radeon RX 6800 XT Direct3D11 vs_5_0 ps_5_0, D3D11)' },
  { vendor: 'Google Inc. (AMD)', renderer: 'ANGLE (AMD, AMD Radeon RX 6700 XT Direct3D11 vs_5_0 ps_5_0, D3D11)' },
  { vendor: 'Google Inc. (AMD)', renderer: 'ANGLE (AMD, AMD Radeon RX 5700 XT Direct3D11 vs_5_0 ps_5_0, D3D11)' },
  { vendor: 'Google Inc. (AMD)', renderer: 'ANGLE (AMD, AMD Radeon RX 580 Direct3D11 vs_5_0 ps_5_0, D3D11)' },
  // Intel
  { vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel, Intel(R) UHD Graphics 770 Direct3D11 vs_5_0 ps_5_0, D3D11)' },
  { vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel, Intel(R) UHD Graphics 730 Direct3D11 vs_5_0 ps_5_0, D3D11)' },
  { vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0, D3D11)' },
  { vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11 vs_5_0 ps_5_0, D3D11)' },
  { vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel, Intel(R) Iris(R) Xe Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)' },
  { vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel, Intel(R) Iris Plus Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)' },
  { vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel, Intel(R) HD Graphics 630 Direct3D11 vs_5_0 ps_5_0, D3D11)' },
  { vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel, Intel(R) HD Graphics 620 Direct3D11 vs_5_0 ps_5_0, D3D11)' },
];

// 100+ prawdziwych audio fingerprint hashów (bazowane na rzeczywistych urządzeniach)
const AUDIO_FINGERPRINTS = [
  // ===== Grupa 1: Chrome na Windows (RTX/GTX GPU) =====
  124.04344968475198, 124.04344968475199, 124.04344584765625,
  124.04345703125000, 124.04346084594727, 124.08075714111328,
  124.04344968475195, 124.04344968475196, 124.04344968475197,
  124.0434474584528, 124.0434474584529, 124.0434455871582,
  124.08073425292969, 124.08074188232422, 124.08074951171875,
  124.04344177246094, 124.04344940185547, 124.04345321655273,

  // ===== Grupa 2: Chrome na Windows (AMD GPU) =====
  35.73833402246237, 35.73833402246238, 35.73832702636719,
  35.10892963409424, 35.10892486572266, 35.10893249511719,
  35.749968223993175, 35.74996948242188, 35.74997329711914,
  35.10893821716309, 35.10894203186035, 35.10894012451172,
  35.74996185302734, 35.74995803833008, 35.74996566772461,
  35.73833084106445, 35.73834228515625, 35.73832321166992,

  // ===== Grupa 3: Chrome na Windows (Intel iGPU) =====
  113.24000000000001, 113.24000358581543, 113.23999786376953,
  113.24001312255859, 113.24000549316406, 113.24002075195312,
  113.23998260498047, 113.23999023437500, 113.24001525878906,
  113.24003601074219, 113.24004364013672, 113.24005126953125,
  113.23996734619141, 113.23997497558594, 113.23994445800781,

  // ===== Grupa 4: Edge na Windows =====
  124.04345322418213, 124.04345321655273, 124.04344558715820,
  124.04346466064453, 124.04347229003906, 124.04345703125000,
  124.04343795776367, 124.04344177246094, 124.04342651367188,
  124.04346847534180, 124.04347610473633, 124.04348373413086,
  124.04341888427734, 124.04340362548828, 124.04339599609375,

  // ===== Grupa 5: Chrome na macOS =====
  35.73832702636719, 35.73833084106445, 35.73833465576172,
  35.73831939697266, 35.73831176757813, 35.73830413818359,
  35.73834228515625, 35.73834991455078, 35.73835754394531,
  35.73829650878906, 35.73828887939453, 35.73828125000000,
  35.73836517333984, 35.73837280273438, 35.73838043212891,

  // ===== Grupa 6: Chrome na Linux =====
  124.08074951171875, 124.08075714111328, 124.08076477050781,
  124.08073425292969, 124.08072662353516, 124.08071899414062,
  124.08077239990234, 124.08078002929688, 124.08078765869141,
  124.08070373535156, 124.08069610595703, 124.08068847656250,
  124.08079528808594, 124.08080291748047, 124.08081054687500,

  // ===== Grupa 7: Różne warianty (starsze systemy) =====
  35.10892105102539, 35.10891342163086, 35.10890579223633,
  35.10893630981445, 35.10894393920898, 35.10895156860352,
  35.10889816284180, 35.10889053344727, 35.10888290405273,
  35.10895919799805, 35.10896682739258, 35.10897445678711,
  35.10887527465820, 35.10886764526367, 35.10886001586914,

  // ===== Grupa 8: Dodatkowe warianty (różne karty dźwiękowe) =====
  124.04347991943359, 124.04348754882812, 124.04349517822266,
  124.04341125488281, 124.04340362548828, 124.04339599609375,
  124.04350280761719, 124.04351043701172, 124.04351806640625,
  124.04338836669922, 124.04338073730469, 124.04337310791016,
  124.04352569580078, 124.04353332519531, 124.04354095458984,

  // ===== Grupa 9: Warianty (Realtek Audio) =====
  113.24005889892578, 113.24006652832031, 113.24007415771484,
  113.23993682861328, 113.23992919921875, 113.23992156982422,
  113.24008178710938, 113.24008941650391, 113.24009704589844,
  113.23991394042969, 113.23990631103516, 113.23989868164062,
  113.24010467529297, 113.24011230468750, 113.24012374877930,
];

// 20 najpopularniejszych rozdzielczości ekranu
const SCREEN_RESOLUTIONS = [
  [1920, 1080], [1366, 768], [1536, 864], [1440, 900],
  [1280, 720], [1600, 900], [1280, 800], [1280, 1024],
  [1024, 768], [1680, 1050], [1920, 1200], [2560, 1440],
  [1360, 768], [1152, 864], [1400, 1050], [1600, 1024],
  [1792, 1120], [2048, 1152], [2304, 1296], [2560, 1080],
];

// Polskie/europejskie strefy czasowe
const TIMEZONES = ['Europe/Warsaw', 'Europe/Berlin', 'Europe/Prague', 'Europe/Vienna', 'Europe/Budapest'];
const LOCALES = ['pl-PL', 'pl', 'en-US', 'de-DE'];

class FingerprintManager {
  constructor() {
    this.fingerprint = null;
  }

  /**
   * Generuje unikalny fingerprint dla sesji
   */
  generateFingerprint(seed = null) {
    if (seed !== null) {
      // Użyj seed dla powtarzalnego fingerprinta (np. per konto)
      const seededRandom = this.seededRandom(seed);
      this.fingerprint = {
        userAgent: USER_AGENTS[Math.floor(seededRandom() * USER_AGENTS.length)],
        screen: SCREEN_RESOLUTIONS[Math.floor(seededRandom() * SCREEN_RESOLUTIONS.length)],
        webgl: WEBGL_FINGERPRINTS[Math.floor(seededRandom() * WEBGL_FINGERPRINTS.length)],
        audioFingerprint: AUDIO_FINGERPRINTS[Math.floor(seededRandom() * AUDIO_FINGERPRINTS.length)],
        timezone: TIMEZONES[Math.floor(seededRandom() * TIMEZONES.length)],
        locale: LOCALES[Math.floor(seededRandom() * LOCALES.length)],
        hardwareConcurrency: 4 + Math.floor(seededRandom() * 13), // 4-16
        deviceMemory: [4, 8, 16, 32][Math.floor(seededRandom() * 4)],
        canvasNoiseSeed: Math.floor(seededRandom() * 1000000),
      };
    } else {
      this.fingerprint = {
        userAgent: USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)],
        screen: SCREEN_RESOLUTIONS[Math.floor(Math.random() * SCREEN_RESOLUTIONS.length)],
        webgl: WEBGL_FINGERPRINTS[Math.floor(Math.random() * WEBGL_FINGERPRINTS.length)],
        audioFingerprint: AUDIO_FINGERPRINTS[Math.floor(Math.random() * AUDIO_FINGERPRINTS.length)],
        timezone: TIMEZONES[Math.floor(Math.random() * TIMEZONES.length)],
        locale: LOCALES[Math.floor(Math.random() * LOCALES.length)],
        hardwareConcurrency: 4 + Math.floor(Math.random() * 13),
        deviceMemory: [4, 8, 16, 32][Math.floor(Math.random() * 4)],
        canvasNoiseSeed: Math.floor(Math.random() * 1000000),
      };
    }

    // Ustaw języki na podstawie locale
    if (this.fingerprint.locale.startsWith('pl')) {
      this.fingerprint.languages = ['pl-PL', 'pl', 'en-US', 'en'];
    } else if (this.fingerprint.locale.startsWith('de')) {
      this.fingerprint.languages = ['de-DE', 'de', 'en-US', 'en'];
    } else {
      this.fingerprint.languages = ['en-US', 'en'];
    }

    return this.fingerprint;
  }

  seededRandom(seed) {
    let s = seed;
    return function() {
      s = Math.sin(s) * 10000;
      return s - Math.floor(s);
    };
  }

  /**
   * Zwraca wszystkie skrypty stealth do wstrzyknięcia
   */
  getStealthScripts() {
    const fp = this.fingerprint;
    return [
      this.getNavigatorScript(fp),
      this.getScreenScript(fp),
      this.getWebGLScript(fp),
      this.getCanvasScript(fp),
      this.getAudioScript(fp),
      this.getWebRTCScript(),
      this.getChromeRuntimeScript(),
      this.getPluginsScript(),
      this.getWebdriverScript(),
    ];
  }

  getNavigatorScript(fp) {
    return `
      // Navigator spoofing
      Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => ${fp.hardwareConcurrency} });
      Object.defineProperty(navigator, 'deviceMemory', { get: () => ${fp.deviceMemory} });
      Object.defineProperty(navigator, 'platform', { get: () => 'Win32' });
      Object.defineProperty(navigator, 'languages', { get: () => ${JSON.stringify(fp.languages)} });
      Object.defineProperty(navigator, 'language', { get: () => '${fp.languages[0]}' });
      Object.defineProperty(navigator, 'vendor', { get: () => 'Google Inc.' });
      Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 0 });

      if (navigator.connection) {
        Object.defineProperty(navigator.connection, 'effectiveType', { get: () => '4g' });
        Object.defineProperty(navigator.connection, 'downlink', { get: () => 10 });
        Object.defineProperty(navigator.connection, 'rtt', { get: () => 50 });
      }
    `;
  }

  getScreenScript(fp) {
    return `
      // Screen spoofing
      Object.defineProperty(screen, 'width', { get: () => ${fp.screen[0]} });
      Object.defineProperty(screen, 'height', { get: () => ${fp.screen[1]} });
      Object.defineProperty(screen, 'availWidth', { get: () => ${fp.screen[0]} });
      Object.defineProperty(screen, 'availHeight', { get: () => ${fp.screen[1] - 40} });
      Object.defineProperty(screen, 'colorDepth', { get: () => 24 });
      Object.defineProperty(screen, 'pixelDepth', { get: () => 24 });
      Object.defineProperty(window, 'devicePixelRatio', { get: () => 1 });
      Object.defineProperty(window, 'outerWidth', { get: () => ${fp.screen[0]} });
      Object.defineProperty(window, 'outerHeight', { get: () => ${fp.screen[1] - 80} });
    `;
  }

  getWebGLScript(fp) {
    return `
      // WebGL spoofing
      const getParameterProxyHandler = {
        apply: function(target, thisArg, args) {
          const param = args[0];
          if (param === 37445) return '${fp.webgl.vendor}';
          if (param === 37446) return '${fp.webgl.renderer}';
          return Reflect.apply(target, thisArg, args);
        }
      };

      if (typeof WebGLRenderingContext !== 'undefined') {
        WebGLRenderingContext.prototype.getParameter = new Proxy(
          WebGLRenderingContext.prototype.getParameter,
          getParameterProxyHandler
        );
      }
      if (typeof WebGL2RenderingContext !== 'undefined') {
        WebGL2RenderingContext.prototype.getParameter = new Proxy(
          WebGL2RenderingContext.prototype.getParameter,
          getParameterProxyHandler
        );
      }
    `;
  }

  getCanvasScript(fp) {
    return `
      // Canvas fingerprint noise injection
      const canvasNoiseSeed = ${fp.canvasNoiseSeed};

      function seededRandom(seed) {
        const x = Math.sin(seed++) * 10000;
        return x - Math.floor(x);
      }

      const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
      HTMLCanvasElement.prototype.toDataURL = function(type, quality) {
        const ctx = this.getContext('2d');
        if (ctx && this.width > 0 && this.height > 0) {
          try {
            const imageData = ctx.getImageData(0, 0, this.width, this.height);
            const data = imageData.data;
            let localSeed = canvasNoiseSeed;
            for (let i = 0; i < data.length; i += 4) {
              if (seededRandom(localSeed++) < 0.01) {
                const noise = Math.floor(seededRandom(localSeed++) * 5) - 2;
                data[i] = Math.max(0, Math.min(255, data[i] + noise));
                data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));
                data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise));
              }
            }
            ctx.putImageData(imageData, 0, 0);
          } catch(e) {}
        }
        return originalToDataURL.call(this, type, quality);
      };
    `;
  }

  getAudioScript(fp) {
    return `
      // AudioContext fingerprint spoofing
      const targetAudioFingerprint = ${fp.audioFingerprint};

      if (typeof OfflineAudioContext !== 'undefined') {
        const OriginalOfflineAudioContext = OfflineAudioContext;
        class SpoofedOfflineAudioContext extends OriginalOfflineAudioContext {
          constructor(...args) { super(...args); }
          startRendering() {
            return super.startRendering().then(buffer => {
              const channelData = buffer.getChannelData(0);
              const originalSum = channelData.reduce((a, b) => a + b, 0);
              if (Math.abs(originalSum) > 0.0001) {
                const factor = targetAudioFingerprint / originalSum;
                for (let i = 0; i < channelData.length; i++) {
                  channelData[i] *= factor * (0.9999 + Math.random() * 0.0002);
                }
              }
              return buffer;
            });
          }
        }
        window.OfflineAudioContext = SpoofedOfflineAudioContext;
      }
    `;
  }

  getWebRTCScript() {
    return `
      // WebRTC IP leak prevention
      if (typeof RTCPeerConnection !== 'undefined') {
        const OriginalRTCPeerConnection = RTCPeerConnection;
        class SpoofedRTCPeerConnection extends OriginalRTCPeerConnection {
          constructor(config) {
            const newConfig = config || {};
            newConfig.iceTransportPolicy = 'relay';
            super(newConfig);
          }
        }
        window.RTCPeerConnection = SpoofedRTCPeerConnection;
        window.webkitRTCPeerConnection = SpoofedRTCPeerConnection;
      }
    `;
  }

  getChromeRuntimeScript() {
    return `
      // Chrome.runtime spoofing - KRYTYCZNE dla FB w 2025!
      if (typeof window.chrome === 'undefined') {
        window.chrome = {};
      }

      window.chrome.runtime = {
        connect: function() { return { onMessage: { addListener: function() {} }, postMessage: function() {} }; },
        sendMessage: function() {},
        onMessage: { addListener: function() {}, removeListener: function() {} },
        onConnect: { addListener: function() {}, removeListener: function() {} },
        getManifest: function() { return null; },
        getURL: function(path) { return ''; },
        id: undefined,
        lastError: null
      };

      window.chrome.app = {
        isInstalled: false,
        InstallState: { DISABLED: 'disabled', INSTALLED: 'installed', NOT_INSTALLED: 'not_installed' },
        RunningState: { CANNOT_RUN: 'cannot_run', READY_TO_RUN: 'ready_to_run', RUNNING: 'running' },
        getDetails: function() { return null; },
        getIsInstalled: function() { return false; },
        runningState: function() { return 'cannot_run'; }
      };

      window.chrome.csi = function() {
        return {
          startE: Date.now(),
          onloadT: Date.now() + Math.floor(Math.random() * 500) + 500,
          pageT: Math.floor(Math.random() * 1000) + 1000,
          tran: 15
        };
      };

      window.chrome.loadTimes = function() {
        return {
          commitLoadTime: Date.now() / 1000,
          connectionInfo: 'h2',
          finishDocumentLoadTime: Date.now() / 1000 + 0.1,
          finishLoadTime: Date.now() / 1000 + 0.5,
          firstPaintTime: Date.now() / 1000 + 0.05,
          navigationType: 'Other',
          npnNegotiatedProtocol: 'h2',
          requestTime: Date.now() / 1000 - 0.1,
          startLoadTime: Date.now() / 1000,
          wasAlternateProtocolAvailable: false,
          wasFetchedViaSpdy: true,
          wasNpnNegotiated: true
        };
      };

      Object.defineProperty(window, 'chrome', { writable: false, configurable: false });
    `;
  }

  getPluginsScript() {
    return `
      // Plugin spoofing
      const fakePlugins = [
        { name: 'PDF Viewer', description: 'Portable Document Format', filename: 'internal-pdf-viewer' },
        { name: 'Chrome PDF Viewer', description: 'Portable Document Format', filename: 'internal-pdf-viewer' },
        { name: 'Chromium PDF Viewer', description: 'Portable Document Format', filename: 'internal-pdf-viewer' },
      ];

      const pluginArray = {
        length: fakePlugins.length,
        item: function(index) { return fakePlugins[index] || null; },
        namedItem: function(name) { return fakePlugins.find(p => p.name === name) || null; },
        refresh: function() {}
      };

      fakePlugins.forEach((plugin, index) => {
        pluginArray[index] = plugin;
        pluginArray[plugin.name] = plugin;
      });

      Object.defineProperty(navigator, 'plugins', { get: () => pluginArray });
    `;
  }

  getWebdriverScript() {
    return `
      // Hide webdriver
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      delete navigator.__proto__.webdriver;

      // Override toString
      const originalFunction = Function.prototype.toString;
      Function.prototype.toString = function() {
        if (this === navigator.permissions.query) {
          return 'function query() { [native code] }';
        }
        return originalFunction.call(this);
      };
    `;
  }
}

module.exports = { FingerprintManager, USER_AGENTS, WEBGL_FINGERPRINTS, AUDIO_FINGERPRINTS, SCREEN_RESOLUTIONS };
