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
        var li = el('li', 'event-item' + (ev.id === createdId ? ' new' : ''));
        li.dataset.eventId = ev.id;
        li.appendChild(el('h3', null, ev.title));
        var meta = el('div', 'event-meta');
        meta.appendChild(el('span', null, ETMS.formatDate(ev.date, ev.time)));
        meta.appendChild(el('span', null, ev.location));
        meta.appendChild(el('span', null, 'Capacity: ' + ev.capacity));
        li.appendChild(meta);
        var view = el('a', 'view-link', 'View as students see it →');
        view.href = '/events/' + encodeURIComponent(ev.id);
        li.appendChild(view);
        list.appendChild(li);
        if (ev.id === createdId) {
          banner.textContent = 'Event "' + ev.title + '" was created.';
          banner.hidden = false;
        }
      });
    })
    .catch(function () {});
})();
