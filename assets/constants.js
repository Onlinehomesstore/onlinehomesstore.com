/**
 * Legacy asset name — must stay safe when included more than once (section + theme).
 * No top-level const/let (redeclaration breaks the storefront).
 */
(function (w) {
  if (w.__UC_CONSTANTS_READY__) return;
  if (w.__UC_THEME_CORE__) {
    w.__UC_CONSTANTS_READY__ = true;
    return;
  }
  w.__UC_CONSTANTS_READY__ = true;
  w.ON_CHANGE_DEBOUNCE_TIMER = 300;
  w.PUB_SUB_EVENTS = {
    cartUpdate: 'cart-update',
    quantityUpdate: 'quantity-update',
    optionValueSelectionChange: 'option-value-selection-change',
    variantChange: 'variant-change',
    cartError: 'cart-error',
  };
})(window);
