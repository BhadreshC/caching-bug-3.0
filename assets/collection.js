/**
 * Collection page
 *
 * Handles:
 * - Filter drawer open / close with focus trap & a11y
 * - AJAX filtering with dynamic "Show x results" button
 * - Sort select
 * - Infinite scroll (auto), load-more button, or classic pagination
 * - URL updates (?page=x, filter params, sort_by)
 */

(function () {
  'use strict';

  var section = document.querySelector('.section-collection');
  if (!section) return;

  var SECTION_ID  = section.dataset.sectionId;
  var LOAD_MODE   = section.dataset.loadMore || 'auto_scroll';

  var isLoading     = false;
  var _prevFocused  = null;

  /* ── helpers ───────────────────────────────────────────────── */

  function updateURL(url, replace) {
    if (replace) {
      window.history.replaceState({}, '', url);
    } else {
      window.history.pushState({}, '', url);
    }
  }

  /**
   * Fetch a section using the Sections Rendering API (?sections=).
   * This preserves template-assigned section settings unlike ?section_id=.
   * Returns a parsed Document from the section HTML.
   */
  function fetchSectionDoc(url) {
    var separator = url.indexOf('?') > -1 ? '&' : '?';
    var fetchUrl  = url + separator + 'sections=' + SECTION_ID;

    return fetch(fetchUrl)
      .then(function (res) { return res.json(); })
      .then(function (json) {
        var html = json[SECTION_ID];
        if (!html) throw new Error('Section not found in response');
        return new DOMParser().parseFromString(html, 'text/html');
      });
  }

  /* ── Section replacement (for filter / sort / popstate) ───── */

  function replaceSection(doc) {
    var newSection = doc.querySelector('.section-collection');
    if (newSection && section.parentNode) {
      section.parentNode.replaceChild(newSection, section);
      section = newSection;

      if (LOAD_MODE === 'auto_scroll') {
        initAutoScroll();
      }

      if (typeof quickAddButton === 'function') {
        quickAddButton();
      }
    }
  }

  /* ── Filter drawer ─────────────────────────────────────────── */

  function getFilterDrawer() {
    return section.querySelector('.collection-filter-drawer');
  }

  function openFilterDrawer() {
    var drawer = getFilterDrawer();
    if (!drawer) return;
    _prevFocused = document.activeElement;
    drawer.setAttribute('aria-hidden', 'false');
    document.body.classList.add('open-filter');
    drawer.focus();
  }

  function closeFilterDrawer() {
    var drawer = getFilterDrawer();
    document.body.classList.remove('open-filter');
    if (drawer) {
      drawer.setAttribute('aria-hidden', 'true');
    }
    if (_prevFocused && _prevFocused.focus) _prevFocused.focus();
  }

  /* ── Availability injection ───────────────────────────────── */

  /**
   * When a size filter is active, automatically add filter.v.availability=1
   * so only in-stock sizes are shown.
   */
  function injectAvailabilityForSize(params) {
    var hasSize = false;
    params.forEach(function (value, key) {
      if (key.toLowerCase().indexOf('size') > -1) {
        hasSize = true;
      }
    });
    if (hasSize) {
      params.set('filter.v.availability', '1');
    }
  }

  /* ── Dynamic "Show x results" on filter changes ────────────── */

  function updateResultCount() {
    var drawer = getFilterDrawer();
    if (!drawer) return;

    var form = drawer.querySelector('.collection-filter-form');
    if (!form) return;

    var formData = new FormData(form);
    var params   = new URLSearchParams();

    for (var pair of formData.entries()) {
      if (pair[1]) params.append(pair[0], pair[1]);
    }

    var sortSelect = section.querySelector('.collection-sort-select');
    if (sortSelect && sortSelect.value) {
      params.set('sort_by', sortSelect.value);
    }

    injectAvailabilityForSize(params);

    var fetchUrl = form.dataset.collectionUrl + '?' + params.toString();

    fetchSectionDoc(fetchUrl)
      .then(function (doc) {
        var newSection = doc.querySelector('.section-collection');
        if (!newSection) return;

        var count = newSection.dataset.productsCount || '0';
        var applyBtn = drawer.querySelector('.collection-filter-apply');
        if (applyBtn) {
          applyBtn.textContent = applyBtn.textContent.replace(/\d+/, count);
        }
      })
      .catch(console.error);
  }

  /* ── Filter form submit ────────────────────────────────────── */

  function handleFilterSubmit(e) {
    e.preventDefault();
    var form     = e.target;
    var formData = new FormData(form);
    var params   = new URLSearchParams();

    for (var pair of formData.entries()) {
      if (pair[1]) params.append(pair[0], pair[1]);
    }

    var sortSelect = section.querySelector('.collection-sort-select');
    if (sortSelect && sortSelect.value) {
      params.set('sort_by', sortSelect.value);
    }

    injectAvailabilityForSize(params);

    var newUrl = form.dataset.collectionUrl + '?' + params.toString();

    updateURL(newUrl);

    fetchSectionDoc(newUrl)
      .then(function (doc) {
        replaceSection(doc);
        closeFilterDrawer();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      })
      .catch(console.error);
  }

  /* ── Sort ──────────────────────────────────────────────────── */

  function handleSort(e) {
    var url = new URL(window.location.href);
    url.searchParams.set('sort_by', e.target.value);
    url.searchParams.delete('page');

    updateURL(url.toString());

    fetchSectionDoc(url.toString())
      .then(function (doc) {
        replaceSection(doc);
      })
      .catch(console.error);
  }

  /* ── Load more / infinite scroll ───────────────────────────── */

  function loadNextPage(loadMoreEl) {
    if (isLoading || !loadMoreEl) return;

    var nextUrl = loadMoreEl.getAttribute('href');
    if (!nextUrl) return;

    isLoading = true;
    loadMoreEl.classList.add('is-loading');

    fetchSectionDoc(nextUrl)
      .then(function (doc) {
        var productGrid = section.querySelector('.collection-grid');
        var newGrid     = doc.querySelector('.collection-grid');

        /* Append new products to the live grid */
        if (newGrid && productGrid) {
          var items = newGrid.querySelectorAll('.product-item');
          for (var i = 0; i < items.length; i++) {
            productGrid.appendChild(items[i]);
          }
        }

        /* Check if there is another page after the one we just loaded */
        var nextLink = doc.querySelector('[data-load-more]');
        var hasMore  = false;

        if (nextLink && nextLink.getAttribute('href')) {
          loadMoreEl.setAttribute('href', nextLink.getAttribute('href'));
          hasMore = true;
        } else {
          /* Fallback: use section data attributes to determine next page */
          var newSection = doc.querySelector('.section-collection');
          if (newSection) {
            var totalPages  = parseInt(newSection.dataset.totalPages) || 0;
            var currentPage = parseInt(newSection.dataset.currentPage) || 0;
            if (currentPage < totalPages) {
              var nextPageUrl = new URL(nextUrl, window.location.origin);
              nextPageUrl.searchParams.set('page', currentPage + 1);
              loadMoreEl.setAttribute('href', nextPageUrl.pathname + nextPageUrl.search);
              hasMore = true;
            }
          }
        }

        if (hasMore) {
          loadMoreEl.style.display = '';
        } else {
          /* No more pages — hide the trigger */
          loadMoreEl.style.display = 'none';
          if (autoScrollObserver) autoScrollObserver.disconnect();
        }

        /* Update "Page X of Y" text (load_more_btn mode) */
        var liveInfo = section.querySelector('.collection-pagination-info');
        var newInfo  = doc.querySelector('.collection-pagination-info');
        if (liveInfo && newInfo) {
          liveInfo.innerHTML = newInfo.innerHTML;
        } else if (liveInfo && !hasMore) {
          /* Last page reached — the fetched doc won't contain pagination-info
             because paginate.next is falsy, so update manually */
          var totalPages = section.dataset.totalPages || '?';
          liveInfo.textContent = liveInfo.textContent.replace(/\d+(\s*(?:of|\/)\s*)\d+/, totalPages + '$1' + totalPages);
        }

        /* Update URL with loaded page */
        try {
          var urlObj    = new URL(nextUrl, window.location.origin);
          var page      = urlObj.searchParams.get('page');
          if (page) {
            var currentUrl = new URL(window.location.href);
            currentUrl.searchParams.set('page', page);
            updateURL(currentUrl.toString(), true);
            section.dataset.currentPage = page;
          }
        } catch (e) { /* ignore URL parse errors */ }

        /* Re-bind quick add */
        if (typeof quickAddButton === 'function') {
          quickAddButton();
        }
      })
      .catch(function (err) {
        console.error('Load more error:', err);
      })
      .finally(function () {
        isLoading = false;
        loadMoreEl.classList.remove('is-loading');
      });
  }

  /* ── Auto scroll observer ──────────────────────────────────── */

  var autoScrollObserver = null;

  function initAutoScroll() {
    if (autoScrollObserver) autoScrollObserver.disconnect();

    var loadMoreEl = section.querySelector('.collection-load-more--auto[data-load-more]');
    if (!loadMoreEl) return;

    autoScrollObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting && !isLoading) {
          loadNextPage(loadMoreEl);
        }
      });
    }, { rootMargin: '200px' });

    autoScrollObserver.observe(loadMoreEl);
  }

  /* ── Delegated event listeners ─────────────────────────────── */

  /* Overlay click closes filter (capture phase to bypass cart-drawer stopPropagation) */
  var overlay = document.querySelector('.overlay-box');
  if (overlay) {
    overlay.addEventListener('click', function () {
      if (document.body.classList.contains('open-filter')) {
        closeFilterDrawer();
      }
    }, true);
  }

  document.addEventListener('click', function (e) {
    /* Open filter drawer */
    if (e.target.closest('.collection-filter-toggle')) {
      openFilterDrawer();
      return;
    }

    /* Close filter drawer */
    if (e.target.closest('.collection-filter-close')) {
      closeFilterDrawer();
      return;
    }

    /* Click on drawer backdrop (outside inner panel) */
    var drawer = getFilterDrawer();
    if (drawer && document.body.classList.contains('open-filter') && e.target === drawer) {
      closeFilterDrawer();
      return;
    }

    /* Load more button */
    var loadMoreBtn = e.target.closest('.collection-load-more--btn[data-load-more]');
    if (loadMoreBtn) {
      e.preventDefault();
      loadNextPage(loadMoreBtn);
      return;
    }
  });

  /* Escape key closes filter */
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && document.body.classList.contains('open-filter')) {
      closeFilterDrawer();
      return;
    }

    /* Focus trap inside filter drawer */
    if (e.key === 'Tab' && document.body.classList.contains('open-filter')) {
      var drawer = getFilterDrawer();
      if (!drawer) return;

      var focusable = drawer.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), details > summary'
      );
      if (!focusable.length) return;

      var first = focusable[0];
      var last  = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }
  });

  /* Sort change */
  document.addEventListener('change', function (e) {
    if (e.target.closest('.collection-sort-select')) {
      handleSort(e);
    }

    if (e.target.closest('.collection-filter-form')) {
      updateResultCount();
    }
  });

  /* Filter range inputs */
  document.addEventListener('input', function (e) {
    if (e.target.closest('.collection-filter-price input')) {
      clearTimeout(e.target._debounce);
      e.target._debounce = setTimeout(updateResultCount, 400);
    }
  });

  /* Filter form submit */
  document.addEventListener('submit', function (e) {
    if (e.target.closest('.collection-filter-form')) {
      handleFilterSubmit(e);
    }
  });

  /* Browser back/forward */
  window.addEventListener('popstate', function () {
    fetchSectionDoc(window.location.href)
      .then(function (doc) {
        replaceSection(doc);
      })
      .catch(console.error);
  });

  /* ── Init ──────────────────────────────────────────────────── */

  if (LOAD_MODE === 'auto_scroll') {
    initAutoScroll();
  }

})();
