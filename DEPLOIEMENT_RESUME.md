# Résumé du déploiement sur Synology NAS

Guide rapide pour déployer l'application Suivi CB sur votre NAS Synology.

## Documentation complète

- [DEPLOYMENT_SYNOLOGY.md](./DEPLOYMENT_SYNOLOGY.md) - Configuration du NAS
- [INSTALLATION_NAS.md](./INSTALLATION_NAS.md) - Installation de l'application
- [MISE_A_JOUR_NAS.md](./MISE_A_JOUR_NAS.md) - Guide de mise à jour

## Installation rapide

### 1. Prérequis sur le NAS

- DSM 7.2.2 ou supérieur
- Container Manager installé (via Package Center)
- SSH activé (optionnel mais recommandé)
- Dossier `/volume1/docker/suivi-cb` créé

### 2. Configuration du reverse proxy

Dans DSM > Panneau de configuration > Portail d'application > Reverse Proxy:

- Source: `https://finances.votredomaine.com:443`
- Destination: `http://localhost:4200`

### 3. Déploiement

**Option A: Avec le script automatique (Linux/Mac)**

```bash
# Configurer les paramètres
export NAS_USER=votre_utilisateur
export NAS_HOST=192.168.1.100  # IP de votre NAS

# Exécuter le script
chmod +x deploy-to-nas.sh
./deploy-to-nas.sh
```

**Option B: Manuel via SSH**

```bash
# Se connecter au NAS
ssh admin@IP_NAS

# Naviguer vers le dossier
cd /volume1/docker

# Cloner le dépôt
git clone https://github.com/votre-username/suivi-cb.git
cd suivi-cb

# Créer les dossiers
mkdir -p data logs/backend logs/frontend backups

# Construire et démarrer
sudo docker-compose build
sudo docker-compose up -d
```

**Option C: Via Container Manager UI**

1. Uploadez les fichiers via File Station dans `/docker/suivi-cb`
2. Ouvrez Container Manager
3. Allez dans Projet > Créer
4. Sélectionnez le dossier `/docker/suivi-cb`
5. Cliquez sur Build puis Démarrer

### 4. Vérification

```bash
# Vérifier les containers
sudo docker-compose ps

# Vérifier les logs
sudo docker-compose logs -f

# Tester l'API
curl http://localhost:3001/api/config/active-accounts
```

### 5. Accéder à l'application

- Réseau local: `http://IP_NAS:4200`
- Externe: `https://finances.votredomaine.com`

## Architecture Docker

```
┌─────────────────────────────────────────┐
│         Synology NAS (DSM 7.2)          │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │   Reverse Proxy (Port 443)        │  │
│  │   finances.votredomaine.com       │  │
│  └─────────────┬─────────────────────┘  │
│                │                         │
│                ▼                         │
│  ┌───────────────────────────────────┐  │
│  │   Container: suivi-cb-frontend    │  │
│  │   - Nginx + Angular SPA           │  │
│  │   - Port: 4200 → 80               │  │
│  │   - Proxy API → backend:3001      │  │
│  └─────────────┬─────────────────────┘  │
│                │                         │
│                ▼                         │
│  ┌───────────────────────────────────┐  │
│  │   Container: suivi-cb-backend     │  │
│  │   - Node.js/Express API           │  │
│  │   - Port: 3001                    │  │
│  │   - SQLite DB (volume persistant) │  │
│  └───────────────────────────────────┘  │
│                                         │
│  Volume persistant: /volume1/docker/    │
│  suivi-cb/data/database.db              │
└─────────────────────────────────────────┘
```

## Structure des fichiers

```
/volume1/docker/suivi-cb/
├── backend/                    # Code source backend
│   ├── routes/
│   ├── services/
│   ├── migrations/
│   └── server.js
├── frontend/                   # Code source frontend
│   └── src/
├── data/                       # Base de données (persistante)
│   └── database.db
├── logs/                       # Logs de l'application
│   ├── backend/
│   └── frontend/
├── backups/                    # Sauvegardes automatiques
│   └── database_YYYYMMDD.db
├── Dockerfile.backend          # Image Docker backend
├── Dockerfile.frontend         # Image Docker frontend
├── docker-compose.yml          # Configuration Docker Compose
├── nginx.conf                  # Configuration Nginx
└── .dockerignore              # Fichiers exclus du build
```

## Commandes essentielles

### Sur le NAS (via SSH)

