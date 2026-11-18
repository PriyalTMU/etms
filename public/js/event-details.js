// US15: show the full details of the event selected on the list (US14)
(function () {
  var loading = document.getElementById('loading');
  var errorBox = document.getElementById('details-error');
  var card = document.getElementById('event-details');

  // Event id comes from the URL: /events/<id>
  var id = location.pathname.split('/').filter(Boolean)[1];

  function fail(msg) {
    loading.hidden = true;
    errorBox.textContent = msg;
    errorBox.hidden = false;
  }

  // US19: tickets left, updated after a registration
  function showAvailability(ev) {
    var dd = document.getElementById('ev-availability');
    dd.textContent = ETMS.availabilityText(ev);
    dd.classList.toggle('full', !!ev.isFull);
  }
  ETMS.showAvailability = showAvailability;

  if (!/^\d+$/.test(id || '')) { fail('Event not found.'); return; }

  fetch('/api/events/' + id)
    .then(function (r) {
      return r.json().then(function (body) { return { ok: r.ok, body: body }; });
    })
    .then(function (r) {
      if (!r.ok) { fail(r.body.error || 'Event not found.'); return; }
      var ev = r.body.event;
      document.title = ev.title + ' · ETMS';
      card.dataset.eventId = ev.id;
      document.getElementById('ev-title').textContent = ev.title;
      document.getElementById('ev-club').textContent = ev.clubName ? 'Hosted by ' + ev.clubName : '';
      document.getElementById('ev-date').textContent = ETMS.formatDay(ev.date);
      document.getElementById('ev-time').textContent = ETMS.formatTime(ev.date, ev.time);
      document.getElementById('ev-location').textContent = ev.location;
      document.getElementById('ev-capacity').textContent = ev.capacity + (ev.capacity === 1 ? ' person' : ' people');
      document.getElementById('ev-description').textContent = ev.description;
      // Sprint 4 - US46 category · US52 free or demo-paid · US41 cancelled
      document.getElementById('ev-category').textContent = ETMS.categoryLabel(ev.category);
      document.getElementById('ev-price').textContent = ev.paymentType === 'demo_paid'
        ? ETMS.formatPrice(ev.priceCents) + ' · Demo-paid (simulated checkout, no real payment)'
        : 'Free';
      var cancelled = document.getElementById('ev-cancelled');
      if (ev.isCancelled) {
        cancelled.textContent = 'This event has been cancelled by the organizer.' + (ev.cancelReason ? ' Reason: ' + ev.cancelReason : '');
        cancelled.hidden = false;
        card.classList.add('is-cancelled');
      }
      showAvailability(ev);
      loading.hidden = true;
      card.hidden = false;
    })
    .catch(function () { fail('Could not load this event. Please refresh the page.'); });
})();

