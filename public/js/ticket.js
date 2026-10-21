// US25: view my QR e-ticket   US27: the ticket shows its event   US28: open one ticket's details
(function () {
  var loading = document.getElementById('loading');
  var errorBox = document.getElementById('ticket-error');
  var card = document.getElementById('ticket');
  var STATUS = { active: 'Valid', checked_in: 'Checked in', cancelled: 'Cancelled' };

  // Ticket code comes from the URL: /tickets/<code>
  var code = decodeURIComponent(location.pathname.split('/').filter(Boolean)[1] || '');
  if (new URLSearchParams(location.search).get('new')) document.getElementById('new-msg').hidden = false;

  function fail(msg) {
    loading.hidden = true;
    document.getElementById('new-msg').hidden = true;
    errorBox.textContent = msg;
    errorBox.hidden = false;
  }

  function set(id, text) { document.getElementById(id).textContent = text; }

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
      var pill = document.getElementById('tk-status');
      pill.textContent = t.upcoming ? (STATUS[t.status] || t.status) : 'Past event';
      pill.className = 'status-pill ' + t.status;
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
})();
