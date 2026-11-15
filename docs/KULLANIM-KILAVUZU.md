# Depo Takip 2.1 — Kurulum ve Kullanım Kılavuzu

Sürüm 2.1

## 2.1 sürümünde neler yeni?

> **Güncelleme:** Paketteki dosyaları kurulum klasörünün (`C:\DepoTakip`) üzerine kopyalayın, `Kur.bat`'a çift tıklayın. Veritabanı (`depo2.db`) olduğu gibi kalır; tüm kayıtlarınız, kullanıcılarınız ve tanımlarınız korunur. İlk açılışta otomatik yedek alınır.

**1. Beş rol ve kullanıcı bazında yetki.** Roller: **Ana yönetici** (her şey), **Depo sorumlusu** (giriş, çıkış, transfer, iade, ıskarta, sayım), **Üretim sorumlusu** (üretim, fire tartımı), **Sevkiyat sorumlusu** (sevkiyat, mamul sayımı, palet), **Rapor kullanıcısı** (yalnızca yetkili olduğu raporlar). Eski "Depocu" hesapları Depo sorumlusu, "İzleyici" hesapları Rapor kullanıcısı olur.
Ayarlar → Kullanıcılar ve yetkiler'de bir kullanıcıyı açıp **Yetkileri özelleştir**'i işaretlerseniz her kayıt türü için **Görür / Ekler / Düzenler / Siler** yetkisini ayrı ayrı, raporları tek tek, değişiklik geçmişini (göremez / kendi / herkes), paneli ve Excel'den yüklemeyi ayrıca verebilirsiniz. Kullanıcının göremediği ekranlar menüde hiç görünmez; sunucu da her işlemde yetkiyi ayrıca kontrol eder. Kullanıcı silinebilir; işlem yapmış bir kullanıcı silinirse işlem geçmişi korunur (hesap kapatılır, adı "(silindi)" görünür).

**2. Mamul kodları ve ürün QR etiketleri.** Her ürüne kalıcı bir mamul kodu verildi (MML-001, MML-002 …). Tanımlar → QR etiketleri'nde **Mamul** sekmesinden ürün etiketleri basılır. Ürün QR'ı okutulunca **ürün kartı** açılır: güncel mamul stoğu, bu ayın üretim ve sevkiyatı, son hareketler; karttan doğrudan Üretim (mamul girişi), Sevkiyat çıkışı ve Sayım açılır. Ürünlere **asgari mamul stoğu** girilebilir; altına inince panelde uyarı çıkar.

**3. El tipi barkod okuyucu.** USB veya Bluetooth barkod okuyucular (klavye gibi çalışan) her ekranda kullanılabilir: bir yazı alanında değilken okuttuğunuz kod hammadde veya ürün kartını açar. Hammadde seçim alanlarında ve sevkiyat formunda da doğrudan çalışır.

**4. Sevkiyat: müşteri, adres ve QR doğrulama.** Sevkiyat kaydına **müşteri, sevk adresi, irsaliye no, araç plakası** eklendi; aynı gün birden çok sevkiyat girilebilir. Formdaki okutma alanına gönderilen ürünlerin etiketini okutun: satır ✓ ile işaretlenir, alt satırda kaç kalemin doğrulandığı görünür ("Her okutmada +1 koli" seçeneğiyle koli koli sayarak da girebilirsiniz). Sevk miktarı mamul stoğunu aşarsa satırda ⚠ uyarısı çıkar. Sevkiyatı yapan kullanıcı ve kayıt saati otomatik tutulur.

**5. Her listede "Giren" sütunu.** Tüm kayıt listelerinde kaydı giren kullanıcı ve kayıt tarihi-saati görünür.

**6. Yeni panel.** Birim bazında toplam hammadde (ana + cep), üretimde kullanılan hammadde, toplam mamul stoğu, toplam üretim ve sevkiyat, **günlük üretim / sevkiyat grafiği**, hammadde ve mamul **kritik stok uyarıları**, **depolar arası dağılım** (grup bazında ana / cep oranı) ve son işlemler.

**7. Geçmiş gün stok durumu.** Raporlar → Geçmiş gün stok: bir tarih seçin, o günün sonundaki ana depo, cep depo ve mamul stokları kayıtlardan yeniden hesaplanır. Excel'e de indirilebilir.

