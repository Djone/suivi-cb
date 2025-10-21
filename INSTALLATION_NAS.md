# Guide d'installation sur Synology NAS

Ce guide explique comment installer et démarrer l'application Suivi CB sur votre NAS Synology.

## Prérequis

Avant de commencer, assurez-vous d'avoir:

1. Complété les étapes de configuration décrites dans [DEPLOYMENT_SYNOLOGY.md](./DEPLOYMENT_SYNOLOGY.md)
2. Container Manager installé sur votre NAS
3. Accès SSH au NAS (recommandé) ou accès à File Station
4. Le code source de l'application sur votre ordinateur
5. Git installé (pour cloner le dépôt)

## Méthode 1: Installation via SSH (Recommandée)

### Étape 1: Connexion SSH au NAS

Depuis votre ordinateur:

```bash
ssh votre_utilisateur@IP_NAS
# Ou avec le nom de domaine
ssh votre_utilisateur@nas.votredomaine.com
```

Entrez votre mot de passe DSM.

### Étape 2: Naviguer vers le dossier Docker

```bash
cd /volume1/docker
# Si votre volume principal n'est pas volume1, ajustez le chemin
```

### Étape 3: Cloner le dépôt Git

```bash
# Cloner le dépôt
git clone https://github.com/votre-username/suivi-cb.git
cd suivi-cb

# Ou si vous utilisez une autre méthode, créez le dossier
mkdir -p suivi-cb
cd suivi-cb
```

### Étape 4: Créer les dossiers de données

```bash
# Créer les répertoires nécessaires
mkdir -p data
mkdir -p logs/backend
mkdir -p logs/frontend

# Définir les permissions
chmod 755 data logs
```

### Étape 5: Copier la base de données (si elle existe)

Si vous avez déjà une base de données SQLite en développement:

```bash
# Depuis votre ordinateur, copiez la base de données vers le NAS
scp /chemin/local/database.db votre_utilisateur@IP_NAS:/volume1/docker/suivi-cb/data/
```

### Étape 6: Construire et démarrer les containers

```bash
# Construire les images Docker
sudo docker-compose build

# Démarrer les containers
sudo docker-compose up -d

# Vérifier que les containers sont démarrés
sudo docker-compose ps
```

Vous devriez voir:

```
NAME                   STATUS              PORTS
suivi-cb-backend      Up X minutes        0.0.0.0:3001->3001/tcp
suivi-cb-frontend     Up X minutes        0.0.0.0:4200->80/tcp
```

### Étape 7: Vérifier les logs

```bash
# Voir les logs du backend
sudo docker-compose logs -f backend

# Voir les logs du frontend
sudo docker-compose logs -f frontend

# Voir tous les logs
sudo docker-compose logs -f
```

Appuyez sur `Ctrl+C` pour quitter le mode logs.

## Méthode 2: Installation via Container Manager UI

### Étape 1: Préparer les fichiers

1. Sur votre ordinateur, préparez un dossier avec tous les fichiers du projet
2. Compressez le dossier en `.zip` ou `.tar.gz`

### Étape 2: Transférer les fichiers

Via **File Station**:

1. Ouvrez File Station dans DSM
2. Naviguez vers `/docker/`
3. Créez un dossier `suivi-cb`
4. Uploadez et décompressez les fichiers dans ce dossier
5. Créez les sous-dossiers `data` et `logs`

### Étape 3: Utiliser Container Manager

1. Ouvrez **Container Manager** dans DSM
2. Allez dans l'onglet **Projet**
3. Cliquez sur **Créer**
4. Configuration:
   - Nom du projet: `suivi-cb`
   - Chemin: `/docker/suivi-cb`
   - Source: `Créer docker-compose.yml`
5. Collez le contenu du fichier `docker-compose.yml`
6. Cliquez sur **Suivant** puis **Terminé**

Container Manager va automatiquement:
- Construire les images
- Créer les containers
- Démarrer l'application

### Étape 4: Vérifier le statut

Dans Container Manager:

1. Allez dans **Container**
2. Vérifiez que `suivi-cb-backend` et `suivi-cb-frontend` sont en état "Running"
3. Cliquez sur un container pour voir les logs et les détails

## Étape 8: Tester l'application

### Test en local (réseau interne)

1. Ouvrez un navigateur
2. Accédez à `http://IP_NAS:4200`
3. L'application devrait se charger

### Test de l'API backend

```bash
# Depuis le NAS ou votre ordinateur
curl http://IP_NAS:3001/api/config/active-accounts
```

### Test via le domaine HTTPS

1. Ouvrez un navigateur
2. Accédez à `https://finances.votredomaine.com`
3. L'application devrait se charger avec un certificat SSL valide

## Configuration post-installation

### Importer les données existantes

Si vous avez des données à importer:

1. **Via l'interface web**: Utilisez la fonctionnalité d'import CSV de l'application
2. **Via la base de données directement**:

```bash
# Copier votre base de données existante
scp database.db votre_utilisateur@IP_NAS:/volume1/docker/suivi-cb/data/

# Redémarrer le backend pour prendre en compte les changements
sudo docker-compose restart backend
```

### Configurer les sauvegardes automatiques

Créez une tâche planifiée dans DSM:

1. Allez dans **Panneau de configuration** > **Planificateur de tâches**
2. Créez une tâche planifiée > Script défini par l'utilisateur
3. Configuration:
   - Nom: `Backup Suivi CB`
   - Utilisateur: `root`
   - Planification: Quotidienne à 2h00
   - Script:

