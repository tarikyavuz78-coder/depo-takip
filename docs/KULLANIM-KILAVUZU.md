# Depo Takip — Kurulum ve Kullanım Kılavuzu

Sürüm 1.0

## 1. Sistem nasıl çalışır?

Depo Takip üç parçadan oluşur:

- **Depo bilgisayarı (sunucu).** Tüm veriler bu Windows bilgisayardaki tek bir veritabanında tutulur. Sunucu, Windows açıldığında kendiliğinden başlar; kimsenin oturum açmasına gerek yoktur.
- **Bilgisayardaki uygulama.** Masaüstündeki **Depo Takip** kısayolu uygulamayı ayrı bir pencerede açar. Aynı ağdaki başka bilgisayarlar da tarayıcıdan `http://<depo-bilgisayarı-adresi>:8765` adresiyle girebilir.
- **Android uygulaması.** Telefon, fabrika Wi-Fi'ı üzerinden aynı sunucuya bağlanır. QR kodlar telefonun kamerasıyla okutulur.

Bütün ekranlar aynı veritabanını kullanır. Bir telefonda kaydedilen hareket, birkaç saniye içinde diğer tüm ekranlara yansır.

### Stok nasıl hesaplanır?

Stok miktarı elle değiştirilen bir sayı değildir. Her işlem (giriş, transfer, üretime çıkış, fire, iade, sayım) ayrı bir **hareket kaydı** olarak saklanır. Kalan stok bu kayıtlardan otomatik hesaplanır:

> Kalan stok = Girişler + İadeler − Üretime verilenler − Fireler ± Sayım düzeltmeleri

Transfer, Ham Depo ile Cep Depo arasında yer değiştirir; toplam stoğu değiştirmez.

Hareketler **silinemez**. Hatalı bir kayıt, yönetici tarafından **iptal** edilir. İptal, ters yönde yeni bir kayıt oluşturur; iki kayıt da geçmişte görünür. Böylece her değişikliğin kim tarafından, ne zaman ve neden yapıldığı izlenebilir.

### Depolar

| Depo | Kullanım |
|---|---|
| **Ham Depo** | Tedarikçiden gelen malzemenin girdiği ana depo |
| **Cep Depo** | Üretim hattının yanındaki ara depo; üretime çıkışlar varsayılan olarak buradan düşülür |

### KYN kodları ve QR

Her hammaddenin kalıcı bir kodu vardır: `KYN-<KATEGORİ>-<SIRA>`. Örneğin `KYN-PRF-003` = 0,5 L Preform. QR kodun içinde yalnızca bu kod bulunur. Ürünün adı değişse bile etiketi yeniden basmanız gerekmez. Silinen bir kodun numarası başka bir ürüne verilmez.

| Kod | Kategori | Kod | Kategori |
|---|---|---|---|
| PRF | Preform | TUT | Tutkal |
| KPK | Kapak | BNT | Bant |
| KLP | Kulp / Handle | CAM | Cam Şişe |
| ETK | Etiket | GDA | Gıda Hammaddesi ve Katkı |
| BRD | Bardak Su Ambalajı | KOD | Kodlama Sarfı |
| FLM | Shrink / Stretch Film | KAY | Bant Kaydırıcı |
| KOL | Koli | TMZ | Temizlik ve Dezenfeksiyon |
| PLT | Palet ve Ara Malzeme | | |

Sistem 120 hammaddeyle hazır gelir. Yeni kalem ve yeni kategori eklenebilir.

### Kullanıcı yetkileri

| Yetki | Yapabilecekleri |
|---|---|
| **Yönetici** | Her şey: hammadde kartları, asgari seviyeler, sayım düzeltme, hareket iptali, kullanıcılar, Excel'den içe aktarma, yedekleme |
| **Depocu** | Giriş, transfer, üretime çıkış, fire ve iade kaydı; stokları ve raporları görme |
| **İzleyici** | Yalnızca görüntüleme ve rapor alma |

## 2. Windows kurulumu (depo bilgisayarı)

### Kurulum sihirbazıyla (önerilen)

1. `DepoTakip-Kurulum-x.y.z.exe` dosyasını depo bilgisayarına kopyalayıp çalıştırın.
2. Windows **"Bu uygulamanın değişiklik yapmasına izin verilsin mi?"** diye sorarsa **Evet** deyin.
3. Kurulum bittiğinde Depo Takip açılır ve **İlk Kurulum** ekranı gelir.
4. Firma adını, kendi adınızı, kullanıcı adınızı ve şifrenizi girin. Bu hesap **Yönetici** hesabıdır.

