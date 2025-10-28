const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const initializeDatabase = require('./migrations/initializeDatabase');
const addIsActiveToCategories = require('./migrations/addIsActiveToCategories');
const createRecurringTransactionsTable = require('./migrations/createRecurringTransactionsTable');
const transactionRoutes = require('./routes/transaction.routes');
const categoryRoutes = require('./routes/category.routes');
const subcategoryRoutes = require('./routes/subcategory.routes');
const configRoutes = require('./routes/config.routes');
const recurringTransactionRoutes = require('./routes/recurring-transaction.routes');
const accountRoutes = require('./routes/account.routes');

const app = express();
const PORT_BACK = process.env.PORT_BACK || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Initialisation de la base de données et migrations
initializeDatabase();

// Routes API
app.use('/api/transactions', transactionRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/sub-categories', subcategoryRoutes);
app.use('/api/config', configRoutes);
app.use('/api/recurring-transactions', recurringTransactionRoutes);
app.use('/api/accounts', accountRoutes);

// Démarrer le serveur
app.listen(PORT_BACK, () => {
  console.log(`Serveur backend sur http://localhost:${PORT_BACK}`);
});