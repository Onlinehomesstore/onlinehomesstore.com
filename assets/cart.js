class CartRemoveButton extends HTMLElement {
  constructor() {
    super();

    this.addEventListener('click', (event) => {
      event.preventDefault();
      const cartItems = this.closest('cart-items') || this.closest('cart-drawer-items');
      cartItems.updateQuantity(this.dataset.index, 0, event);
    });
  }
}

customElements.define('cart-remove-button', CartRemoveButton);

class CartItems extends window.StandardEvents.createViewEventElement(HTMLElement) {
  constructor() {
    super();
    this.lineItemStatusElement =
      document.getElementById('shopping-cart-line-item-status') || document.getElementById('CartDrawer-LineItemStatus');

    const debouncedOnChange = debounce((event) => {
      this.onChange(event);
    }, ON_CHANGE_DEBOUNCE_TIMER);

    this.addEventListener('change', debouncedOnChange.bind(this));
  }

  cartUpdateUnsubscriber = undefined;

  static pendingCartDataPromise = null;

  connectedCallback() {
    // The factory base class auto-dispatches cart:view from the
    // `view-event-payload` attribute (Liquid filter output). The drawer
    // sets `view-event-trigger="manual"` to skip auto-dispatch.
    super.connectedCallback();

    this.cartUpdateUnsubscriber = subscribe(PUB_SUB_EVENTS.cartUpdate, (event) => {
      if (event.source === 'cart-items') {
        var origin = event.context || 'page';
        if (this.tagName === 'CART-DRAWER-ITEMS' && origin !== 'drawer') {
          return this.onCartUpdate();
        }
        if (this.tagName === 'CART-ITEMS' && origin === 'drawer') {
          return this.onCartUpdate();
        }
        return;
      }
      return this.onCartUpdate();
    });
  }

  // Fetches the full cart shape (used to resolve the cart:lines-update event
  // promise after /cart/add.js, which only returns the added line — not the
  // post-mutation cart aggregates). De-duplicated across concurrent callers.
  static fetchCartData() {
    if (!CartItems.pendingCartDataPromise) {
      const pendingCartDataPromise = fetch(`${routes.cart_url}.json`)
        .then((response) => response.json())
        .catch(() => null)
        .finally(() => {
          if (CartItems.pendingCartDataPromise === pendingCartDataPromise) CartItems.pendingCartDataPromise = null;
        });

      CartItems.pendingCartDataPromise = pendingCartDataPromise;
    }
    return CartItems.pendingCartDataPromise;
  }

  disconnectedCallback() {
    if (this.cartUpdateUnsubscriber) {
      this.cartUpdateUnsubscriber();
    }
  }

  resetQuantityInput(id) {
    const input = this.querySelector(`#Quantity-${id}`);
    input.value = input.getAttribute('value');
    this.isEnterPressed = false;
  }

  setValidity(event, index, message) {
    const lineError = document.getElementById(`Line-item-error-${index}`);
    const errorText = lineError && lineError.querySelector('.cart-item__error-text');

    if (lineError && errorText) {
      errorText.textContent = message;
      event.target.setCustomValidity('');
      this.resetQuantityInput(index);
      event.target.select();
      return;
    }

    event.target.setCustomValidity(message);
    event.target.reportValidity();
    this.resetQuantityInput(index);
    event.target.select();
  }

  validateQuantity(event) {
    if (!event.target.classList.contains('quantity__input')) return;

    const inputValue = parseInt(event.target.value, 10);
    const index = event.target.dataset.index;
    const min = parseInt(event.target.dataset.min, 10) || 0;
    const max = event.target.max ? parseInt(event.target.max, 10) : null;
    const step = parseInt(event.target.step, 10) || 1;
    let message = '';

    if (Number.isNaN(inputValue) || inputValue < min) {
      message = window.quickOrderListStrings.min_error.replace('[min]', String(min));
    } else if (max !== null && inputValue > max) {
      message = window.quickOrderListStrings.max_error.replace('[max]', String(max));
    } else if (step > 1 && inputValue % step !== 0) {
      message = window.quickOrderListStrings.step_error.replace('[step]', String(step));
    }

    if (message) {
      this.setValidity(event, index, message);
    } else {
      const lineError = document.getElementById(`Line-item-error-${index}`);
      const errorText = lineError && lineError.querySelector('.cart-item__error-text');
      if (errorText) errorText.textContent = '';
      event.target.setCustomValidity('');
      this.updateQuantity(
        index,
        inputValue,
        event,
        document.activeElement.getAttribute('name'),
        event.target.dataset.quantityVariantId
      );
    }
  }

