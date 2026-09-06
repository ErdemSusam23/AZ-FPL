# FPL Oran Bazlı Projeksiyon

Angular istemci ve Cloudflare Worker API'sinden oluşan Premier League fikstür projeksiyon aracı.

## Başlatma

1. `server/.dev.vars.example` dosyasını `server/.dev.vars` olarak kopyalayın. Odds entegrasyonu için The Odds API; cache için Upstash Redis değerlerini girin.
2. `cd server; npm run dev` çalıştırın. Bu komut Angular production çıktısını üretir ve Worker'ı yerelde sunar.
3. Wrangler'ın terminalde gösterdiği yerel adresi tarayıcıda açın.

Geliştirme için Node.js 24 LTS kullanın. Sistemde bulunan Node 25, Angular tarafından desteklenen bir sürüm değildir.

## Cache

Production ortamında FPL, odds ve projeksiyon cevapları Upstash Redis'te kısa süreli saklanır. Bu, API kotasını kullanıcılar ve birden fazla backend instance'ı arasında korur. Yerel geliştirmede Redis kurulana kadar bellek içi geçici cache kullanılabilir.

## Cloudflare Workers ile deploy

Proje, Angular uygulaması ile API'yi tek bir Cloudflare Worker'da sunar. Bu sayede tarayıcı API'ye aynı alan adı üzerinden `/api/fixtures` ile ulaşır ve free tier'da uyuyan Node sunucusu yoktur.

1. `cd server` içinde `npx wrangler login` ile Cloudflare hesabınıza giriş yapın.
2. Aşağıdaki değerleri Cloudflare Worker Secret olarak ekleyin. Değerleri kaynak koda veya Git'e yazmayın:

   ```powershell
   npx wrangler secret put ODDS_API_KEY
   npx wrangler secret put UPSTASH_REDIS_REST_URL
   npx wrangler secret put UPSTASH_REDIS_REST_TOKEN
   ```

3. `npm run deploy` komutunu çalıştırın.
4. Wrangler'ın verdiği `https://az-fpl.<hesap>.workers.dev/health` ve `/api/fixtures` adreslerini, ardından ana sayfayı doğrulayın.

Workers'ta `PORT` veya `CLIENT_ORIGIN` değişkeni gerekmez; API ve arayüz aynı origin'de çalışır.
