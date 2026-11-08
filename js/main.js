/* ============================================================
   CROUSTY LAB — animations et interactions
   Règles : rien n'est caché si le script ne tourne pas,
   et tout reste lisible si l'utilisateur refuse le mouvement.
   ============================================================ */
(function () {
  'use strict';

  var html = document.documentElement;
  var rm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var ok = typeof gsap !== 'undefined';
  var st = ok && typeof ScrollTrigger !== 'undefined';
  var capture = /[?&]capture/.test(location.search);
  var captureY = capture ? (parseInt((location.search.match(/[?&]y=(\d+)/) || [])[1], 10) || 0) : 0;
  var desk = window.matchMedia('(min-width: 960px)');

  if (st) gsap.registerPlugin(ScrollTrigger);
  if (capture) { html.classList.add('capture'); if (ok) gsap.globalTimeline.timeScale(25); }

  /* ---------- vidéos : on ne lance que si le mouvement est accepté, et seulement à l'écran ---------- */
  /* iPhone : la vidéo doit être muette et « inline » AVANT play(). Si l'autoplay est refusé
     (mode économie d'énergie, aperçu dans une iframe), le poster reste affiché et on relance
     la lecture au premier geste de l'utilisateur. */
  var videos = Array.prototype.slice.call(document.querySelectorAll('video'));
  var visibles = [];
  function jouer(v) {
    if (v.dataset.arret) return; // mis en pause par le visiteur : on ne relance pas
    v.muted = true; v.defaultMuted = true; v.playsInline = true;
    v.setAttribute('muted', ''); v.setAttribute('playsinline', '');
    var p = v.play();
    if (p && p.catch) p.catch(function () { attendreGeste(); });
  }
  var enAttente = false;
  function attendreGeste() {
    if (enAttente) return; enAttente = true;
    var relance = function () {
      enAttente = false;
      ['touchstart', 'pointerdown', 'scroll', 'keydown'].forEach(function (t) { window.removeEventListener(t, relance, true); });
      visibles.forEach(jouer);
    };
    ['touchstart', 'pointerdown', 'scroll', 'keydown'].forEach(function (t) { window.addEventListener(t, relance, { capture: true, passive: true }); });
  }
  if (rm) {
    videos.forEach(function (v) { v.removeAttribute('autoplay'); v.pause(); });
  } else if ('IntersectionObserver' in window) {
    videos.forEach(function (v) {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          var i = visibles.indexOf(v);
          if (e.isIntersecting) { if (i < 0) visibles.push(v); jouer(v); }
          else { if (i >= 0) visibles.splice(i, 1); v.pause(); }
        });
      }, { rootMargin: '120px 0px', threshold: 0 });
      io.observe(v);
    });
  } else {
    videos.forEach(jouer);
  }

  /* ---------- accueil : affiche verticale sur téléphone, et bouton pause ---------- */
  var heroVideo = document.querySelector('.hero-video');
  if (heroVideo && heroVideo.dataset.posterMobile && window.matchMedia('(max-width: 767px)').matches) heroVideo.poster = heroVideo.dataset.posterMobile;
  var pauseBtn = document.querySelector('.hero-pause');
  if (pauseBtn && heroVideo) {
    pauseBtn.addEventListener('click', function () {
      var enPause = pauseBtn.getAttribute('aria-pressed') === 'true';
      if (enPause) { delete heroVideo.dataset.arret; jouer(heroVideo); }
      else { heroVideo.dataset.arret = '1'; heroVideo.pause(); }
      pauseBtn.setAttribute('aria-pressed', enPause ? 'false' : 'true');
      pauseBtn.setAttribute('aria-label', enPause ? 'Mettre la vidéo en pause' : 'Relancer la vidéo');
    });
  }

  /* ---------- navigation : transparente sur l'accueil, barre blanche ensuite ---------- */
  var nav = document.querySelector('.nav');
  var hero = document.querySelector('.hero');
  /* Sur bureau la nav reste transparente tant que le hero est à l'écran ;
     sur mobile elle se pose sur du blanc dès qu'on quitte le haut de page, pour ne pas flotter sur le texte. */
  function navSeuil() { return desk.matches ? hero.offsetHeight - 100 : 40; }
  function navState() {
    if (!nav || !hero) return;
    nav.classList.toggle('nav--top', (capture && captureY ? captureY : window.scrollY) < navSeuil());
  }
  navState();
  window.addEventListener('scroll', navState, { passive: true });
  window.addEventListener('resize', navState);

  /* ---------- horaires : ouvert ou fermé, heure de Genève ---------- */
  function etat() {
    var el = document.querySelector('[data-etat]');
    var court = document.querySelector('[data-etat-court]');
    if (!el && !court) return;
    var parts;
    try {
      parts = new Intl.DateTimeFormat('fr-CH', { timeZone: 'Europe/Zurich', weekday: 'short', hour: 'numeric', minute: 'numeric', hour12: false }).formatToParts(new Date());
    } catch (e) { return; }
    function get(t) { var p = parts.filter(function (x) { return x.type === t; })[0]; return p ? p.value : ''; }
    var wd = get('weekday').toLowerCase();
    var h = parseInt(get('hour'), 10) % 24, m = parseInt(get('minute'), 10) || 0;
    var t = h * 60 + m;
    // Lundi à vendredi : 11h à 14h30 et 18h à 22h. Samedi et dimanche : 12h à 21h.
    var jours = ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'];
    var idx = jours.indexOf(wd.slice(0, 3));
    if (idx < 0) return;
    function creneaux(i) { return i >= 5 ? [[12 * 60, 21 * 60]] : [[11 * 60, 14 * 60 + 30], [18 * 60, 22 * 60]]; }
    function heure(min) { var hh = Math.floor(min / 60), mm = min % 60; return hh + 'h' + (mm ? String(mm).padStart(2, '0') : ''); }
    var ouvert = null, prochain = null;
    creneaux(idx).forEach(function (c) {
      if (t >= c[0] && t < c[1]) ouvert = c;
      else if (t < c[0] && !prochain) prochain = { jour: 0, debut: c[0] };
    });
    if (!ouvert && !prochain) prochain = { jour: 1, debut: creneaux((idx + 1) % 7)[0][0] };
    var debut = prochain ? (prochain.debut === 12 * 60 ? 'midi' : heure(prochain.debut)) : '';
    var quand = prochain ? (prochain.jour ? 'demain à ' : 'à ') + debut : '';
    if (el) el.textContent = ouvert ? 'Ouvert. Le poulet est dans l’huile.' : 'Fermé. On rouvre ' + quand + '.';
    if (court) court.textContent = ouvert ? 'Ouvert jusqu’à ' + heure(ouvert[1]) : 'Fermé, rouvre ' + quand;
  }
  etat();
  setInterval(etat, 60000);

  /* ---------- interactions sans animation (fonctionnent sans GSAP) ---------- */

  // La carte : la photo suit la recette qu'on lit. Au survol sur ordinateur, et au défilement partout :
  // la recette active est celle qui passe sous une ligne de lecture (milieu de l'écran sur ordinateur,
  // milieu de l'espace laissé sous la photo collée sur téléphone).
  var refs = Array.prototype.slice.call(document.querySelectorAll('.ref'));
  var stackImgs = Array.prototype.slice.call(document.querySelectorAll('.stack-img'));
  var stackNum = document.querySelector('[data-num]');
  var carteSticky = document.querySelector('.carte-sticky');
  var refActive = '01';
  function setRef(id) {
    if (id === refActive) return;
    refActive = id;
    refs.forEach(function (r) { r.classList.toggle('is-active', r.getAttribute('data-ref') === id); });
    stackImgs.forEach(function (i) { i.classList.toggle('is-active', i.getAttribute('data-ref') === id); });
    if (stackNum) stackNum.textContent = id;
  }
  refs.forEach(function (r) {
    r.addEventListener('mouseenter', function () { if (desk.matches) setRef(r.getAttribute('data-ref')); });
  });
  // Les photos de la pile se chargent dès que la carte approche, pour que le changement soit instantané.
  if (carteSticky && 'IntersectionObserver' in window) {
    var pre = new IntersectionObserver(function (es) {
      if (es[0].isIntersecting) { stackImgs.forEach(function (i) { i.loading = 'eager'; }); pre.disconnect(); }
    }, { rootMargin: '800px 0px' });
    pre.observe(carteSticky);
  }
  function suivreCarte() {
    if (!refs.length || !carteSticky) return;
    var bas = carteSticky.getBoundingClientRect().bottom;
    var ligne = desk.matches ? window.innerHeight * 0.5 : bas + (window.innerHeight - bas) * 0.45;
    var choix = refs[0];
    refs.forEach(function (r) { if (r.getBoundingClientRect().top <= ligne) choix = r; });
    setRef(choix.getAttribute('data-ref'));
  }
  var attenteCarte = false;
  window.addEventListener('scroll', function () {
    if (!attenteCarte) { attenteCarte = true; requestAnimationFrame(function () { attenteCarte = false; suivreCarte(); }); }
  }, { passive: true });
  window.addEventListener('resize', suivreCarte);
  window.addEventListener('load', suivreCarte);

  // XL : standard ou doublé. Le chiffre roule de 12 à 17, et de 17 à 12 au retour.
  var xlBtns = Array.prototype.slice.call(document.querySelectorAll('.xl-btn'));
  var xlSwitch = document.querySelector('.xl-switch');
  var xlCount = document.querySelector('.xl-count');
  var xlTween = null;
  function setSize(size) {
    xlBtns.forEach(function (b) {
      var on = b.getAttribute('data-size') === size;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    if (xlSwitch) xlSwitch.classList.toggle('xl-actif', size === 'xl');
    Array.prototype.forEach.call(document.querySelectorAll('.xl-cap, .xl-fig'), function (e) {
      e.classList.toggle('is-on', e.getAttribute('data-size') === size);
    });
    var to = size === 'xl' ? 17 : 12;
    if (ok && !rm && xlCount) {
      if (xlTween) xlTween.kill();
      var o = { v: parseInt(xlCount.textContent, 10) || 12 };
      xlTween = gsap.to(o, { v: to, duration: .42, ease: 'power3.out', snap: { v: 1 }, onUpdate: function () { xlCount.textContent = Math.round(o.v); }, onComplete: function () { xlCount.textContent = to; } });
    } else if (xlCount) xlCount.textContent = to;
  }
  xlBtns.forEach(function (b) { b.addEventListener('click', function () { setSize(b.getAttribute('data-size')); }); });

  /* ---------- sans GSAP ou sans mouvement : on rend tout visible et on s'arrête là ---------- */
  if (!ok) { html.classList.add('ready'); return; }

  /* ---------- hero : le logo, puis le titre, puis le reste ---------- */
  var logo = document.querySelector('.hero-logo');
  var line = document.querySelector('.hero-line');
  var sub = document.querySelector('.hero-sub');
  var prix = document.querySelector('.hero-prix');
  var cta = document.querySelector('.hero-cta');
  var hint = document.querySelector('.hero-hint');

  if (!rm && logo && line) {
    gsap.set(logo, { autoAlpha: 0, scale: .94, transformOrigin: 'center' });
    gsap.set(line, { autoAlpha: 0, yPercent: 30 });
    var pause = document.querySelector('.hero-pause');
    gsap.set([sub, prix, cta, hint, pause].filter(Boolean), { autoAlpha: 0, y: 14 });
    html.classList.add('ready');
    gsap.timeline({ defaults: { ease: 'power3.out' }, delay: .15 })
      .to(logo, { autoAlpha: 1, scale: 1, duration: .7 })
      .to(line, { autoAlpha: 1, yPercent: 0, duration: .7 }, '-=.3')
      .to([sub, prix].filter(Boolean), { autoAlpha: 1, y: 0, duration: .55, stagger: .1 }, '-=.3')
      .to([cta, hint, pause].filter(Boolean), { autoAlpha: 1, y: 0, duration: .5, stagger: .1 }, '-=.3');
  } else {
    html.classList.add('ready');
  }

  if (rm || !st) return;

  /* ---------- le texte du hero glisse légèrement plus lentement que la vidéo (bureau) ---------- */
  var mm = gsap.matchMedia();
  mm.add('(min-width: 960px)', function () {
    gsap.to('.hero-copy', { y: 60, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
  });

  /* Deux moments de mouvement seulement : l'arrivée sur l'accueil, et « Crac. » qui se fend. */

  /* ---------- « Crac. » : le mot se fend ---------- */
  var cl = document.querySelector('.crac-l'), cr = document.querySelector('.crac-r');
  if (cl && cr) {
    gsap.timeline({ scrollTrigger: { trigger: '.crac', start: 'top 78%', once: true } })
      .to(cl, { y: -3, rotation: -1.2, duration: .7, ease: 'power3.out' })
      .to(cr, { x: 3, y: 3, rotation: .8, duration: .7, ease: 'power3.out' }, '<')
      .from('.crac-line', { autoAlpha: 0, y: 8, duration: .5, ease: 'power3.out' }, '-=.45');
  }

  /* Les images et le plan se chargent après coup : on recalcule les déclencheurs une fois la page complète. */
  window.addEventListener('load', function () { ScrollTrigger.refresh(); });

  /* ---------- mode capture (contrôle visuel en headless) : ?capture=1&y=1800
     Chrome headless ne tient pas un vrai défilement : on décale la page d'une marge négative
     et on force chaque animation au scroll à son état final. ---------- */
  if (capture) {
    ScrollTrigger.getAll().forEach(function (t) {
      if (t.animation && !t.vars.scrub) t.animation.progress(1);
      t.kill(false);
    });
    document.body.style.marginTop = (-captureY) + 'px';
    navState();
  }
})();
