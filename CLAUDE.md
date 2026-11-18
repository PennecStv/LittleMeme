@AGENTS.md

## Règles du projet

- Commits à mon nom uniquement : jamais de ligne `Co-Authored-By` Claude, ni de mention « Generated with Claude Code » dans les PR.
- Travail sur une branche, puis PR vers `main`.
- Textes de l'app en français, sans emojis (seuls les symboles d'interface ✕ et ✎ sont acceptés).
- Design : Montserrat pour l'interface, Anton uniquement pour le texte des memes, style « stipple » (dégradés et ombres en points, `src/components/Stipple.tsx`).
- Couleurs : toujours passer par `colors` et `themed()` de `src/components/theme.ts`, jamais de `StyleSheet.create` direct (sinon le changement de thème ne s'applique pas).

## Vérifications avant de dire qu'une tâche est finie

```bash
npx tsc --noEmit
npx eslint src scripts     # `npx expo lint` échoue sur la version d'ESLint, utiliser eslint directement
npm run simulate           # partie complète simulée en TCP (hôte + bots)
```

## Pièges connus sous Windows

- Le build Android échoue si le chemin du projet est trop long (limite de 260 caractères, `react-native-worklets`). Compiler depuis une copie à chemin court, par ex. `C:\lm` (copier aussi les dossiers `build` de `node_modules`), avec `JAVA_HOME` = le JDK d'Android Studio (`C:\Program Files\Android\Android Studio\jbr`).
- Metro : ne pas le lancer avec `CI=1` (le rechargement automatique est désactivé). Si le port 8081 reste occupé, tuer le processus qui l'écoute.
- `gh` peut ne pas être dans le PATH d'un terminal ouvert avant son installation : `"C:\Program Files\GitHub CLI\gh.exe"`.
