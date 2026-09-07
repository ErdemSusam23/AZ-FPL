# AZ-FPL | Premier League Maç Projeksiyonları

[Canlı uygulama](https://az-fpl.fpl-projections-tr.workers.dev/) · [API health check](https://az-fpl.fpl-projections-tr.workers.dev/health)

Premier League'in yaklaşan fikstürleri için bahis piyasası verisini anlamlı maç projeksiyonlarına dönüştüren uçtan uca bir web uygulaması. Her maçta beklenen goller, iki takımın clean-sheet olasılığı ve en olası üç skor sunulur.

Bu proje, yalnızca bir arayüz değil; dış veri kaynaklarını güvenilir biçimde birleştiren, kota bilinci olan ve production'a alınmış bir Angular + TypeScript sistemi olarak tasarlandı.

## Öne çıkanlar

- Resmî FPL API'den yaklaşan gameweek fikstürlerini alır.
- The Odds API'deki 1X2 ve 2.5 gol alt/üst marketlerini takım adları farklı olsa bile eşleştirir.
- Bahis oranlarını implied probability'ye çevirir, bookmaker marjını temizler (*devig*) ve birden fazla kaynağın medyanını kullanır.
- Poisson dağılımıyla ev/deplasman gol beklentisini, clean-sheet ihtimallerini ve olası skorları hesaplar.
- Upstash Redis ile FPL verisini, bahis oranlarını ve nihai API yanıtını cache'leyerek API kotasını ve Worker CPU kullanımını korur.
- Angular istemciyi ve `/api/fixtures` endpoint'ini tek bir Cloudflare Worker üzerinden sunar.
- Fikstürleri güne göre gruplar; her takımı kulüp rengi ve uygulama paketindeki yerel rozetiyle gösterir.
- Maç kartlarında takım bazında kazanma olasılığı, clean-sheet olasılığı ve beklenen gol değerini sunar.

## Mimari

```text
Angular arayüzü
      │
Cloudflare Worker ── /api/fixtures
      │
      ├── Upstash Redis (cache)
      ├── FPL API (fikstürler)
      └── The Odds API (bahis marketleri)
```

```text
FPL fixture → Odds eşleştirme → Devig + medyan → Poisson fit → Maç projeksiyonu
```

## Teknoloji seçimi

| Katman | Teknoloji |
| --- | --- |
| Frontend | Angular 22, TypeScript |
| Backend | Cloudflare Workers, TypeScript |
| Veri | FPL API, The Odds API |
| Cache | Upstash Redis |
| Test | Node test runner + `tsx` |
| CI/CD | GitHub → Cloudflare Workers Builds |

## Yerelde çalıştırma

Node.js 24 LTS kullanın. İstemci ve Worker bağımlılıklarını bir kez kurduktan sonra:

```powershell
cd C:\Users\USER\Documents\GitHub\AZ-FPL\client
npm install

cd ..\server
npm install
Copy-Item .dev.vars.example .dev.vars
npm run dev
```

`server/.dev.vars` içinde aşağıdaki değerler bulunmalıdır; bu dosya Git'e eklenmez:

```env
ODDS_API_KEY=...
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
```

## Kalite kontrolleri

```powershell
cd C:\Users\USER\Documents\GitHub\AZ-FPL\server
npm run check
npm test

cd ..\client
npm run build
```

Testler; takım adı eşleştirme, market seçimi, olasılık/devig hesabı, Poisson modeli ve Worker endpoint davranışını kapsar.

## Deploy

`main` dalına yapılan push'lar Cloudflare Workers Builds aracılığıyla otomatik olarak yayınlanır. Worker çalışma zamanı sırları (`ODDS_API_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`) Cloudflare Dashboard'da Worker Secret olarak tutulur; kaynak kodda veya Git geçmişinde yer almaz.

## Proje yapısı

```text
client/               Angular kullanıcı arayüzü
client/public/badges/ FPL takım kodlarıyla adlandırılmış yerel kulüp rozetleri
server/src/           Worker, veri istemcileri ve projeksiyon modeli
server/wrangler.jsonc Cloudflare Worker yapılandırması
docs/                 Teknik tasarım ve model notları
```

## Lisans

Bu proje [MIT License](LICENSE) ile lisanslanmıştır. Lisans; telif ve izin bildirimleri korunduğu sürece kodun kullanılmasına, değiştirilmesine ve dağıtılmasına izin verir.

## Notlar

Bu proje öğrenme odaklı geliştirilmiştir. Hesaplama hattı, model varsayımları ve mimari kararlar için [teknik tasarım](docs/mvp-teknik-tasarim.md) ile [model spesifikasyonuna](docs/model-spesifikasyonu.md) göz atılabilir.
