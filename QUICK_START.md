# Guide de Démarrage Rapide

## Lancer l'application en développement

### Commande unique

À la racine du projet, lancez :

```bash
npm start
```

Cette commande démarre automatiquement :
- **Backend** : API Express sur http://localhost:3000
- **Frontend** : Application Angular sur http://localhost:4200

### Où me placer ?

**Racine du projet** : `c:\Users\jonat\OneDrive\Documents\Suivi comptes\suivi-cb`

#### Dans PowerShell

```powershell
cd "c:\Users\jonat\OneDrive\Documents\Suivi comptes\suivi-cb"
npm start
```

#### Dans VS Code

1. Ouvrez un terminal intégré : `Terminal` → `New Terminal` (ou `Ctrl + ù`)
2. Le terminal s'ouvre automatiquement à la racine du projet
3. Lancez simplement :
   ```bash
   npm start
   ```

### Accéder à l'application

Une fois les serveurs démarrés :
- **Application web** : http://localhost:4200
- **API backend** : http://localhost:3000

Le frontend utilise automatiquement un proxy pour communiquer avec le backend.

---

## Autres commandes utiles

### Lancer uniquement le backend

```bash
npm run start:backend
```

### Lancer uniquement le frontend

```bash
npm run start:frontend
```

### Lancer les tests

Voir [QUICK_START_TESTS.md](./QUICK_START_TESTS.md) pour plus de détails.

```bash
# Tous les tests
npm test

# Tests en mode watch
npm run test:watch

# Tests avec couverture
npm run test:coverage
```

---

## Arrêter l'application

Dans le terminal où l'application est lancée, appuyez sur `Ctrl + C`

---

## Structure des commandes

Toutes les commandes principales sont disponibles à la racine du projet dans le fichier [package.json](./package.json) :

| Commande | Description |
|----------|-------------|
| `npm start` | Démarre backend + frontend |
| `npm run start:backend` | Démarre uniquement le backend |
| `npm run start:frontend` | Démarre uniquement le frontend |
| `npm test` | Lance tous les tests |
| `npm run test:watch` | Lance les tests en mode watch |
| `npm run test:coverage` | Lance les tests avec rapport de couverture |

---

## Prêt à développer !

Vous pouvez maintenant :
1. Ouvrir http://localhost:4200 dans votre navigateur
2. Modifier le code
3. Les changements sont automatiquement rechargés (hot reload)