**8. Yeni raporlar.** **Hammadde hareketleri** (tarih aralığında her hareket; lot, belge, firma, giren kullanıcı ve saatiyle), **Kullanıcı işlemleri** (kim, ne zaman, hangi kaydı ekledi / değiştirdi / sildi; değişen alanların eski ve yeni değeri), **Excel rapor merkezi**: tarih aralığı seçip Ana depo, Cep depo, Hammadde hareket, Hammadde stok, Üretim, Reçete kullanımı, Mamul stok, Sevkiyat, Kullanıcı işlem ve **Genel yönetici raporu**nu (hepsi tek dosyada) indirin.

**9. Excel'den kayıt yükleme.** Ayarlar → Excel içe aktarma → **Excel'den kayıt yükle**: geçmiş hammadde girişleri, transferler (ana ↔ cep), iade ve ıskarta çıkışları, hammadde açılış stokları / sayımlar, üretim kayıtları, sevkiyatlar, mamul açılış stokları, fire tartımları, hammadde ve mamul listeleri.
1. Türü seçip **Şablonu indir**'e basın. Şablonun "Açıklama" sayfasında her sütunun nasıl doldurulacağı yazar (hammadde KYN koduyla veya adıyla, ürün adıyla veya MML koduyla yazılabilir).
2. Doldurduğunuz dosyayı bırakın. **Önizleme** gösterilir: geçerli, hatalı ve mükerrer satırlar ayrı ayrı süzülebilir.
3. Kontroller: zorunlu alanlar, tarih (geçerli ve ileri tarih değil), miktar (sayı, sıfırdan büyük), bilinmeyen hammadde / ürün, **mükerrer kayıt** (sistemde veya dosyada aynısı varsa atlanır).
4. **Hata raporunu indir** ile hatalı satırları açıklamalarıyla Excel olarak alın, düzeltip yeniden yükleyin; ya da "hatalı satırları atla" diyerek geçerlileri yükleyin.
5. Yükleme öncesi otomatik yedek alınır; yükleme tek işlem olarak kaydedilir ve Değişiklik geçmişinden tek seferde geri alınır.
Sevkiyat şablonunda her satır bir üründür; aynı tarih + müşteri + irsaliye no satırları tek sevkiyat kaydında birleşir.

## 1. Ne değişti? (1.x → 2.0)

Depo Takip 2.0, "Ekim 2026 Depo Stok Hammadde Raporu" Excel dosyanızdaki düzen esas alınarak baştan yazıldı.

- **Excel ile aynı hesap.** Hammadde stoğu, reçeteye göre tüketim, fire, cep depo, ıskarta, ürün stoğu ve sevkiyat; Excel'deki formüllerin aynısıyla hesaplanır.
- **Kayıt türleri Excel sayfalarıyla aynı:** Üretim Raporu, Satınalma, Cep Depoya Verilen, Sevkiyat, Tedarikçiye İade, Iskarta, Hammadde Sayımı, Ürün Sayımı, Fire Tartımı, Palet Takibi.
- **Her şeyi siz değiştirebilirsiniz:** hammaddeler, gruplar, ürünler, reçeteler, hatlar, kapasiteler, koli ve palet tipleri, preform firmaları, vardiyalar, personel ve formlardaki alanlar.
- **Geri al / Yinele.** Yapılan her ekleme, değişiklik ve silme kaydedilir ve tek tıkla geri alınabilir. Geri almanın kendisi de geri alınabilir.
- **Ay seçimi.** Üst çubuktaki ay seçiciyle tüm kayıtlar ve raporlar seçtiğiniz aya göre gösterilir.
- **Excel'den içe aktarma.** Aylık Excel raporunuzu yükleyerek o ayın tüm kayıtlarını tek seferde aktarabilirsiniz.

## 2. Sistem nasıl çalışır?

- **Depo bilgisayarı (sunucu):** Tüm veriler bu Windows bilgisayarda tek bir veritabanında durur. Sunucu Windows açılınca kendiliğinden başlar.
- **Bilgisayardan kullanım:** Masaüstündeki **Depo Takip** kısayolu veya aynı ağdaki başka bir bilgisayarda tarayıcıdan `http://<depo-bilgisayarı-adresi>:8765`.
- **Android telefon:** Aynı modeme bağlı telefon, sunucuya bağlanır. QR kodlar kamerayla okutulur.

