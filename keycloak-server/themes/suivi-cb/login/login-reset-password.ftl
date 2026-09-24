<#import "template.ftl" as layout>
<@layout.registrationLayout displayMessage=true displayInfo=false; section>
  <#if section == "header">Mot de passe oublié ?
  <#elseif section == "form">
    <form id="kc-reset-password-form" action="${url.loginAction}" method="post">
      <label for="username">Nom d’utilisateur ou courriel</label>
      <input id="username" name="username" type="text" autocomplete="username" autofocus required />
      <a class="reset-link" href="${url.loginUrl}">« Retour à la connexion</a>
      <div class="actions"><button type="submit">Soumettre</button></div>
      <p class="sb-intro">Entrez votre nom d’utilisateur ou votre adresse de courriel et nous vous enverrons un courriel avec les instructions pour créer un nouveau mot de passe.</p>
    </form>
  </#if>
</@layout.registrationLayout>
