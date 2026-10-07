// US08: create-event form   US09: validation feedback
(function () {
  var form = document.getElementById('event-form');
  var summary = document.getElementById('form-errors');
  var submitBtn = document.getElementById('submit-btn');
  var FIELDS = ['title', 'description', 'date', 'time', 'location', 'capacity'];

  ETMS.loadCurrentUser();
  form.date.min = EventValidation.localDateString(new Date());

  function readForm() {
    var data = {};
    FIELDS.forEach(function (f) { data[f] = form[f].value; });
    return data;
  }

  function showErrors(errors, headline) {
    FIELDS.forEach(function (f) {
      var wrap = form.querySelector('[data-field="' + f + '"]');
      var msg = document.getElementById(f + '-error');
      var has = Boolean(errors[f]);
      wrap.classList.toggle('has-error', has);
      form[f].setAttribute('aria-invalid', has ? 'true' : 'false');
      msg.textContent = errors[f] || '';
    });

    var keys = Object.keys(errors);
    if (!keys.length && !headline) { summary.hidden = true; return; }
    summary.innerHTML = '';
    var strong = document.createElement('strong');
    strong.textContent = headline || 'The event was not created. Please fix the highlighted fields.';
    summary.appendChild(strong);
    if (keys.length) {
      var ul = document.createElement('ul');
      keys.forEach(function (k) {
        var li = document.createElement('li');
        li.textContent = errors[k];
        ul.appendChild(li);
      });
      summary.appendChild(ul);
    }
    summary.hidden = false;
    summary.focus();
  }

  // Re-check a field when the organizer leaves it, once they've tried to submit.
  var attempted = false;
  form.addEventListener('focusout', function () {
    if (attempted) {
      var r = EventValidation.validateEvent(readForm());
      FIELDS.forEach(function (f) {
        var wrap = form.querySelector('[data-field="' + f + '"]');
        wrap.classList.toggle('has-error', Boolean(r.errors[f]));
        document.getElementById(f + '-error').textContent = r.errors[f] || '';
      });
    }
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    attempted = true;
    var data = readForm();

    // US09: check in the browser first, the server checks again with the same rules.
    var result = EventValidation.validateEvent(data);
    if (!result.valid) { showErrors(result.errors); return; }
    showErrors({});

    submitBtn.disabled = true;
    fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
      .then(function (res) {
        return res.json().then(function (body) { return { status: res.status, body: body }; });
      })
      .then(function (r) {
        if (r.status === 201) {
          location.href = '/organizer?created=' + r.body.event.id;
          return;
        }
        if (r.status === 401) { location.href = '/organizer/login?next=/organizer/events/new'; return; }
        showErrors(r.body.errors || {}, r.body.error);
      })
      .catch(function () { showErrors({}, 'Could not reach the server. Your event was not created.'); })
      .finally(function () { submitBtn.disabled = false; });
  });
})();
