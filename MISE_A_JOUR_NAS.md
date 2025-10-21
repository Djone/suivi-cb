# Guide de mise à jour sur Synology NAS

Ce guide explique comment mettre à jour l'application Suivi CB déployée sur votre NAS Synology.

## Prérequis

- Application déjà installée et fonctionnelle sur le NAS
- Accès SSH au NAS ou accès à Container Manager
- Code source de la nouvelle version disponible

## Stratégie de mise à jour

### Types de mise à jour

1. **Mise à jour mineure** (bug fixes, petites améliorations)
   - Pas de changement de base de données
   - Processus rapide (5-10 minutes)
   - Risque faible

2. **Mise à jour majeure** (nouvelles fonctionnalités, changements de schéma)
   - Peut nécessiter des migrations de base de données
   - Processus plus long (15-30 minutes)
   - Backup obligatoire

## Méthode 1: Mise à jour via SSH (Recommandée)

### Étape 1: Backup avant mise à jour

**IMPORTANT: Toujours faire un backup avant toute mise à jour**

```bash
# Connexion SSH
ssh votre_utilisateur@IP_NAS

# Naviguer vers le dossier de l'application
cd /volume1/docker/suivi-cb

# Créer un backup de la base de données
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p backups
cp data/database.db backups/database_before_update_$DATE.db

# Vérifier le backup
ls -lh backups/

# Optionnel: Backup complet du dossier
tar -czf backups/suivi-cb_backup_$DATE.tar.gz \
  data/ \
  docker-compose.yml \
  --exclude='logs/*'

echo "Backup créé: backups/suivi-cb_backup_$DATE.tar.gz"
```

### Étape 2: Arrêter l'application

```bash
# Arrêter les containers sans les supprimer
sudo docker-compose stop

# Vérifier que les containers sont arrêtés
sudo docker-compose ps
```

### Étape 3: Récupérer la nouvelle version

**Option A: Via Git (si vous utilisez Git)**

```bash
# Vérifier la branche actuelle
git branch

# Récupérer les dernières modifications
git fetch origin

# Voir les changements disponibles
git log HEAD..origin/main --oneline

# Mettre à jour le code
git pull origin main

# Ou pour une version spécifique
git checkout v1.1.0  # Remplacer par le tag de version
```

**Option B: Téléchargement manuel**

```bash
# Créer un dossier temporaire
mkdir -p /volume1/docker/temp

# Depuis votre ordinateur, transférez les fichiers
# scp -r /chemin/local/suivi-cb/* votre_utilisateur@IP_NAS:/volume1/docker/temp/

# Sur le NAS, copier les nouveaux fichiers
cp -r /volume1/docker/temp/* /volume1/docker/suivi-cb/

# Nettoyer
rm -rf /volume1/docker/temp
```

### Étape 4: Vérifier les changements de configuration

```bash
# Comparer les fichiers docker-compose.yml
diff docker-compose.yml docker-compose.yml.new

# Vérifier s'il y a de nouvelles variables d'environnement
cat docker-compose.yml | grep -A 5 "environment:"
```

### Étape 5: Reconstruire les images Docker

```bash
# Supprimer les anciennes images (optionnel mais recommandé)
sudo docker-compose down

# Reconstruire les images avec la nouvelle version
sudo docker-compose build --no-cache

# Vérifier que les images sont créées
sudo docker images | grep suivi-cb
```

### Étape 6: Appliquer les migrations (si nécessaire)

Si la nouvelle version inclut des migrations de base de données:

```bash
# Démarrer uniquement le backend pour les migrations
sudo docker-compose up -d backend

# Suivre les logs pour voir les migrations
sudo docker-compose logs -f backend

# Attendre que les migrations soient terminées
# Vous devriez voir des messages comme:
# "Migration XXX terminée avec succès"
```

### Étape 7: Démarrer l'application

```bash
# Démarrer tous les containers
sudo docker-compose up -d

# Vérifier que tout est démarré
sudo docker-compose ps

# Surveiller les logs
sudo docker-compose logs -f
```

### Étape 8: Vérifier le fonctionnement

```bash
# Test de l'API backend
curl http://localhost:3001/api/config/active-accounts

# Vérifier les healthchecks
sudo docker ps --format "table {{.Names}}\t{{.Status}}"

# Vérifier les logs d'erreurs
sudo docker-compose logs | grep -i error
```

### Étape 9: Test complet

1. Ouvrir l'application dans un navigateur: `http://IP_NAS:4200`
2. Vérifier toutes les fonctionnalités principales:
   - Affichage des comptes
   - Affichage des transactions
   - Création d'une nouvelle transaction
   - Affichage des statistiques
   - Export de données