Bir ekranda yapılan kayıt birkaç saniye içinde tüm ekranlara yansır (üst çubukta yeşil **Canlı** işareti).

### Stok nasıl hesaplanır?

Stok elle yazılan bir sayı değildir; kayıtlardan her seferinde yeniden hesaplanır:

> **Kalan = Devreden − (Kullanılan + Fire) + Satın alınan − İade ± Sayım farkı − İmha**
>
> **Kullanılabilen = Kalan − Iskartaya ayrılan**

- **Kullanılan ve fire**, her üretim kaydı ürünün reçetesiyle çarpılarak bulunur (bkz. Bölüm 6).
- **Cep depoya verilen**, ana depodan cep depoya geçen miktardır; toplam stoğu değiştirmez, yalnızca ana/cep ayrımını değiştirir. Üretimdeki tüketim cep depodan düşülür.
- **Sayım**, o depodaki miktarı sayılan değere eşitler; fark otomatik hesaplanır.
- **Iskarta**: "Ayrıldı" iken kullanılabilir stoktan düşer, "İmha edildi" olunca stoktan tamamen düşer, "Kapandı" olunca etkisi kalkar.
- **Asgari stok uyarısı:** Kullanılabilen miktar asgari stoğun altına inince "Sipariş ver", sıfıra inince "Tükendi" uyarısı verilir.

## 3. Kurulum ve güncelleme (Windows)

### 1.x sürümünden 2.0'a güncelleme

1. Güncelleme paketindeki `DepoTakip` klasörünün içindekileri, mevcut kurulum klasörünün (örneğin `C:\DepoTakip`) **üzerine** kopyalayın ve "Dosyaları değiştir" deyin.
2. `Kur.bat` dosyasına çift tıklayıp yönetici iznini onaylayın.
3. Depo Takip'i açın. **Eski kullanıcı adınız ve şifrenizle** giriş yapın.

İlk açılışta otomatik olarak şunlar olur:

- 2.0 yeni bir veritabanı dosyası kullanır (`depo2.db`). Eski veritabanı (`depo.db`) **silinmez, değiştirilmez**; aynı klasörde durur.
- Kullanıcılar ve firma adı eski sürümden aktarılır.
- 22 grup, 121 hammadde (KYN kodlarıyla), 14 ürün, 428 satırlık reçeteler, hatlar, kapasiteler, koli/palet tipleri, preform firmaları, vardiyalar ve personel Ekim 2026 Excel dosyanızdan hazır yüklenir.

Ardından yapılacaklar:

1. **Ekim kayıtlarını aktarın:** Ayarlar → Excel içe aktarma → Ekim Excel dosyanızı yükleyin (bkz. Bölüm 8).
2. (İsteğe bağlı) **Eski stokları aktarın:** Ayarlar → Excel içe aktarma → "Eski sürümden (1.x) aktar". Eski KYN kodları yeni hammaddelerle eşleştirilir; eski QR etiketleri okutulduğunda doğru hammadde açılır. Ekim Excel'ini aktardıysanız stokları ayrıca aktarmanıza gerek yoktur (devreden stoklar Excel'den gelir); yalnızca kod eşleştirmesi için kutuyu işaretlemeden çalıştırabilirsiniz.

### Yeni kurulum

1. https://nodejs.org adresinden **LTS** sürümünü (24.x) indirip kurun.
2. Paketteki `DepoTakip` klasörünü `C:\DepoTakip` konumuna kopyalayın.
3. `Kur.bat` dosyasına çift tıklayın, yönetici iznini onaylayın.
4. Açılan **İlk kurulum** ekranında firma adını ve yönetici hesabını oluşturun.

`Kur.bat` şunları yapar: sunucuyu Windows açılışında başlayacak şekilde ayarlar (kapanırsa 1 dakika içinde yeniden başlar), güvenlik duvarında 8765 portunu açar, masaüstüne kısayol ekler.

### Bilgisayar için önemli ayarlar

- **Uyku modunu kapatın** (Güç Seçenekleri → Bilgisayarı uyku moduna geçir: Hiçbir zaman).
- **Sabit IP verin.** Modem arayüzünde bu bilgisayara DHCP rezervasyonu tanımlayın; böylece telefonlardaki adres değişmez.

