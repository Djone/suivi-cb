# Connexion sécurisée — version 2.2

L’application utilise le client public `suivi-cb-web` et le flux Authorization Code avec PKCE S256. Le mot de passe est saisi uniquement sur Keycloak. Les jetons restent en mémoire dans le navigateur. L’API vérifie la signature RS256, l’émetteur, l’audience `suivi-cb-api`, l’expiration, le client et le rôle `app-user`.

La base de données reste partagée : attribuer ce rôle uniquement aux personnes autorisées à voir **tous** les comptes. Aucun rôle n’est attribué automatiquement et l’inscription publique est désactivée.

## Développement local

Prérequis : Node 24 ou supérieur, Docker démarré. Depuis la racine, dans PowerShell :

```powershell
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

## Authentification à deux facteurs (OTP)

Le lien **Configurer l'OTP** du bloc compte ouvre une modale de confirmation. En choisissant **Oui**, l'application lance l'action Keycloak `CONFIGURE_TOTP` avec réauthentification (`maxAge: 0`). Keycloak affiche alors son parcours sécurisé : l'utilisateur associe son application d'authentification en scannant le QR code et confirme le code généré. La clé secrète et les codes temporaires ne transitent jamais par l'application.

### Autorisation du statut OTP dans le menu

Pour supprimer l'OTP sans redirection, le jeton doit aussi contenir le claim `acr`. Dans **Clients → suivi-cb-web → Client scopes**, ajouter le scope standard **acr** en **Default**. S'il est déjà affecté, vérifier dans **Client scopes → acr → Mappers → acr loa level** que **Add to access token** est activé. Se déconnecter puis se reconnecter une fois pour obtenir un nouveau jeton. Le journal Keycloak `no acr claim on the token` indique précisément ce manque. Ne pas remplacer ce mapper par une valeur constante : Keycloak doit fournir le niveau réel d'authentification.

Un `KEYCLOAK_ACCOUNT_401` peut aussi provenir d'un émetteur incohérent : en mode développement sans `KC_HOSTNAME`, un appel à `127.0.0.1` fait attendre à Keycloak un émetteur différent de celui du jeton obtenu sur `localhost`. Le backend utilise désormais la même URL publique pour cet appel. En local, laisser `KEYCLOAK_ACCOUNT_URL` absent ou égal à `http://localhost:8080`. Si une URL interne distincte est nécessaire en production, fixer `KC_HOSTNAME` sur l'URL publique complète de Keycloak. Voir [la configuration du hostname Keycloak](https://www.keycloak.org/server/hostname).

L'interrupteur du menu interroge l'API de compte de Keycloak avec le jeton de l'utilisateur. Cette API doit donc recevoir le rôle client **`manage-account`** du client intégré **`account`**, ainsi que l'audience `account`. Le backend accepte l'audience métier `suivi-cb-api` ou l'audience `account`, mais vérifie toujours le client autorisé `suivi-cb-web` et le rôle de realm `app-user`. Sans l'audience `account`, Keycloak renvoie `KEYCLOAK_ACCOUNT_401` et l'application ne peut pas distinguer un OTP configuré d'un OTP absent.

Pour corriger le realm déjà créé :

