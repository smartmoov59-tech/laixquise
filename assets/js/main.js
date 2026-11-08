/* L'Aixquise — mouvement : GSAP + ScrollTrigger + Lenis
   Règles : transform/opacity en priorité, courbes douces (power3 / expo),
   version allégée si prefers-reduced-motion, pins désactivés sous 900px. */
(() => {
  'use strict';

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const hasG = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';
  const anim = hasG && !reduced;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const PHONE = '+33775208093';

  root.classList.add('js');
  if (hasG) gsap.registerPlugin(ScrollTrigger);
  if (!anim) root.classList.add('no-anim');

  /* ---------------------------------------------------------------- Lenis */
  let lenis = null;
  if (anim && typeof window.Lenis !== 'undefined') {
    lenis = new Lenis({
      duration: 1.15,
      easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      touchMultiplier: 1.4
    });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(t => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    lenis.stop();
  }
  const lockScroll = on => {
    if (lenis) on ? lenis.stop() : lenis.start();
    else document.body.style.overflow = on ? 'hidden' : '';
  };
  const scrollToEl = target => {
    if (lenis) lenis.scrollTo(target, { offset: -4, duration: 1.7, easing: t => 1 - Math.pow(1 - t, 4) });
    else target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
  };

  /* ------------------------------------------------------- Texte découpé */
  function splitText(el, mode) {
    const label = el.textContent.replace(/\s+/g, ' ').trim();
    el.setAttribute('aria-label', label);
    const build = node => {
      const out = document.createDocumentFragment();
      node.childNodes.forEach(n => {
        if (n.nodeType === 3) {
          const txt = n.textContent;
          // pas de retour à la ligne entre un mot stylé (<em>) et la ponctuation collée
          if (n.previousSibling && n.previousSibling.nodeType === 1 && /^\S/.test(txt)) out.appendChild(document.createTextNode('⁠'));
          n.textContent.split(/(\s+)/).forEach(p => {
            if (!p) return;
            if (/^\s+$/.test(p)) { out.appendChild(document.createTextNode(' ')); return; }
            const w = document.createElement('span');
            w.className = 'sw';
            w.setAttribute('aria-hidden', 'true');
            const wi = document.createElement('span');
            wi.className = 'swi';
            if (mode === 'chars') {
              Array.from(p).forEach(ch => {
                const c = document.createElement('span');
                c.className = 'sc';
                c.textContent = ch;
                wi.appendChild(c);
              });
              wi.classList.remove('swi');
            } else wi.textContent = p;
            w.appendChild(wi);
            out.appendChild(w);
          });
          if (n.nextSibling && n.nextSibling.nodeType === 1 && /\S$/.test(txt)) out.appendChild(document.createTextNode('⁠'));
        } else if (n.nodeType === 1) {
          const c = n.cloneNode(false);
          c.appendChild(build(n));
          out.appendChild(c);
        }
      });
      return out;
    };
    const frag = build(el);
    el.textContent = '';
    el.appendChild(frag);
    return { words: $$('.swi', el), chars: $$('.sc', el) };
  }

  /* --------------------------------------------- Ouvert / fermé (Paris) */
  const DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  const OPEN = 9 * 60 + 30, CLOSE = 19 * 60;
  const isOpenDay = d => d >= 2 && d <= 6;
  function parisNow() {
    try {
      const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
      const wd = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[p.find(x => x.type === 'weekday').value];
      return { wd, min: +p.find(x => x.type === 'hour').value * 60 + +p.find(x => x.type === 'minute').value };
    } catch (e) {
      const d = new Date();
      return { wd: d.getDay(), min: d.getHours() * 60 + d.getMinutes() };
    }
  }
  function updateOpenStatus() {
    const { wd, min } = parisNow();
    let text, open = false;
    if (isOpenDay(wd) && min >= OPEN && min < CLOSE) { open = true; text = 'Ouvert · jusqu’à 19h'; }
    else if (isOpenDay(wd) && min < OPEN) text = 'Fermé · ouvre à 9h30';
    else {
      let n = 1;
      while (!isOpenDay((wd + n) % 7)) n++;
      const nd = (wd + n) % 7;
      text = 'Fermé · ouvre ' + (n === 1 ? 'demain' : DAYS[nd]) + ' à 9h30';
    }
    $$('[data-open-status]').forEach(el => { el.textContent = text; });
    $$('[data-open-dot]').forEach(el => el.classList.toggle('is-closed', !open));
    $$('#hours li').forEach(li => li.classList.toggle('is-today', +li.dataset.day === wd));
  }
  updateOpenStatus();
  setInterval(updateOpenStatus, 60000);

  /* ------------------------------------------------- Nav + menu mobile */
  const nav = $('#nav');
  const menu = $('#menu');
  const burger = $('.burger');
  let menuOpen = false;
  let navHidden = false;

  function openMenu() {
    if (menuOpen) return;
    menuOpen = true;
    menu.classList.add('is-open');
    menu.setAttribute('aria-hidden', 'false');
    burger.setAttribute('aria-expanded', 'true');
    burger.setAttribute('aria-label', 'Fermer le menu');
    lockScroll(true);
    nav.classList.add('is-solid');
    if (hasG) {
      gsap.killTweensOf('.menu__bg, .menu__links a span, .menu__foot');
      gsap.to('.menu__bg', { scaleY: 1, duration: reduced ? 0 : .9, ease: 'expo.inOut' });
      gsap.fromTo('.menu__links a span', { yPercent: 110 }, { yPercent: 0, duration: reduced ? 0 : 1.1, ease: 'expo.out', stagger: .06, delay: reduced ? 0 : .35 });
      gsap.fromTo('.menu__foot', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: reduced ? 0 : .8, delay: reduced ? 0 : .7 });
    }
    const first = $('.menu__links a');
    if (first) setTimeout(() => first.focus({ preventScroll: true }), 120);
  }
  function closeMenu() {
    if (!menuOpen) return;
    menuOpen = false;
    burger.setAttribute('aria-expanded', 'false');
    burger.setAttribute('aria-label', 'Ouvrir le menu');
    menu.setAttribute('aria-hidden', 'true');
    lockScroll(false);
    const done = () => { menu.classList.remove('is-open'); };
    if (hasG) {
      gsap.killTweensOf('.menu__bg, .menu__links a span, .menu__foot');
      gsap.to('.menu__links a span, .menu__foot', { opacity: 0, duration: reduced ? 0 : .3 });
      gsap.to('.menu__bg', { scaleY: 0, transformOrigin: '50% 100%', duration: reduced ? 0 : .7, ease: 'expo.inOut', onComplete: () => { gsap.set('.menu__bg', { transformOrigin: '50% 0%' }); gsap.set('.menu__links a span, .menu__foot', { opacity: 1 }); done(); } });
    } else done();
    onScrollNav();
  }
  if (hasG) gsap.set('.menu__bg', { scaleY: 0 });
  burger.addEventListener('click', () => (menuOpen ? closeMenu() : openMenu()));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeMenu(); closeLightbox(); } });

  const hero = $('.hero');
  let lastY = window.scrollY;
  function onScrollNav() {
    const y = window.scrollY;
    nav.classList.toggle('is-solid', menuOpen || y > (hero ? hero.offsetHeight - 120 : 400));
    if (menuOpen) { lastY = y; return; }
    if (y > lastY + 6 && y > 240 && !navHidden) {
      navHidden = true;
      hasG ? gsap.to(nav, { yPercent: -170, duration: .6, ease: 'power3.out', overwrite: 'auto' }) : (nav.style.transform = 'translateY(-170%)');
    } else if ((y < lastY - 6 || y <= 240) && navHidden) {
      navHidden = false;
      hasG ? gsap.to(nav, { yPercent: 0, duration: .7, ease: 'power3.out', overwrite: 'auto' }) : (nav.style.transform = '');
    }
    lastY = y;
  }
  window.addEventListener('scroll', onScrollNav, { passive: true });
  onScrollNav();

  // ancres
  $$('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
    const id = a.getAttribute('href');
    if (!id || id.length < 2) return;
    const t = $(id);
    if (!t) return;
    e.preventDefault();
    if (menuOpen) { closeMenu(); setTimeout(() => scrollToEl(t), 380); } else scrollToEl(t);
  }));

  /* ------------------------------------------------------------- Vidéos */
  const saveData = navigator.connection && navigator.connection.saveData;
  $$('video').forEach(v => {
    if (reduced || saveData) { v.removeAttribute('autoplay'); v.pause(); return; }
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(es => es.forEach(en => {
        if (en.isIntersecting) { const p = v.play(); if (p && p.catch) p.catch(() => {}); } else v.pause();
      }), { threshold: .05 }).observe(v);
    }
  });

  /* ------------------------------------------------- Compositeur de RDV */
  const svc = $('#svc'), dateI = $('#date'), timeI = $('#time'), nameI = $('#name'), msgI = $('#msg');
  const preview = $('#preview'), hint = $('#hint'), smsA = $('#sms'), icsA = $('#ics');
  const pad = n => String(n).padStart(2, '0');
  const toISO = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  if (dateI) {
    dateI.min = toISO(new Date());
    for (let m = 9 * 60 + 30; m <= 18 * 60 + 30; m += 30) {
      const o = document.createElement('option');
      o.value = `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
      o.textContent = `${Math.floor(m / 60)}h${pad(m % 60)}`;
      timeI.appendChild(o);
    }
    const fmtDate = iso => {
      const [y, m, d] = iso.split('-').map(Number);
      return new Date(y, m - 1, d).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    };
    const buildText = () => {
      const s = svc.value, d = dateI.value, t = timeI.value, n = nameI.value.trim(), m = msgI.value.trim();
      let txt = 'Bonjour Anna, ' + (s ? `je souhaiterais prendre rendez-vous pour : ${s}.` : 'je souhaiterais prendre rendez-vous.');
      if (d) txt += ` Jour souhaité : ${fmtDate(d)}${t ? ' vers ' + t.replace(':', 'h') : ''}.`;
      else if (t) txt += ` Heure souhaitée : vers ${t.replace(':', 'h')}.`;
      if (m) txt += ' ' + m;
      txt += n ? ` Merci ! ${n}` : ' Merci !';
      return txt;
    };
    const refresh = () => {
      const txt = buildText();
      preview.textContent = txt;
      smsA.href = `sms:${PHONE}?&body=${encodeURIComponent(txt)}`;
      hint.classList.remove('is-warn');
      hint.textContent = '';
      if (dateI.value) {
        const [y, m, d] = dateI.value.split('-').map(Number);
        const wd = new Date(y, m - 1, d).getDay();
        if (!isOpenDay(wd)) {
          hint.classList.add('is-warn');
          hint.textContent = 'Le salon est fermé le dimanche et le lundi : choisis plutôt un jour du mardi au samedi.';
        }
      }
    };
    [svc, dateI, timeI, nameI, msgI].forEach(el => el.addEventListener('input', refresh));
    refresh();

    icsA.addEventListener('click', e => {
      if (!dateI.value) {
        e.preventDefault();
        hint.classList.add('is-warn');
        hint.textContent = 'Choisis d’abord un jour pour l’ajouter à ton agenda.';
        dateI.focus();
        return;
      }
      const [y, mo, d] = dateI.value.split('-').map(Number);
      const [hh, mm] = (timeI.value || '10:00').split(':').map(Number);
      const opt = svc.options[svc.selectedIndex];
      const dur = (opt && +opt.dataset.dur) || 60;
      const start = new Date(y, mo - 1, d, hh, mm);
      const end = new Date(start.getTime() + dur * 60000);
      const f = dt => `${dt.getFullYear()}${pad(dt.getMonth() + 1)}${pad(dt.getDate())}T${pad(dt.getHours())}${pad(dt.getMinutes())}00`;
      const esc = s => s.replace(/[\\;,]/g, c => '\\' + c).replace(/\n/g, '\\n');
      const lines = [
        'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//L Aixquise//Rendez-vous//FR', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT',
        `UID:${Date.now()}@laixquise`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '')}`,
        `DTSTART:${f(start)}`, `DTEND:${f(end)}`,
        `SUMMARY:${esc('L’Aixquise · ' + (svc.value || 'Rendez-vous') + ' (à confirmer)')}`,
        `LOCATION:${esc('L’Aixquise, 2 rue Pierre et Marie Curie, 13100 Aix-en-Provence')}`,
        `DESCRIPTION:${esc('Demande de rendez-vous à confirmer avec Anna au 07 75 20 80 93.')}`,
        'END:VEVENT', 'END:VCALENDAR'
      ];
      const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
      if (icsA.dataset.url) URL.revokeObjectURL(icsA.dataset.url);
      icsA.dataset.url = URL.createObjectURL(blob);
      icsA.href = icsA.dataset.url;
    });

    // boutons « Réserver » des cartes et de la carte tarifaire
    $$('[data-service]').forEach(b => b.addEventListener('click', () => {
      const name = b.dataset.service;
      const opt = Array.from(svc.options).find(o => o.text === name);
      if (opt) { svc.value = opt.value || opt.text; refresh(); }
      scrollToEl($('#reserver'));
      setTimeout(() => svc.focus({ preventScroll: true }), 900);
    }));
  }

  /* -------------------------------------------------------- Onglets carte */
  const tabs = $$('.tab');
  const pill = $('.tabs__pill');
  function movePill(animate) {
    const t = tabs.find(x => x.getAttribute('aria-selected') === 'true');
    if (!t || !pill) return;
    const props = { x: t.offsetLeft, width: t.offsetWidth };
    hasG ? gsap.to(pill, { ...props, duration: animate && !reduced ? .7 : 0, ease: 'expo.out' }) : Object.assign(pill.style, { transform: `translateX(${props.x}px)`, width: props.width + 'px' });
  }
  function selectTab(tab, focus) {
    tabs.forEach(t => {
      const on = t === tab;
      t.setAttribute('aria-selected', on);
      t.tabIndex = on ? 0 : -1;
      const p = $('#' + t.getAttribute('aria-controls'));
      p.hidden = !on;
      if (on && anim) gsap.fromTo($$('.row', p), { y: 28, opacity: 0 }, { y: 0, opacity: 1, duration: .9, ease: 'power3.out', stagger: .05, clearProps: 'transform,opacity' });
    });
    if (focus) tab.focus();
    movePill(true);
    if (hasG) setTimeout(() => ScrollTrigger.refresh(), 60);
  }
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => selectTab(t));
    t.addEventListener('keydown', e => {
      if (e.key === 'ArrowRight') { e.preventDefault(); selectTab(tabs[(i + 1) % tabs.length], true); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); selectTab(tabs[(i - 1 + tabs.length) % tabs.length], true); }
    });
  });
  window.addEventListener('resize', () => movePill(false));
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => movePill(false));
  movePill(false);

  /* ------------------------------------------------------------------ FAQ */
  $$('.faq details').forEach(d => {
    const s = $('summary', d), p = $('.faq__a', d);
    s.addEventListener('click', e => {
      if (!hasG || reduced) return;
      e.preventDefault();
      if (d.open) {
        gsap.to(p, { height: 0, opacity: 0, duration: .55, ease: 'power3.inOut', onComplete: () => { d.open = false; gsap.set(p, { clearProps: 'height,opacity' }); ScrollTrigger.refresh(); } });
      } else {
        d.open = true;
        gsap.fromTo(p, { height: 0, opacity: 0 }, { height: 'auto', opacity: 1, duration: .7, ease: 'power3.out', onComplete: () => { gsap.set(p, { clearProps: 'height' }); ScrollTrigger.refresh(); } });
      }
    });
  });

  /* ----------------------------------------------------------- Lightbox */
  const lb = $('#lightbox');
  const items = $$('.g');
  let cur = 0, lastFocus = null;
  function showLb(i) {
    cur = (i + items.length) % items.length;
    const it = items[cur];
    $('img', lb).src = it.dataset.full;
    $('img', lb).alt = $('img', it).alt;
    $('figcaption', lb).textContent = it.dataset.cap || '';
  }
  function openLightbox(i) {
    lastFocus = document.activeElement;
    showLb(i);
    lb.classList.add('is-open');
    lb.setAttribute('aria-hidden', 'false');
    lockScroll(true);
    hasG ? gsap.to(lb, { opacity: 1, duration: reduced ? 0 : .45 }) : (lb.style.opacity = 1);
    $('.lb-close', lb).focus();
  }
  function closeLightbox() {
    if (!lb.classList.contains('is-open')) return;
    const done = () => { lb.classList.remove('is-open'); lb.setAttribute('aria-hidden', 'true'); lockScroll(false); if (lastFocus) lastFocus.focus({ preventScroll: true }); };
    hasG ? gsap.to(lb, { opacity: 0, duration: reduced ? 0 : .3, onComplete: done }) : (lb.style.opacity = 0, done());
  }
  items.forEach((it, i) => it.addEventListener('click', () => openLightbox(i)));
  $('.lb-close', lb).addEventListener('click', closeLightbox);
  $('.lb-prev', lb).addEventListener('click', () => showLb(cur - 1));
  $('.lb-next', lb).addEventListener('click', () => showLb(cur + 1));
  lb.addEventListener('click', e => { if (e.target === lb) closeLightbox(); });
  document.addEventListener('keydown', e => {
    if (!lb.classList.contains('is-open')) return;
    if (e.key === 'ArrowLeft') showLb(cur - 1);
    if (e.key === 'ArrowRight') showLb(cur + 1);
  });

  /* ---------------------------------------------------- Carrousel d'avis */
  (function carousel() {
    const view = $('.carousel__view'), track = $('.carousel__track');
    if (!view || !track) return;
    const cards = $$('.rcard', track);
    const bar = $('.carousel__bar i');
    if (!hasG) { view.style.overflowX = 'auto'; $('.carousel__ctrl').style.display = 'none'; return; }
    let idx = 0, step = 300, maxIdx = 0, maxX = 0, timer = null, hovering = false, inView = true;
    const measure = () => {
      const gap = parseFloat(getComputedStyle(track).columnGap) || 24;
      step = cards[0].getBoundingClientRect().width + gap;
      maxX = Math.max(0, track.scrollWidth - view.clientWidth);
      maxIdx = Math.max(1, Math.ceil(maxX / step));
    };
    const go = (i, instant) => {
      idx = clamp(i, 0, maxIdx);
      gsap.to(track, { x: -Math.min(idx * step, maxX), duration: instant || reduced ? 0 : 1, ease: 'power3.out', overwrite: true });
      gsap.to(bar, { scaleX: (idx + 1) / (maxIdx + 1), duration: reduced ? 0 : .8, ease: 'power3.out' });
    };
    const play = () => {
      clearInterval(timer);
      if (reduced) return;
      timer = setInterval(() => { if (!hovering && inView && !document.hidden) go(idx >= maxIdx ? 0 : idx + 1); }, 5200);
    };
    $$('.carousel__btn').forEach(b => b.addEventListener('click', () => { go(idx + +b.dataset.dir); play(); }));
    view.addEventListener('mouseenter', () => { hovering = true; });
    view.addEventListener('mouseleave', () => { hovering = false; });
    if ('IntersectionObserver' in window) new IntersectionObserver(es => { inView = es[0].isIntersecting; }, { threshold: .2 }).observe(view);

    // glisser
    let down = false, sx = 0, sx0 = 0, lastX = 0, lastT = 0, vx = 0;
    view.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      down = true; sx = e.clientX; sx0 = gsap.getProperty(track, 'x'); lastX = e.clientX; lastT = performance.now(); vx = 0;
      view.classList.add('is-drag'); gsap.killTweensOf(track);
    });
    window.addEventListener('pointermove', e => {
      if (!down) return;
      const now = performance.now();
      vx = (e.clientX - lastX) / Math.max(1, now - lastT); lastX = e.clientX; lastT = now;
      let x = sx0 + (e.clientX - sx);
      if (x > 0) x *= .35;
      if (x < -maxX) x = -maxX + (x + maxX) * .35;
      gsap.set(track, { x });
    });
    const up = () => {
      if (!down) return;
      down = false; view.classList.remove('is-drag');
      const x = gsap.getProperty(track, 'x') + vx * 260;
      go(Math.round(-x / step)); play();
    };
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    view.addEventListener('dragstart', e => e.preventDefault());
    window.addEventListener('resize', () => { measure(); go(idx, true); });
    measure(); go(0, true); play();
  })();

  /* ====================================================== ANIMATIONS === */
  if (!anim) {
    // Version allégée : tout est visible, pas de loader, compteurs statiques
    root.classList.add('is-ready');
    return;
  }

  // états initiaux des titres
  const heroTitle = $('.hero__title');
  const heroSplit = splitText(heroTitle, 'chars');
  gsap.set(heroSplit.chars, { yPercent: 118 });
  const wordHeads = $$('[data-split="words"]').map(h => ({ h, words: splitText(h, 'words').words }));
  wordHeads.forEach(({ words }) => gsap.set(words, { yPercent: 115 }));
  const giant = $('.footer__giant');
  const giantChars = giant ? splitText(giant, 'chars').chars : [];
  giant && giant.setAttribute('aria-hidden', 'true');
  gsap.set(giantChars, { yPercent: 105 });

  // intro du hero (préparé, joué à la fin du loader)
  const heroTl = gsap.timeline({ paused: true, defaults: { ease: 'expo.out' } });
  heroTl
    .from('.hero__media', { scale: 1.25, duration: 2.6, ease: 'power3.out' }, 0)
    .to(heroSplit.chars, { yPercent: 0, duration: 1.5, stagger: .05 }, .1)
    .from('.hero .eyebrow', { y: 20, opacity: 0, duration: 1 }, .35)
    .from('.hero__lede, .hero__cta', { y: 34, opacity: 0, duration: 1.2, stagger: .14 }, .75)
    .from('.hero__meta .chip', { y: 22, opacity: 0, duration: 1, stagger: .12 }, .95)
    .from('.hero__almond', { scale: .15, opacity: 0, duration: 2, ease: 'expo.out' }, .45)
    .from('.hero__beads .bead', { scale: 0, opacity: 0, duration: 1.3, stagger: .09, ease: 'back.out(2)' }, .9)
    .from('#nav', { yPercent: -170, opacity: 0, duration: 1.1, ease: 'power3.out' }, 1.1);

  // loader
  const loader = $('.loader');
  const count = $('.loader__count');
  const state = { v: 0 };
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    loader.style.display = 'none';
    lenis && lenis.start();
    root.classList.add('is-ready');
    ScrollTrigger.sort();
    ScrollTrigger.refresh();
  };
  const loadTl = gsap.timeline({ onComplete: finish });
  loadTl
    .to(state, { v: 100, duration: 2.3, ease: 'power2.inOut', onUpdate: () => { count.textContent = pad(Math.round(state.v)); } }, 0)
    .to('.loader__fill', { y: -135, duration: 2.3, ease: 'power2.inOut' }, 0)
    .from('.loader__brand', { y: 24, opacity: 0, duration: 1, ease: 'power3.out' }, .2)
    .to('.loader__seam', { scaleX: 1, duration: .6, ease: 'expo.inOut' }, 2.35)
    .to('.loader__inner', { scale: .86, opacity: 0, duration: .6, ease: 'power3.in' }, 2.4)
    .to('.loader__count', { opacity: 0, duration: .4 }, 2.4)
    .to('.loader__half--top', { yPercent: -101, duration: 1.2, ease: 'expo.inOut' }, 2.8)
    .to('.loader__half--bot', { yPercent: 101, duration: 1.2, ease: 'expo.inOut' }, 2.8)
    .to('.loader__seam', { opacity: 0, duration: .3 }, 2.85)
    .add(() => heroTl.play(), 3.1);
  setTimeout(() => { loadTl.progress(1); heroTl.progress(1); finish(); }, 9000); // filet de sécurité

  /* ------------------------------------------------ progression + fab */
  gsap.to('.progress i', { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: .15 } });
  const fab = $('#fab');
  if (fab && getComputedStyle(fab).display !== 'none') {
    let past = false, inBook = false;
    const apply = () => gsap.to(fab, { autoAlpha: past && !inBook ? 1 : 0, y: past && !inBook ? 0 : 24, duration: .5, ease: 'power3.out', overwrite: 'auto' });
    gsap.set(fab, { autoAlpha: 0, y: 24 });
    ScrollTrigger.create({ trigger: '.hero', start: 'bottom 55%', onEnter: () => { past = true; apply(); }, onLeaveBack: () => { past = false; apply(); } });
    ScrollTrigger.create({ trigger: '#reserver', start: 'top 70%', end: 'bottom 30%', onToggle: s => { inBook = s.isActive; apply(); } });
  }

  /* ------------------------------------------------------ hero parallax */
  gsap.to('.hero__media', { yPercent: 14, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true } });
  gsap.to('.hero__inner', { yPercent: -12, opacity: 0, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom 35%', scrub: true } });
  $$('.hero [data-speed]').forEach(el => {
    gsap.to(el, { y: () => -parseFloat(el.dataset.speed) * window.innerHeight * .3, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true, invalidateOnRefresh: true } });
  });
  gsap.to('.hero__media video', { scale: 1.1, duration: 20, ease: 'sine.inOut', yoyo: true, repeat: -1 });
  if (fine) {
    const bx = gsap.quickTo('.hero__beads', 'x', { duration: 1.2, ease: 'power3' });
    const by = gsap.quickTo('.hero__beads', 'y', { duration: 1.2, ease: 'power3' });
    const ax = gsap.quickTo('.hero__almond .almond', 'x', { duration: 1.4, ease: 'power3' });
    const ay = gsap.quickTo('.hero__almond .almond', 'y', { duration: 1.4, ease: 'power3' });
    hero.addEventListener('pointermove', e => {
      const mx = e.clientX / window.innerWidth - .5, my = e.clientY / window.innerHeight - .5;
      bx(-mx * 50); by(-my * 30); ax(mx * 26); ay(my * 18);
    });
  }

  /* ----------------------------------------------------------- marquee */
  (function marquee() {
    const rows = $$('.marquee__row').map(el => ({ el, dir: +el.dataset.dir, x: 0, w: 0 }));
    if (!rows.length) return;
    const measure = () => rows.forEach((r, i) => { r.w = r.el.firstElementChild.getBoundingClientRect().width; if (i && !r.x) r.x = -r.w / 2; });
    measure();
    window.addEventListener('resize', measure);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
    let vel = 0, flip = 1, skew = 0;
    ScrollTrigger.create({ start: 0, end: 'max', onUpdate: s => { vel = s.getVelocity(); if (Math.abs(vel) > 40) flip = Math.sign(vel); } });
    gsap.ticker.add((t, dt) => {
      const d = Math.min(dt, 64) / 1000;
      vel *= .93;
      const speed = 70 + Math.min(Math.abs(vel) * .28, 900);
      skew += (clamp(vel / -260, -9, 9) - skew) * .1;
      rows.forEach(r => {
        if (!r.w) return;
        r.x += r.dir * flip * speed * d;
        if (r.x <= -r.w) r.x += r.w;
        if (r.x > 0) r.x -= r.w;
        gsap.set(r.el, { x: r.x, skewX: skew });
      });
    });
  })();

  /* ------------------------------------------- titres + révélations */
  wordHeads.forEach(({ h, words }) => {
    ScrollTrigger.create({ trigger: h, start: 'top 88%', once: true, onEnter: () => gsap.to(words, { yPercent: 0, duration: 1.3, ease: 'expo.out', stagger: .07 }) });
  });
  if (giantChars.length) ScrollTrigger.create({ trigger: giant, start: 'top 95%', once: true, onEnter: () => gsap.to(giantChars, { yPercent: 0, duration: 1.5, ease: 'expo.out', stagger: .06 }) });
  const fadeSel = 'main section:not(.hero) .eyebrow, .lede, .carte__note, .carte__photo, .story__quote, .way, .composer, .faq details, .info-block, .find__cta, .find__status, .stat, .score, .carousel__ctrl, .gallery__head .btn, .tabs';
  $$(fadeSel).forEach(el => {
    if (el.closest('.hero') || el.closest('.sig__track')) return;
    gsap.from(el, { y: 44, opacity: 0, duration: 1.2, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 92%', once: true } });
  });

  /* ------------------------------------------------ compteurs animés */
  $$('[data-count]').forEach(el => {
    const end = parseFloat(el.dataset.count), dec = parseInt(el.dataset.dec || '0', 10), o = { v: 0 };
    const fmt = v => v.toFixed(dec).replace('.', ',');
    el.textContent = fmt(0);
    ScrollTrigger.create({ trigger: el, start: 'top 90%', once: true, onEnter: () => gsap.to(o, { v: end, duration: 2.4, ease: 'power3.out', onUpdate: () => { el.textContent = fmt(o.v); } }) });
  });
  gsap.to('.stats__big', { yPercent: 25, rotate: 6, ease: 'none', scrollTrigger: { trigger: '.stats', start: 'top bottom', end: 'bottom top', scrub: true } });

  /* ---------------------------------------- galerie : rideaux + tilt */
  const origins = ['50% 0%', '0% 50%', '50% 100%', '100% 50%'];
  $$('.g').forEach((g, i) => {
    const cover = $('.g__cover', g), img = $('img', g);
    gsap.set(cover, { transformOrigin: origins[i % 4] });
    const horizontal = i % 4 === 1 || i % 4 === 3;
    gsap.timeline({ scrollTrigger: { trigger: g, start: 'top 90%', once: true } })
      .to(cover, { [horizontal ? 'scaleX' : 'scaleY']: 0, duration: 1.3, ease: 'expo.inOut', delay: (i % 3) * .1 }, 0)
      .from(img, { scale: 1.4, duration: 1.9, ease: 'expo.out', delay: (i % 3) * .1 }, 0);
    gsap.fromTo(img, { yPercent: -6 }, { yPercent: 6, ease: 'none', scrollTrigger: { trigger: g, start: 'top bottom', end: 'bottom top', scrub: true } });
    if (fine) {
      const rx = gsap.quickTo(g, 'rotationX', { duration: .6, ease: 'power3' }), ry = gsap.quickTo(g, 'rotationY', { duration: .6, ease: 'power3' });
      gsap.set(g, { transformPerspective: 900 });
      g.addEventListener('pointermove', e => {
        const r = g.getBoundingClientRect();
        ry(((e.clientX - r.left) / r.width - .5) * 9); rx(-((e.clientY - r.top) / r.height - .5) * 9);
      });
      g.addEventListener('pointerleave', () => { rx(0); ry(0); });
    }
  });

  /* ------------------------------ cartes signature : tilt + reflet */
  if (fine) $$('.card.tilt').forEach(card => {
    const fr = $('.card__frame', card), gl = $('.card__glare', card);
    gsap.set(fr, { transformPerspective: 900 });
    gsap.set(gl, { xPercent: -50, yPercent: -50 });
    const rx = gsap.quickTo(fr, 'rotationX', { duration: .6, ease: 'power3' }), ry = gsap.quickTo(fr, 'rotationY', { duration: .6, ease: 'power3' });
    const gx = gsap.quickTo(gl, 'x', { duration: .35, ease: 'power3' }), gy = gsap.quickTo(gl, 'y', { duration: .35, ease: 'power3' });
    fr.addEventListener('pointermove', e => {
      const r = fr.getBoundingClientRect(), px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      ry((px - .5) * 14); rx(-(py - .5) * 14); gx(px * r.width); gy(py * r.height);
    });
    fr.addEventListener('pointerleave', () => { rx(0); ry(0); });
  });

  /* -------------------------------------------- magnétisme + curseur */
  if (fine) {
    $$('.magnetic').forEach(el => {
      const inner = el.classList.contains('btn') ? el.firstElementChild : null;
      const xt = gsap.quickTo(el, 'x', { duration: .7, ease: 'power3' }), yt = gsap.quickTo(el, 'y', { duration: .7, ease: 'power3' });
      const ix = inner && gsap.quickTo(inner, 'x', { duration: .7, ease: 'power3' }), iy = inner && gsap.quickTo(inner, 'y', { duration: .7, ease: 'power3' });
      el.addEventListener('pointermove', e => {
        const r = el.getBoundingClientRect(), dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
        xt(dx * .25); yt(dy * .35);
        if (inner) { ix(dx * .1); iy(dy * .18); }
      });
      el.addEventListener('pointerleave', () => { xt(0); yt(0); if (inner) { ix(0); iy(0); } });
    });
    const cur = $('.cursor');
    const cx = gsap.quickTo(cur, 'x', { duration: .5, ease: 'power3' }), cy = gsap.quickTo(cur, 'y', { duration: .5, ease: 'power3' });
    window.addEventListener('pointermove', e => { cx(e.clientX); cy(e.clientY); cur.style.opacity = 1; }, { passive: true });
    document.addEventListener('mouseleave', () => { cur.style.opacity = 0; });
    document.addEventListener('pointerover', e => {
      const t = e.target.closest ? e.target.closest('a,button,.g,.swatch,summary,input,select,textarea,.carousel__view') : null;
      cur.classList.toggle('is-view', !!(t && t.classList.contains('g')));
      cur.classList.toggle('is-link', !!t && !t.classList.contains('g'));
    });
  }

  /* ---------------------------------------------- swatches (couleurs) */
  const tintEl = $('.colors__video');
  $$('.swatch').forEach(s => s.addEventListener('click', () => {
    const on = s.getAttribute('aria-pressed') === 'true';
    $$('.swatch').forEach(x => x.setAttribute('aria-pressed', 'false'));
    if (!on) s.setAttribute('aria-pressed', 'true');
    tintEl.style.setProperty('--tint', on ? 'rgba(37,20,15,.55)' : s.dataset.tint);
  }));
  tintEl.style.setProperty('--tint', 'rgba(37,20,15,.55)');

  /* =============================================== sections pinnées === */
  const mm = gsap.matchMedia();

  // Histoire : storytelling étape par étape
  mm.add('(min-width: 900px)', () => {
    const steps = $$('.story__step'), imgs = $$('.story__img');
    if (steps.length < 2) return;
    gsap.set(steps.slice(1), { autoAlpha: 0, yPercent: 14 });
    gsap.set(imgs.slice(1), { autoAlpha: 0 });
    gsap.set($$('img', $('.story__imgs')).slice(1), { scale: 1.2 });
    const tl = gsap.timeline({ defaults: { ease: 'power2.inOut' }, scrollTrigger: { trigger: '.story__pin', start: 'top top', end: '+=330%', scrub: .6, pin: true, anticipatePin: 1, refreshPriority: 3 } });
    steps.forEach((s, i) => {
      if (!i) return;
      const t = i * 1 - .1;
      tl.to(steps[i - 1], { autoAlpha: 0, yPercent: -14, duration: .55 }, t)
        .to(imgs[i - 1], { autoAlpha: 0, duration: .6 }, t + .1)
        .fromTo(steps[i], { autoAlpha: 0, yPercent: 14 }, { autoAlpha: 1, yPercent: 0, duration: .6 }, t + .3)
        .to(imgs[i], { autoAlpha: 1, duration: .6 }, t + .1)
        .to($('img', imgs[i]), { scale: 1, duration: 1, ease: 'power2.out' }, t + .1);
    });
    tl.to({}, { duration: .35 });
  });
  mm.add('(max-width: 899px)', () => {
    $$('.story__step').forEach(s => gsap.from(s, { y: 50, opacity: 0, duration: 1.1, ease: 'power3.out', scrollTrigger: { trigger: s, start: 'top 88%', once: true } }));
  });

  // Signatures : scroll horizontal piloté par le scroll vertical
  mm.add('(min-width: 900px)', () => {
    const sig = $('.sig'), track = $('.sig__track'), pin = $('.sig__pin'), prog = $('.sig__progress i');
    sig.classList.add('is-h');
    const dist = () => Math.max(0, track.scrollWidth - window.innerWidth + 40);
    const tween = gsap.to(track, {
      x: () => -dist(), ease: 'none',
      scrollTrigger: { trigger: pin, start: 'top top', end: () => '+=' + dist(), pin: true, scrub: .8, invalidateOnRefresh: true, anticipatePin: 1, refreshPriority: 2, onUpdate: s => gsap.set(prog, { scaleX: s.progress }) }
    });
    $$('.card', track).forEach(card => {
      gsap.fromTo($('img', card), { xPercent: -7 }, { xPercent: 7, ease: 'none', scrollTrigger: { trigger: card, containerAnimation: tween, start: 'left right', end: 'right left', scrub: true } });
      gsap.from($('.card__price', card), { scale: 0, rotate: -40, duration: 1, ease: 'back.out(2)', scrollTrigger: { trigger: card, containerAnimation: tween, start: 'left 85%', once: true } });
    });
    return () => sig.classList.remove('is-h');
  });
  mm.add('(max-width: 899px)', () => {
    $$('.card').forEach((c, i) => gsap.from(c, { y: 50, opacity: 0, duration: 1, ease: 'power3.out', delay: i < 2 ? i * .1 : 0, scrollTrigger: { trigger: c, start: 'top 94%', once: true } }));
  });

  // Gouttes de gel sous les signatures
  gsap.fromTo('.drips svg', { scaleY: .12 }, { scaleY: 1, ease: 'none', scrollTrigger: { trigger: '.sig', start: 'bottom 98%', end: 'bottom 45%', scrub: true } });

  // Studio couleurs : la fenêtre en amande s'agrandit jusqu'au plein écran
  mm.add('(min-width: 760px)', () => {
    const vid = $('.colors__video');
    gsap.fromTo(vid, { clipPath: 'inset(20% 32% 20% 32% round 999px)' }, { clipPath: 'inset(0% 0% 0% 0% round 0px)', ease: 'none', scrollTrigger: { trigger: '.colors', start: 'top 85%', end: 'top top', scrub: .5 } });
    gsap.fromTo('.colors__content', { opacity: 0, y: 70, scale: .92 }, { opacity: 1, y: 0, scale: 1, ease: 'none', scrollTrigger: { trigger: '.colors', start: 'top 50%', end: 'top top', scrub: .5 } });
    ScrollTrigger.create({ trigger: '.colors__stage', start: 'top top', end: '+=70%', pin: true, anticipatePin: 1, refreshPriority: 1 });
    return () => gsap.set(vid, { clearProps: 'clipPath' });
  });

  /* ----------------------------------------------------------- refresh */
  const settle = () => { ScrollTrigger.sort(); ScrollTrigger.refresh(); };
  window.addEventListener('load', settle);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(settle);
})();
