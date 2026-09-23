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
          <button id="toggle-password" class="text-button" type="button" aria-pressed="false" hidden>Afficher</button>
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
