/**
 * Cart Drawer
 *
 * Server-rendered inside the overlay section group.
 * Uses event delegation so all listeners survive DOM refreshes.
 * Section Rendering API (`?sections=`) keeps the drawer in sync.
 */

/* ── helpers ─────────────────────────────────────────────────── */

function getCartSectionId() {
  var el = document.querySelector('[data-cart-section-id]');
  return el ? el.dataset.cartSectionId : null;
}

function updateCartCount() {
  fetch('/cart.js')
    .then(function (r) { return r.json(); })
    .then(function (data) {
      document.querySelectorAll('.cart-count').forEach(function (el) {
        el.innerHTML = data.item_count > 0 ? data.item_count : '';
      });
    })
    .catch(console.error);
}

/* ── drawer open / close with focus‑trap (WCAG) ──────────────── */

var _previouslyFocused = null;

function openCartDrawer() {
  var drawer = document.querySelector('.cart-sidebar');
  if (!drawer) return;

  _previouslyFocused = document.activeElement;

  document.body.classList.add('open-drawer');
  document.body.classList.remove('open-menu', 'open-search', 'open-sort', 'open-filter');

  drawer.setAttribute('aria-hidden', 'false');
  drawer.focus();
}

function closeCartDrawer() {
  var drawer = document.querySelector('.cart-sidebar');
  if (!drawer) return;

  document.body.classList.remove('open-drawer', 'open-menu', 'open-search', 'open-sort', 'open-filter');
  drawer.setAttribute('aria-hidden', 'true');

  if (_previouslyFocused && _previouslyFocused.focus) {
    _previouslyFocused.focus();
  }
}

/* ── core: refresh cart drawer via Section Rendering API ───── */

function refreshCart() {
  var sectionId = getCartSectionId();
  if (!sectionId) return Promise.resolve();

  return fetch(window.Shopify.routes.root + '?sections=' + sectionId)
    .then(function (response) { return response.json(); })
    .then(function (data) {
      if (!data[sectionId]) return;

      var wrapper = document.getElementById('shopify-section-' + sectionId);
      if (!wrapper) return;

      var parsed = new DOMParser().parseFromString(data[sectionId], 'text/html');
      var fresh  = parsed.getElementById('shopify-section-' + sectionId);
      if (fresh) {
        wrapper.innerHTML = fresh.innerHTML;
      }

      /* keep drawer visibly open after refresh */
      if (document.body.classList.contains('open-drawer')) {
        var newDrawer = document.querySelector('.cart-sidebar');
        if (newDrawer) newDrawer.setAttribute('aria-hidden', 'false');
      }

      updateCartCount();
      initSplide();
    })
    .catch(function (error) {
      console.error('Error refreshing cart:', error);
    });
}

/** Backward-compatible alias – theme.js calls load_cart() */
function load_cart() {
  return refreshCart();
}

/* ── Splide init (scoped to cart drawer) ─────────────────────── */

function initSplide() {
  var sectionId = getCartSectionId();
  if (!sectionId || typeof Splide === 'undefined') return;

  var el = document.getElementById('splide-' + sectionId);
  if (!el) return;

  /* avoid double-init */
  if (el.classList.contains('is-initialized')) return;

  new Splide('#splide-' + sectionId, {
    type: 'slide',
    perPage: 2,
    gap: '0.75rem',
    pagination: false,
    arrows: true,
    breakpoints: {
      600: { perPage: 1 }
    },
    i18n: {
      prev: 'Previous upsell product',
      next: 'Next upsell product',
      slide: 'Go to upsell product %s'
    }
  }).mount();
}

/* ── cart mutations ───────────────────────────────────────────── */

function updateCartItemQuantity(line, quantity) {
  fetch('/cart/change.js', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ line: line, quantity: quantity })
  })
    .then(function (r) { return r.json(); })
    .then(function () { refreshCart(); })
    .catch(function (e) { console.error('Error updating cart:', e); });
}

/* ── discount helpers ────────────────────────────────────────── */

function fetchCurrentDiscountCodes() {
  return fetch('/cart.js', { method: 'GET' })
    .then(function (r) { return r.json(); })
    .then(function (data) {
      var codes = [];
      if (data.cart_level_discount_applications) {
        data.cart_level_discount_applications.forEach(function (d) {
          if (d.type === 'discount_code') codes.push(d.title);
        });
      }
      if (data.items) {
        data.items.forEach(function (item) {
          if (item.line_level_discount_allocations && item.line_level_discount_allocations.length) {
            item.line_level_discount_allocations.forEach(function (d) {
              if (d.discount_application && d.discount_application.type === 'discount_code') {
                codes.push(d.discount_application.title);
              }
            });
          }
        });
      }
      return codes.filter(function (v, i, a) { return a.indexOf(v) === i; });
    });
}

