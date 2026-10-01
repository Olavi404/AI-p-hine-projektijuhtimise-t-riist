# AI projektijuht

AI-põhine projektijuhtimise tööriist (grupp TAK25). Rakendus aitab projektijuhil kliendi umbmäärase idee muuta **juhitud vestluse** kaudu kasutajalugude backlog'iks: täpsustavad küsimused valikutega → rollid → lood happy path'i järjekorras → prioriteet → vastuvõtukriteeriumid ja mockup → kliendi täpsustused → groomimine.

**Põhimõte:** AI juhib protsessi, inimene otsustab. Ükski AI ettepanek ei jõua backlog'i ega muuda olemasolevat lugu ilma kasutaja kinnituseta.

## Käivitamine

Eeldused: **Node.js 22.13 või uuem** (kasutatakse sisseehitatud `node:sqlite` moodulit, eraldi andmebaasiserverit pole vaja) ja npm.

```bash
npm install
cp .env.example .env        # Windowsis: copy .env.example .env
```

Ava `.env` ja lisa oma Anthropic API võti:

```
ANTHROPIC_API_KEY=sk-ant-...
```

### Arendusrežiim

```bash
npm run dev
```

Ava brauseris **http://localhost:5173**. Vite arendusserver suunab `/api` päringud API serverile (port `API_PORT`, vaikimisi 3001).

### Toodangurežiim

```bash
npm run build
npm start
```

Ava **http://localhost:3001**: server serveerib nii API-t kui ka ehitatud kasutajaliidest.

### Näidis-AI ilma võtmeta

```bash
npm run dev:mock
```

Käivitab rakenduse etteantud näidisvastustega (spordiklubi näide). Sobib kasutajaliidese proovimiseks ja automaattestideks. Näidisandmed salvestatakse eraldi faili `data/demo.db`. Päris AI vastused tulevad ainult `npm run dev` / `npm start` režiimis koos võtmega.

### Testid

```bash
npm test          # vastuvõtukatse API kaudu (näidis-AI), kvaliteedikontrollid, AI vastuste kontroll
npm run typecheck
```

## Keskkonnamuutujad

| Muutuja | Vaikimisi | Tähendus |
|---|---|---|
| `ANTHROPIC_API_KEY` | – | Claude API võti. Ainult serveris; brauserisse ega repositooriumisse see ei jõua. |
| `AI_PROVIDER` | `anthropic` | `mock` = etteantud näidisvastused |
| `AI_MODEL` | `claude-opus-5-5` | Claude mudel |
| `AI_EFFORT` | `medium` | `low` / `medium` / `high`. Madalam on kiirem. |
| `AI_FALLBACKS` | `default` | Serveripoolne varumudel, kui mudel keeldub vastamast (`off` lülitab välja) |
| `API_PORT` | `3001` | API serveri port |
| `DB_FILE` | `data/app.db` | SQLite andmebaasi fail |

## Funktsioonid

