<#import "template.ftl" as layout>
<@layout.registrationLayout displayMessage=true displayInfo=false; section>
  <#if section == "header">${msg("emailForgotTitle")}
  <#elseif section == "form">
    <form class="sb-form" action="${url.loginAction}" method="post">
      <p class="sb-intro">${msg("resetPasswordInstruction")}</p>
      <label for="username">${msg("usernameOrEmail")}</label>
      <input id="username" name="username" type="text" autocomplete="username" autofocus required>
      <div class="sb-actions sb-actions-stack"><button type="submit">${msg("doSubmit")}</button><a class="sb-secondary-button" href="${url.loginUrl}">${msg("backToLogin")}</a></div>
    </form>
  </#if>
</@layout.registrationLayout>
