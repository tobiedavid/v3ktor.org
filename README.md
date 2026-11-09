# The Patch · La Patch

Tired, crashing, running on coffee or energy drinks? Three minutes of questions, and The Patch patches what's running low — without taking anything away. Free, private, bilingual (English and French). Made by Tobie, for family first.

- **The page:** https://v3ktor.org/patch/
- **The app:** https://v3ktor.org/patch/app/ (it installs on a phone and works offline)

**Also in this repository:** [Sollum](sollum/) (https://v3ktor.org/sollum/), the pivot, under the same license. v3ktor.org is V3KTOR // Mapping the Self:
- **Corpus** (The Patch): the body.
- **Fulcrum** (Sollum): the pivot.
- **Mentis** (V3KTOR™): the mind.

## What it does
- **The questions** lead to a one-week patch: what to keep, what to swap, what to add on your budget, and the blood test to ask for.
- **Report** is where you note crashes, meals and symptoms, and do a short daily check-in.
- **The plan** is a path:
  - first the basics;
  - then blood work;
  - then your most likely suspect, tested two weeks at a time.
- **History** compares your own days: what comes before the bad ones, the hours before, your tests and your blood results.
- **The glossary:** any underlined word opens an entry that says what the term means, how sure the evidence is, and the sources.

There's no account, no ads and no server. Everything stays in the phone's browser storage, and backups are files you save yourself.

## Not medical advice
The Patch is education, not medical, pharmacist or dietitian advice.
- Chest pain, fainting, or black, tar-like stool: call 911.
- Thinking about ending your life: call or text 9-8-8 (988 in the US).

## How it's built
- **`patch/app/index.html` is the whole app.** The HTML, CSS, JavaScript and food table are in one file. Open it in a browser: there's no build step and nothing to install.
- **`patch/app/`** also holds the web-app manifest, the icons and the offline service worker (`sw.js`).
- **`patch/index.html`** is the website page. `patch/README.txt` explains how to host the folder.
- The repository root only holds GitHub Pages files and redirects for v3ktor.org.

## License
**Copyright (C) 2026 Tobie David.**

The Patch is free software. You can use, study, share and change it under the [GNU Affero General Public License](LICENSE), version 3 or (at your option) any later version. It comes with no warranty.

In plain words: copies and changed versions stay under the same license, with their source code available. That includes a changed version you only run online for other people — that's what the "Affero" part adds.

**Two extra terms**, which section 7 of the AGPL allows (the full wording is in the notice at the top of `patch/app/index.html`):
- Every copy and changed version keeps this line, word for word, in its About screen: "Made by Tobie and Claude. Free version at v3ktor.org/patch." In French: "Faite par Tobie et Claude. Version gratuite sur v3ktor.org/patch."
- A changed version can't be presented as the original The Patch, and it has to say who changed it and when, next to that line: "Changed by [name] on [date]. Not checked by the original authors."

So you can sell a copy, but the app has to say where the free version is — and if you changed it, that you did. That way nobody mistakes your changes for ours.

### Archived and timestamped
- **Software, v1.2.50:** https://doi.org/10.5281/zenodo.24046421
- **Method paper, v1.0:** https://doi.org/10.5281/zenodo.24046691 (also in `docs/`)

Both are timestamped on Bitcoin with OpenTimestamps; see [PROVENANCE.md](PROVENANCE.md). To cite The Patch, use GitHub's "Cite this repository" button (it reads `CITATION.cff`).

### Data and sources
- **Food values:** Canadian Nutrient File, Health Canada, 2015. Contains information licensed under the [Open Government Licence – Canada](https://open.canada.ca/en/open-government-licence-canada). That data stays under its own licence.
- **Missing values** are filled from USDA SR28 (FoodData Central, SR Legacy), which is in the public domain.
- **Daily needs** come from Health Canada's Dietary Reference Intakes tables.
- **Studies and guidelines** are cited in the app's glossary, with links.
- **Third-party code:** none. The app uses the phone's own fonts.

## Contributing
Issues and pull requests are welcome, in English or French. Contributions are accepted under the same license (AGPL-3.0-or-later).

---

## En français
La Patch est une app web bilingue, gratuite et privée. Trois minutes de questions, puis elle patche ce qui manque, sans rien t’enlever. Il n’y a pas de compte : tout reste dans le téléphone.

**Ce n’est pas un avis médical.**
- Douleur à la poitrine, évanouissement ou selles noires comme du goudron : 911.
- Tu penses à mettre fin à tes jours : appelle ou texte le 9-8-8.

**Licence.** C’est un logiciel libre, sous la [licence publique générale GNU Affero](LICENSE), version 3 ou plus récente.
- Tu peux l’utiliser, l’étudier, la partager et la modifier.
- Une version modifiée reste sous la même licence, avec son code source. C’est vrai même si tu la mets seulement en ligne pour d’autres.
- Deux conditions de plus, permises par l’article 7 de l’AGPL. Chaque copie, modifiée ou non, garde mot pour mot dans son écran À propos la ligne « Faite par Tobie et Claude. Version gratuite sur v3ktor.org/patch. » (ou sa version anglaise). Et une version modifiée ne peut pas se faire passer pour La Patch d’origine.
- Tu peux donc vendre une copie, mais l’app doit dire où trouver la version gratuite.

**Archive.** Le logiciel (v1.2.50) et l’article sur la méthode (v1.0) sont archivés sur Zenodo et horodatés sur Bitcoin avec OpenTimestamps. Voir [PROVENANCE.md](PROVENANCE.md).
- Logiciel : https://doi.org/10.5281/zenodo.24046421
- Article : https://doi.org/10.5281/zenodo.24046691

**Données.** Les valeurs des aliments viennent du Fichier canadien sur les éléments nutritifs (Santé Canada, 2015). Cette information est visée par la [Licence du gouvernement ouvert – Canada](https://ouvert.canada.ca/fr/licence-du-gouvernement-ouvert-canada).
