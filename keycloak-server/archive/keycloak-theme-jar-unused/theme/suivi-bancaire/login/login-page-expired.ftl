<#import "template.ftl" as layout>
<@layout.registrationLayout displayMessage=false displayInfo=false; section>
  <#if section == "header">${msg("pageExpiredTitle")}
  <#elseif section == "form">
    <p class="sb-intro">${msg("sessionExpiredMessage")}</p>
    <div class="sb-actions"><a class="sb-primary-link" href="${url.loginRestartFlowUrl}">${msg("backToLogin")}</a></div>
  </#if>
</@layout.registrationLayout>
