# FPL Oran Bazlı Projeksiyon — MVP Teknik Tasarımı

## Amaç ve sınır

İlk sürüm, yaklaşan Premier League fikstürleri için bahis piyasalarından türetilen takım bazlı değerleri gösterir:

- ev/deplasman beklenen golü (`lambda`),
- ev/deplasman clean-sheet olasılığı,
- ev/beraberlik/deplasman galibiyet olasılığı,
- en olası skorlar.

Oyuncu seviyesi projeksiyon, kullanıcı hesabı, geçmiş veri saklama, sıralama ve deploy bu sürümün dışındadır.

## Seçilen yaklaşım

- Arayüz: Angular + TypeScript + CSS.
- Backend: Node.js + Express + TypeScript.
- Haricî veriler: resmi FPL API ve The Odds API.
- Hesaplama: Sunucu tarafında çalışan, bağımsız TypeScript modülü.
- Paylaşımlı cache: Upstash Redis. Yerel geliştirmede Redis yapılandırılmamışsa bellek içi geçici cache kullanılabilir.
- Çalışma hedefi: Önce yerel geliştirme; ardından serverless uyumlu deploy.

Angular, bu proje için öğrenme hedefi olarak seçilmiştir. Hesaplama ve üçüncü taraf API çağrıları Express'te kalır; böylece `ODDS_API_KEY` tarayıcıya sızmaz. Redis, FPL ve Odds API sonuçlarını tüm kullanıcılar ve backend instance'ları arasında paylaşır.

## Veri akışı

```text
FPL fixtures API ──> yaklaşan PL maçları ──┐
                                            ├─> takım adı eşleştirme
The Odds API ─────> h2h + totals piyasaları ┘
                                                   │
                                                   v
                                           devig + Poisson fit
                                                   │
                                                   v
                                  Upstash Redis cache
                                      │          │
                                      │ cache hit│cache miss
                                      v          v
                               Express /api/fixtures JSON
                                                   │
                                                   v
                                           Fixtures arayüzü
```

### Kaynak uç noktalar

- `https://fantasy.premierleague.com/api/bootstrap-static/`: takım adları ve aktif gameweek.
- `https://fantasy.premierleague.com/api/fixtures/`: Premier League fikstürleri.
- `https://api.the-odds-api.com/v4/sports/soccer_epl/odds/`: `h2h` ve `totals` marketleri, decimal formatında oranlar.

The Odds API anahtarı yalnızca sunucuda `ODDS_API_KEY` ortam değişkeninde tutulur; istemciye gönderilmez ve repoya yazılmaz.

Upstash bağlantı bilgileri yalnızca sunucuda `UPSTASH_REDIS_REST_URL` ve `UPSTASH_REDIS_REST_TOKEN` ortam değişkenlerinde tutulur; Angular'a gönderilmez ve repoya yazılmaz.

## Uygulama bileşenleri

```text
client/
  src/app/
    fixtures/                # Sayfa ve görünüm bileşenleri
    services/fixtures.ts     # Express API istemcisi
    models/fixture.ts        # API tipleri
server/
  src/
    index.ts                 # Express uygulaması
    cache.ts                 # Redis/cache arayüzü ve TTL yönetimi
    fpl.ts                   # FPL istemcisi ve tipleri
    odds.ts                  # Odds API istemcisi ve tipleri
    team-matching.ts         # İsim normalizasyonu/eşleştirme
    poisson.ts               # Saf model fonksiyonları
    projections.ts           # Oranları API çıktısına dönüştürür
```

Angular sayfası yalnızca Express'in `/api/fixtures` uç noktasını tüketir. Böylece veri kaynakları, eşleştirme ve hesaplama tarayıcıdan ayrılır ve daha sonra test edilebilir kalır.

## API sözleşmesi

`GET /api/fixtures` yaklaşan (başlamamış) maçları döndürür. Her öğe en az şunları içerir:

```ts
type FixtureProjection = {
  fixtureId: number;
  kickoffUtc: string;
  homeTeam: string;
  awayTeam: string;
  status: 'projected' | 'market-unavailable' | 'match-unavailable';
  projection?: {
    homeLambda: number;
    awayLambda: number;
    homeWin: number;
    draw: number;
    awayWin: number;
    homeCleanSheet: number;
    awayCleanSheet: number;
    topScores: Array<{ homeGoals: number; awayGoals: number; probability: number }>;
  };
};
```

Yüzdeler API içinde 0–1 aralığında saklanır; arayüz bunları yüzde olarak biçimlendirir. Bir piyasası olmayan maç sayfayı bozmaz; durum alanı ve kısa açıklama gösterilir.

## Hata ve operasyon ilkeleri

- FPL API erişilemezse uç nokta `502` ve anlaşılır hata döndürür.
- Odds API anahtarı yoksa geliştirme ortamında yapılandırma mesajı gösterilir; sahte oran üretilmez.
- Tek bir odds eşleşmesinin bulunamaması diğer maçların sonucunu engellemez.
- Kaynak çağrıları için makul zaman aşımı uygulanır.
- Upstash erişilemezse servis doğrudan kaynak API'ye düşer; olay loglanır.
- İstek kotasını korumak için sonuçlar Redis'te kısa süreli saklanır.

## Cache politikası

| Veri | Redis anahtarı | TTL |
| --- | --- | --- |
| Bir sonraki gameweek FPL fikstürleri | `fpl:fixtures:next` | 6 saat |
| Yaklaşan Premier League odds verisi | `odds:epl:upcoming` | Maça göre dinamik |
| Hesaplanmış proje çıktısı | `projections:next-gameweek` | Odds TTL'iyle aynı |

Redis cache deploy sonrası veya birden fazla backend instance'ı bulunduğunda da ortaktır. Bu nedenle production ortamında bellek içi cache yerine kullanılır.

### Odds TTL ve kota politikası

The Odds API'nin aylık 500 kredi planında, `uk` bölgesinden `h2h,totals` marketlerini tek çağrıda almak yaklaşık 2 kredi tüketir. Bu nedenle sabit 15 dakikalık yenileme kullanılmaz; tüm EPL odds cevabı, en yakın başlamamış maçın zamanına göre cache'lenir:

| En yakın maçın başlamasına kalan süre | Odds TTL |
| --- | --- |
| 24 saatten fazla | 12 saat |
| 6–24 saat | 4 saat |
| 90 dakika–6 saat | 1 saat |
| 90 dakikadan az | 1 saat |

API'nin `x-requests-remaining` cevabı kaydedilir. Kalan kredi 50'nin altına düşerse TTL geçici olarak en az 6 saate çıkarılır ve arayüz son güncelleme zamanını gösterir. Bu, ay sonundaki kota tükenmesinde uygulamanın tamamen işlevsiz kalmasını önler.

## Kabul ölçütleri

1. Ortam değişkeni ayarlandıktan sonra yerelde tek komutla çalışır.
2. Yaklaşan Premier League maçları tarih, ev ve deplasman takımıyla listelenir.
3. Her eşleşen maç için model çıktıları ve en az üç olası skor gösterilir.
4. Eksik piyasa veya eşleşmeyen takım adı görünür hata vermeden açıklanır.
5. Poisson/devig hesapları birim testleriyle doğrulanır.
