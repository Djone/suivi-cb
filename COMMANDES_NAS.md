# Commandes utiles pour le NAS Synology

Ce document regroupe toutes les commandes utiles pour gérer l'application sur le NAS.

## Connexion au NAS

```bash
# Connexion SSH standard
ssh admin@192.168.1.100 -p 22

Saisir le mot de passa

sudo -i

Saisir le mot de passa
```

## Navigation

```bash
# Aller dans le dossier de l'application
cd /volume1/docker/suivi-cb

# Lister les fichiers
ls -lah

# Voir l'arborescence
tree -L 2

# Vérifier l'espace disque
df -h

# Taille du dossier de l'application
du -sh /volume1/docker/suivi-cb

# Taille de la base de données
ls -lh /volume1/docker/suivi-cb/data/database.db
```

## Gestion Docker Compose

### Démarrage et arrêt

```bash
# Démarrer l'application (mode détaché)
sudo docker-compose up -d

# Démarrer et voir les logs
sudo docker-compose up

# Arrêter l'application (sans supprimer les containers)
sudo docker-compose stop

# Arrêter et supprimer les containers
sudo docker-compose down

# Arrêter, supprimer containers et volumes
sudo docker-compose down -v  # ATTENTION: Supprime les données!

# Redémarrer l'application
sudo docker-compose restart

# Redémarrer un seul service
sudo docker-compose restart backend
sudo docker-compose restart frontend
```

### Build et reconstruction

```bash
# Build des images
sudo docker-compose build

# Build sans cache (recommandé pour les mises à jour)
sudo docker-compose build --no-cache

# Build et démarrage
sudo docker-compose up -d --build

# Rebuild d'un seul service
sudo docker-compose build backend
sudo docker-compose build frontend
```

### Status et informations

```bash
# Voir l'état des containers
sudo docker-compose ps

# Voir les processus dans les containers
sudo docker-compose top

# Voir les statistiques en temps réel
sudo docker stats

# Voir les statistiques sans stream
sudo docker stats --no-stream

# Inspecter la configuration
sudo docker-compose config

# Voir les événements
sudo docker-compose events
```

## Logs

### Consultation des logs

```bash
# Tous les logs
sudo docker-compose logs

# Logs en temps réel (suivre)
sudo docker-compose logs -f

# Dernières 50 lignes
sudo docker-compose logs --tail=50

# Logs du backend uniquement
sudo docker-compose logs backend
sudo docker-compose logs -f backend

# Logs du frontend uniquement
sudo docker-compose logs frontend
sudo docker-compose logs -f frontend

# Logs avec timestamps
sudo docker-compose logs -t

# Logs depuis une date
sudo docker-compose logs --since 2025-10-21

# Logs des dernières 2 heures
sudo docker-compose logs --since 2h
```

### Filtrage des logs

```bash
# Rechercher "error" dans les logs
sudo docker-compose logs | grep -i error

# Rechercher "warning"
sudo docker-compose logs | grep -i warn

# Compter les erreurs
sudo docker-compose logs | grep -i error | wc -l

# Sauvegarder les logs dans un fichier
sudo docker-compose logs > logs_$(date +%Y%m%d).txt

# Logs backend avec erreurs uniquement
sudo docker-compose logs backend | grep -i error
```

## Accès aux containers

### Shell dans les containers

```bash
# Accéder au shell du backend
sudo docker exec -it suivi-cb-backend sh

# Accéder au shell du frontend
sudo docker exec -it suivi-cb-frontend sh

# Exécuter une commande dans le backend
sudo docker exec suivi-cb-backend ls -la /app

# Exécuter une commande en tant que root
sudo docker exec -u root suivi-cb-backend apk add curl
```

### Inspection des containers