Kurulum sihirbazı şunları otomatik yapar:

- Programı `C:\Program Files\DepoTakip` klasörüne kurar.
- Sunucuyu Windows açılışında başlayacak şekilde ayarlar. Kapanırsa bir dakika içinde yeniden başlar.
- Telefonların bağlanabilmesi için Windows Güvenlik Duvarı'nda 8765 numaralı portu açar.
- Masaüstüne ve Başlat menüsüne **Depo Takip** kısayolu ekler.

Ayrıca bir programın (Node.js vb.) kurulmasına gerek yoktur; gerekli her şey kurulum dosyasının içindedir.

### Taşınabilir paketle (alternatif)

1. `DepoTakip-Tasinabilir-x.y.z.zip` dosyasını `C:\DepoTakip` gibi kalıcı bir klasöre çıkarın. **İndirilenler** klasöründe bırakmayın.
2. Klasördeki `Kur.bat` dosyasına çift tıklayın ve yönetici iznini onaylayın.

### Bilgisayar için önemli ayarlar

- **Uyku modunu kapatın.** Denetim Masası → Güç Seçenekleri bölümünde **Bilgisayarı uyku moduna geçir: Hiçbir zaman** seçin. Bilgisayar uyursa telefonlar bağlanamaz.
- **Sabit IP verin.** Modem arayüzünde bu bilgisayara **DHCP rezervasyonu (sabit IP)** tanımlayın. Böylece telefonlardaki adres hiç değişmez. Bu ayar için IT sorumlunuzdan veya modem kılavuzundan yardım alabilirsiniz.

## 3. Android telefona kurulum

1. `DepoTakip-x.y.z.apk` dosyasını telefona aktarın. Bunun için WhatsApp, e-posta, USB kablo veya Google Drive kullanabilirsiniz.
2. Dosyaya dokunun. Telefon **"Bilinmeyen uygulamalar"** uyarısı verirse, açılan ekrandan **Bu kaynağa izin ver** seçeneğini açın ve **Yükle**'ye dokunun.
3. Play Protect uyarısı çıkarsa **Yine de yükle**'yi seçin. Uygulama firmanıza özeldir, Play Store'da yer almaz.
4. Uygulamayı açın. Bildirim izni istenirse **İzin ver** deyin; stok uyarıları bu sayede telefona gelir.
5. Bilgisayarda **Ayarlar → Telefon bağlantısı** ekranını açın.
6. Telefonda **Sunucuyu QR ile bul**'a dokunup ekrandaki QR kodu okutun. İsterseniz adresi elle de yazabilirsiniz, örneğin `192.168.1.20`.
7. Kendi kullanıcı adınız ve şifrenizle giriş yapın.

Telefon ile bilgisayar **aynı Wi-Fi ağında** olmalıdır. Telefonda mobil veri açık olsa bile sorun olmaz.

Daha sonra uygulamayı güncellemek için yeni APK'yı aynı şekilde kurmanız yeterlidir. Veriler sunucuda durduğu için hiçbir şey kaybolmaz.

## 4. İlk ayarlar (yalnızca bir kez)

1. **Kullanıcıları ekleyin.** **Ayarlar → Kullanıcılar → Yeni kullanıcı** yolunu izleyin. Her çalışana ayrı hesap açın ki hareket kayıtlarında kimin ne yaptığı görünsün.
2. **Açılış stoklarını ve asgari seviyeleri girin:**
   1. **Ayarlar → Excel ile toplu giriş → Excel şablonunu indir** düğmesine basın.
   2. Şablonu açın. Her satırda bir hammadde vardır.
      - **Ham Depo Sayım** ve **Cep Depo Sayım** sütunlarına depoda saydığınız miktarı yazın.
      - **Asgari Stok (Toplam)** sütununa iki deponun toplamı için alt sınırı yazın. Stok bu sınıra inince uyarı verilir.
      - **Cep Asgari** sütununa Cep Depo için alt sınırı yazın. Bu sınırın altına inilince "Cep depoya transfer gerekli" uyarısı verilir. Bu sütun isteğe bağlıdır.
      - Boş bıraktığınız hücreler değiştirilmez.
   3. Dosyayı kaydedip aynı ekrandan yükleyin. Önce bir önizleme gösterilir; **Kaydet**'e basmadan hiçbir şey değişmez.
3. **QR etiketlerini basın.** **QR Etiketleri** ekranında hammaddeleri seçin, etiket boyutunu belirleyin ve **Yazdır**'a basın. Etiketleri raflara, kasalara veya paletlere yapıştırın.