```bash
cd /volume1/docker/suivi-cb

# Gestion des containers
sudo docker-compose up -d        # Démarrer
sudo docker-compose down          # Arrêter
sudo docker-compose restart       # Redémarrer
sudo docker-compose ps            # Status

# Logs
sudo docker-compose logs -f                  # Tous les logs
sudo docker-compose logs -f backend          # Backend uniquement
sudo docker-compose logs -f frontend         # Frontend uniquement

# Rebuild
sudo docker-compose build --no-cache         # Reconstruire les images
sudo docker-compose up -d --build            # Rebuild + restart

# Nettoyage
sudo docker image prune -f                   # Supprimer images inutilisées
sudo docker container prune -f               # Supprimer containers arrêtés
```

### Depuis votre ordinateur

```bash
# Build local
./build-production.sh      # Linux/Mac
build-production.bat       # Windows

# Déploiement automatique
./deploy-to-nas.sh         # Linux/Mac uniquement
```

## Mise à jour

```bash
# Se connecter au NAS
ssh admin@IP_NAS
cd /volume1/docker/suivi-cb

# Backup de la base de données
DATE=$(date +%Y%m%d_%H%M%S)
cp data/database.db backups/database_before_update_$DATE.db

# Récupérer les modifications
git pull origin main

# Rebuild et redémarrer
sudo docker-compose down
sudo docker-compose build --no-cache
sudo docker-compose up -d

# Vérifier
sudo docker-compose logs -f
```

## Sauvegardes

### Backup manuel

```bash
# Backup de la base de données
cp /volume1/docker/suivi-cb/data/database.db \
   /volume1/Backups/suivi-cb/database_$(date +%Y%m%d).db
```

### Backup automatique

Créez une tâche planifiée dans DSM (quotidienne à 2h00):

```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/volume1/Backups/suivi-cb"
mkdir -p $BACKUP_DIR
cp /volume1/docker/suivi-cb/data/database.db \
   $BACKUP_DIR/database_$DATE.db
# Garder les 30 derniers backups
ls -t $BACKUP_DIR/database_*.db | tail -n +31 | xargs rm -f
```

## Sécurité

### Recommandations

1. Changez les ports par défaut dans docker-compose.yml
2. Activez l'authentification (DSM Portal ou dans l'app)
3. Configurez le pare-feu pour limiter les accès
4. Utilisez un sous-domaine dédié avec certificat SSL
5. Sauvegardez régulièrement la base de données

### Configuration du pare-feu

DSM > Panneau de configuration > Sécurité > Pare-feu

Créez des règles pour:
- Autoriser port 443 (HTTPS) depuis Internet
- Autoriser port 4200 uniquement depuis le réseau local
- Bloquer tout le reste

## Monitoring

### Healthcheck

Les containers ont des healthchecks automatiques:

```bash
# Vérifier le statut
sudo docker ps --format "table {{.Names}}\t{{.Status}}"
```

### Logs

```bash
# Erreurs uniquement
sudo docker-compose logs | grep -i error

# Suivre en temps réel
sudo docker-compose logs -f --tail=50
```

### Ressources

```bash
# Utilisation CPU/RAM/Réseau
sudo docker stats
```

## Troubleshooting rapide

### Les containers ne démarrent pas

```bash
sudo docker-compose logs
sudo docker-compose build --no-cache
sudo docker-compose up -d
```

### L'application est inaccessible

1. Vérifiez les containers: `sudo docker-compose ps`
2. Vérifiez les logs: `sudo docker-compose logs`
3. Testez l'API: `curl http://localhost:3001/api/config/active-accounts`
4. Vérifiez le reverse proxy dans DSM

### Erreur de base de données

```bash
# Vérifier les permissions
ls -la /volume1/docker/suivi-cb/data/

# Restaurer un backup
cp backups/database_YYYYMMDD.db data/database.db
sudo docker-compose restart backend
```

## Support

- Documentation complète dans les fichiers `DEPLOYMENT_*.md`
- Logs: `sudo docker-compose logs`
- Forum Synology: https://community.synology.com
- Documentation Docker: https://docs.docker.com

## Prochaines étapes

1. Configurez les sauvegardes automatiques
2. Mettez en place des alertes de monitoring
3. Testez le processus de mise à jour
4. Configurez un domaine personnalisé avec SSL
5. Documentez votre configuration spécifique

---

**Version:** 1.0.0
**Dernière mise à jour:** 2025-10-21
**Testé sur:** Synology DSM 7.2.2 Update 4
