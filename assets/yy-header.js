(function () {
  'use strict';

  /* ============================================================
     Yummii Yummii Header — Vanilla JS IIFE
     CSS handles desktop hover automatically via @media (hover: hover).
     JS handles: mobile drawer, touch/keyboard mega open, ESC close.
     Toggle class: .is-open on .yy-has-mega / .yy-drawer / .yy-scrim
  ============================================================ */

  /* ---- Sticky placeholder ----------------------------------- */
  var stickyHdr = document.querySelector('.yy-header--sticky');
  if (stickyHdr) {
    var ph = document.createElement('div');
    ph.id = 'yy-hdr-placeholder';
    ph.style.cssText = 'display:block;pointer-events:none;';
    stickyHdr.insertAdjacentElement('afterend', ph);

    function syncPlaceholder() {
      ph.style.height = stickyHdr.offsetHeight + 'px';
    }
    syncPlaceholder();
    window.addEventListener('resize', syncPlaceholder, { passive: true });
  }

  var header = document.querySelector('header.yy-header');
  if (!header) return;

  /* ============================================================
     TRANSPARENT → SOLID (homepage only)
     .yy-header--transparent starts see-through over the hero and
     becomes solid (.is-solid) on scroll, or while a mega menu /
     mobile drawer is open — mirrors the reference design's
     `solid = scrolled || !!open`.
  ============================================================ */
  var isTransparentHeader = header.classList.contains('yy-header--transparent');
  function syncSolidHeader() {
    if (!isTransparentHeader) return;
    var anyMegaOpen = false;
    header.querySelectorAll('.yy-has-mega').forEach(function (item) {
      if (item.classList.contains('is-open') || (item.matches && item.matches(':hover'))) {
        anyMegaOpen = true;
      }
    });
    var drawerEl = document.getElementById('yy-drawer');
    var drawerOpen = !!(drawerEl && drawerEl.classList.contains('is-open'));
    var scrolled = window.scrollY > 12;
    header.classList.toggle('is-solid', scrolled || anyMegaOpen || drawerOpen);
  }
  if (isTransparentHeader) {
    window.addEventListener('scroll', syncSolidHeader, { passive: true });
    header.querySelectorAll('.yy-has-mega').forEach(function (item) {
      item.addEventListener('mouseenter', syncSolidHeader);
      item.addEventListener('mouseleave', function () { setTimeout(syncSolidHeader, 150); });
    });
    syncSolidHeader();
  }

  /* ============================================================
     MOBILE DRAWER
  ============================================================ */
  var drawer   = document.getElementById('yy-drawer');
  var scrim    = document.getElementById('yy-scrim');
  var burger   = document.getElementById('yy-burger');
  var closeBtn = document.getElementById('yy-drawer-close');

  function openDrawer() {
    if (!drawer || !scrim) return;
    drawer.classList.add('is-open');
    scrim.classList.add('is-open');
    if (burger) burger.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
    if (closeBtn) closeBtn.focus();
    syncSolidHeader();
  }

  function closeDrawer() {
    if (!drawer || !scrim) return;
    drawer.classList.remove('is-open');
    scrim.classList.remove('is-open');
    if (burger) burger.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
    if (burger) burger.focus();
    syncSolidHeader();
  }

  if (burger)   burger.addEventListener('click', openDrawer);
  if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
  if (scrim)    scrim.addEventListener('click', closeDrawer);

  /* ============================================================
     DESKTOP MEGA MENU
     CSS handles hover automatically. JS adds .is-open for
     keyboard / focus navigation so the menu stays open while
     tabbing through its links.
  ============================================================ */
  var desktopMegaItems = header.querySelectorAll('.yy-navbar .yy-has-mega');

  function closeAllDesktopMegas(except) {
    desktopMegaItems.forEach(function (item) {
      if (item === except) return;
      item.classList.remove('is-open');
      var btn = item.querySelector('.yy-nav__link');
      if (btn) btn.setAttribute('aria-expanded', 'false');
    });
  }

  desktopMegaItems.forEach(function (item) {
    var triggerBtn = item.querySelector('.yy-nav__link');

    /* Click / keyboard Enter toggles .is-open (supplements CSS hover) */
    if (triggerBtn) {
      triggerBtn.addEventListener('click', function () {
        var isOpen = item.classList.contains('is-open');
        closeAllDesktopMegas(item);
        item.classList.toggle('is-open', !isOpen);
        triggerBtn.setAttribute('aria-expanded', String(!isOpen));
        syncSolidHeader();
      });
    }

    /* Close when focus leaves the entire item */
    item.addEventListener('focusout', function (e) {
      /* Use a rAF so relatedTarget is settled */
      requestAnimationFrame(function () {
        if (!item.contains(document.activeElement)) {
          item.classList.remove('is-open');
          if (triggerBtn) triggerBtn.setAttribute('aria-expanded', 'false');
          syncSolidHeader();
        }
      });
    });
  });

  /* ============================================================
     MOBILE ACCORDION (inside .yy-drawer)
     Toggles .is-open on .yy-has-mega list items.
  ============================================================ */
  var drawerMegaItems = header.querySelectorAll('.yy-drawer .yy-has-mega');

  drawerMegaItems.forEach(function (item) {
    var triggerBtn = item.querySelector('.yy-nav__link');
    if (!triggerBtn) return;

    triggerBtn.addEventListener('click', function () {
      var isOpen = item.classList.contains('is-open');

      /* Close all other accordion items */
      drawerMegaItems.forEach(function (other) {
        if (other !== item) {
          other.classList.remove('is-open');
          var otherBtn = other.querySelector('.yy-nav__link');
          if (otherBtn) otherBtn.setAttribute('aria-expanded', 'false');
        }
      });

      item.classList.toggle('is-open', !isOpen);
      triggerBtn.setAttribute('aria-expanded', String(!isOpen));
    });
  });

  /* ============================================================
     MOBILE SEARCH TOGGLE
  ============================================================ */
  var searchToggle = document.getElementById('yy-search-toggle');
  var mobileSearch = document.getElementById('yy-mobile-search');

  function openMobileSearch() {
    if (!mobileSearch) return;
    mobileSearch.classList.add('is-open');
    mobileSearch.setAttribute('aria-hidden', 'false');
    if (searchToggle) searchToggle.setAttribute('aria-expanded', 'true');
    var input = mobileSearch.querySelector('input');
    if (input) setTimeout(function () { input.focus(); }, 50);
  }

  function closeMobileSearch() {
    if (!mobileSearch) return;
    mobileSearch.classList.remove('is-open');
    mobileSearch.setAttribute('aria-hidden', 'true');
    if (searchToggle) searchToggle.setAttribute('aria-expanded', 'false');
  }

  if (searchToggle) {
    searchToggle.addEventListener('click', function () {
      if (mobileSearch && mobileSearch.classList.contains('is-open')) {
        closeMobileSearch();
      } else {
        openMobileSearch();
      }
    });
  }

  /* ============================================================
     ESC — close everything
  ============================================================ */
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    closeAllDesktopMegas(null);
    closeDrawer();
    closeMobileSearch();
    syncSolidHeader();
  });

})();
