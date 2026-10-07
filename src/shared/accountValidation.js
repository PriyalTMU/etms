/*
 * T13 / US01: attendee account validation.
 * Used by BOTH the server and the browser (<script src="/shared/accountValidation.js">).
 * NFR3: we only collect what ticketing needs - name, email, password.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.AccountValidation = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var LIMITS = { NAME_MIN: 2, NAME_MAX: 80, EMAIL_MAX: 254, PASSWORD_MIN: 8, PASSWORD_MAX: 72 };
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function asText(v) {
    return v === undefined || v === null ? '' : String(v).trim();
  }

  /**
   * @returns {{ valid: boolean, errors: Object<string,string>, values: {name, email, password} }}
   */
  function validateSignup(input) {
    input = input || {};
    var errors = {};
    var name = asText(input.name).replace(/\s+/g, ' ');
    var email = asText(input.email).toLowerCase();
    var password = input.password === undefined || input.password === null ? '' : String(input.password);
    var confirm = input.confirmPassword === undefined || input.confirmPassword === null ? '' : String(input.confirmPassword);

    // Required fields
    if (!name) errors.name = 'Full name is required.';
    if (!email) errors.email = 'Email is required.';
    if (!password) errors.password = 'Password is required.';
    if (!confirm) errors.confirmPassword = 'Please type your password again.';

    // Format rules
    if (!errors.name) {
      if (name.length < LIMITS.NAME_MIN) errors.name = 'Full name must be at least ' + LIMITS.NAME_MIN + ' characters.';
      else if (name.length > LIMITS.NAME_MAX) errors.name = 'Full name must be ' + LIMITS.NAME_MAX + ' characters or fewer.';
    }
    if (!errors.email && (email.length > LIMITS.EMAIL_MAX || !EMAIL_RE.test(email))) {
      errors.email = 'Enter a valid email address, for example name@torontomu.ca.';
    }
    if (!errors.password) {
      if (password.length < LIMITS.PASSWORD_MIN) {
        errors.password = 'Password must be at least ' + LIMITS.PASSWORD_MIN + ' characters.';
      } else if (password.length > LIMITS.PASSWORD_MAX) {
        errors.password = 'Password must be ' + LIMITS.PASSWORD_MAX + ' characters or fewer.';
      } else if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
        errors.password = 'Password must include at least one letter and one number.';
      }
    }
    if (!errors.confirmPassword && !errors.password && confirm !== password) {
      errors.confirmPassword = 'Passwords do not match.';
    }

    return {
      valid: Object.keys(errors).length === 0,
      errors: errors,
      values: { name: name, email: email, password: password },
    };
  }

  return { validateSignup: validateSignup, LIMITS: LIMITS };
});
