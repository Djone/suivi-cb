# Guide visuel - Configuration Reverse Proxy DSM

Ce guide vous montre exactement comment configurer le reverse proxy dans l'interface DSM de Synology.

## Accès à la configuration

1. Ouvrez DSM (interface web de votre NAS)
2. Allez dans **Panneau de configuration**
3. Cliquez sur **Portail d'application**
4. Sélectionnez l'onglet **Reverse Proxy**
5. Cliquez sur **Créer**

## Configuration du Reverse Proxy

### Onglet "Général"

Remplissez les champs suivants:

```
┌─────────────────────────────────────────────┐
│ Créer un reverse proxy                     │
├─────────────────────────────────────────────┤
│                                             │
│ Description du reverse proxy                │
│ ┌─────────────────────────────────────┐    │
│ │ Suivi CB                            │    │
│ └─────────────────────────────────────┘    │
│                                             │
│ ═══ Source ═══════════════════════════     │
│                                             │
│ Protocole: [HTTPS ▼]                       │
│                                             │
│ Nom d'hôte:                                │
│ ┌─────────────────────────────────────┐    │
│ │ finances.votredomaine.com           │    │
│ └─────────────────────────────────────┘    │
│                                             │
│ Port:                                       │
│ ┌──────┐                                    │
│ │ 443  │                                    │
│ └──────┘                                    │
│                                             │
│ ☑ Activer HSTS                             │
│ ☑ Activer HTTP/2                           │
│                                             │
│ ═══ Destination ════════════════════════   │
│                                             │
│ Protocole: [HTTP ▼]                        │
│                                             │
│ Nom d'hôte:                                │
│ ┌─────────────────────────────────────┐    │
│ │ localhost                           │    │
│ └─────────────────────────────────────┘    │
│                                             │
│ Port:                                       │
│ ┌──────┐                                    │
│ │ 4200 │                                    │
│ └──────┘                                    │
│                                             │
└─────────────────────────────────────────────┘
```

**Explication:**
- **Source**: C'est ce que vos utilisateurs vont taper dans le navigateur
  - `https://finances.votredomaine.com:443`
- **Destination**: C'est où le NAS va rediriger les requêtes
  - `http://localhost:4200` (le container Docker frontend)

### Onglet "En-têtes personnalisés"

Cliquez sur l'onglet **En-têtes personnalisés** puis cliquez sur **Créer** pour chaque en-tête:

#### En-tête 1: Protection contre le clickjacking

```
┌─────────────────────────────────────────────┐
│ Créer un en-tête personnalisé              │
├─────────────────────────────────────────────┤
│                                             │
│ Nom de l'en-tête:                          │
│ ┌─────────────────────────────────────┐    │
│ │ X-Frame-Options                     │    │
│ └─────────────────────────────────────┘    │
│                                             │
│ Valeur:                                     │
│ ┌─────────────────────────────────────┐    │
│ │ SAMEORIGIN                          │    │
│ └─────────────────────────────────────┘    │
│                                             │
│         [Annuler]  [OK]                     │
└─────────────────────────────────────────────┘
```

Cliquez sur **OK**, puis **Créer** à nouveau pour l'en-tête suivant.

#### En-tête 2: Protection MIME type sniffing

```
┌─────────────────────────────────────────────┐
│ Créer un en-tête personnalisé              │
├─────────────────────────────────────────────┤
│                                             │
│ Nom de l'en-tête:                          │
│ ┌─────────────────────────────────────┐    │
│ │ X-Content-Type-Options              │    │
│ └─────────────────────────────────────┘    │
│                                             │
│ Valeur:                                     │
│ ┌─────────────────────────────────────┐    │
│ │ nosniff                             │    │
│ └─────────────────────────────────────┘    │
│                                             │
│         [Annuler]  [OK]                     │
└─────────────────────────────────────────────┘
```

#### En-tête 3: Protection XSS

```
┌─────────────────────────────────────────────┐
│ Créer un en-tête personnalisé              │
├─────────────────────────────────────────────┤
│                                             │
│ Nom de l'en-tête:                          │
│ ┌─────────────────────────────────────┐    │
│ │ X-XSS-Protection                    │    │
│ └─────────────────────────────────────┘    │
│                                             │
│ Valeur:                                     │
│ ┌─────────────────────────────────────┐    │
│ │ 1; mode=block                       │    │
│ └─────────────────────────────────────┘    │
│                                             │
│         [Annuler]  [OK]                     │
└─────────────────────────────────────────────┘
```

#### En-tête 4: HSTS (HTTP Strict Transport Security)

```
┌─────────────────────────────────────────────┐
│ Créer un en-tête personnalisé              │
├─────────────────────────────────────────────┤
│                                             │
│ Nom de l'en-tête:                          │
│ ┌─────────────────────────────────────┐    │
│ │ Strict-Transport-Security           │    │
│ └─────────────────────────────────────┘    │
│                                             │
│ Valeur:                                     │
│ ┌─────────────────────────────────────┐    │
│ │ max-age=31536000                    │    │
│ └─────────────────────────────────────┘    │
│                                             │
│         [Annuler]  [OK]                     │
└─────────────────────────────────────────────┘
```

