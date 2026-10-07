// Shared bits for organizer pages: show who is logged in + logout.
(function () {
  window.ETMS = window.ETMS || {};

  // If the browser restores this page from its back/forward cache (e.g. Back after logging out),
  // reload it so the server checks the login again (T29 defect D2).
  window.addEventListener('pageshow', function (e) {
    if (e.persisted) location.reload();
  });

  ETMS.loadCurrentUser = function () {
    return fetch('/api/auth/me').then(function (r) { return r.json(); }).then(function (d) {
      var el = document.getElementById('who-name');
      if (el && d.user) {
        el.textContent = d.user.name + (d.user.clubName ? ' · ' + d.user.clubName : '');
      }
      return d.user;
    });
  };

  ETMS.formatDate = function (date, time) {
    var parts = date.split('-').map(Number);
    var t = time.split(':').map(Number);
    var d = new Date(parts[0], parts[1] - 1, parts[2], t[0], t[1]);
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) +
      ' · ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  };

  document.addEventListener('click', function (e) {
    if (e.target && e.target.id === 'logout-btn') {
      fetch('/api/auth/logout', { method: 'POST' }).finally(function () { location.href = '/'; });
    }
  });
})();
