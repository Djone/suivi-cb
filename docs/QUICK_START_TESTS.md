# 🚀 Guide Rapide - Démarrer les Tests

## ⚡ Installation Express (3 minutes)

### Option 1 : Script automatique (Windows)
```bash
setup-tests.bat
```

### Option 2 : Installation manuelle

```bash
# 1. Backend
cd backend
npm install jest@^29.7.0 @types/jest@^29.5.11 --save-dev

# 2. Retour à la racine
cd ..
```

---

## ✅ Vérification de l'installation

```bash
# Vérifier Jest (backend)
cd backend
npx jest --version

# Vérifier Karma (frontend)
cd ../frontend
npx karma --version
```

Vous devriez voir :
- Jest : `29.7.0` ou supérieur
- Karma : `6.4.0` ou supérieur

---

## 🧪 Lancer les tests

### 1️⃣ Tous les tests (recommandé pour la première fois)

```bash
# À la racine du projet
npm test
```

**Temps estimé** : 30 secondes - 1 minute

**Ce qui est testé** :
- ✅ 3 modèles backend (Transaction, Category, SubCategory)
- ✅ 3 contrôleurs backend
- ✅ 1 schéma de validation
- ✅ 1 service frontend (Transaction)
- ✅ 1 composant frontend (TransactionForm)

---

### 2️⃣ Tests backend uniquement

```bash
npm run test:backend
```

**Sortie attendue** :
```
PASS  tests/models/transaction.model.test.js
PASS  tests/controllers/transaction.controller.test.js
PASS  tests/schemas/subcategory.schema.test.js

Test Suites: 3 passed, 3 total
Tests:       X passed, X total
```

---

### 3️⃣ Tests frontend uniquement

```bash
npm run test:frontend
```

**Sortie attendue** :
```
Chrome Headless 120.0.0.0 (Windows 10): Executed X of X SUCCESS
```

---

### 4️⃣ Mode développement (watch)

```bash
# Les tests se relancent automatiquement à chaque modification
npm run test:watch
```

💡 **Astuce** : Gardez cette fenêtre ouverte pendant que vous développez !

---

### 5️⃣ Couverture de code

```bash
npm run test:coverage
```

**Rapports générés** :
- Backend : `backend/coverage/lcov-report/index.html`
- Frontend : `frontend/coverage/index.html`

Ouvrez ces fichiers dans votre navigateur pour voir la couverture détaillée.

---

## 📊 Interpréter les résultats

### ✅ Tous les tests passent

```
Test Suites: 3 passed, 3 total
Tests:       15 passed, 15 total
Snapshots:   0 total
Time:        2.5 s
```

**→ Parfait !** Votre code est prêt.

---

### ❌ Un test échoue

```
FAIL  tests/models/transaction.model.test.js
  ● Transaction Model › getAll › devrait récupérer toutes les transactions

    expect(received).toEqual(expected)

    Expected: [...]
    Received: [...]
```

**→ Que faire ?**
1. Lisez le message d'erreur
2. Ouvrez le fichier mentionné
3. Vérifiez le code testé
4. Corrigez le problème
5. Relancez les tests

---

### ⚠️ Avertissement de couverture

```
Coverage for lines (65%) does not meet global threshold (70%)
```

**→ Solution** : Ajoutez plus de tests pour couvrir les lignes manquantes.

---

## 🔍 Tests par catégorie

### Backend

#### Modèles
```bash
cd backend
npx jest tests/models
```

#### Contrôleurs
```bash
cd backend
npx jest tests/controllers
```

#### Schémas
```bash
cd backend
npx jest tests/schemas
```

### Frontend

#### Services
```bash
cd frontend
ng test --include='**/*.service.spec.ts'
```

#### Composants
```bash
cd frontend
ng test --include='**/*.component.spec.ts'
```

---

## 🐛 Problèmes courants

### ❌ "Cannot find module 'jest'"

**Solution** :
```bash
cd backend
npm install jest --save-dev
```

---

### ❌ "Chrome not found"

**Solution** : Utilisez ChromeHeadless (déjà configuré)
```bash
npm run test:frontend
# Ou
cd frontend
ng test --browsers=ChromeHeadless
```

---

### ❌ "Port 9876 already in use"

**Solution** : Tuez le processus Karma
```bash
# Windows
taskkill /F /IM karma.exe

# Linux/Mac
pkill -f karma
```

---

### ❌ Tests timeout

**Solution** : Augmentez le timeout
```bash
# Backend (jest.config.js)
testTimeout: 10000

# Frontend (karma.conf.js)
browserNoActivityTimeout: 60000
```

---

## 📝 Exemples de commandes utiles

### Lancer un seul fichier de test

```bash
# Backend
cd backend
npx jest tests/models/transaction.model.test.js

# Frontend
cd frontend
ng test --include='**/transaction-form.component.spec.ts'
```

### Mode watch avec pattern

```bash
# Backend - Surveiller uniquement les modèles
cd backend
npx jest --watch --testPathPattern=models

# Frontend - Surveiller uniquement les services
cd frontend
ng test --include='**/*.service.spec.ts'
```

### Voir les tests lents

```bash
cd backend
npx jest --verbose --detectOpenHandles
```

### Mode debug

```bash
# Backend
cd backend
node --inspect-brk node_modules/.bin/jest --runInBand

# Frontend
cd frontend
ng test --browsers=Chrome
```

---

## 📚 Prochaines étapes

1. ✅ **Lire la documentation complète** : [TESTING.md](./TESTING.md)
2. ✅ **Ajouter vos propres tests** : Suivez les exemples dans TESTING.md
3. ✅ **Configurer CI/CD** : Voir section CI/CD dans TESTING.md
4. ✅ **Viser 80%+ de couverture** : Ajoutez des tests pour les cas non couverts

---

## 🎯 Checklist avant chaque commit

- [ ] `npm test` → ✅ Tous les tests passent
- [ ] `npm run test:coverage` → ✅ Couverture > 70%
- [ ] Code propre (pas de `console.log` inutiles)
- [ ] Tests ajoutés pour les nouvelles fonctionnalités
- [ ] Documentation mise à jour si nécessaire

---

## 💡 Astuces pro

### 1. Tests en arrière-plan

Ouvrez **3 terminaux** :
```bash
# Terminal 1 - Backend watch
cd backend && npm run test:watch

# Terminal 2 - Frontend watch
cd frontend && npm test

# Terminal 3 - Développement
npm run start:all
```

### 2. Tests rapides

```bash
# Backend - Uniquement les tests modifiés
cd backend
npx jest --onlyChanged

# Frontend - Mode headless rapide
cd frontend
ng test --watch=false --code-coverage=false
```

### 3. Snapshot testing

```bash
# Mettre à jour les snapshots
cd backend
npx jest -u
```

---

## 🆘 Support

**Problème persistant ?**

1. Consultez [TESTING.md](./TESTING.md)
2. Vérifiez les issues GitHub
3. Contactez l'équipe de développement

---

**Temps total de setup** : ~3 minutes
**Temps de premier test** : ~30 secondes
**Fréquence recommandée** : À chaque modification de code

**Bonne chance ! 🚀**
