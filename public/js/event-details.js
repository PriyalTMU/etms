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
    if (state.started) { message('Registration is closed because this event has already started.', 'error'); return; }
    if (state.role === 'organizer') { message('Organizer accounts cannot register for events. Log in with a student account to get a ticket.'); return; }
    if (state.isFull) {
      message('Sorry, this event is full. No more tickets can be issued.', 'error');
      var full = el('button', 'btn big', 'Event full');
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

    var btn = el('button', 'btn big', 'Register for this event');
    btn.type = 'button';
    btn.id = 'register-btn';
    btn.addEventListener('click', function () { register(btn); });
    actions.appendChild(btn);
  }

  function register(btn) {
    btn.disabled = true;
    btn.textContent = 'Registering…';
    fetch('/api/events/' + id + '/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      .then(function (r) { return r.json().then(function (b) { return { status: r.status, body: b }; }); })
      .then(function (r) {
        if (r.status === 201) { location.href = r.body.redirect; return; }
        if (r.body.event && ETMS.showAvailability) ETMS.showAvailability(r.body.event);
        if (r.body.code === 'ALREADY_REGISTERED') { render({ ticketCode: r.body.ticketCode }); message(r.body.error, 'info'); return; }
        if (r.body.code === 'EVENT_FULL') { render({ role: 'student', isFull: true }); return; }
        if (r.status === 401) { render({ role: null }); return; }
        render({ role: 'student' });
        message(r.body.error || 'Registration failed. Please try again.', 'error');
      })
      .catch(function () {
        render({ role: 'student' });
        message('Could not reach the server. Please try again.', 'error');
      });
  }

  fetch('/api/events/' + id + '/registration')
    .then(function (r) { if (!r.ok) throw new Error(); return r.json(); })
    .then(render)
    .catch(function () {});
})();
