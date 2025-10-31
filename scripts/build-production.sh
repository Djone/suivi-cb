#!/bin/bash

# Script de build pour la production
# Ce script prépare l'application pour le déploiement sur le NAS Synology

set -e  # Arrêter en cas d'erreur

echo "======================================"
echo "Build de production - Suivi CB"
echo "======================================"
echo ""

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Fonction pour afficher les messages
info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Vérifier que nous sommes dans le bon répertoire
if [ ! -f "docker-compose.yml" ]; then
    error "docker-compose.yml non trouvé. Êtes-vous dans le bon répertoire?"
    exit 1
fi

# Vérifier que Docker est installé
if ! command -v docker &> /dev/null; then
    error "Docker n'est pas installé. Installez Docker avant de continuer."
    exit 1
fi

# Vérifier que docker-compose est installé
if ! command -v docker-compose &> /dev/null; then
    error "docker-compose n'est pas installé. Installez docker-compose avant de continuer."
    exit 1
fi

# Étape 1: Nettoyage
info "Étape 1/6: Nettoyage des anciens builds..."
rm -rf frontend/dist/
rm -rf backend/dist/
info "Nettoyage terminé"
echo ""

# Étape 2: Vérification des dépendances backend
info "Étape 2/6: Vérification des dépendances backend..."
if [ ! -d "backend/node_modules" ]; then
    warning "node_modules du backend non trouvé. Installation..."
    cd backend
    npm ci
    cd ..
fi
info "Dépendances backend OK"
echo ""

# Étape 3: Vérification des dépendances frontend
info "Étape 3/6: Vérification des dépendances frontend..."
if [ ! -d "frontend/node_modules" ]; then
    warning "node_modules du frontend non trouvé. Installation..."
    cd frontend
    npm ci
    cd ..
fi
info "Dépendances frontend OK"
echo ""

# Étape 4: Build du frontend Angular
info "Étape 4/6: Build du frontend Angular en mode production..."
cd frontend
npm run build -- --configuration production
if [ $? -ne 0 ]; then
    error "Erreur lors du build du frontend"
    exit 1
fi
cd ..
info "Build frontend terminé"
echo ""

# Étape 5: Build des images Docker
info "Étape 5/6: Construction des images Docker..."
docker-compose build --no-cache
if [ $? -ne 0 ]; then
    error "Erreur lors de la construction des images Docker"
    exit 1
fi
info "Images Docker construites avec succès"
echo ""

# Étape 6: Vérification des images
info "Étape 6/6: Vérification des images créées..."
echo ""
docker images | grep -E "suivi-cb|REPOSITORY"
echo ""

# Afficher un résumé
echo "======================================"
echo -e "${GREEN}Build terminé avec succès!${NC}"
echo "======================================"
echo ""
echo "Prochaines étapes:"
echo "1. Tester localement: docker-compose up -d"
echo "2. Vérifier les logs: docker-compose logs -f"
echo "3. Tester l'application: http://localhost:4200"
echo "4. Déployer sur le NAS (voir INSTALLATION_NAS.md)"
echo ""
echo "Commandes utiles:"
echo "- Démarrer: docker-compose up -d"
echo "- Arrêter: docker-compose down"
echo "- Logs: docker-compose logs -f"
echo "- Status: docker-compose ps"
echo ""