```bash
# Inspecter le backend
sudo docker inspect suivi-cb-backend

# Voir les volumes montés
sudo docker inspect suivi-cb-backend | grep -A 10 Mounts

# Voir les variables d'environnement
sudo docker inspect suivi-cb-backend | grep -A 20 Env

# Voir le réseau
sudo docker inspect suivi-cb-backend | grep -A 10 Networks

# Voir les ports
sudo docker port suivi-cb-backend
sudo docker port suivi-cb-frontend

# Healthcheck
sudo docker inspect suivi-cb-backend | grep -A 15 Health
```

## Gestion de la base de données

### Backup manuel

```bash
# Backup simple
cp /volume1/docker/suivi-cb/data/database.db \
   /volume1/docker/suivi-cb/backups/database_$(date +%Y%m%d_%H%M%S).db

# Backup avec vérification
DATE=$(date +%Y%m%d_%H%M%S)
cp /volume1/docker/suivi-cb/data/database.db \
   /volume1/docker/suivi-cb/backups/database_$DATE.db && \
echo "Backup créé: database_$DATE.db"

# Backup complet (application + base)
tar -czf /volume1/Backups/suivi-cb_full_$(date +%Y%m%d).tar.gz \
  /volume1/docker/suivi-cb/data/ \
  /volume1/docker/suivi-cb/docker-compose.yml \
  --exclude='logs/*'
```

### Restauration

```bash
# Arrêter le backend
sudo docker-compose stop backend

# Restaurer un backup
cp /volume1/docker/suivi-cb/backups/database_20251021_120000.db \
   /volume1/docker/suivi-cb/data/database.db

# Redémarrer le backend
sudo docker-compose start backend

# Vérifier les logs
sudo docker-compose logs -f backend
```

### Consultation SQLite

```bash
# Accéder à SQLite dans le container
sudo docker exec -it suivi-cb-backend sh
sqlite3 /app/data/database.db

# Commandes SQLite utiles:
.tables                              # Lister les tables
.schema transactions                 # Voir le schéma
SELECT COUNT(*) FROM transactions;   # Compter les enregistrements
SELECT * FROM transactions LIMIT 10; # Afficher 10 transactions
.quit                                # Quitter

# Requête directe sans entrer dans le shell
sudo docker exec suivi-cb-backend \
  sqlite3 /app/data/database.db "SELECT COUNT(*) FROM transactions;"

# Export CSV
sudo docker exec suivi-cb-backend \
  sqlite3 /app/data/database.db \
  "SELECT * FROM transactions;" > transactions.csv
```

## Gestion des images Docker

### Liste et nettoyage

```bash
# Lister les images
sudo docker images

# Lister les images de l'application
sudo docker images | grep suivi-cb

# Supprimer une image spécifique
sudo docker rmi suivi-cb_backend:latest
sudo docker rmi suivi-cb_frontend:latest

# Supprimer les images non utilisées
sudo docker image prune

# Supprimer toutes les images non utilisées (force)
sudo docker image prune -a -f

# Voir l'espace utilisé par Docker
sudo docker system df

# Nettoyer tout (images, containers, volumes, cache)
sudo docker system prune -a --volumes  # ATTENTION: Destructif!
```

### Build et tag

```bash
# Builder avec un tag spécifique
sudo docker build -t suivi-cb-backend:1.0.0 -f Dockerfile.backend .

# Tag d'une image
sudo docker tag suivi-cb_backend:latest suivi-cb_backend:1.0.0

# Voir l'historique d'une image
sudo docker history suivi-cb_backend:latest
```

## Réseau Docker

```bash
# Lister les réseaux
sudo docker network ls

# Inspecter le réseau de l'application
sudo docker network inspect suivi-cb_suivi-cb-network

# Voir les containers connectés
sudo docker network inspect suivi-cb_suivi-cb-network | grep -A 5 Containers

# Tester la connectivité entre containers
sudo docker exec suivi-cb-frontend ping backend
sudo docker exec suivi-cb-frontend wget -O- http://backend:3001/api/config/active-accounts
```

## Volumes Docker

