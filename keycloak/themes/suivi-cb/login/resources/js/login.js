document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('bank-login');
  if (!form) return; // Other Keycloak screens keep the inherited behaviour.
  const identifier = document.getElementById('identifier-step');
  const secret = document.getElementById('password-step');
  const username = document.getElementById('username');
  const password = document.getElementById('password');
  const next = document.getElementById('next-step');
  const previous = document.getElementById('previous-step');
  const toggle = document.getElementById('toggle-password');

  function showPassword() {
    if (!username.reportValidity()) return;
    identifier.hidden = true;
    secret.hidden = false;
    password.disabled = false;
    password.focus();
  }
  next.hidden = previous.hidden = toggle.hidden = false;
  secret.hidden = true;
  password.disabled = true;
  next.addEventListener('click', showPassword);
  username.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') { event.preventDefault(); showPassword(); }
  });
  previous.addEventListener('click', () => {
    password.value = '';
    password.type = 'password';
    toggle.textContent = 'Afficher';
    toggle.setAttribute('aria-pressed', 'false');
    secret.hidden = true;
    password.disabled = true;
    identifier.hidden = false;
    username.focus();
  });
  toggle.addEventListener('click', () => {
    const visible = password.type === 'password';
    password.type = visible ? 'text' : 'password';
    toggle.textContent = visible ? 'Masquer' : 'Afficher';
    toggle.setAttribute('aria-pressed', String(visible));
  });
  form.addEventListener('submit', (event) => {
    if (secret.hidden) { event.preventDefault(); showPassword(); return; }
    document.getElementById('connect').disabled = true;
  });
});
