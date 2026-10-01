# Oma arendustöö backlog

Rakenduse enda arendustöö on siin jagatud kasutajalugudeks. Peamine roll on **projektijuht** (rakenduse kasutaja). Abirollid on **õpetaja/hindaja** ja **arendaja**.

## Järjestuse põhjendus

1. **Kõigepealt terviklik õhuke töövoog.** Lood A1–A7 annavad lihtsal kujul läbiva tee: projekt → juhitud vestlus pakub lood → lugu backlog'is → mockup ja kriteeriumid → kliendi täpsustus → uuendatud lugu ja mockup. Nii sai iga kiht (andmebaas, AI kiht, vestlus, kasutajaliides) varakult paika ja hilisemad lood ainult täiendavad olemasolevat.
2. **Andmete püsivus ja AI vastuste kontroll on kohe MVP-s.** Ilma nendeta pole töövoog usaldusväärne: katkine AI vastus või serveri taaskäivitus ei tohi tööd hävitada.
3. **Inimese kontroll enne mugavust.** Eelvaated, ainult seotud loo muutmine ja tagasivõtmine (A6, A8) on tähtsamad kui groomimine, sest need kannavad põhimõtet „AI juhib, inimene otsustab“.
4. **Seejärel groomimine ja DoR** (B1–B5), mis eeldavad, et backlog'is on juba sisu.
5. **Viimasena lisad** (C1–C4), mis pole vastuvõtukatseks kohustuslikud.

Suurus: S ≈ pool päeva, M ≈ 1 päev, L ≈ 2 päeva.

---

## MVP (terviklik töövoog)

### A1. Projekti loomine ja püsiv salvestus · M · ✅ valmis
Projektijuhina soovin luua projekti nime ja kirjeldusega ning näha oma projektide loendit, et iga kliendi töö oleks eraldi ja sama koha pealt jätkatav.
- Projekti saab luua nime ja lühikirjeldusega.
- Avalehel on projektide loend koos etapi ja lugude arvuga.
- Pärast serveri taaskäivitust on projektid, lood, mockup'id ja vestlus alles.
- Projekti uuesti avamisel kuvatakse etapp, kus töö pooleli jäi, ja järgmise sammu nupud.

### A2. Vestlus algab ühest vabatekstist ja täpsustavatest küsimustest · M · ✅ valmis
Projektijuhina soovin sisestada kliendi idee ühe lausena ja vastata täpsustavatele küsimustele nuppudega, et ma ei peaks oskama kasutajalugusid kirjutada.
- Pärast idee sisestamist esitab AI vähemalt ühe täpsustava küsimuse.
- Igal küsimusel on vähemalt kaks vastusevarianti nuppudena.
- Igal küsimusel on nupud „Muu (kirjutan ise)“ ja „Jäta vahele“.
- Vabatekst ootel küsimuse ajal salvestatakse selle küsimuse vastuseks.

### A3. Rollid ja lood happy path'i järjekorras · M · ✅ valmis
Projektijuhina soovin näha AI pakutud rolle ja lugusid põhitöövoo järjekorras, et valida klõpsudega, mis backlog'i lähevad.
- Rollide kaardil saab rolle valida, eemaldada ja lisada.
- AI pakub vähemalt viis lugu Connextra vormis.
- Igal pakutud lool on märkeruut.
- Nupud „Lisa kõik“, „Lisa valitud“ ja „Paku teistsuguseid“ on olemas.
- Enne kinnitamist ei lisata backlog'i ühtegi lugu.

### A4. Prioriteedi soovitus ja järjekord · S · ✅ valmis
Projektijuhina soovin näha AI soovitust, millisest loost alustada, ja muuta lugude järjekorda, et klient saaks otsustada, mis on kõige olulisem.
- AI soovitus sisaldab loo tunnust ja põhjendust.
- Nupud „Nõus, alustame sellest“ ja „Valin ise teise“ on olemas.
- Lugude järjekorda saab muuta lohistades.
- Lugude järjekorda saab muuta ↑/↓ nuppudega.

