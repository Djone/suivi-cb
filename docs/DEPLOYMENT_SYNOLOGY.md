# Guide de déploiement sur Synology NAS

## Prérequis

Votre Synology NAS doit avoir:
- DSM 7.2.2 Update 4 (déjà installé)
- Package **Docker** installé via le Package Center
- Package **Container Manager** (anciennement Docker) installé
- Accès HTTPS configuré avec votre domaine/sous-domaine
- Port 3000 et 4200 (ou personnalisés) disponibles

## Étape 1: Configuration du NAS Synology

### 1.1 Installer Docker/Container Manager

1. Ouvrez **Package Center**
2. Recherchez **Container Manager** (ou **Docker** sur les anciennes versions)
3. Cliquez sur **Installer**
4. Attendez la fin de l'installation

### 1.2 Activer SSH (optionnel mais recommandé)

1. Allez dans **Panneau de configuration** > **Terminal & SNMP**
2. Cochez **Activer le service SSH**
3. Port par défaut: 22 (modifiable)
4. Cliquez sur **Appliquer**

### 1.3 Créer un dossier pour l'application

Via File Station:
1. Créez un dossier `/docker/suivi-cb` dans votre volume principal
2. Ce dossier contiendra:
   - Les fichiers de l'application
   - La base de données SQLite
   - Les logs

### 1.4 Configurer le pare-feu (si activé)

Si le pare-feu est activé:
1. Allez dans **Panneau de configuration** > **Sécurité** > **Pare-feu**
2. Éditez les règles pour autoriser les ports:
   - Port 3001 (backend en production)
   - Port 80/443 (si reverse proxy)

## Étape 2: Configuration du Reverse Proxy

Pour accéder à votre application via votre domaine HTTPS existant:

### 2.1 Créer un sous-domaine

1. Dans votre registrar de domaine ou DNS, créez un sous-domaine:
   - Exemple: `finances.votredomaine.com`
   - Pointez vers l'IP publique de votre NAS

### 2.2 Configurer le Reverse Proxy dans DSM

1. Allez dans **Panneau de configuration** > **Portail d'application** > **Reverse Proxy**
2. Cliquez sur **Créer**
3. Configuration:

**Général:**
- Description: `Suivi CB`
- Source:
  - Protocole: `HTTPS`
  - Nom d'hôte: `finances.votredomaine.com`
  - Port: `443`
  - Activer HSTS et HTTP/2
- Destination:
  - Protocole: `HTTP`
  - Nom d'hôte: `localhost`
  - Port: `4200` (port du container)

**En-têtes personnalisés (onglet "En-têtes personnalisés"):**

Ajoutez ces en-têtes de sécurité un par un:

Cliquez sur **Créer** pour chaque en-tête et remplissez:

| Nom de l'en-tête | Valeur |
|------------------|---------|
| `X-Frame-Options` | `SAMEORIGIN` |
| `X-Content-Type-Options` | `nosniff` |
| `X-XSS-Protection` | `1; mode=block` |
| `Strict-Transport-Security` | `max-age=31536000` |

**Note importante:**
- L'interface DSM ne permet que des en-têtes HTTP simples (nom/valeur)
- Les directives nginx complexes comme `map` ne sont pas supportées via l'interface
- Le support WebSocket n'est pas nécessaire pour cette application

**Si WebSocket est nécessaire plus tard** (actuellement non), ajoutez:
- Nom: `Upgrade`, Valeur: `$http_upgrade`
- Nom: `Connection`, Valeur: `upgrade`

4. Cliquez sur **Enregistrer**

## Étape 3: Configuration des certificats SSL

Si vous n'avez pas encore de certificat pour votre sous-domaine:

1. Allez dans **Panneau de configuration** > **Sécurité** > **Certificat**
2. Cliquez sur **Ajouter** > **Ajouter un nouveau certificat**
3. Choisissez **Obtenir un certificat auprès de Let's Encrypt**
4. Remplissez:
   - Nom de domaine: `finances.votredomaine.com`
   - Email: votre email
5. Validez et attendez l'émission du certificat
6. Dans **Configuration**, assignez le certificat à votre reverse proxy

## Étape 4: Redirection des ports (Box Internet)

Sur votre box Internet:

1. Connectez-vous à l'interface d'administration
2. Allez dans **NAT/PAT** ou **Redirection de ports**
3. Créez les règles:
   - Port externe 443 → IP_NAS:443 (HTTPS)
   - Port externe 80 → IP_NAS:80 (HTTP pour redirection)

**Note:** Si vous utilisez déjà les ports 80/443 pour DSM, vous devrez:
- Soit changer les ports de DSM
- Soit utiliser un port différent pour l'application et l'inclure dans l'URL

## Étape 5: Test de connectivité

Avant de déployer l'application:

1. Testez l'accès HTTPS à votre NAS: `https://finances.votredomaine.com`
2. Vérifiez que le certificat SSL est valide
3. Si vous obtenez une erreur "Passerelle indisponible", c'est normal (le container n'est pas encore déployé)

## Étape 6: Variables d'environnement

Créez un fichier `.env` dans `/docker/suivi-cb/` avec le contenu suivant:

```env
# Backend
NODE_ENV=production
PORT_BACK=3001
DB_PATH=/app/data/database.db

# Frontend
PORT_FRONT=4200
API_URL=http://backend:3001
```

## Prochaines étapes

Une fois cette configuration terminée, vous êtes prêt pour:
1. Déployer l'application via Docker (voir INSTALLATION_NAS.md)
2. Tester l'application en production
3. Configurer les sauvegardes automatiques

## Sécurité

Recommandations de sécurité:

1. **Authentification:** Ajoutez une couche d'authentification (DSM Portal ou application)
2. **Pare-feu:** Limitez l'accès aux IP de confiance si possible
3. **Sauvegardes:** Configurez des sauvegardes régulières de:
   - La base de données SQLite
   - Les fichiers de configuration
4. **Mises à jour:** Gardez DSM et Docker à jour
5. **Logs:** Consultez régulièrement les logs de l'application

## Troubleshooting

### Le reverse proxy ne fonctionne pas

- Vérifiez que le container est bien démarré
- Vérifiez les logs du reverse proxy: `/var/log/nginx/`
- Testez l'accès direct: `http://IP_NAS:4200`

### Certificat SSL invalide

- Vérifiez que le domaine pointe bien vers votre IP publique
- Renouvelez le certificat Let's Encrypt si expiré
- Vérifiez les logs dans **Sécurité** > **Certificat**

### Application inaccessible depuis l'extérieur

- Vérifiez la redirection de ports sur votre box
- Vérifiez que votre IP publique n'a pas changé (utilisez un service DynDNS)
- Testez depuis un réseau mobile 4G/5G

## Support

Pour toute question sur la configuration de Synology DSM:
- Documentation officielle: https://kb.synology.com
- Forum Synology: https://community.synology.com
