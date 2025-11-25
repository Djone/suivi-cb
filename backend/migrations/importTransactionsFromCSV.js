const fs = require("fs");
const path = require("path");
const db = require("../config/db");

const csvPath = path.resolve(__dirname, "import_transactions.csv");

function importTransactions() {
  return new Promise((resolve, reject) => {
    // Étape 1: Charger toutes les sous-catégories pour créer une map nom -> id
    db.all("SELECT id, label FROM subcategories", (err, subcategories) => {
      if (err) {
        console.error("Erreur lors du chargement des sous-catégories:", err);
        reject(err);
        return;
      }

      // Créer une map nom de sous-catégorie -> ID
      const subCategoryMap = {};
      subcategories.forEach((sc) => {
        subCategoryMap[sc.label] = sc.id;
      });

      console.log(
        "Sous-catégories chargées:",
        Object.keys(subCategoryMap).length
      );

      // Étape 2: Lire le fichier CSV
      const csvContent = fs.readFileSync(csvPath, "utf-8");
      const lines = csvContent.split("\n");

      // Ignorer la première ligne (en-têtes) et la dernière ligne vide
      const dataLines = lines.slice(1).filter((line) => line.trim() !== "");

      console.log(`Nombre de transactions à importer: ${dataLines.length}`);

      let imported = 0;
      let errors = 0;
      const errorDetails = [];

      // Étape 3: Préparer la requête d'insertion
      const insertStmt = db.prepare(`
        INSERT INTO transactions (date, amount, description, sub_category_id, account_id, financial_flow_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      // Étape 4: Traiter chaque ligne
      dataLines.forEach((line, index) => {
        try {
          // Parser la ligne CSV (délimiteur point-virgule)
          const parts = line.split(";");

          if (parts.length < 6) {
            errorDetails.push(`Ligne ${index + 2}: Format invalide - ${line}`);
            errors++;
            return;
          }

          const [
            dateStr,
            amountStr,
            description,
            subCategoryName,
            accountId,
            financialFlowId,
          ] = parts;

          // Convertir la date vers YYYY-MM-DD (accepte DD/MM/YYYY ou YYYY-MM-DD)
          const normalizedDate = dateStr.trim();
          let formattedDate;
          if (normalizedDate.includes("/")) {
            const dateParts = normalizedDate.split("/");
            if (dateParts.length !== 3) {
              errorDetails.push(`Ligne ${index + 2}: Date invalide - ${dateStr}`);
              errors++;
              return;
            }
            const [day, month, year] = dateParts;
            formattedDate = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
          } else if (normalizedDate.includes("-")) {
            const dateParts = normalizedDate.split("-");
            if (dateParts.length !== 3) {
              errorDetails.push(`Ligne ${index + 2}: Date invalide - ${dateStr}`);
              errors++;
              return;
            }
            const [year, month, day] = dateParts;
            formattedDate = `${year.padStart(4, "0")}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
          } else {
            errorDetails.push(`Ligne ${index + 2}: Date invalide - ${dateStr}`);
            errors++;
            return;
          }

          // Convertir le montant (remplacer la virgule par un point et supprimer les espaces)
          const amount = parseFloat(
            amountStr.trim().replace(/\s/g, "").replace(",", ".")
          );
          if (isNaN(amount)) {
            errorDetails.push(
              `Ligne ${index + 2}: Montant invalide - ${amountStr}`
            );
            errors++;
            return;
          }

          // Trouver l'ID de la sous-catégorie (accepte un ID numérique ou un libellé)
          const rawSubCategory = subCategoryName.trim();
          let subCategoryId = null;

          if (/^\d+$/.test(rawSubCategory)) {
            subCategoryId = parseInt(rawSubCategory, 10);
          } else {
            subCategoryId = subCategoryMap[rawSubCategory];
          }

          if (!subCategoryId) {
            errorDetails.push(
              `Ligne ${index + 2}: Sous-catégorie introuvable - "${rawSubCategory}"`
            );
            errors++;
            return;
          }

          // Insérer la transaction
          insertStmt.run(
            formattedDate,
            amount,
            description.trim(),
            subCategoryId,
            parseInt(accountId.trim()),
            parseInt(financialFlowId.trim()),
            (err) => {
              if (err) {
                errorDetails.push(
                  `Ligne ${index + 2}: Erreur d'insertion - ${err.message}`
                );
                errors++;
              } else {
                imported++;
              }
            }
          );
        } catch (error) {
          errorDetails.push(`Ligne ${index + 2}: Exception - ${error.message}`);
          errors++;
        }
      });

      // Étape 5: Finaliser et afficher les résultats
      insertStmt.finalize((err) => {
        if (err) {
          console.error("Erreur lors de la finalisation:", err);
          reject(err);
          return;
        }

        console.log("\n========== RÉSULTAT DE L'IMPORT ==========");
        console.log(`✓ Transactions importées avec succès: ${imported}`);
        console.log(`✗ Erreurs: ${errors}`);

        if (errorDetails.length > 0) {
          console.log("\n========== DÉTAILS DES ERREURS ==========");
          errorDetails.slice(0, 20).forEach((detail) => console.log(detail));
          if (errorDetails.length > 20) {
            console.log(`... et ${errorDetails.length - 20} autres erreurs`);
          }
        }

        console.log("\n✓ Import terminé.");
        resolve({ imported, errors });
      });
    });
  });
}

// Exécuter l'import si ce script est exécuté directement
if (require.main === module) {
  console.log("Démarrage de l'import des transactions depuis le CSV...\n");
  importTransactions()
    .then((result) => {
      console.log("\nImport réussi!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\nErreur lors de l'import:", error);
      process.exit(1);
    });
}

module.exports = importTransactions;