3. Vérifier depuis l'extérieur: `https://finances.votredomaine.com`

### Étape 10: Nettoyage

```bash
# Supprimer les anciennes images Docker inutilisées
sudo docker image prune -f

# Supprimer les anciens containers
sudo docker container prune -f

# Supprimer les anciens backups (garder les 10 derniers)
cd backups
ls -t database_*.db | tail -n +11 | xargs rm -f
```

## Méthode 2: Mise à jour via Container Manager

### Étape 1: Backup

1. Ouvrez **File Station**
2. Naviguez vers `/docker/suivi-cb/data`
3. Cliquez droit sur `database.db` > **Télécharger**
4. Sauvegardez sur votre ordinateur avec un nom explicite:
   - `database_backup_2025-10-21.db`

### Étape 2: Arrêter le projet

1. Ouvrez **Container Manager**
2. Allez dans **Projet**
3. Sélectionnez `suivi-cb`
4. Cliquez sur **Action** > **Arrêter**

### Étape 3: Mettre à jour les fichiers

1. Ouvrez **File Station**
2. Naviguez vers `/docker/suivi-cb`
3. Uploadez les nouveaux fichiers (écrasez les anciens)
   - `Dockerfile.backend`
   - `Dockerfile.frontend`
   - `docker-compose.yml`
   - `nginx.conf`
   - Dossiers `frontend/` et `backend/`

### Étape 4: Reconstruire le projet

1. Dans **Container Manager** > **Projet**
2. Sélectionnez `suivi-cb`
3. Cliquez sur **Action** > **Build**
4. Attendez la fin de la construction

### Étape 5: Démarrer le projet

1. Cliquez sur **Action** > **Démarrer**
2. Surveillez les logs dans l'onglet **Logs**

### Étape 6: Vérification

1. Allez dans **Container**
2. Vérifiez que `suivi-cb-backend` et `suivi-cb-frontend` sont "Running"
3. Testez l'application dans votre navigateur

## Rollback en cas de problème

Si la mise à jour échoue ou cause des problèmes:

### Rollback rapide (via SSH)

```bash
# Arrêter l'application
sudo docker-compose down

# Restaurer la base de données depuis le backup
cp backups/database_before_update_YYYYMMDD_HHMMSS.db data/database.db

# Revenir à la version précédente avec Git
git checkout v1.0.0  # Version précédente

# Reconstruire avec l'ancienne version
sudo docker-compose build --no-cache
sudo docker-compose up -d

# Vérifier les logs
sudo docker-compose logs -f
```

### Rollback complet (restauration d'archive)

```bash
# Arrêter tout
sudo docker-compose down

# Restaurer depuis l'archive complète
cd /volume1/docker
rm -rf suivi-cb
tar -xzf suivi-cb/backups/suivi-cb_backup_YYYYMMDD_HHMMSS.tar.gz

# Redémarrer
cd suivi-cb
sudo docker-compose up -d
```

## Checklist de mise à jour

Utilisez cette checklist pour chaque mise à jour:

### Avant la mise à jour

- [ ] Lire les notes de version (CHANGELOG)
- [ ] Identifier le type de mise à jour (mineure/majeure)
- [ ] Vérifier les breaking changes
- [ ] Planifier une fenêtre de maintenance
- [ ] Informer les utilisateurs si nécessaire

### Pendant la mise à jour

- [ ] Créer un backup complet de la base de données
- [ ] Créer une archive du dossier complet (optionnel)
- [ ] Arrêter l'application proprement
- [ ] Récupérer la nouvelle version du code
- [ ] Vérifier les changements de configuration
- [ ] Reconstruire les images Docker
- [ ] Appliquer les migrations si nécessaire
- [ ] Démarrer l'application

### Après la mise à jour

- [ ] Vérifier les logs d'erreurs
- [ ] Tester les fonctionnalités principales
- [ ] Vérifier les performances
- [ ] Tester l'accès depuis l'extérieur
- [ ] Nettoyer les anciennes images
- [ ] Documenter la mise à jour (date, version, problèmes)

## Gestion des versions

### Suivre les versions

Créez un fichier pour suivre les versions installées:

```bash
# Créer un fichier de versions
echo "v1.0.0 - 2025-10-21 - Installation initiale" >> /volume1/docker/suivi-cb/VERSION_HISTORY.txt

# À chaque mise à jour, ajoutez une ligne
echo "v1.1.0 - 2025-11-15 - Mise à jour mineure - Nouveaux graphiques" >> /volume1/docker/suivi-cb/VERSION_HISTORY.txt
```

### Tags Docker

Utilisez des tags pour les images:

```yaml
# Dans docker-compose.yml
services:
  backend:
    image: suivi-cb-backend:1.1.0  # Spécifier la version
    build:
      context: .
      dockerfile: Dockerfile.backend
```

## Automatisation

### Script de mise à jour automatique

Créez un script `update.sh`:

```bash
#!/bin/bash

echo "=== Mise à jour Suivi CB ==="

# Configuration
APP_DIR="/volume1/docker/suivi-cb"
BACKUP_DIR="$APP_DIR/backups"
DATE=$(date +%Y%m%d_%H%M%S)

# Fonction de rollback
rollback() {
    echo "ERREUR: Rollback en cours..."
    sudo docker-compose down
    cp $BACKUP_DIR/database_before_update_$DATE.db $APP_DIR/data/database.db
    git checkout -
    sudo docker-compose up -d
    exit 1
}

# Backup
echo "1. Création du backup..."
mkdir -p $BACKUP_DIR
cp $APP_DIR/data/database.db $BACKUP_DIR/database_before_update_$DATE.db || rollback

# Arrêt
echo "2. Arrêt de l'application..."
cd $APP_DIR
sudo docker-compose stop || rollback

# Mise à jour
echo "3. Récupération de la nouvelle version..."
git pull origin main || rollback

# Rebuild
echo "4. Reconstruction des images..."
sudo docker-compose build --no-cache || rollback

# Démarrage
echo "5. Démarrage de l'application..."
sudo docker-compose up -d || rollback

# Vérification
echo "6. Vérification..."
sleep 10
if ! curl -f http://localhost:3001/api/config/active-accounts > /dev/null 2>&1; then
    echo "ERREUR: L'API ne répond pas"
    rollback
fi

# Nettoyage
echo "7. Nettoyage..."
sudo docker image prune -f

echo "=== Mise à jour terminée avec succès ==="
echo "Version mise à jour le $DATE"
```

Utilisation:

```bash
# Rendre le script exécutable
chmod +x update.sh

# Exécuter
./update.sh
```

## Monitoring post-mise à jour

### Surveiller pendant 24h

Après chaque mise à jour, surveillez:

```bash
# Logs en temps réel
sudo docker-compose logs -f

# Erreurs uniquement
sudo docker-compose logs | grep -i error

# Utilisation des ressources
sudo docker stats --no-stream

# Healthchecks
watch -n 30 'sudo docker ps --format "table {{.Names}}\t{{.Status}}"'
```

### Créer une alerte

Dans DSM:
1. **Panneau de configuration** > **Notification**
2. Configurez les notifications par email
3. Activez les alertes pour:
   - Container arrêté
   - Utilisation CPU/RAM élevée
   - Espace disque faible

## Troubleshooting mise à jour

### Le container ne démarre pas après mise à jour

```bash
# Voir les logs d'erreur
sudo docker-compose logs backend

# Vérifier la compatibilité des images
sudo docker images | grep suivi-cb

# Reconstruire complètement
sudo docker-compose down
sudo docker system prune -a
sudo docker-compose build --no-cache
sudo docker-compose up -d
```

### Erreur de migration de base de données

```bash
# Restaurer le backup
cp backups/database_before_update_YYYYMMDD_HHMMSS.db data/database.db

# Appliquer les migrations manuellement
sudo docker exec -it suivi-cb-backend sh
cd migrations
node nomDeLaMigration.js
exit

# Redémarrer
sudo docker-compose restart backend
```

### L'application est accessible mais les données sont manquantes

```bash
# Vérifier que la base de données est bien montée
sudo docker inspect suivi-cb-backend | grep -A 10 Mounts

# Vérifier les permissions
ls -la data/database.db

# Restaurer le backup si nécessaire
```

## Bonnes pratiques

1. **Toujours tester en local d'abord** avant de déployer sur le NAS
2. **Lire les notes de version** avant toute mise à jour
3. **Faire des backups** avant chaque mise à jour
4. **Planifier les mises à jour** pendant les heures creuses
5. **Documenter** chaque mise à jour dans VERSION_HISTORY.txt
6. **Garder plusieurs backups** des versions précédentes
7. **Tester complètement** après chaque mise à jour
8. **Surveiller les logs** pendant 24h après la mise à jour

## Support

En cas de problème lors d'une mise à jour:

1. Consultez les logs: `sudo docker-compose logs`
2. Vérifiez les notes de version pour les breaking changes
3. Consultez la documentation Docker
4. En dernier recours, faites un rollback et demandez de l'aide

## Prochaines étapes

- Configurez des sauvegardes automatiques (voir INSTALLATION_NAS.md)
- Mettez en place un monitoring avec des alertes
- Planifiez les mises à jour régulières (mensuelles recommandées)
