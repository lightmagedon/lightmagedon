/* ==========================================================================
   LIGHTMAGEDON — main.js
   Sin dependencias. Todo el movimiento usa transform/opacity (GPU).
   ========================================================================== */
(function () {
  'use strict';

  /* ------------------------------------------------------------------
     CONFIG  ·  edita esto para cambiar el contenido del sitio
     ------------------------------------------------------------------ */
  var CONFIG = {
    file: './modpack/LightMagedon-Modpack-v1.0.0.zip',
    fileName: 'LightMagedon-Modpack-v1.0.0.zip',
    serverIp: 'play.lightmagedon.net',

    // Descarga con barra de progreso real (fetch + streams).
    // Ponlo en false si el .zip es muy grande: usara un enlace directo.
    streaming: true,

    // Por encima de este tamano NO se acumula en memoria: se usa un
    // enlace directo (el navegador lo descarga a disco en streaming).
    // Bajalo si tu pack es pequeno y prefieres siempre la barra de progreso.
    streamLimitMB: 80,

    // Mods mostrados en la seccion "Mods".
    mods: [
      { n: 'Sodium',              c: 'Rendimiento',        d: 'Reescribe el renderizador. +200 FPS en zonas densas.' },
      { n: 'Iris Shaders',        c: 'Shaders',            d: 'Carga shaders de forma nativa sobre Sodium.' },
      { n: 'Lithium',             c: 'Rendimiento',        d: 'Optimiza la fisica de chunks del motor.' },
      { n: 'Starlight',           c: 'Iluminación',        d: 'Luz dinamica y sombras de bloques coherentes.' },
      { n: 'FerriteCore',         c: 'Rendimiento',        d: 'Baja el uso de RAM entre un 20 y un 30 por ciento.' },
      { n: 'ImmediatelyFast',     c: 'Rendimiento',        d: 'Renderizado inmediato, sin esperas ni tirones.' },
      { n: 'EntityCulling',       c: 'Rendimiento',        d: 'No dibuja entidades que no puedes ver.' },
      { n: 'Zoomify',             c: 'Calidad de vida',    d: 'Zoom con la rueda del ratón, totalmente fluido.' },
      { n: 'Waystones',           c: 'Magia y exploración',d: 'Portales de piedra para teletransporte instantaneo.' },
      { n: 'Create',              c: 'Tecnologia',         d: 'Engranajes, automatizacion y maquinas propias.' },
      { n: 'Sodium Extra',        c: 'Calidad de vida',    d: 'Niebla, cielo y animaciones a medida.' },
      { n: 'Chime',               c: 'Calidad de vida',    d: 'Musica ambiental suave y configurable.' },
      { n: 'Continuity',          c: 'Calidad de vida',    d: 'Vidrio conectado sin bordes ni barra.' },
      { n: 'EMI',                 c: 'Interfaz',           d: 'Muestra las recetas de todos los mods.' },
      { n: 'JourneyMap',          c: 'Interfaz',           d: 'Minimapa, waypoints y modo cinematico.' },
      { n: "Xaero's Minimap",     c: 'Interfaz',           d: 'Alternativa ligera a JourneyMap.' },
      { n: 'Just Enough Items',   c: 'Interfaz',           d: 'Buscador instantaneo de objetos y mobs.' },
      { n: 'Puzzles',             c: 'Interfaz',           d: 'Dependencia base que usan varios mods.' },
      { n: 'Faithful 32x',        c: 'Recursos',           d: 'Texturas a 32x que respetan el arte original.' },
      { n: 'Complementary ReBorn',c: 'Shaders',            d: 'Shaderpack recomendado: luz y agua con mucho detalle.' }
    ]
  };

  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };

  /* ------------------------------------------------------------------
     0. Utilidades
     ------------------------------------------------------------------ */
  function fmtBytes(b) {
    if (!b && b !== 0) return '—';
    if (b < 1024) return b + ' B';
    var u = ['KB', 'MB', 'GB'], i = -1, n = b;
    do { n /= 1024; i++; } while (n >= 1024 && i < u.length - 1);
    return (n < 10 ? n.toFixed(2) : n < 100 ? n.toFixed(1) : Math.round(n)) + ' ' + u[i];
  }

  function fmtTime(s) {
    if (!isFinite(s) || s < 0) return '—';
    s = Math.round(s);
    if (s < 60) return s + ' s';
    var m = Math.floor(s / 60);
    if (m < 60) return m + ' min ' + (s % 60) + ' s';
    return Math.floor(m / 60) + ' h ' + (m % 60) + ' min';
  }

  function raf(fn) { return window.requestAnimationFrame(fn); }

  /* ------------------------------------------------------------------
     1. Toast
     ------------------------------------------------------------------ */
  var toastEl = $('#toast');
  var toastTimer;
  function toast(msg, kind) {
    if (!toastEl) return;
    var icon = kind === 'err' ? '#i-zip' : '#i-check';
    toastEl.innerHTML = '<svg class="ico"><use href="' + icon + '"/></svg><span></span>';
    toastEl.querySelector('span').textContent = msg;
    toastEl.classList.toggle('is-err', kind === 'err');
    toastEl.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('is-on'); }, 3200);
  }

  /* ------------------------------------------------------------------
     2. Preloader con carga real de imagenes
     ------------------------------------------------------------------ */
  (function preloader() {
    var box = $('#preloader'), fill = $('#preloaderFill'), pct = $('#preloaderPct');
    if (!box) return;
    if (REDUCED) { box.classList.add('is-done'); startReveal(); return; }

    var imgs = $$('img');
    var total = Math.max(imgs.length, 1);
    var done = 0, shown = 0;

    function bump() {
      done++;
      var real = Math.round((done / total) * 100);
      // interpola hacia el valor real para que no salte
      shown += (real - shown) * 0.35;
      var v = Math.min(100, Math.round(shown));
      if (fill) fill.style.width = v + '%';
      if (pct) pct.textContent = v;
      if (done >= total) {
        shown = 100;
        if (fill) fill.style.width = '100%';
        if (pct) pct.textContent = '100';
        setTimeout(finish, 320);
      }
    }

    function finish() {
      box.classList.add('is-done');
      document.body.style.overflow = '';
      setTimeout(function () { box.remove(); }, 900);
      startReveal();
    }

    imgs.forEach(function (im) {
      if (im.complete && im.naturalWidth) { bump(); return; }
      im.addEventListener('load', bump, { once: true });
      im.addEventListener('error', bump, { once: true });
    });

    // salvavidas: nunca dejar la pagina bloqueada
    setTimeout(finish, 4000);

    document.body.style.overflow = 'hidden';
  })();

  /* ------------------------------------------------------------------
     3. Reveal on scroll
     ------------------------------------------------------------------ */
  function startReveal() {
    var items = $$('.reveal');
    if (!('IntersectionObserver' in window) || REDUCED) {
      items.forEach(function (el) { el.classList.add('in'); });
      return;
    }
    items.forEach(function (el) {
      if (el.dataset.delay) el.style.setProperty('--d', el.dataset.delay);
    });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        // isIntersecting cubre lo que entra por abajo; el top < 0 cubre
        // lo que ya quedo por encima (salto a un ancla o scroll muy rapido)
        if (e.isIntersecting || e.boundingClientRect.top < 0) {
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    items.forEach(function (el) { io.observe(el); });
  }
  // por si el preloader se salta (reduced motion) o algo falla antes
  setTimeout(function () {
    if (!document.querySelector('#preloader')) startReveal();
  }, 60);
  // red de seguridad: nunca dejes contenido invisible
  setTimeout(startReveal, 6000);

  /* ------------------------------------------------------------------
     4. Navbar: sticky, scroll spy, movil
     ------------------------------------------------------------------ */
  (function navbar() {
    var nav = $('#nav'), burger = $('#navBurger'), links = $('#navLinks');
    if (!nav) return;

    var onScroll = function () {
      nav.classList.toggle('is-stuck', window.scrollY > 24);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });

    if (burger && links) {
      var close = function () {
        links.classList.remove('is-open');
        burger.setAttribute('aria-expanded', 'false');
        burger.setAttribute('aria-label', 'Abrir menu');
      };
      burger.addEventListener('click', function () {
        var open = links.classList.toggle('is-open');
        burger.setAttribute('aria-expanded', String(open));
        burger.setAttribute('aria-label', open ? 'Cerrar menu' : 'Abrir menu');
      });
      links.addEventListener('click', function (e) {
        if (e.target.closest('a')) close();
      });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') close();
      });
      window.addEventListener('resize', function () {
        if (window.innerWidth > 860) close();
      });
    }

    // scroll spy
    var map = $$('main section[id]');
    var navA = $$('#navLinks a[href^="#"]');
    if ('IntersectionObserver' in window && map.length && navA.length) {
      var spy = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          var id = e.target.id;
          navA.forEach(function (a) {
            a.classList.toggle('is-current', a.getAttribute('href') === '#' + id);
          });
        });
      }, { rootMargin: '-45% 0px -50% 0px' });
      map.forEach(function (s) { spy.observe(s); });
    }
  })();

  /* ------------------------------------------------------------------
     5. Parallax del cielo + barra de scroll (un solo rAF)
     ------------------------------------------------------------------ */
  (function parallax() {
    var layers = $$('[data-parallax]');
    var bar = $('#scrollBar');
    var running = false;

    function frame() {
      var y = window.scrollY;
      var vh = window.innerHeight;

      for (var i = 0; i < layers.length; i++) {
        var el = layers[i];
        var f = parseFloat(el.dataset.parallax) || 0;
        var d = (y - vh) * f;                 // arranca cuando el bloque pasa
        el.style.transform = 'translate3d(0,' + d.toFixed(2) + 'px,0)';
      }
      if (bar) {
        var max = document.documentElement.scrollHeight - vh;
        bar.style.width = (max > 0 ? clamp(y / max, 0, 1) * 100 : 0) + '%';
      }
      running = false;
    }

    function onScroll() {
      if (!running) { running = true; raf(frame); }
    }

    if (REDUCED) { frame(); return; }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    frame();
  })();

  /* ------------------------------------------------------------------
     6. Particulas flotantes (canvas)
     ------------------------------------------------------------------ */
  (function motes() {
    var cv = $('#motes');
    if (!cv || REDUCED) return;
    var ctx = cv.getContext('2d', { alpha: true });
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var W = 0, H = 0, parts = [], visible = true, rafId = null;

    function size() {
      W = cv.clientWidth; H = cv.clientHeight;
      cv.width = Math.floor(W * dpr);
      cv.height = Math.floor(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      build();
    }

    function build() {
      // densidad proporcional al area, con techo para no saturar moviles
      var n = clamp(Math.round((W * H) / 26000), 18, 70);
      parts = [];
      for (var i = 0; i < n; i++) {
        parts.push({
          x: Math.random() * W,
          y: Math.random() * H,
          s: 1 + Math.random() * 2.6,
          v: 0.08 + Math.random() * 0.32,
          d: Math.random() * Math.PI * 2,
          a: 0.18 + Math.random() * 0.5,
          w: Math.random() * 0.6 + 0.2
        });
      }
    }

    function tick() {
      ctx.clearRect(0, 0, W, H);
      for (var i = 0; i < parts.length; i++) {
        var p = parts[i];
        p.y -= p.v;
        p.d += 0.012;
        p.x += Math.sin(p.d) * p.w * 0.35;
        if (p.y < -6) { p.y = H + 6; p.x = Math.random() * W; }
        ctx.globalAlpha = p.a;
        ctx.fillStyle = i % 4 === 0 ? '#a0eeff' : '#ffffff';
        // cuadrado: detalle pixelado a proposito
        ctx.fillRect(p.x | 0, p.y | 0, p.s | 0 || 1, p.s | 0 || 1);
      }
      ctx.globalAlpha = 1;
      rafId = raf(tick);
    }

    function play() { if (!rafId && visible) rafId = raf(tick); }
    function stop() { if (rafId) { cancelAnimationFrame(rafId); rafId = null; } }

    size();
    play();

    var rt;
    window.addEventListener('resize', function () {
      clearTimeout(rt);
      rt = setTimeout(size, 180);
    });
    // no gastar CPU con la pestaña oculta
    document.addEventListener('visibilitychange', function () {
      visible = !document.hidden;
      visible ? play() : stop();
    });
  })();

  /* ------------------------------------------------------------------
     7. Contadores estadisticos
     ------------------------------------------------------------------ */
  (function counters() {
    var els = $$('.count');
    if (!els.length) return;
    if (REDUCED || !('IntersectionObserver' in window)) {
      els.forEach(function (el) { el.textContent = el.dataset.to; });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var el = e.target, to = parseFloat(el.dataset.to) || 0;
        var t0 = null, dur = 1500;
        var step = function (t) {
          if (t0 === null) t0 = t;
          var k = clamp((t - t0) / dur, 0, 1);
          var eased = 1 - Math.pow(1 - k, 3);
          el.textContent = Math.round(to * eased).toLocaleString('es-ES');
          if (k < 1) raf(step);
        };
        raf(step);
        io.unobserve(el);
      });
    }, { threshold: 0.5 });
    els.forEach(function (el) { io.observe(el); });
  })();

  /* ------------------------------------------------------------------
     8. Botones magneticos
     ------------------------------------------------------------------ */
  (function magnetic() {
    if (REDUCED || window.matchMedia('(hover: none)').matches) return;
    $$('[data-magnetic]').forEach(function (el) {
      var strength = 0.32, rafId = null;

      function move(e) {
        var r = el.getBoundingClientRect();
        var x = (e.clientX - (r.left + r.width / 2)) * strength;
        var y = (e.clientY - (r.top + r.height / 2)) * strength;
        el.style.transform = 'translate(' + x + 'px,' + y + 'px)';
      }
      function reset() {
        if (rafId) cancelAnimationFrame(rafId);
        rafId = raf(function () { el.style.transform = ''; });
      }

      el.addEventListener('mousemove', function (e) {
        if (rafId) cancelAnimationFrame(rafId);
        rafId = raf(function () { move(e); });
      });
      el.addEventListener('mouseenter', move);
      el.addEventListener('mouseleave', reset);
    });
  })();

  /* ------------------------------------------------------------------
     9. Copiar al portapapeles
     ------------------------------------------------------------------ */
  function copyLegacy(text) {
    // plan B para contextos no seguros o cuando la API moderna falla
    return new Promise(function (res, rej) {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      ta.setSelectionRange(0, text.length);
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      ok ? res() : rej(new Error('execCommand copy fallo'));
    });
  }

  function copy(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).catch(function () {
        return copyLegacy(text);
      });
    }
    return copyLegacy(text);
  }

  (function copyBtns() {
    var ipBtn = $('#copyIp');
    if (ipBtn) {
      ipBtn.addEventListener('click', function () {
        var txt = $('#ipText').textContent.trim();
        copy(txt).then(function () {
          ipBtn.classList.add('is-copied');
          toast('IP copiada: ' + txt);
          setTimeout(function () { ipBtn.classList.remove('is-copied'); }, 2000);
        }).catch(function () { toast('No se pudo copiar', 'err'); });
      });
    }

    var linkBtn = $('#copyLinkBtn');
    if (linkBtn) {
      linkBtn.addEventListener('click', function () {
        var url = new URL(CONFIG.file, location.href).href;
        copy(url).then(function () {
          toast('Enlace copiado al portapapeles');
        }).catch(function () { toast('No se pudo copiar', 'err'); });
      });
    }
  })();

  /* ------------------------------------------------------------------
     10. Seccion de mods: render + buscador + filtros
     ------------------------------------------------------------------ */
  (function mods() {
    var grid = $('#modGrid'), empty = $('#modsEmpty');
    if (!grid) return;

    function esc(s) {
      return String(s).replace(/[&<>"']/g, function (m) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
      });
    }
    function norm(s) {
      return String(s).toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    }
    function initials(n) {
      var parts = n.replace(/[^\w\s]/g, '').split(/\s+/).filter(Boolean);
      if (!parts.length) return '?';
      return (parts[0][0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
    }

    var query = '', cat = 'all';

    function render() {
      var q = norm(query.trim());
      var list = CONFIG.mods.filter(function (m) {
        var okCat = cat === 'all' || m.c === cat;
        var okQ = !q || norm(m.n).indexOf(q) > -1 || norm(m.d).indexOf(q) > -1 || norm(m.c).indexOf(q) > -1;
        return okCat && okQ;
      });

      grid.innerHTML = list.map(function (m, i) {
        return '<article class="mod" style="animation-delay:' + Math.min(i * 35, 420) + 'ms">' +
          '<span class="mod__size">jar</span>' +
          '<div class="mod__top">' +
            '<span class="mod__icon" aria-hidden="true">' + esc(initials(m.n)) + '</span>' +
            '<h3 class="mod__name">' + esc(m.n) + '</h3>' +
          '</div>' +
          '<span class="mod__cat">' + esc(m.c) + '</span>' +
          '<p class="mod__desc">' + esc(m.d) + '</p>' +
        '</article>';
      }).join('');

      if (empty) empty.hidden = list.length > 0;
    }

    var search = $('#modSearch');
    if (search) {
      var deb;
      search.addEventListener('input', function () {
        clearTimeout(deb);
        deb = setTimeout(function () { query = search.value; render(); }, 120);
      });
      search.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') { search.value = ''; query = ''; render(); }
      });
    }

    var filters = $('#modFilters');
    if (filters) {
      filters.addEventListener('click', function (e) {
        var b = e.target.closest('.filter');
        if (!b) return;
        $$('.filter', filters).forEach(function (x) { x.classList.remove('is-active'); });
        b.classList.add('is-active');
        cat = b.dataset.cat;
        render();
      });
    }

    render();
  })();

  /* ------------------------------------------------------------------
     11. Acordeon: solo uno abierto a la vez
     ------------------------------------------------------------------ */
  (function accordion() {
    var acc = $('#accordion');
    if (!acc) return;
    $$('details', acc).forEach(function (d) {
      d.addEventListener('toggle', function () {
        if (!d.open) return;
        $$('details', acc).forEach(function (o) { if (o !== d) o.open = false; });
      });
    });
  })();

  /* ------------------------------------------------------------------
     12. Enlaces que no van a ningun sitio todavia
     ------------------------------------------------------------------ */
  $$('[data-noop]').forEach(function (a) {
    a.addEventListener('click', function (e) { e.preventDefault(); });
  });

  /* ------------------------------------------------------------------
     13. ano actual
     ------------------------------------------------------------------ */
  var y = $('#year');
  if (y) y.textContent = new Date().getFullYear();

  /* ------------------------------------------------------------------
     14. Tamano real del .zip + descarga con progreso
     ------------------------------------------------------------------ */
  (function downloader() {
    var btn = $('#downloadBtn');
    var btnText = $('#downloadBtnText');
    var prog = $('#progress');
    var fill = $('#progressFill');
    var pctEl = $('#progressPct');
    var sizeEl = $('#progressSize');
    var speedEl = $('#progressSpeed');
    var etaEl = $('#progressEta');
    var label = $('#progressLabel');
    var sizeChip = $('#fileSize');
    var nameEl = $('#fileName');
    if (!btn) return;

    var total = 0, busy = false, controller = null;
    var LIMIT = (CONFIG.streamLimitMB || 80) * 1024 * 1024;
    if (nameEl) nameEl.textContent = CONFIG.fileName;

    // --- HEAD para conocer el tamano y el tipo real ---
    function probe() {
      fetch(CONFIG.file, { method: 'HEAD', cache: 'no-store' })
        .then(function (r) {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          total = parseInt(r.headers.get('content-length') || '0', 10) || 0;
          if (sizeChip) sizeChip.textContent = fmtBytes(total);
        })
        .catch(function () {
          if (sizeChip) sizeChip.textContent = '18 MB';
        });
    }
    probe();

    function setProgress(loaded) {
      var p = total > 0 ? clamp(loaded / total, 0, 1) : 0;
      var pct = Math.floor(p * 100);
      if (fill) fill.style.width = pct + '%';
      if (pctEl) pctEl.textContent = pct + '%';
      if (sizeEl) sizeEl.textContent = fmtBytes(loaded) + ' / ' + fmtBytes(total || 0);
    }

    function saveBlob(blob, filename) {
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 20000);
    }

    function reset(msg) {
      busy = false;
      btn.classList.remove('is-busy');
      btn.disabled = false;
      btnText.textContent = msg || 'Descargar ahora';
    }

    function directDownload() {
      // modo simple: el navegador gestiona el archivo
      var a = document.createElement('a');
      a.href = CONFIG.file;
      a.download = CONFIG.fileName;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
      if (prog) {
        prog.classList.add('is-done');
        if (label) label.textContent = 'Descarga iniciada';
        if (fill) fill.style.width = '100%';
        if (pctEl) pctEl.textContent = '100%';
        if (sizeEl) sizeEl.textContent = fmtBytes(total) + ' / ' + fmtBytes(total);
        if (speedEl) speedEl.textContent = '—';
        if (etaEl) etaEl.textContent = 'completo';
      }
      toast('Descarga iniciada');
      reset('Descargar de nuevo');
    }

    function streamDownload() {
      if (typeof ReadableStream === 'undefined' || !window.fetch || !window.TextDecoder) {
        directDownload();
        return;
      }
      // si el HEAD ya nos dijo que es enorme, no lo acumulamos en memoria
      if (total > LIMIT) {
        toast('El archivo es muy grande: descarga directa del navegador');
        directDownload();
        return;
      }

      busy = true;
      controller = new AbortController();
      btn.classList.add('is-busy');
      btn.disabled = true;
      btnText.textContent = 'Descargando…';
      if (prog) {
        prog.hidden = false;
        prog.classList.remove('is-done');
        if (label) label.textContent = 'Descargando';
        if (speedEl) speedEl.textContent = '—';
        if (etaEl) etaEl.textContent = '—';
      }
      setProgress(0);

      var chunks = [], received = 0;
      var t0 = performance.now(), last = t0, lastBytes = 0, smoothed = 0;

      fetch(CONFIG.file, { signal: controller.signal, cache: 'no-store' })
        .then(function (res) {
          if (!res.ok) throw new Error('HTTP ' + res.status);
          var len = parseInt(res.headers.get('content-length') || '0', 10) || 0;
          if (len > 0) {
            total = len;
            if (sizeChip) sizeChip.textContent = fmtBytes(total);
          }
          // el HEAD pudo fallar: decide aqui tambien
          if (len > LIMIT) {
            busy = false;
            btn.classList.remove('is-busy');
            btn.disabled = false;
            toast('El archivo es muy grande: descarga directa del navegador');
            directDownload();
            return;
          }

          // si no soporta streams, cae al metodo directo
          if (!res.body || !res.body.getReader) {
            busy = false;
            btn.classList.remove('is-busy');
            btn.disabled = false;
            directDownload();
            return;
          }

          var reader = res.body.getReader();

          function pump() {
            return reader.read().then(function (r) {
              if (r.done) {
                var blob = new Blob(chunks, { type: 'application/zip' });
                if (fill) fill.style.width = '100%';
                if (pctEl) pctEl.textContent = '100%';
                if (prog) prog.classList.add('is-done');
                if (label) label.textContent = 'Listo, guardado en tu equipo';
                if (speedEl) speedEl.textContent = '—';
                if (etaEl) etaEl.textContent = 'completo';
                saveBlob(blob, CONFIG.fileName);
                toast('Descargado: ' + CONFIG.fileName);
                reset('Descargar de nuevo');
                return;
              }

              chunks.push(r.value);
              received += r.value.length;

              var now = performance.now();
              var dt = (now - last) / 1000;
              if (dt >= 0.25) {
                var inst = (received - lastBytes) / dt;
                smoothed = smoothed ? smoothed * 0.65 + inst * 0.35 : inst;
                last = now; lastBytes = received;
                if (speedEl) speedEl.textContent = fmtBytes(smoothed) + '/s';
                if (etaEl && total) {
                  etaEl.textContent = 'quedan ' + fmtTime((total - received) / smoothed);
                }
              }

              setProgress(received);
              return pump();
            });
          }
          return pump();
        })
        .catch(function (err) {
          if (err && err.name === 'AbortError') {
            reset('Cancelado');
            if (label) label.textContent = 'Descarga cancelada';
            toast('Descarga cancelada');
            return;
          }
          // red / CORS / servidor: usa el enlace directo como red de seguridad
          console.warn('[lightmagedon] descarga por stream fallida, usando enlace directo:', err);
          reset();
          directDownload();
        });
    }

    btn.addEventListener('click', function () {
      if (busy) {
        if (controller) controller.abort();
        return;
      }
      if (CONFIG.streaming) streamDownload();
      else directDownload();
    });

    // el boton sirve tambien para cancelar mientras descarga
    window.addEventListener('beforeunload', function () {
      if (controller) controller.abort();
    });
  })();

})();