### A5. Kriteeriumid ja mockup valitud loole · L · ✅ valmis
Projektijuhina soovin saada valitud loole vastuvõtukriteeriumid ja mockup'i, et klient saaks vaate visuaalselt üle kontrollida.
- AI pakub vähemalt kolm kriteeriumi ja mockup'i.
- Iga kriteeriumi juures on nupud „Nõus“, „Muuda“ ja „Eemalda“.
- Mockup kuvatakse komponentide loendist ega käivita AI loodud koodi.
- Kriteeriumile osutades tõstetakse mockup'is esile seotud element.

### A6. Kliendi täpsustus eelvaatega · L · ✅ valmis
Projektijuhina soovin sisestada kliendi täpsustuse ja näha muudatust enne rakendamist, et ükski muudatus ei toimuks ilma kinnituseta.
- Eelvaade näitab loo sõnastust, kriteeriume ja mockup'i kujul enne → pärast.
- Nupud „Rakenda“, „Muuda“ ja „Loobu“ on olemas.
- Server muudab ainult ettepanekuga seotud lugu.
- Teisi lugusid puudutav mõju kuvatakse eraldi ettepanekuna.
- Mockup'i eelmine versioon jääb alles ja on taastatav.

### A7. AI vastuste kontroll serveris · M · ✅ valmis
Arendajana soovin, et server kontrolliks iga AI vastuse struktuuri, et vigane vastus ei tekitaks katkist vaadet.
- AI vastus valideeritakse JSON-skeemiga enne kasutajale näitamist.
- Vigase vastuse korral proovitakse uuesti kuni 3 korda.
- Lõpliku vea korral kuvatakse arusaadav teade koos nupuga „Proovi uuesti“.
- API võti loetakse ainult keskkonnamuutujast.

### A8. Viimase muudatuse tagasivõtmine · S · ✅ valmis
Projektijuhina soovin viimase backlog'i muudatuse tagasi võtta, et eksliku otsuse saaks kohe parandada.
- Päises on nupp „Võta tagasi“ koos viimase muudatuse nimega.
- Tagasivõtmine taastab lood, kriteeriumid, mockup'id ja MVP joone muudatuse-eelsesse seisu.
- Tagasi saab võtta mitu järjestikust muudatust.

**═══════════ MVP joon ═══════════**

## Groomimine ja kvaliteet

### B1. Backlog'i käsitsi haldus · M · ✅ valmis
Projektijuhina soovin lugusid käsitsi lisada, muuta ja kustutada, et backlog oleks kasutatav ka siis, kui AI teenus pole kättesaadav.
- Lugu saab lisada Connextra vormi kolme väljaga.
- Loo detailvaates saab muuta rolli, tegevust, kasu, suurust ja kriteeriume.
- Lugu saab kustutada pärast kinnitust.
- Käsitsi haldus töötab ka siis, kui `ANTHROPIC_API_KEY` puudub.

### B2. Valmisoleku definitsioon · S · ✅ valmis
Projektijuhina soovin, et staatust „Valmis arenduseks“ saaks anda ainult nõuetele vastavale loole, et arendusse ei jõuaks pooleli lood.
- Loo detailvaates on DoR-i kontrollnimekiri.
- Avatud küsimusega lool ei saa staatust „Valmis arenduseks“ määrata.
- Server keeldub nõuetele mittevastava loo staatuse muutmisest ja tagastab puuduste loetelu.

### B3. Kriteeriumide kontrollitavuse hoiatus · S · ✅ valmis
Projektijuhina soovin näha hoiatust mittekontrollitava kriteeriumi juures, et iga kriteerium oleks jah/ei vastusega kontrollitav.
- Hinnangulise sõna (nt „kasutajasõbralik“) korral kuvatakse hoiatus.
- Mitut tingimust ühendava kriteeriumi korral kuvatakse hoiatus.
- AI pakutud mittekontrollitava kriteeriumi korral palub server AI-l see ümber sõnastada.

