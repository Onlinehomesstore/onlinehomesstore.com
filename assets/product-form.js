if (!customElements.get('product-form')) {
  customElements.define(
    'product-form',
    class ProductForm extends HTMLElement {
      constructor() {
        super();

        this.form = this.querySelector('form');
        if (!this.form) return;
        this.variantIdInput.disabled = false;
        this.form.addEventListener('submit', this.onSubmitHandler.bind(this));
        /* UNIK CARE: stay on page after add. Header cart icon is a real /cart link. */
        this.cart = null;
        this.submitButton = this.querySelector('[type="submit"]');
        if (!this.submitButton) return;
        this.submitButtonText = this.submitButton.querySelector('span');

        this.hideErrors = this.dataset.hideErrors === 'true';
      }

      onSubmitHandler(evt) {
        evt.preventDefault();
        evt.stopPropagation();
        if (this.submitButton.getAttribute('aria-disabled') === 'true') return;

        this.handleErrorMessage();

        this.submitButton.setAttribute('aria-disabled', true);
        this.submitButton.classList.add('loading');
        const spinner = this.querySelector('.loading__spinner');
        if (spinner) spinner.classList.remove('hidden');

        const formData = new FormData(this.form);
        const variantId = formData.get('id');
        const quantity = parseInt(formData.get('quantity')) || 1;
        const linesUpdateDeferred = this.createCartLinesUpdateEvent(variantId, quantity);

        const finish = () => {
          this.submitButton.classList.remove('loading');
          if (spinner) spinner.classList.add('hidden');
          this.submitButton.removeAttribute('aria-disabled');
          CartPerformance.measureFromEvent('add:user-action', evt);
        };

        const showAdded = () => {
          this.submitButton.classList.add('is-success');
          if (this.submitButtonText) {
            const prev = this.submitButtonText.textContent;
            this.submitButtonText.textContent = window.variantStrings?.added || 'Added';
            window.setTimeout(() => {
              this.submitButton.classList.remove('is-success');
              this.submitButtonText.textContent = window.variantStrings?.addToCart || prev;
            }, 2000);
          } else {
            window.setTimeout(() => this.submitButton.classList.remove('is-success'), 2000);
          }
        };

        if (window.UCCart && typeof window.UCCart.addFromForm === 'function') {
          window.UCCart.addFromForm(this.form, 'product-form')
            .then((cart) => {
              this.error = false;
              this.resolveCartLinesUpdate(linesUpdateDeferred);
              if (window.publish && window.PUB_SUB_EVENTS && window.PUB_SUB_EVENTS.cartUpdate) {
                publish(PUB_SUB_EVENTS.cartUpdate, {
                  source: 'product-form',
                  productVariantId: variantId,
                  cartData: cart,
                });
              }
              document.dispatchEvent(
                new CustomEvent('cart:atc:success', {
                  bubbles: true,
                  detail: { button: this.submitButton },
                })
              );
              showAdded();
            })
            .catch((e) => {
              console.error(e);
              const message = e && (e.description || e.message) ? e.description || e.message : 'Could not add to cart';
              this.handleErrorMessage(message);
              this.dispatchCartErrorEvent(message, 'INVALID');
              linesUpdateDeferred?.reject(new Error(message));
              this.error = true;
            })
            .finally(() => finish());
          return;
        }

        const config = fetchConfig('javascript');
        config.headers['X-Requested-With'] = 'XMLHttpRequest';
        delete config.headers['Content-Type'];
        config.body = formData;

        fetch(`${routes.cart_add_url}`, config)
          .then((response) => response.json())
          .then((response) => {
            if (response.status) {
              publish(PUB_SUB_EVENTS.cartError, {
                source: 'product-form',
                productVariantId: variantId,
                errors: response.errors || response.description,
                message: response.message,
              });
              this.handleErrorMessage(response.description);
              this.dispatchCartErrorEvent(response.description || response.message, 'INVALID');
              linesUpdateDeferred?.reject(new Error(response.description || response.message));
              this.error = true;
              return;
            }

            this.error = false;
            this.resolveCartLinesUpdate(linesUpdateDeferred);
            if (window.UCCart && typeof window.UCCart.fetchCartJson === 'function') {
              window.UCCart.fetchCartJson().then(function (cart) {
                if (!cart) return;
                if (typeof window.UCCart.applyCartUi === 'function') window.UCCart.applyCartUi(cart);
                if (typeof window.UCCart.broadcastCartUpdate === 'function') {
                  window.UCCart.broadcastCartUpdate('product-form', cart);
                }
              });
            }
            document.dispatchEvent(
              new CustomEvent('cart:atc:success', {
                bubbles: true,
                detail: { button: this.submitButton },
              })
            );
            showAdded();
          })
          .catch((e) => {
            console.error(e);
            this.dispatchCartErrorEvent(e.message || 'Network error', 'SERVICE_UNAVAILABLE');
            linesUpdateDeferred?.reject(e);
            this.error = true;
          })
          .finally(() => finish());
      }

      handleErrorMessage(errorMessage = false) {
        if (this.hideErrors) return;

        this.errorMessageWrapper =
          this.errorMessageWrapper || this.querySelector('.product-form__error-message-wrapper');
        if (!this.errorMessageWrapper) return;
        this.errorMessage = this.errorMessage || this.errorMessageWrapper.querySelector('.product-form__error-message');

        this.errorMessageWrapper.toggleAttribute('hidden', !errorMessage);

        if (errorMessage) {
          this.errorMessage.textContent = errorMessage;
        }
      }

      toggleSubmitButton(disable = true, text) {
        if (disable) {
          this.submitButton.setAttribute('disabled', 'disabled');
          if (text) this.submitButtonText.textContent = text;
        } else {
          this.submitButton.removeAttribute('disabled');
          this.submitButtonText.textContent = window.variantStrings.addToCart;
        }
      }

      createCartLinesUpdateEvent(variantId, quantity) {
        const { CartLinesUpdateEvent } = window.StandardEvents || {};
        if (!CartLinesUpdateEvent) return null;

        const deferred = CartLinesUpdateEvent.createPromise();
        this.dispatchEvent(
          new CartLinesUpdateEvent({
            action: 'add',
            context: 'product',
            lines: [{ merchandiseId: variantId, quantity }],
            promise: deferred.promise,
          })
        );
        return deferred;
      }

      resolveCartLinesUpdate(deferred) {
        if (!deferred) return;
        const { CartLinesUpdateEvent } = window.StandardEvents || {};
        if (!CartLinesUpdateEvent) return;

        const pendingCartDataPromise = typeof CartItems !== 'undefined'
          ? CartItems.fetchCartData()
          : fetch(`${routes.cart_url}.json`).then((response) => response.json());

        pendingCartDataPromise
          .then((cart) => {
            if (!cart?.currency) return deferred.reject(new Error('Missing currency in cart response'));
            deferred.resolve({ cart: CartLinesUpdateEvent.createCartFromAjaxResponse(cart) });
          })
          .catch((e) => deferred.reject(e));
      }

      dispatchCartErrorEvent(message, code) {
        const { CartErrorEvent } = window.StandardEvents || {};
        if (!CartErrorEvent) return;
        this.dispatchEvent(new CartErrorEvent({ error: message, code }));
      }

      get variantIdInput() {
        return this.form.querySelector('[name=id]');
      }
    }
  );
}
