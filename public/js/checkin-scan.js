// T58 manual ticket-code entry · T59 QR scanning (camera, or a photo when the camera is not allowed)
// US32: the code is sent to the server, which checks it against THIS event.
(function () {
  window.ETMS = window.ETMS || {};
  var id = ETMS.checkinEventId;
  var form = document.getElementById('code-form');
  var input = document.getElementById('ticket-code');
  var video = document.getElementById('camera');
  var canvas = document.getElementById('qr-canvas');
  var ctx = canvas.getContext('2d', { willReadFrequently: true });
  var hint = document.getElementById('camera-hint');
  var stream = null;
  var busy = false;
  // D10: codes this camera has already sent, so a QR code still in view after the
  // volunteer let the person in is not re-scanned and shown as "ALREADY USED"
  var cameraSeen = {};
  var CAMERA_REPEAT_MS = 60000;

  function showStats(s) {
    if (!s) return;
    document.getElementById('ci-stats').textContent = s.checkedIn + ' of ' + s.issued + ' ticket holders checked in';
  }

  // Fallback only - the colour-coded result panel is in checkin-result.js (US33, US34)
  ETMS.showScanResult = ETMS.showScanResult || function (r) {
    var box = document.getElementById('scan-result');
    box.textContent = r.message;
    box.hidden = false;
  };

  ETMS.onCheckinEvent = function () {
    document.getElementById('scan-card').hidden = false;
    fetch('/api/checkin/events/' + id + '/stats').then(function (r) { return r.json(); }).then(showStats).catch(function () {});
    input.focus();
    if (!(window.isSecureContext && navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) {
      // Phone browsers only allow live camera on https or localhost - use the photo option instead (T59)
      document.getElementById('camera-btn').hidden = true;
      hint.textContent = 'Live camera scanning needs a secure (https) connection here, so use "Take a photo of the QR code" or type the code.';
    }
  };

  function submit(raw, source) {
    if (busy) return;
    busy = true;
    document.getElementById('check-btn').disabled = true;
    fetch('/api/checkin/events/' + id + '/scan', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: raw }),
    })
      .then(function (r) { return r.json().then(function (b) { return { status: r.status, body: b }; }); })
      .then(function (r) {
        if (r.status === 401) { location.href = '/login?next=' + encodeURIComponent(location.pathname); return; }
        if (r.status !== 200) { ETMS.showScanResult({ result: 'ERROR', valid: false, message: r.body.error || 'Check-in failed.' }); return; }
        r.body.source = source;
        ETMS.showScanResult(r.body);
        showStats(r.body.stats);
        if (ETMS.addRecentScan) ETMS.addRecentScan(r.body);
      })
      .catch(function () { ETMS.showScanResult({ result: 'ERROR', valid: false, message: 'Could not reach the server. Try again.' }); })
      .finally(function () {
        busy = false;
        document.getElementById('check-btn').disabled = false;
        input.value = '';
        input.focus();
      });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var raw = input.value.trim();
    if (!raw) { ETMS.showScanResult({ result: 'UNREADABLE', valid: false, message: 'Type a ticket code first.' }); return; }
    submit(raw, 'typed');
  });

  // ---- QR decoding (jsQR) ----
  function decode(source, w, h) {
    var scale = Math.min(1, 1024 / Math.max(w, h));
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    var data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    var qr = window.jsQR && window.jsQR(data.data, data.width, data.height, { inversionAttempts: 'attemptBoth' });
    return qr ? qr.data : null;
  }

  function tick() {
    if (!stream) return;
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      var text = decode(video, video.videoWidth, video.videoHeight);
      var nowMs = Date.now();
      if (text && !busy && !(cameraSeen[text] && nowMs - cameraSeen[text] < CAMERA_REPEAT_MS)) {
        cameraSeen[text] = nowMs;
        submit(text, 'camera');
      }
    }
    requestAnimationFrame(tick);
  }

  function stopCamera() {
    if (stream) stream.getTracks().forEach(function (t) { t.stop(); });
    stream = null;
    document.getElementById('video-wrap').hidden = true;
  }

  document.getElementById('camera-btn').addEventListener('click', function () {
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then(function (s) {
        stream = s;
        video.srcObject = s;
        document.getElementById('video-wrap').hidden = false;
        hint.textContent = 'Hold the QR code inside the frame.';
        return video.play();
      })
      .then(function () { requestAnimationFrame(tick); })
      .catch(function () {
        hint.textContent = 'The camera could not be opened. Allow camera access, or use "Take a photo of the QR code" or type the code.';
      });
  });
  document.getElementById('camera-stop').addEventListener('click', function () { stopCamera(); hint.textContent = ''; });

  document.getElementById('photo-input').addEventListener('change', function (e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    var img = new Image();
    img.onload = function () {
      var text = decode(img, img.naturalWidth, img.naturalHeight);
      URL.revokeObjectURL(img.src);
      e.target.value = '';
      if (text) submit(text, 'photo');
      else ETMS.showScanResult({ result: 'UNREADABLE', valid: false, message: 'No QR code was found in the photo. Try again closer, or type the code.' });
    };
    img.src = URL.createObjectURL(file);
  });
})();
