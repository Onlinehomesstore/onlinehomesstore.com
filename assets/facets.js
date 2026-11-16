class FacetFiltersForm extends HTMLElement {
  constructor() {
    super();
    this.onActiveFilterClick = this.onActiveFilterClick.bind(this);

    this.debouncedOnSubmit = debounce((event) => {
      this.onSubmitHandler(event);
    }, 320);

    const facetForm = this.querySelector('form');
    facetForm.addEventListener('input', (event) => {
      const t = event.target;
      if (!t) return;
      if (
        t.closest('price-range') ||
        t.classList.contains('uf-price__input') ||
        t.getAttribute('inputmode') === 'decimal' ||
        (t.matches && t.matches('input[type="text"]'))
      ) {
        return;
      }
      this.debouncedOnSubmit(event);
    });
    facetForm.addEventListener('change', this.debouncedOnSubmit.bind(this));

    const facetWrapper = this.querySelector('#FacetsWrapperDesktop');
    if (facetWrapper) facetWrapper.addEventListener('keyup', onKeyUpEscape);
  }

  static setListeners() {
    const onHistoryChange = (event) => {
      const searchParams = event.state ? event.state.searchParams : FacetFiltersForm.searchParamsInitial;
      if (searchParams === FacetFiltersForm.searchParamsPrev) return;
      FacetFiltersForm.renderPage(searchParams, null, false);
    };
    window.addEventListener('popstate', onHistoryChange);
  }

  static toggleActiveFacets(disable = true) {
    document.querySelectorAll('.js-facet-remove').forEach((element) => {
      element.classList.toggle('disabled', disable);
    });
  }

  static getCollectionEl(container) {
    if (!container) return null;
    return container.querySelector('.collection, .collection--empty');
  }

  static beginGridUpdate() {
    const container = document.getElementById('ProductGridContainer');
    if (!container) return;
    const height = container.offsetHeight;
    if (height > 0) container.style.minHeight = `${height}px`;
    container.classList.add('is-filtering');
  }

  static endGridUpdate() {
    const container = document.getElementById('ProductGridContainer');
    if (!container) return;
    container.classList.remove('is-filtering');
    requestAnimationFrame(() => {
      container.style.minHeight = '';
    });
  }

  static swapCollectionContent(oldCollection, newCollection) {
    if (!oldCollection || !newCollection) return false;

    const overlay = oldCollection.querySelector('.loading-overlay');
    Array.from(oldCollection.children).forEach((child) => {
      if (!child.classList.contains('loading-overlay')) child.remove();
    });

    Array.from(newCollection.children).forEach((child) => {
      if (!child.classList.contains('loading-overlay')) {
        oldCollection.appendChild(child.cloneNode(true));
      }
    });

    if (overlay) {
      oldCollection.insertBefore(overlay, oldCollection.firstChild);
    }

    return true;
  }

  static clearLoadingState() {
    const grid = document.getElementById('ProductGridContainer');
    if (grid) {
      grid.querySelectorAll('.collection, .collection--empty').forEach((el) => el.classList.remove('loading'));
    }
    const countContainer = document.getElementById('ProductCount');
    const countContainerDesktop = document.getElementById('ProductCountDesktop');
    if (countContainer) countContainer.classList.remove('loading');
    if (countContainerDesktop) countContainerDesktop.classList.remove('loading');
    document.querySelectorAll(
      '.facets-container .loading__spinner, facet-filters-form .loading__spinner',
    ).forEach((spinner) => spinner.classList.add('hidden'));
  }

  static renderPage(searchParams, event, updateURLHash = true) {
    FacetFiltersForm.searchParamsPrev = searchParams;
    const sections = FacetFiltersForm.getSections();
    const updateEvent = FacetFiltersForm.startUpdateEvent(searchParams);
    const countContainer = document.getElementById('ProductCount');
    const countContainerDesktop = document.getElementById('ProductCountDesktop');
    const loadingSpinners = document.querySelectorAll(
      '.facets-container .loading__spinner, facet-filters-form .loading__spinner',
    );
    loadingSpinners.forEach((spinner) => spinner.classList.remove('hidden'));
    FacetFiltersForm.beginGridUpdate();
    const collectionEl = FacetFiltersForm.getCollectionEl(document.getElementById('ProductGridContainer'));
    if (collectionEl) collectionEl.classList.add('loading');
    if (countContainer) {
      countContainer.classList.add('loading');
    }
    if (countContainerDesktop) {
      countContainerDesktop.classList.add('loading');
    }

    if (!sections.length) {
      FacetFiltersForm.clearLoadingState();
      FacetFiltersForm.endGridUpdate();
      return;
    }

    sections.forEach((section) => {
      const url = `${window.location.pathname}?section_id=${section.section}&${searchParams}`;
      const filterDataUrl = (element) => element.url === url;

      FacetFiltersForm.filterData.some(filterDataUrl)
        ? FacetFiltersForm.renderSectionFromCache(filterDataUrl, event, updateEvent)
        : FacetFiltersForm.renderSectionFromFetch(url, event, updateEvent);
    });

    if (updateURLHash) FacetFiltersForm.updateURLHash(searchParams);
  }

  static startUpdateEvent(searchParams) {
    const { SearchUpdateEvent, CollectionUpdateEvent } = window.StandardEvents || {};
    if (!SearchUpdateEvent && !CollectionUpdateEvent) return;

    const facetsForm = document.querySelector('facet-filters-form');
    const facetsContainer = document.querySelector('.facets-container');
    const collectionId = facetsContainer?.dataset.collectionId || null;
    const collectionHandle = facetsContainer?.dataset.collectionHandle || '';
    const currentCount = parseInt(document.getElementById('ProductCount')?.dataset.productCount) || 0;
    const urlSearchParams = new URLSearchParams(searchParams);
    const isSearchPage = facetsContainer?.dataset.template === 'search';
    const isCollectionPage = facetsContainer?.dataset.template === 'collection';
    const dispatchTarget = facetsForm || document;

    let deferred;

    if (isSearchPage) {
      deferred = SearchUpdateEvent.createPromise();
      dispatchTarget.dispatchEvent(
        new SearchUpdateEvent({
          search: {
            query: urlSearchParams.get('q') || '',
            productFilters: SearchUpdateEvent.parseProductFilters(urlSearchParams),
            sortKey: SearchUpdateEvent.getSortKey(urlSearchParams),
          },
          promise: deferred.promise,
        }),
      );
    } else if (isCollectionPage) {
      // collectionId is null for auto-generated collections (/collections/all,
      // /collections/vendors/<x>, etc.) — the SSE schema accepts that.
      deferred = CollectionUpdateEvent.createPromise();
      dispatchTarget.dispatchEvent(
        new CollectionUpdateEvent({
          collection: { id: collectionId, handle: collectionHandle, productsCount: currentCount },
          productFilters: CollectionUpdateEvent.parseProductFilters(urlSearchParams),
          sortKey: CollectionUpdateEvent.getSortKey(urlSearchParams),
          promise: deferred.promise,
        }),
      );
    }

    if (!deferred) return;

    return {
      resolve: (filteredCount) => {
        deferred.resolve({ [isSearchPage ? 'totalCount' : 'productsCount']: filteredCount });
      },
      reject: deferred.reject,
    };
  }

  static renderSectionFromFetch(url, event, updateEvent) {
    fetch(url)
      .then((response) => response.text())
      .then((html) => {
        FacetFiltersForm.filterData = [...FacetFiltersForm.filterData, { html, url }];
        FacetFiltersForm.renderSection(html, event, updateEvent);
      })
      .catch((error) => {
        console.error(error);
        FacetFiltersForm.clearLoadingState();
        updateEvent?.reject(error);
      });
  }

  static renderSectionFromCache(filterDataUrl, event, updateEvent) {
    const html = FacetFiltersForm.filterData.find(filterDataUrl).html;
    FacetFiltersForm.renderSection(html, event, updateEvent);
  }

  static renderSection(html, event, updateEvent) {
    try {
      FacetFiltersForm.renderProductGridContainer(html);
    } catch (err) {
      console.error('[UC facets] grid', err);
      FacetFiltersForm.clearLoadingState();
      FacetFiltersForm.endGridUpdate();
    }

    try {
      FacetFiltersForm.renderFilters(html, event);
    } catch (err) {
      console.error('[UC facets] filters', err);
    }

    try {
      FacetFiltersForm.renderProductCount(html, updateEvent);
    } catch (err) {
      console.error('[UC facets] count', err);
      FacetFiltersForm.clearLoadingState();
      FacetFiltersForm.endGridUpdate();
      updateEvent?.reject?.(err);
    }
  }

  static revealFilteredCards(container) {
    if (!container) return;
    container.querySelectorAll('.scroll-trigger').forEach((el) => {
      el.classList.add('scroll-trigger--cancel');
      el.classList.remove('scroll-trigger--offscreen');
    });
    container.querySelectorAll('.pc-card, .grid__item, [data-uc-reveal]').forEach((el) => {
      el.classList.add('is-visible', 'is-revealed', 'cs-is-visible');
      el.style.opacity = '';
      el.style.transform = '';
    });
  }

  static renderProductGridContainer(html) {
    const container = document.getElementById('ProductGridContainer');
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    const newContainer = parsed.getElementById('ProductGridContainer');
    if (!container || !newContainer) {
      FacetFiltersForm.clearLoadingState();
      FacetFiltersForm.endGridUpdate();
      return;
    }

    const keepY = window.scrollY || window.pageYOffset || 0;
    container.innerHTML = newContainer.innerHTML;
    FacetFiltersForm.revealFilteredCards(container);
    if (Math.abs((window.scrollY || 0) - keepY) > 2) {
      window.scrollTo({ top: keepY, left: 0, behavior: 'auto' });
    }

    if (typeof window.customElements !== 'undefined' && window.customElements.upgrade) {
      try {
        window.customElements.upgrade(container);
      } catch (e) {}
    }

    document.dispatchEvent(
      new CustomEvent('uc:facets:grid-updated', { bubbles: true, detail: { container } }),
    );

    FacetFiltersForm.clearLoadingState();
    FacetFiltersForm.endGridUpdate();
  }

  static renderProductCount(html, updateEvent) {
    const parsedHtml = new DOMParser().parseFromString(html, 'text/html');
    const sourceCount =
      parsedHtml.getElementById('ProductCount') || parsedHtml.getElementById('ProductCountDesktop');
    if (!sourceCount) {
      FacetFiltersForm.clearLoadingState();
      updateEvent?.resolve(0);
      return;
    }
    const count = sourceCount.innerHTML;
    const container = document.getElementById('ProductCount');
    const containerDesktop = document.getElementById('ProductCountDesktop');
    if (container) {
      container.innerHTML = count;
      container.dataset.productCount = sourceCount.dataset.productCount || '';
      container.dataset.totalCount = sourceCount.dataset.totalCount || '';
      container.classList.remove('loading');
    }
    if (containerDesktop) {
      containerDesktop.innerHTML = count;
      containerDesktop.classList.remove('loading');
    }
    document.querySelectorAll(
      '.facets-container .loading__spinner, facet-filters-form .loading__spinner',
    ).forEach((spinner) => spinner.classList.add('hidden'));

    FacetFiltersForm.clearLoadingState();

    updateEvent?.resolve(parseInt(sourceCount.dataset.productCount, 10) || 0);
  }

  static renderFilters(html, event) {
    const parsedHTML = new DOMParser().parseFromString(html, 'text/html');
    const facetDetailsElementsFromFetch = parsedHTML.querySelectorAll(
      '#FacetFiltersForm .js-filter, #FacetFiltersFormMobile .js-filter, #FacetFiltersPillsForm .js-filter',
    );
    const facetDetailsElementsFromDom = document.querySelectorAll(
      '#FacetFiltersForm .js-filter, #FacetFiltersFormMobile .js-filter, #FacetFiltersPillsForm .js-filter',
    );

    // Remove facets that are no longer returned from the server
    Array.from(facetDetailsElementsFromDom).forEach((currentElement) => {
      if (!Array.from(facetDetailsElementsFromFetch).some(({ id }) => currentElement.id === id)) {
        currentElement.remove();
      }
    });

    const matchesId = (element) => {
      const jsFilter = event ? event.target.closest('.js-filter') : undefined;
      return jsFilter ? element.id === jsFilter.id : false;
    };

    const facetsToRender = Array.from(facetDetailsElementsFromFetch).filter((element) => !matchesId(element));
    const countsToRender = Array.from(facetDetailsElementsFromFetch).find(matchesId);

    facetsToRender.forEach((elementToRender, index) => {
      const currentElement = document.getElementById(elementToRender.id);
      // Element already rendered in the DOM so just update the innerHTML
      if (currentElement) {
        document.getElementById(elementToRender.id).innerHTML = elementToRender.innerHTML;
      } else {
        if (index > 0) {
          const { className: previousElementClassName, id: previousElementId } = facetsToRender[index - 1];
          // Same facet type (eg horizontal/vertical or drawer/mobile)
          if (elementToRender.className === previousElementClassName) {
            document.getElementById(previousElementId).after(elementToRender);
            return;
          }
        }

        if (elementToRender.parentElement) {
          document.querySelector(`#${elementToRender.parentElement.id} .js-filter`).before(elementToRender);
        }
      }
    });

    FacetFiltersForm.renderActiveFacets(parsedHTML);
    FacetFiltersForm.renderAdditionalElements(parsedHTML);

    if (countsToRender && event && event.target) {
      const closestFilter = event.target.closest('.js-filter');
      const closestJSFilterID = closestFilter ? closestFilter.id : '';

      if (closestJSFilterID) {
        FacetFiltersForm.renderCounts(countsToRender, event.target.closest('.js-filter'));
        FacetFiltersForm.renderMobileCounts(countsToRender, document.getElementById(closestJSFilterID));

        const newFacetDetailsElement = document.getElementById(closestJSFilterID);

        const isTextInput = event.target.getAttribute('type') === 'text';

        if (!isTextInput) {
          // Try to return focus to the same checkbox the user just toggled,
          // re-selecting it from the freshly rendered HTML by its id.
          const originatingInputId = event.target.id;
          const matchingInput = originatingInputId
            ? newFacetDetailsElement.querySelector(`#${CSS.escape(originatingInputId)}`)
            : null;

          if (matchingInput) {
            matchingInput.focus();
          } else {
            // Fallback to summary/close button if the checkbox can't be found
            const fallbackSelector = newFacetDetailsElement.classList.contains('mobile-facets__details')
              ? `.mobile-facets__close-button`
              : `.facets__summary`;
            const fallbackElement = newFacetDetailsElement.querySelector(fallbackSelector);
            if (fallbackElement) fallbackElement.focus();
          }
        }
      }
    }
  }

  static renderActiveFacets(html) {
    const activeFacetElementSelectors = ['.active-facets-mobile', '.active-facets-desktop'];

    activeFacetElementSelectors.forEach((selector) => {
      const activeFacetsElement = html.querySelector(selector);
      const activeFacetsTarget = document.querySelector(selector);
      if (!activeFacetsElement || !activeFacetsTarget) return;
      activeFacetsTarget.innerHTML = activeFacetsElement.innerHTML;
    });

    FacetFiltersForm.toggleActiveFacets(false);
  }

  static renderAdditionalElements(html) {
    const mobileElementSelectors = ['.mobile-facets__open', '.mobile-facets__count', '.sorting'];

    mobileElementSelectors.forEach((selector) => {
      const source = html.querySelector(selector);
      const dest = document.querySelector(selector);
      if (!source || !dest) return;
      dest.innerHTML = source.innerHTML;
    });

    const mobileForm = document.getElementById('FacetFiltersFormMobile');
    const drawer = mobileForm && mobileForm.closest('menu-drawer');
    if (drawer && typeof drawer.bindEvents === 'function') drawer.bindEvents();
  }

  static renderCounts(source, target) {
    const targetSummary = target.querySelector('.facets__summary');
    const sourceSummary = source.querySelector('.facets__summary');

    if (sourceSummary && targetSummary) {
      targetSummary.outerHTML = sourceSummary.outerHTML;
    }

    const targetHeaderElement = target.querySelector('.facets__header');
    const sourceHeaderElement = source.querySelector('.facets__header');

    if (sourceHeaderElement && targetHeaderElement) {
      targetHeaderElement.outerHTML = sourceHeaderElement.outerHTML;
    }

    const targetWrapElement = target.querySelector('.facets-wrap');
    const sourceWrapElement = source.querySelector('.facets-wrap');

    if (sourceWrapElement && targetWrapElement) {
      const isShowingMore = Boolean(target.querySelector('show-more-button .label-show-more.hidden'));
      if (isShowingMore) {
        sourceWrapElement
          .querySelectorAll('.facets__item.hidden')
          .forEach((hiddenItem) => hiddenItem.classList.replace('hidden', 'show-more-item'));
      }

      targetWrapElement.outerHTML = sourceWrapElement.outerHTML;
    }
  }

  static renderMobileCounts(source, target) {
    const targetFacetsList = target.querySelector('.mobile-facets__list');
    const sourceFacetsList = source.querySelector('.mobile-facets__list');

    if (sourceFacetsList && targetFacetsList) {
      targetFacetsList.outerHTML = sourceFacetsList.outerHTML;
    }
  }

  static updateURLHash(searchParams) {
    history.pushState({ searchParams }, '', `${window.location.pathname}${searchParams && '?'.concat(searchParams)}`);
  }

  static getSections() {
    const grid = document.getElementById('product-grid');
    const filters =
      document.getElementById('main-collection-filters') || document.getElementById('main-search-filters');
    const sectionId = (grid && grid.dataset.id) || (filters && filters.dataset.id);
    if (!sectionId) return [];
    return [{ section: sectionId }];
  }

  createSearchParams(form) {
    const formData = new FormData(form);
    const params = new URLSearchParams();

    formData.forEach((value, key) => {
      if (value === null || value === undefined) return;
      const normalized = String(value).trim();
      if (normalized === '') return;

      if (key.includes('price')) {
        const price = normalized.replace(/[^\d.,]/g, '').replace(',', '.');
        if (price === '' || Number.isNaN(Number(price))) return;
        params.append(key, price);
        return;
      }

      params.append(key, normalized);
    });

    return params.toString();
  }

  onSubmitForm(searchParams, event) {
    FacetFiltersForm.renderPage(searchParams, event);
  }

  onSubmitHandler(event) {
    event.preventDefault();
    const sortFilterForms = document.querySelectorAll('facet-filters-form form');
    if (event.srcElement.className == 'mobile-facets__checkbox') {
      const searchParams = this.createSearchParams(event.target.closest('form'));
      this.onSubmitForm(searchParams, event);
    } else {
      const forms = [];
      const isMobile = event.target.closest('form').id === 'FacetFiltersFormMobile';

      sortFilterForms.forEach((form) => {
        if (!isMobile) {
          if (form.id === 'FacetSortForm' || form.id === 'FacetFiltersForm' || form.id === 'FacetSortDrawerForm') {
            forms.push(this.createSearchParams(form));
          }
        } else if (form.id === 'FacetFiltersFormMobile') {
          forms.push(this.createSearchParams(form));
        }
      });
      this.onSubmitForm(forms.join('&'), event);
    }
  }

  onActiveFilterClick(event) {
    event.preventDefault();
    FacetFiltersForm.toggleActiveFacets();
    const url =
      event.currentTarget.href.indexOf('?') == -1
        ? ''
        : event.currentTarget.href.slice(event.currentTarget.href.indexOf('?') + 1);
    FacetFiltersForm.renderPage(url);
  }
}

