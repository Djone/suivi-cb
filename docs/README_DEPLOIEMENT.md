# Documentation de déploiement - Suivi CB sur Synology NAS

Cette documentation vous guide pour déployer l'application Suivi CB sur votre NAS Synology avec Docker.

## Vue d'ensemble

L'application Suivi CB est une application web de suivi de comptes bancaires composée de:
- **Frontend**: Angular 20 avec PrimeNG (interface utilisateur)
- **Backend**: Node.js/Express avec SQLite (API REST)
- **Déploiement**: Docker sur Synology NAS via Container Manager

## Documents créés pour le déploiement

### Guides de déploiement

| Fichier | Description | Quand l'utiliser |
|---------|-------------|------------------|
| [DEPLOIEMENT_RESUME.md](./DEPLOIEMENT_RESUME.md) | **Commencez ici!** Résumé rapide avec toutes les infos essentielles | Pour une vue d'ensemble rapide |
| [DEPLOYMENT_SYNOLOGY.md](./DEPLOYMENT_SYNOLOGY.md) | Configuration détaillée du NAS Synology (reverse proxy, SSL, réseau) | Avant le premier déploiement |
| [INSTALLATION_NAS.md](./INSTALLATION_NAS.md) | Guide d'installation pas à pas de l'application sur le NAS | Lors du déploiement initial |
| [MISE_A_JOUR_NAS.md](./MISE_A_JOUR_NAS.md) | Procédure de mise à jour de l'application | À chaque nouvelle version |
| [CHECKLIST_DEPLOIEMENT.md](./CHECKLIST_DEPLOIEMENT.md) | Checklist complète pour ne rien oublier | Tout au long du déploiement |

### Fichiers de configuration Docker

| Fichier | Description |
|---------|-------------|
| [Dockerfile.backend](./Dockerfile.backend) | Image Docker pour le backend Node.js |
| [Dockerfile.frontend](./Dockerfile.frontend) | Image Docker pour le frontend Angular (multi-stage build avec nginx) |
| [docker-compose.yml](./docker-compose.yml) | Configuration Docker Compose pour orchestrer les 2 containers |
| [nginx.conf](./nginx.conf) | Configuration nginx pour servir le frontend et proxifier l'API |
| [.dockerignore](./.dockerignore) | Fichiers exclus du build Docker |

### Scripts d'automatisation

| Fichier | Description | Plateforme |
|---------|-------------|------------|
| [build-production.sh](./build-production.sh) | Script de build automatique | Linux/Mac |
| [build-production.bat](./build-production.bat) | Script de build automatique | Windows |
| [deploy-to-nas.sh](./deploy-to-nas.sh) | Script de déploiement automatique vers le NAS | Linux/Mac |

### Configuration

| Fichier | Description |
|---------|-------------|
| [.env.example](./.env.example) | Exemple de variables d'environnement pour la production |

## Ordre de lecture recommandé

### Pour un premier déploiement

1. **[DEPLOIEMENT_RESUME.md](./DEPLOIEMENT_RESUME.md)** - Vue d'ensemble (5 min)
2. **[DEPLOYMENT_SYNOLOGY.md](./DEPLOYMENT_SYNOLOGY.md)** - Configuration du NAS (30-60 min)
3. **[CHECKLIST_DEPLOIEMENT.md](./CHECKLIST_DEPLOIEMENT.md)** - Ouvrir et suivre point par point
4. **[INSTALLATION_NAS.md](./INSTALLATION_NAS.md)** - Installation complète (30-45 min)
5. **Tests et validation** selon la checklist

### Pour une mise à jour

1. **[CHECKLIST_DEPLOIEMENT.md](./CHECKLIST_DEPLOIEMENT.md)** - Section "Mise à jour"
2. **[MISE_A_JOUR_NAS.md](./MISE_A_JOUR_NAS.md)** - Procédure complète

## Démarrage rapide (TL;DR)

### Prérequis
- Synology NAS avec DSM 7.2.2+
- Container Manager installé
- Domaine/sous-domaine configuré avec SSL

### Déploiement automatique (Linux/Mac)

