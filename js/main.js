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
  var videos = document.querySelectorAll('video');
  if (!rm && 'IntersectionObserver' in window) {
    videos.forEach(function (v) {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          if (e.isIntersecting) { var p = v.play(); if (p && p.catch) p.catch(function () {}); }
          else v.pause();
        });
      }, { rootMargin: '120px' });
      io.observe(v);
    });
  }

  /* ---------- navigation : transparente sur le hero, noire ensuite ---------- */
  var nav = document.querySelector('.nav');
  var hero = document.querySelector('.hero');
  /* Sur bureau la nav reste transparente tant que le hero est à l'écran ;
     sur mobile elle devient noire dès qu'on quitte le haut de page, pour ne pas flotter sur le texte. */
  function navSeuil() { return desk.matches ? hero.offsetHeight - 100 : 40; }
  function navState() {
    if (!nav || !hero) return;
    nav.classList.toggle('nav--top', (capture ? captureY : window.scrollY) < navSeuil());
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
    var weekend = /^(ven|sam)/.test(wd);
    var close = weekend ? 24 * 60 : 22 * 60;
    var open = t >= 11 * 60 && t < close;
    if (el) el.textContent = open ? 'Ouvert. Le poulet est dans l’huile.' : 'Fermé. On rouvre à 11 h. Le poulet aussi.';
    if (court) court.textContent = open ? (weekend ? 'Ouvert jusqu’à minuit' : 'Ouvert jusqu’à 22 h') : 'Fermé, rouvre à 11 h';
  }
  etat();
  setInterval(etat, 60000);

  /* ---------- interactions sans animation (fonctionnent sans GSAP) ---------- */

  // La carte : la photo suit la référence survolée (bureau)
  var refs = Array.prototype.slice.call(document.querySelectorAll('.ref'));
  var stackImgs = Array.prototype.slice.call(document.querySelectorAll('.stack-img'));
  function setRef(id) {
    refs.forEach(function (r) { r.classList.toggle('is-active', r.getAttribute('data-ref') === id); });
    stackImgs.forEach(function (i) { i.classList.toggle('is-active', i.getAttribute('data-ref') === id); });
  }
  refs.forEach(function (r) {
    r.addEventListener('mouseenter', function () { setRef(r.getAttribute('data-ref')); });
  });

  // XL : standard ou doublé. Le chiffre roule de 12 à 17, et de 17 à 12 au retour.
  var xlBtns = Array.prototype.slice.call(document.querySelectorAll('.xl-btn'));
  var xlCount = document.querySelector('.xl-count');
  var xlTween = null;
  function setSize(size) {
    xlBtns.forEach(function (b) {
      var on = b.getAttribute('data-size') === size;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    Array.prototype.forEach.call(document.querySelectorAll('.xl-cap, .xl-fig'), function (e) {
      e.classList.toggle('is-on', e.getAttribute('data-size') === size);
    });
    var to = size === 'xl' ? 17 : 12;
    if (ok && !rm && xlCount) {
      if (xlTween) xlTween.kill();
      var o = { v: parseInt(xlCount.textContent, 10) || 12 };
      xlTween = gsap.to(o, { v: to, duration: .5, ease: 'power2.inOut', snap: { v: 1 }, onUpdate: function () { xlCount.textContent = Math.round(o.v); }, onComplete: function () { xlCount.textContent = to; } });
      gsap.fromTo('.xl-num', { scale: .96 }, { scale: 1, duration: .45, ease: 'back.out(3)', transformOrigin: 'left bottom' });
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

  // Six à huit petites miettes qui tombent du titre, une seule fois.
  function crumbs(anchor) {
    var box = document.querySelector('.miettes');
    if (!box || !anchor || !hero) return;
    var r = anchor.getBoundingClientRect(), hr = hero.getBoundingClientRect();
    var ox = r.left - hr.left + r.width * .62, oy = r.top - hr.top + r.height * .55;
    var n = 6 + Math.floor(Math.random() * 3);
    for (var i = 0; i < n; i++) {
      var d = document.createElement('span');
      d.className = 'miette';
      var s = 3 + Math.random() * 5;
      d.style.width = d.style.height = s + 'px';
      d.style.left = ox + 'px';
      d.style.top = oy + 'px';
      box.appendChild(d);
      var a = (-130 + Math.random() * 170) * Math.PI / 180;
      var dist = 40 + Math.random() * 120;
      var dur = .9 + Math.random() * .6;
      gsap.to(d, { x: Math.cos(a) * dist, duration: dur, ease: 'power2.out' });
      gsap.to(d, { y: Math.sin(a) * dist * .6 + 140, duration: dur, ease: 'power1.in' });
      gsap.to(d, { opacity: 0, rotation: 60 + Math.random() * 120, duration: dur, ease: 'power1.in', onComplete: (function (el) { return function () { el.remove(); }; })(d) });
    }
  }

  if (!rm && logo && line) {
    gsap.set(logo, { autoAlpha: 0, scale: .9, transformOrigin: 'left center' });
    gsap.set(line, { autoAlpha: 0, yPercent: 30 });
    gsap.set([sub, prix, cta, hint].filter(Boolean), { autoAlpha: 0, y: 14 });
    html.classList.add('ready');
    gsap.timeline({ defaults: { ease: 'power3.out' }, delay: .15 })
      .to(logo, { autoAlpha: 1, scale: 1, duration: .7, ease: 'back.out(1.4)' })
      .to(line, { autoAlpha: 1, yPercent: 0, duration: .7 }, '-=.3')
      .add(function () { crumbs(line); }, '-=.2')
      .to([sub, prix].filter(Boolean), { autoAlpha: 1, y: 0, duration: .55, stagger: .1 }, '-=.3')
      .to([cta, hint].filter(Boolean), { autoAlpha: 1, y: 0, duration: .5, stagger: .1 }, '-=.3');
  } else {
    html.classList.add('ready');
  }

  if (rm || !st) return;

  /* ---------- le texte du hero glisse légèrement plus lentement que la vidéo (bureau) ---------- */
  var mm = gsap.matchMedia();
  mm.add('(min-width: 960px)', function () {
    gsap.to('.hero-copy', { y: 60, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
  });

  /* ---------- titres : ils montent d'une ligne clippée ---------- */
  gsap.utils.toArray('.t-sec').forEach(function (t) {
    var inner = document.createElement('span');
    inner.className = 't-in';
    while (t.firstChild) inner.appendChild(t.firstChild);
    t.appendChild(inner);
    t.classList.add('t-clip');
    gsap.from(inner, { yPercent: 105, duration: .8, ease: 'power4.out', scrollTrigger: { trigger: t, start: 'top 88%', once: true } });
  });

  /* ---------- compteurs ---------- */
  gsap.utils.toArray('.count').forEach(function (el) {
    var to = parseFloat(el.getAttribute('data-to'));
    if (isNaN(to)) return;
    if (to === 0) {
      gsap.from(el, { scale: 1.3, autoAlpha: 0, duration: .6, ease: 'back.out(2)', transformOrigin: 'left bottom', scrollTrigger: { trigger: el, start: 'top 85%', once: true } });
      return;
    }
    var o = { v: 0 };
    gsap.to(o, {
      v: to, duration: 1.3, ease: 'power3.out', snap: { v: 1 },
      onStart: function () { el.textContent = '0'; },
      onUpdate: function () { el.textContent = Math.round(o.v); },
      scrollTrigger: { trigger: el, start: 'top 85%', once: true }
    });
  });

  /* ---------- la carte : la photo suit le défilement (bureau) ---------- */
  refs.forEach(function (r) {
    ScrollTrigger.create({
      trigger: r, start: 'top 55%', end: 'bottom 55%',
      onToggle: function (s) { if (s.isActive && desk.matches) setRef(r.getAttribute('data-ref')); }
    });
  });

  /* ---------- « Crac. » : le mot se fend ---------- */
  var cl = document.querySelector('.crac-l'), cr = document.querySelector('.crac-r');
  if (cl && cr) {
    gsap.timeline({ scrollTrigger: { trigger: '.crac', start: 'top 78%', once: true } })
      .from('.crac', { scale: 1.08, transformOrigin: 'left center', duration: .32, ease: 'power4.in' })
      .to(cl, { x: -5, y: -5, rotation: -2, duration: .6, ease: 'elastic.out(1,.45)' }, '-=.02')
      .to(cr, { x: 8, y: 6, rotation: 1.5, duration: .6, ease: 'elastic.out(1,.45)' }, '<')
      .from('.crac-line', { autoAlpha: 0, x: -18, duration: .5 }, '-=.35');
  }

  /* ---------- ce qu'il y a dedans : ligne par ligne ---------- */
  var lis = document.querySelectorAll('.ingr li');
  Array.prototype.forEach.call(lis, function (li) {
    var s = document.createElement('span');
    s.textContent = li.textContent;
    li.textContent = '';
    li.appendChild(s);
  });
  if (lis.length) gsap.from('.ingr li span', { yPercent: 110, duration: .7, stagger: .09, ease: 'power4.out', scrollTrigger: { trigger: '.ingr', start: 'top 85%', once: true } });

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
