// Sprint 4 - T80/T81 / US41: organizer cancels an event (two-step confirm, runs once)
(function () {
  var id = location.pathname.split('/').filter(Boolean)[2];
  var card = document.getElementById('cancel-card');
  var start = document.getElementById('cancel-start');
  var form = document.getElementById('cancel-form');
  var back = document.getElementById('cancel-back');
  var confirmBtn = document.getElementById('cancel-confirm');
  var msg = document.getElementById('cancel-msg');
  var banner = document.getElementById('cancelled-banner');

  function message(text, kind) { msg.className = 'alert ' + kind; msg.textContent = text; msg.hidden = !text; }

  function showCancelled(ev) {
    card.hidden = true;
    banner.textContent = 'This event was cancelled' + (ev.cancelledAt ? ' on ' + new Date(ev.cancelledAt).toLocaleString() : '') +
      '. Students see it as cancelled and cannot register.' + (ev.cancelReason ? ' Reason: ' + ev.cancelReason : '');
    banner.hidden = false;
    // D15 fix: nothing to check in or volunteer for once the event is cancelled
    ['edit-event', 'open-checkin', 'volunteer-form'].forEach(function (id) {
      var x = document.getElementById(id);
      if (x) x.hidden = true;
    });
  }

  ETMS.onEventStatus = function (ev) {
    if (ev.isCancelled) { showCancelled(ev); return; }
    card.hidden = false;
  };

  start.addEventListener('click', function () {
    start.hidden = true;
    form.hidden = false;
    form.reason.focus();
  });
  back.addEventListener('click', function () {
    form.hidden = true;
    start.hidden = false;
    message('');
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    confirmBtn.disabled = true; // a double-click sends only one request
    confirmBtn.textContent = 'Cancelling…';
    fetch('/api/organizer/events/' + id + '/cancel', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: form.reason.value }),
    })
      .then(function (r) { return r.json().then(function (b) { return { ok: r.ok, body: b }; }); })
      .then(function (r) {
        if (r.ok || r.body.code === 'ALREADY_CANCELLED') { showCancelled(r.body.event); return; }
        message(r.body.error || 'The event could not be cancelled.', 'error');
      })
      .catch(function () { message('Could not reach the server. The event was not cancelled.', 'error'); })
      .finally(function () { confirmBtn.disabled = false; confirmBtn.textContent = 'Yes, cancel this event'; });
  });
})();
