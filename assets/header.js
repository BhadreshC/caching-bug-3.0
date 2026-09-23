/**
 * Premium Header JavaScript
 * Handles: sticky scroll effect, search overlay, mobile drawer, body lock
 */

(function () {
  'use strict';

  const header         = document.getElementById('site-header');
  const burgers        = document.querySelectorAll('.menu-burdger, .close-menu');
  const searchTrigger  = document.querySelector('.header__search-trigger');
  const searchOverlay  = document.getElementById('header-search-overlay');
  const searchClose    = searchOverlay && searchOverlay.querySelector('.header-search-overlay__close');
  const searchInput    = document.getElementById('HeaderSearchInput');
  const drawerBackdrop = document.querySelector('.snippet-menu-drawer');

  /* ── Scroll: add `is-scrolled` class ──────────────────── */
  if (header) {
    const onScroll = () => {
      if (window.scrollY > 20) {
        header.classList.add('is-scrolled');
      } else {
        header.classList.remove('is-scrolled');
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll(); // run immediately in case page is already scrolled
  }

  /* ── Mobile drawer: burger toggle ─────────────────────── */
  burgers.forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      const isOpen = document.body.classList.toggle('open-menu');
      // Update aria-expanded on burger buttons
      document.querySelectorAll('.menu-burdger').forEach(function (b) {
        b.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      });
      // Lock / unlock body scroll
      document.body.style.overflow = isOpen ? 'hidden' : '';
    });
  });

  // Close drawer when clicking backdrop
  if (drawerBackdrop) {
    drawerBackdrop.addEventListener('click', function (e) {
      if (e.target === drawerBackdrop || e.target.classList.contains('snippet-menu-drawer')) {
        closeDrawer();
      }
    });
  }

  function closeDrawer() {
    document.body.classList.remove('open-menu');
    document.body.style.overflow = '';
    document.querySelectorAll('.menu-burdger').forEach(function (b) {
      b.setAttribute('aria-expanded', 'false');
    });
  }

  // Close drawer on Escape
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (document.body.classList.contains('open-menu')) closeDrawer();
      if (searchOverlay && searchOverlay.classList.contains('is-open')) closeSearch();
    }
  });

  /* ── Search overlay ────────────────────────────────────── */
  function openSearch() {
    if (!searchOverlay) return;
    searchOverlay.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    if (searchTrigger) searchTrigger.setAttribute('aria-expanded', 'true');
    setTimeout(function () {
      if (searchInput) searchInput.focus();
    }, 350); // wait for animation
  }

  function closeSearch() {
    if (!searchOverlay) return;
    searchOverlay.classList.remove('is-open');
    document.body.style.overflow = '';
    if (searchTrigger) searchTrigger.setAttribute('aria-expanded', 'false');
  }

  if (searchTrigger) {
    searchTrigger.addEventListener('click', openSearch);
  }

  if (searchClose) {
    searchClose.addEventListener('click', closeSearch);
  }

  // Click outside the inner panel to close
  if (searchOverlay) {
    searchOverlay.addEventListener('click', function (e) {
      if (e.target === searchOverlay) closeSearch();
    });
  }

  /* ── Animate nav links on load (stagger) ──────────────── */
  const navLinks = document.querySelectorAll('.header__menu > a, .header__menu > .header__menu-item');
  navLinks.forEach(function (link, i) {
    link.style.opacity = '0';
    link.style.transform = 'translateY(-6px)';
    link.style.transition = 'opacity 0.3s ease ' + (i * 0.05 + 0.1) + 's, transform 0.3s ease ' + (i * 0.05 + 0.1) + 's';
    // Trigger reflow then animate in
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        link.style.opacity = '1';
        link.style.transform = 'translateY(0)';
      });
    });
  });

})();