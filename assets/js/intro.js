/* ==========================================================================
   LIGHTMAGEDON — intro cinematica
   --------------------------------------------------------------------------
   Encadena tres cosas que ya existen en main.js, sin duplicarlas:
     1. retiene el final del preloader hasta que pulse "Entrar"
     2. arranca la musica (hace falta un clic real: el navegador bloquea
        el audio hasta que el visitante interactua)
     3. cuando termina, devuelve el control y relanza el reveal del hero

   El decorado (suelo, arboles, nubes, viento) es 100% CSS: ver intro.css.
   Aqui solo se genera el HTML del decorado y se manda el viento.

   Ajustes: todo se cambia desde las variables --in-* de assets/css/intro.css
   (duraciones, colores, recorridos, cantidad de nubes/arboles).
   ========================================================================== */
(function () {
  'use strict';

  var doc = document;
  var root = doc.documentElement;
  var LM = window.LM;

  // Si main.js no llego a cargar (o algo fallo antes), no hacemos nada raro:
  // el sitio se queda como estaba.
  if (!LM) { root.classList.remove('intro-locked'); root.classList.add('intro-done'); return; }

  var intro = doc.getElementById('intro');
  var btnEnter = doc.getElementById('introEnter');
  var btnSkip = doc.getElementById('introSkip');
  var box = doc.getElementById('preloader');
  var SFX = LM.SFX, MUSIC = LM.MUSIC;

  /* ------------------------------------------------------------------
     0. Decidir si toca intro
     ------------------------------------------------------------------ */
  var KEY = 'lm-intro-seen';
  var REDUCED = false;
  try { REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  function yaLaVisto() {
    try { return sessionStorage.getItem(KEY) === '1'; } catch (e) { return true; }
  }
  function marcarVista() {
    try { sessionStorage.setItem(KEY, '1'); } catch (e) {}
  }

  // Si ya la vio en esta sesion, o pide menos movimiento, directo al sitio.
  if (!intro || REDUCED || yaLaVisto()) {
    root.classList.remove('intro-locked');
    root.classList.add('intro-done');
    return;
  }

  /* ------------------------------------------------------------------
     1. Leer la configuracion desde el CSS
     Asi las duraciones viven en un solo sitio (intro.css) y el JS se
     ajusta solo si las cambias ahi.
     ------------------------------------------------------------------ */
  var cs = window.getComputedStyle(intro);

  // "1500ms" | "1.5s" | "1500"  ->  milisegundos (number)
  function ms(nombre, porDefecto) {
    var v = cs.getPropertyValue(nombre);
    if (!v) return porDefecto;
    v = v.trim();
    var n = parseFloat(v);
    if (isNaN(n)) return porDefecto;
    return /ms$/.test(v) ? n : (/%$/.test(v) ? porDefecto : n * 1000);
  }
  function entero(nombre, porDefecto) {
    var n = parseInt(cs.getPropertyValue(nombre), 10);
    return isNaN(n) ? porDefecto : n;
  }

  var T1 = ms('--in-t1', 1500);   // fase 1: camara quieta a ras de suelo
  var T2 = ms('--in-t2', 2500);   // fase 2: la subida (dura el viento)
  var T3 = ms('--in-t3', 1000);   // fase 3: fundido hacia la pagina
  var N_CLOUDS_FAR  = entero('--in-cloud-far', 9);
  var N_CLOUDS_NEAR = entero('--in-cloud-near', 6);
  var N_ARBOLES     = entero('--in-tree-count', 7);

  /* ------------------------------------------------------------------
     2. Montar el decorado: arboles y nubes
     Las nubes son un <span> blanco con varios cuadrados en box-shadow
     (un solo nodo por nube: es lo mas barato que hay).
     ------------------------------------------------------------------ */
  function rnd(a, b) { return a + Math.random() * (b - a); }

  // Los arboles y las nubes se achican en pantallas angostas y se reparten
  // por franjas (no al azar puro), que si no se amontonan y se pisan entre si.
  // La cantidad y el tamano base salen de --in-tree-count / --in-cloud-* de intro.css.
  function escalaPantalla() {
    return Math.min(1, Math.max(0.5, (window.innerWidth || 1000) / 1100));
  }
  // reparte n elementos de 0 a 118% con un poco de desvio, para que ninguno
  // caiga en el mismo sitio que el vecino
  function repartir(i, n) {
    return ((i + rnd(-0.34, 0.34)) / n) * 118 - 9;
  }

  function nube(escala, i, n) {
    var e = doc.createElement('span');
    e.className = 'intro__puff';
    var w = Math.round(rnd(90, 230) * escala);
    var h = Math.round(rnd(26, 42) * escala);
    e.style.setProperty('--pw', w + 'px');
    e.style.setProperty('--ph', h + 'px');
    e.style.left = repartir(i, n) + '%';
    e.style.top  = (rnd(0, 100)) + '%';

    // bloques extra para que la nube tenga forma y no sea un rectangulo liso
    var sombra = [], k = 2 + Math.floor(Math.random() * 3), j, dx, dy;
    for (j = 0; j < k; j++) {
      dx = Math.round((w * 0.5 + Math.random() * w * 0.85) * (Math.random() < 0.5 ? -1 : 1));
      dy = Math.round(-Math.random() * h * 0.65);
      sombra.push(dx + 'px ' + dy + 'px 0 ' + Math.round(h * 0.2) + 'px rgba(255,255,255,.96)');
    }
    e.style.boxShadow = sombra.join(', ');
    return e;
  }

  function arbol(i, n) {
    var e = doc.createElement('div');
    e.className = 'intro__tree';
    var tw = Math.round(rnd(54, 110) * escalaPantalla());
    e.style.setProperty('--tw', tw + 'px');
    e.style.setProperty('--th', Math.round(tw * rnd(1.7, 2.6)) + 'px');
    e.style.left = repartir(i, n) + '%';
    // se anaden copa -> tronco para que el tronco quede delante
    var copa = doc.createElement('i'); copa.className = 'leaves';
    var tronco = doc.createElement('i'); tronco.className = 'trunk';
    e.appendChild(copa);
    e.appendChild(tronco);
    return e;
  }

  (function montar() {
    var f = doc.getElementById('introCloudsFar'), n = doc.getElementById('introCloudsNear');
    var a = doc.getElementById('introTrees');
    var esc = escalaPantalla(), escNube, i, total;
    // las nubes encogen menos que los arboles: en un movil una nube ya chica
    // se pierde, asi que no bajan del 65% de su tamano
    escNube = 0.65 + 0.35 * esc;
    if (f) for (i = 0; i < N_CLOUDS_FAR; i++)  f.appendChild(nube(0.6 * escNube, i, N_CLOUDS_FAR));
    if (n) for (i = 0; i < N_CLOUDS_NEAR; i++) n.appendChild(nube(escNube, i, N_CLOUDS_NEAR));
    total = Math.max(2, Math.round(N_ARBOLES * esc));
    if (a) for (i = 0; i < total; i++) a.appendChild(arbol(i, total));
  })();

  /* ------------------------------------------------------------------
     3. El viento de la subida (procedural, sin archivos)
     Ruido blanco -> bandpass que sube de 260 a 3600 Hz (da la sensacion de
     aire que se hace agudo) + una capa lowpass de 150 Hz para el cuerpo
     grave. La envolvente sigue la velocidad de la camara: sube suave,
     llega al punto de mas velocidad y se va con el ease-out hasta 0.
     Devuelve null si el visitante tiene el sonido apagado.
     ------------------------------------------------------------------ */
  function suave(t) { return t * t * (3 - 2 * t); }   // smoothstep

  function playWindRise(duration) {
    if (!SFX || !SFX.enabled) return null;   // muted: la intro va igual, sin audio
    var c = SFX.context();
    if (!c) return null;
    if (c.state === 'suspended') c.resume();

    var sr = c.sampleRate;
    var dur = Math.max(0.2, duration / 1000);
    var pico = 0.3;                                   // gain maximo (0.25-0.35)

    // --- ruido blanco: un par de segundos de numeros aleatorios ---
    var seg = Math.min(2, Math.max(0.8, dur));
    var buf = c.createBuffer(1, Math.floor(sr * seg), sr);
    var ch = buf.getChannelData(0), i;
    for (i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;

    var t0 = c.currentTime + 0.03;
    var bus = SFX.bus() || c.destination;

    // Una sola salida con la queFadeamos al cortar: los gains de cada capa
    // llevan una curva y no se pueden interrumpir a mitad.
    var gOut = c.createGain();
    gOut.gain.value = 1;
    gOut.connect(bus);

    // envolvente: entra suave, tope al 72%, y sale con ease-out hasta 0
    var N = 160, curva = new Float32Array(N), k, t, v;
    for (k = 0; k < N; k++) {
      t = k / (N - 1);
      v = (t < 0.72) ? suave(t / 0.72) : 1 - suave((t - 0.72) / 0.28);
      curva[k] = v * v * pico;              // al cuadrado: entra y sale mas suave
    }

    function capa(tipo, freq, Q, f0, f1, vol, pan0, pan1) {
      var src = c.createBufferSource();
      src.buffer = buf;
      src.loop = true;

      var flt = c.createBiquadFilter();
      flt.type = tipo;
      flt.Q.value = Q;
      if (f1 > 0) {
        // ramp exponencial: el tono se hace mas agudo a medida que sube
        flt.frequency.setValueAtTime(f0, t0);
        flt.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
      } else {
        flt.frequency.value = f0;
      }

      var g = c.createGain();
      var cur = new Float32Array(N);
      for (var j = 0; j < N; j++) cur[j] = curva[j] * vol;
      g.gain.setValueCurveAtTime(cur, t0, dur);

      var pan = null;
      if (c.createStereoPanner) {
        pan = c.createStereoPanner();
        pan.pan.setValueAtTime(pan0, t0);
        pan.pan.linearRampToValueAtTime(pan1, t0 + dur);
      }

      src.connect(flt); flt.connect(g);
      if (pan) { g.connect(pan); pan.connect(gOut); } else { g.connect(gOut); }
      src.start(t0);
      return src;
    }

    // silbido agudo que barre de abajo hacia arriba
    var srcA = capa('bandpass', 0, 0.9, 260, 3600, 1, -0.4, 0.4);
    // cuerpo grave: lo que se siente en el pecho los primeros instantes
    var srcB = capa('lowpass', 150, 0.8, 150, 0, 0.55, 0.35, -0.35);

    return { ctx: c, out: gOut, srcA: srcA, srcB: srcB };
  }

  var viento = null;

  function pararViento() {
    if (!viento) return;
    var c = viento.ctx, ahora = c.currentTime;
    try {
      // un soplido corto hacia 0 y luego se cortan los dosources
      viento.out.gain.cancelScheduledValues(ahora);
      viento.out.gain.setValueAtTime(viento.out.gain.value, ahora);
      viento.out.gain.linearRampToValueAtTime(0, ahora + 0.35);
      viento.srcA.stop(ahora + 0.45);
      viento.srcB.stop(ahora + 0.45);
    } catch (e) {}
    viento = null;
    if (MUSIC && MUSIC.duck) MUSIC.duck(false);
  }

  /* ------------------------------------------------------------------
     4. El puente con el preloader
     main.js llama a LM.holdPreloader(finish) en vez de terminar solo.
     Guardamos la funcion para llamarla cuando la intro haya pasado.
     ------------------------------------------------------------------ */
  var finishReal = null, retenido = false, muerto = false, finTimer = null;

  LM.holdPreloader = function (finish) {
    if (!retenido) {
      retenido = true;
      finishReal = finish;
      if (box) {
        box.classList.add('can-enter');
        // "Cargando 100%" al lado de un boton queda raro: ya no esta cargando
        var t = box.querySelector('.preloader__title');
        if (t) t.textContent = 'Todo listo';
      }
    }
  };

  /* ------------------------------------------------------------------
     5. Revelar el sitio
     Orden importante: primero se destraba el html, despues se llama al
     finish real (que es el que lanza startReveal). Asi los .reveal del hero
     arrancan con su transicion y no aparecen de golpe. El setTimeout de
     seguridad de main.js (6 s) puede haberlos marcado antes, por eso se
     les quita la clase "in" justo antes.
     ------------------------------------------------------------------ */
  function revelar() {
    if (muerto) return;
    muerto = true;
    if (finTimer) { clearTimeout(finTimer); finTimer = null; }
    pararViento();
    if (intro) intro.parentNode && intro.parentNode.removeChild(intro);

    root.classList.remove('intro-locked');
    root.classList.add('intro-done');

    // limpia marcas previas del reveal (por el salvavidas de main.js)
    var rs = document.querySelectorAll('.reveal.in'), i;
    for (i = 0; i < rs.length; i++) rs[i].classList.remove('in');

    // Cierra el puente ANTES de llamar a finish(): si no, finish() volveria a
    // entrar por su propia puerta (vease LM.holdPreloader), se quedaria
    // Asking forever y la pagina se quedaria sin poder hacer scroll.
    LM.holdPreloader = null;

    if (finishReal) finishReal();      // preloader fuera + startReveal()
    else LM.startReveal();

    // red de seguridad: el scroll tiene que quedar libre pase lo que pase
    if (document.body.style.overflow === 'hidden') document.body.style.overflow = '';
  }

  /* ------------------------------------------------------------------
     6. Correr la intro
     ------------------------------------------------------------------ */
  function correr() {
    intro.classList.add('is-on');

    // el preloader se apaga de una: la intro va por encima
    if (box) {
      box.classList.add('is-done');
      setTimeout(function () { if (box.parentNode) box.parentNode.removeChild(box); }, 900);
    }

    // fase 1: la camara esta quieta en el piso, no suena nada todavia
    // fase 2: arranca el viento justo cuando arranca la subida
    setTimeout(function () {
      if (muerto) return;
      viento = playWindRise(T2);
      if (viento && MUSIC && MUSIC.duck) MUSIC.duck(true);
    }, T1);

    // fase 3: el viento se apaga y la intro se desvanece
    finTimer = setTimeout(function () {
      if (muerto) return;
      pararViento();
      intro.classList.add('is-out');
      setTimeout(revelar, T3);
    }, T1 + T2);
  }

  /* ------------------------------------------------------------------
     7. Botones
     ------------------------------------------------------------------ */
  function entrar() {
    if (btnEnter) btnEnter.disabled = true;
    marcarVista();                 // si recarga durante la intro, no la repite

    // el clic es el gesto que autoriza el audio: reanudar el contexto,
    // encender la musica y tirar el viento
    SFX.unlock();
    if (SFX.enabled) {
      MUSIC.want(true);
      MUSIC.unlock();
    }

    try { correr(); }
    catch (e) { revelar(); }       // si algo falla, el sitio entra igual
  }

  function saltar() {
    if (muerto) return;
    if (btnSkip) btnSkip.disabled = true;
    if (intro) intro.classList.add('is-skipped');
    revelar();
  }

  if (btnEnter) btnEnter.addEventListener('click', entrar);
  if (btnSkip) btnSkip.addEventListener('click', saltar);
  doc.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !muerto) saltar();
  });

  // Red de seguridad: si el visitante nunca pulsa nada, tras un rato el
  // sitio se destraba igual. Nunca dejar la pagina en negro.
  setTimeout(function () { if (!retenido) revelar(); }, 60000);

  if (btnEnter) btnEnter.focus({ preventScroll: true });
})();
