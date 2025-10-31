# Checklist de déploiement sur Synology NAS

Utilisez cette checklist pour vous assurer de ne rien oublier lors du déploiement.

## Phase 1: Préparation du NAS

### Installation des packages
- [ ] DSM 7.2.2+ installé et à jour
- [ ] Container Manager installé via Package Center
- [ ] Service SSH activé (Panneau de configuration > Terminal & SNMP)
- [ ] Accès SSH testé: `ssh admin@IP_NAS`

### Configuration réseau
- [ ] IP statique configurée pour le NAS (dans votre routeur)
- [ ] Ports 80 et 443 redirigés vers le NAS (sur votre box Internet)
- [ ] Nom de domaine configuré (ou DynDNS)
- [ ] Sous-domaine créé pour l'application (ex: finances.votredomaine.com)

### Configuration SSL
- [ ] Certificat SSL Let's Encrypt obtenu pour le sous-domaine
- [ ] Certificat assigné au sous-domaine dans DSM
- [ ] HTTPS fonctionnel: `https://finances.votredomaine.com`

### Reverse Proxy
- [ ] Reverse Proxy créé dans DSM (Panneau > Portail d'application)
  - [ ] Source: `https://finances.votredomaine.com:443`
  - [ ] Destination: `http://localhost:4200`
  - [ ] HSTS activé
  - [ ] HTTP/2 activé

### Structure des dossiers
- [ ] Dossier `/volume1/docker/suivi-cb` créé
- [ ] Permissions correctes (755)

## Phase 2: Préparation du code

### En local (sur votre ordinateur)
- [ ] Code à jour sur la branche main: `git status`
- [ ] Tests passent: `npm test`
- [ ] Pas de fichiers sensibles dans le commit
- [ ] Version taguée si nécessaire: `git tag v1.0.0`
- [ ] Code poussé sur Git: `git push origin main`

### Variables d'environnement
- [ ] Pas de fichier `.env` avec des secrets dans le code
- [ ] Variables d'environnement documentées
- [ ] Ports de production définis dans docker-compose.yml

## Phase 3: Déploiement

### Transfert du code

**Option A: Via Git (recommandé)**
- [ ] Connexion SSH au NAS
- [ ] Navigation vers `/volume1/docker`
- [ ] Clone du dépôt: `git clone URL`
- [ ] Code présent dans `/volume1/docker/suivi-cb`

**Option B: Via rsync/scp**
- [ ] Synchronisation des fichiers terminée
- [ ] Vérification des fichiers copiés

**Option C: Via File Station**
- [ ] Fichiers uploadés
- [ ] Archive décompressée
- [ ] Structure vérifiée

### Création des dossiers de données
```bash
cd /volume1/docker/suivi-cb
mkdir -p data logs/backend logs/frontend backups
chmod 755 data logs
```
- [ ] Dossier `data/` créé
- [ ] Dossier `logs/` créé
- [ ] Dossier `backups/` créé
- [ ] Permissions correctes

### Build Docker
```bash
sudo docker-compose build --no-cache
```
- [ ] Build backend réussi
- [ ] Build frontend réussi
- [ ] Images créées: `sudo docker images | grep suivi-cb`

### Démarrage
```bash
sudo docker-compose up -d
```
- [ ] Backend démarré: `suivi-cb-backend` (Running)
- [ ] Frontend démarré: `suivi-cb-frontend` (Running)
- [ ] Pas d'erreurs dans les logs: `sudo docker-compose logs`

## Phase 4: Vérification

### Tests en local (réseau interne)
- [ ] Frontend accessible: `http://IP_NAS:4200`
- [ ] API répond: `curl http://IP_NAS:3001/api/config/active-accounts`
- [ ] Interface utilisateur s'affiche correctement
- [ ] Pas d'erreurs dans la console navigateur (F12)

### Tests fonctionnels
- [ ] Affichage de la liste des comptes
- [ ] Affichage de la liste des transactions
- [ ] Création d'une nouvelle transaction
- [ ] Modification d'une transaction
- [ ] Suppression d'une transaction
- [ ] Affichage des statistiques
- [ ] Export de données (si implémenté)

### Tests depuis l'extérieur
- [ ] Application accessible via HTTPS: `https://finances.votredomaine.com`
- [ ] Certificat SSL valide (cadenas vert)
- [ ] Redirection HTTP → HTTPS fonctionne
- [ ] Test depuis un réseau externe (4G/5G)
- [ ] Test depuis plusieurs navigateurs (Chrome, Firefox, Safari)

### Vérification des containers
```bash
sudo docker-compose ps
sudo docker-compose logs -f
sudo docker stats --no-stream
```
- [ ] Les 2 containers sont "Up" et "healthy"
- [ ] Pas d'erreurs critiques dans les logs
- [ ] Utilisation CPU/RAM normale (<50%)

### Base de données
```bash
ls -lh data/database.db
```
- [ ] Fichier database.db créé
- [ ] Permissions correctes (644)
- [ ] Tables créées (migrations exécutées)

## Phase 5: Configuration post-déploiement

### Sauvegardes automatiques
- [ ] Tâche planifiée créée dans DSM
- [ ] Script de backup configuré
- [ ] Backup testé manuellement
- [ ] Vérification du dossier `/volume1/Backups/suivi-cb`

### Monitoring
- [ ] Healthcheck containers configuré
- [ ] Notifications email configurées (DSM)
- [ ] Alertes pour:
  - [ ] Container arrêté
  - [ ] CPU > 80%
  - [ ] RAM > 80%
  - [ ] Disque > 90%

### Sécurité
- [ ] Pare-feu configuré (si utilisé)
- [ ] Accès SSH sécurisé (clés SSH recommandées)
- [ ] Authentification activée (DSM Portal ou dans l'app)
- [ ] Auto-Block activé dans DSM (contre les tentatives de connexion)
- [ ] Logs de sécurité consultés

### Documentation
- [ ] Configuration spécifique documentée
- [ ] Mots de passe notés dans un gestionnaire sécurisé
- [ ] Procédure de restauration testée
- [ ] Contacts d'urgence notés

## Phase 6: Validation finale

### Checklist de validation
- [ ] Application accessible 24/7 pendant 48h
- [ ] Pas de redémarrage intempestif des containers
- [ ] Performances acceptables (temps de chargement < 3s)
- [ ] Base de données persiste après redémarrage
- [ ] Backup automatique fonctionne (vérifier après 24h)

### Tests de résilience
- [ ] Redémarrage du container backend: `sudo docker restart suivi-cb-backend`
- [ ] Redémarrage du container frontend: `sudo docker restart suivi-cb-frontend`
- [ ] Redémarrage complet: `sudo docker-compose restart`
- [ ] Redémarrage du NAS (test ultime)
- [ ] Récupération après coupure Internet

### Documentation utilisateur
- [ ] Guide d'utilisation créé (si nécessaire)
- [ ] Utilisateurs formés (si multi-utilisateurs)
- [ ] Procédure de signalement de bug établie

## Phase 7: Maintenance

### Planification
- [ ] Planning de mise à jour établi (ex: mensuel)
- [ ] Fenêtre de maintenance définie (ex: dimanche 2h-3h)
- [ ] Procédure de rollback documentée
- [ ] Contact support défini

### Monitoring continu
- [ ] Vérification hebdomadaire des logs
- [ ] Vérification mensuelle des backups
- [ ] Test de restauration trimestriel
- [ ] Mise à jour de DSM lors de nouvelles versions

## Troubleshooting

Si vous rencontrez un problème, consultez cette section:

### Le container ne démarre pas
```bash
sudo docker-compose logs backend
sudo docker-compose logs frontend
```
→ Consultez [INSTALLATION_NAS.md](./INSTALLATION_NAS.md#troubleshooting)

### L'application est inaccessible depuis l'extérieur
1. Testez en local: `http://IP_NAS:4200`
2. Vérifiez le reverse proxy dans DSM
3. Vérifiez la redirection de ports sur votre box
4. Testez le DNS: `nslookup finances.votredomaine.com`

### Les données ne persistent pas
1. Vérifiez les volumes: `sudo docker inspect suivi-cb-backend | grep -A 10 Mounts`
2. Vérifiez les permissions: `ls -la data/`
3. Consultez la section Troubleshooting de [INSTALLATION_NAS.md](./INSTALLATION_NAS.md)

## Commandes de diagnostic

En cas de problème, exécutez ces commandes:

```bash
# État général
sudo docker-compose ps
sudo docker stats --no-stream

# Logs
sudo docker-compose logs --tail=100
sudo docker-compose logs backend --tail=50
sudo docker-compose logs frontend --tail=50

# Réseau
sudo docker network ls
sudo docker network inspect suivi-cb_suivi-cb-network

# Volumes
sudo docker volume ls
ls -lha /volume1/docker/suivi-cb/data/

# Healthcheck
sudo docker inspect suivi-cb-backend | grep -A 10 Health
sudo docker inspect suivi-cb-frontend | grep -A 10 Health

# Processus
sudo docker-compose top

# Test API
curl -v http://localhost:3001/api/config/active-accounts
```

## Rollback rapide

En cas de problème critique:

```bash
# Arrêter l'application
sudo docker-compose down

# Restaurer la base de données
cp backups/database_YYYYMMDD_HHMMSS.db data/database.db

# Revenir à la version précédente
git checkout v1.0.0

# Rebuild et redémarrer
sudo docker-compose build --no-cache
sudo docker-compose up -d
```

## Notes

- **Date de déploiement:** _______________________
- **Version déployée:** _______________________
- **Nom de domaine:** _______________________
- **IP du NAS:** _______________________
- **Problèmes rencontrés:**
  - _______________________
  - _______________________
- **Solutions appliquées:**
  - _______________________
  - _______________________

## Support

- Documentation: Voir fichiers `DEPLOYMENT_*.md` et `INSTALLATION_NAS.md`
- Logs: `sudo docker-compose logs`
- Forum Synology: https://community.synology.com
- Docker: https://docs.docker.com

---

**Félicitations!** Si vous avez coché toutes les cases, votre application est correctement déployée!

Prochaines étapes:
1. Surveillez l'application pendant quelques jours
2. Testez la procédure de mise à jour avec une version mineure
3. Vérifiez que les sauvegardes fonctionnent
4. Profitez de votre application accessible partout!
