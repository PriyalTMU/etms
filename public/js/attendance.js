// T66 / US37: organizer sees the tickets issued for their event
// T67 / US38: organizer sees who has checked in (refreshes by itself every 15 s)
(function () {
  window.ETMS = window.ETMS || {};
  var body = document.getElementById('attendance-body');
  var filter = 'all';
  var rows = [];
  var timer = null;
  var el = function (tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined && text !== null) e.textContent = text; return e; };
  var id = location.pathname.split('/').filter(Boolean)[2];

  function when(iso) {
    if (!iso) return '';
    // SQLite datetime('now') is UTC without a zone; check-in times are ISO with Z
    var d = new Date(/Z$|[+-]\d\d:\d\d$/.test(iso) ? iso : iso.replace(' ', 'T') + 'Z');
    return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  }

  function render() {
    body.innerHTML = '';
    var shown = rows.filter(function (t) {
      if (filter === 'checked') return !!t.checkedInAt;
      if (filter === 'waiting') return !t.checkedInAt && t.status !== 'cancelled';
      return true;
    });
    shown.forEach(function (t) {
      var tr = el('tr', t.checkedInAt ? 'is-checked' : '');
      tr.dataset.code = t.code;
      tr.appendChild(el('td', null, t.holderName));
      tr.appendChild(el('td', 'mono', t.code));
      tr.appendChild(el('td', null, when(t.registeredAt)));
      var st = el('td');
      var label = t.checkedInAt ? 'Checked in' : t.status === 'cancelled' ? 'Cancelled' : 'Registered';
      st.appendChild(el('span', 'status-pill ' + (t.checkedInAt ? 'checked_in' : t.status), label));
      tr.appendChild(st);
      tr.appendChild(el('td', null, t.checkedInAt ? when(t.checkedInAt) + (t.checkedInBy ? ' · ' + t.checkedInBy : '') : '—'));
      body.appendChild(tr);
    });
    document.getElementById('no-tickets').hidden = rows.length > 0;
  }

  function load() {
    return fetch('/api/organizer/events/' + id + '/tickets')
      .then(function (r) { if (!r.ok) throw new Error(); return r.json(); })
      .then(function (d) {
        rows = d.tickets;
        document.getElementById('stat-issued').textContent = d.summary.issued;
        document.getElementById('stat-checked').textContent = d.summary.checkedIn;
        document.getElementById('stat-waiting').textContent = d.summary.notCheckedIn;
        document.getElementById('attendance-updated').textContent = 'Updated ' + new Date().toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit' });
        document.getElementById('attendance-card').hidden = false;
        render();
      })
      .catch(function () {});
  }

  Array.prototype.forEach.call(document.querySelectorAll('.filter-tabs .tab'), function (b) {
    b.addEventListener('click', function () {
      filter = b.dataset.filter;
      Array.prototype.forEach.call(document.querySelectorAll('.filter-tabs .tab'), function (x) {
        x.classList.toggle('active', x === b);
        x.setAttribute('aria-selected', x === b ? 'true' : 'false');
      });
      render();
    });
  });
  document.getElementById('refresh-attendance').addEventListener('click', load);

  ETMS.onEventLoaded = function () {
    load();
    if (!timer) timer = setInterval(load, 15000);
  };
})();