### B4. Jagamine ja ühendamine käsitsi · M · ✅ valmis
Projektijuhina soovin jagada liiga suure loo ja ühendada kattuvad lood, et backlog oleks ühtlase detailsusega.
- Jagamisel saab iga kriteeriumi määrata ühele uuele loole.
- Ühendamise eelvaates on kriteeriumid ilma korduseta.
- Uued lood tekivad algse loo kohale backlog'is.

### B5. AI ülevaatus · L · ✅ valmis
Projektijuhina soovin käivitada AI ülevaatuse, et leida liiga suured, kattuvad, mittekontrollitavad ja mockup'ita lood.
- Iga leiu juures on probleem, põhjendus ja ettepanek.
- Iga leiu juures on nupud „Rakenda“, „Muuda“ ja „Ignoreeri“.
- Jagamise ettepanekus on uued lood koos jaotatud kriteeriumidega.
- Ühendamise ettepanekus on ühendatud lugu koos kordusteta kriteeriumidega.

### B6. MVP joon · S · ✅ valmis
Projektijuhina soovin backlog'is märkida MVP joone, et oleks näha, mis kuulub esimesse versiooni.
- MVP joone saab määrata mis tahes loo alla.
- Joont saab liigutada üles ja alla.
- MVP joon on näha ka Markdowni ekspordis.

### B7. Uus vaade promptist · M · ✅ valmis
Projektijuhina soovin kirjeldada uut vaadet ühe lausega, et saada korraga mockup, loo pealkiri ja kriteeriumid.
- Prototüübi vaates on uue vaate kirjelduse väli.
- Ettepanek sisaldab Connextra pealkirja, kriteeriume ja mockup'i.
- Lugu lisatakse backlog'i alles nupu „Lisa backlog'i“ vajutamise järel.

## Lisad

### C1. Eksport · S · ✅ valmis
Projektijuhina soovin eksportida backlog'i Markdowni ja CSV-sse, et saata see arendusmeeskonnale.
- Markdowni failis on iga loo pealkiri, staatus ja kriteeriumid märkeruutudena.
- CSV fail avaneb Excelis täpitähtedega korrektselt.
- Ekspordis on lood backlog'i järjekorras.

### C2. Kriteeriumi ja mockup'i elemendi seos · S · ✅ valmis
Projektijuhina soovin kriteeriumile osutades näha vastavat mockup'i elementi, et kliendiga oleks lihtne kooskõla üle vaadata.
- Kriteeriumile osutades tõstetakse mockup'is esile seotud element.
- Kriteeriumi juures on näidatud seotud elementide tunnused.
- Server keeldub AI vastusest, kus kriteerium viitab olematule elemendile.

### C3. Kliendile jagatav vaatamislink · M · ⏳ tegemata
Kliendina soovin avada backlog'i ja mockup'id lingi kaudu, et vaadata neid ka pärast kohtumist.
- Projektil on nupp, mis loob vaatamislingi.
- Lingi kaudu avatud vaates pole muutmisnuppe.
- Lingi saab tühistada.

### C4. Mitme rolli story map · L · ⏳ tegemata
Projektijuhina soovin näha iga rolli happy path'i eraldi reana, et mitme rolliga projekti töövood oleksid ülevaatlikud.
- Iga rolli lood kuvatakse eraldi real.
- Lood on reas happy path'i järjekorras.
- Lugu saab lohistada ühelt kohalt teisele.

---

*Soovitus:* nüüd, kui tööriist on kasutatav, saab C3 ja C4 lisada tööriista enda projekti „KickOff AI“ ja lasta AI-l neile kriteeriumid ning mockup'i pakkuda.
