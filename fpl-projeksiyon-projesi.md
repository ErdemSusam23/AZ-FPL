# FPL Oran Bazlı Projeksiyon Aracı — Proje Planı

## 1. Amaç

Bahis oranlarından (live odds) türetilmiş, Premier League maçları için:
- Takım bazlı gol beklentisi (xG benzeri)
- Clean sheet (gol yememe) olasılığı
- Skor / sonuç olasılıkları
- FPL oyuncularına uyarlanmış puan beklentisi

sunan bir web uygulaması. fpljoe.com'un yaptığına benzer, kişisel/öğrenme amaçlı bir klon.

## 2. Kapsam (MVP — İlk Versiyon)

Küçük başla, sonra genişlet:

- [ ] Tek lig: Premier League
- [ ] Tek veri kaynağı: bir bahis oranı API'si
- [ ] Sadece "Fixtures" sayfası: yaklaşan gameweek'in maçları + hesaplanan olasılıklar
- [ ] Basit tablo görünümü (sıralama/filtre yok ilk etapta)

Sonraki fazlarda: Projections (oyuncu bazlı), Overview, geçmiş sezon karşılaştırması, sıralanabilir tablolar.

## 3. Veri Kaynakları

### 3.1 Bahis oranları
- **The Odds API** (the-odds-api.com) — ücretsiz katmanı var, aylık istek limiti düşük ama MVP için yeterli. Maç sonucu (h2h), gol sayısı (over/under 2.5), ve mümkünse "her iki takım da gol atar" (BTTS) piyasalarını çekebiliyor.
- Alternatif: Betfair Exchange API (daha karmaşık, hesap gerektirir), OddsPortal (resmi API yok, scraping gerektirir — TOS'a dikkat).
- **Karar noktası:** Hangi bahis piyasalarına ihtiyacın var? Sadece maç sonucu mu, yoksa gol sayısı piyasaları da mı?

### 3.2 FPL/oyuncu verisi
- Resmi ve ücretsiz: `https://fantasy.premierleague.com/api/bootstrap-static/`
  - Tüm oyuncular, takımlar, pozisyonlar, fiyatlar burada
- Fikstür listesi: `https://fantasy.premierleague.com/api/fixtures/`

## 4. Temel Algoritma: Oranlardan Olasılığa

Bu projenin istatistiksel çekirdeği. Adımlar:

1. **Implied probability hesapla:** Decimal oran için `p = 1 / oran`
2. **Overround'u (bahis şirketi kâr payı) çıkar:** 1X2 piyasasında üç olasılığın toplamı genelde 1'den büyük çıkar (örn. 1.05). Her olasılığı bu toplama bölerek normalize et (bu, "de-vig" işlemi olarak bilinir — en basit yöntem "proportional method"; daha gelişmiş yöntemler de var: Shin's method, power method)
3. **Maç sonucu olasılıklarından beklenen gol sayısına geç:**
   - Basit yöntem: Over/Under 2.5 gol piyasasından toplam maç golünü tahmin et, sonra 1X2 olasılıklarını kullanarak bunu iki takıma dağıt
   - Daha doğru yöntem: Poisson dağılımı fit et — takım A ve B için λ (lambda, beklenen gol) değerlerini, gözlemlenen 1X2 ve over/under olasılıklarına en iyi uyacak şekilde optimize et (örn. scipy.optimize kullanarak)
4. **Clean sheet olasılığı:** Poisson(λ_rakip = 0) olasılığı, yani `e^(-λ_rakip)`
5. **Skor olasılıkları:** İki bağımsız Poisson dağılımının çarpımı (matris halinde tüm skor kombinasyonları)

**Not:** Bu adım için istatistik/olasılık bilgisi gerekiyor — Claude Code'a bu formülleri ve referans yöntemleri (Dixon-Coles modeli daha gelişmiş bir alternatif, futbol modellemede standart) vererek başlaman işini kolaylaştırır.

## 5. Teknik Yığın (Tech Stack) Önerisi

- **Backend/veri işleme:** Python (pandas, scipy/numpy — Poisson hesaplamaları için ideal) veya Node.js
- **Cache:** Upstash Redis — FPL ve Odds API cevaplarını instance'lar arası ortak sakla. FPL fikstürleri 6 saat, odds ise en yakın maç saatine göre 12 saat–1 saat aralığında dinamik TTL ile saklanır; Odds API kotası için kalan kredi izlenir.
- **Veritabanı:** Başlangıçta gerek yok. İleride geçmiş veri biriktirmek istersen SQLite veya yönetilen bir SQL veritabanı yeterli.
- **Frontend:** Next.js + React (fpljoe.com da bunu kullanıyor), Tailwind ile hızlı tablo/kart tasarımı
- **Barındırma:** Vercel (Next.js için ücretsiz katman yeterli), API anahtarlarını environment variable olarak sakla

## 6. Proje Yapısı (Öneri)

```
fpl-projections/
├── data/
│   └── fetch_odds.py          # Odds API'den veri çekme
│   └── fetch_fpl.py           # FPL API'den oyuncu/fikstür verisi
├── models/
│   └── poisson_model.py       # Oranlardan xG hesaplama
├── api/                        # Next.js API routes veya ayrı backend
├── app/                         # Next.js sayfaları (Overview, Fixtures, Projections)
└── README.md
```

## 7. Yol Haritası (Fazlar)

1. **Faz 1 — Veri:** Odds API'den bir gameweek'lik veri çekip ham haliyle JSON'a kaydet
2. **Faz 2 — Cache:** Upstash Redis ile FPL/Odds verisini TTL tabanlı cache'le.
3. **Faz 3 — Model:** Poisson tabanlı xG/clean-sheet hesaplama fonksiyonunu yaz, birkaç maçla elle doğrula (mantıklı sonuçlar çıkıyor mu?)
4. **Faz 4 — FPL eşleştirme:** Takım xG değerlerini oyuncu bazına indir (basit oran: oyuncunun geçmiş gol/asist payına göre takım xG'sini dağıt)
5. **Faz 5 — Frontend:** Basit tablo ile sonuçları göster
6. **Faz 6 — İyileştirme:** Dixon-Coles gibi daha gelişmiş modele geçiş, sıralama/filtreleme, geçmiş performans takibi

## 8. Açık Sorular (Claude Code'da netleştirilecek)

- Hangi Odds API kullanılacak ve ücretsiz limit yeterli mi?
- Poisson mu, yoksa daha basit bir "oranı direkt göster" yaklaşımı mı tercih edilecek?
- Oyuncu bazlı puan tahmini MVP'ye dahil mi, yoksa sadece takım/fikstür seviyesinde mi kalınacak?
- Barındırma/deploy hedefi var mı, yoksa şimdilik yerelde mi çalışacak?
