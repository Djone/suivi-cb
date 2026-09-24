<#import "template.ftl" as layout>
<@layout.registrationLayout displayMessage=false displayInfo=false; section>
  <#if section == "header">Session expirée
  <#elseif section == "form">
    <p class="sb-intro">Votre session a expiré. Veuillez recommencer.</p>
    <div class="actions"><a class="sb-primary-link" href="${url.loginRestartFlowUrl}">Retour à la connexion</a></div>
  </#if>
</@layout.registrationLayout>
