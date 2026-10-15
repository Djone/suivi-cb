<#import "template.ftl" as layout>
<#macro passwordField id label errorKey autofocus=false>
  <div class="sb-update-field">
    <label for="${id}">${msg(label)}</label>
    <div class="password-row">
      <input type="password" id="${id}" name="${id}" autocomplete="new-password"
             <#if autofocus>autofocus</#if> aria-invalid="${messagesPerField.existsError(errorKey)?c}"
             <#if messagesPerField.existsError(errorKey)>aria-describedby="input-error-${id}"</#if> />
      <button class="password-toggle" type="button" data-sb-password-toggle hidden
              aria-controls="${id}" aria-label="${msg('showPassword')}" title="${msg('showPassword')}"
              aria-pressed="false" data-label-show="${msg('showPassword')}" data-label-hide="${msg('hidePassword')}">
        <svg class="eye-open" aria-hidden="true" viewBox="0 0 24 24"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="3"/></svg>
        <svg class="eye-closed" aria-hidden="true" viewBox="0 0 24 24"><path d="m3 3 18 18M10.6 6.2A10.6 10.6 0 0 1 12 6c6 0 9.5 6 9.5 6a16 16 0 0 1-3 3.7M6.2 6.2C3.8 8 2.5 12 2.5 12s3.5 6 9.5 6c1.1 0 2.2-.2 3.1-.6M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>
      </button>
    </div>
    <#if messagesPerField.existsError(errorKey)>
      <p id="input-error-${id}" class="sb-field-error" aria-live="polite">${kcSanitize(messagesPerField.get(errorKey))?no_esc}</p>
    </#if>
  </div>
</#macro>
<@layout.registrationLayout bodyClass="sb-password-update" displayMessage=!messagesPerField.existsError('password','password-confirm'); section>
  <#if section == "header">
    ${msg("updatePasswordTitle")}
  <#elseif section == "form">
    <form id="kc-passwd-update-form" action="${url.loginAction}" method="post">
      <@passwordField id="password-new" label="passwordNew" errorKey="password" autofocus=true />
      <@passwordField id="password-confirm" label="passwordConfirm" errorKey="password-confirm" />
      <label class="sb-logout-sessions" for="logout-sessions">
        <input type="checkbox" id="logout-sessions" name="logout-sessions" value="on" />
        <span>${msg("logoutOtherSessions")}</span>
      </label>
      <div class="sb-update-actions">
        <#if isAppInitiatedAction??>
          <button class="sb-update-cancel" type="submit" name="cancel-aia" value="true" formnovalidate>${msg("doCancel")}</button>
        </#if>
        <button class="sb-update-submit" type="submit" name="login" value="true">${msg("doSubmit")}</button>
      </div>
    </form>
  </#if>
</@layout.registrationLayout>