## 4. Telefonu bağlama

1. Telefon, bilgisayarın bağlı olduğu **modemin Wi-Fi'ına** bağlı olsun. Bilgisayarın kabloyla bağlı olması sorun değildir; aynı modem yeterlidir.
2. Bilgisayarda **Ayarlar → Telefon bağlantısı** ekranını açın.
3. Telefonda Depo Takip uygulamasında **Sunucuyu QR ile bul**'a dokunup ekrandaki kodu okutun (veya adresi elle yazın).
4. Kendi kullanıcı adınızla giriş yapın.

Android uygulaması (APK) henüz kurulu değilse telefonun tarayıcısında (Chrome) `http://<adres>:8765` adresini açıp menüden **Ana ekrana ekle** diyerek de kullanabilirsiniz. Bu durumda QR okutma yerine KYN kodunu yazarak arama yapılır.

Telefon bağlanamıyorsa: modemde "misafir ağı" veya "AP / istemci yalıtımı" kapalı olmalı; Windows'ta ağ profili **Özel ağ** olmalı; güvenlik duvarında 8765 izni olmalı (`Kur.bat` ekler). Telefondan tarayıcıyla `http://<adres>:8765` açılıyorsa bağlantı doğrudur.

## 5. Ekranlar

| Bölüm | İçerik |
|---|---|
| **Panel** | Ayın özeti: üretilen ve sevk edilen koli, fire oranı, stok uyarıları, ürün bazında üretim, son değişiklikler, hızlı kayıt düğmeleri |
| **QR okut** | Etiketteki QR'ı okutun veya KYN kodunu yazın → hammadde kartı açılır |
| **Kayıtlar** | Excel sayfalarına karşılık gelen kayıt listeleri (seçili aya göre) |
| **Raporlar** | Hammadde Stok, Aylık Takip (TRK), Ürün Stok, Üretim Özeti, Reçete Kullanımı, Sevkiyat |
| **Tanımlar** | Hammaddeler, Reçeteler, Ürünler, Gruplar, hat/palet/koli/vardiya/personel, Form alanları, QR etiketleri |
| **Değişiklik geçmişi** | Tüm işlemler; Geri al / Yinele |
| **Ayarlar** | Firma ve tır ayarları, telefon bağlantısı, kullanıcılar, Excel içe aktarma, yedekleme |

Telefonda alt çubuk: Panel · Kayıt · QR · Stok · Menü.

### Ay seçici

Üst çubuktaki **‹ Ekim 2026 ›** ile ay değiştirilir. Kayıt listeleri ve raporlar seçili ayı gösterir. Yeni kayıtta tarih, seçili ay bu aysa bugünün tarihi olarak gelir.

## 6. Günlük kullanım

### Kayıt ekleme

Kayıt listesinde **Yeni kayıt**'a basın, formu doldurun, **Kaydet**'e basın. Art arda kayıt girerken **Kaydet ve yeni** tarih, vardiya, hat, ürün gibi alanları koruyarak yeni form açar. Bir kaydı düzeltmek için listede satıra tıklayın. **Kopyala** aynı bilgilerle yeni kayıt açar.

Hammadde alanlarına yazmaya başlayınca liste süzülür (ad veya KYN koduyla). Yanındaki QR düğmesiyle etiket okutarak da seçebilirsiniz.

### Üretim Raporu

Excel'deki Üretim Raporu sayfasının karşılığıdır. Formun üstündeki yeşil şerit **toplam koli, verim, toplam fire ve sayaç farkını** siz yazarken hesaplar.

- **Ürün** seçilince Preform / Kapak / Etiket seçenekleri o ürünün reçetesindekilerle sınırlanır.
- **Toplam koli = Standart palet × koli/palet + İhracat paleti × koli/palet + Euro palet × koli/palet + Paletsiz koli.** Koli/palet değerleri Tanımlar → Palet tipleri'nden gelir.
- **Verim = Net üretim ÷ (hat kapasitesi × süre ÷ 60).** Kapasite Tanımlar → Hat kapasiteleri'nden gelir.
- Kaydedilen her üretim, reçeteye göre hammadde tüketimi ve fire olarak cep depodan düşülür.

