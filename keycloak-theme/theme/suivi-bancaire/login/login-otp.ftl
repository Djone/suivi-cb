<#import "template.ftl" as layout>

<@layout.registrationLayout displayMessage=!messagesPerField.existsError('totp'); section>
  <#if section = "header">
    Connexion
  <#elseif section = "form">
    <form id="kc-otp-login-form" action="${url.loginAction}" method="post">
      <#if otpLogin.userOtpCredentials?size gt 1>
        <fieldset class="sb-otp-devices">
          <legend>Application d'authentification</legend>
          <p>Choisissez l'appareil qui génère votre code.</p>
          <#list otpLogin.userOtpCredentials as otpCredential>
            <label class="sb-otp-device" for="kc-otp-credential-${otpCredential?index}">
              <input id="kc-otp-credential-${otpCredential?index}" type="radio" name="selectedCredentialId"
                value="${otpCredential.id}" <#if otpCredential.id == otpLogin.selectedCredentialId>checked</#if>>
              <span>${otpCredential.userLabel!'Application sans nom'}</span>
            </label>
          </#list>
        </fieldset>
      </#if>

      <label for="otp">${msg("loginOtpOneTime")}</label>
      <input id="otp" name="otp" autocomplete="one-time-code" type="text" autofocus
        aria-invalid="<#if messagesPerField.existsError('totp')>true</#if>" dir="ltr">
      <#if messagesPerField.existsError('totp')>
        <p class="sb-field-error" id="input-error-otp-code" role="alert">${kcSanitize(messagesPerField.get('totp'))?no_esc}</p>
      </#if>

      <div class="sb-otp-recovery">
        <#if realm.resetPasswordAllowed>
          <a href="${url.loginResetCredentialsUrl}">Je n'ai plus accès à mon application d'authentification</a>
        </#if>
        <a href="${url.loginRestartFlowUrl}">Recommencer la connexion</a>
      </div>
      <div class="sb-actions"><button name="login" id="kc-login" type="submit">${msg("doLogIn")}</button></div>
    </form>
  </#if>
</@layout.registrationLayout>
