<#import "template.ftl" as layout>
<@layout.registrationLayout displayMessage=true displayInfo=false; section>
  <#if section == "header">${msg("loginTitle")}
  <#elseif section == "form">
    <form class="sb-form" action="${url.loginAction}" method="post">
      <label for="username">${msg("username")}</label>
      <p class="sb-hint">${msg("usernameHint")}</p>
      <input id="username" name="username" value="${(login.username!'')}" type="text" autocomplete="username" autofocus required>
      <details class="sb-help"><summary>${msg("whereUsername")}</summary><p>${msg("whereUsernameHelp")}</p></details>
      <div class="sb-actions"><button type="submit">${msg("doContinue")}</button></div>
    </form>
  </#if>
</@layout.registrationLayout>
