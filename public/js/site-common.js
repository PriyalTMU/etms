// Shared helpers for public pages: header (who is logged in) and date formatting.
(function () {
  window.ETMS = window.ETMS || {};

  function parts(date, time) {
    var d = date.split('-').map(Number);
    var t = (time || '00:00').split(':').map(Number);
    return new Date(d[0], d[1] - 1, d[2], t[0], t[1]);
  }

  ETMS.formatDay = function (date) {
    return parts(date).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  };
  ETMS.formatTime = function (date, time) {
    return parts(date, time).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  };
  ETMS.formatShort = function (date, time) {
    var d = parts(date, time);
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) +
      ' · ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  };

  ETMS.el = function (tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined && text !== null) e.textContent = text;
    return e;
  };

  // Header: show the logged-in user, or a link to log in.
  fetch('/api/auth/me').then(function (r) { return r.json(); }).then(function (d) {
    var who = document.getElementById('site-who');
    if (!who) return;
    if (d.user) {
      who.appendChild(ETMS.el('span', 'role-badge', d.user.role));
      who.appendChild(ETMS.el('span', null, d.user.name));
      if (d.user.role === 'organizer') {
        var a = ETMS.el('a', null, 'Organizer dashboard');
        a.href = '/organizer';
        who.appendChild(a);
      }
      var b = ETMS.el('button', 'btn link', 'Log out');
      b.type = 'button';
      b.addEventListener('click', function () {
        fetch('/api/auth/logout', { method: 'POST' }).finally(function () { location.href = '/'; });
      });
      who.appendChild(b);
    } else {
      var link = ETMS.el('a', null, 'Organizer login');
      link.href = '/organizer/login';
      who.appendChild(link);
    }
  }).catch(function () {});
})();
