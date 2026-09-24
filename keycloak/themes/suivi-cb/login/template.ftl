<#macro registrationLayout bodyClass="" displayInfo=false displayMessage=true>
<!doctype html>
<html lang="${locale.currentLanguageTag!(lang!'fr')}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${realm.displayName!'Suivi Bancaire'}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link href="${url.resourcesPath}/css/login.css" rel="stylesheet">
  <script defer src="${url.resourcesPath}/js/login.js"></script>
</head>
<body class="sb-page ${bodyClass}">
  <main class="sb-shell">
    <p class="sb-site-name">SUIVI BANCAIRE</p>
    <section class="sb-card" aria-labelledby="sb-title">
      <div class="sb-brand"><span class="sb-brand-mark" aria-hidden="true">▣</span><span>Suivi Bancaire</span></div>
      <h1 id="sb-title"><#nested "header"></h1>
      <#if displayMessage && message?has_content>
        <div class="alert alert-${message.type!"info"}" role="alert">${kcSanitize(message.summary)?no_esc}</div>
      </#if>
      <#nested "form">
      <#if displayInfo><#nested "info"></#if>
    </section>
    <p class="sb-footer">© 2026 Suivi Bancaire · Version 2.1.0</p>
  </main>
</body>
</html>
</#macro>
