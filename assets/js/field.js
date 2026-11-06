(function () {
  // ---- Live Daejeon clock ----
  var clockEl = document.getElementById('clock');
  var tz = clockEl.getAttribute('data-tz') || 'Asia/Seoul';
  var tzLabel = clockEl.getAttribute('data-label') || '';
  function tick() {
    try {
      clockEl.textContent = new Intl.DateTimeFormat('en-GB', {
        timeZone: tz, hour: '2-digit', minute: '2-digit'
      }).format(new Date()) + ' ' + tzLabel;
    } catch (e) { clockEl.textContent = tzLabel; }
  }
  tick(); setInterval(tick, 20000);

  // ---- Flow field hero ----
  var canvas = document.getElementById('field');
  var ctx = canvas.getContext('2d');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var dark = window.matchMedia('(prefers-color-scheme: dark)');
  var hint = document.getElementById('hint');
  if (!window.matchMedia('(hover: hover)').matches) hint.textContent = 'Drag through the field to stir it.';

  var W = 0, H = 0, dpr = 1, t = 0, particles = [], colors = {};
  var mouse = { x: -9999, y: -9999, vx: 0, vy: 0, active: false };

  function hexToRgb(h) {
    h = h.trim().replace('#', '');
    if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
    var n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function readColors() {
    var s = getComputedStyle(document.documentElement);
    colors.fog = hexToRgb(s.getPropertyValue('--fog'));
    colors.ink = hexToRgb(s.getPropertyValue('--slate'));
    colors.ultra = hexToRgb(s.getPropertyValue('--ultra'));
    colors.amber = hexToRgb(s.getPropertyValue('--amber'));
  }
  function rgba(c, a) { return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }

  function spawn(p) {
    p.x = Math.random() * W; p.y = Math.random() * H;
    p.life = 80 + Math.random() * 220;
    var r = Math.random();
    p.c = r < 0.07 ? 'ultra' : (r < 0.1 ? 'amber' : 'ink');
    return p;
  }
  function resize() {
    var rect = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = rect.width; H = rect.height;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var count = Math.round(Math.min(1400, (W * H) / 900));
    particles = [];
    for (var i = 0; i < count; i++) particles.push(spawn({}));
    ctx.fillStyle = rgba(colors.fog, 1);
    ctx.fillRect(0, 0, W, H);
    if (reduce.matches) drawStatic();
  }

  // Smooth pseudo-flow: a sum of rotating sinusoidal stream functions,
  // with velocity taken as the curl so the field stays divergence-free.
  function velocity(x, y, time) {
    var sx = x * 0.0042, sy = y * 0.0042;
    var u = Math.cos(sy * 1.3 + time * 0.6) + 0.6 * Math.cos(sy * 2.7 - sx * 0.9 + time * 0.35) + 0.35;
    var v = Math.sin(sx * 1.1 - time * 0.5) * 0.9 + 0.5 * Math.sin(sx * 2.3 + sy * 1.7 + time * 0.4);
    // cursor vortex (Lamb–Oseen-ish swirl) plus a drag in the cursor's direction
    if (mouse.active) {
      var dx = x - mouse.x, dy = y - mouse.y, r2 = dx * dx + dy * dy;
      var core = 4200;
      var swirl = 2600 / (r2 + core) * (1 - Math.exp(-r2 / core));
      u += -dy * swirl * 0.06; v += dx * swirl * 0.06;
      var push = Math.exp(-r2 / 9000);
      u += mouse.vx * push * 0.35; v += mouse.vy * push * 0.35;
    }
    return [u, v];
  }

  function step() {
    t += 0.004;
    ctx.fillStyle = rgba(colors.fog, 0.07);
    ctx.fillRect(0, 0, W, H);
    ctx.lineWidth = 1.1;
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      var vel = velocity(p.x, p.y, t);
      var nx = p.x + vel[0] * 1.15, ny = p.y + vel[1] * 1.15;
      var speed = Math.min(1, Math.hypot(vel[0], vel[1]) / 3.5);
      ctx.strokeStyle = rgba(colors[p.c], p.c === 'ink' ? 0.18 + speed * 0.25 : 0.55 + speed * 0.4);
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(nx, ny); ctx.stroke();
      p.x = nx; p.y = ny; p.life--;
      if (p.life < 0 || p.x < -10 || p.x > W + 10 || p.y < -10 || p.y > H + 10) spawn(p);
    }
    mouse.vx *= 0.9; mouse.vy *= 0.9;
    raf = requestAnimationFrame(step);
  }

  // Reduced motion: draw a still set of streamlines instead of animating.
  function drawStatic() {
    ctx.fillStyle = rgba(colors.fog, 1); ctx.fillRect(0, 0, W, H);
    ctx.lineWidth = 1;
    var n = Math.round((W * H) / 2600);
    for (var i = 0; i < n; i++) {
      var x = Math.random() * W, y = Math.random() * H;
      var c = Math.random() < 0.08 ? 'ultra' : 'ink';
      ctx.strokeStyle = rgba(colors[c], c === 'ink' ? 0.22 : 0.6);
      ctx.beginPath(); ctx.moveTo(x, y);
      for (var k = 0; k < 40; k++) {
        var v = velocity(x, y, 1.3); x += v[0] * 2; y += v[1] * 2; ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }

  var raf = null;
  function start() {
    cancelAnimationFrame(raf);
    if (reduce.matches) { hint.hidden = true; drawStatic(); }
    else { hint.hidden = false; raf = requestAnimationFrame(step); }
  }

  function setPointer(e) {
    var rect = canvas.getBoundingClientRect();
    var x = e.clientX - rect.left, y = e.clientY - rect.top;
    if (mouse.active) { mouse.vx += (x - mouse.x) * 0.5; mouse.vy += (y - mouse.y) * 0.5; }
    mouse.x = x; mouse.y = y; mouse.active = true;
  }
  var hero = canvas.parentElement;
  hero.addEventListener('pointermove', setPointer);
  hero.addEventListener('pointerdown', setPointer);
  hero.addEventListener('pointerleave', function () { mouse.active = false; });
  hero.addEventListener('pointerup', function (e) { if (e.pointerType !== 'mouse') mouse.active = false; });

  // Pause when the hero is off-screen.
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) start(); else cancelAnimationFrame(raf);
    }).observe(hero);
  }

  readColors(); resize(); start();
  var rT;
  window.addEventListener('resize', function () { clearTimeout(rT); rT = setTimeout(function () { resize(); start(); }, 150); });
  function onTheme() { readColors(); resize(); start(); }
  if (dark.addEventListener) dark.addEventListener('change', onTheme);
  if (reduce.addEventListener) reduce.addEventListener('change', start);
  new MutationObserver(onTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
})();
