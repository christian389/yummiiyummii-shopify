(function () {
  'use strict';

  /* ============================================================
     Config — read from hidden data element injected by Liquid
     ============================================================ */
  var configEl = document.getElementById('yy-cart-drawer');
  var FREE_SHIPPING_KR = configEl ? parseInt(configEl.dataset.threshold || '400', 10) : 400;
  var FREE_SHIPPING = FREE_SHIPPING_KR * 100; // Shopify stores prices in cents
  var ROOT = configEl ? (configEl.dataset.root || '/') : '/';

  function getBundleMap() {
    try {
      var el = document.getElementById('yy-bundle-map');
      return el ? JSON.parse(el.textContent) : {};
    } catch (e) { return {}; }
  }

  /* ============================================================
     Neutralise Combine theme's native cart sidebar + popup
     ============================================================ */
  document.addEventListener('DOMContentLoaded', function () {
    var ids = ['site-cart-sidebar', 'mini-cart-popup'];
    ids.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.style.setProperty('display', 'none', 'important');
    });
  });

  /* ============================================================
     Intercept fetch → auto-open cart when item added
     ============================================================ */
  var _origFetch = window.fetch;
  window.fetch = function () {
    var url = typeof arguments[0] === 'string' ? arguments[0] : (arguments[0] && arguments[0].url) || '';
    var promise = _origFetch.apply(this, arguments);
    // Detect add-to-cart calls (both /cart/add.js and routes.root + cart/add.js)
    if (/cart\/add/.test(url)) {
      promise.then(function (response) {
        if (response && response.ok) {
          openCart();
        }
      }).catch(function () {});
    }
    return promise;
  };

  /* ============================================================
     DOM refs
     ============================================================ */
  var overlay     = document.getElementById('yy-cart-overlay');
  var scrim       = document.getElementById('yy-cart-scrim');
  var aside       = document.getElementById('yy-cart');
  var countEl     = document.getElementById('yy-cart-count');
  var shipEl      = document.getElementById('yy-cart-ship');
  var progressEl  = document.getElementById('yy-cart-progress-fill');
  var itemsEl     = document.getElementById('yy-cart-items');
  var subtotalEl  = document.getElementById('yy-cart-subtotal');
  var shippingEl  = document.getElementById('yy-cart-shipping');
  var checkoutEl  = document.getElementById('yy-cart-checkout');
  var checkoutLbl = document.getElementById('yy-cart-checkout-label');
  var closeBtn    = document.getElementById('yy-cart-close');

  /* ============================================================
     Helpers
     ============================================================ */
  function formatMoney(cents) {
    return (cents / 100).toLocaleString('da-DK', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }) + ' kr';
  }

  function updateBadges(count) {
    var badges = document.querySelectorAll('.yy-actions__badge');
    badges.forEach(function (b) {
      b.textContent = count;
      b.dataset.count = count;
    });
  }

  /* Per-line pricing that respects BOTH automatic/code line discounts
     (item.original_price/final_price/total_discount) AND compare-at /
     bundle-value sale pricing. Returns cents. */
  function linePricing(item, bundleMap) {
    var unitOrig = (item.original_price != null) ? item.original_price : item.price;
    var unitFinal = (item.final_price != null) ? item.final_price : item.price;
    var lineDiscount = item.total_discount || 0; // line-level discount total (cents)

    var comparePrice = item.compare_at_price || 0;
    if (!comparePrice) {
      var comps = bundleMap[String(item.product_id)];
      if (comps && comps.length > 0) {
        comparePrice = comps.reduce(function (s, p) { return s + p.price; }, 0);
      }
    }

    var wasPrice = 0;
    if (lineDiscount > 0 && unitOrig > unitFinal) {
      wasPrice = unitOrig;            // discounted by an automatic/code discount
    } else if (comparePrice > unitFinal) {
      wasPrice = comparePrice;        // on sale vs compare-at / bundle value
    }

    var discounted = wasPrice > unitFinal;
    return {
      now: unitFinal,
      was: wasPrice,
      discounted: discounted,
      pct: discounted ? Math.round((1 - unitFinal / wasPrice) * 100) : 0,
      saving: discounted ? (wasPrice - unitFinal) * item.quantity : 0
    };
  }

  /* ============================================================
     Cart API
     ============================================================ */
  function fetchCart() {
    return fetch(ROOT + 'cart.js', {
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' }
    }).then(function (r) { return r.json(); });
  }

  function changeQty(key, delta) {
    var keyEl = itemsEl.querySelector('[data-key="' + key + '"]');
    var valEl = keyEl ? keyEl.querySelector('.yy-stepper__val') : null;
    var current = valEl ? parseInt(valEl.textContent, 10) : 1;
    var next = Math.max(0, current + delta);

    // Disable buttons while request is in flight
    if (keyEl) {
      keyEl.querySelectorAll('.yy-stepper__btn, .yy-cart-item__remove').forEach(function (b) {
        b.disabled = true;
      });
    }

    return fetch(ROOT + 'cart/change.js', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: key, quantity: next })
    }).then(function (r) { return r.json(); }).then(function (cart) {
      renderCart(cart);
    });
  }

  function removeItem(key) {
    var keyEl = itemsEl.querySelector('[data-key="' + key + '"]');
    if (keyEl) {
      keyEl.querySelectorAll('.yy-stepper__btn, .yy-cart-item__remove').forEach(function (b) {
        b.disabled = true;
      });
    }
    return fetch(ROOT + 'cart/change.js', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: key, quantity: 0 })
    }).then(function (r) { return r.json(); }).then(function (cart) {
      renderCart(cart);
    });
  }

  function addToCart(variantId) {
    return fetch(ROOT + 'cart/add.js', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: variantId, quantity: 1 })
    }).then(function (r) { return r.json(); });
  }

  /* ============================================================
     Render
     ============================================================ */
  function renderItems(items) {
    if (!items || items.length === 0) {
      itemsEl.innerHTML = '';
      return;
    }

    var bundleMap = getBundleMap();
    var html = '';
    items.forEach(function (item, index) {
      var lineNum = index + 1; // 1-indexed line number

      var pricing = linePricing(item, bundleMap);
      var discounted = pricing.discounted;
      var pct = pricing.pct;

      var variantLabel = (item.variant_title && item.variant_title !== 'Default Title')
        ? '<div class="yy-cart-item__variant" style="font-size:13px;color:#6b6657;margin-top:2px;">' + escHtml(item.variant_title) + '</div>'
        : '';
      var badgeHtml = discounted
        ? '<span class="yy-cart-item__badge">' + pct + '%</span>'
        : '';
      var wasHtml = discounted
        ? '<span class="yy-cart-item__was">' + formatMoney(pricing.was) + '</span>'
        : '';
      var nowClass = 'yy-cart-item__now' + (discounted ? ' is-sale' : '');
      var savingPerItem = pricing.saving;
      var savingHtml = savingPerItem > 0
        ? '<div class="yy-cart-item__saving">Du sparer ' + formatMoney(savingPerItem) + '</div>'
        : '';
      var imgSrc = item.image
        ? item.image.replace(/(\.[a-z]+)$/, '_200x200$1')
        : '';
      var productUrl = item.url || '/products/' + (item.handle || '');
      var imgHtml = imgSrc
        ? '<img src="' + escHtml(imgSrc) + '" alt="' + escHtml(item.product_title) + '" width="92" height="92" loading="lazy" />'
        : '';

      html += '<li class="yy-cart-item" data-line="' + lineNum + '" data-key="' + escHtml(item.key) + '">'
        + '  <a href="' + escHtml(productUrl) + '" class="yy-cart-item__media-link" tabindex="-1">'
        + '    <div class="yy-cart-item__media">'
        +          imgHtml
        +          badgeHtml
        + '    </div>'
        + '  </a>'
        + '  <div class="yy-cart-item__info">'
        + '    <a href="' + escHtml(productUrl) + '" class="yy-cart-item__name">' + escHtml(item.product_title) + '</a>'
        +      variantLabel
        + '    <div class="yy-cart-item__price">'
        + '      <span class="' + nowClass + '">' + formatMoney(pricing.now) + '</span>'
        +        wasHtml
        + '    </div>'
        +        savingHtml
        + '    <div class="yy-cart-item__controls">'
        + '      <div class="yy-stepper">'
        + '        <button class="yy-stepper__btn" aria-label="Færre" data-qty-change="-1" data-key="' + escHtml(item.key) + '">−</button>'
        + '        <span class="yy-stepper__val">' + item.quantity + '</span>'
        + '        <button class="yy-stepper__btn" aria-label="Flere" data-qty-change="1" data-key="' + escHtml(item.key) + '">+</button>'
        + '      </div>'
        + '      <button class="yy-cart-item__remove" aria-label="Fjern ' + escHtml(item.product_title) + '" data-remove="' + escHtml(item.key) + '">'
        + '        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>'
        + '      </button>'
        + '      <span class="yy-cart-item__stock">På lager</span>'
        + '    </div>'
        + buildBundleHtml(bundleMap, item.product_id)
        + '  </div>'
        + '</li>';
    });

    itemsEl.innerHTML = html;
  }

  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function buildBundleHtml(bundleMap, productId) {
    var items = bundleMap[String(productId)];
    if (!items || items.length === 0) return '';
    var uid = 'yy-bundle-' + productId;
    var inner = items.map(function (p) {
      var img = p.image
        ? '<img class="yy-cart-item__bundle-img" src="' + escHtml(p.image) + '" alt="' + escHtml(p.title) + '" width="36" height="36" loading="lazy">'
        : '<span class="yy-cart-item__bundle-img"></span>';
      return '<div class="yy-cart-item__bundle-item">' + img + '<span>' + escHtml(p.title) + '</span></div>';
    }).join('');
    return '<div class="yy-cart-item__bundle">'
      + '<button type="button" class="yy-cart-item__bundle-toggle" data-bundle-target="' + uid + '">'
      + 'Se hvad er inkluderet (' + items.length + ' produkter)'
      + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>'
      + '</button>'
      + '<div class="yy-cart-item__bundle-items" id="' + uid + '">' + inner + '</div>'
      + '</div>';
  }

  function renderCart(data) {
    var count = data.item_count || 0;
    var total = data.total_price || 0;
    var isEmpty = count === 0;
    var isComplete = !isEmpty && total >= FREE_SHIPPING;

    /* State classes */
    aside.classList.toggle('is-empty', isEmpty);
    aside.classList.toggle('is-complete', isComplete);

    /* Count */
    if (countEl) countEl.textContent = count > 0 ? '(' + count + ')' : '';

    /* Shipping message */
    if (shipEl) {
      if (isEmpty) {
        shipEl.innerHTML = '';
      } else if (isComplete) {
        shipEl.innerHTML = 'Du har opnået <strong>gratis fragt</strong>!';
      } else {
        var remaining = FREE_SHIPPING - total;
        shipEl.innerHTML = 'Køb for <strong>' + formatMoney(remaining) + '</strong> mere for <strong>gratis fragt</strong>';
      }
    }

    /* Progress bar */
    if (progressEl) {
      if (isEmpty) {
        progressEl.style.width = '0%';
      } else {
        var pct = Math.min(100, (total / FREE_SHIPPING) * 100);
        progressEl.style.width = pct + '%';
      }
    }

    /* Subtotal */
    if (subtotalEl) subtotalEl.textContent = formatMoney(total);

    /* Total savings — compact badge next to subtotal */
    var savingsEl = document.getElementById('yy-cart-savings');
    var curBundleMap = getBundleMap();
    var totalSavings = (data.items || []).reduce(function (sum, it) {
      return sum + linePricing(it, curBundleMap).saving;
    }, 0);
    if (savingsEl) {
      if (totalSavings > 0 && !isEmpty) {
        savingsEl.textContent = 'Du sparer ' + formatMoney(totalSavings);
        savingsEl.style.display = '';
      } else {
        savingsEl.style.display = 'none';
      }
    }

    /* Shipping line */
    if (shippingEl) {
      if (isComplete) {
        shippingEl.innerHTML = '<span style="color:#3d7a4f;font-weight:600;">Gratis</span>';
      } else {
        shippingEl.textContent = 'Beregnes ved kassen';
      }
    }

    /* Checkout button */
    if (checkoutEl && checkoutLbl) {
      if (isEmpty) {
        checkoutEl.href = ROOT;
        checkoutLbl.textContent = 'Fortsæt med at shoppe';
      } else {
        checkoutEl.href = '/checkout';
        checkoutLbl.textContent = 'Gå til kassen';
      }
    }

    /* Render line items */
    renderItems(data.items || []);

    /* Update all cart badges in the page header/nav */
    updateBadges(count);
  }

  /* ============================================================
     Cart state management
     ============================================================ */
  function refreshCart() {
    return fetchCart().then(function (data) {
      renderCart(data);
      // Only refresh upsells when cart is open (avoids unnecessary requests)
      if (overlay && overlay.classList.contains('is-open')) {
        refreshUpsells();
      }
    }).catch(function (err) {
      console.error('[yy-cart] refreshCart error', err);
    });
  }

  function refreshUpsells() {
    var sectionId = overlay ? overlay.dataset.sectionId : null;
    if (!sectionId) return;

    fetch('/?sections=' + sectionId, { headers: { 'Accept': 'application/json' } })
      .then(function (r) { return r.json(); })
      .then(function (sections) {
        var html = sections[sectionId];
        if (!html) return;

        var doc = new DOMParser().parseFromString(html, 'text/html');
        var newTrack = doc.getElementById('yy-upsell-track');
        var curUpsell = document.getElementById('yy-cart-upsell');
        var curTrack = document.getElementById('yy-upsell-track');

        if (!newTrack) return; // No upsells in updated section — leave as-is

        if (curTrack) {
          // Update existing track content
          curTrack.innerHTML = newTrack.innerHTML;
        }

        // Show/hide the container based on whether there are cards
        if (curUpsell) {
          var hasCards = curUpsell.querySelector('.yy-upsell-card') !== null;
          curUpsell.style.display = hasCards ? '' : 'none';
        }

        // Also refresh bundle map and re-render items with updated bundle data
        var newBundleMap = doc.getElementById('yy-bundle-map');
        var curBundleMap = document.getElementById('yy-bundle-map');
        if (newBundleMap && curBundleMap) {
          curBundleMap.textContent = newBundleMap.textContent;
          // Re-render items to pick up new bundle data
          fetchCart().then(function (data) {
            renderItems(data.items || []);
          }).catch(function () {});
        }
      })
      .catch(function () {});
  }

  function bindUpsellButtons() {
    document.querySelectorAll('[data-upsell-variant]').forEach(function (btn) {
      btn.removeEventListener('click', btn._upsellHandler);
      btn._upsellHandler = function () {
        var variantId = parseInt(btn.dataset.upsellVariant, 10);
        if (!variantId) return;
        addToCart(variantId).then(function () {
          return refreshCart();
        });
      };
      btn.addEventListener('click', btn._upsellHandler);
    });
  }

  function openCart() {
    if (!overlay) return;
    overlay.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    document.body.classList.add('yy-cart-open');
    refreshCart();
  }

  function closeCart() {
    if (!overlay) return;
    overlay.classList.remove('is-open');
    document.body.style.overflow = '';
    document.body.classList.remove('yy-cart-open');
  }

  /* ============================================================
     Event listeners
     ============================================================ */

  /* Scrim click → close */
  if (scrim) {
    scrim.addEventListener('click', closeCart);
  }

  /* Close button */
  if (closeBtn) {
    closeBtn.addEventListener('click', closeCart);
  }

  /* ESC key */
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' || e.keyCode === 27) {
      closeCart();
    }
  });

  /* Qty change + remove — delegated from #yy-cart-items */
  if (itemsEl) {
    itemsEl.addEventListener('click', function (e) {
      var qtyBtn = e.target.closest('[data-qty-change]');
      if (qtyBtn && !qtyBtn.disabled) {
        var key = qtyBtn.dataset.key;
        var delta = parseInt(qtyBtn.dataset.qtyChange, 10);
        changeQty(key, delta);
        return;
      }
      var removeBtn = e.target.closest('[data-remove]');
      if (removeBtn && !removeBtn.disabled) {
        var removeKey = removeBtn.dataset.remove;
        removeItem(removeKey);
      }
    });
  }

  /* Review bar toggle */
  var reviewBarBtn = document.getElementById('yy-review-bar-btn');
  var reviewPanel  = document.getElementById('yy-review-panel');
  if (reviewBarBtn && reviewPanel) {
    reviewBarBtn.addEventListener('click', function () {
      var expanded = reviewBarBtn.getAttribute('aria-expanded') === 'true';
      reviewBarBtn.setAttribute('aria-expanded', String(!expanded));
      if (expanded) { reviewPanel.setAttribute('hidden', ''); }
      else           { reviewPanel.removeAttribute('hidden'); }
    });
  }

  /* Discount toggle (mobile) */
  var discountToggle = document.getElementById('yy-discount-toggle');
  var discountCollapse = document.getElementById('yy-discount-collapse');
  if (discountToggle && discountCollapse) {
    discountToggle.addEventListener('click', function () {
      var expanded = discountToggle.getAttribute('aria-expanded') === 'true';
      discountToggle.setAttribute('aria-expanded', String(!expanded));
      discountCollapse.classList.toggle('is-open', !expanded);
    });
  }

  /* Bundle toggle */
  if (itemsEl) {
    itemsEl.addEventListener('click', function (e) {
      var toggleBtn = e.target.closest('[data-bundle-target]');
      if (toggleBtn) {
        var targetId = toggleBtn.dataset.bundleTarget;
        var panel = document.getElementById(targetId);
        if (panel) {
          var isOpen = panel.classList.toggle('is-open');
          toggleBtn.classList.toggle('is-open', isOpen);
        }
      }
    });
  }

  /* Discount code */
  var appliedDiscount = '';
  var discountForm = document.getElementById('yy-discount-form');
  var discountInput = document.getElementById('yy-discount-input');
  var discountMsg = document.getElementById('yy-discount-msg');

  if (discountForm) {
    discountForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var code = discountInput ? discountInput.value.trim().toUpperCase() : '';
      if (!code) return;

      // Apply via /discount/ cookie endpoint (best effort)
      fetch('/discount/' + encodeURIComponent(code), {
        credentials: 'same-origin', redirect: 'manual'
      }).finally(function () {
        appliedDiscount = code;
        if (discountMsg) {
          discountMsg.textContent = '✓ Kode "' + code + '" tilføjet';
          discountMsg.style.color = 'var(--yy-green)';
        }
        // Embed code in checkout URL so it's applied
        if (checkoutEl) {
          checkoutEl.href = '/checkout?discount=' + encodeURIComponent(code);
        }
      });
    });
  }

  /* Cart trigger — intercept clicks on cart icon/link anywhere on the page */
  document.addEventListener('click', function (e) {
    var trigger = e.target.closest('.yy-actions__cart, a[href="/cart"], [data-cart-trigger]');
    if (trigger) {
      e.preventDefault();
      openCart();
    }
  });

  /* Upsell "Tilføj" buttons — delegated from overlay */
  if (overlay) {
    overlay.addEventListener('click', function (e) {
      var upsellBtn = e.target.closest('[data-upsell-variant]');
      if (upsellBtn) {
        var variantId = upsellBtn.dataset.upsellVariant;
        upsellBtn.disabled = true;
        upsellBtn.textContent = '…';
        addToCart(variantId).then(function () {
          return refreshCart();
        }).then(function () {
          upsellBtn.disabled = false;
          upsellBtn.textContent = 'Tilføj';
        }).catch(function (err) {
          console.error('[yy-cart] addToCart error', err);
          upsellBtn.disabled = false;
          upsellBtn.textContent = 'Tilføj';
        });
      }
    });
  }

  /* Custom events dispatched by theme or other scripts */
  document.addEventListener('cart:refresh', function () {
    refreshCart();
  });

  document.addEventListener('cart:updated', function (e) {
    if (e.detail && e.detail.cart) {
      renderCart(e.detail.cart);
    } else {
      refreshCart();
    }
  });

  /* Combine / Krown theme native cart events */
  document.addEventListener('ajaxCart:afterAddItem', function () { openCart(); });
  document.addEventListener('theme:cart:add', function () { openCart(); });

  /* Intercept native <form action="/cart/add"> submits as fallback */
  document.addEventListener('submit', function (e) {
    var form = e.target;
    if (form && form.action && /\/cart\/add/.test(form.action)) {
      // Let the form submit normally, but open drawer shortly after
      setTimeout(function () {
        refreshCart();
        openCart();
      }, 600);
    }
  }, true);

  /* ============================================================
     Init — hydrate counts/state immediately on load
     ============================================================ */
  document.addEventListener('DOMContentLoaded', function () {
    refreshCart();
  });

  /* Expose open/close globally for use by theme snippets */
  window.yyCart = {
    open: openCart,
    close: closeCart,
    refresh: refreshCart
  };

}());
