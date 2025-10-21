const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'database.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  // Créer la table accounts si elle n'existe pas
  db.run(
    `CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      color TEXT DEFAULT '#1976d2',
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    (err) => {
      if (err) {
        console.error('Erreur lors de la création de la table accounts:', err.message);
        db.close();
      } else {
        console.log('Table accounts créée avec succès.');

        // Insérer les comptes par défaut s'ils n'existent pas
        db.get('SELECT COUNT(*) as count FROM accounts', (err, row) => {
          if (err) {
            console.error('Erreur lors de la vérification des comptes:', err.message);
            db.close();
          } else if (row.count === 0) {
            // Insérer le compte courant (ID = 1)
            db.run(
              `INSERT INTO accounts (id, name, description, color, is_active)
               VALUES (1, 'Compte courant', 'Compte bancaire principal', '#1976d2', 1)`,
              (err) => {
                if (err) {
                  console.error('Erreur lors de l\'insertion du compte courant:', err.message);
                } else {
                  console.log('Compte courant créé avec succès.');
                }
              }
            );

            // Insérer le compte joint (ID = 2)
            db.run(
              `INSERT INTO accounts (id, name, description, color, is_active)
               VALUES (2, 'Compte joint', 'Compte bancaire joint', '#4caf50', 1)`,
              (err) => {
                if (err) {
                  console.error('Erreur lors de l\'insertion du compte joint:', err.message);
                } else {
                  console.log('Compte joint créé avec succès.');
                }

                // Fermer la base après la dernière insertion
                db.close((err) => {
                  if (err) {
                    console.error('Erreur lors de la fermeture de la base de données:', err.message);
                  } else {
                    console.log('Migration terminée.');
                  }
                });
              }
            );
          } else {
            console.log('Des comptes existent déjà, aucune insertion nécessaire.');
            db.close((err) => {
              if (err) {
                console.error('Erreur lors de la fermeture de la base de données:', err.message);
              } else {
                console.log('Migration terminée.');
              }
            });
          }
        });
      }
    }
  );
});
