#!/bin/bash

# === Script de mise à jour pour l'application Suivi CB sur Synology NAS ===
#
# Ce script automatise le processus de mise à jour de l'application.
# Il doit être exécuté directement sur le NAS, dans le dossier de l'application.
#
# Utilisation :
# 1. Se connecter au NAS en SSH: ssh votre_utilisateur@IP_NAS
# 2. Naviguer vers le dossier: cd /volume1/docker/suivi-cb
# 3. Rendre le script exécutable (une seule fois): chmod +x update.sh
# 4. Lancer la mise à jour: ./update.sh
#

# Arrêter le script en cas d'erreur
set -e

echo "🚀 === Lancement de la mise à jour de Suivi CB ==="

# --- Configuration ---
APP_DIR="/volume1/docker/suivi-cb"
BACKUP_DIR="$APP_DIR/backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/database_before_update_$DATE.db" # Fichier de backup de la base de données
GIT_BRANCH="master" # Branche Git à utiliser pour la mise à jour
TARGET_SERVICE="all" # Par défaut, met à jour tous les services (backend et frontend)

# --- Vérifications initiales ---
if [ ! -d "$APP_DIR" ]; then
  echo "❌ ERREUR: Le dossier de l'application '$APP_DIR' n'existe pas."
  exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ ERREUR: docker-compose n'est pas installé ou n'est pas dans le PATH."
    exit 1
fi

cd "$APP_DIR"

# --- Traitement des paramètres ---
if [ "$#" -gt 0 ]; then
  case "$1" in
    "backend"|"frontend")
      TARGET_SERVICE="$1"
      echo "-> Mise à jour ciblée sur le service : $TARGET_SERVICE"
      ;;
    *) echo "⚠️ Paramètre inconnu : $1. Mise à jour complète." ;;
  esac
fi

# --- Variables pour le rollback ---
OLD_COMMIT=$(git rev-parse HEAD)

# --- Fonction de Rollback ---
rollback() {
    echo "❌ ERREUR détectée à l'étape '$1'. Lancement du rollback..."
    echo "-------------------------------------------------"
    echo "1. Restauration de la version précédente du code ($OLD_COMMIT)..."
    git checkout "$OLD_COMMIT" --force
    
    echo "2. Restauration de la base de données depuis le backup..."
    if [ -f "$BACKUP_FILE" ]; then
        cp "$BACKUP_FILE" "$APP_DIR/data/database.db"
    else
        echo "⚠️ ATTENTION: Fichier de backup non trouvé. La base de données n'a pas été restaurée."
    fi

    echo "3. Redémarrage de l'application avec l'ancienne version..."
    sudo docker-compose up -d --build --force-recreate
    
    echo "-------------------------------------------------"
    echo "🚨 Rollback terminé. L'application devrait être revenue à son état précédent."
    exit 1
}

# --- Début du processus de mise à jour ---

# 1. Sauvegarde de la base de données
echo -e "\n[1/7] 💾 Création du backup de la base de données..."
mkdir -p "$BACKUP_DIR"
cp "$APP_DIR/data/database.db" "$BACKUP_FILE" || rollback "Backup"
echo "-> Backup créé : $BACKUP_FILE"

# 2. Arrêt de l'application
echo -e "\n[2/7] 🛑 Arrêt des services Docker (ciblés ou tous)..."
if [ "$TARGET_SERVICE" = "all" ]; then
  sudo docker-compose down || rollback "Arrêt Docker"
else
  sudo docker-compose stop "$TARGET_SERVICE" || rollback "Arrêt Docker du service $TARGET_SERVICE"
fi

# 3. Mise à jour du code via Git
echo -e "\n[3/7] 🔄 Récupération de la nouvelle version du code (git pull)..."
git pull origin "$GIT_BRANCH" || rollback "Git Pull"

# 4. Reconstruction des images Docker
echo -e "\n[4/7] 🏗️ Reconstruction des images Docker (ciblées ou toutes)..."
if [ "$TARGET_SERVICE" = "all" ]; then
  sudo docker-compose build --no-cache || rollback "Build Docker"
else
  sudo docker-compose build --no-cache "$TARGET_SERVICE" || rollback "Build Docker du service $TARGET_SERVICE"
fi

# 5. Démarrage de l'application
echo -e "\n[5/7] ▶️ Démarrage des nouveaux conteneurs (ciblés ou tous)..."
if [ "$TARGET_SERVICE" = "all" ]; then
  sudo docker-compose up -d || rollback "Démarrage Docker"
else
  # Pour un démarrage sélectif, il est souvent préférable de recréer le conteneur pour appliquer les changements
  # et s'assurer que les dépendances sont à jour.
  sudo docker-compose up -d --no-deps --build --force-recreate "$TARGET_SERVICE" || rollback "Démarrage Docker du service $TARGET_SERVICE"
fi

# 6. Vérification du bon fonctionnement
echo -e "\n[6/7] 🩺 Vérification de l'état de l'application (attente de 15s)..."
sleep 15
if ! curl -fsS http://localhost:3001/api/config/active-accounts > /dev/null; then
    rollback "Vérification API"
fi
echo "-> L'API répond correctement."

# 7. Nettoyage
echo -e "\n[7/7] 🧹 Nettoyage des anciennes images Docker..."
sudo docker image prune -f

echo -e "\n✅ === Mise à jour terminée avec succès ! ==="
echo "Version actuelle : $(git rev-parse --short HEAD)"
