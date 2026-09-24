<#import "template.ftl" as layout>
<@layout.registrationLayout displayMessage=true displayInfo=false; section>
  <#if section == "header">
    Accéder à mon espace client
  <#elseif section == "form">
    <form id="bank-login" action="${url.loginAction}" method="post">
      <div id="identifier-step">
        <label for="username">Identifiant</label>
        <p class="field-hint" id="username-hint">Saisissez votre identifiant</p>
        <input id="username" name="username" type="text" value="${(login.username!'')}"
               autocomplete="username" required autofocus aria-describedby="username-hint" />
        <details class="identifier-help">
          <summary>Où trouver mon identifiant ?</summary>
          <p>Utilisez l’identifiant communiqué par l’administrateur de votre espace Suivi Bancaire.</p>
        </details>
        <div class="actions"><button id="next-step" type="button" hidden>Valider</button></div>
      </div>
      <div id="password-step">
        <label for="password">Mot de passe</label>
        <p class="field-hint" id="password-hint">Saisissez votre mot de passe personnel</p>
        <div class="password-row">
          <input id="password" name="password" type="password" autocomplete="current-password"
                 required aria-describedby="password-hint" />
          <button id="toggle-password" class="password-toggle" type="button" aria-controls="password"
                  aria-label="Afficher le mot de passe" aria-pressed="false" title="Afficher le mot de passe" hidden>
            <svg class="eye-open" aria-hidden="true" viewBox="0 0 24 24"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="3"/></svg>
            <svg class="eye-closed" aria-hidden="true" viewBox="0 0 24 24"><path d="m3 3 18 18M10.6 6.2A10.6 10.6 0 0 1 12 6c6 0 9.5 6 9.5 6a16 16 0 0 1-3 3.7M6.2 6.2C3.8 8 2.5 12 2.5 12s3.5 6 9.5 6c1.1 0 2.2-.2 3.1-.6M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>
          </button>
        </div>
        <#if realm.resetPasswordAllowed>
          <a class="reset-link" href="${url.loginResetCredentialsUrl}">J’ai oublié mon mot de passe</a>
        </#if>
        <input type="hidden" name="credentialId" value="${(auth.selectedCredential!'')}" />
        <div class="actions">
          <button id="previous-step" class="text-button" type="button" hidden>Retour</button>
          <button id="connect" type="submit">Se connecter</button>
        </div>
      </div>
    </form>
  </#if>
</@layout.registrationLayout>
