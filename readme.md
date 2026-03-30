# Zepp OS Application

Application de développement pour Zepp OS (montres connectées Amazfit/Zepp).

## Prérequis

- Python 3.11+ (géré par uv)
- Node.js et npm
- Zepp CLI (Zeus)

## Installation

### 1. Configuration de l'environnement Python avec uv

L'environnement virtuel est déjà configuré. Pour l'activer :

```bash
source .venv/bin/activate
```

Ou utiliser directement uv :

```bash
uv run python main.py
```

### 2. Installation des dépendances Zepp OS

Installer Zeus CLI (outil de développement Zepp OS) :

```bash
npm install -g @zeppos/zeus-cli
```

Installer les dépendances du projet :

```bash
npm install
```

## Structure du projet

```
zepp-application/
├── app.json              # Configuration de l'application
├── page/                 # Pages de l'application
│   └── index.js         # Page principale
├── app-side/            # Code côté téléphone
│   └── index.js
├── assets/              # Ressources (images, icônes)
├── utils/               # Utilitaires
├── main.py              # Scripts Python pour le développement
├── pyproject.toml       # Configuration Python/uv
└── package.json         # Configuration Node.js
```

## Développement

### Démarrer le mode développement

```bash
npm run dev
```

### Compiler l'application

```bash
npm run build
```

### Prévisualiser sur le simulateur

```bash
npm run preview
```

## Configuration

Modifiez `app.json` pour personnaliser :
- `appId` : Identifiant unique de l'application
- `appName` : Nom de l'application
- `targets` : Appareils cibles (gtr-3, gtr-4, mi-band-7, etc.)

## Ressources

- [Documentation Zepp OS](https://docs.zepp.com/)
- [Zeus CLI](https://github.com/zepp-health/zeppos-zeus-cli)
- [Exemples d'applications](https://github.com/zepp-health/zeppos-samples)