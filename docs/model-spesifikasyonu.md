# MVP Olasılık Modeli Spesifikasyonu

## Girdiler

Her maç için aynı bahisçiden alınmış decimal odds tercih edilir:

- `h2h`: ev galibiyeti, beraberlik, deplasman galibiyeti.
- `totals`: 2.5 gol üstü ve altı.

Birden çok bahisçi mevcutsa, her sonucu önce bahisçi içinde devig ederek olasılığa çevirir; ardından piyasa olasılıklarının medyanını kullanır. Bu, tek bir uç oranın modeli bozmasını azaltır.

## Devig

Decimal oran `o` için ham olasılık `q = 1 / o` olur. Aynı karşılıklı piyasadaki sonuçlar için:

`p_i = q_i / sum(q)`

Bu MVP, anlaşılır ve deterministik olduğu için oransal normalizasyonu kullanır. Shin veya power method ileride karşılaştırmalı olarak eklenebilir.

## Poisson parametreleri

Ev golü `H ~ Poisson(lambda_home)`, deplasman golü `A ~ Poisson(lambda_away)` ve ilk sürümde bağımsızdır. Pozitif iki lambda değeri, piyasa olasılıklarına en iyi uyacak biçimde sayısal olarak bulunur.

Her aday parametre için 0–10 gol skor matrisi hesaplanır. Bundan:

- `P(home win) = sum P(H=i,A=j), i>j`
- `P(draw) = sum P(H=i,A=i)`
- `P(away win) = sum P(H=i,A=j), i<j`
- `P(over 2.5) = sum P(H+A >= 3)`

elde edilir.

Amaç fonksiyonu:

`loss = (P_homewin - M_homewin)^2 + (P_draw - M_draw)^2 + (P_awaywin - M_awaywin)^2 + (P_over25 - M_over25)^2`

Arama alanı her lambda için `[0.05, 6.0]` olur. Başlangıç tahmini toplam gol piyasasına göre `1.35, 1.15` civarında seçilir; birden fazla başlangıç noktasıyla yerel minimum riski azaltılır. Dönüş değeri en düşük kayıplı çözümdür.

## Türetilen değerler

- Ev clean sheet: `P(A=0) = exp(-lambda_away)`.
- Deplasman clean sheet: `P(H=0) = exp(-lambda_home)`.
- Skor olasılığı: `P(H=i) * P(A=j)`.
- Ekrandaki en olası skorlar, 0–6 aralığındaki skorlar arasında olasılığa göre azalan ilk üç değerdir.

0–10 matrisin dışındaki olasılık kuyruğu kabul edilmeden önce normalize edilmez; maksimum lambda 6 olsa bile testlerde toplam kayıp izlenir. Ekran skoru için 0–6 sınırı yalnızca sunum tercihidir.

## Eksik veri politikası

`h2h` veya 2.5 toplam piyasası eksikse lambda fit edilmez ve maç `market-unavailable` durumuyla döner. Tahmine dayalı varsayılan oran veya başka çizgi (ör. 3.5) MVP'de kullanılmaz; bu, sonucun neye dayandığını şeffaf tutar.

## Doğrulama ve testler

- Decimal odds dönüşümü ve devig sonucu toplamı yaklaşık 1 olmalıdır.
- Bilinen lambda çiftinin ürettiği piyasa olasılıkları modele verildiğinde fit, lambdaları kabul edilebilir toleransla geri bulmalıdır.
- Clean-sheet formülü `lambda=0` için 1, artan lambda için azalan değer üretmelidir.
- Skor matrisi olasılıkları 0–10 aralığında yaklaşık 1 toplamına ulaşmalıdır.
- Gerçek maç örnekleri, negatif/NaN olasılık üretmemeli; sonuçlar 0–1 içinde kalmalıdır.
