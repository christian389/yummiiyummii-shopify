/* ============================================================
   Yummii Yummii — Startsæt landingsside
   Upload som: assets/yy-landing.js
   Vanilla JS, ingen afhængigheder. Indlæses med `defer`.

   1) PDP-galleri  — klik på thumbnail skifter hovedmedie
   2) Karusel      — prev/next-knapper scroller vandret, pile fader ved kanter
   3) Smooth anchor — [data-yylp-anchor] scroller blødt til target uden at
                       røre html{scroll-behavior} globalt
   4) Upsell-popup  — "Læg i kurv" åbner popup FØR noget lægges i kurven.
                       Bekræft = sæt + tilkøb; Spring over = kun sæt;
                       Luk/annullér = intet lægges i kurv.
   ============================================================ */

(function(){

  /* This file is included via {% script_tag %} in several sections (hero,
     product, carousel, final-cta, sticky, popup), and the <script> tag sits
     near the TOP of each section's own markup — often above elements that
     matter (e.g. the popup's [data-yylp-modal] div, defined further down in
     the same section, or the popup section itself, which is last on the
     page). A non-deferred <script> runs the instant the parser reaches it,
     before any later HTML exists in the DOM — so querying for those
     elements at the top level of this file can silently find nothing.
     Deferring init to DOMContentLoaded guarantees the whole page has been
     parsed first, regardless of where in the document this script sits or
     how many times its tag appears (paired with the guard below, which
     ensures it only actually runs once). */
  function init(){
    if(window.__yyLandingInit) return;
    window.__yyLandingInit = true;

    run();
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function run(){

  /* ---------- 1) PDP-galleri ---------- */
  document.querySelectorAll('[data-yylp-gallery]').forEach(function(gallery){
    var main = gallery.querySelector('[data-yylp-main]');
    var thumbs = gallery.querySelectorAll('[data-yylp-thumb]');
    if(!main || !thumbs.length) return;

    var zoomHTML = '<span class="yy-lp-zoom" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3M11 8v6M8 11h6"/></svg></span>';

    function render(thumb){
      var type = thumb.getAttribute('data-media-type');
      var src  = thumb.getAttribute('data-media-src') || '';
      var alt  = thumb.getAttribute('data-media-alt') || '';
      var html = zoomHTML;
      if(type === 'video'){
        html += '<video src="' + src + '" autoplay muted loop playsinline></video>';
      } else if(type === 'image'){
        html += '<img src="' + src + '" alt="' + alt.replace(/"/g,'&quot;') + '">';
      } else {
        html += '<span class="yy-lp-placeholder">' + (thumb.getAttribute('data-placeholder-text') || '') + '</span>';
      }
      main.innerHTML = html;
    }

    var initial = gallery.querySelector('[data-yylp-thumb].is-active') || thumbs[0];
    if(initial) render(initial);

    thumbs.forEach(function(t){
      t.addEventListener('click', function(){
        thumbs.forEach(function(x){ x.classList.remove('is-active'); });
        t.classList.add('is-active');
        render(t);
      });
    });
  });

  /* ---------- 2) Karusel ---------- */
  document.querySelectorAll('[data-yylp-carousel]').forEach(function(c){
    var track = c.querySelector('[data-yylp-track]');
    var prev  = c.querySelector('[data-yylp-nav-prev]');
    var next  = c.querySelector('[data-yylp-nav-next]');
    if(!track) return;
    function step(){ var card = track.querySelector('.yy-lp-vid'); return card ? card.offsetWidth + 18 : 260; }
    if(prev) prev.addEventListener('click', function(){ track.scrollBy({ left:-step(), behavior:'smooth' }); });
    if(next) next.addEventListener('click', function(){ track.scrollBy({ left: step(), behavior:'smooth' }); });
    function sync(){
      var max = track.scrollWidth - track.clientWidth - 4;
      if(prev) prev.style.opacity = track.scrollLeft <= 2 ? '0.35' : '1';
      if(next) next.style.opacity = track.scrollLeft >= max ? '0.35' : '1';
    }
    track.addEventListener('scroll', sync);
    window.addEventListener('resize', sync);
    sync();
  });

  /* ---------- 3) Smooth anchor ---------- */
  document.addEventListener('click', function(e){
    var link = e.target.closest('[data-yylp-anchor]');
    if(!link) return;
    var href = link.getAttribute('href') || '';
    if(href.charAt(0) !== '#' || href.length < 2) return;
    var target = document.getElementById(href.slice(1));
    if(!target) return;
    e.preventDefault();
    target.scrollIntoView({ behavior:'smooth', block:'start' });
  });

  /* ---------- 4) Upsell-popup ---------- */
  var modal = document.querySelector('[data-yylp-modal]');
  var pending = null; // { variantId, quantity }
  var submitting = false; // true while a confirm/skip request is in flight — blocks the other button

  function cartAdd(items){
    return fetch('/cart/add.js', {
      method:'POST',
      headers:{ 'Content-Type':'application/json', 'Accept':'application/json' },
      body: JSON.stringify({ items: items })
    }).then(function(res){
      if(!res.ok) return res.json().then(function(err){ throw err; });
      return res.json();
    });
  }

  function setBusy(btn, busyLabel){
    if(!btn) return function(){};
    var original = btn.textContent;
    btn.disabled = true;
    btn.textContent = busyLabel;
    return function(){ btn.disabled = false; btn.textContent = original; };
  }

  function openModal(){
    if(!modal) return;
    modal.classList.add('is-open');
    document.body.classList.add('yy-lp-modal-open');
    var video = modal.querySelector('video');
    if(video){ video.currentTime = 0; video.play().catch(function(){}); }
  }
  function closeModal(){
    if(!modal) return;
    modal.classList.remove('is-open');
    document.body.classList.remove('yy-lp-modal-open');
    var video = modal.querySelector('video');
    if(video) video.pause();
    pending = null;
    submitting = false;
  }

  function afterAdd(){
    var redirectUrl = modal.getAttribute('data-redirect-url');
    if(redirectUrl){
      window.location.href = redirectUrl;
      return;
    }
    // Never fall back to a /cart navigation. Close our popup and hand off
    // to the site's own cart drawer (yy-cart.js exposes window.yyCart).
    closeModal();
    if(window.yyCart && typeof window.yyCart.open === 'function'){
      if(typeof window.yyCart.refresh === 'function') window.yyCart.refresh();
      window.yyCart.open();
    } else {
      console.warn('[yy-lp] window.yyCart not found — item was added to cart but no drawer opened.');
    }
  }

  if(modal){
    /* Capture phase + stopImmediatePropagation: this MUST run before any
       theme-level "add to cart" / cart-drawer script sees the same click,
       otherwise the theme could add the product to the cart itself before
       the popup has a chance to ask about the upsell. */
    document.addEventListener('click', function(e){
      var trigger = e.target.closest('[data-yylp-add-trigger]');
      if(!trigger) return;
      e.preventDefault();
      e.stopPropagation();
      if(e.stopImmediatePropagation) e.stopImmediatePropagation();
      pending = {
        variantId: trigger.getAttribute('data-variant-id'),
        quantity: parseInt(trigger.getAttribute('data-quantity') || '1', 10)
      };
      openModal();
    }, true);

    document.addEventListener('click', function(e){
      if(e.target.closest('[data-yylp-modal-close]') || e.target === modal){
        closeModal();
        return;
      }

      var confirmBtn = e.target.closest('[data-yylp-modal-confirm]');
      if(confirmBtn && pending && !submitting){
        submitting = true;
        var otherBtn1 = modal.querySelector('[data-yylp-modal-skip]');
        if(otherBtn1) otherBtn1.disabled = true;
        var upsellVariantId = modal.getAttribute('data-upsell-variant-id');
        var items = [{ id: pending.variantId, quantity: pending.quantity }];
        if(upsellVariantId){ items.push({ id: upsellVariantId, quantity: 1 }); }
        var reset = setBusy(confirmBtn, confirmBtn.getAttribute('data-loading-label') || 'Legger til…');
        cartAdd(items).then(function(){
          afterAdd();
        }).catch(function(){
          submitting = false;
          if(otherBtn1) otherBtn1.disabled = false;
          reset();
          alert('Det oppstod en feil. Prøv igjen.');
        });
        return;
      }

      var skipBtn = e.target.closest('[data-yylp-modal-skip]');
      if(skipBtn && pending && !submitting){
        submitting = true;
        var otherBtn2 = modal.querySelector('[data-yylp-modal-confirm]');
        if(otherBtn2) otherBtn2.disabled = true;
        var reset2 = setBusy(skipBtn, 'Legger til…');
        cartAdd([{ id: pending.variantId, quantity: pending.quantity }]).then(function(){
          afterAdd();
        }).catch(function(){
          submitting = false;
          if(otherBtn2) otherBtn2.disabled = false;
          reset2();
          alert('Det oppstod en feil. Prøv igjen.');
        });
        return;
      }
    });

    document.addEventListener('keydown', function(e){
      if(e.key === 'Escape') closeModal();
    });
  }

  } // end run()

})();
