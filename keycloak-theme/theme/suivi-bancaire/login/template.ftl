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
</head>
<body class="sb-page ${bodyClass}">
  <main class="sb-shell">
    <section class="sb-card" aria-labelledby="sb-title">
      <div class="sb-brand"><span class="sb-brand-mark">SB</span><span>Suivi Bancaire</span></div>
      <h1 id="sb-title"><#nested "header"></h1>
      <#if displayMessage && message?has_content>
        <div class="alert alert-${message.type!"info"}" role="alert">${kcSanitize(message.summary)?no_esc}</div>
      </#if>
      <#nested "form">
      <#if displayInfo><#nested "info"></#if>
    </section>
  </main>
</body>
</html>
</#macro>
