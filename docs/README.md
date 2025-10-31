# Suivi-CB 💳

Application web full-stack de suivi de transactions bancaires avec catégorisation automatique.

## 🚀 Fonctionnalités

- ✅ Gestion multi-comptes
- ✅ Catégorisation des transactions (Revenus/Dépenses)
- ✅ Sous-catégories personnalisables
- ✅ Filtrage avancé des transactions
- ✅ Interface Material Design moderne
- ✅ API REST sécurisée
- ✅ Tests automatisés (Backend + Frontend)

## 🛠️ Technologies

### Backend
- **Node.js** avec Express.js
- **SQLite3** pour la persistence
- **Joi** pour la validation
- **Jest** pour les tests

### Frontend
- **Angular 19** (standalone components)
- **Angular Material** pour l'UI
- **RxJS** pour la programmation réactive
- **Chart.js** pour les visualisations
- **Jasmine/Karma** pour les tests

## 📦 Installation

### Prérequis
- Node.js >= 18.x
- npm >= 9.x

### Installation rapide

```bash
# Cloner le repository
git clone <url-du-repo>
cd suivi-cb

# Installer toutes les dépendances
npm install

# Installer les dépendances backend
cd backend
npm install

# Installer les dépendances frontend
cd ../frontend
npm install
```

## 🏃 Démarrage

### Développement

```bash
# Démarrer backend + frontend en parallèle
npm run start:all

# OU démarrer séparément

# Backend (port 3000)
npm run start:backend

# Frontend (port 4200)
npm run start:frontend
```

L'application sera accessible sur :
- **Frontend** : http://localhost:4200
- **Backend API** : http://localhost:3000/api

## 🧪 Tests

```bash
# Lancer tous les tests (backend + frontend)
npm test

# Tests backend uniquement
npm run test:backend

# Tests frontend uniquement
npm run test:frontend

# Mode watch (redémarre automatiquement)
npm run test:watch

# Avec couverture de code
npm run test:coverage
```

📚 **Documentation complète des tests** : [TESTING.md](./TESTING.md)

## 📁 Structure du projet

```
suivi-cb/
├── backend/                    # API Node.js
│   ├── config/                # Configuration DB
│   ├── controllers/           # Contrôleurs HTTP
│   ├── models/                # Modèles de données
│   ├── routes/                # Définition des routes
│   ├── schemas/               # Validation Joi
│   ├── middlewares/           # Middlewares Express
│   ├── tests/                 # Tests Jest
│   │   ├── models/
│   │   ├── controllers/
│   │   └── schemas/
│   ├── utils/                 # Utilitaires
│   ├── server.js              # Point d'entrée
│   └── database.db            # Base SQLite
│
├── frontend/                   # Application Angular
│   ├── src/
│   │   ├── app/
│   │   │   ├── components/    # Composants Angular
│   │   │   ├── services/      # Services HTTP
│   │   │   ├── models/        # Interfaces TypeScript
│   │   │   ├── config/        # Configuration
│   │   │   └── utils/         # Utilitaires
│   │   └── assets/            # Resources statiques
│   └── karma.conf.js          # Config tests
│
├── TESTING.md                  # Guide des tests
├── package.json               # Scripts globaux
└── README.md                  # Ce fichier
```

## 🔒 Sécurité

- ✅ Validation des entrées (Joi côté backend, Reactive Forms côté frontend)
- ✅ Requêtes SQL paramétrées (protection contre l'injection SQL)
- ✅ Liste blanche pour les colonnes filtrables
- ✅ CORS configuré
- ✅ Validation stricte des schémas (pas de champs inconnus)

## 🎨 Architecture

### Backend : MVC/Layered

```
Routes → Controllers → Models → Database
           ↓
        Validation (Joi)
```

### Frontend : Smart/Dumb Components + Services

```
Components (Smart) → Services → HTTP → Backend API
     ↓
Components (Dumb)
```

### Conversion des données

- **Frontend** : camelCase (JavaScript)
- **Backend** : snake_case (SQL/Database)
- **Conversion automatique** : via `humps` library

## 📊 Modèle de données

### Transactions
```javascript
{
  id: number
  description: string
  amount: number
  date: Date
  accountId: number          // Compte bancaire
  financialFlowId: number    // 1: Revenu, 2: Dépense
  subCategoryId: number      // Sous-catégorie
}
```

### Categories
```javascript
{
  id: number
  label: string
  financialFlowId: number
}
```

### SubCategories
```javascript
{
  id: number
  label: string
  categoryId: number
}
```

## 🔧 Scripts disponibles

### Racine du projet

```bash
npm run start:all              # Démarrer backend + frontend
npm run start:backend          # Démarrer backend uniquement
npm run start:frontend         # Démarrer frontend uniquement
npm test                       # Lancer tous les tests
npm run test:watch             # Tests en mode watch
npm run test:coverage          # Tests avec couverture
```

### Backend

```bash
npm start                      # Démarrer le serveur
npm test                       # Lancer les tests Jest
npm run test:watch             # Tests en mode watch
npm run test:coverage          # Couverture de code
npm run test:ci                # Tests pour CI/CD
```

### Frontend

```bash
ng serve                       # Démarrer le dev server
ng build                       # Build de production
ng test                        # Lancer les tests Karma
ng lint                        # Vérification ESLint
```

## 🐛 Dépannage

### Backend ne démarre pas
```bash
# Vérifier que le port 3000 est libre
netstat -ano | findstr :3000

# Vérifier la base de données
ls backend/database.db
```

### Frontend ne démarre pas
```bash
# Nettoyer le cache
cd frontend
rm -rf node_modules package-lock.json
npm install
```

### Tests échouent
```bash
# Backend
cd backend
npm run test:coverage

# Frontend
cd frontend
npm test -- --code-coverage
```

## 📝 Changelog

### Version 1.0.0 (2025-01-17)

✨ **Nouvelles fonctionnalités**
- Suite de tests automatisés complète
- Documentation des tests
- Scripts CI/CD ready

🔒 **Sécurité**
- Protection contre l'injection SQL renforcée
- Validation stricte des schémas
- Liste blanche pour les filtres

🧹 **Nettoyage**
- Réduction des logs console
- Suppression du code commenté
- Cohérence des conventions de nommage

## 🤝 Contribution

Pour contribuer au projet :

1. Forkez le repository
2. Créez une branche (`git checkout -b feature/amazing-feature`)
3. Écrivez des tests pour vos modifications
4. Committez vos changements (`git commit -m 'Add amazing feature'`)
5. Pushez vers la branche (`git push origin feature/amazing-feature`)
6. Ouvrez une Pull Request

**Important** : Assurez-vous que tous les tests passent avant de soumettre une PR.

## 📄 Licence

ISC

## 👥 Auteurs

- Jonathan - Développeur principal

## 🙏 Remerciements

- Angular Team
- Express.js community
- Jest & Jasmine contributors

---

**Made with ❤️ and TypeScript**