### Reçete nasıl uygulanır?

Her reçete satırı için:

- **Kullanılan = Hesap tabanı × Miktar.** Taban; üretilen toplam koli, paletsiz koli veya seçilen palet türlerinin sayısıdır.
- **"Ne zaman kullanılır?"** Her üretimde, ya da üretim kaydında bu preform / kapak / etiket seçildiyse, ya da üretim belirli bir hatta yapıldıysa.
- **Fire = seçilen fire alanlarının toplamı × fire çarpanı.** Örneğin shrink firesi gram girildiği için çarpan 0,001'dir (kg'a çevirir).
- **Hesaba katılır** kutusu kapalı satırlar hesaplanmaz (silmeden devre dışı bırakmak için).

### Satınalma, Cep Depo, İade, Iskarta, Sayım

- **Satınalma:** irsaliye tarihi ve no, firma, lot no, hammaddenin üretim ve son kullanma tarihi, fiyat ve döviz girilebilir.
- **Cep Depoya Verilen:** ana depodan cep depoya verilen miktar. "Yön" ile cep depodan ana depoya geri dönüş de girilebilir.
- **Tedarikçiye İade:** ana depodan düşer.
- **Iskarta:** kullanılamaz malzeme. Durumu sonradan "İmha edildi" veya "Kapandı" yapılabilir.
- **Hammadde Sayımı:** depo (ana/cep) ve sayılan miktar. Listede "Fark" sütunu, sayım anındaki sistem stoğuyla farkı gösterir.

### Sevkiyat

