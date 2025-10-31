# Installation sur NAS Synology SANS SSH

Ce guide vous permet d'installer l'application **sans avoir besoin de SSH**, uniquement via l'interface web DSM.

## Prérequis

- Synology NAS avec DSM 7.2.2+
- Container Manager installé (via Package Center)
- Accès administrateur à DSM
- Les fichiers du projet sur votre ordinateur

## Méthode 1: Via File Station + Container Manager (Recommandée)

### Étape 1: Préparer les fichiers sur votre ordinateur

1. Ouvrez l'explorateur Windows
2. Naviguez vers: `c:\Users\jonat\OneDrive\Documents\Suivi comptes\suivi-cb`
3. Vérifiez que vous avez bien ces fichiers:
   - `docker-compose.yml`
   - `Dockerfile.backend`
   - `Dockerfile.frontend`
   - `nginx.conf`
   - Dossier `backend/`
   - Dossier `frontend/`

### Étape 2: Transférer les fichiers vers le NAS

1. **Ouvrez DSM** dans votre navigateur (`http://IP_NAS:5000`)
2. **Ouvrez File Station** (icône de dossier)
3. **Créez la structure de dossiers**:
   - Naviguez vers le volume principal (généralement `volume1`)
   - Créez un dossier `docker` (s'il n'existe pas déjà)
   - Entrez dans le dossier `docker`
   - Créez un dossier `suivi-cb`

4. **Uploadez les fichiers**:
   - Entrez dans le dossier `suivi-cb`
   - Cliquez sur le bouton **Charger** (Upload) en haut
   - Sélectionnez **Tous les fichiers et dossiers** de votre projet
   - Attendez la fin de l'upload (peut prendre quelques minutes)

   **Alternative - Upload par ZIP**:
   - Sur Windows, compressez le dossier `suivi-cb` en ZIP
   - Uploadez le fichier ZIP via File Station
   - Clic droit sur le ZIP > **Extraire** > **Extraire ici**
   - ⚠️ **Vérifiez** que vous n'avez pas un dossier `suivi-cb` dans un autre `suivi-cb`. Le chemin final doit être `/docker/suivi-cb/docker-compose.yml`.

5. **Créez les dossiers de données**:
   - Dans `/docker/suivi-cb`, créez ces dossiers:
     - `data`
     - `backups`
     - `logs`
       - `logs/backend`
       - `logs/frontend`
   - Clic droit > **Créer** > **Créer un dossier**

### Étape 3: Créer le projet Docker

1. **Ouvrez Container Manager** depuis le menu principal de DSM
2. Allez dans l'onglet **Projet**
3. Cliquez sur le bouton **Créer**

4. **Configuration du projet**:
   ```
   ┌─────────────────────────────────────────────┐
   │ Créer un projet                             │
   ├─────────────────────────────────────────────┤
   │                                             │
   │ Nom du projet:                              │
   │ ┌─────────────────────────────────────┐    │
   │ │ suivi-cb                            │    │
   │ └─────────────────────────────────────┘    │
   │                                             │
   │ Chemin:                                     │
   │ ┌─────────────────────────────────────┐    │
   │ │ /docker/suivi-cb                    │    │
   │ └─────────────────────────────────────┘    │
   │                                             │
   │ Source:                                     │
   │ ⦿ Créer docker-compose.yml                 │
   │ ○ Charger depuis docker-compose.yml        │
   │                                             │
   └─────────────────────────────────────────────┘
   ```

5. **Sélectionnez** "Charger depuis docker-compose.yml"
6. Naviguez et sélectionnez `/docker/suivi-cb/docker-compose.yml`
7. Cliquez sur **Suivant**

8. **Configuration des services** (aperçu):
   - Vous verrez la liste des services: `backend` et `frontend`
   - Les ports mappés: `3001:3001` et `4200:80`
   - Vérifiez que tout est correct

9. Cliquez sur **Terminé**

### Étape 4: Build et démarrage automatique

