document.addEventListener('DOMContentLoaded', () => {
  const productForm = document.querySelector('.product-form-snippet form');
  if (!productForm) return;

  const variantRadios = productForm.querySelectorAll('input[name="id"]');
  const addToCartBtn = productForm.querySelector('[type="submit"]');
  const qtyInput = productForm.querySelector('#quantity');
  const qtyMinus = productForm.querySelector('.qty-minus');
  const qtyPlus = productForm.querySelector('.qty-plus');

  function updateVariantState(radio) {
    const isAvailable = radio.dataset.available === 'true';

    productForm.querySelectorAll('.swatch-item').forEach(el => {
      el.classList.remove('active');
    });
    radio.closest('.swatch-item').classList.add('active');

    if (!isAvailable) {
      addToCartBtn.disabled = true;
      addToCartBtn.value = addToCartBtn.dataset.soldoutText || 'Sold out';
    } else {
      addToCartBtn.disabled = false;
      addToCartBtn.value = addToCartBtn.dataset.addText || 'Add to cart';
    }
  }

  variantRadios.forEach(radio => {
    radio.addEventListener('change', () => updateVariantState(radio));
  });

  const checkedVariant = productForm.querySelector('input[name="id"]:checked');
  if (checkedVariant) updateVariantState(checkedVariant);

  qtyPlus.addEventListener('click', () => {
    qtyInput.value = parseInt(qtyInput.value, 10) + 1;
  });

  qtyMinus.addEventListener('click', () => {
    const current = parseInt(qtyInput.value, 10);
    if (current > 1) qtyInput.value = current - 1;
  });

  /* ── AJAX add to cart → open drawer ─────────────────────── */
  productForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const selectedVariant = productForm.querySelector('input[name="id"]:checked');
    if (!selectedVariant) return;

    const variantId = selectedVariant.value;
    const quantity  = parseInt(qtyInput.value, 10) || 1;

    addToCartBtn.disabled = true;

    fetch('/cart/add.js', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ id: variantId, quantity: quantity })
    })
      .then(response => {
        if (!response.ok) return response.json().then(d => { throw d; });
        return response.json();
      })
      .then(() => {
        if (typeof load_cart === 'function') {
          load_cart().then(() => {
            if (typeof openCartDrawer === 'function') openCartDrawer();
          });
        } else {
          if (typeof openCartDrawer === 'function') openCartDrawer();
        }
      })
      .catch(err => {
        console.error('Add to cart error:', err);
        if (err && err.description) {
          alert(err.description);
        }
      })
      .finally(() => {
        addToCartBtn.disabled = false;
      });
  });
});