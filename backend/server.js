const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { authConfig } = require('./config/auth');
const { createAuthMiddleware } = require('./middlewares/auth.middleware');
const { createDisableOtpHandler } = require('./routes/otp-disable');
const db = require('./config/db'); // Import the db instance
const initializeDatabase = require('./migrations/initializeDatabase');
const transactionRoutes = require('./routes/transaction.routes');
const categoryRoutes = require('./routes/category.routes');
const subcategoryRoutes = require('./routes/subcategory.routes');
const configRoutes = require('./routes/config.routes');
const recurringTransactionRoutes = require('./routes/recurring-transaction.routes');
const accountRoutes = require('./routes/account.routes');
const coupleSplitRoutes = require('./routes/couple-split.routes');
const releaseRoutes = require('./routes/release.routes');
const savingsWalletRoutes = require('./routes/savings-wallet.routes');
const savingAccountRoutes = require('./routes/saving-account.routes');
const vehicleRoutes = require('./routes/vehicle.routes');
const {
  isReleaseProcessEnabled,
  requireLocalReleaseAccess,
} = require('./middlewares/release-access.middleware');

const app = express();
const PORT_BACK = process.env.PORT_BACK || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Fonction de démarrage asynchrone
const startServer = async () => {
  try {
    const auth = authConfig();
    const requireAuth = await createAuthMiddleware(auth);
    app.get('/health', (_req, res) => res.json({ status: 'ok' }));
    app.get('/api/auth/config', (_req, res) => {
      res.set('Cache-Control', 'no-store').json(auth.public);
    });
    app.use('/api', requireAuth);
    app.delete('/api/auth/otp-credentials', createDisableOtpHandler(auth));
    app.get('/api/auth/otp-credentials', async (req, res) => {
      try {
        const keycloakResponse = await fetch(
          `${auth.accountUrl}/realms/${encodeURIComponent(auth.public.realm)}/account/credentials?user-credentials=true`,
          {
            headers: {
              Accept: 'application/json',
              Authorization: req.get('Authorization') || '',
            },
            signal: AbortSignal.timeout(10000),
          },
        );
        if (!keycloakResponse.ok) {
          console.warn('[AUTH] Lecture des identifiants OTP refusée par Keycloak', {
            status: keycloakResponse.status,
          });
          return res.status(502).json({ error: `KEYCLOAK_ACCOUNT_${keycloakResponse.status}` });
        }
        const contentType = keycloakResponse.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          return res.status(502).json({ error: 'KEYCLOAK_ACCOUNT_INVALID_RESPONSE' });
        }
        return res.set('Cache-Control', 'no-store').json(await keycloakResponse.json());
      } catch (error) {
        const code = error?.cause?.code || error?.code || error?.name || 'UNKNOWN';
        console.warn('[AUTH] Impossible de joindre Keycloak pour les identifiants OTP', { code });
        return res.status(502).json({ error: `KEYCLOAK_ACCOUNT_NETWORK_${code}` });
      }
    });
    // 1. Attendre que la base de données soit prête
    await initializeDatabase();
    console.log(`[SERVER_START_DEBUG] DB connection filename after init: "${db.filename}"`);

    // 2. Enregistrer les routes API une fois la DB prête
    app.use('/api/transactions', transactionRoutes);
    app.use('/api/categories', categoryRoutes);
    app.use('/api/sub-categories', subcategoryRoutes);
    app.use('/api/config', configRoutes);
    app.use('/api/recurring-transactions', recurringTransactionRoutes);
    app.use('/api/accounts', accountRoutes);
    app.use('/api/couple-split', coupleSplitRoutes);
    if (isReleaseProcessEnabled()) {
      app.use('/api/release', requireLocalReleaseAccess, releaseRoutes);
    }
    app.use('/api/savings-wallets', savingsWalletRoutes);
    app.use('/api/saving-accounts', savingAccountRoutes);
    app.use('/api/vehicles', vehicleRoutes);
    app.use('/api/salaries', require('./routes/salary.routes'));

    // 3. Démarrer le serveur Express
    app.listen(PORT_BACK, () => {
      console.log(`✅ Serveur backend démarré et prêt sur http://localhost:${PORT_BACK}`);
    });
  } catch (error) {
    console.error('❌ Échec du démarrage du serveur:', error);
    process.exit(1);
  }
};

// Lancer le processus de démarrage
startServer();
