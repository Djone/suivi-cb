#!/bin/bash

# Script de déploiement sur Synology NAS
# Ce script synchronise le code et redémarre l'application sur le NAS

set -e

echo "======================================"
echo "Déploiement sur Synology NAS"
echo "======================================"
echo ""

# Configuration - À PERSONNALISER
NAS_USER="${NAS_USER:-admin}"
NAS_HOST="${NAS_HOST:-192.168.1.100}"
NAS_APP_DIR="${NAS_APP_DIR:-/volume1/docker/suivi-cb}"
NAS_SSH_PORT="${NAS_SSH_PORT:-22}"

# Couleurs
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Fonction pour vérifier la connexion SSH
check_ssh() {
    info "Vérification de la connexion SSH au NAS..."
    if ssh -p $NAS_SSH_PORT -o ConnectTimeout=5 $NAS_USER@$NAS_HOST "exit" 2>/dev/null; then
        info "Connexion SSH OK"
        return 0
    else
        error "Impossible de se connecter au NAS via SSH"
        echo "Vérifiez:"
        echo "  - NAS_USER=$NAS_USER"
        echo "  - NAS_HOST=$NAS_HOST"
        echo "  - NAS_SSH_PORT=$NAS_SSH_PORT"
        echo "  - Le service SSH est activé sur le NAS"
        return 1
    fi
}

# Menu principal
echo "Configuration actuelle:"
echo "  - Utilisateur: $NAS_USER"
echo "  - Hôte: $NAS_HOST"
echo "  - Port SSH: $NAS_SSH_PORT"
echo "  - Répertoire: $NAS_APP_DIR"
echo ""

read -p "Ces paramètres sont-ils corrects? (o/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Oo]$ ]]; then
    echo "Personnalisez les variables d'environnement:"
    echo "  export NAS_USER=votre_utilisateur"
    echo "  export NAS_HOST=votre_ip_ou_domaine"
    echo "  export NAS_APP_DIR=/volume1/docker/suivi-cb"
    echo "  export NAS_SSH_PORT=22"
    exit 1
fi

# Vérifier la connexion
if ! check_ssh; then
    exit 1
fi

# Étape 1: Backup sur le NAS
info "Étape 1/7: Création d'un backup sur le NAS..."
ssh -p $NAS_SSH_PORT $NAS_USER@$NAS_HOST << 'ENDSSH'
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/volume1/docker/suivi-cb/backups"
mkdir -p $BACKUP_DIR
if [ -f /volume1/docker/suivi-cb/data/database.db ]; then
    cp /volume1/docker/suivi-cb/data/database.db $BACKUP_DIR/database_before_deploy_$DATE.db
    echo "Backup créé: database_before_deploy_$DATE.db"
else
    echo "Pas de base de données à sauvegarder (première installation)"
fi
ENDSSH
echo ""

# Étape 2: Arrêt de l'application
info "Étape 2/7: Arrêt de l'application sur le NAS..."
ssh -p $NAS_SSH_PORT $NAS_USER@$NAS_HOST "cd $NAS_APP_DIR && sudo docker-compose stop" || warning "Les containers n'étaient peut-être pas démarrés"
echo ""

# Étape 3: Synchronisation des fichiers
info "Étape 3/7: Synchronisation des fichiers..."
echo "Fichiers à synchroniser:"
echo "  - Dockerfiles"
echo "  - docker-compose.yml"
echo "  - nginx.conf"
echo "  - Code source (frontend & backend)"
echo ""

# Créer le dossier sur le NAS s'il n'existe pas
ssh -p $NAS_SSH_PORT $NAS_USER@$NAS_HOST "mkdir -p $NAS_APP_DIR"

# Synchroniser les fichiers
rsync -avz --progress \
    --exclude 'node_modules' \
    --exclude 'dist' \
    --exclude '.git' \
    --exclude 'data' \
    --exclude 'logs' \
    --exclude 'backups' \
    --exclude '.angular' \
    --exclude 'coverage' \
    --exclude '*.log' \
    --exclude '.env.local' \
    -e "ssh -p $NAS_SSH_PORT" \
    ./ $NAS_USER@$NAS_HOST:$NAS_APP_DIR/

if [ $? -ne 0 ]; then
    error "Erreur lors de la synchronisation des fichiers"
    exit 1
fi
info "Synchronisation terminée"
echo ""

# Étape 4: Créer les répertoires nécessaires
info "Étape 4/7: Création des répertoires de données..."
ssh -p $NAS_SSH_PORT $NAS_USER@$NAS_HOST << ENDSSH
cd $NAS_APP_DIR
mkdir -p data
mkdir -p logs/backend
mkdir -p logs/frontend
mkdir -p backups
chmod 755 data logs
echo "Répertoires créés"
ENDSSH
echo ""

# Étape 5: Build des images Docker
info "Étape 5/7: Construction des images Docker sur le NAS..."
ssh -p $NAS_SSH_PORT $NAS_USER@$NAS_HOST "cd $NAS_APP_DIR && sudo docker-compose build --no-cache"
if [ $? -ne 0 ]; then
    error "Erreur lors de la construction des images"
    exit 1
fi
info "Images construites avec succès"
echo ""

# Étape 6: Démarrage de l'application
info "Étape 6/7: Démarrage de l'application..."
ssh -p $NAS_SSH_PORT $NAS_USER@$NAS_HOST "cd $NAS_APP_DIR && sudo docker-compose up -d"
if [ $? -ne 0 ]; then
    error "Erreur lors du démarrage de l'application"
    exit 1
fi
info "Application démarrée"
echo ""

# Étape 7: Vérification
info "Étape 7/7: Vérification du déploiement..."
sleep 10

info "État des containers:"
ssh -p $NAS_SSH_PORT $NAS_USER@$NAS_HOST "cd $NAS_APP_DIR && sudo docker-compose ps"
echo ""

info "Dernières lignes des logs:"
ssh -p $NAS_SSH_PORT $NAS_USER@$NAS_HOST "cd $NAS_APP_DIR && sudo docker-compose logs --tail=20"
echo ""

# Test de l'API
info "Test de l'API backend..."
if ssh -p $NAS_SSH_PORT $NAS_USER@$NAS_HOST "curl -f http://localhost:3001/api/config/active-accounts" > /dev/null 2>&1; then
    info "API backend OK"
else
    warning "API backend ne répond pas encore (peut prendre quelques secondes)"
fi
echo ""

# Résumé
echo "======================================"
echo -e "${GREEN}Déploiement terminé!${NC}"
echo "======================================"
echo ""
echo "Testez l'application:"
echo "  - Réseau local: http://$NAS_HOST:4200"
echo "  - API: http://$NAS_HOST:3001/api/config/active-accounts"
echo "  - HTTPS (si configuré): https://votre-domaine.com"
echo ""
echo "Commandes utiles sur le NAS:"
echo "  - Logs: cd $NAS_APP_DIR && sudo docker-compose logs -f"
echo "  - Status: cd $NAS_APP_DIR && sudo docker-compose ps"
echo "  - Restart: cd $NAS_APP_DIR && sudo docker-compose restart"
echo ""
echo "En cas de problème:"
echo "  - Consultez les logs: ssh $NAS_USER@$NAS_HOST 'cd $NAS_APP_DIR && sudo docker-compose logs'"
echo "  - Rollback: Restaurez le backup de la base de données"
echo ""