### Résumé des en-têtes

Après avoir créé les 4 en-têtes, vous devriez voir:

```
┌──────────────────────────────────────────────────────────┐
│ En-têtes personnalisés                    [Créer]        │
├──────────────────────────────────────────────────────────┤
│                                                          │
│ Nom de l'en-tête           │ Valeur                     │
│────────────────────────────┼────────────────────────────│
│ X-Frame-Options            │ SAMEORIGIN                 │
│ X-Content-Type-Options     │ nosniff                    │
│ X-XSS-Protection           │ 1; mode=block              │
│ Strict-Transport-Security  │ max-age=31536000           │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### Finalisation

1. Vérifiez que tous les onglets sont correctement remplis
2. Cliquez sur **Enregistrer** (en bas de la fenêtre)
3. Le reverse proxy est maintenant créé et actif

## Vérification de la configuration

### Dans la liste des reverse proxy

Vous devriez voir votre configuration dans la liste:

```
┌──────────────────────────────────────────────────────────────────┐
│ Reverse Proxy                                        [Créer]    │
├──────────────────────────────────────────────────────────────────┤
│ Description │ Source                           │ Destination    │
│─────────────┼──────────────────────────────────┼────────────────│
│ Suivi CB    │ finances.votredomaine.com:443   │ localhost:4200 │
│             │ (HTTPS)                          │ (HTTP)         │
└──────────────────────────────────────────────────────────────────┘
```

### Test de la configuration

1. Ouvrez un navigateur
2. Accédez à: `https://finances.votredomaine.com`
3. Si les containers ne sont pas encore démarrés, vous verrez:
   - **Erreur 502 Bad Gateway** ou **Erreur 503 Service Unavailable** (normal)
4. Une fois les containers démarrés, l'application devrait s'afficher

## Modifications ultérieures

Pour modifier la configuration:

1. Allez dans **Panneau de configuration** > **Portail d'application** > **Reverse Proxy**
2. Sélectionnez la ligne **Suivi CB**
3. Cliquez sur **Modifier**
4. Effectuez vos modifications
5. Cliquez sur **Enregistrer**

## Cas d'usage avancés

### Utiliser un port différent de 443

Si vous utilisez déjà le port 443 pour autre chose:

**Source:**
- Port: `8443` (ou un autre port libre)
- URL d'accès: `https://finances.votredomaine.com:8443`

**Important:** Redirigez ce port sur votre box Internet.

### Utiliser un sous-chemin au lieu d'un sous-domaine

Si vous préférez `https://votredomaine.com/finances` au lieu de `https://finances.votredomaine.com`:

**Source:**
- Nom d'hôte: `votredomaine.com`
- Port: `443`

Puis dans les paramètres avancés, ajoutez une règle de chemin (fonctionnalité limitée dans DSM).

**Recommandation:** Utilisez un sous-domaine (plus simple et plus propre).

## Troubleshooting

### Erreur 502 Bad Gateway

**Cause:** Le container frontend n'est pas démarré ou ne répond pas sur le port 4200.

**Solution:**
```bash
# Vérifier les containers
ssh admin@IP_NAS
cd /volume1/docker/suivi-cb
sudo docker-compose ps

# Si arrêté, démarrer
sudo docker-compose up -d
```

### Erreur 404 Not Found

**Cause:** Le reverse proxy est mal configuré.

**Solution:**
1. Vérifiez le port de destination (doit être `4200`)
2. Vérifiez que `localhost` est correct
3. Essayez d'accéder directement: `http://IP_NAS:4200`

### Certificat SSL invalide

**Cause:** Le certificat n'est pas assigné au bon domaine.

**Solution:**
1. Allez dans **Panneau de configuration** > **Sécurité** > **Certificat**
2. Cliquez sur **Configuration**
3. Assignez le bon certificat à `finances.votredomaine.com`

### L'application ne charge pas les ressources CSS/JS

**Cause:** Problème de configuration nginx ou de chemins.

**Solution:**
1. Vérifiez les logs du container frontend:
   ```bash
   sudo docker-compose logs frontend
   ```
2. Vérifiez la console du navigateur (F12)
3. Assurez-vous que le build Angular est correct

## Commandes utiles

```bash
# Tester le reverse proxy depuis le NAS
curl -I https://finances.votredomaine.com

# Tester directement le container
curl http://localhost:4200

# Voir les logs nginx du DSM (si nécessaire)
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

## Résumé

**Configuration minimale requise:**

1. **Onglet Général:**
   - Source: `https://finances.votredomaine.com:443`
   - Destination: `http://localhost:4200`

2. **Onglet En-têtes personnalisés:**
   - 4 en-têtes de sécurité (optionnel mais recommandé)

3. **Enregistrer**

**Temps estimé:** 5-10 minutes

---

**Prochaine étape:** Configuration du certificat SSL (voir [DEPLOYMENT_SYNOLOGY.md](./DEPLOYMENT_SYNOLOGY.md#étape-3-configuration-des-certificats-ssl))
