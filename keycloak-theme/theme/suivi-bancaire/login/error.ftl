<#import "template.ftl" as layout>
<@layout.registrationLayout displayMessage=false displayInfo=false; section>
  <#if section == "header">${msg("errorTitle")}
  <#elseif section == "form">
    <div class="alert alert-error" role="alert">${kcSanitize(message.summary)?no_esc}</div>
    <div class="sb-actions"><a class="sb-primary-link" href="${url.loginUrl}">${msg("backToLogin")}</a></div>
  </#if>
</@layout.registrationLayout>
