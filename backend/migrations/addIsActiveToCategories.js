// backend/migrations/addIsActiveToCategories.js
const db = require('../config/db');

/**
 * Migration pour ajouter la colonne is_active à la table categories
 * Cette colonne permet de faire un "soft delete" des catégories
 * au lieu de les supprimer définitivement
 */
function addIsActiveToCategories() {
    return new Promise((resolve, reject) => {
        // Vérifier si la colonne existe déjà
        db.get("PRAGMA table_info(categories)", (err, rows) => {
            if (err) {
                console.error('Erreur lors de la vérification de la structure de la table:', err.message);
                return reject(err);
            }
        });

        // Ajouter la colonne is_active (par défaut à 1 = actif)
        const query = `ALTER TABLE categories ADD COLUMN is_active INTEGER DEFAULT 1`;

        db.run(query, (err) => {
            if (err) {
                // Si l'erreur est "duplicate column name", c'est que la colonne existe déjà
                if (err.message.includes('duplicate column name')) {
                    console.log('La colonne "is_active" existe déjà dans la table categories.');
                    return resolve();
                }
                console.error('Erreur lors de l\'ajout de la colonne is_active:', err.message);
                return reject(err);
            }

            console.log('✓ Colonne "is_active" ajoutée avec succès à la table categories.');
            console.log('  Toutes les catégories existantes sont marquées comme actives (is_active = 1).');
            resolve();
        });
    });
}

module.exports = addIsActiveToCategories;
