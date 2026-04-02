# Boat Dashboard (Zepp OS)

Cette application Zepp OS tourne sur montre Amazfit/Zepp et elle affiche des donnees bateau depuis un serveur Signal K.
L'application affiche la vitesse bateau, le vent reel et le vent apparent sur trois ecrans dedies.

## Documentation

Le document [`docs/architecture.md`](docs/architecture.md) decrit l'architecture, le flux de donnees et les choix de conception.

## Prerequis

Le poste de developpement doit fournir Node.js, npm et Zeus CLI.

La commande suivante installe Zeus CLI et les dependances du projet:

```bash
npm install -g @zeppos/zeus-cli
npm install
```

## Commandes utiles

Les commandes suivantes couvrent les actions de developpement les plus frequentes:

```bash
zeus dev      # mode developpement
zeus preview  # previsualisation sur simulateur/appareil
zeus build    # build de production (sortie dist/)
zeus bridge   # bridge debug vers app/simulateur
```

## Structure du projet

```text
zepp-application/
├── app.js
├── app-side/index.js
├── app.json
├── assets/
├── docs/architecture.md
├── page/
│   ├── gt/home/index.page.js
│   ├── gt/home/index.page.r.layout.js
│   ├── gt/home/index.page.s.layout.js
│   └── i18n/
└── utils/
    ├── config.js
    ├── settings.js
    └── signal-k.js
```

## Configuration rapide

1. Le fichier `utils/config.js` definit l'URL Signal K par defaut via `SIGNALK.BASE_URL`.
2. Le fichier `app.json` definit la configuration applicative, les cibles et les permissions.
3. Le panneau `Admin` permet de modifier la frequence de rafraichissement et l'URL Signal K depuis la montre.

## Ressources

La [documentation Zepp OS](https://docs.zepp.com/) explique les API runtime et le cycle de vie Zepp.
Le projet [Zeus CLI](https://github.com/zepp-health/zeppos-zeus-cli) detaille les commandes de build et de preview.
Le site [Signal K](https://signalk.org/) decrit le standard de donnees navigation utilise par l'application.
