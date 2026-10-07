// US01: create attendee account
(function () {
  var form = document.getElementById('signup-form');
  var summary = document.getElementById('form-errors');
  var button = document.getElementById('signup-btn');
  var FIELDS = ['name', 'email', 'password', 'confirmPassword'];

  function readForm() {
    var d = {};
    FIELDS.forEach(function (f) { d[f] = form[f].value; });
    return d;
  }

  function showErrors(errors, headline) {
    FIELDS.forEach(function (f) {
      var has = Boolean(errors[f]);
      form.querySelector('[data-field="' + f + '"]').classList.toggle('has-error', has);
      form[f].setAttribute('aria-invalid', has ? 'true' : 'false');
      document.getElementById(f + '-error').textContent = errors[f] || '';
    });
    var keys = Object.keys(errors);
    if (!keys.length && !headline) { summary.hidden = true; return; }
    summary.innerHTML = '';
    summary.appendChild(ETMS.el('strong', null, headline || 'Your account was not created. Please fix the highlighted fields.'));
    if (keys.length) {
      var ul = ETMS.el('ul');
      keys.forEach(function (k) { ul.appendChild(ETMS.el('li', null, errors[k])); });
      summary.appendChild(ul);
    }
    summary.hidden = false;
    summary.focus();
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var data = readForm();
    var check = AccountValidation.validateSignup(data);
    if (!check.valid) { showErrors(check.errors); return; }
    showErrors({});

    button.disabled = true;
    fetch('/api/students/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
      .then(function (r) { return r.json().then(function (b) { return { status: r.status, body: b }; }); })
      .then(function (r) {
        if (r.status === 201) { location.href = r.body.redirect || '/login?created=1'; return; }
        form.password.value = '';
        form.confirmPassword.value = '';
        showErrors(r.body.errors || {}, r.body.error);
      })
      .catch(function () { showErrors({}, 'Could not reach the server. Your account was not created.'); })
      .finally(function () { button.disabled = false; });
  });
})();