```bash
# Lister les volumes
sudo docker volume ls

# Inspecter un volume
sudo docker volume inspect suivi-cb_data

# Voir l'espace utilisé
sudo du -sh /volume1/@docker/volumes/

# Nettoyer les volumes non utilisés
sudo docker volume prune

# Backup d'un volume
sudo docker run --rm \
  -v suivi-cb_data:/data \
  -v /volume1/Backups:/backup \
  alpine tar czf /backup/volume_backup_$(date +%Y%m%d).tar.gz /data
```

## Surveillance et monitoring

### Resources système

```bash
# CPU et RAM en temps réel
sudo docker stats

# Snapshot unique
sudo docker stats --no-stream

# Processus dans un container
sudo docker top suivi-cb-backend

# Événements Docker en temps réel
sudo docker events

# Événements filtrés (containers uniquement)
sudo docker events --filter 'type=container'
```

### Healthchecks

```bash
# Status de santé du backend
sudo docker inspect --format='{{json .State.Health}}' suivi-cb-backend | jq

# Historique des healthchecks
sudo docker inspect suivi-cb-backend | grep -A 50 Health

# Test manuel de l'API
curl http://localhost:3001/api/config/active-accounts

# Test avec détails
curl -v http://localhost:3001/api/config/active-accounts
```

### Surveillance des logs

```bash
# Suivre les erreurs en temps réel
sudo docker-compose logs -f | grep -i error

# Alertes pour certains mots-clés
sudo docker-compose logs -f | grep -E "error|fatal|exception"

# Compter les erreurs par heure
sudo docker-compose logs --since 1h | grep -i error | wc -l
```

## Mise à jour de l'application

### Via Git

```bash
# Se positionner dans le dossier
cd /volume1/docker/suivi-cb

# Vérifier l'état
git status
git log -5 --oneline

# Récupérer les modifications
git fetch origin
git log HEAD..origin/main --oneline

# Mettre à jour
git pull origin main

# Ou une version spécifique
git checkout v1.1.0
```

### Processus complet de mise à jour

```bash
cd /volume1/docker/suivi-cb

# 1. Backup
DATE=$(date +%Y%m%d_%H%M%S)
cp data/database.db backups/database_before_update_$DATE.db

# 2. Arrêt
sudo docker-compose stop

# 3. Récupérer le nouveau code
git pull origin main

# 4. Rebuild
sudo docker-compose build --no-cache

# 5. Démarrage
sudo docker-compose up -d

# 6. Vérification
sudo docker-compose logs -f
```

## Dépannage

### Redémarrage complet

```bash
# Solution 1: Redémarrage simple
sudo docker-compose restart

# Solution 2: Redémarrage propre
sudo docker-compose down
sudo docker-compose up -d

# Solution 3: Rebuild complet
sudo docker-compose down
sudo docker-compose build --no-cache
sudo docker-compose up -d

# Solution 4: Nettoyage complet (ATTENTION)
sudo docker-compose down -v
sudo docker system prune -a -f
sudo docker-compose build --no-cache
sudo docker-compose up -d
```

### Problèmes courants

```bash
# Container ne démarre pas
sudo docker-compose logs backend
sudo docker inspect suivi-cb-backend

# Port déjà utilisé
sudo netstat -tulpn | grep 3001
sudo netstat -tulpn | grep 4200

# Libérer un port (trouver le PID puis kill)
sudo lsof -i :3001
sudo kill -9 PID

# Permissions de la base de données
ls -la data/database.db
chmod 644 data/database.db

# Problème de réseau
sudo docker network inspect suivi-cb_suivi-cb-network
sudo docker-compose down
sudo docker network prune
sudo docker-compose up -d
```

### Tests de fonctionnement