```bash
# 1. Configurer les variables
export NAS_USER=admin
export NAS_HOST=192.168.1.100

# 2. Déployer
chmod +x deploy-to-nas.sh
./deploy-to-nas.sh

# 3. Accéder à l'application
https://finances.votredomaine.com
```

### Déploiement manuel

```bash
# Sur le NAS via SSH
ssh admin@IP_NAS
cd /volume1/docker
git clone https://github.com/votre-username/suivi-cb.git
cd suivi-cb
mkdir -p data logs backups
sudo docker-compose build
sudo docker-compose up -d
```

## Architecture technique

```
┌─────────────────────────────────────────┐
│         Internet (HTTPS)                │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│    Box Internet (Redirection ports)     │
│    Port 443 → NAS:443                   │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│         Synology NAS (DSM 7.2)          │
│  ┌───────────────────────────────────┐  │
│  │   Reverse Proxy                   │  │
│  │   finances.votredomaine.com:443   │  │
│  │   → localhost:4200                │  │
│  └─────────────┬─────────────────────┘  │
│                │                         │
│    ┌───────────┴───────────┐            │
│    │                       │            │
│    ▼                       ▼            │
│  ┌──────────────┐  ┌──────────────┐    │
│  │  Container   │  │  Container   │    │
│  │  Frontend    │  │  Backend     │    │
│  │  (nginx)     │  │  (Node.js)   │    │
│  │  Port 4200   │  │  Port 3001   │    │
│  └──────────────┘  └───────┬──────┘    │
│                            │            │
│                            ▼            │
│                    ┌──────────────┐     │
│                    │   SQLite DB  │     │
│                    │   (volume)   │     │
│                    └──────────────┘     │
└─────────────────────────────────────────┘
```

## Flux de déploiement

```
┌──────────────────┐
│ Code source Git  │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Build local      │ ← build-production.sh
│ (optionnel)      │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Transfert NAS    │ ← deploy-to-nas.sh ou rsync/git
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Build Docker     │ ← docker-compose build
│ sur le NAS       │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Démarrage        │ ← docker-compose up -d
│ containers       │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Application      │
│ accessible       │ → https://finances.votredomaine.com
└──────────────────┘
```

## Commandes essentielles

### Build local (avant déploiement)

```bash
# Linux/Mac
./build-production.sh

# Windows
build-production.bat
```

### Déploiement

```bash
# Automatique (Linux/Mac)
./deploy-to-nas.sh

# Manuel
ssh admin@IP_NAS
cd /volume1/docker/suivi-cb
git pull
sudo docker-compose build
sudo docker-compose up -d
```

### Gestion sur le NAS

```bash
# Démarrer
sudo docker-compose up -d

# Arrêter
sudo docker-compose down

# Logs
sudo docker-compose logs -f

# Status
sudo docker-compose ps

# Rebuild
sudo docker-compose build --no-cache
```

## Structure des fichiers sur le NAS

```
/volume1/docker/suivi-cb/
├── backend/                      # Code backend
│   ├── routes/
│   ├── services/
│   ├── migrations/
│   ├── server.js
│   └── package.json
├── frontend/                     # Code frontend
│   ├── src/
│   ├── angular.json
│   └── package.json
├── data/                         # DONNÉES PERSISTANTES
│   └── database.db              # Base de données SQLite
├── logs/                        # Logs de l'application
│   ├── backend/
│   └── frontend/
├── backups/                     # Sauvegardes de la BD
│   └── database_*.db
├── Dockerfile.backend           # Image Docker backend
├── Dockerfile.frontend          # Image Docker frontend
├── docker-compose.yml           # Configuration Docker Compose
├── nginx.conf                   # Configuration nginx
├── .dockerignore               # Exclusions Docker
└── .env.production             # Variables d'environnement (à créer)
```

## Sécurité

### Bonnes pratiques

1. **Utilisez HTTPS uniquement** via le reverse proxy
2. **Configurez un pare-feu** pour limiter les accès
3. **Sauvegardez régulièrement** la base de données
4. **Gardez DSM à jour** pour les correctifs de sécurité
5. **Utilisez des mots de passe forts** pour l'accès SSH
6. **Activez l'authentification** dans l'application ou via DSM Portal
7. **Surveillez les logs** régulièrement

