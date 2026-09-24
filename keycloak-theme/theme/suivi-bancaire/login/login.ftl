<#import "template.ftl" as layout>
<@layout.registrationLayout displayMessage=!messagesPerField.existsError('username','password') displayInfo=false; section>
  <#if section == "header">${msg("loginTitle")}
  <#elseif section == "form">
    <form class="sb-form" action="${url.loginAction}" method="post">
      <#if !usernameHidden??>
        <label for="username">${msg("username")}</label>
        <input id="username" name="username" value="${(login.username!'')}" type="text" autocomplete="username" required>
      </#if>
      <label for="password">${msg("password")}</label>
      <p class="sb-hint">${msg("passwordHint")}</p>
      <div class="sb-password-field">
        <input id="password" name="password" type="password" autocomplete="current-password" required>
        <button id="toggle-password" class="sb-toggle" type="button" aria-controls="password" aria-pressed="false">${msg("showPassword")}</button>
      </div>
      <#if messagesPerField.existsError('username','password')><p class="sb-field-error">${kcSanitize(messagesPerField.getFirstError('username','password'))?no_esc}</p></#if>
      <#if realm.resetPasswordAllowed><a class="sb-link" href="${url.loginResetCredentialsUrl}">${msg("doForgotPassword")}</a></#if>
      <input type="hidden" name="credentialId" value="${(auth.selectedCredential!'')}">
      <div class="sb-actions"><button type="submit">${msg("doLogIn")}</button></div>
    </form>
    <script>
      document.getElementById('toggle-password')?.addEventListener('click', function () {
        const input = document.getElementById('password');
        const visible = input.type === 'password'; input.type = visible ? 'text' : 'password';
        this.textContent = visible ? '${msg("hidePassword")}' : '${msg("showPassword")}'; this.setAttribute('aria-pressed', visible);
      });
    </script>
  </#if>
</@layout.registrationLayout>
