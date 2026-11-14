# Depo Takip

Ham Depo / Cep Depo hammadde stok takibi — Windows sunucu + web arayüzü + Android uygulaması.

- `server/` — Node.js sunucu (harici paket yok, yerleşik SQLite)
- `public/` — web arayüzü (bilgisayar ve telefon)
- `android/` — Android uygulaması (WebView + QR tarayıcı)
- `windows/` — kurulum betikleri ve Inno Setup sihirbazı
- `docs/` — kurulum ve kullanım kılavuzu
- `.github/workflows/derle.yml` — her yüklemede APK ve Windows kurulum dosyasını derleyip **Releases** sayfasında yayınlar

Yerelde çalıştırmak için (Node.js 22.13+ / 24): `node server/server.js` → http://localhost:8765
