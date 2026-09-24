<#import "template.ftl" as layout>
<@layout.registrationLayout displayMessage=false displayInfo=false; section>
  <#if section == "header">Une erreur est survenue
  <#elseif section == "form">
    <div class="alert alert-error" role="alert">${kcSanitize(message.summary)?no_esc}</div>
    <div class="actions"><a class="sb-primary-link" href="${url.loginUrl}">Retour à la connexion</a></div>
  </#if>
</@layout.registrationLayout>