Container Manager va automatiquement:
1. ✅ Construire l'image Docker du backend (2-5 min)
2. ✅ Construire l'image Docker du frontend (5-10 min)
3. ✅ Créer les containers
4. ✅ Démarrer les containers

**Surveillez la progression** dans l'onglet **Logs** du projet.

### Étape 5: Vérification

1. **Dans Container Manager > Container**:
   - Vérifiez que vous voyez 2 containers:
     - `suivi-cb-backend` - État: Running
     - `suivi-cb-frontend` - État: Running

2. **Vérifiez les logs**:
   - Cliquez sur `suivi-cb-backend`
   - Onglet **Log**
   - Vous devriez voir: `Serveur backend sur http://localhost:3000`

   - Cliquez sur `suivi-cb-frontend`
   - Onglet **Log**
   - Pas d'erreurs critiques

3. **Testez l'accès**:
   - Ouvrez un navigateur
   - Accédez à: `http://IP_NAS:4200`
   - L'application devrait s'afficher!

### Étape 6: Configurer le reverse proxy

Suivez [GUIDE_REVERSE_PROXY_DSM.md](./GUIDE_REVERSE_PROXY_DSM.md) pour configurer l'accès HTTPS via votre domaine.

## Méthode 2: Via le Planificateur de tâches

Si vous voulez utiliser Git mais n'avez pas SSH:

### Étape 1: Créer une tâche planifiée

1. Ouvrez **Panneau de configuration** > **Planificateur de tâches**
2. Cliquez sur **Créer** > **Tâche planifiée** > **Script défini par l'utilisateur**

3. **Général**:
   - Nom de la tâche: `Deploy Suivi CB`
   - Utilisateur: `root`
   - Décochez "Activé"

4. **Planification**:
   - Date: Ne s'exécute pas (on va l'exécuter manuellement)

5. **Paramètres de la tâche**:
   - Cochez "Envoyer les détails de l'exécution par courrier électronique" (optionnel)
   - Script utilisateur:

   ```bash
   #!/bin/bash

   # Créer le dossier
   mkdir -p /volume1/docker
   cd /volume1/docker

   # Cloner le dépôt (REMPLACEZ par votre URL)
   git clone https://github.com/votre-username/suivi-cb.git

   # Créer les dossiers de données
   cd suivi-cb
   mkdir -p data logs/backend logs/frontend backups

   echo "Déploiement terminé! Ouvrez Container Manager pour construire le projet."
   ```

6. Cliquez sur **OK**

7. **Exécutez la tâche**:
   - Sélectionnez la tâche `Deploy Suivi CB`
   - Cliquez sur **Exécuter**
   - Attendez quelques secondes

8. Vérifiez dans File Station que le dossier `/docker/suivi-cb` est créé

9. Suivez ensuite l'**Étape 3** de la Méthode 1 pour créer le projet Docker

## Méthode 3: Via un partage réseau (SMB/CIFS)

### Sur Windows

1. **Ouvrez l'Explorateur Windows**
2. Dans la barre d'adresse, tapez:
   ```
   \\IP_NAS\docker
   ```
   Ou créez un lecteur réseau (Clic droit sur Ce PC > Connecter un lecteur réseau)

3. **Authentifiez-vous** avec votre compte DSM

4. **Créez le dossier** `suivi-cb`

5. **Copiez tous les fichiers** de votre projet dans ce dossier

6. Suivez l'**Étape 3** de la Méthode 1

## Gestion sans SSH

### Voir les logs

Via Container Manager:
1. **Container Manager** > **Container**
2. Cliquez sur le container (`suivi-cb-backend` ou `suivi-cb-frontend`)
3. Onglet **Log**
4. Les logs s'affichent en temps réel

### Redémarrer l'application

Via Container Manager:
1. **Container Manager** > **Projet**
2. Sélectionnez `suivi-cb`
3. Cliquez sur **Action** > **Arrêter**
4. Attendez l'arrêt complet
5. Cliquez sur **Action** > **Démarrer**

Ou via les containers individuels:
1. **Container Manager** > **Container**
2. Sélectionnez le container
3. Cliquez sur **Action** > **Redémarrer**

