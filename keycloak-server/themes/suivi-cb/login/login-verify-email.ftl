<#import "template.ftl" as layout>
<@layout.registrationLayout displayMessage=true displayInfo=false; section>
  <#if section == "header">Vérification de votre adresse e-mail
  <#elseif section == "form">
    <p class="sb-intro">Un e-mail de confirmation a été envoyé à ${user.email!}.</p>
    <p class="sb-intro">Ouvrez ce message et suivez les instructions pour valider votre adresse e-mail.</p>
  </#if>
</@layout.registrationLayout>
