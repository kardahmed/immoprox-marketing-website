// IMMO PRO-X — Shared scripts
(function () {
  function initMobileNav() {
    var burger = document.querySelector('.nav-burger');
    var panel = document.querySelector('.nav-mobile');
    if (!burger || !panel) return;

    function close() {
      burger.setAttribute('aria-expanded', 'false');
      panel.classList.remove('open');
      document.body.classList.remove('nav-open');
    }
    function open() {
      burger.setAttribute('aria-expanded', 'true');
      panel.classList.add('open');
      document.body.classList.add('nav-open');
    }

    burger.addEventListener('click', function () {
      var expanded = burger.getAttribute('aria-expanded') === 'true';
      if (expanded) close(); else open();
    });

    panel.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', close);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') close();
    });

    window.addEventListener('resize', function () {
      if (window.innerWidth > 960) close();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMobileNav);
  } else {
    initMobileNav();
  }
})();
