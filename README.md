# Little Meme

Un jeu de memes entre potes, inspiré de *Make It Meme*, **sans pub et sans compte**.
Tout se passe sur le réseau local : un téléphone héberge la partie, les autres le rejoignent avec un code.

## Fonctionnalités

- **Salle privée** : l'hôte crée une partie et obtient un code de 4 caractères (ex. `22BC`) + un QR code. Les autres le tapent ou le scannent.
- **Manches** : chaque joueur reçoit un meme différent et a un temps limité pour écrire le texte (aperçu en direct, possibilité de changer de meme).
- **Présentation** : les memes de tout le monde sont révélés un par un.
- **Votes (optionnels)** : anonymes, on ne peut pas voter pour soi, classement à la fin.
- **Paramètres** : nombre de manches, temps d'écriture, temps de présentation, votes on/off, temps de vote, temps de récap entre les manches, nombre de changements de meme.
- **Récap de fin** : toutes les manches, et un bouton « Garder » pour sauvegarder un meme (favoris de l'app + galerie photo).
- **Packs perso** : crée tes packs avec tes propres images (la tête de ton pote…), choisis où va le texte. L'hôte choisit les packs actifs ; les images sont envoyées automatiquement aux autres joueurs.
- **Reconnexion** automatique si un joueur perd le Wifi quelques secondes.

## Comment ça marche (réseau)

```
 Téléphone hôte                              Téléphones des potes
┌──────────────────────────────┐            ┌──────────────────┐
│ UI ── transport local ──┐    │            │ UI ── GameClient │
│                         ▼    │   TCP      │         │        │
│     GameEngine ◄── HostServer│◄───────────┼─────────┘        │
│   (règles, timers, votes)    │ port 47777 └──────────────────┘
└──────────────────────────────┘   (JSON, un message par ligne)
```

- L'**hôte fait autorité** : timers, tirage des memes, votes, scores. Les clients ne font qu'afficher la « vue » qu'il leur envoie.
- Le **code de salle** est simplement l'IP de l'hôte encodée (`src/shared/roomCode.ts`) : pas besoin de serveur central.
- Les **images** des packs perso sont envoyées à la demande puis mises en cache.
- Tous les téléphones doivent être sur le même Wifi. Pas de Wifi ? L'hôte active son **partage de connexion** et les autres s'y connectent.

## Lancer le projet

Prérequis : Node 20+.

```bash
npm install
npm run simulate     # simule une partie complète (hôte + 3 bots en TCP), sans téléphone
npm run typecheck
npx eslint src scripts
```

L'app utilise un module natif (sockets TCP), elle **ne marche donc pas dans Expo Go** : il faut un *development build*.

### Android (depuis Windows)

Le plus simple, c'est de compiler dans le cloud avec EAS (gratuit, il faut un compte Expo) :

```bash
npx eas-cli@latest login
npx eas-cli@latest build --profile development --platform android   # APK de dev (avec rechargement à chaud)
npm start                                                            # puis ouvre l'APK installé
```

Pour jouer entre potes sans PC allumé, compile plutôt une version autonome et partage l'APK :

```bash
npx eas-cli@latest build --profile preview --platform android
```

Autre option : en local avec Android Studio, `npm run android`.

### iOS

Il faut soit un Mac avec Xcode (`npm run ios`), soit EAS Build avec un compte Apple Developer (payant) pour installer l'app sur de vrais iPhone.

## Structure

```
src/
  app/            écrans (Expo Router) : accueil, rejoindre, partie, packs, favoris
  components/     UI, rendu des memes (MemeView), écrans de chaque phase (game/)
  engine/         GameEngine : toute la logique de jeu, sans dépendance réseau ni UI
  net/            HostServer, GameClient, transport TCP (même code sous Node et sur téléphone)
  session/        relie le réseau à l'app (héberger / rejoindre / quitter)
  shared/         types et protocole, découpage des messages, codes de salle
  storage/        profil, packs perso, favoris (fichiers locaux)
  data/           pack intégré (templates dessinés avec des emojis)
scripts/
  simulate.ts     test de bout en bout d'une partie
```

## Limites connues / idées pour la suite

- L'hôte doit garder l'app ouverte au premier plan (iOS coupe les connexions en arrière-plan). L'écran reste allumé pendant la partie.
- Les packs sont lus au moment de créer la partie : si tu modifies un pack, recrée la salle.
- Le pack intégré est volontairement simple (emojis) : rien n'est sous droits d'auteur. Ajoute tes vraies images de memes via « Mes packs ».
- Idées : partager un pack avec un pote (export/import), placer librement les zones de texte, découverte automatique des parties sur le réseau, avatars.
