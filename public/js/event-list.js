// US12: list upcoming events   US14: select an event to open its details
(function () {
  var list = document.getElementById('event-list');
  var empty = document.getElementById('no-events');
  var loading = document.getElementById('loading');
  var errorBox = document.getElementById('list-error');
  var el = ETMS.el;

  fetch('/api/events')
    .then(function (r) { if (!r.ok) throw new Error(); return r.json(); })
    .then(function (data) {
      loading.hidden = true;
      empty.hidden = data.events.length > 0;
      data.events.forEach(function (ev) {
        var li = el('li', 'event-item selectable');
        li.dataset.eventId = ev.id;

        // The whole card is one link to that event's own page (US14).
        var a = el('a', 'event-link');
        a.href = '/events/' + encodeURIComponent(ev.id);
        a.setAttribute('aria-label', ev.title + ', view details');

        a.appendChild(el('h3', null, ev.title));
        var meta = el('div', 'event-meta');
        meta.appendChild(el('span', 'meta-when', ETMS.formatShort(ev.date, ev.time)));
        meta.appendChild(el('span', 'meta-where', ev.location));
        if (ev.clubName) meta.appendChild(el('span', 'meta-club', ev.clubName));
        a.appendChild(meta);
        a.appendChild(el('span', 'view-link', 'View details →'));

        li.appendChild(a);
        list.appendChild(li);
      });
    })
    .catch(function () {
      loading.hidden = true;
      errorBox.textContent = 'Could not load events. Please refresh the page.';
      errorBox.hidden = false;
    });
})();