  onChange(event) {
    if (!event.target.classList.contains('quantity__input')) return;
    this.validateQuantity(event);
  }

  onCartUpdate() {
    if (this.tagName === 'CART-DRAWER-ITEMS') {
      if (window.UCCart && typeof window.UCCart.refreshCartDrawer === 'function') {
        return window.UCCart.refreshCartDrawer().then(function () {
          if (window.UCCart.fetchCartJson) {
            return window.UCCart.fetchCartJson().then(function (cart) {
              if (cart && window.UCCart.applyCartUi) window.UCCart.applyCartUi(cart);
            });
          }
        });
      }
      return fetch(`${routes.cart_url}?section_id=cart-drawer`)
        .then((response) => response.text())
        .then((responseText) => {
          const html = new DOMParser().parseFromString(responseText, 'text/html');
          const selectors = ['cart-drawer-items', '.cart-drawer__footer'];
          for (const selector of selectors) {
            const targetElement = document.querySelector(selector);
            const sourceElement = html.querySelector(selector);
            if (targetElement && sourceElement) {
              targetElement.replaceWith(sourceElement);
            }
          }
        })
        .catch((e) => {
          console.error(e);
        });
    } else if (window.UCCart && typeof window.UCCart.refreshCartPage === 'function') {
      return window.UCCart.refreshCartPage();
    } else {
      return fetch(`${routes.cart_url}?section_id=main-cart-items`)
        .then((response) => response.text())
        .then((responseText) => {
          const html = new DOMParser().parseFromString(responseText, 'text/html');
          const sourceQty = html.querySelector('cart-items');
          if (sourceQty) this.innerHTML = sourceQty.innerHTML;
        })
        .catch((e) => {
          console.error(e);
        });
    }
  }

  getSectionsToRender() {
    const itemsEl = document.getElementById('main-cart-items');
    const cartItemsEl = document.querySelector('cart-items');
    const footerEl = document.getElementById('main-cart-footer');
    const itemsSectionId = (itemsEl && itemsEl.dataset.id) || (cartItemsEl && cartItemsEl.dataset.sectionId);
    const footerSectionId = footerEl && footerEl.dataset.id;

    const sections = [
      {
        id: 'main-cart-items',
        section: itemsSectionId,
        selector: '.js-contents',
      },
      {
        id: 'cart-live-region-text',
        section: 'cart-live-region-text',
        selector: '.shopify-section',
      },
      {
        id: 'main-cart-footer',
        section: footerSectionId,
        selector: '.uc-cartx__summary .js-contents',
        footerPay: '.uc-cartx__pay',
        footerCoupon: '[data-uc-coupon]',
      },
    ];
    const bubble = document.getElementById('cart-icon-bubble');
    if (bubble && !bubble.classList.contains('uc-phdr__tool')) {
      sections.splice(1, 0, {
        id: 'cart-icon-bubble',
        section: 'cart-icon-bubble',
        selector: '.shopify-section',
      });
    }
    return sections;
  }

