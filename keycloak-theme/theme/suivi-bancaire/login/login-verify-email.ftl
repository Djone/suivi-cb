<#import "template.ftl" as layout>
<@layout.registrationLayout displayMessage=true displayInfo=false; section>
  <#if section == "header">${msg("emailVerifyTitle")}
  <#elseif section == "form">
    <p class="sb-intro">${msg("verifyEmailSent", user.email!'')}</p>
    <p class="sb-hint">${msg("verifyEmailInstructions")}</p>
  </#if>
</@layout.registrationLayout>
