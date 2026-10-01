# Kasutusstsenaarium

## Avakohtumine kliendiga (u 45 min)

Projektijuht Mari kohtub spordiklubi juhiga. Ekraan on jagatud nii, et klient näeb sama vaadet.

1. **Projekt ja idee.** Mari loob projekti „Spordiklubi Tempo“ ja kirjutab vestlusesse kliendi sõnad: „Tahame veebi, kus saab treeningutega tutvuda ja liikmeks astuda.“ Kasutajalugude vormi ta ise kirjutama ei pea.
2. **Täpsustused.** AI küsib: „Kes on rakenduse kasutajad?“ ja pakub valikud. Klient valib Külastaja, Klubi liige ja Administraator. Järgmisena küsib AI, kas liikmetasu makstakse veebis, ja klient vastab „Jah, veebis“. Kui ükski valik ei sobi, kirjutab Mari vastuse vabalt.
3. **Rollid ja lood.** AI pakub rollid ja seejärel 7 lugu külastaja põhitöövoo järjekorras. Klient loeb need ekraanilt. Ühe loo („kinnitus e-postiga“) jätab Mari esialgu kõrvale ja vajutab **Lisa valitud**.
4. **Prioriteet.** AI soovitab alustada loost „Külastajana soovin näha liikmepakette ja hindu…“ ja põhjendab, miks. Klient nõustub. Mari lohistab backlog'is ka registreerumise loo maksmise ette ja tõmbab MVP joone viienda loo alla.
5. **Kriteeriumid ja mockup.** AI pakub valitud loole viis kriteeriumi ja paketivaate kavandi. Klient näeb kohe, kuidas leht välja võiks näha. Kolme kriteeriumiga nõustutakse, ühe sõnastust muudab Mari kliendi soovil ja üks eemaldatakse. Kui klient osutab hinnale, tõstetakse mockup'is esile vastav element.
6. **Kliendi täpsustus.** Klient ütleb: „Hinnas peab olema näha, kas see sisaldab käibemaksu.“ Mari kirjutab selle vestlusesse. AI näitab eelvaadet: hinna alla tuleb „sh km“ ja lisandub üks kriteerium. Teisi lugusid see ei muuda, aga AI märgib, et sama võib puudutada maksmise lugu, ja pakub selle muutmist eraldi. Mari vajutab **Rakenda**. Mockup'ist tekib versioon 2 ja versioon 1 jääb alles.
7. **Järgmised lood.** „Järgmine lugu“ viib registreerumise loo juurde ja sama ring kordub. Kohtumise lõpus vajutab Mari **Lõpetame kohtumise**. AI teeb kokkuvõtte: mitu lugu on backlog'is, mitu on kriteeriumidega, mitu on valmis arenduseks ja mitu avatud küsimust on alles.

Kui klient ei oska millelegi kohe vastata (nt maksevõimalused), märgib Mari loo **täpsustamist vajavaks** ja lisab avatud küsimuse. Selline lugu ei saa staatust „Valmis arenduseks“ enne, kui küsimus on vastatud.

## Backlog'i ülevaatus nädal hiljem (u 20 min)

1. Mari avab projekti. AI ütleb, millises etapis töö pooleli jäi, ja pakub järgmist sammu. Kogu backlog, mockup'id ja vestlus on alles.
2. Vahepeal lisas arendaja käsitsi loo „broneerida treeninguid ja tühistada broneeringuid ning maksta trahve“. Mari vajutab **Vaata backlog üle**.
3. AI leiab, et see lugu on liiga suur, ja pakub selle jagamist kolmeks looks koos kriteeriumide jaotusega. Mari muudab ühe uue loo sõnastust (**Muuda**) ja vajutab **Rakenda**. AI leiab ka kaks kattuvat lugu ning näitab ühendatud lugu ja kriteeriumide liitloendit ilma korduseta. Kolmanda leiu kohta, mis klienti ei huvita, valib Mari **Ignoreeri**.
4. Kui mõni otsus osutub valeks, võtab Mari selle **Võta tagasi** nupuga tagasi.
5. Lood, mille DoR on täidetud, märgib Mari staatusega „Valmis arenduseks“. Lõpuks ekspordib ta backlog'i Markdowni ja saadab selle arendusmeeskonnale.