FacetFiltersForm.filterData = [];
FacetFiltersForm.searchParamsInitial = window.location.search.slice(1);
FacetFiltersForm.searchParamsPrev = window.location.search.slice(1);
customElements.define('facet-filters-form', FacetFiltersForm);
FacetFiltersForm.setListeners();

class PriceRange extends HTMLElement {
  constructor() {
    super();
    this.querySelectorAll('input').forEach((element) => {
      element.addEventListener('change', this.onRangeChange.bind(this));
      element.addEventListener('keydown', this.onKeyDown.bind(this));
    });
    this.setMinAndMaxValues();
  }

  onRangeChange(event) {
    this.adjustToValidValues(event.currentTarget);
    this.setMinAndMaxValues();
  }

  onKeyDown(event) {
    if (event.metaKey) return;

    if (event.key === 'Enter') {
      event.preventDefault();
      this.adjustToValidValues(event.currentTarget);
      this.setMinAndMaxValues();
      event.currentTarget.blur();
      event.currentTarget.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }

    const pattern = /[0-9]|\.|,|'| |Tab|Backspace|Enter|ArrowUp|ArrowDown|ArrowLeft|ArrowRight|Delete|Escape/;
    if (!event.key.match(pattern)) event.preventDefault();
  }

  setMinAndMaxValues() {
    const inputs = this.querySelectorAll('input');
    const minInput = inputs[0];
    const maxInput = inputs[1];
    if (!minInput || !maxInput) return;
    if (maxInput.value) minInput.setAttribute('data-max', maxInput.value);
    if (minInput.value) maxInput.setAttribute('data-min', minInput.value);
    if (minInput.value === '') maxInput.setAttribute('data-min', 0);
    if (maxInput.value === '') minInput.setAttribute('data-max', minInput.getAttribute('data-max'));
  }

  adjustToValidValues(input) {
    const raw = String(input.value || '').trim().replace(',', '.');
    if (raw === '') return;
    const value = Number(raw);
    if (!Number.isFinite(value)) return;
    const min = Number(input.getAttribute('data-min'));
    const max = Number(input.getAttribute('data-max'));

    if (Number.isFinite(min) && value < min) input.value = min;
    if (Number.isFinite(max) && value > max) input.value = max;
  }
}

customElements.define('price-range', PriceRange);

class FacetRemove extends HTMLElement {
  constructor() {
    super();
    const facetLink = this.querySelector('a');
    facetLink.setAttribute('role', 'button');
    facetLink.addEventListener('click', this.closeFilter.bind(this));
    facetLink.addEventListener('keyup', (event) => {
      event.preventDefault();
      if (event.code.toUpperCase() === 'SPACE') this.closeFilter(event);
    });
  }

  closeFilter(event) {
    event.preventDefault();
    const form = this.closest('facet-filters-form') || document.querySelector('facet-filters-form');
    form.onActiveFilterClick(event);
  }
}

customElements.define('facet-remove', FacetRemove);