  updateQuantity(line, quantity, event, name, variantId) {
    const eventTarget = event.currentTarget instanceof CartRemoveButton ? 'clear' : 'change';
    const cartPerformanceUpdateMarker = CartPerformance.createStartingMarker(`${eventTarget}:user-action`);

    this.enableLoading(line);
    this._qtyGen = (this._qtyGen || 0) + 1;
    const gen = this._qtyGen;

    const action = quantity === 0 ? 'remove' : 'update';
    const quantityInput = this.querySelector(`#Quantity-${line}`) || this.querySelector(`#Drawer-quantity-${line}`);
    const lineVariantId = variantId || quantityInput?.dataset.quantityVariantId;
    const lineKey = quantityInput?.dataset.quantityLineKey;
    const linesUpdateDeferred = this.createCartLinesUpdateEvent(action, lineVariantId, quantity, lineKey);

    // Cache sections before the fetch so we read dataset.id while elements still exist in the DOM
    const sectionsToRender = this.getSectionsToRender();

    const body = JSON.stringify({
      line,
      quantity,
      sections: sectionsToRender.map((section) => section.section).filter(Boolean),
      sections_url: window.location.pathname,
    });

    const execute = () => {
      if (gen !== this._qtyGen) return Promise.resolve(null);

      return fetch(`${routes.cart_change_url}`, { ...fetchConfig(), ...{ body } })
      .then((response) => {
        return response.text();
      })
      .then((state) => {
        if (gen !== this._qtyGen) return null;
        const parsedState = JSON.parse(state);

        if (parsedState.errors) {
          this.dispatchCartErrorEvent(parsedState.errors, 'INVALID');
          linesUpdateDeferred?.reject(new Error(parsedState.errors));
          const quantityElement =
            document.getElementById(`Quantity-${line}`) || document.getElementById(`Drawer-quantity-${line}`);
          if (quantityElement) {
            quantityElement.value = quantityElement.getAttribute('value');
            this.updateLiveRegions(line, parsedState.errors);
          }
          return null;
        }

        this.resolveCartLinesUpdate(linesUpdateDeferred, parsedState);

        const syncDiscount =
          window.UCCart && typeof window.UCCart.reapplyDiscountAfterCartChange === 'function'
            ? window.UCCart.reapplyDiscountAfterCartChange(parsedState)
            : Promise.resolve(parsedState);

        return syncDiscount.then((finalState) => finalState || parsedState);
      })
      .then((parsedState) => {
        if (!parsedState || gen !== this._qtyGen) return;

        CartPerformance.measure(`${eventTarget}:paint-updated-sections`, () => {
          const quantityElement =
            document.getElementById(`Quantity-${line}`) || document.getElementById(`Drawer-quantity-${line}`);
          const items = document.querySelectorAll('.cart-item');

          this.classList.toggle('is-empty', parsedState.item_count === 0);
          const cartDrawerWrapper = document.querySelector('cart-drawer');
          const cartFooter = document.getElementById('main-cart-footer');

          if (cartFooter) cartFooter.classList.toggle('is-empty', parsedState.item_count === 0);
          if (cartDrawerWrapper) cartDrawerWrapper.classList.toggle('is-empty', parsedState.item_count === 0);

          if (window.UCCart && typeof window.UCCart.applyCartSectionResponse === 'function') {
            window.UCCart.applyCartSectionResponse(parsedState).then(function () {
              if (window.UCCart.syncCartSummary) window.UCCart.syncCartSummary(parsedState);
            });
          } else {
            sectionsToRender.forEach((section) => {
              const root = document.getElementById(section.id);
              if (!root) return;
              if (section.id === 'cart-icon-bubble' && root.classList.contains('uc-phdr__tool')) return;
              if (!parsedState.sections || !parsedState.sections[section.section]) return;

              const sectionHtml = parsedState.sections[section.section];
              const elementToReplace = root.querySelector(section.selector) || root;
              const nextHtml = this.getSectionInnerHTML(sectionHtml, section.selector);
              if (nextHtml) elementToReplace.innerHTML = nextHtml;

              if (section.footerCoupon) {
                const couponTarget = root.querySelector(section.footerCoupon);
                const couponSource = this.getSectionNode(sectionHtml, section.footerCoupon);
                if (couponTarget && couponSource) couponTarget.replaceWith(couponSource);
              }

              if (section.footerPay) {
                const payTarget = root.querySelector(section.footerPay);
                const payHtml = this.getSectionInnerHTML(sectionHtml, section.footerPay);
                if (payTarget && payHtml) payTarget.innerHTML = payHtml;
              }
            });
            if (window.UCCart && typeof window.UCCart.applyCartUi === 'function') {
              window.UCCart.applyCartUi(parsedState);
            }
          }
          const updatedValue = parsedState.items[line - 1] ? parsedState.items[line - 1].quantity : undefined;
          let message = '';
          if (items.length === parsedState.items.length && updatedValue !== parseInt(quantityElement.value)) {
            if (typeof updatedValue === 'undefined') {
              message = window.cartStrings.error;
            } else {
              message = window.cartStrings.quantityError.replace('[quantity]', updatedValue);
            }
          }
          this.updateLiveRegions(line, message);

          const keepQtyFocus = event && event.target && event.target.classList && event.target.classList.contains('quantity__input');

          const lineItem =
            document.getElementById(`CartItem-${line}`) || document.getElementById(`CartDrawer-Item-${line}`);
          if (keepQtyFocus) {
            const nextQty = document.getElementById(`Quantity-${line}`) || document.getElementById(`Drawer-quantity-${line}`);
            if (nextQty) nextQty.focus({ preventScroll: true });
          } else if (lineItem && lineItem.querySelector(`[name="${name}"]`)) {
            cartDrawerWrapper
              ? trapFocus(cartDrawerWrapper, lineItem.querySelector(`[name="${name}"]`))
              : lineItem.querySelector(`[name="${name}"]`).focus();
          } else if (parsedState.item_count === 0 && cartDrawerWrapper?.querySelector('.drawer__inner-empty')) {
            trapFocus(cartDrawerWrapper.querySelector('.drawer__inner-empty'), cartDrawerWrapper.querySelector('a'));
          } else if (document.querySelector('.cart-item') && cartDrawerWrapper) {
            trapFocus(cartDrawerWrapper, document.querySelector('.cart-item__name'));
          }
        });

        publish(PUB_SUB_EVENTS.cartUpdate, {
          source: 'cart-items',
          context: this.tagName === 'CART-DRAWER-ITEMS' ? 'drawer' : 'page',
          cartData: parsedState,
          variantId: variantId,
        });
      })
      .catch((e) => {
        this.querySelectorAll('.loading__spinner').forEach((overlay) => overlay.classList.add('hidden'));
        const errors = document.getElementById('cart-errors') || document.getElementById('CartDrawer-CartErrors');
        if (errors) errors.textContent = window.cartStrings.error;
        this.dispatchCartErrorEvent(window.cartStrings.error, 'SERVICE_UNAVAILABLE');
        linesUpdateDeferred?.reject(e);
      });
    };

    const run =
      window.UCCart && typeof window.UCCart.runCartOp === 'function'
        ? window.UCCart.runCartOp(execute)
        : execute();

    run.finally(() => {
      this.disableLoading(line);
      CartPerformance.measureFromMarker(`${eventTarget}:user-action`, cartPerformanceUpdateMarker);
    });
  }

