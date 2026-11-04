// US30: the events a volunteer has been given check-in access to
(function () {
  var list = document.getElementById('checkin-events');
  var el = ETMS.el;
  fetch('/api/checkin/events')
    .then(function (r) {
      if (r.status === 401) { location.href = '/login?next=/checkin'; throw new Error('login'); }
      return r.json();
    })
    .then(function (data) {
      document.getElementById('loading').hidden = true;
      document.getElementById('no-checkin-events').hidden = data.events.length > 0;
      data.events.forEach(function (ev) {
        var li = el('li', 'event-item selectable');
        var a = el('a', 'event-link');
        a.href = '/checkin/events/' + ev.id;
        a.appendChild(el('h3', null, ev.title));
        var meta = el('div', 'event-meta');
        meta.appendChild(el('span', null, ETMS.formatShort(ev.date, ev.time)));
        meta.appendChild(el('span', null, ev.location));
        if (ev.clubName) meta.appendChild(el('span', null, ev.clubName));
        a.appendChild(meta);
        a.appendChild(el('span', 'view-link', 'Start check-in →'));
        li.appendChild(a);
        list.appendChild(li);
      });
    })
    .catch(function (e) {
      if (e.message === 'login') return;
      document.getElementById('loading').hidden = true;
      var box = document.getElementById('checkin-error');
      box.textContent = 'Could not load your check-in events. Please refresh the page.';
      box.hidden = false;
    });
})();
