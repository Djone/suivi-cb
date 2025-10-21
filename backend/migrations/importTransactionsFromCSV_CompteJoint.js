const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'database.db');
const csvPath = path.join(__dirname, 'CompteCourant_2025 - Opérations CJ.csv');

const db = new sqlite3.Database(dbPath);

// Fonction pour parser le CSV
function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim() !== '');
  const headers = lines[0].split(';');

  return lines.slice(1).map(line => {
    const values = line.split(';');
    const row = {};
    headers.forEach((header, index) => {
      row[header.trim()] = values[index] ? values[index].trim() : '';
    });
    return row;
  });
}

// Fonction pour convertir la date DD/MM/YYYY en YYYY-MM-DD
function convertDate(dateStr) {
  const [day, month, year] = dateStr.split('/');
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

// Fonction pour nettoyer le montant (enlever € et remplacer , par .)
function cleanAmount(amountStr) {
  return parseFloat(amountStr.replace(/[€\s]/g, '').replace(',', '.'));
}

// Fonction pour obtenir ou créer une sous-catégorie
function getOrCreateSubCategory(subCategoryName, financialFlowId) {
  return new Promise((resolve, reject) => {
    // D'abord, chercher si la sous-catégorie existe déjà
    db.get(
      'SELECT id FROM subcategories WHERE label = ? COLLATE NOCASE',
      [subCategoryName],
      (err, row) => {
        if (err) {
          reject(err);
        } else if (row) {
          // La sous-catégorie existe déjà
          console.log(`Sous-catégorie trouvée: "${subCategoryName}" (ID: ${row.id})`);
          resolve(row.id);
        } else {
          // La sous-catégorie n'existe pas, on doit la créer
          // D'abord, trouver la catégorie appropriée selon le financial_flow_id
          db.get(
            'SELECT id FROM categories WHERE financial_flow_id = ? AND is_active = 1 LIMIT 1',
            [financialFlowId],
            (err, category) => {
              if (err) {
                reject(err);
              } else if (!category) {
                reject(new Error(`Aucune catégorie active trouvée pour financial_flow_id ${financialFlowId}`));
              } else {
                // Créer la sous-catégorie
                db.run(
                  'INSERT INTO subcategories (label, category_id) VALUES (?, ?)',
                  [subCategoryName, category.id],
                  function(err) {
                    if (err) {
                      reject(err);
                    } else {
                      console.log(`✓ Sous-catégorie créée: "${subCategoryName}" (ID: ${this.lastID})`);
                      resolve(this.lastID);
                    }
                  }
                );
              }
            }
          );
        }
      }
    );
  });
}

// Fonction principale d'import
async function importTransactions() {
  console.log('Début de l\'importation des transactions du compte joint...\n');

  try {
    const rows = parseCSV(csvPath);
    console.log(`${rows.length} lignes à importer\n`);

    let imported = 0;
    let skipped = 0;
    let errors = 0;
    const createdSubCategories = new Set();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      try {
        // Nettoyer et convertir les données
        const date = convertDate(row.date);
        const amount = cleanAmount(row.montant);
        const description = row.description;
        const subCategoryName = row.sub_category_id; // C'est le nom, pas l'ID
        const financialFlowId = parseInt(row.financial_flow_id);

        // Vérifier que la transaction n'existe pas déjà
        const existing = await new Promise((resolve, reject) => {
          db.get(
            'SELECT id FROM transactions WHERE date = ? AND amount = ? AND description = ? AND account_id = 2',
            [date, amount, description],
            (err, row) => {
              if (err) reject(err);
              else resolve(row);
            }
          );
        });

        if (existing) {
          skipped++;
          continue;
        }

        // Obtenir ou créer la sous-catégorie
        const subCategoryId = await getOrCreateSubCategory(subCategoryName, financialFlowId);

        if (!createdSubCategories.has(subCategoryName)) {
          createdSubCategories.add(subCategoryName);
        }

        // Insérer la transaction pour le compte joint (account_id = 2)
        await new Promise((resolve, reject) => {
          db.run(
            'INSERT INTO transactions (date, amount, description, sub_category_id, account_id, financial_flow_id) VALUES (?, ?, ?, ?, 2, ?)',
            [date, amount, description, subCategoryId, financialFlowId],
            function(err) {
              if (err) reject(err);
              else resolve();
            }
          );
        });

        imported++;

        if ((i + 1) % 50 === 0) {
          console.log(`Progression: ${i + 1}/${rows.length} lignes traitées...`);
        }

      } catch (error) {
        console.error(`Erreur ligne ${i + 1}:`, error.message);
        errors++;
      }
    }

    console.log('\n=== RÉSUMÉ DE L\'IMPORTATION ===');
    console.log(`✓ Transactions importées: ${imported}`);
    console.log(`⊘ Transactions ignorées (déjà existantes): ${skipped}`);
    console.log(`✗ Erreurs: ${errors}`);
    console.log(`→ Sous-catégories créées: ${createdSubCategories.size}`);

    if (createdSubCategories.size > 0) {
      console.log('\nSous-catégories créées:');
      createdSubCategories.forEach(name => console.log(`  - ${name}`));
    }

  } catch (error) {
    console.error('Erreur générale:', error);
  } finally {
    db.close();
  }
}

// Exécuter l'import
importTransactions();