### Fichiers sensibles

Ne JAMAIS commiter dans Git:
- `.env.production` - Variables d'environnement de prod
- `data/database.db` - Base de données
- `backups/` - Sauvegardes
- Tout fichier contenant des mots de passe ou clés

## Support et troubleshooting

### Documentation
- Toutes les guides de déploiement (fichiers `DEPLOYMENT_*.md`)
- [CHECKLIST_DEPLOIEMENT.md](./CHECKLIST_DEPLOIEMENT.md) - Section Troubleshooting

### Logs

```bash
# Tous les logs
sudo docker-compose logs -f

# Backend uniquement
sudo docker-compose logs -f backend

# Erreurs uniquement
sudo docker-compose logs | grep -i error
```

### Diagnostic rapide

```bash
# État des containers
sudo docker-compose ps

# Utilisation des ressources
sudo docker stats --no-stream

# Test API
curl http://localhost:3001/api/config/active-accounts

# Vérifier la base de données
ls -lh /volume1/docker/suivi-cb/data/database.db
```

### Rollback en cas de problème

```bash
# Arrêter
sudo docker-compose down

# Restaurer le backup
cp backups/database_YYYYMMDD.db data/database.db

# Revenir à la version précédente
git checkout v1.0.0

# Redémarrer
sudo docker-compose build
sudo docker-compose up -d
```

## Maintenance

### Sauvegardes automatiques

Créez une tâche planifiée dans DSM (quotidienne à 2h):

```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
cp /volume1/docker/suivi-cb/data/database.db \
   /volume1/Backups/suivi-cb/database_$DATE.db
# Garder 30 jours
find /volume1/Backups/suivi-cb/ -name "database_*.db" -mtime +30 -delete
```

### Mises à jour

Planifiez des mises à jour mensuelles:
1. Consultez [MISE_A_JOUR_NAS.md](./MISE_A_JOUR_NAS.md)
2. Faites un backup avant toute mise à jour
3. Testez sur une fenêtre de maintenance
4. Surveillez les logs pendant 24h après

### Monitoring

Activez les notifications DSM pour:
- Container arrêté
- CPU > 80%
- RAM > 80%
- Disque > 90%

## FAQ

**Q: Puis-je changer les ports par défaut?**
R: Oui, modifiez `docker-compose.yml` et le reverse proxy dans DSM.

**Q: Comment sauvegarder uniquement la base de données?**
R: Copiez `/volume1/docker/suivi-cb/data/database.db` vers un emplacement sûr.

**Q: L'application est lente, que faire?**
R: Vérifiez `sudo docker stats` et augmentez les ressources si nécessaire dans docker-compose.yml.

**Q: Puis-je accéder à l'application sans domaine?**
R: Oui, utilisez `http://IP_NAS:4200` en local, mais HTTPS nécessite un domaine.

**Q: Comment restaurer un backup?**
R: Arrêtez le backend, copiez le backup vers `data/database.db`, redémarrez.

**Q: Les containers redémarrent en boucle?**
R: Consultez les logs avec `sudo docker-compose logs` pour identifier l'erreur.

## Ressources externes

- [Documentation Synology DSM](https://kb.synology.com)
- [Docker Documentation](https://docs.docker.com)
- [Docker Compose Reference](https://docs.docker.com/compose/compose-file/)
- [Nginx Documentation](https://nginx.org/en/docs/)
- [Forum Synology](https://community.synology.com)

## Changelog

- **v1.0.0** (2025-10-21) - Documentation initiale de déploiement

## Contribution

Pour améliorer cette documentation:
1. Testez le déploiement
2. Notez les problèmes rencontrés
3. Proposez des améliorations
4. Partagez vos retours d'expérience

## Licence

Cette documentation est fournie "en l'état" pour vous aider à déployer votre application.

---

**Besoin d'aide?** Consultez d'abord [DEPLOIEMENT_RESUME.md](./DEPLOIEMENT_RESUME.md) puis les guides détaillés selon votre besoin.

**Bon déploiement!** 🚀
