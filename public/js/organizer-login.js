// US05: organizer login form
(function () {
  var form = document.getElementById('login-form');
  var errorBox = document.getElementById('login-error');
  var button = document.getElementById('login-btn');

  function showError(msg) {
    errorBox.textContent = msg;
    errorBox.hidden = false;
  }

  // Only allow redirects back to organizer pages on this site.
  function safeNext() {
    var next = new URLSearchParams(location.search).get('next');
    return next && /^\/organizer(\/|$)/.test(next) ? next : null;
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    errorBox.hidden = true;
    var email = form.email.value.trim();
    var password = form.password.value;
    if (!email || !password) {
      showError('Enter both your email and password.');
      return;
    }
    button.disabled = true;
    fetch('/api/organizer/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, password: password }),
    })
      .then(function (res) {
        return res.json().then(function (data) { return { ok: res.ok, data: data }; });
      })
      .then(function (r) {
        if (!r.ok) {
          showError(r.data.error || 'Login failed.');
          form.password.value = '';
          return;
        }
        location.href = safeNext() || r.data.redirect || '/organizer';
      })
      .catch(function () { showError('Could not reach the server. Try again.'); })
      .finally(function () { button.disabled = false; });
  });
})();
