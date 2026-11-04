# Yılan 0.9.0 planı: 2.5D, Miras (kalıcı tecrübe), Tapınak (Hades tarzı metroidvania bölüm)

Kapsam
1. Büyük harita: 48x32 hücre (960x640), tuval ölçekli. [yapıldı]
2. 2.5D çizim (src/gfx25.js): yükseltilmiş zemin döşemeleri, çerçeve duvar, uzatılmış (extrude) engel blokları, yere düşen gölgeler, kürevari ışıklı yılan (baş: pul, göz, dil), kabaran/gölgeli yemler. Mantık değişmez; ressam sırası (y'ye göre).
3. Miras (src/miras.js): her ölüm/oyun sonu "Kül" (tecrübe) kazandırır; kalıcı seviye + harcanabilir puan; özgün 6 kalıcı yetenek (ek can, başlangıç kalkanı, yem puanı, kül çarpanı, yavaş başlangıç, mıknatıs). Menüde küçük "Miras" düğmesi.
4. Tapınak (src/tapinak.js): oda oda aksiyon bölümü. 3x3 oda haritası, savaş odaları (kapı kilitli, düşmanları kuyruk atışıyla yen), ödül seçimi (2 kapı, Hades benzeri armağan: hasar, hız, can, çoklu atış, ...), boss odası. Metroidvania: boss/gizli odalar yetenek verir (Atılım, Kırıcı Atış, Kök Anahtarı) ve yetenekler kalıcıdır; kapalı kapılar sonraki koşuda açılır. Ölünce Miras'a Kül.
5. Test: her modül için Playwright testi; ekran görüntüleri.

Özgünlük: hiçbir oyunun varlığı/metni alınmaz; tüm çizim kodla.
Model: çizim ve Miras Sonnet, Tapınak Opus. Her ajan ayrı dalda, ayrı dosyada; game.js'e yalnız küçük kanca satırları.
