// T61 / US33: clear "let them in" result   T62 / US34: clear invalid / wrong-event / used results
(function () {
  window.ETMS = window.ETMS || {};
  var box = document.getElementById('scan-result');
  var recent = document.getElementById('recent-scans');
  var el = function (tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined && text !== null) e.textContent = text; return e; };

  var LOOK = {
    VALID: { cls: 'ok', icon: '✓', title: 'VALID – LET THEM IN' },
    ALREADY_USED: { cls: 'warn', icon: '!', title: 'ALREADY USED – DO NOT LET IN' },
    WRONG_EVENT: { cls: 'bad', icon: '✕', title: 'WRONG EVENT – DO NOT LET IN' },
    CANCELLED: { cls: 'bad', icon: '✕', title: 'CANCELLED TICKET – DO NOT LET IN' },
    EVENT_CANCELLED: { cls: 'bad', icon: '✕', title: 'EVENT CANCELLED – DO NOT LET IN' },
    INVALID: { cls: 'bad', icon: '✕', title: 'INVALID TICKET – DO NOT LET IN' },
    UNREADABLE: { cls: 'neutral', icon: '?', title: 'COULD NOT READ CODE' },
    ERROR: { cls: 'neutral', icon: '?', title: 'CHECK-IN PROBLEM' },
  };

  function time(iso) {
    return iso ? new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '';
  }

  function detail(r) {
    if (r.result === 'VALID') return r.ticket.holderName + ' · ' + r.code;
    if (r.result === 'ALREADY_USED') {
      return r.ticket.holderName + ' · checked in at ' + time(r.checkedInAt) + (r.checkedInBy ? ' by ' + r.checkedInBy : '');
    }
    if (r.result === 'WRONG_EVENT') return 'This ticket is for "' + r.ticket.eventTitle + '".';
    if (r.code) return r.code;
    return '';
  }

  ETMS.showScanResult = function (r) {
    var look = LOOK[r.result] || LOOK.ERROR;
    box.className = 'scan-result ' + look.cls;
    box.dataset.result = r.result;
    box.innerHTML = '';
    box.appendChild(el('span', 'scan-icon', look.icon));
    var text = el('div', 'scan-text');
    text.appendChild(el('strong', 'scan-title', look.title));
    var d = detail(r);
    if (d) text.appendChild(el('span', 'scan-detail', d));
    text.appendChild(el('span', 'scan-message', r.message));
    box.appendChild(text);
    box.hidden = false;
    if (navigator.vibrate) navigator.vibrate(r.valid ? 80 : [60, 60, 60]);
  };

  ETMS.addRecentScan = function (r) {
    var look = LOOK[r.result] || LOOK.ERROR;
    var li = el('li', 'recent-item ' + look.cls);
    li.appendChild(el('span', 'recent-time', time(new Date().toISOString())));
    li.appendChild(el('strong', null, look.title.split(' – ')[0]));
    li.appendChild(el('span', 'muted', r.ticket ? r.ticket.holderName + ' · ' + (r.code || '') : (r.code || '')));
    recent.insertBefore(li, recent.firstChild);
    while (recent.children.length > 8) recent.removeChild(recent.lastChild);
  };
})();
