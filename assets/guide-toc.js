/**
 * Builds the Guide table of contents client-side from whichever
 * [data-guide-toc-label] elements are actually present in the article --
 * so removing, reordering, or leaving a guide section empty in the theme
 * editor automatically keeps the jump-link list correct.
 */
(function () {
  function slugify(text) {
    return (text || '')
      .toString()
      .trim()
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function init(toc) {
    var list = toc.querySelector('[data-guide-toc-list]');
    if (!list) return;

    // Each guide-*.liquid section renders its own independent .guide wrapper
    // (they're sibling sections on the page, not nested in a shared one), so
    // the labeled targets must be searched for document-wide, not scoped to
    // the TOC's own wrapper.
    var targets = document.querySelectorAll('[data-guide-toc-label]');
    var usedIds = {};
    var items = [];

    targets.forEach(function (target) {
      var label = target.getAttribute('data-guide-toc-label');
      if (!label) return;

      var id = target.id;
      if (!id) {
        var base = slugify(label) || 'section';
        id = base;
        var i = 2;
        while (usedIds[id]) {
          id = base + '-' + i;
          i += 1;
        }
        target.id = id;
      }
      usedIds[id] = true;

      var li = document.createElement('li');
      var a = document.createElement('a');
      a.href = '#' + id;
      a.textContent = label;
      li.appendChild(a);
      items.push(li);
    });

    if (items.length === 0) {
      toc.hidden = true;
      return;
    }

    list.innerHTML = '';
    items.forEach(function (li) {
      list.appendChild(li);
    });
    toc.hidden = false;
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('[data-guide-toc]').forEach(init);
  });

  // Smooth-scrolls TOC jump links without setting html{scroll-behavior}
  // globally (mirrors the [data-yylp-anchor] handler in yy-landing.js).
  document.addEventListener('click', function (e) {
    var link = e.target.closest('[data-guide-toc-list] a');
    if (!link) return;
    var href = link.getAttribute('href') || '';
    if (href.charAt(0) !== '#' || href.length < 2) return;
    var target = document.getElementById(href.slice(1));
    if (!target) return;
    e.preventDefault();
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
})();
