// US08: create-event form   US09: validation feedback
// Sprint 4 - US39: the same form edits an existing event · US51: free or demo-paid · US46: category
(function () {
  var form = document.getElementById('event-form');
  var summary = document.getElementById('form-errors');
  var submitBtn = document.getElementById('submit-btn');
  var editing = form.dataset.mode === 'edit';
  var eventId = editing ? location.pathname.split('/').filter(Boolean)[2] : null;
  var FIELDS = ['title', 'description', 'date', 'time', 'location', 'capacity', 'category', 'paymentType', 'price'];
  var minCapacity = 0;

  ETMS.loadCurrentUser();
  form.date.min = EventValidation.localDateString(new Date());

  // Category options come from the shared list, so browser and server always agree
  EventValidation.CATEGORIES.forEach(function (c) {
    var o = document.createElement('option');
    o.value = c.value;
    o.textContent = c.label;
    form.category.appendChild(o);
  });
  if (!editing) form.category.value = 'other';

  var priceField = document.getElementById('price-field');
  function syncPrice() {
    priceField.hidden = paymentType() !== 'demo_paid';
  }
  function paymentType() {
    var checked = form.querySelector('input[name="paymentType"]:checked');
    return checked ? checked.value : '';
  }
  form.addEventListener('change', function (e) { if (e.target.name === 'paymentType') syncPrice(); });

  function readForm() {
    var data = {};
    FIELDS.forEach(function (f) { data[f] = f === 'paymentType' ? paymentType() : form[f].value; });
    return data;
  }

  function fieldWrap(f) { return form.querySelector('[data-field="' + f + '"]'); }

  function showErrors(errors, headline) {
    FIELDS.forEach(function (f) {
      var wrap = fieldWrap(f);
      var msg = document.getElementById(f + '-error');
      var has = Boolean(errors[f]);
      wrap.classList.toggle('has-error', has);
      if (form[f] && form[f].setAttribute) form[f].setAttribute('aria-invalid', has ? 'true' : 'false');
      msg.textContent = errors[f] || '';
    });

    var keys = Object.keys(errors);
    if (!keys.length && !headline) { summary.hidden = true; return; }
    summary.innerHTML = '';
    var strong = document.createElement('strong');
    strong.textContent = headline || (editing
      ? 'Your changes were not saved. Please fix the highlighted fields.'
      : 'The event was not created. Please fix the highlighted fields.');
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

  function check() {
    return EventValidation.validateEvent(readForm(), new Date(), { minCapacity: minCapacity });
  }

  // Re-check a field when the organizer leaves it, once they've tried to submit.
  var attempted = false;
  form.addEventListener('focusout', function () {
    if (attempted) {
      var r = check();
      FIELDS.forEach(function (f) {
        fieldWrap(f).classList.toggle('has-error', Boolean(r.errors[f]));
        document.getElementById(f + '-error').textContent = r.errors[f] || '';
      });
    }
  });

  // US39: fill the form with the event's current information
  function loadForEdit() {
    var loading = document.getElementById('form-loading');
    var note = document.getElementById('edit-note');
    fetch('/api/organizer/events/' + encodeURIComponent(eventId))
      .then(function (r) {
        if (r.status === 401) { location.href = '/organizer/login?next=' + encodeURIComponent(location.pathname); throw new Error('login'); }
        return r.json().then(function (b) { return { ok: r.ok, body: b }; });
      })
      .then(function (r) {
        loading.hidden = true;
        if (!r.ok) { showErrors({}, r.body.error || 'Event not found.'); return; }
        var ev = r.body.event;
        document.getElementById('back-link').href = '/organizer/events/' + ev.id;
        document.getElementById('back-btn').href = '/organizer/events/' + ev.id;
        if (ev.isCancelled || r.body.started) {
          showErrors({}, ev.isCancelled ? 'This event has been cancelled, so it can no longer be edited.'
            : 'This event has already started, so it can no longer be edited.');
          return;
        }
        form.title.value = ev.title;
        form.description.value = ev.description;
        form.date.value = ev.date;
        form.time.value = ev.time;
        form.location.value = ev.location;
        form.capacity.value = ev.capacity;
        form.category.value = ev.category;
        document.getElementById(ev.paymentType === 'demo_paid' ? 'pay-demo' : 'pay-free').checked = true;
        form.price.value = ev.paymentType === 'demo_paid' ? (ev.priceCents / 100).toFixed(2) : '';
        minCapacity = ev.ticketsIssued || 0;
        if (minCapacity) {
          note.textContent = minCapacity + (minCapacity === 1 ? ' ticket has' : ' tickets have') +
            ' already been issued, so the capacity cannot go below ' + minCapacity + '.';
          note.hidden = false;
        }
        syncPrice();
        form.hidden = false;
        form.title.focus();
      })
      .catch(function (e) { if (e.message !== 'login') showErrors({}, 'Could not load this event. Please refresh the page.'); });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    attempted = true;
    var data = readForm();

    // US09: check in the browser first, the server checks again with the same rules.
    var result = check();
    if (!result.valid) { showErrors(result.errors); return; }
    showErrors({});

    submitBtn.disabled = true; // stops a double-click from sending the form twice
    fetch(editing ? '/api/organizer/events/' + encodeURIComponent(eventId) : '/api/events', {
      method: editing ? 'PUT' : 'POST',
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
        if (editing && r.status === 200) {
          location.href = '/organizer/events/' + r.body.event.id + '?updated=1';
          return;
        }
        if (r.status === 401) { location.href = '/organizer/login?next=' + encodeURIComponent(location.pathname); return; }
        showErrors(r.body.errors || {}, r.body.error);
      })
      .catch(function () {
        showErrors({}, editing ? 'Could not reach the server. Your changes were not saved.' : 'Could not reach the server. Your event was not created.');
      })
      .finally(function () { submitBtn.disabled = false; });
  });

  syncPrice();
  if (editing) loadForEdit();
})();
