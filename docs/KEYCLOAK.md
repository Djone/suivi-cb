# Connexion sécurisée — version 2.2

L’application utilise le client public `suivi-cb-web` et le flux Authorization Code avec PKCE S256. Le mot de passe est saisi uniquement sur Keycloak. Les jetons restent en mémoire dans le navigateur. L’API vérifie la signature RS256, l’émetteur, l’audience `suivi-cb-api`, l’expiration, le client et le rôle `app-user`.

La base de données reste partagée : attribuer ce rôle uniquement aux personnes autorisées à voir **tous** les comptes. Aucun rôle n’est attribué automatiquement et l’inscription publique est désactivée.

## Développement local

Prérequis : Node 20 ou supérieur, Docker démarré. Depuis la racine, dans PowerShell :

```powershell
$env:KC_BOOTSTRAP_ADMIN_PASSWORD = Read-Host 'Mot de passe administrateur Keycloak'
docker compose -f docker-compose.keycloak.yml up -d
npm --prefix backend ci
npm --prefix frontend ci
npm start
```

Keycloak est accessible sur `http://localhost:8080`, l’application sur `http://localhost:4200`. Le backend utilise ces paramètres par défaut en développement. Le realm `suivi-cb` et le thème sont importés au premier démarrage. Un realm déjà présent n’est pas écrasé : appliquer les modifications via la console d’administration.

1. Se connecter à la console Keycloak avec `admin` et le mot de passe choisi.
2. Sélectionner `suivi-cb`, créer un utilisateur dans **Users**, puis définir son mot de passe dans **Credentials** (au moins 12 caractères, une majuscule, une minuscule et un chiffre).
3. Lui attribuer le rôle de realm `app-user` dans **Role mapping**. Aucun compte de démonstration ni mot de passe utilisateur n’est livré.
4. Configurer le SMTP du realm pour rendre le lien de récupération du mot de passe opérationnel.
5. Ouvrir l’application, cliquer sur « Se connecter », renseigner l’identifiant, puis le mot de passe. La présentation fonctionne aussi sans JavaScript, avec les deux champs affichés.

## Dépannage : API 401 et claim `sub` manquant

Le client `suivi-cb-web` doit avoir le client scope **basic** affecté en **Default**. Depuis Keycloak 25, ce scope fournit notamment le mapper `Subject (sub)` qui ajoute l'identifiant utilisateur au jeton d'accès. L'API exige cet identifiant.

Le fichier `keycloak/realm-dev.json` inclut ce scope. Pour un realm déjà importé, un redémarrage ne modifie pas le client existant :

1. Dans la console Keycloak, sélectionner **suivi-cb → Clients → suivi-cb-web → Client scopes**.
2. Cliquer **Add client scope**, sélectionner **basic**, puis **Add → Default**. S'il est déjà présent en **Optional**, changer son **Assigned type** en **Default**.
3. Recharger l'application et se reconnecter pour obtenir un nouveau jeton. Si une ancienne session persiste, tester dans une fenêtre privée.

Ne pas supprimer la vérification de `sub` côté backend ni supprimer le volume Docker.

Référence : [changement Keycloak 25 concernant le scope basic](https://github.com/keycloak/keycloak/blob/main/docs/documentation/upgrading/topics/changes/changes-25_0_0.adoc).

## Profil et changement de mot de passe

Le bas du menu affiche le nom, les initiales et l'email issus du jeton d'identité Keycloak (scopes `profile` et `email`). Renseigner le prénom, le nom et l'email dans **Users → utilisateur → Details**. À défaut de nom, l'application affiche l'identifiant ; un email absent n'est pas inventé. Les informations sont actualisées à la connexion et au renouvellement du jeton.

**Modifier le mot de passe** ouvre une modale, puis le parcours Keycloak `UPDATE_PASSWORD` avec réauthentification (`maxAge: 0`). Les mots de passe sont saisis uniquement dans Keycloak. Après validation ou annulation du parcours, le retour utilise l'URI `/home` déjà autorisée pour le client. Vérifier que l'action **Update Password** est activée dans **Authentication → Required actions**. Aucun identifiant administrateur ni configuration SMTP n'est nécessaire pour ce changement de mot de passe.

La déconnexion figure dans le même bloc, sur ordinateur et dans le menu mobile, et termine la session Keycloak.

## Production

Déployer Keycloak avec une base persistante adaptée à la production, HTTPS et des sauvegardes. Le fichier `docker-compose.keycloak.yml` utilise `start-dev` et est réservé au poste local.

Configurer ces variables du backend (le compose principal les transmet) :

| Variable | Valeur |
| --- | --- |
| `KEYCLOAK_URL` | URL publique HTTPS de Keycloak, sans `/realms/...` ; obligatoire en production |
| `KEYCLOAK_REALM` | `suivi-cb` |
| `KEYCLOAK_CLIENT_ID` | `suivi-cb-web` |
| `KEYCLOAK_AUDIENCE` | `suivi-cb-api` |
| `KEYCLOAK_JWKS_URL` | Facultatif, URL interne des clés si l’URL publique ne peut pas être résolue par le backend ; l’émetteur vérifié reste l’URL publique |

Le serveur refuse de démarrer en production si l’URL publique manque ou n’utilise pas HTTPS. L’authentification ne possède aucun mode de contournement.

Importer le realm de référence en remplaçant **avant import** les URLs localhost par l’origine HTTPS de l’application : URIs de retour exactes `/home` et `/silent-check-sso.html`, origine web exacte, URI de déconnexion exacte `/login`. Conserver le client public, PKCE obligatoire, l’audience, le rôle, la protection contre les tentatives répétées et les flux implicite/direct désactivés. Ne pas utiliser de wildcard d’origine. Copier `keycloak/themes/suivi-cb` dans `/opt/keycloak/themes/suivi-cb`, sélectionner le thème de connexion `suivi-cb` et configurer le SMTP. Les écrans de récupération et de changement de mot de passe héritent des formulaires Keycloak.

Au rechargement de la page, une vérification SSO silencieuse restaure la session. Si le navigateur bloque les cookies tiers, le bouton « Se connecter » permet de retrouver la session Keycloak par redirection.

`GET /api/auth/config` expose uniquement l’URL publique, le realm et l’identifiant du client, pour configurer Angular sans reconstruire le frontend. `GET /health` est une sonde sans données métier. Toutes les autres routes `/api` sont protégées, y compris les routes de release, qui gardent aussi leur restriction locale existante.

## Validation

```powershell
npm --prefix backend run test:auth
cd frontend
node node_modules/@angular/cli/bin/ng.js test --watch=false --browsers=ChromeHeadless --include=src/app/auth/auth.spec.ts
node node_modules/@angular/cli/bin/ng.js build
```

Vérifier sur une instance Keycloak : visite directe de `/transactions` sans session, identifiant/mot de passe incorrects, connexion autorisée, utilisateur sans rôle (API 403), renouvellement de session, récupération du mot de passe et déconnexion sur ordinateur/mobile. Après déconnexion, le bouton Retour du navigateur ne doit plus donner accès aux pages protégées. La déconnexion termine la session Keycloak et efface les jetons locaux ; un jeton d’accès déjà copié reste valable jusqu’à son expiration (5 minutes dans le realm fourni).

Références : [adaptateur JavaScript Keycloak](https://www.keycloak.org/securing-apps/javascript-adapter), [thèmes Keycloak](https://www.keycloak.org/ui-customization/themes), [validation JWT avec jose](https://github.com/panva/jose).
