# Ülevaade

## Mis töötab

- **Kogu vastuvõtukatse töövoog:** projekt → idee → täpsustavad küsimused → rollid → lood → prioriteet → kriteeriumid + mockup → kliendi täpsustus → AI ülevaatus → DoR. Seda kontrollib automaattest `tests/flow.test.ts` (näidis-AI-ga, API kaudu, sh serveri taaskäivitus). Samad sammud on läbi klõpsatud ka brauseris.
- **Püsiv salvestus** SQLite'is (`data/app.db`): lood, kriteeriumid, mockup'i versioonid, vestlus, ettepanekud (koos olekuga), etapp ja tagasivõtmise ajalugu (viimased 50 muudatust).
- **Inimese kontroll:** kõik AI ettepanekud salvestatakse ootel olekus ja rakenduvad alles pärast kinnitust. Muudatusettepaneku sihtlugu võetakse serveris salvestatud ettepanekust, mitte brauseri päringust, seega ei saa muudatus kogemata teist lugu muuta. Uus ülevaatus märgib vanad ootel ülevaatused asendatuks.
- **Käsitsi haldus ilma AI-ta:** lisamine, muutmine, kustutamine, järjestamine, jagamine, ühendamine, MVP joon, avatud küsimused, staatused, mockup'i versiooni taastamine ja eksport.
- **AI vastuste kontroll:** struktureeritud väljund (JSON-skeem), zod-valideerimine, sisulised reeglid ja kuni 3 katset. Kui API lükkab struktureeritud väljundi või varumudeli parameetri tagasi, jätkab server automaatselt ilma nendeta.

## Mis jäi pooleli või on lihtsustatud

- **Kliendile jagatav link (C3) ja story map (C4)** on tegemata.
- **Kõnesisend** puudub.
- **Päris AI-ga on kogu töövoog läbi tehtud** (Claude Opus 5.5 Claude Code'i kaudu): idee → 3 täpsustavat küsimust → 4 rolli → 8 lugu → prioriteet → 6 kriteeriumi + mockup → täpsustus → ülevaatus 11 leiuga. Sammude kestus oli umbes 8–27 s, ülevaatus 64 s. Automaattestid kasutavad näidis-AI-d, et need oleksid korratavad ja tasuta.
- **Tagasivõtmine** puudutab backlog'i (lood, kriteeriumid, mockup'id, MVP joon). Vestluse sõnumeid ja ettepanekute olekut see tagasi ei võta: rakendatud ettepanek jääb vestluses „kinnitatuks“, kuigi muudatus ise on tagasi võetud.
- **Mitme kasutaja samaaegset tööd** sama projektiga ei toetata (autentimist pole; samal ajal saab teha ainult ühe vestluspäringu projekti kohta).
- **Mockup'i elemente** saab muuta ainult AI kaudu (täpsustuse või uue ettepanekuga). Käsitsi mockup'i redaktorit pole.
- **Rolli nimi lauses** (olev kääne: „Külastajana“, „Klubi liikmena“) moodustatakse lihtsa reegliga ja võib harvemate sõnade puhul olla vigane.

## Teadaolevad AI piirangud

- **Päris testis täheldatud:** AI soovitas alustada maksmise loost (suurim risk), mitte pakettide vaatest. See on põhjendatud, aga kliendi prioriteet võib olla teine, seega on alati olemas „Valin ise teise“. AI lisas käibemaksu märke juba esimestesse kriteeriumidesse, nii et hilisem sama sisuga täpsustus ei muutnud midagi. Sel juhul ütleb rakendus nüüd, et muuta pole vaja, ja pakub ainult teiste lugude ettepanekuid.
- **Ülevaatus võib anda palju leide** (testis 11), sealhulgas iga kriteeriumideta loo kohta eraldi. Neid saab ükshaaval rakendada või ignoreerida.

- **Kriteeriumid võivad olla liiga üldised või kirjeldada teostust.** Näiteks „Süsteem salvestab andmed andmebaasi“ on kontrollitav, aga ei ole kasutajale nähtav. Reeglipõhine kontroll seda ei tuvasta.
- **Reeglipõhine kontroll on lihtne.** See leiab hinnangulised sõnad loendist ja „mitu tingimust“ sidesõnade ning tegusõnalaadsete sõnade järgi. Valepositiivseid ja -negatiivseid tuleb ette, näiteks „Vormil on nimi- ja e-posti väli“ läbib kontrolli, kuigi seal on kaks elementi. Lõpliku otsuse teeb inimene.
- **Vaate kriteeriumi ja mockup'i kooskõla** kontrollitakse ainult viidete kaudu (`element_ids` peavad olemas olema). Seda, kas elemendi sisu tõesti vastab kriteeriumile, kontrollib inimene.
- **Happy path'i järjekord** sõltub sellest, kuidas AI domeeni mõistab. Harvema valdkonna puhul võib see olla ebaloogiline. Järjekorda saab muuta lohistades.
- **Ülevaatus võib leida probleeme, mida pole**, nagu „liiga suur“ loo puhul, mis loetleb ainult objekte („näha pakette ja hindu“). Samuti võib see jätta sisuliselt kattuvad, aga erinevalt sõnastatud lood leidmata. Seepärast on igal leiul „Ignoreeri“.
- **Vabateksti tõlgendamine** võib mitmeti mõistetava sisendi puhul valida vale tähenduse, näiteks pidada kliendi täpsustust uueks vaateks. Iga tulemus on siiski ettepanek, mille saab tagasi lükata.
- **Kiirus:** iga AI samm võtab olenevalt mudelist ja `AI_EFFORT` seadest mitu kuni mitukümmend sekundit. Vabateksti puhul tehakse kaks päringut (tõlgendus + samm).
- **Keeldumised:** Claude võib väga harva päringule vastamast keelduda. Siis proovib server varumudelit (`AI_FALLBACKS=default`). Kui ka see ei aita, kuvatakse veateade.
