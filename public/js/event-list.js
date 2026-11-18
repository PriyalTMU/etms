// US12: list upcoming events   US14: select an event to open its details   US19: tickets left
// Sprint 4 - US45 keyword search · US46 category filter · US47 date filter · US48 clear
//            US41 cancelled events marked · US52 free / demo-paid shown on each card
(function () {
  var list = document.getElementById('event-list');
  var empty = document.getElementById('no-events');
  var noResults = document.getElementById('no-results');
  var loading = document.getElementById('loading');
  var errorBox = document.getElementById('list-error');
  var form = document.getElementById('filter-form');
  var count = document.getElementById('result-count');
  var clearBtns = [document.getElementById('clear-filters'), document.getElementById('clear-filters-2')];
  var el = ETMS.el;
  var FIELDS = ['q', 'category', 'from', 'to'];
  var latest = 0; // only the newest request may update the page (typing fast can't show stale results)
  var categoriesLoaded = false;

  // D13 fix: build the category list from the shared list right away, so a category in the
  // address bar (after a refresh or from a shared link) can be selected before the first search.
  if (window.EventValidation) {
    EventValidation.CATEGORIES.forEach(function (c) {
      var o = el('option', null, c.label);
      o.value = c.value;
      form.category.appendChild(o);
    });
    categoriesLoaded = true;
  }

  function current() {
    var f = {};
    FIELDS.forEach(function (k) { f[k] = form[k].value.trim(); });
    return f;
  }
  function isActive(f) { return FIELDS.some(function (k) { return f[k]; }); }

  function query(f) {
    var p = new URLSearchParams();
    FIELDS.forEach(function (k) { if (f[k]) p.set(k, f[k]); });
    return p.toString();
  }

  function card(ev) {
    var li = el('li', 'event-item selectable' + (ev.isCancelled ? ' is-cancelled' : ''));
    li.dataset.eventId = ev.id;

    // The whole card is one link to that event's own page (US14).
    var a = el('a', 'event-link');
    a.href = '/events/' + encodeURIComponent(ev.id);
    a.setAttribute('aria-label', ev.title + (ev.isCancelled ? ' (cancelled)' : '') + ', view details');

    var head = el('div', 'ticket-head');
    head.appendChild(el('h3', null, ev.title));
    if (ev.isCancelled) head.appendChild(el('span', 'status-pill cancelled', 'Cancelled'));
    a.appendChild(head);
    var meta = el('div', 'event-meta');
    meta.appendChild(el('span', 'meta-when', ETMS.formatShort(ev.date, ev.time)));
    meta.appendChild(el('span', 'meta-where', ev.location));
    if (ev.clubName) meta.appendChild(el('span', 'meta-club', ev.clubName));
    a.appendChild(meta);
    var badges = el('div', 'badge-row');
    badges.appendChild(el('span', 'cat-badge', ETMS.categoryLabel(ev.category)));
    badges.appendChild(el('span', 'pay-badge ' + ev.paymentType, ETMS.paymentText(ev)));
    // US19: tickets still available
    badges.appendChild(el('span', 'availability' + (ev.isFull || ev.isCancelled ? ' full' : ''), ETMS.availabilityText(ev)));
    a.appendChild(badges);
    a.appendChild(el('span', 'view-link', 'View details →'));
    li.appendChild(a);
    return li;
  }

  function load() {
    var f = current();
    var mine = ++latest;
    errorBox.hidden = true;
    clearBtns[0].hidden = !isActive(f);
    // Keep the search in the address bar so refreshing or sharing the page keeps it
    var qs = query(f);
    history.replaceState(null, '', location.pathname + (qs ? '?' + qs : ''));

    fetch('/api/events' + (qs ? '?' + qs : ''))
      .then(function (r) { return r.json().then(function (b) { return { ok: r.ok, body: b }; }); })
      .then(function (r) {
        if (mine !== latest) return;
        loading.hidden = true;
        if (!r.ok) {
          errorBox.textContent = r.body.error || 'Could not search events.';
          errorBox.hidden = false;
          return;
        }
        var data = r.body;
        if (!categoriesLoaded && data.categories) {
          data.categories.forEach(function (c) {
            var o = el('option', null, c.label);
            o.value = c.value;
            form.category.appendChild(o);
          });
          form.category.value = f.category;
          categoriesLoaded = true;
        }
        list.innerHTML = '';
        empty.hidden = data.total > 0;
        noResults.hidden = !(data.filtered && data.events.length === 0 && data.total > 0);
        if (!noResults.hidden) {
          document.getElementById('no-results-text').textContent = f.q
            ? 'No events match "' + f.q + '"' + (f.category || f.from || f.to ? ' with these filters' : '') + '. Try another keyword or clear the filters.'
            : 'No events match these filters. Try different filters or clear them.';
        }
        count.textContent = data.filtered
          ? 'Showing ' + data.events.length + ' of ' + data.total + ' upcoming ' + (data.total === 1 ? 'event' : 'events')
          : data.total + ' upcoming ' + (data.total === 1 ? 'event' : 'events');
        data.events.forEach(function (ev) {
          var li = card(ev);
          list.appendChild(li);
        });
      })
      .catch(function () {
        if (mine !== latest) return;
        loading.hidden = true;
        errorBox.textContent = 'Could not load events. Please refresh the page.';
        errorBox.hidden = false;
      });
  }

  // US48: clear everything and show the full list again
  function clearAll() {
    form.reset();
    form.category.value = '';
    load();
    form.q.focus();
  }
  clearBtns.forEach(function (b) { b.addEventListener('click', clearAll); });

  form.addEventListener('submit', function (e) { e.preventDefault(); load(); });
  form.category.addEventListener('change', load);
  form.from.addEventListener('change', load);
  form.to.addEventListener('change', load);
  var typing;
  form.q.addEventListener('input', function () {
    clearTimeout(typing);
    typing = setTimeout(load, 300);
  });

  // Start from whatever is in the address bar (e.g. after a refresh)
  var start = new URLSearchParams(location.search);
  FIELDS.forEach(function (k) { if (start.get(k)) form[k].value = start.get(k); });
  load();
})();