Her gün için tek kayıt: tüm ürünler tek tabloda, yurtiçi ve ihracat koli sayıları yan yana. Palet, kg ve tır sayısı otomatik hesaplanır (ürünlerin koli/palet ve kg değerlerinden; tır kapasiteleri Ayarlar → Genel'de).

### Ürün Sayımı

Ürün stoğunun (koli) açılışı ve ay sonu sayımları için. Ürün Stok raporundaki K (mevcut) değeri buradan gelir.

## 7. Geri al ve değişiklik geçmişi

- Her kayıttan sonra altta çıkan bildirimdeki **Geri al** düğmesi, o işlemi geri alır.
- Üst çubuktaki **↶** düğmesi (veya bilgisayarda **Ctrl+Z**) **kendi son işleminizi** geri alır.
- **Değişiklik geçmişi** ekranında tüm işlemler görünür: kim, ne zaman, hangi alanı neyden neye değiştirdi. Her satırda **Geri al** düğmesi vardır.
- Geri alınan bir işlem **Yinele** ile geri getirilir.
- Excel içe aktarma gibi toplu işlemler tek seferde geri alınır.
- Kayıt, geri almak istediğiniz işlemden sonra başka biri tarafından değiştirildiyse uyarı verilir; önce sonraki değişikliği geri alın (yönetici isterse yine de geri alabilir).
- **Depocu** yalnızca kendi kayıt işlemlerini geri alabilir; tanım değişikliklerini ve başkalarının işlemlerini yönetici geri alır.

Silinen kayıt gerçekten yok olmaz; Değişiklik geçmişinden geri getirilebilir.

## 8. Excel ile çalışma

### Aylık Excel raporunu içe aktarma

**Ayarlar → Excel içe aktarma** ekranına aylık "Depo Stok Hammadde Raporu" dosyanızı bırakın.

1. Önce **özet** gösterilir: kaç üretim, satınalma, cep, iade, ıskarta ve sevkiyat kaydı bulunduğu, dikkat edilmesi gerekenler ve Excel reçetesinde bulunan hatalar.
2. Seçenekler:
   - **Bu ayın mevcut kayıtlarını silip dosyadakilerle değiştir:** aynı ayı ikinci kez yüklerken çift kayıt oluşmasını önler.
   - **Devreden stokları önceki ayın son gününe sayım olarak işle:** Excel'deki "Devreden" sütunu ay başı stoğu olur.
   - **Tanımları da güncelle:** reçeteleri, asgari stokları, palet/koli tiplerini Excel'dekiyle değiştirir. Uygulamada tanım değişikliği yaptıysanız işaretlemeyin.
3. **İçe aktar**'a basın. Aktarmadan önce otomatik yedek alınır; aktarma tek tıkla geri alınabilir.

### Ekim 2026 dosyanız için notlar

Ekim dosyanız incelendi ve uygulama sonuçları Excel ile karşılaştırıldı: 121 hammaddenin 118'inde tüm sütunlar birebir aynı. Farklar ve sebepleri:

- **Excel reçetesindeki etiket hataları düzeltildi.** 0,5 L Fontera, 0,5 L UNO, 1,5 L Fontera, 19 L Damacana Karapınar ve Eskipazar etiket satırları Excel'de "Kapak Tipi" sütununa bağlıydı; bu yüzden Excel bu etiketlerin tüketimini hiç hesaplamıyordu. Uygulamada etiket seçimine bağlandı. Bu nedenle **1,5 L Fontera Etiket** (+45.360 adet) ve **19 L Damacana Karapınar Etiket** (+29.950 adet) tüketimi Excel'den fazla görünür; uygulamadaki değer doğrudur.
- **Laboratuvar Hijyen Sıvısı** reçetede kullanılıyor ama hammadde listesinde yoktu; Temizlik Kimyasalı grubuna eklendi.
- **UF Dezenfektan ve Aromalı Sistem Temizlik HCl** satırları Excel'de kapak sütununa bağlı olduğu için hiç hesaplanmıyordu. Sonuç aynı kalsın diye "hesaba katılmaz" olarak alındı. Bu kimyasalların tüketimini izlemek isterseniz Reçeteler ekranında ilgili satırı açıp "Ne zaman" = Her üretimde ve "Hesaba katılır" seçin.
- **Eylül tarihli kayıtlar:** Cep sayfasında 23, İade sayfasında 1 kayıt Eylül tarihliydi (yazım hatası). Excel bunları Ekim'e kattığı için 1 Ekim'e alındı; asıl tarih açıklama alanına yazıldı.
- **Kaymış satırlar:** Üretim Raporu'nda 7 satırda preform / kapak / etiket sütunları kaymış görünüyor (örneğin preform sütununda "Dmcn" yazıyor). Bu satırlarda açıklamada "Excel preform: …" notu var; ilgili üretim kaydını açıp malzemeleri seçerek düzeltebilirsiniz.

### Excel çıktıları

- Her kayıt listesi ve raporda **Excel** düğmesi vardır. Rapor dosyalarında toplamlar ve hesaplı sütunlar **formüllüdür** (Excel'de değer değiştirirseniz sonuç güncellenir); asgari altı satırlar kırmızı işaretlenir.
- **Panel → Aylık Excel raporu:** Hammadde, Aylık Takip, Ürün Stok, Üretim Özeti, Reçete Kullanımı, Sevkiyat ve ayın tüm kayıt listeleri tek dosyada.

### Sayım şablonu

1. **Hammadde Stok** raporunda veya Ayarlar → Excel içe aktarma'da **Sayım şablonu**'nu indirin.
2. "Ana Depo Sayım" ve "Cep Depo Sayım" sütunlarına saydığınızı yazın (boş hücreler değiştirilmez). "Asgari Stok" sütununu değiştirirseniz asgari stok da güncellenir.
3. Sayım tarihini seçip dosyayı yükleyin. Önizlemede farkları kontrol edip **Uygula**'ya basın.

## 9. Raporlar

| Rapor | Açıklama |
|---|---|
| **Hammadde Stok** | Excel "Hammadde" sayfası: devreden, kullanılan, fire, satın alınan, iade, sayım farkı, kalan, ıskarta, kullanılabilen, ana/cep depo, yaklaşık koli, asgari ve durum. Satıra tıklayınca hammadde kartı açılır. |
| **Aylık Takip (TRK)** | TRK şablonunuzun A–J sütunları: A devreden ana depo, B alım, C = A+B, D cep depoya verilen, E kalan ana depo, F asgari, G üretilen, H fire, I = G+H, J = (D = I) karşılaştırması. |
| **Ürün Stok** | TRK şablonunun K–O sütunları: K mevcut (devir), G üretilen, L = K+G, M sevk, N kalan, fark. |
| **Üretim Özeti** | Ürün, hat, vardiya ve gün bazında giren, net, koli, palet, fireler ve verim. |
| **Reçete Kullanımı** | Her ürün için reçete satırı bazında kullanılan, fire ve fire oranı. |
| **Sevkiyat** | Ürün ve gün bazında koli, palet, kg ve tır. |

**Hammadde kartı:** güncel ana/cep/kalan/kullanılabilen stok, ay özeti, hammaddenin geçtiği reçeteler ve yürüyen bakiyeli hareket listesi. Karttan doğrudan satınalma, cep, sayım, iade ve ıskarta kaydı açılabilir; QR etiketi yazdırılabilir.

> **Not:** Excel dosyanızda bazı kalemler (örneğin preformlar) için "Cep Depoya Verilen" kaydı tutulmuyor. Bu kalemlerde cep depo eksi görünür ve Aylık Takip'te J = YANLIŞ çıkar. Toplam stok (Kalan) yine doğrudur. Ana/cep ayrımının doğru görünmesi için üretime verilen miktarları Cep Depoya Verilen olarak girin.

## 10. Kendi düzeninizi kurun (tanımlar)

Tanımları yalnızca **yönetici** değiştirebilir. Her değişiklik Değişiklik geçmişinde görünür ve geri alınabilir.

- **Hammaddeler:** yeni hammadde eklerken grup seçin; KYN kodu otomatik verilir (KYN-PRF-010 gibi) ve değişmez. Asgari stok, öncelikli ürün (yaklaşık koli hesabı için), tedarikçi, gramaj girilebilir. Kullanılmayan hammaddeyi silmek yerine **Aktif** kutusunu kapatabilirsiniz.
- **Gruplar:** grup adı, kodu (KYN kodlarında kullanılır) ve varsayılan birim.
- **Ürünler:** kg/koli, sevkiyatta koli/palet, kg/palet, ihracat koli/palet.
- **Reçeteler:** ürünü seçin; satır ekleyin, düzenleyin, sırasını değiştirin veya **Başka üründen kopyala** ile başka bir ürünün reçetesini kopyalayın.
- **Hat, palet, koli…:** hatlar, hat kapasiteleri (adet/saat), koli tipleri, palet tipleri (koli/palet), preform firmaları, vardiyalar, personel.

### Form alanları

**Tanımlar → Form alanları** ekranında kayıt türünü seçin:

- **Yeni alan** ekleyin: metin, sayı, tarih, seçim listesi, evet/hayır veya uzun metin. Örneğin Satınalma'ya "Araç plakası". Yeni alan formda ve Excel listelerinde görünür.
- Hazır alanların **adını değiştirin**, **gizleyin**, **zorunlu** yapın veya **listede gösterin**.
- **Formu önizle** ile sonucu hemen görün.
- Eklediğiniz bir alanı silmek, eski kayıtlardaki değerleri silmez.

## 11. Kullanıcılar ve yetkiler

| Yetki | Yapabilecekleri |
|---|---|
| **Ana yönetici** | Her şey: kayıtlar, tanımlar, form alanları, kullanıcılar ve yetkiler, Excel içe aktarma, yedekleme, tüm işlemleri geri alma |
| **Depo sorumlusu** | Satınalma, cep depo transferi, iade, ıskarta, hammadde sayımı (ekler / düzenler / siler); üretim ve sevkiyatı görür; depo raporları |
| **Üretim sorumlusu** | Üretim raporu ve fire tartımı (ekler / düzenler / siler); mamul ve hammadde sayımı ekler; üretim raporları |
| **Sevkiyat sorumlusu** | Sevkiyat, mamul sayımı, palet takibi; mamul stok ve sevkiyat raporları |
| **Rapor kullanıcısı** | Yalnızca görüntüler ve yetkili olduğu raporları Excel'e indirir |

Bunlar rollerin varsayılanıdır; her kullanıcı için **Yetkileri özelleştir** ile değiştirilebilir (bkz. 2.1 yenilikleri, madde 1). Kendi kayıt işlemini geri alma, o kayıt türünde düzenleme veya silme yetkisi gerektirir.

Kullanıcılar **Ayarlar → Kullanıcılar** ekranından eklenir; şifre de buradan sıfırlanır.

## 12. QR etiketleri

**Tanımlar → QR etiketleri** ekranında hammaddeleri seçin, boyutu belirleyin, **Yazdır**'a basın. Tek bir hammaddenin etiketi hammadde kartındaki **Etiket** düğmesiyle de basılabilir.

| Boyut | Kullanım |
|---|---|
| A4 · 24 etiket (70×37 mm) | Standart A4 etiket kağıdı (3 × 8) |
| A4 · 14 etiket (99×38 mm) | 2 × 7 |
| A4 · 8 büyük etiket (99×67 mm) | Palet ve kasa |
| 100×50 mm / 60×40 mm | Termal etiket yazıcısı |

Yazdırırken **Ölçek: %100** ve **Kenar boşlukları: Yok** seçin.

## 13. Yedekleme ve geri yükleme

- Veritabanı her 12 saatte bir ve her Excel içe aktarmadan önce otomatik yedeklenir. Yedekler `C:\ProgramData\DepoTakip\yedekler` klasöründedir (son 60 otomatik yedek saklanır).
- **Ayarlar → Yedekleme** ekranından istediğiniz an yedek alabilir veya indirebilirsiniz. Haftada bir yedek klasörünü USB belleğe kopyalamanızı öneririz.
- Tek tek işlemleri geri almak için yedeğe gerek yoktur; **Değişiklik geçmişi**ni kullanın.

### Tüm veritabanını bir yedeğe döndürme

1. **Görev Zamanlayıcı**'da **DepoTakip Sunucu** görevini sağ tıklayıp **Sonlandır**'ı seçin.
2. `C:\ProgramData\DepoTakip` klasöründeki `depo2.db`, `depo2.db-wal`, `depo2.db-shm` dosyalarını güvenli bir yere taşıyın.
3. Yedek dosyasını bu klasöre kopyalayıp adını `depo2.db` yapın.
4. Görevi **Çalıştır** ile başlatın veya bilgisayarı yeniden başlatın.

## 14. Sorun giderme

| Sorun | Çözüm |
|---|---|
| Telefon "Sunucuya bağlanılamadı" diyor | Bilgisayar açık ve uyanık mı? Telefon aynı modemin Wi-Fi'ında mı? Ayarlar → Telefon bağlantısı'ndaki adresle telefondaki adres aynı mı? Bkz. Bölüm 4. |
| Adres değişti | Bilgisayara sabit IP verin. Telefonda **Sunucu adresini değiştir** ile yeni QR'ı okutun. |
| Masaüstü kısayolu açılmıyor | Tarayıcıda `http://localhost:8765` açın. Kayıt dosyası: `C:\ProgramData\DepoTakip\sunucu.log` |
| Güncellemeden sonra eski ekran görünüyor | Sayfayı Ctrl+F5 ile yenileyin. |
| Bir hammaddenin cep depo stoğu eksi | Üretimde kullanılan miktar için Cep Depoya Verilen kaydı eksik. Bkz. Bölüm 9 notu. |
| Ürün stoğu eksi | Ay başı ürün stoğu girilmemiş. Önceki ayın son gününe Ürün Sayımı girin. |
| Yanlışlıkla sildim / değiştirdim | Değişiklik geçmişi → ilgili satır → **Geri al**. |
| Şifremi unuttum | Yönetici, Ayarlar → Kullanıcılar ekranından yeni şifre belirler. |

## 15. Teknik ayrıntılar

- **Sunucu:** Node.js 22.13+ / 24 ve yerleşik SQLite; harici paket yok. Port 8765 (`DEPO_PORT` ile değiştirilebilir).
- **Veri klasörü:** `C:\ProgramData\DepoTakip` — `depo2.db` (2.0), `depo.db` (eski 1.x, dokunulmaz), `sunucu.log`, `yedekler\`.
- **Veri yapısı:** her kayıt bir belge olarak saklanır; her değişiklik önceki ve sonraki haliyle ayrı bir tabloya yazılır (geri al / yinele bu kayıtlardan yapılır). Stoklar saklanmaz, kayıtlardan hesaplanır.
- **Canlı senkron:** Server-Sent Events.
- **Güvenlik:** şifreler scrypt ile saklanır; oturum 30 gün kullanılmazsa düşer; sistem yalnızca yerel ağda çalışır.
- **Android:** WebView tabanlı uygulama; arayüzü sunucudan yükler, bu yüzden arayüz güncellemeleri için APK'yı yeniden kurmak gerekmez.