- **Projektid.** Loomine nime ja kirjeldusega ning projektide loend. Kõik (backlog, kriteeriumid, mockup'i versioonid, vestlus, ettepanekud, etapp) salvestatakse SQLite'i ja säilib ka serveri taaskäivitamisel. Projekti uuesti avamisel pakub AI jätkamiseks sobivat sammu.
- **Juhitud vestlus.** Algab ühest vabatekstist. AI esitab 1–3 täpsustavat küsimust valmis vastustega (lisaks „Muu (kirjutan ise)“ ja „Jäta vahele“), pakub rollid, lood happy path'i järjekorras, soovitab põhjendusega, millest alustada, ja pakub kriteeriumid koos mockup'iga. Iga vastuse lõpus on 1–4 järgmise sammu valikut. Sammude riba näitab etappe; etappe saab vahele jätta ja varasemate juurde tagasi minna. Vabateksti tõlgendab AI (vastus, täpsustus, uus vaade, ülevaatus jne).
- **Backlog.** Connextra pealkiri (roll, tegevus ja kasu eraldi), kriteeriumid, staatus (Idee → Vajab täpsustamist → Läbivaadatud → Valmis arenduseks), järjekord (lohistamine või ↑↓), suurus S/M/L, mockup'id, avatud küsimused ja päritolu (AI/käsitsi). MVP joon. Valmisoleku definitsioon (DoR) on kontrollitud nii brauseris kui ka serveris ja rakendus näitab, mis puudu on. Viimase muudatuse saab tagasi võtta (mitu sammu). Käsitsi haldus töötab ka ilma AI-ta.
- **Prototüüpimine.** Mockup on komponentide loend (JSON), mille rakendus ise renderdab. AI HTML-i ega koodi brauseris ei käivitata. Kriteeriumile osutades tõstetakse mockup'is esile vastav element. Uue vaate kirjeldusest luuakse korraga mockup, lugu ja kriteeriumid. Mockup'i varasemad versioonid säilivad ja neid saab taastada.
- **Kliendi täpsustus.** AI koostab muudatusettepaneku (sõnastus, kriteeriumid, mockup) eelvaatega enne → pärast ning valikutega [Rakenda] [Muuda] [Loobu]. Server rakendab muudatuse ainult ettepanekuga seotud loole. Kui täpsustus puudutab ka teisi lugusid, pakutakse nende muutmist eraldi ettepanekutena.
- **Groomimine.** Käsitsi saab muuta sõnastust ja kriteeriume, jagada lugusid (kriteeriumid jaotatakse), ühendada kattuvaid lugusid (eelvaade, kriteeriumid ilma korduseta), muuta järjekorda ja märkida lugu täpsustamist vajavaks koos avatud küsimusega. **AI ülevaatus** leiab liiga suured, kattuvad, mittekontrollitavate või puuduvate kriteeriumidega, mockup'ita ja mitte-Connextra lood. Iga leiu juures on probleem, põhjendus ja konkreetne ettepanek valikutega [Rakenda] [Muuda] [Ignoreeri].
- **Kriteeriumide kontroll.** Reeglipõhine hoiatus hinnanguliste sõnade (kasutajasõbralik, kiire, lihtne, …) ja mitme tingimuse kohta. AI kontrollib oma kriteeriume sama reegli järgi: kui server leiab probleemi, saab AI võimaluse vastust parandada.
- **Lisad.** Eksport Markdowni ja CSV-sse.
- **Kiirklahvid.**

  | Klahv | Tegevus |
  |---|---|
  | `Ctrl+K` | Käsupalett: soovitatud sammud, lood, mockup'id, etapid, eksport |
  | `1`–`4` | Järgmise sammu valik vestluses |
  | `Ctrl+Z` | Viimase muudatuse tagasivõtmine |
  | `/` | Vestluse sisestusväli |
  | `Esc` | Loo detailvaate või käsupaleti sulgemine |

## Arhitektuur

```
client/          React + Vite kasutajaliides
  src/components/  vestlus, kaardid, backlog, loo detailvaade, mockup'i renderdaja
server/
  index.ts       käivitus (.env, port, staatilised failid)
  app.ts         HTTP API (Express 5)
  flow.ts        juhitud vestluse voog: tegevus → AI samm → ettepanek → kinnitus
  backlog.ts     jagamine, ühendamine, DoR-kontrolliga muutmine
  repo.ts        SQLite andmekiht, transaktsioonid, tagasivõtmise hetkeseisud
  ai/
    schemas.ts   AI vastuste JSON-skeemid (zod)
    service.ts   AI sammud, viibad ja sisuline kontroll
    provider.ts  Claude API kutsed, struktureeritud väljund, uuesti proovimine; näidis-AI
    prompts.ts   süsteemiviip ja projekti hetkeseisu kirjeldus
    mock.ts      näidisvastused
shared/          ühised tüübid, kvaliteedikontrollid (kriteeriumid, Connextra, DoR), etappide sammud
tests/           node:test testid
docs/            kasutusstsenaarium, arendustöö backlog, ülevaade
```

**AI vastuste kontroll.** Iga AI samm nõuab Claude'ilt kindla JSON-skeemiga vastust (struktureeritud väljund). Server kontrollib vastust kolmes kihis:

1. kas see on JSON;
2. kas see vastab zod-skeemile;
3. sisulised reeglid: viidatud lood on olemas, mockup'i elementide id-d on unikaalsed, kriteeriumid viitavad olemasolevatele elementidele, jagamisel on vähemalt 2 lugu jne.

Vea korral saadetakse AI-le probleemide loend ja proovitakse uuesti (kuni 3 korda). Kui ka see ei aita, näeb kasutaja arusaadavat veateadet ja nuppu „Proovi uuesti“, mitte katkist vaadet.

**AI arvestab tegeliku seisuga.** Iga AI päringu juurde lisatakse andmebaasist värske backlog'i seis (lood, kriteeriumid, staatused, mockup'id, avatud küsimused ja MVP joon). Seega näeb AI ka käsitsi tehtud muudatusi. Vestluse ajalugu on ainult lisakontekst.

**Turvalisus.** API võti on ainult serveri keskkonnamuutujas (`.env` on `.gitignore`'is). Kõik AI päringud käivad läbi serveri. Mockup'e ei renderdata HTML-ina: React kuvab AI tekstid tekstina, seega skripte ei käivitu. Sisendid kontrollitakse zod-skeemidega. Lugude muutmisel kontrollitakse, et lugu kuulub samasse projekti.

## Dokumendid

- [Kasutusstsenaarium](docs/KASUTUSSTSENAARIUM.md)
- [Oma arendustöö backlog ja järjestuse põhjendus](docs/ARENDUSE_BACKLOG.md)
- [Ülevaade: mis töötab, mis jäi pooleli, AI piirangud](docs/YLEVAADE.md)
- [Demo käik (5–10 min)](docs/DEMO.md)
