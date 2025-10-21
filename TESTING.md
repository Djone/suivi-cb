# Guide des Tests Automatisés - Suivi-CB

## 📋 Table des matières

1. [Vue d'ensemble](#vue-densemble)
2. [Installation](#installation)
3. [Lancer les tests](#lancer-les-tests)
4. [Structure des tests](#structure-des-tests)
5. [Écrire de nouveaux tests](#écrire-de-nouveaux-tests)
6. [Bonnes pratiques](#bonnes-pratiques)
7. [CI/CD](#cicd)

---

## Vue d'ensemble

Le projet utilise deux frameworks de tests :

- **Backend** : Jest (Node.js)
- **Frontend** : Jasmine + Karma (Angular)

### Couverture de code cible

- **Branches** : 70%
- **Fonctions** : 70%
- **Lignes** : 70%
- **Statements** : 70%

---

## Installation

### Prérequis

- Node.js >= 18.x
- npm >= 9.x

### Installation des dépendances

```bash
# À la racine du projet
npm install

# Backend
cd backend
npm install

# Frontend
cd frontend
npm install
```

---

## Lancer les tests

### Tous les tests (backend + frontend)

```bash
npm test
```

### Tests backend uniquement

```bash
npm run test:backend

# Mode watch (redémarre automatiquement)
npm run test:backend:watch

# Avec couverture de code
npm run test:backend:coverage
```

### Tests frontend uniquement

```bash
npm run test:frontend

# Mode watch (redémarre automatiquement)
npm run test:frontend:watch

# Avec couverture de code
npm run test:frontend:coverage
```

### Mode watch pour tout

```bash
npm run test:watch
```

### Tests pour CI/CD

```bash
# Backend
cd backend
npm run test:ci

# Frontend
cd frontend
npm test -- --watch=false --browsers=ChromeHeadless --code-coverage
```

---

## Structure des tests

### Backend

```
backend/
├── tests/
│   ├── models/
│   │   ├── transaction.model.test.js
│   │   ├── category.model.test.js
│   │   └── subcategory.model.test.js
│   ├── controllers/
│   │   ├── transaction.controller.test.js
│   │   ├── category.controller.test.js
│   │   └── subcategory.controller.test.js
│   └── schemas/
│       └── subcategory.schema.test.js
├── jest.config.js
└── package.json
```

### Frontend

```
frontend/src/app/
├── services/
│   ├── transaction.service.ts
│   ├── transaction.service.spec.ts
│   ├── category.service.ts
│   └── category.service.spec.ts
├── components/
│   ├── transaction/
│   │   ├── transaction-form.component.ts
│   │   ├── transaction-form.component.spec.ts
│   │   ├── transaction-list.component.ts
│   │   └── transaction-list.component.spec.ts
│   └── ...
└── karma.conf.js
```

---

## Écrire de nouveaux tests

### Backend (Jest)

#### Exemple : Tester un modèle

```javascript
// backend/tests/models/example.model.test.js
const ExampleModel = require('../../models/example.model');
const db = require('../../config/db');

jest.mock('../../config/db');

describe('Example Model', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('devrait faire quelque chose', async () => {
    // Arrange
    db.all.mockImplementation((query, params, callback) => {
      callback(null, [{ id: 1, name: 'Test' }]);
    });

    // Act
    const result = await ExampleModel.getAll();

    // Assert
    expect(result).toEqual([{ id: 1, name: 'Test' }]);
    expect(db.all).toHaveBeenCalledTimes(1);
  });
});
```

#### Exemple : Tester un contrôleur

```javascript
// backend/tests/controllers/example.controller.test.js
const exampleController = require('../../controllers/example.controller');
const ExampleModel = require('../../models/example.model');

jest.mock('../../models/example.model');

describe('Example Controller', () => {
  let req, res;

  beforeEach(() => {
    req = { params: {}, body: {}, query: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
  });

  it('devrait retourner 200 avec les données', async () => {
    ExampleModel.getAll.mockResolvedValue([{ id: 1 }]);

    await exampleController.getAll(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith([{ id: 1 }]);
  });
});
```

### Frontend (Jasmine/Karma)

#### Exemple : Tester un service

```typescript
// frontend/src/app/services/example.service.spec.ts
import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ExampleService } from './example.service';

describe('ExampleService', () => {
  let service: ExampleService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [ExampleService]
    });
    service = TestBed.inject(ExampleService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('devrait récupérer les données', (done) => {
    const mockData = [{ id: 1, name: 'Test' }];

    service.getData().subscribe((data) => {
      expect(data).toEqual(mockData);
      done();
    });

    const req = httpMock.expectOne('http://localhost:3000/api/data');
    expect(req.request.method).toBe('GET');
    req.flush(mockData);
  });
});
```

#### Exemple : Tester un composant

```typescript
// frontend/src/app/components/example/example.component.spec.ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ExampleComponent } from './example.component';
import { ExampleService } from '../../services/example.service';
import { of } from 'rxjs';

describe('ExampleComponent', () => {
  let component: ExampleComponent;
  let fixture: ComponentFixture<ExampleComponent>;
  let service: jasmine.SpyObj<ExampleService>;

  beforeEach(async () => {
    const serviceSpy = jasmine.createSpyObj('ExampleService', ['getData']);

    await TestBed.configureTestingModule({
      imports: [ExampleComponent],
      providers: [
        { provide: ExampleService, useValue: serviceSpy }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ExampleComponent);
    component = fixture.componentInstance;
    service = TestBed.inject(ExampleService) as jasmine.SpyObj<ExampleService>;
  });

  it('devrait créer le composant', () => {
    expect(component).toBeTruthy();
  });

  it('devrait charger les données au démarrage', () => {
    service.getData.and.returnValue(of([{ id: 1 }]));

    fixture.detectChanges(); // Déclenche ngOnInit

    expect(service.getData).toHaveBeenCalled();
  });
});
```

---

## Bonnes pratiques

### Général

1. **Nommage des tests** : Utilisez des descriptions claires
   - ✅ `devrait retourner 404 si la transaction n'existe pas`
   - ❌ `test 1`

2. **Structure AAA** : Arrange, Act, Assert
   ```javascript
   it('devrait faire quelque chose', () => {
     // Arrange - Préparer les données et mocks
     const input = { id: 1 };

     // Act - Exécuter la fonction
     const result = myFunction(input);

     // Assert - Vérifier les résultats
     expect(result).toBe(expected);
   });
   ```

3. **Isolation** : Chaque test doit être indépendant
   - Utilisez `beforeEach` et `afterEach`
   - Nettoyez les mocks après chaque test

4. **Couverture** : Testez les cas normaux ET les cas d'erreur
   - Cas nominal (happy path)
   - Cas d'erreur
   - Cas limites (edge cases)

### Backend spécifique

1. **Mocker la base de données** : Ne jamais utiliser la vraie DB dans les tests
2. **Tester la sécurité** : Vérifiez les validations et les protections SQL
3. **Codes HTTP** : Testez tous les codes de retour (200, 201, 400, 404, 500)

### Frontend spécifique

1. **HttpClientTestingModule** : Toujours mocker les appels HTTP
2. **Jasmine Spy** : Utilisez `jasmine.createSpyObj` pour les services
3. **detectChanges()** : Appelez-le pour déclencher le cycle de vie Angular
4. **done()** : Utilisez-le pour les tests asynchrones avec Observables

---

## CI/CD

### GitHub Actions (exemple)

Créez `.github/workflows/test.yml` :

```yaml
name: Tests

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

jobs:
  backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Install dependencies
        run: cd backend && npm ci
      - name: Run tests
        run: cd backend && npm run test:ci
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./backend/coverage/lcov.info

  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Install dependencies
        run: cd frontend && npm ci
      - name: Run tests
        run: cd frontend && npm test -- --watch=false --browsers=ChromeHeadless --code-coverage
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./frontend/coverage/lcov.info
```

---

## Rapports de couverture

### Backend

Après `npm run test:backend:coverage` :
```
Open: backend/coverage/lcov-report/index.html
```

### Frontend

Après `npm run test:frontend:coverage` :
```
Open: frontend/coverage/index.html
```

---

## Dépannage

### Backend

**Problème** : `Cannot find module`
**Solution** : Vérifiez que Jest peut résoudre les chemins
```javascript
// jest.config.js
moduleDirectories: ['node_modules', 'src']
```

**Problème** : Les mocks ne fonctionnent pas
**Solution** : Assurez-vous d'appeler `jest.clearAllMocks()` dans `afterEach`

### Frontend

**Problème** : `Chrome not found`
**Solution** : Installez ChromeHeadless ou utilisez Firefox
```bash
npm install --save-dev karma-firefox-launcher
```

**Problème** : Tests asynchrones timeout
**Solution** : Augmentez le timeout dans `karma.conf.js`
```javascript
browserNoActivityTimeout: 60000
```

---

## Ressources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Jasmine Documentation](https://jasmine.github.io/)
- [Angular Testing Guide](https://angular.io/guide/testing)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)

---

## Support

Pour toute question sur les tests, consultez :
1. Cette documentation
2. Les exemples de tests existants
3. L'équipe de développement

---

**Dernière mise à jour** : 2025-01-17
