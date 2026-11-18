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

  // Sprint 4: US46 categories · US51 free / demo-paid with a demo price (no real money)
  var CATEGORIES = [
    { value: 'academic', label: 'Academic' },
    { value: 'arts', label: 'Arts & Culture' },
    { value: 'career', label: 'Career' },
    { value: 'social', label: 'Social' },
    { value: 'sports', label: 'Sports' },
    { value: 'tech', label: 'Technology' },
    { value: 'other', label: 'Other' },
  ];
  var PAYMENT_TYPES = [
    { value: 'free', label: 'Free' },
    { value: 'demo_paid', label: 'Demo-paid' },
  ];
  var PRICE_MIN_CENTS = 50;      // $0.50
  var PRICE_MAX_CENTS = 50000;   // $500.00

  function categoryLabel(value) {
    for (var i = 0; i < CATEGORIES.length; i++) if (CATEGORIES[i].value === value) return CATEGORIES[i].label;
    return 'Other';
  }

  /** 500 -> "$5.00" */
  function formatPrice(cents) {
    return '$' + (Math.round(cents) / 100).toFixed(2);
  }

  var FIELD_LABELS = {
    category: 'Category',
    paymentType: 'Payment type',
    price: 'Demo price',
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
  function validateEvent(input, now, options) {
    input = input || {};
    now = now || new Date();
    options = options || {};
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

    // US39: when editing, capacity can't go below the tickets that are already issued
    if (!errors.capacity && capacity !== null && options.minCapacity && capacity < options.minCapacity) {
      errors.capacity = 'Maximum capacity cannot be lower than the ' + options.minCapacity +
        (options.minCapacity === 1 ? ' ticket' : ' tickets') + ' already issued.';
    }

    // US46: category (optional for older API clients -> "other"; anything unknown is rejected)
    var category = asText(input.category) || 'other';
    if (!CATEGORIES.some(function (c) { return c.value === category; })) {
      errors.category = 'Choose a category from the list.';
    }

    // US51: free or demo-paid (missing -> free; anything else is rejected)
    var paymentType = asText(input.paymentType) || 'free';
    var priceCents = 0;
    if (!PAYMENT_TYPES.some(function (p) { return p.value === paymentType; })) {
      errors.paymentType = 'Choose whether the event is Free or Demo-paid.';
    } else if (paymentType === 'demo_paid') {
      var priceRaw = asText(input.price).replace(/^\$/, '');
      if (priceRaw === '') {
        errors.price = 'Enter a demo price for a demo-paid event (for example 5.00).';
      } else if (!/^\d{1,3}(\.\d{1,2})?$/.test(priceRaw)) {
        errors.price = 'Enter the demo price as a number of dollars, for example 5 or 12.50.';
      } else {
        priceCents = Math.round(Number(priceRaw) * 100);
        if (priceCents < PRICE_MIN_CENTS || priceCents > PRICE_MAX_CENTS) {
          errors.price = 'The demo price must be between ' + formatPrice(PRICE_MIN_CENTS) + ' and ' + formatPrice(PRICE_MAX_CENTS) + '.';
        }
      }
    }

    return {
      valid: Object.keys(errors).length === 0,
      errors: errors,
      values: {
        category: category,
        paymentType: paymentType,
        priceCents: paymentType === 'demo_paid' ? priceCents : 0,
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
    CATEGORIES: CATEGORIES,
    PAYMENT_TYPES: PAYMENT_TYPES,
    categoryLabel: categoryLabel,
    formatPrice: formatPrice,
    LIMITS: LIMITS,
    FIELD_LABELS: FIELD_LABELS,
    localDateString: localDateString,
  };
});
