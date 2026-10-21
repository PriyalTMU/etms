// US26: My Tickets page   US27: each ticket shows its event   US28: open a ticket
(function () {
  var list = document.getElementById('ticket-list');
  var empty = document.getElementById('no-tickets');
  var loading = document.getElementById('loading');
  var errorBox = document.getElementById('tickets-error');
  var el = ETMS.el;

  var STATUS = { active: 'Valid', checked_in: 'Checked in', cancelled: 'Cancelled' };

  fetch('/api/my/tickets')
    .then(function (r) {
      if (r.status === 401) { location.href = '/login?next=/my-tickets'; throw new Error('login'); }
      if (!r.ok) throw new Error();
      return r.json();
    })
    .then(function (data) {
      loading.hidden = true;
      empty.hidden = data.tickets.length > 0;
      // Upcoming events first (soonest first), then past events
      var sorted = data.tickets.filter(function (t) { return t.upcoming; })
        .concat(data.tickets.filter(function (t) { return !t.upcoming; }));
      sorted.forEach(function (t) {
        var li = el('li', 'event-item selectable ticket-item' + (t.upcoming ? '' : ' past'));
        li.dataset.ticketCode = t.code;

        var a = el('a', 'event-link');
        a.href = '/tickets/' + encodeURIComponent(t.code);
        a.setAttribute('aria-label', 'Ticket for ' + t.event.title + ', open ticket');

        var head = el('div', 'ticket-head');
        head.appendChild(el('h3', null, t.event.title));
        head.appendChild(el('span', 'status-pill ' + t.status, t.upcoming ? (STATUS[t.status] || t.status) : 'Past event'));
        a.appendChild(head);

        var meta = el('div', 'event-meta');
        meta.appendChild(el('span', 'meta-when', ETMS.formatShort(t.event.date, t.event.time)));
        meta.appendChild(el('span', 'meta-where', t.event.location));
        if (t.event.clubName) meta.appendChild(el('span', 'meta-club', t.event.clubName));
        a.appendChild(meta);

        a.appendChild(el('span', 'ticket-code', t.code));
        a.appendChild(el('span', 'view-link', 'Open ticket →'));
        li.appendChild(a);
        list.appendChild(li);
      });
    })
    .catch(function (err) {
      if (err && err.message === 'login') return;
      loading.hidden = true;
      errorBox.textContent = 'Could not load your tickets. Please refresh the page.';
      errorBox.hidden = false;
    });
})();