```bash
#!/bin/bash
# Backup de la base de données
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/volume1/Backups/suivi-cb"
SOURCE_DB="/volume1/docker/suivi-cb/data/database.db"

# Créer le dossier de backup s'il n'existe pas
mkdir -p $BACKUP_DIR

# Copier la base de données
cp $SOURCE_DB $BACKUP_DIR/database_$DATE.db

# Garder seulement les 30 derniers backups
ls -t $BACKUP_DIR/database_*.db | tail -n +31 | xargs rm -f

echo "Backup terminé: database_$DATE.db"
```

4. Cliquez sur **OK**

## Commandes utiles

### Gestion des containers

```bash
# Démarrer les containers
sudo docker-compose up -d

# Arrêter les containers
sudo docker-compose down

# Redémarrer les containers
sudo docker-compose restart

# Voir les logs
sudo docker-compose logs -f

# Voir le statut
sudo docker-compose ps

# Arrêter et supprimer tout (attention: supprime les containers)
sudo docker-compose down -v
```

### Gestion des images

```bash
# Lister les images
sudo docker images

# Supprimer une image
sudo docker rmi nom_image

# Nettoyer les images inutilisées
sudo docker image prune -a
```

### Accès au shell d'un container

```bash
# Accéder au backend
sudo docker exec -it suivi-cb-backend sh

# Accéder au frontend
sudo docker exec -it suivi-cb-frontend sh

# Sortir du shell
exit
```

### Inspection de la base de données

```bash
# Accéder au backend
sudo docker exec -it suivi-cb-backend sh

# Ouvrir SQLite
sqlite3 /app/data/database.db

# Commandes SQLite utiles
.tables                          # Lister les tables
.schema transactions             # Voir le schéma d'une table
SELECT COUNT(*) FROM transactions;  # Compter les enregistrements
.quit                            # Quitter SQLite
```

## Monitoring

### Vérifier l'état de santé des containers

```bash
# Voir les healthchecks
sudo docker inspect suivi-cb-backend | grep -A 10 Health
```

### Surveiller les ressources

Dans Container Manager:
1. Allez dans **Container**
2. Sélectionnez un container
3. Onglet **Statistiques** pour voir CPU, RAM, réseau

## Troubleshooting

### Les containers ne démarrent pas

```bash
# Vérifier les logs d'erreur
sudo docker-compose logs

# Vérifier les ports utilisés
sudo netstat -tulpn | grep -E ':(3001|4200)'

# Reconstruire les images
sudo docker-compose build --no-cache
sudo docker-compose up -d
```

### Erreur de base de données

```bash
# Vérifier les permissions
ls -la /volume1/docker/suivi-cb/data/

# Corriger les permissions si nécessaire
chmod 644 /volume1/docker/suivi-cb/data/database.db
```

### L'application est lente

```bash
# Vérifier les ressources
sudo docker stats

# Allouer plus de mémoire (modifier docker-compose.yml)
services:
  backend:
    mem_limit: 512m
  frontend:
    mem_limit: 256m
```

### Erreur de connexion API

1. Vérifiez que le backend est démarré: `sudo docker-compose ps`
2. Vérifiez les logs du backend: `sudo docker-compose logs backend`
3. Testez l'API directement: `curl http://localhost:3001/api/config/active-accounts`
4. Vérifiez la configuration nginx dans le container frontend

### Impossible d'accéder depuis l'extérieur

1. Vérifiez la configuration du reverse proxy dans DSM
2. Vérifiez la redirection de ports sur votre box
3. Testez avec votre IP publique: `curl https://votre-ip-publique`
4. Vérifiez les certificats SSL dans DSM

## Sécurité

### Recommandations

1. **Changer les ports par défaut** si exposés directement sur Internet
2. **Activer l'authentification** via DSM Portal ou dans l'application
3. **Limiter l'accès** aux IP de confiance via le pare-feu
4. **Sauvegardes régulières** de la base de données
5. **Mises à jour** régulières de l'application et de DSM

### Pare-feu applicatif

Dans DSM, configurez des règles de pare-feu:

1. **Panneau de configuration** > **Sécurité** > **Pare-feu**
2. Créez des règles pour autoriser uniquement:
   - Votre réseau local
   - Vos IP de confiance
   - Services VPN

## Performance

### Optimisations

1. **Cache navigateur**: Déjà configuré dans nginx.conf
2. **Compression gzip**: Déjà activée dans nginx.conf
3. **Index de base de données**: Vérifiez les index SQLite

```sql
-- Créer des index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account_id);
```

### Monitoring des performances

Installez des outils de monitoring:

```bash
# Surveiller les performances
sudo docker stats --no-stream

# Voir l'utilisation disque
du -sh /volume1/docker/suivi-cb/data/
```

## Support

Pour toute question ou problème:

1. Consultez les logs: `sudo docker-compose logs`
2. Vérifiez la documentation Docker: https://docs.docker.com
3. Forum Synology: https://community.synology.com
4. Documentation de l'application: voir README.md

## Prochaines étapes

Une fois l'installation terminée et testée, consultez:
- [MISE_A_JOUR_NAS.md](./MISE_A_JOUR_NAS.md) pour les futures mises à jour
- Documentation de l'application pour l'utilisation quotidienne