function applyDiscountCode(discountCode) {
  var errorEl = document.querySelector('.custom-discount-form p.error');

  fetchCurrentDiscountCodes().then(function (codes) {
    if (codes.indexOf(discountCode) !== -1) {
      if (errorEl) {
        errorEl.style.display = 'block';
        errorEl.textContent = 'Discount code already applied';
      }
      return;
    }
    codes.push(discountCode);

    fetch('/checkout?discount=' + codes.join(','), { method: 'GET' })
      .finally(function () {
        fetch('/cart.js', { method: 'GET' })
          .then(function (r) { return r.json(); })
          .then(function (data) {
            var applied = [];
            if (data.cart_level_discount_applications) {
              data.cart_level_discount_applications.forEach(function (d) {
                if (d.type === 'discount_code') applied.push(d.title);
              });
            }
            data.items.forEach(function (item) {
              if (item.line_level_discount_allocations) {
                item.line_level_discount_allocations.forEach(function (d) {
                  if (d.discount_application && d.discount_application.type === 'discount_code') {
                    applied.push(d.discount_application.title);
                  }
                });
              }
            });
            if (applied.indexOf(discountCode) === -1) {
              if (errorEl) {
                errorEl.style.display = 'block';
                errorEl.textContent = 'Enter a valid discount code or gift card';
              }
            } else {
              refreshCart();
              var inp = document.querySelector('.custom-discount-form input');
              if (inp) inp.value = '';
            }
          });
      });
  });
}

function removeDiscountCode(code) {
  fetchCurrentDiscountCodes().then(function (codes) {
    var remaining = codes.filter(function (c) { return c !== code; });
    fetch('/checkout?discount=' + remaining.join(','), { method: 'GET' })
      .finally(function () { refreshCart(); });
  });
}

/* ── delegated click handler (survives DOM refreshes) ────────── */

document.addEventListener('click', function (e) {

  /* Open cart drawer */
  if (e.target.closest('.header-cart')) {
    openCartDrawer();
    return;
  }

  /* Close cart drawer */
  if (e.target.closest('.overlay-box') || e.target.closest('.cart-drawer-close')) {
    closeCartDrawer();
    return;
  }

  /* Remove line item */
  var removeBtn = e.target.closest('.item-remove');
  if (removeBtn) {
    e.preventDefault();
    updateCartItemQuantity(removeBtn.dataset.line, 0);
    return;
  }

  /* Qty + (scoped to .cart-drawer) */
  if (e.target.closest('.cart-drawer .qty-plus')) {
    var row = e.target.closest('.item-row');
    if (!row) return;
    var input = row.querySelector('.qty-input');
    var rm    = row.querySelector('.item-remove');
    if (!input || !rm) return;
    updateCartItemQuantity(rm.dataset.line, (parseInt(input.value, 10) || 1) + 1);
    return;
  }

  /* Qty − */
  if (e.target.closest('.cart-drawer .qty-minus')) {
    var row2   = e.target.closest('.item-row');
    if (!row2) return;
    var input2 = row2.querySelector('.qty-input');
    var rm2    = row2.querySelector('.item-remove');
    if (!input2 || !rm2) return;
    var qty = parseInt(input2.value, 10) || 1;
    updateCartItemQuantity(rm2.dataset.line, qty > 1 ? qty - 1 : 0);
    return;
  }

  /* Upsell add-to-cart */
  var upsellBtn = e.target.closest('.js-upsell-add-to-cart');
  if (upsellBtn) {
    var variantId = upsellBtn.dataset.variantId;
    if (!variantId) return;
    upsellBtn.classList.add('loading');
    upsellBtn.disabled = true;

    fetch('/cart/add.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ id: variantId, quantity: 1 })
    })
      .then(function (r) {
        if (!r.ok) throw new Error('Add to cart failed');
        return r.json();
      })
      .then(function () { refreshCart(); })
      .catch(function (err) { console.error('Upsell add to cart error:', err); })
      .finally(function () {
        upsellBtn.classList.remove('loading');
        upsellBtn.disabled = false;
      });
    return;
  }

  /* Apply discount code */
  if (e.target.closest('.submit-discount')) {
    var inputEl  = document.querySelector('.custom-discount-form input');
    var errorEl2 = document.querySelector('.custom-discount-form p.error');
    var code2    = inputEl ? inputEl.value.trim() : '';
    if (errorEl2) errorEl2.style.display = 'none';

    if (code2 && code2.length) {
      applyDiscountCode(code2);
    } else if (errorEl2) {
      errorEl2.style.display = 'block';
      errorEl2.textContent = 'Enter a valid discount code or gift card';
    }
    return;
  }

  /* Remove discount code */
  var removeDiscount = e.target.closest('.remove-discount');
  if (removeDiscount) {
    removeDiscountCode(removeDiscount.dataset.code);
    return;
  }
});

/* ── keyboard: Escape to close + focus trap ──────────────────── */

document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape' && document.body.classList.contains('open-drawer')) {
    closeCartDrawer();
    return;
  }

  /* Focus trap inside the drawer */
  if (e.key === 'Tab' && document.body.classList.contains('open-drawer')) {
    var drawer = document.querySelector('.cart-sidebar');
    if (!drawer) return;

    var focusable = drawer.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (!focusable.length) return;

    var first = focusable[0];
    var last  = focusable[focusable.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }
});

/* ── initialise ──────────────────────────────────────────────── */

updateCartCount();
initSplide();
