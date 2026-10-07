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
      loading.hidden = true;
      card.hidden = false;
    })
    .catch(function () { fail('Could not load this event. Please refresh the page.'); });
})();
