// Organizer: manage one event.  US29: give volunteers check-in access.
(function () {
  var id = location.pathname.split('/').filter(Boolean)[2];
  var el = function (tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
  var errorBox = document.getElementById('page-error');
  var form = document.getElementById('volunteer-form');
  var msg = document.getElementById('volunteer-msg');
  var list = document.getElementById('volunteer-list');
  var none = document.getElementById('no-volunteers');
  window.ETMS = window.ETMS || {};

  ETMS.loadCurrentUser();

  function fail(text) { errorBox.textContent = text; errorBox.hidden = false; }
  function message(text, kind) { msg.className = 'alert ' + kind; msg.textContent = text; msg.hidden = !text; }

  function renderVolunteers(vols) {
    list.innerHTML = '';
    none.hidden = vols.length > 0;
    vols.forEach(function (v) {
      var li = el('li', 'volunteer-item');
      li.appendChild(el('strong', null, v.name));
      li.appendChild(el('span', 'muted', ' ' + v.email));
      li.appendChild(el('span', 'status-pill checked_in', 'Check-in access'));
      list.appendChild(li);
    });
  }

  function load() {
    return fetch('/api/organizer/events/' + id + '/volunteers')
      .then(function (r) {
        if (r.status === 401) { location.href = '/organizer/login'; throw new Error('login'); }
        return r.json().then(function (b) { return { ok: r.ok, body: b }; });
      })
      .then(function (r) {
        if (!r.ok) { fail(r.body.error || 'Event not found.'); return; }
        var ev = r.body.event;
        document.title = ev.title + ' · Manage · ETMS';
        document.getElementById('ev-title').textContent = ev.title;
        document.getElementById('ev-meta').textContent = ETMS.formatDate(ev.date, ev.time) + ' · ' + ev.location + ' · Capacity ' + ev.capacity +
          ' · ' + (ev.paymentType === 'demo_paid' ? 'Demo-paid ' + ETMS.formatPrice(ev.priceCents) : 'Free');
        document.getElementById('edit-event').href = '/organizer/events/' + ev.id + '/edit';
        if (new URLSearchParams(location.search).get('updated')) document.getElementById('updated-msg').hidden = false;
        if (ETMS.onEventStatus) ETMS.onEventStatus(ev);
        document.getElementById('open-checkin').href = '/checkin/events/' + ev.id;
        document.getElementById('student-view').href = '/events/' + ev.id;
        document.getElementById('event-head').hidden = false;
        document.getElementById('volunteers-card').hidden = false;
        renderVolunteers(r.body.volunteers);
        if (ETMS.onEventLoaded) ETMS.onEventLoaded(ev);
      })
      .catch(function (e) { if (e.message !== 'login') fail('Could not load this event. Please refresh the page.'); });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var email = form.email.value.trim();
    if (!email) { message("Enter the volunteer's email address.", 'error'); return; }
    var btn = document.getElementById('add-volunteer-btn');
    btn.disabled = true;
    fetch('/api/organizer/events/' + id + '/volunteers', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email }),
    })
      .then(function (r) { return r.json().then(function (b) { return { ok: r.ok, body: b }; }); })
      .then(function (r) {
        if (!r.ok) { message(r.body.error || 'Could not add that volunteer.', 'error'); return; }
        message(r.body.message, 'success');
        form.reset();
        load();
      })
      .catch(function () { message('Could not reach the server. Try again.', 'error'); })
      .finally(function () { btn.disabled = false; });
  });

  load();
})();
