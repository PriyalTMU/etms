// T17 / US06: role-based access control.
// Use requireRole('organizer') on any organizer-only API route,
// and requireRolePage('organizer') on organizer-only pages.

function currentUser(req) {
  return (req.session && req.session.user) || null;
}

/** For JSON API routes: 401 if not logged in, 403 if logged in with the wrong role. */
function requireRole(role) {
  return function (req, res, next) {
    const user = currentUser(req);
    if (!user) {
      return res.status(401).json({ error: 'You need to log in to do that.' });
    }
    if (user.role !== role) {
      return res.status(403).json({ error: `Only ${role} accounts can do that.` });
    }
    return next();
  };
}

/** For HTML pages: redirect to the login page if not logged in, show a 403 page if wrong role. */
function requireRolePage(role, loginPath) {
  return function (req, res, next) {
    const user = currentUser(req);
    if (!user) {
      return res.redirect(`${loginPath}?next=${encodeURIComponent(req.originalUrl)}`);
    }
    if (user.role !== role) {
      return res
        .status(403)
        .type('html')
        .send(forbiddenPage(role));
    }
    return next();
  };
}

function forbiddenPage(role) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Access denied · ETMS</title><link rel="stylesheet" href="/css/styles.css"></head>
<body><main class="container narrow">
<div class="card"><h1>Access denied</h1>
<p>This page is only available to ${role} accounts. You are logged in with a different account type.</p>
<p><a class="btn" href="/">Back to home</a></p></div>
</main></body></html>`;
}

module.exports = { requireRole, requireRolePage, currentUser };
