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
const PORT_BACK = 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Initialisation de la base de données et migrations
initializeDatabase();

// Exécuter la migration pour ajouter is_active aux catégories
addIsActiveToCategories()
  .then(() => console.log('Migration is_active terminée avec succès'))
  .catch(err => console.error('Erreur lors de la migration is_active:', err));

// Exécuter la migration pour créer la table recurring_transactions
createRecurringTransactionsTable()
  .then(() => console.log('Migration recurring_transactions terminée avec succès'))
  .catch(err => console.error('Erreur lors de la migration recurring_transactions:', err));

/*
// Vérification du bon fonctionnement des requêtes envoyées par le frontend
app.use((req, next) => {
  console.log(`Requête reçue : ${req.method} ${req.url}`);
  console.log('Corps de la requête :', req.body); // Afficher le JSON envoyé
  console.log('Paramètres de la requête :', req.params); // Afficher les paramètres
  console.log('Query string :', req.query); // Afficher les query strings
  next();
});
*/

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