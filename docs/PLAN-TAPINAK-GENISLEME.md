# Tapınak genişleme planı: yeni haritalar, düşmanlar, bölümler, kurgu, RPG (2026-11-05)

Mevcut durum (src/tapinak.js, 48x32 oda, 3x3 harita): 3 düşman (Hortlak, Rün Cadısı, Taş Muhafız), 1 boss (Kül Jarlı), 7 armağan, 3 kalıcı yetenek (Atılım, Kırıcı Atış, Kök Anahtarı), Miras'a Kül. Tek bölüm, kurgu yok.
Kurallar: özgün içerik (başka oyunların adı/metni/varlığı yok), Nors/Alacakaranlık teması, hepsi geriye uyumlu (eski kayıt `twilightTapinak` bozulmaz, yeni alanlar varsayılanla yüklenir), her evre ayrı PR + test, çizim kodla veya Blender dokusu (CC0/proje üretimi).

## Kurgu: "Üç Kapı"
Jörmungandr'ın bir kıvrımı olan oyuncu yılan, Ragnarök'ten önce dünyayı çevreleyen halkanın çatlayan tapınağına iner. Tapınak üç diyardan geçer; her diyarın bekçisi bir Norn'un (kader dokuyan) düşmüş yankısıdır. Üç kilidi (Urd, Verdandi, Skuld mühürleri) kıran yılan halkayı onarır ya da yutar: sonda iki son (Onar / Yut) arasında seçim, Miras'a farklı Kül ve kozmetik ödül.
- Ara metinler kısa (2-3 satır), oda girişinde "kitabe" olarak bir kez; Türkçe, oyunun mevcut ipucu sistemiyle (`ipucu`) verilir.
- Anlatıcı: kuzgun Muninn (NPC), her diyar başında bir cümle ve ipucu verir.

## Yeni diyarlar (bölümler) ve haritalar
| Diyar | Harita | Doku/tema | Özel mekanik | Bekçi (boss) |
|---|---|---|---|---|
| 1 Kül Tapınağı (mevcut, genişler) | 3x3 → 4x3, yeni 3 oda | taş + lav | mevcut | Kül Jarlı (mevcut) |
| 2 Donmuş Kader Bahçesi | 4x4 oda, buz kollu dehliz | Blender BuzKristal01 | kayan buz karoları (dönüş gecikir), don bölgeleri düşmanı yavaşlatır | Urd'un Yankısı: geçmişten kopya mermi (oyuncunun son 5 sn hamlesini tekrar eder) |
| 3 Kök Mahzeni | 4x4, dallanan koridorlar | bataklık/kaya | zehirli sis odaları, kök duvarlar (Kırıcı ile açılır), tuzak sarmaşık | Verdandi'nin Yankısı: oda dönüşümü (zemin her 20 sn yeniden desenlenir) |
| 4 Halka Çekirdeği (son) | tek büyük oda + 2 ön oda | rün, parlayan | iki aşamalı final; Onar/Yut seçimi | Skuld'un Yankısı |

