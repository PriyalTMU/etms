/*
 * T19 / US09: event-input validation.
 * This one file is used by BOTH the server (require) and the browser (<script src="/shared/eventValidation.js">),
 * so the organizer sees the same rules before and after submitting.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.EventValidation = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var LIMITS = {
    TITLE_MIN: 3,
    TITLE_MAX: 100,
    DESCRIPTION_MAX: 2000,
    LOCATION_MAX: 150,
    CAPACITY_MIN: 1,
    CAPACITY_MAX: 5000,
  };

  var FIELD_LABELS = {
    title: 'Title',
    description: 'Description',
    date: 'Date',
    time: 'Time',
    location: 'Location',
    capacity: 'Maximum capacity',
  };

  function pad(n) {
    return (n < 10 ? '0' : '') + n;
  }

  /** Today's date as YYYY-MM-DD in local time. */
  function localDateString(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function asText(value) {
    if (value === undefined || value === null) return '';
    return String(value).trim();
  }

  function isRealDate(str) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
    var parts = str.split('-').map(Number);
    var d = new Date(parts[0], parts[1] - 1, parts[2]);
    return d.getFullYear() === parts[0] && d.getMonth() === parts[1] - 1 && d.getDate() === parts[2];
  }

  function isRealTime(str) {
    return /^([01]\d|2[0-3]):[0-5]\d$/.test(str);
  }

  /**
   * Validate raw event input.
   * @param {object} input raw form / JSON values
   * @param {Date} [now] current time (passed in by tests)
   * @returns {{ valid: boolean, errors: Object<string,string>, values: object }}
   *   errors is keyed by field name with an understandable message;
   *   values holds the cleaned-up data (trimmed strings, capacity as a number).
   */
  function validateEvent(input, now) {
    input = input || {};
    now = now || new Date();
    var errors = {};

    var title = asText(input.title);
    var description = asText(input.description);
    var date = asText(input.date);
    var time = asText(input.time);
    var location = asText(input.location);
    var capacityRaw = asText(input.capacity);
    var capacity = null;

    // Required fields cannot be empty
    ['title', 'description', 'date', 'time', 'location'].forEach(function (field) {
      if (asText(input[field]) === '') errors[field] = FIELD_LABELS[field] + ' is required.';
    });
    if (capacityRaw === '') errors.capacity = FIELD_LABELS.capacity + ' is required.';

    // Clearly invalid values are rejected
    if (!errors.title) {
      if (title.length < LIMITS.TITLE_MIN) {
        errors.title = 'Title must be at least ' + LIMITS.TITLE_MIN + ' characters.';
      } else if (title.length > LIMITS.TITLE_MAX) {
        errors.title = 'Title must be ' + LIMITS.TITLE_MAX + ' characters or fewer.';
      }
    }

    if (!errors.description && description.length > LIMITS.DESCRIPTION_MAX) {
      errors.description = 'Description must be ' + LIMITS.DESCRIPTION_MAX + ' characters or fewer.';
    }

    if (!errors.location && location.length > LIMITS.LOCATION_MAX) {
      errors.location = 'Location must be ' + LIMITS.LOCATION_MAX + ' characters or fewer.';
    }

    if (!errors.date && !isRealDate(date)) {
      errors.date = 'Enter a real date in the format YYYY-MM-DD.';
    }

    if (!errors.time && !isRealTime(time)) {
      errors.time = 'Enter a valid time in 24-hour format HH:MM (for example 18:30).';
    }

    if (!errors.date && !errors.time) {
      var today = localDateString(now);
      var nowTime = pad(now.getHours()) + ':' + pad(now.getMinutes());
      if (date < today) {
        errors.date = 'The event date cannot be in the past.';
      } else if (date === today && time <= nowTime) {
        errors.time = 'The event time has already passed today. Pick a later time.';
      }
    }

    if (!errors.capacity) {
      if (!/^\d+$/.test(capacityRaw)) {
        errors.capacity = 'Maximum capacity must be a whole number (no letters, decimals or negative numbers).';
      } else {
        capacity = Number(capacityRaw);
        if (capacity < LIMITS.CAPACITY_MIN) {
          errors.capacity = 'Maximum capacity must be at least ' + LIMITS.CAPACITY_MIN + '.';
        } else if (capacity > LIMITS.CAPACITY_MAX) {
          errors.capacity = 'Maximum capacity cannot be more than ' + LIMITS.CAPACITY_MAX + '.';
        }
      }
    }

    return {
      valid: Object.keys(errors).length === 0,
      errors: errors,
      values: {
        title: title,
        description: description,
        date: date,
        time: time,
        location: location,
        capacity: capacity,
      },
    };
  }

  return {
    validateEvent: validateEvent,
    LIMITS: LIMITS,
    FIELD_LABELS: FIELD_LABELS,
    localDateString: localDateString,
  };
});