```bash
# Test API backend
curl http://localhost:3001/api/config/active-accounts

# Test avec détails
curl -v http://localhost:3001/api/config/active-accounts

# Test depuis le container frontend
sudo docker exec suivi-cb-frontend wget -O- http://backend:3001/api/config/active-accounts

# Test du frontend
curl http://localhost:4200

# Test healthcheck
curl http://localhost:3001/api/config/active-accounts
echo $?  # Doit retourner 0 si OK
```

## Scripts utiles

### Script de backup automatique

Créez `/volume1/docker/suivi-cb/backup.sh`:

```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/volume1/docker/suivi-cb/backups"
SOURCE_DB="/volume1/docker/suivi-cb/data/database.db"

mkdir -p $BACKUP_DIR
cp $SOURCE_DB $BACKUP_DIR/database_$DATE.db

# Garder 30 derniers backups
ls -t $BACKUP_DIR/database_*.db | tail -n +31 | xargs rm -f

echo "Backup terminé: database_$DATE.db"
```

Utilisation:
```bash
chmod +x backup.sh
./backup.sh
```

### Script de monitoring

Créez `/volume1/docker/suivi-cb/monitor.sh`:

```bash
#!/bin/bash

echo "=== Status des containers ==="
sudo docker-compose ps

echo ""
echo "=== Utilisation des ressources ==="
sudo docker stats --no-stream

echo ""
echo "=== Dernières erreurs (10) ==="
sudo docker-compose logs --tail=100 | grep -i error | tail -10

echo ""
echo "=== Espace disque ==="
df -h /volume1

echo ""
echo "=== Taille de la base de données ==="
ls -lh data/database.db
```

### Script de mise à jour rapide

Créez `/volume1/docker/suivi-cb/quick-update.sh`:

```bash
#!/bin/bash
set -e

echo "=== Mise à jour rapide ==="

# Backup
echo "1. Backup..."
DATE=$(date +%Y%m%d_%H%M%S)
cp data/database.db backups/database_before_update_$DATE.db

# Update code
echo "2. Update code..."
git pull origin main

# Rebuild
echo "3. Rebuild..."
sudo docker-compose build --no-cache

# Restart
echo "4. Restart..."
sudo docker-compose down
sudo docker-compose up -d

# Verify
echo "5. Verification..."
sleep 10
sudo docker-compose ps
sudo docker-compose logs --tail=20

echo "=== Mise à jour terminée ==="
```

## Alias utiles

Ajoutez dans `~/.bashrc` ou `~/.zshrc`:

```bash
# Aliases pour l'application Suivi CB
alias cb='cd /volume1/docker/suivi-cb'
alias cbup='cd /volume1/docker/suivi-cb && sudo docker-compose up -d'
alias cbdown='cd /volume1/docker/suivi-cb && sudo docker-compose down'
alias cbrestart='cd /volume1/docker/suivi-cb && sudo docker-compose restart'
alias cblogs='cd /volume1/docker/suivi-cb && sudo docker-compose logs -f'
alias cbps='cd /volume1/docker/suivi-cb && sudo docker-compose ps'
alias cbstats='sudo docker stats'
alias cbbackup='cd /volume1/docker/suivi-cb && ./backup.sh'
```

Puis rechargez:
```bash
source ~/.bashrc
```

## Références rapides

### Ports utilisés
- `3001`: Backend API
- `4200`: Frontend (mappé sur 80 dans le container)
- `443`: HTTPS (via reverse proxy DSM)

### Chemins importants
- Application: `/volume1/docker/suivi-cb`
- Base de données: `/volume1/docker/suivi-cb/data/database.db`
- Backups: `/volume1/docker/suivi-cb/backups`
- Logs: `/volume1/docker/suivi-cb/logs`

### Commandes les plus utilisées
```bash
sudo docker-compose ps          # Status
sudo docker-compose logs -f     # Logs
sudo docker-compose restart     # Redémarrer
sudo docker-compose up -d       # Démarrer
sudo docker-compose down        # Arrêter
```

---

**Astuce**: Ajoutez cette page aux favoris pour un accès rapide aux commandes!