Oda üretimi: mevcut `odaUret` tohumlu; yeni oda şablon tabanı (6'şar el yapımı yerleşim + rastgele süs) ve "özel oda" türleri: ruh pazarı, sınav odası, kitabe odası, mini-boss arenası, gizli kaçış odası.

## Yeni düşman NPC'ler (10)
1. **Buz Yiyici**: yavaş, vurulunca 3 küçük buz parçasına bölünür. 2. **Fısıltı**: duvarlardan geçer (CATLAK/SUTUN içinden), 2 sn görünür. 3. **Kök Örücü**: yere sarmaşık tuzak bırakır, hareketsiz. 4. **Kuzgun Sürüsü**: 5 küçük hızlı, yönsüz. 5. **Zincirli Muhafız**: iki halkalı, aralarındaki zincir temas hasarı verir. 6. **Ayna Gölge**: oyuncunun hareketini ters yansıtır, kuyruk silahıyla yenilir. 7. **Rün Havan**: uzaktan çarpışma alanı işaretler, 1 sn sonra patlar. 8. **Kül Kurdu**: yer altından çıkıp sürünür (mevcut sürünen YZ ile ortak). 9. **Dikenli Çırpınan**: kaçınılmaz çırpınma, ölünce diken saçar. 10. **Norn Hizmetkârı** (mini-boss): her diyarda bir, 12 can, 2 saldırı kalıbı.
Her düşman: hp, hız, puan, `zirh`, tek AI fonksiyonu, `DUSMANLAR` tablosuna eklenir; sprite yoksa tuval çizimi (mevcut kalıp), sonra Blender sprite.

## RPG öğeleri
- **Seviye ve XP (koşu içi)**: öldürmeler XP verir; seviye atlayınca 3 armağan arasından seç (mevcut armağan sistemi). Koşu sonunda XP Miras Külüne dönüşür.
- **Nitelikler (kalıcı, Miras'ta harcanır)**: Güç (atış hasarı), Çeviklik (atış aralığı, atılım bekleme), Dayanıklılık (can), Şans (sandık/armağan kalitesi). Her nitelik 5 kademe; maliyet artan Kül.
- **Sınıflar (3, başlangıçta seçilir; kilitleri Miras ile açılır)**: Pul Bekçisi (kalkanlı, yavaş), Gölge Dilci (atılım odaklı), Zehir Örücü (zehir ve diken). Her sınıf 1 pasif + 1 aktif yetenek.
- **Kalıntılar (relic, 24 adet)**: koşu boyunca bulunan pasifler (örn. "Kuzgun Tüyü: ilk darbeyi yok sayar", "Buz Kristali: atışlar yavaşlatır"); tüccar ve sandıklardan.
- **Tüccar NPC (Kuzgun Muninn / Ruh Pazarı odası)**: koşu içi altın "Rün Parası" ile kalıntı ve can satar; pazarlık yok, sade.
- **Görevler (3 yan görev/diyar)**: "10 Fısıltı yen", "oda hasarsız geç", "gizli kitabeyi oku"; ödül Kül + kalıntı. Kayıt: `meta.gorev`.
- **Meta ilerleme**: bestiary (görülen düşmanlar listesi), kitabe koleksiyonu; Ayarlar'dan kapatılabilir ek özellik olarak ayrı düğme yok (Miras panelinde).

## Aşamalar (her biri ayrı PR + test + 0.9.x sürüm)
1. **A: Çekirdek veri** — `DUSMANLAR`, `HARITA` çok diyarlı şemaya (`diyar`, `odalar`), kayıt migrasyonu (varsayılanlı), tohumlu oda şablonları. Test: eski kayıt yükleme, tohum aynı çıktı.
2. **B: Diyar 2 (Donmuş Bahçe)** — kayan buz, 4 yeni düşman, Urd boss, Blender BuzKristal01 doku bağlantısı, kitabeler.
3. **C: RPG omurgası** — XP/seviye, nitelikler, sınıflar, Miras paneli genişlemesi, tüccar, Rün Parası.
4. **D: Diyar 3 (Kök Mahzeni)** — 4 düşman, Verdandi boss, zehir sisi, kalıntılar (24).
5. **E: Final ve kurgu** — Halka Çekirdeği, Skuld, Onar/Yut sonu, Muninn anlatım, görevler, bestiary.
6. **F: Blender sprite/doku turu** — yeni düşman sprite'ları (Blender başsız, tools/blender/), harita zemin dokuları; ücretsiz hazır varlık yalnız CC0 ve CREDITS'e yazılarak.
Her aşamada: yeni davranış ek özellik anahtarıyla kapatılabilir değil ama eski koşuyu bozmaz (tohumlu eski diyar 1 aynı kalır); tam `npm run test:ozet`; PC derlemesi ancak yuva verilince.

## Riskler
- tapinak.js 1549 satır: yeni içerik ayrı dosyalara (`tapinak-diyar.js`, `tapinak-rpg.js`) bölünmeli, çekirdek dosya şişmemeli.
- Kayıt şeması büyür: sürüm alanı (`v`) eklenir; bozuk/eksik alan varsayılana döner.
- Denge: yeni düşman/relic sayısı çok; `tools/denge-bot` ile tohumlu koşular ölçülmeli.
- Kapsam büyük (tahmin: 6 PR); sırayı Yusuf değiştirebilir.