// US17: register for this event · US21: full events can't be registered for
// US22: a student who already has a ticket sees a link to it instead of a Register button
(function () {
  var box = document.getElementById('register-box');
  var msg = document.getElementById('register-msg');
  var actions = document.getElementById('register-actions');
  var el = ETMS.el;
  var id = location.pathname.split('/').filter(Boolean)[1];
  if (!box || !/^\d+$/.test(id || '')) return;

  function message(text, kind) {
    msg.className = 'alert ' + (kind || 'info');
    msg.textContent = text;
    msg.hidden = !text;
  }

  function link(text, href, cls) {
    var a = el('a', cls || 'btn', text);
    a.href = href;
    return a;
  }

  function render(state) {
    actions.innerHTML = '';
    message('');
    box.hidden = false;

    if (state.ticketCode) {
      message("You're registered for this event.", 'success');
      var view = link('View my ticket', '/tickets/' + encodeURIComponent(state.ticketCode));
      view.id = 'view-ticket-btn';
      actions.appendChild(view);
      actions.appendChild(link('All my tickets', '/my-tickets', 'btn secondary'));
      return;
    }
    // US41 / US50: cancelled events can't be registered for
    if (state.cancelled) {
      message('This event has been cancelled by the organizer, so registration is closed.' + (state.cancelReason ? ' Reason: ' + state.cancelReason : ''), 'error');
      return;
    }
    if (state.started) { message('Registration is closed because this event has already started.', 'error'); return; }
    if (state.role === 'organizer') { message('Organizer accounts cannot register for events. Log in with a student account to get a ticket.'); return; }
    if (state.isFull) {
      message('Sorry, this event is full. No more tickets can be issued.', 'error');
      var full = el('button', 'btn big is-full', 'Event full');
      full.type = 'button';
      full.disabled = true;
      full.id = 'register-btn';
      actions.appendChild(full);
      return;
    }
    if (!state.role) {
      message('Log in with your student account to register for this event.');
      actions.appendChild(link('Log in to register', '/login?next=' + encodeURIComponent(location.pathname)));
      actions.appendChild(link('Create an account', '/signup', 'btn secondary'));
      return;
    }

    // US52: demo-paid events go to the simulated checkout (US53) instead of registering straight away
    if (state.paymentType === 'demo_paid') {
      message('This is a demo-paid event (' + ETMS.formatPrice(state.priceCents) + '). You will go through a simulated checkout – no real payment is taken.', 'info');
      var pay = el('button', 'btn big', 'Continue to demo checkout');
      pay.type = 'button';
      pay.id = 'checkout-btn';
      pay.addEventListener('click', function () { startCheckout(pay, state); });
      actions.appendChild(pay);
      return;
    }

    var btn = el('button', 'btn big', 'Register for this event');
    btn.type = 'button';
    btn.id = 'register-btn';
    btn.addEventListener('click', function () { register(btn); });
    actions.appendChild(btn);
  }

  /** US50: every failed registration/checkout shows its reason; nothing is issued. */
  function showFailure(body, status, state) {
    if (body.event && ETMS.showAvailability) ETMS.showAvailability(body.event);
    if (body.code === 'ALREADY_REGISTERED') { render({ ticketCode: body.ticketCode }); message(body.error, 'info'); return; }
    if (body.code === 'EVENT_FULL') { render({ role: 'student', isFull: true }); return; }
    if (body.code === 'EVENT_CANCELLED') { render({ role: 'student', cancelled: true }); return; }
    if (body.code === 'EVENT_STARTED') { render({ role: 'student', started: true }); return; }
    if (status === 401) { render({ role: null }); return; }
    render(state || { role: 'student' });
    message(body.error || 'Registration failed. Please try again.', 'error');
  }

  // US53: start (or reopen) a simulated checkout for a demo-paid event
  function startCheckout(btn, state) {
    btn.disabled = true;
    btn.textContent = 'Opening checkout…';
    fetch('/api/events/' + id + '/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      .then(function (r) { return r.json().then(function (b) { return { status: r.status, body: b }; }); })
      .then(function (r) {
        if (r.status === 200 || r.status === 201) { location.href = r.body.redirect; return; }
        showFailure(r.body, r.status, state);
      })
      .catch(function () {
        render(state);
        message('Could not reach the server. Please try again.', 'error');
      });
  }

  function register(btn) {
    btn.disabled = true;
    btn.textContent = 'Registering…';
    fetch('/api/events/' + id + '/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      .then(function (r) { return r.json().then(function (b) { return { status: r.status, body: b }; }); })
      .then(function (r) {
        if (r.status === 201) { location.href = r.body.redirect; return; }
        if (r.body.code === 'PAYMENT_REQUIRED') { loadState(); return; }
        showFailure(r.body, r.status);
      })
      .catch(function () {
        render({ role: 'student' });
        message('Could not reach the server. Please try again.', 'error');
      });
  }

  function loadState() {
    return fetch('/api/events/' + id + '/registration')
      .then(function (r) { if (!r.ok) throw new Error(); return r.json(); })
      .then(render)
      .catch(function () {});
  }
  loadState();
})();
