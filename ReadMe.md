# Kotoba — Simple Nihongo Glossary

Dues aplicacions independents, que comparteixen els JSON del glossari:

- **Editor local:** interfície web i servidor Node.js per crear, editar i eliminar
  entrades directament als fitxers.
- **Estudi:** aplicació Vue estàtica de només lectura, amb consulta del glossari
  i targetes. Incorpora els JSON en compilar-se; no utilitza l'API ni necessita
  que l'editor o el servidor Node.js estiguin en marxa.

## Inici

Cal Node.js 22.12 o posterior per desenvolupar i compilar.

```sh
npm install
```

### Editor local

```sh
npm start
```

Obre <http://127.0.0.1:3000>. El servidor només escolta a la interfície local.
Es pot canviar el port amb la variable d'entorn `PORT`. `npm run dev:editor`
reinicia el servidor quan canvia el seu codi.

### Estudi: desenvolupament

```sh
npm run dev:study
```

Obre <http://127.0.0.1:5173>. Vite serveix l'aplicació Vue durant el
desenvolupament, sense backend ni proxy d'API.

### Estudi: publicació estàtica

```sh
npm run build:study
```

Publica **només el contingut de `dist/study`** en qualsevol allotjament estàtic.
No hi ha cap servidor d'aplicació, base de dades o servei extern a desplegar.
Les rutes dels recursos són relatives, de manera que també funciona en una
subcarpeta. Cal servir-la per HTTP(S), no obrir l'HTML directament amb `file://`.

Per comprovar localment la versió compilada:

```sh
npm run preview:study
```

Obre <http://127.0.0.1:4173>. Aquest servidor només serveix fitxers estàtics;
no és el servidor de l'editor. `npm run build` equival a `npm run build:study`.

**Actualitzar el glossari publicat:** edita els JSON amb l'editor, torna a
compilar l'aplicació d'estudi i publica de nou `dist/study`. Una publicació
existent no rep canvis de l'editor en temps real.

## Estructura del projecte

- [src/server.js](src/server.js): servidor HTTP i API, exclusius de l'editor.
- [src/editor](src/editor): interfície d'edició local (HTML i JavaScript).
- [src/study](src/study): aplicació Vue independent, amb components i lògica d'estudi.
- [src/shared](src/shared): estils i icona compartits entre les dues interfícies.
- [src/data](src/data): configuració i entrades del glossari.
- [test](test): proves d'API i de la lògica d'estudi.
- [vite.study.config.mjs](vite.study.config.mjs): compilació i desenvolupament de l'estudi.

La configuració del projecte i la documentació es mantenen a l'arrel.

## Editor del glossari

- La llista mostra sempre totes les formes disponibles: romaji, hiragana,
  katakana i totes les variants de kanji, sense selector. S'ometen les formes buides.
- Cerca per romaji, hiragana, katakana, kanji, significats i notes.
- Filtra per categoria (incloent-hi les subcategories), tipus de paraula i etiqueta.
- Crea, edita i elimina entrades. L'editor inclou tots els camps, múltiples
  significats i exemples. L'eliminació demana confirmació.
- Els canvis s'escriuen directament als JSON amb substitució atòmica del fitxer.
  És recomanable versionar les dades amb Git per poder recuperar edicions.

### Fitxers de dades

La configuració es llegeix de [src/data](src/data):

- `categories,json` (nom existent); també s'accepta `categories.json`, amb prioritat.
- `tags.json`.
- `partsOfSpeech.json`.

Les entrades es llegeixen de tots els fitxers `.json` de
[src/data/glossary](src/data/glossary). S'accepten tant llistes com un objecte únic.
L'edició conserva el fitxer original, encara que canviïn les categories. Una
entrada nova es desa al fitxer de la primera categoria seleccionada (segons
l'ordre de la configuració), creant-lo si cal. Si el fitxer contenia un sol
objecte, es transforma en llista quan s'hi afegeix una segona entrada.
Els identificadors es generen automàticament i no canvien en editar.

Per afegir categories, etiquetes o tipus de paraula, edita la configuració JSON
i recarrega la pàgina. No es modifiquen aquests catàlegs des de l'editor.

## Aplicació d'estudi Vue

Selecciona tot el glossari o una categoria i la direcció japonès → català o
català → japonès. Les targetes es barregen; revela la resposta i indica si la
recordaves. Al final veuràs el resultat i podràs repassar només els errors.

El selector **Forma japonesa** permet triar **Kanji** (per defecte),
**Hiragana** o **Katakana**. La mateixa selecció s'aplica a les paraules de
la consulta, al títol dels detalls i a la part japonesa de les targetes en
ambdues direccions. Es pot canviar durant una sessió sense perdre'n el progrés.
Els detalls de la resposta conserven les lectures i els exemples originals.

Si una entrada no té la forma seleccionada, es mostra una altra forma disponible
(prioritat: kanji, hiragana, katakana i finalment romaji) amb un avís que indica
la forma absent i l'alternativa utilitzada. No s'exclou cap entrada ni es generen
transliteracions. La selecció es comparteix entre les vistes fins a recarregar
la pàgina; no modifica els JSON.

Dreceres: `/` per cercar; a les targetes, `Espai` per revelar, `1` per indicar
que no la recordaves i `2` si la sabies (fora de camps i botons amb focus).

També pots consultar el glossari, cercar-hi, filtrar-lo per categories, tipus
i etiquetes, i llegir tots els significats, exemples i notes. No hi ha formularis
d'edició ni peticions d'escriptura. Les dades s'importen des de tots els JSON de
la carpeta `glossary`, tant si contenen llistes com una entrada única.

El recompte de paraules practicades es desa al `localStorage` del navegador;
no representa domini de la paraula ni modifica els JSON. La sessió activa
no es conserva en recarregar. Les dades del glossari provenen exclusivament
de la versió incorporada a l'aplicació.

## Validació

```sh
npm test
npm run build:study
```

Les proves d'integració utilitzen còpies temporals de les dades: no modifiquen
el glossari real. Comproven lectura, validació, persistència de l'edició,
creació, eliminació, concurrència, separació de les aplicacions i rebuig de
peticions d'escriptura d'altres orígens. Les proves d'estudi comproven la
càrrega de dades, cerca, filtres, direccions, puntuació i repàs dels errors.

L'editor està pensat per a ús personal local, no per publicar el servidor a
Internet ni per a edició simultània entre diversos usuaris. L'aplicació
d'estudi, en canvi, es pot publicar de manera estàtica i independent.