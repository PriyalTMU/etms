// US30: check-in page for one assigned event
(function () {
  window.ETMS = window.ETMS || {};
  var id = location.pathname.split('/').filter(Boolean)[2];
  ETMS.checkinEventId = id;

  fetch('/api/checkin/events/' + id)
    .then(function (r) { return r.json().then(function (b) { return { ok: r.ok, status: r.status, body: b }; }); })
    .then(function (r) {
      if (r.status === 401) { location.href = '/login?next=' + encodeURIComponent(location.pathname); return; }
      if (!r.ok) { var box = document.getElementById('scan-error'); box.textContent = r.body.error; box.hidden = false; return; }
      var ev = r.body.event;
      document.title = 'Check-in · ' + ev.title + ' · ETMS';
      document.getElementById('ci-title').textContent = ev.title;
      document.getElementById('ci-club').textContent = ev.clubName ? 'Checking in for ' + ev.clubName : 'Checking in';
      document.getElementById('ci-meta').textContent = ETMS.formatShort(ev.date, ev.time) + ' · ' + ev.location;
      document.getElementById('checkin-event').hidden = false;
      if (ETMS.onCheckinEvent) ETMS.onCheckinEvent(ev);
    })
    .catch(function () {});
})();
