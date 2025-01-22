const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const initializeDatabase = require('./migrations/initializeDatabase');
const transactionRoutes = require('./routes/transaction.routes');
const categoryRoutes = require('./routes/category.routes');
const subcategoryRoutes = require('./routes/subcategory.routes');

const app = express();
const PORT_BACK = 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Initialisation de la base de données
initializeDatabase();

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

// Démarrer le serveur
app.listen(PORT_BACK, () => {
  console.log(`Serveur backend sur http://localhost:${PORT_BACK}`);
});