### Arrêter l'application

1. **Container Manager** > **Projet**
2. Sélectionnez `suivi-cb`
3. Cliquez sur **Action** > **Arrêter**

### Mettre à jour l'application

1. **Préparez la nouvelle version** sur votre ordinateur
2. **Arrêtez le projet** dans Container Manager
3. **Remplacez les fichiers** via File Station ou partage réseau
4. **Reconstruisez le projet**:
   - Container Manager > Projet
   - Sélectionnez `suivi-cb`
   - Action > **Recréer** (ou **Build** sur les anciennes versions)
5. **Démarrez le projet**:
   - Action > **Démarrer**

### Backup de la base de données

Via File Station:
1. Naviguez vers `/docker/suivi-cb/data`
2. Clic droit sur `database.db`
3. **Télécharger** (sauvegarde sur votre ordinateur)

Ou copiez dans le dossier backups:
1. Clic droit sur `database.db`
2. **Copier**
3. Naviguez vers `/docker/suivi-cb/backups`
4. **Coller**
5. Renommez avec la date: `database_2025-10-21.db`

### Restaurer un backup

1. **Arrêtez le backend**:
   - Container Manager > Container
   - Sélectionnez `suivi-cb-backend`
   - Action > Arrêter

2. **Restaurez le fichier**:
   - File Station > `/docker/suivi-cb/backups`
   - Clic droit sur le backup à restaurer > **Copier**
   - Naviguez vers `/docker/suivi-cb/data`
   - Supprimez l'ancien `database.db`
   - **Coller** et renommez en `database.db`

3. **Redémarrez le backend**:
   - Container Manager > Container
   - Sélectionnez `suivi-cb-backend`
   - Action > Démarrer

## Surveillance

### Voir l'utilisation des ressources

1. **Container Manager** > **Container**
2. Sélectionnez un container
3. Onglet **Ressource**
4. Vous verrez:
   - Utilisation CPU
   - Utilisation RAM
   - Utilisation réseau
   - Utilisation disque

### Activer les notifications

1. **Panneau de configuration** > **Notification**
2. Configurez votre email
3. Activez les notifications pour:
   - Container arrêté
   - Utilisation CPU élevée
   - Utilisation RAM élevée

## Troubleshooting

### Le container ne démarre pas

1. Container Manager > Container
2. Cliquez sur le container problématique
3. Onglet **Log**
4. Lisez les erreurs

**Erreurs courantes**:
- `Port already in use` → Un autre service utilise le port
- `Cannot find image` → Le build a échoué
- `Database locked` → Problème de permissions

### L'application ne s'affiche pas

1. Vérifiez que les 2 containers sont "Running"
2. Testez directement: `http://IP_NAS:4200`
3. Vérifiez les logs du frontend
4. Vérifiez que le port 4200 n'est pas bloqué par le pare-feu

### Rebuild complet

Si tout va mal:

1. **Supprimez le projet**:
   - Container Manager > Projet
   - Sélectionnez `suivi-cb`
   - Action > Supprimer
   - ⚠️ Cochez "Conserver les données" pour garder la base de données

2. **Recréez le projet** en suivant l'Étape 3

## Avantages de cette méthode

✅ Pas besoin de SSH
✅ Interface graphique intuitive
✅ Visualisation des logs en temps réel
✅ Gestion facile des containers
✅ Monitoring intégré
✅ Moins de risques d'erreurs

## Support

- 📖 [GUIDE_REVERSE_PROXY_DSM.md](./GUIDE_REVERSE_PROXY_DSM.md) - Configuration HTTPS
- 📖 [CHECKLIST_DEPLOIEMENT.md](./CHECKLIST_DEPLOIEMENT.md) - Checklist complète
- 📖 [DEPLOIEMENT_RESUME.md](./DEPLOIEMENT_RESUME.md) - Référence rapide

---

**Temps estimé**: 30-45 minutes (incluant l'upload et le build)

**Niveau de difficulté**: ⭐⭐ Facile (pas de ligne de commande requise)