1. Ouvrir **Users → votre utilisateur → Role mapping → Assign role**.
2. Filtrer par client, choisir **account**, sélectionner **manage-account**, puis cliquer **Assign**.
3. Ouvrir **Clients → suivi-cb-web → Client scopes → suivi-cb-web-dedicated → Scope**, puis affecter aussi le rôle client **account → manage-account**. Cette étape ajoute réellement le rôle dans le jeton émis pour `suivi-cb-web` ; l'attribution à l'utilisateur seule ne suffit pas lorsque le client limite ses rôles de scope.
4. Dans ce même scope dédié (ou l'onglet **Mappers** suivant la version), ajouter un mapper de type **Audience** avec `Included Client Audience` = `account` et `Add to access token` activé. L'audience métier `suivi-cb-api` doit rester présente dans le même jeton.
5. Se déconnecter puis se reconnecter : le jeton existant ne contient pas les nouvelles autorisations.

Pour que chaque nouvel utilisateur en bénéficie, attribuer aussi `account → manage-account` au rôle de realm par défaut `default-roles-suivi-cb`. Le mapper d'audience `account` est déjà présent dans `keycloak/realm-dev.json` pour les nouveaux imports ; un realm déjà importé n'est jamais modifié automatiquement par ce fichier.

Dans la console Keycloak, vérifier dans **Authentication → Required actions** que **Configure OTP** est activée, sans être définie comme action obligatoire par défaut : l'activation reste ainsi un choix de l'utilisateur. Conserver le flux **Browser - Conditional 2FA** montré dans la configuration : condition « user configured », condition « credential », puis **OTP Form** requis. Dès qu'un utilisateur a configuré l'OTP, Keycloak lui demandera son code lors des connexions suivantes ; les autres utilisateurs poursuivent avec identifiant et mot de passe.

Si Keycloak indique que le code est invalide pendant l'enrôlement, annuler le parcours puis le recommencer depuis l'application. Supprimer dans l'application d'authentification toute entrée créée lors des essais précédents et scanner uniquement le QR code de la page actuelle : chaque nouveau parcours utilise une nouvelle clé. Vérifier que l'horloge du téléphone est réglée automatiquement. Dans **Realm settings → Authentication → OTP policy**, conserver les valeurs compatibles avec l'application d'authentification : `TOTP`, `HmacSHA1`, `6` chiffres et période de `30` secondes. Le champ « Nom d'appareil » est facultatif.

Lorsqu'un OTP existe, le menu affiche un interrupteur vert et le libellé **Désactiver l'OTP**. Après confirmation dans l'application, `DELETE /api/auth/otp-credentials` liste puis supprime tous les identifiants de type `otp` du compte courant via l'API Account de Keycloak, avec le jeton de l'utilisateur. Aucun identifiant utilisateur ou identifiant de credential fourni par le navigateur n'est accepté. Les mots de passe et les autres types de credentials ne sont pas supprimés. Une nouvelle lecture confirme l'absence d'OTP avant de fermer la modale et de remettre l'interrupteur au gris. La session reste ouverte, sans redirection. En cas de refus ou de suppression partielle, la modale conserve une erreur et permet de réessayer.

Compatibilité : le DELETE Account est disponible mais déprécié dans [Keycloak 26.6.0](https://github.com/keycloak/keycloak/blob/26.6.0/services/src/main/java/org/keycloak/services/resources/account/AccountCredentialResource.java). Il exige `account → manage-account` et vérifie le niveau d'authentification du jeton (`acr`). L'application ne contourne pas un refus de Keycloak ; vérifier ce parcours lors des mises à jour de Keycloak. Le flux direct n'utilise plus l'action `delete_credential` ni une seconde confirmation Keycloak.

## Perte d'un appareil OTP

Si l'utilisateur a supprimé son compte de son application d'authentification ou perdu son téléphone, la page OTP affiche le lien **Je n'ai plus accès à mon application d'authentification**. Il mène au parcours **Mot de passe oublié** de Keycloak. Après vérification du lien reçu par email, le flux standard **Reset Credentials** réinitialise le mot de passe et l'identifiant OTP : l'utilisateur configure ensuite un nouvel appareil. Ce parcours nécessite que le SMTP du realm soit configuré et que le sous-flux **Reset - Conditional OTP** reste activé dans **Authentication → Flows → Reset Credentials**.

Prévoir aussi des codes de secours pour éviter cette procédure. Avec Keycloak 26.3 ou supérieur :

1. Dans **Authentication → Flows → Browser → Browser - Conditional 2FA**, passer **OTP Form** et **Recovery Authentication Code Form** à **Alternative**.
2. Dans **Authentication → Required actions**, activer **Recovery Authentication Codes**. Dans la configuration de **Configure OTP**, activer **Add recovery codes** pour les proposer à chaque nouvel enrôlement OTP.
3. L'utilisateur enregistre les douze codes affichés par Keycloak dans un gestionnaire de mots de passe ou un autre emplacement sûr. Sur l'écran OTP, **Essayer une autre méthode** permet alors de saisir le prochain code de secours.

Chaque code de secours est utilisable une seule fois. Si l'utilisateur n'a ni l'appareil OTP, ni un code de secours, ni accès à son email, un administrateur doit supprimer l'identifiant OTP dans **Users → utilisateur → Credentials**, puis l'utilisateur se reconnecte avec son mot de passe et configure un nouvel OTP.

## Conservation de la session après rechargement

Dans **Authentication → Flows → Browser**, l'exécution **Cookie** doit rester en **Alternative** et le sous-flux **Browser Forms** doit aussi être en **Alternative**. À l'intérieur de ce sous-flux, **Username Password Form** reste en **Required**. Le sous-flux **Browser - Conditional 2FA** reste en **Conditional**, avec ses conditions en **Required** et **OTP Form** en **Required**.

Ne pas mettre **Browser Forms** en **Required** au même niveau que **Cookie** : Keycloak ignore alors le cookie SSO et redemande une connexion complète à chaque rechargement. Keycloak écrit dans ses journaux `REQUIRED and ALTERNATIVE elements at same level` lorsque cette configuration est incorrecte.

## Production

Pour une installation indépendante sur un NAS Synology avec PostgreSQL et
reverse proxy, suivre [KEYCLOAK_NAS.md](./KEYCLOAK_NAS.md).

Déployer Keycloak avec une base persistante adaptée à la production, HTTPS et des sauvegardes. Le fichier `docker-compose.keycloak.yml` utilise `start-dev` et est réservé au poste local.

Configurer ces variables du backend (le compose principal les transmet) :

| Variable | Valeur |
| --- | --- |
| `KEYCLOAK_URL` | URL publique HTTPS de Keycloak, sans `/realms/...` ; obligatoire en production |
| `KEYCLOAK_REALM` | `suivi-cb` |
| `KEYCLOAK_CLIENT_ID` | `suivi-cb-web` |
| `KEYCLOAK_AUDIENCE` | `suivi-cb-api` |
| `KEYCLOAK_JWKS_URL` | Facultatif, URL interne des clés si l’URL publique ne peut pas être résolue par le backend ; l’émetteur vérifié reste l’URL publique |
| `KEYCLOAK_ACCOUNT_URL` | Facultatif, URL interne de Keycloak pour lire les identifiants OTP ; utiliser l’URL du réseau Docker ou du NAS si elle diffère de l’URL publique |

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
