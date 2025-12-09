const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const db = require('./config/db'); // Import the db instance
const initializeDatabase = require('./migrations/initializeDatabase');
const transactionRoutes = require('./routes/transaction.routes');
const categoryRoutes = require('./routes/category.routes');
const subcategoryRoutes = require('./routes/subcategory.routes');
const configRoutes = require('./routes/config.routes');
const recurringTransactionRoutes = require('./routes/recurring-transaction.routes');
const accountRoutes = require('./routes/account.routes');
const coupleSplitRoutes = require('./routes/couple-split.routes');

const app = express();
const PORT_BACK = process.env.PORT_BACK || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Fonction de démarrage asynchrone
const startServer = async () => {
  try {
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
