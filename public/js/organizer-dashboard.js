// US06: organizer event-management area (lists the organizer's own events)
(function () {
  var list = document.getElementById('event-list');
  var empty = document.getElementById('no-events');
  var banner = document.getElementById('created-banner');
  var createdId = Number(new URLSearchParams(location.search).get('created')) || null;

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  ETMS.loadCurrentUser();

  fetch('/api/organizer/events')
    .then(function (r) {
      if (r.status === 401) { location.href = '/organizer/login'; throw new Error('logged out'); }
      return r.json();
    })
    .then(function (data) {
      list.innerHTML = '';
      empty.hidden = data.events.length > 0;
      data.events.forEach(function (ev) {
        var li = el('li', 'event-item' + (ev.id === createdId ? ' new' : '') + (ev.isCancelled ? ' is-cancelled' : ''));
        li.dataset.eventId = ev.id;
        var head = el('div', 'ticket-head');
        head.appendChild(el('h3', null, ev.title));
        if (ev.isCancelled) head.appendChild(el('span', 'status-pill cancelled', 'Cancelled'));
        li.appendChild(head);
        var meta = el('div', 'event-meta');
        meta.appendChild(el('span', null, ETMS.formatDate(ev.date, ev.time)));
        meta.appendChild(el('span', null, ev.location));
        meta.appendChild(el('span', null, 'Capacity: ' + ev.capacity));
        meta.appendChild(el('span', null, ETMS.categoryLabel(ev.category)));
        meta.appendChild(el('span', 'pay-badge ' + ev.paymentType, ETMS.paymentText(ev)));
        li.appendChild(meta);
        var links = el('div', 'card-links');
        var manage = el('a', 'view-link', 'Tickets, attendance & volunteers →');
        manage.href = '/organizer/events/' + encodeURIComponent(ev.id);
        links.appendChild(manage);
        if (!ev.isCancelled) {
          var edit = el('a', 'view-link', 'Edit event →');
          edit.href = '/organizer/events/' + encodeURIComponent(ev.id) + '/edit';
          links.appendChild(edit);
        }
        var view = el('a', 'view-link', 'View as students see it →');
        view.href = '/events/' + encodeURIComponent(ev.id);
        links.appendChild(view);
        li.appendChild(links);
        list.appendChild(li);
        if (ev.id === createdId) {
          banner.textContent = 'Event "' + ev.title + '" was created.';
          banner.hidden = false;
        }
      });
    })
    .catch(function () {});
})();