  createCartLinesUpdateEvent(action, variantId, quantity, lineKey) {
    const { CartLinesUpdateEvent } = window.StandardEvents || {};
    if (!CartLinesUpdateEvent || !variantId) return null;
    // No AJAX line key on the row — likely cached HTML rendered before this
    // attribute landed. Skip dispatch rather than emit an event with id: ''.
    if (!lineKey) return null;

    const deferred = CartLinesUpdateEvent.createPromise();
    this.dispatchEvent(
      new CartLinesUpdateEvent({
        action,
        context: 'cart',
        lines: [{ id: lineKey, quantity }],
        promise: deferred.promise,
      })
    );
    return deferred;
  }

  resolveCartLinesUpdate(deferred, parsedState) {
    if (!deferred) return;
    const { CartLinesUpdateEvent } = window.StandardEvents || {};
    if (!CartLinesUpdateEvent) return;

    deferred.resolve({ cart: CartLinesUpdateEvent.createCartFromAjaxResponse(parsedState) });
  }

  dispatchCartErrorEvent(message, code) {
    const { CartErrorEvent } = window.StandardEvents || {};
    if (!CartErrorEvent) return;
    this.dispatchEvent(new CartErrorEvent({ error: message, code }));
  }

  updateLiveRegions(line, message) {
    const lineItemError =
      document.getElementById(`Line-item-error-${line}`) || document.getElementById(`CartDrawer-LineItemError-${line}`);
    if (lineItemError) lineItemError.querySelector('.cart-item__error-text').textContent = message;

    this.lineItemStatusElement.setAttribute('aria-hidden', true);

    const cartStatus =
      document.getElementById('cart-live-region-text') || document.getElementById('CartDrawer-LiveRegionText');
    cartStatus.setAttribute('aria-hidden', false);

    setTimeout(() => {
      cartStatus.setAttribute('aria-hidden', true);
    }, 1000);
  }

