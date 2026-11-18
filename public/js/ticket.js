// US25: view my QR e-ticket   US27: the ticket shows its event   US28: open one ticket's details
// Sprint 4 - US49 registration confirmation names the event · US42-US44 cancel my ticket
(function () {
  var loading = document.getElementById('loading');
  var errorBox = document.getElementById('ticket-error');
  var card = document.getElementById('ticket');
  var newMsg = document.getElementById('new-msg');
  var STATUS = { active: 'Valid', checked_in: 'Checked in', cancelled: 'Cancelled' };
  var params = new URLSearchParams(location.search);

  // Ticket code comes from the URL: /tickets/<code>
  var code = decodeURIComponent(location.pathname.split('/').filter(Boolean)[1] || '');
  if (params.get('new')) newMsg.hidden = false;

  function fail(msg) {
    loading.hidden = true;
    newMsg.hidden = true;
    errorBox.textContent = msg;
    errorBox.hidden = false;
  }

  function set(id, text) { document.getElementById(id).textContent = text; }

  function statusLabel(t) {
    if (t.status === 'cancelled') return 'Cancelled';
    if (t.event.isCancelled) return 'Event cancelled';
    return t.upcoming ? (STATUS[t.status] || t.status) : 'Past event';
  }

  /** Show the ticket's current state: valid, checked in, cancelled, or event cancelled. */
  function showStatus(t) {
    var pill = document.getElementById('tk-status');
    pill.textContent = statusLabel(t);
    pill.className = 'status-pill ' + (t.event.isCancelled ? 'cancelled' : t.status);
    var voided = t.status === 'cancelled' || t.event.isCancelled;
    document.getElementById('qr-wrap').classList.toggle('void', voided);
    document.getElementById('tk-void').hidden = !voided;
    if (voided) document.getElementById('tk-void').textContent = t.event.isCancelled && t.status !== 'cancelled'
      ? 'Event cancelled – this ticket will not be used' : 'Cancelled – not valid for entry';
    var ec = document.getElementById('tk-event-cancelled');
    ec.hidden = !t.event.isCancelled;
    if (t.event.isCancelled) {
      ec.textContent = 'The organizer has cancelled this event.' + (t.event.cancelReason ? ' Reason: ' + t.event.cancelReason : '');
    }
    // US42: only an active ticket for an upcoming event can be cancelled
    document.getElementById('cancel-section').hidden = !(t.status === 'active' && t.upcoming);
  }

  fetch('/api/tickets/' + encodeURIComponent(code))
    .then(function (r) { return r.json().then(function (b) { return { status: r.status, body: b }; }); })
    .then(function (r) {
      if (r.status === 401) { location.href = '/login?next=' + encodeURIComponent(location.pathname); return; }
      if (r.status !== 200) { fail(r.body.error || 'Ticket not found.'); return; }
      var t = r.body.ticket;
      var ev = t.event;
      document.title = 'Ticket · ' + ev.title + ' · ETMS';
      card.dataset.ticketCode = t.code;
      set('tk-title', ev.title);
      set('tk-club', ev.clubName ? 'Hosted by ' + ev.clubName : '');
      set('tk-date', ETMS.formatDay(ev.date));
      set('tk-time', ETMS.formatTime(ev.date, ev.time));
      set('tk-location', ev.location);
      set('tk-code', t.code);
      set('cancel-event-name', ev.title);
      // US49: the confirmation names the event the ticket is for
      if (params.get('new')) {
        newMsg.textContent = (params.get('paid') ? 'Demo payment complete – no real money was charged. ' : '') +
          "You're registered for \"" + ev.title + '"! Your ticket ' + t.code + ' is below and in My tickets. Show the QR code at the door.';
      }
      showStatus(t);
      document.getElementById('tk-event-link').href = '/events/' + ev.id;
      // Server-made SVG shown as an image (no HTML is injected into the page)
      document.getElementById('tk-qr').src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(r.body.qrSvg);
      fetch('/api/auth/me').then(function (x) { return x.json(); }).then(function (d) {
        if (d.user) set('tk-holder', d.user.name);
      }).catch(function () {});
      loading.hidden = true;
      card.hidden = false;
    })
    .catch(function () { fail('Could not load this ticket. Please refresh the page.'); });

  document.getElementById('tk-print').addEventListener('click', function () { window.print(); });

  // US42 / US44: two-step cancel, then a clear confirmation (or the reason it failed)
  var startBtn = document.getElementById('cancel-ticket-btn');
  var confirmBox = document.getElementById('cancel-confirm-box');
  var confirmBtn = document.getElementById('cancel-ticket-confirm');
  var cancelErr = document.getElementById('cancel-error');
  startBtn.addEventListener('click', function () { startBtn.hidden = true; confirmBox.hidden = false; cancelErr.hidden = true; confirmBtn.focus(); });
  document.getElementById('cancel-ticket-keep').addEventListener('click', function () { confirmBox.hidden = true; startBtn.hidden = false; });
  confirmBtn.addEventListener('click', function () {
    confirmBtn.disabled = true; // a double-click sends only one request
    confirmBtn.textContent = 'Cancelling…';
    fetch('/api/tickets/' + encodeURIComponent(code) + '/cancel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      .then(function (r) { return r.json().then(function (b) { return { status: r.status, body: b }; }); })
      .then(function (r) {
        if (r.status === 401) { location.href = '/login?next=' + encodeURIComponent(location.pathname); return; }
        if (r.status === 200) {
          newMsg.hidden = true;
          var done = document.getElementById('cancel-done');
          done.textContent = r.body.message;
          done.hidden = false;
          showStatus(r.body.ticket);
          window.scrollTo(0, 0);
          return;
        }
        if (r.body.ticket) showStatus(Object.assign({}, r.body.ticket, { upcoming: false }));
        confirmBox.hidden = true;
        startBtn.hidden = !(!r.body.ticket && r.body.code !== 'ALREADY_USED' && r.body.code !== 'EVENT_STARTED');
        cancelErr.textContent = r.body.error || 'Your ticket could not be cancelled.';
        cancelErr.hidden = false;
      })
      .catch(function () {
        cancelErr.textContent = 'Could not reach the server. Your ticket was not cancelled.';
        cancelErr.hidden = false;
      })
      .finally(function () { confirmBtn.disabled = false; confirmBtn.textContent = 'Yes, cancel my ticket'; });
  });
})();
