// Sprint 4 - T94 / US53: simulated checkout · T95 / US54: ticket after a successful demo payment
// US50: failures show a clear reason · R19: a repeated click can never create a second ticket
(function () {
  var token = decodeURIComponent(location.pathname.split('/').filter(Boolean)[1] || '');
  var loading = document.getElementById('loading');
  var errorBox = document.getElementById('checkout-error');
  var card = document.getElementById('checkout');
  var result = document.getElementById('co-result');
  var actions = document.getElementById('co-actions');
  var after = document.getElementById('co-after');
  var buttons = ['co-pay', 'co-decline', 'co-cancel'].map(function (id) { return document.getElementById(id); });
  var eventId = null;
  var busy = false;

  function fail(msg) { loading.hidden = true; errorBox.textContent = msg; errorBox.hidden = false; }
  function show(text, kind) { result.className = 'alert ' + kind; result.textContent = text; result.hidden = !text; }

  /** A checkout that is finished can't be paid again: swap the buttons for "try again / back". */
  function finished(text, kind, canRetry) {
    show(text, kind);
    actions.hidden = true;
    after.hidden = false;
    document.getElementById('co-retry').hidden = !canRetry;
  }

  function setBusy(on, label) {
    busy = on;
    buttons.forEach(function (b) { b.disabled = on; });
    buttons[0].textContent = on && label ? label : buttons[0].dataset.label;
  }

  function post(action) {
    if (busy) return Promise.resolve(null); // ignore clicks while a request is on its way
    setBusy(true, action === 'complete' ? 'Processing demo payment…' : null);
    return fetch('/api/checkout/' + encodeURIComponent(token) + '/' + action, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
    })
      .then(function (r) { return r.json().then(function (b) { return { status: r.status, body: b }; }); })
      .catch(function () { return { status: 0, body: { error: 'Could not reach the server. Nothing was charged. Please try again.' } }; })
      .finally(function () { setBusy(false); });
  }

  function render(c) {
    eventId = c.event.id;
    document.title = 'Demo checkout · ' + c.event.title + ' · ETMS';
    document.getElementById('back-to-event').href = '/events/' + c.event.id;
    document.getElementById('co-event-link').href = '/events/' + c.event.id;
    document.getElementById('co-title').textContent = c.event.title;
    document.getElementById('co-club').textContent = c.event.clubName ? 'Hosted by ' + c.event.clubName : '';
    document.getElementById('co-when').textContent = ETMS.formatShort(c.event.date, c.event.time) + ' · ' + c.event.location;
    document.getElementById('co-price').textContent = ETMS.formatPrice(c.amountCents);
    document.getElementById('co-total').textContent = ETMS.formatPrice(c.amountCents);
    buttons[0].dataset.label = 'Complete demo payment (' + ETMS.formatPrice(c.amountCents) + ')';
    buttons[0].textContent = buttons[0].dataset.label;

    if (c.status === 'completed' && c.ticketCode) {
      finished('This demo checkout is already complete.', 'success', false);
      var a = ETMS.el('a', 'btn', 'View my ticket');
      a.href = '/tickets/' + encodeURIComponent(c.ticketCode);
      after.insertBefore(a, after.firstChild);
    } else if (c.status === 'declined') {
      finished('The demo payment was declined (simulated). No ticket was issued and nothing was charged.', 'error', true);
    } else if (c.status === 'cancelled') {
      finished('This checkout was cancelled. No ticket was issued and nothing was charged.', 'info', true);
    } else if (c.status === 'failed') {
      finished('This checkout could not be completed, so no ticket was issued and nothing was charged.', 'error', true);
    }
    loading.hidden = true;
    card.hidden = false;
  }

  fetch('/api/checkout/' + encodeURIComponent(token))
    .then(function (r) { return r.json().then(function (b) { return { status: r.status, body: b }; }); })
    .then(function (r) {
      if (r.status === 401) { location.href = '/login?next=' + encodeURIComponent(location.pathname); return; }
      if (r.status !== 200) { fail(r.body.error || 'Checkout not found.'); return; }
      render(r.body.checkout);
    })
    .catch(function () { fail('Could not load the checkout. Please refresh the page.'); });

  // US54: approved -> ticket issued once, then go to the new ticket (with its QR code)
  buttons[0].addEventListener('click', function () {
    post('complete').then(function (r) {
      if (!r) return;
      if (r.status === 200 || r.status === 201) { location.href = r.body.redirect; return; }
      if (r.body.code === 'ALREADY_REGISTERED' && r.body.ticketCode) {
        finished(r.body.error, 'info', false);
        var a = ETMS.el('a', 'btn', 'View my ticket');
        a.href = '/tickets/' + encodeURIComponent(r.body.ticketCode);
        after.insertBefore(a, after.firstChild);
        return;
      }
      if (r.status === 0) { show(r.body.error, 'error'); return; }
      finished(r.body.error || 'The demo checkout could not be completed. No ticket was issued.', 'error',
        r.body.code !== 'EVENT_CANCELLED' && r.body.code !== 'EVENT_STARTED' && r.body.code !== 'EVENT_FULL');
    });
  });

  buttons[1].addEventListener('click', function () {
    post('decline').then(function (r) {
      if (!r) return;
      if (r.status === 200) { finished(r.body.message, 'error', true); return; }
      show(r.body.error || 'Something went wrong.', 'error');
    });
  });

  buttons[2].addEventListener('click', function () {
    post('cancel').then(function (r) {
      if (!r) return;
      if (r.status === 200) { finished(r.body.message, 'info', true); return; }
      show(r.body.error || 'Something went wrong.', 'error');
    });
  });

  // "Try again" starts a fresh checkout for the same event
  document.getElementById('co-retry').addEventListener('click', function () {
    if (!eventId) return;
    fetch('/api/events/' + eventId + '/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      .then(function (r) { return r.json().then(function (b) { return { status: r.status, body: b }; }); })
      .then(function (r) {
        if (r.status === 201) { location.href = r.body.redirect; return; }
        show(r.body.error || 'Could not start a new checkout.', 'error');
      })
      .catch(function () { show('Could not reach the server. Please try again.', 'error'); });
  });
})();