  getSectionNode(html, selector) {
    const node = new DOMParser().parseFromString(html, 'text/html').querySelector(selector);
    return node ? document.importNode(node, true) : null;
  }

  getSectionInnerHTML(html, selector) {
    const node = new DOMParser().parseFromString(html, 'text/html').querySelector(selector);
    return node ? node.innerHTML : '';
  }

  enableLoading(line) {
    const mainCartItems = document.getElementById('main-cart-items') || document.getElementById('CartDrawer-CartItems');
    const typing = document.activeElement && document.activeElement.classList && document.activeElement.classList.contains('quantity__input');
    if (!typing && mainCartItems) mainCartItems.classList.add('cart__items--disabled');

    if (!typing) {
      const cartItemElements = this.querySelectorAll(`#CartItem-${line} .loading__spinner`);
      const cartDrawerItemElements = this.querySelectorAll(`#CartDrawer-Item-${line} .loading__spinner`);
      [...cartItemElements, ...cartDrawerItemElements].forEach((overlay) => overlay.classList.remove('hidden'));
      const active = document.activeElement;
      if (active && typeof active.blur === 'function') active.blur();
    }
    if (this.lineItemStatusElement) this.lineItemStatusElement.setAttribute('aria-hidden', false);
  }

  disableLoading(line) {
    const mainCartItems = document.getElementById('main-cart-items') || document.getElementById('CartDrawer-CartItems');
    mainCartItems.classList.remove('cart__items--disabled');

    const cartItemElements = this.querySelectorAll(`#CartItem-${line} .loading__spinner`);
    const cartDrawerItemElements = this.querySelectorAll(`#CartDrawer-Item-${line} .loading__spinner`);

    cartItemElements.forEach((overlay) => overlay.classList.add('hidden'));
    cartDrawerItemElements.forEach((overlay) => overlay.classList.add('hidden'));
  }
}

customElements.define('cart-items', CartItems);

if (!customElements.get('cart-note')) {
  customElements.define(
    'cart-note',
    class CartNote extends HTMLElement {
      constructor() {
        super();

        this.addEventListener(
          'input',
          debounce((event) => {
            const newNote = event.target.value;
            const noteDeferred = this.dispatchNoteUpdateEvent(newNote);

            const body = JSON.stringify({ note: newNote });
            fetch(`${routes.cart_update_url}`, { ...fetchConfig(), ...{ body } })
              .then((r) => r.json())
              .then((cart) => {
                if (!cart || cart.errors) {
                  throw Object.assign(new Error(cart?.errors), { code: 'INVALID' });
                }

                if (noteDeferred) {
                  const { CartNoteUpdateEvent } = window.StandardEvents || {};
                  if (CartNoteUpdateEvent) {
                    noteDeferred.resolve({ cart: CartNoteUpdateEvent.createCartFromAjaxResponse(cart) });
                  }
                }
                CartPerformance.measureFromEvent('note-update:user-action', event);
              })
              .catch((e) => {
                noteDeferred?.reject(e);
                const { CartErrorEvent } = window.StandardEvents || {};
                if (CartErrorEvent) {
                  this.dispatchEvent(
                    new CartErrorEvent({
                      error: e.message || 'Note update failed',
                      code: e.code || 'SERVICE_UNAVAILABLE',
                    })
                  );
                }
              });
          }, ON_CHANGE_DEBOUNCE_TIMER)
        );
      }

      dispatchNoteUpdateEvent(newNote) {
        const { CartNoteUpdateEvent } = window.StandardEvents || {};
        if (!CartNoteUpdateEvent) return null;

        const context = this.closest('dialog') || this.closest('cart-drawer') ? 'dialog' : 'cart';
        const deferred = CartNoteUpdateEvent.createPromise();

        this.dispatchEvent(
          new CartNoteUpdateEvent({
            context,
            note: newNote,
            promise: deferred.promise,
          })
        );

        return deferred;
      }
    }
  );
}
