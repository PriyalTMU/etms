// US02: student login   US03: invalid login rejected with a clear message
(function () {
  var form = document.getElementById('login-form');
  var errorBox = document.getElementById('login-error');
  var created = document.getElementById('created-msg');
  var button = document.getElementById('login-btn');
  var params = new URLSearchParams(location.search);

  if (params.get('created')) created.hidden = false;

  function safeNext() {
    var next = params.get('next');
    return next && /^\/events(\/|$)/.test(next) ? next : null;
  }

  function showError(msg) {
    created.hidden = true;
    errorBox.textContent = msg;
    errorBox.hidden = false;
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    errorBox.hidden = true;
    var email = form.email.value.trim();
    var password = form.password.value;
    if (!email || !password) { showError('Enter both your email and password.'); return; }

    button.disabled = true;
    fetch('/api/students/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, password: password }),
    })
      .then(function (r) { return r.json().then(function (b) { return { ok: r.ok, body: b }; }); })
      .then(function (r) {
        if (!r.ok) {
          showError(r.body.error || 'Login failed.');
          form.password.value = '';
          form.password.focus();
          return;
        }
        location.href = safeNext() || r.body.redirect || '/events';
      })
      .catch(function () { showError('Could not reach the server. Try again.'); })
      .finally(function () { button.disabled = false; });
  });
})();