Şablonu istediğiniz zaman yeniden indirip kullanabilirsiniz. Örneğin ay sonu sayımları için de aynı yöntem geçerlidir.

## 5. Günlük kullanım

### QR okutarak ürün bulma

**QR Okut** düğmesine (telefonda alttaki ortadaki düğme) dokunun ve etiketi okutun. Ürünün Ham, Cep ve Toplam stoğu görünür. Buradan doğrudan **Giriş**, **Transfer**, **Üretim**, **Fire** veya **İade** işlemine geçebilirsiniz.

Bilgisayarda USB veya Bluetooth barkod okuyucu kullanıyorsanız, herhangi bir ekranda etiketi okutmanız yeterlidir; ürün kartı açılır.

### İşlem türleri

| İşlem | Ne zaman? | Varsayılan depo |
|---|---|---|
| **Giriş** | Tedarikçiden malzeme geldiğinde | Ham Depo'ya girer |
| **Transfer** | Ham Depo'dan Cep Depo'ya veya tersine taşırken | Ham → Cep |
| **Üretime Çıkış** | Hatta malzeme verildiğinde | Cep Depo'dan düşer |
| **Fire** | Malzeme kullanılamaz hale geldiğinde (neden yazmak zorunludur) | Cep Depo'dan düşer |
| **İade** | Üretimde kullanılmayan malzeme geri geldiğinde | Cep Depo'ya girer |
| **Sayım** | Fiili sayım sistemle tutmadığında (yalnızca Yönetici) | Seçilen depo |

Depoyu her işlemde değiştirebilirsiniz.

### Birden çok kalemi tek seferde kaydetme

Aynı irsaliyeyle birden fazla kalem geldiyse şöyle ilerleyin:

1. İrsaliye numarasını ve tedarikçiyi bir kez yazın.
2. İlk hammaddeyi seçip miktarını girin, **Listeye ekle**'ye basın.
3. Diğer kalemler için aynı adımı tekrarlayın.
4. **Kaydet**'e basın. Hepsi tek seferde kaydedilir; biri hatalıysa hiçbiri kaydedilmez.

### Yetersiz stok koruması

Bir depodan, o depodaki mevcut miktardan fazla çıkış yapılamaz. Sistem uyarı verir ve kaydı reddeder. Gerçek stok farklıysa yönetici **Sayım** ile düzeltir.

### Wi-Fi koparsa

Bağlantı yokken telefonda kaydettiğiniz işlemler kaybolmaz. Telefonda bekletilir ve bağlantı gelince otomatik gönderilir. Üst çubukta **"x bekleyen"** yazısı görünür. Sunucu bir işlemi kabul etmezse (örneğin stok o arada bittiyse), ekranda **"reddedildi"** uyarısı çıkar; işlemi kontrol edip yeniden girin.

### Hatalı kaydı düzeltme

Yönetici, **Hareket Geçmişi** ekranında ilgili satırdaki **İptal** düğmesine basar ve iptal nedenini yazar. Ardından doğru kayıt yeniden girilir.

## 6. Stok uyarıları

| Durum | Anlamı |
|---|---|
| **Kritik** | İki deponun toplamı asgari stok seviyesine eşit veya altında |
| **Tükendi** | Asgari seviyesi tanımlı bir kalemin stoğu sıfır |
| **Transfer gerekli** | Cep Depo, Cep Asgari seviyesinin altında ama Ham Depo'da stok var |

Bir kalem bu durumlardan birine girdiğinde, hareketi kim girmiş olursa olsun açık olan tüm ekranlarda uyarı çıkar. Telefonda Android bildirimi de gelir. Zil simgesindeki sayı, uyarıdaki kalem sayısını gösterir.

**Tahmini yeterlilik**, son 30 günün ortalama tüketimine (üretim + fire) göre mevcut stoğun kaç gün yeteceğini gösterir.

## 7. Raporlar ve Excel

- **Stok Durumu:** Tüm kalemlerin Ham, Cep ve Toplam stoğu; asgari seviyeleri, durumları ve tahmini yeterlilik süreleri.
- **Stok Uyarıları:** Uyarıdaki kalemler ve asgari seviyeye ulaşmak için eksik miktar.
- **Dönem Raporu:** Seçilen tarih aralığında her kalem için şu bilgiler: dönem başı, giriş, Cep'e transfer, üretime verilen, iade, fire, fire oranı, sayım farkı ve dönem sonu. Excel dosyasının ikinci sayfasında dönemin tüm hareketleri yer alır.
- **Hareket Geçmişi:** Tarih, işlem türü, depo, kullanıcı ve metin filtreleriyle; filtrelenmiş liste Excel'e aktarılabilir.

