/* Sailing Zadar — shared UI: nav, scroll reveals */
(function () {
  'use strict';
  document.addEventListener('DOMContentLoaded', function () {
    var burger = document.querySelector('.nav-burger');
    var links = document.querySelector('.nav-links');
    if (burger && links) {
      burger.addEventListener('click', function () {
        var open = links.classList.toggle('open');
        burger.setAttribute('aria-expanded', String(open));
      });
    }

    // device-language suggestion banner: detect navigator.language and offer
    // to switch (confirmation, not forced redirect — kinder to users and bots).
    // Built with createElement/textContent only, no HTML injection surface.
    (function () {
      var SUPPORTED = ['en', 'hr', 'de', 'it', 'es', 'da', 'fr'];
      var MSG = {
        en: { q: 'Would you like to view this site in English?', yes: 'Yes, switch', no: 'No, thanks' },
        hr: { q: 'Želite li stranicu na hrvatskom?', yes: 'Da, prebaci', no: 'Ne, hvala' },
        de: { q: 'Möchten Sie diese Seite auf Deutsch sehen?', yes: 'Ja, wechseln', no: 'Nein, danke' },
        it: { q: 'Vuoi vedere il sito in italiano?', yes: 'Sì, cambia', no: 'No, grazie' },
        es: { q: '¿Quieres ver la web en español?', yes: 'Sí, cambiar', no: 'No, gracias' },
        da: { q: 'Vil du se siden på dansk?', yes: 'Ja, skift', no: 'Nej tak' },
        fr: { q: 'Voulez-vous voir ce site en français ?', yes: 'Oui, changer', no: 'Non, merci' },
      };
      var cur = document.documentElement.lang || 'en';
      var stored = null;
      try { stored = localStorage.getItem('sz-lang'); } catch (e) {}
      if (stored) return; // user already chose once — respect it, no nagging
      var dev = (navigator.language || 'en').slice(0, 2).toLowerCase();
      if (SUPPORTED.indexOf(dev) === -1 || dev === cur) return;
      // take the target URL from the language dropdown: those links already
      // carry the correct base path (e.g. /sz-preview/ on GitHub Pages)
      var menuLink = Array.prototype.slice.call(document.querySelectorAll('.lang-menu a')).find(function (a) {
        var c = a.querySelector('.code');
        return c && c.textContent.trim().toLowerCase() === dev;
      });
      if (!menuLink) return;
      var target = menuLink.getAttribute('href');
      var m = MSG[dev];

      var bar = document.createElement('div');
      bar.className = 'lang-banner';
      var txt = document.createElement('span');
      txt.textContent = m.q;
      var yes = document.createElement('button');
      yes.className = 'btn btn-primary';
      yes.textContent = m.yes;
      yes.addEventListener('click', function () {
        try { localStorage.setItem('sz-lang', dev); } catch (e) {}
        window.location.href = target;
      });
      var no = document.createElement('button');
      no.className = 'btn btn-ghost';
      no.textContent = m.no;
      no.addEventListener('click', function () {
        try { localStorage.setItem('sz-lang', cur); } catch (e) {}
        bar.remove();
      });
      bar.appendChild(txt); bar.appendChild(yes); bar.appendChild(no);
      document.body.appendChild(bar);
    })();

    // custom language dropdown
    var dd = document.querySelector('[data-lang-dd]');
    if (dd) {
      var btn = dd.querySelector('.lang-btn');
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var open = dd.classList.toggle('open');
        btn.setAttribute('aria-expanded', String(open));
      });
      document.addEventListener('click', function (e) {
        if (!dd.contains(e.target)) { dd.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); }
      });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') { dd.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); }
      });
      // manual choice from the dropdown = durable preference
      // (read the language from the link's code label — href may carry a base path)
      dd.querySelectorAll('.lang-menu a').forEach(function (a) {
        a.addEventListener('click', function () {
          var c = a.querySelector('.code');
          var code = c ? c.textContent.trim().toLowerCase() : 'en';
          try { localStorage.setItem('sz-lang', code); } catch (e) {}
        });
      });
    }

    // scroll reveal via IntersectionObserver (no scroll listeners)
    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var items = document.querySelectorAll('.rv');
    if (reduced || !('IntersectionObserver' in window)) {
      items.forEach(function (el) { el.classList.add('in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    items.forEach(function (el) { io.observe(el); });
    // safety net: if the observer never fires (throttled/background tabs,
    // odd embedders), reveal everything rather than leave content hidden
    setTimeout(function () {
      items.forEach(function (el) { el.classList.add('in'); });
    }, 2500);
  });
})();
