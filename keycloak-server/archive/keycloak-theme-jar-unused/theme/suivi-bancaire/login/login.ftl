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
        <button id="toggle-password" class="sb-toggle" type="button" aria-controls="password" aria-pressed="false" aria-label="${msg("showPassword")}" title="${msg("showPassword")}">
          <svg class="eye-open" aria-hidden="true" viewBox="0 0 24 24"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="3"/></svg>
          <svg class="eye-closed" aria-hidden="true" viewBox="0 0 24 24"><path d="m3 3 18 18M10.6 6.2A10.6 10.6 0 0 1 12 6c6 0 9.5 6 9.5 6a16 16 0 0 1-3 3.7M6.2 6.2C3.8 8 2.5 12 2.5 12s3.5 6 9.5 6c1.1 0 2.2-.2 3.1-.6M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>
        </button>
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
        const label = visible ? '${msg("hidePassword")}' : '${msg("showPassword")}';
        this.setAttribute('aria-label', label); this.setAttribute('title', label); this.setAttribute('aria-pressed', visible);
      });
    </script>
  </#if>
</@layout.registrationLayout>
