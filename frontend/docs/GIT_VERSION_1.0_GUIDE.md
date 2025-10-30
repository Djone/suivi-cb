# Guide Git - Sauvegarder la version 1.0 de votre application

## Situation actuelle
Votre application "Suivi CB" est complète et fonctionnelle avec :
- ✅ Gestion des comptes et catégories
- ✅ Transactions avec récurrence
- ✅ Dashboard avec échéances
- ✅ Page de statistiques avec graphiques
- ✅ Interface moderne avec PrimeNG
- ✅ Version 1.0.0 dans `package.json`

## Étapes pour sauvegarder dans Git avec Visual Studio Code

### 1️⃣ **Vérifier le .gitignore**
Le fichier `.gitignore` a été créé pour exclure:
- `node_modules/` (dossiers de dépendances)
- `*.db` (base de données)
- `dist/` (fichiers compilés)
- `.angular/` (cache Angular)

### 2️⃣ **Dans Visual Studio Code**

#### Option A: Interface graphique (Recommandé pour débutants)

1. **Ouvrir le panneau Source Control**:
   - Cliquez sur l'icône Git dans la barre latérale gauche (3ème icône)
   - Ou `Ctrl+Shift+G`

2. **Staged Changes (Zone de préparation)**:
   - Vous verrez une liste de fichiers modifiés
   - **NE PAS** ajouter les fichiers dans `node_modules/`
   - Cliquez sur le `+` à côté de chaque fichier important:
     - `backend/` (tous les fichiers sauf `database.db`)
     - `frontend/src/` (tous les fichiers de code source)
     - `package.json`
     - `.gitignore`
     - `.gitattributes`
     - Fichiers README ou de documentation

3. **Créer le commit**:
   - En haut du panneau Source Control, il y a un champ "Message"
   - Tapez le message de commit:
     ```
     Release v1.0.0 - Application complète

     Fonctionnalités:
     - Gestion complète des transactions et comptes
     - Transactions récurrentes avec échéances
     - Dashboard avec solde actuel et prévisionnel
     - Statistiques avec graphiques Chart.js
     - Interface moderne avec PrimeNG et layout responsive
     ```

   - Cliquez sur le bouton ✓ (Commit) ou `Ctrl+Enter`

4. **Créer un Tag pour la version 1.0**:
   - Ouvrez le Terminal intégré (`Ctrl+ù` ou menu Terminal > Nouveau Terminal)
   - Tapez:
     ```bash
     git tag -a v1.0.0 -m "Version 1.0.0 - Release initiale"
     ```

#### Option B: Ligne de commande (Pour utilisateurs avancés)

```bash
# 1. Ajouter seulement les fichiers source (pas node_modules)
git add .gitignore .gitattributes package.json
git add backend/ --force
git add frontend/src/ frontend/angular.json frontend/package.json
git add README.md

# 2. Créer le commit
git commit -m "Release v1.0.0 - Application complète

Fonctionnalités:
- Gestion complète des transactions et comptes
- Transactions récurrentes avec échéances
- Dashboard avec solde actuel et prévisionnel
- Statistiques avec graphiques Chart.js
- Interface moderne avec PrimeNG et layout responsive

🤖 Generated with Claude Code

Co-Authored-By: Claude <noreply@anthropic.com>"

# 3. Créer un tag pour la version
git tag -a v1.0.0 -m "Version 1.0.0 - Release initiale"

# 4. Voir l'historique
git log --oneline --graph
```

### 3️⃣ **Pousser vers un dépôt distant (GitHub/GitLab) - OPTIONNEL**

Si vous voulez sauvegarder sur GitHub:

1. **Créer un dépôt sur GitHub**:
   - Allez sur https://github.com/new
   - Nom: `suivi-cb`
   - Description: `Application de suivi de comptes bancaires`
   - Laissez vide (ne pas initialiser avec README)
   - Cliquez sur "Create repository"

2. **Connecter votre dépôt local**:
   ```bash
   git remote add origin https://github.com/VOTRE_USERNAME/suivi-cb.git
   git branch -M master
   git push -u origin master
   git push origin v1.0.0
   ```

## Gestion des versions futures

### Incrémentation des versions (Semantic Versioning)

Le format est: `MAJOR.MINOR.PATCH` (ex: 1.2.3)

- **MAJOR (1.x.x)**: Changements incompatibles avec les versions précédentes
- **MINOR (x.1.x)**: Nouvelles fonctionnalités compatibles
- **PATCH (x.x.1)**: Corrections de bugs

### Exemple pour une version 1.1.0 (nouvelle fonctionnalité)

1. **Modifier le numéro de version**:
   - Dans `package.json`: changez `"version": "1.0.0"` en `"version": "1.1.0"`
   - Dans `backend/package.json`: idem
   - Dans `frontend/package.json`: idem

2. **Commiter les changements**:
   ```bash
   git add .
   git commit -m "feat: Ajout de la fonctionnalité X

   Description de la nouvelle fonctionnalité...
   "
   ```

3. **Créer un tag**:
   ```bash
   git tag -a v1.1.0 -m "Version 1.1.0 - Nouvelle fonctionnalité X"
   ```

4. **Pousser**:
   ```bash
   git push origin master
   git push origin v1.1.0
   ```

## Types de commits conventionnels

Pour un historique propre, utilisez ces préfixes:

- `feat:` Nouvelle fonctionnalité
- `fix:` Correction de bug
- `docs:` Documentation
- `style:` Formatage, points-virgules manquants, etc.
- `refactor:` Refactorisation de code
- `test:` Ajout de tests
- `chore:` Maintenance (mise à jour dépendances, etc.)

Exemples:
```bash
git commit -m "feat: Ajout de l'export PDF des statistiques"
git commit -m "fix: Correction du calcul du solde prévisionnel"
git commit -m "docs: Mise à jour du README avec instructions d'installation"
```

## Voir l'historique des versions

```bash
# Liste des tags
git tag

# Détails d'un tag
git show v1.0.0

# Revenir à une version précédente (lecture seule)
git checkout v1.0.0

# Revenir à la dernière version
git checkout master
```

## Branches pour développement

Pour travailler sur de nouvelles fonctionnalités sans affecter la version stable:

```bash
# Créer une branche pour une nouvelle fonctionnalité
git checkout -b feature/export-pdf

# ... faire vos modifications ...

# Commiter sur cette branche
git add .
git commit -m "feat: Développement de l'export PDF"

# Revenir sur master
git checkout master

# Fusionner la fonctionnalité
git merge feature/export-pdf

# Supprimer la branche
git branch -d feature/export-pdf
```

## Résumé des commandes essentielles

| Commande | Description |
|----------|-------------|
| `git status` | Voir les fichiers modifiés |
| `git add <fichier>` | Ajouter un fichier au commit |
| `git add .` | Ajouter tous les fichiers |
| `git commit -m "message"` | Créer un commit |
| `git log` | Voir l'historique |
| `git tag` | Lister les versions |
| `git tag -a v1.0.0 -m "msg"` | Créer une version |
| `git push` | Envoyer vers le serveur |
| `git pull` | Récupérer du serveur |
| `git checkout <branch>` | Changer de branche |

---

**Félicitations! Votre version 1.0 est maintenant sauvegardée! 🎉**