Excel dosyaları bilgisayarda **İndirilenler** klasörüne, telefonda **İndirilenler** (Download) klasörüne kaydedilir.

## 8. QR etiket yazdırma

| Boyut | Kullanım |
|---|---|
| A4 · 24 etiket (70×37 mm) | Standart A4 etiket kağıdı (3 sütun × 8 satır) |
| A4 · 14 etiket (99×38 mm) | 2 sütun × 7 satır |
| A4 · 8 büyük etiket (99×67 mm) | Palet ve kasa için büyük etiket |
| 100×50 mm / 60×40 mm | Termal etiket yazıcısı (her etiket ayrı sayfa) |

Yazdırma penceresinde **Ölçek: %100 / Gerçek boyut** ve **Kenar boşlukları: Yok** seçin. İlk baskıyı düz kağıda alıp etiket kağıdının üzerine koyarak hizayı kontrol edin.

## 9. Yedekleme ve geri yükleme

- Veritabanı her 12 saatte bir otomatik yedeklenir. Son 60 yedek `C:\ProgramData\DepoTakip\yedekler` klasöründe saklanır.
- **Ayarlar → Yedekleme** ekranından istediğiniz an yedek alabilir veya yedeği indirebilirsiniz.
- **Önerimiz:** Haftada bir yedek klasörünü bir USB belleğe veya başka bir bilgisayara kopyalayın.

### Geri yükleme

1. Başlat menüsünde **Görev Zamanlayıcı**'yı açın, **DepoTakip Sunucu** görevine sağ tıklayıp **Sonlandır**'ı seçin.
2. `C:\ProgramData\DepoTakip` klasöründeki `depo.db`, `depo.db-wal` ve `depo.db-shm` dosyalarını güvenli bir yere taşıyın.
3. Geri yüklemek istediğiniz yedek dosyasını bu klasöre kopyalayın ve adını `depo.db` yapın.
4. Görevi sağ tıklayıp **Çalıştır**'ı seçin veya bilgisayarı yeniden başlatın.

### Başka bilgisayara taşıma

1. Yeni bilgisayara Depo Takip'i kurun.
2. Yukarıdaki geri yükleme adımlarıyla eski bilgisayardaki `depo.db` dosyasını yeni bilgisayara taşıyın.
3. Telefonlarda **Sunucu adresini değiştir** seçeneğiyle yeni adresi girin.

## 10. Sorun giderme

| Sorun | Çözüm |
|---|---|
| Telefon "Sunucuya bağlanılamadı" diyor | Bilgisayar açık mı, uykuda mı? Telefon aynı Wi-Fi'da mı? Bilgisayarda **Ayarlar → Telefon bağlantısı** ekranındaki adresle telefondaki adres aynı mı? |
| Adres değişti | Bilgisayara sabit IP verin (bkz. Bölüm 2). Telefonda **Menü → Sunucu adresini değiştir** ile yeni QR'ı okutun. |
| Masaüstü kısayolu açılmıyor | Tarayıcıda `http://localhost:8765` adresini açmayı deneyin. Olmazsa bilgisayarı yeniden başlatın. Kayıt dosyası: `C:\ProgramData\DepoTakip\sunucu.log` |
| Kamera açılmıyor | Telefon ayarlarından Depo Takip uygulamasına **Kamera** izni verin. |
| Şifremi unuttum | Yönetici, **Ayarlar → Kullanıcılar** ekranından yeni şifre belirler. |
| Yöneticinin şifresi unutuldu | Başka bir yönetici hesabı yoksa teknik destek gerekir; veritabanı dosyası bozulmadan şifre sıfırlanabilir. |

## 11. Teknik ayrıntılar

- **Sunucu:** Node.js 24 ve yerleşik SQLite (harici paket yok). Varsayılan port 8765; `DEPO_PORT` ortam değişkeniyle değiştirilebilir.
- **Veri klasörü:** `C:\ProgramData\DepoTakip` (`depo.db`, `sunucu.log`, `yedekler\`).
- **Canlı senkron:** Server-Sent Events. Değişiklikler tüm açık ekranlara anında iletilir.
- **Güvenlik:** Şifreler scrypt ile özetlenerek saklanır. Oturum anahtarı 30 gün kullanılmazsa geçersiz olur. Sistem yalnızca yerel ağda çalışır, internete açılmaz.
- **Android:** WebView tabanlı uygulama. Google Play Hizmetleri'nin QR tarayıcısını, yoksa yerleşik ZXing tarayıcıyı kullanır. Desteklenen sürüm: Android 7.0 ve üzeri.
