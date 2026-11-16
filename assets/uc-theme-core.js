/**
 * UC theme core — constants + pubsub (load once from theme.liquid).
 * Safe if legacy section tags still request constants.js / pubsub.js.
 */
(function (w) {
  if (w.__UC_THEME_CORE__) return;
  w.__UC_THEME_CORE__ = true;

  if (w.ON_CHANGE_DEBOUNCE_TIMER == null) {
    w.ON_CHANGE_DEBOUNCE_TIMER = 300;
  }

  if (!w.PUB_SUB_EVENTS) {
    w.PUB_SUB_EVENTS = {
      cartUpdate: 'cart-update',
      quantityUpdate: 'quantity-update',
      optionValueSelectionChange: 'option-value-selection-change',
      variantChange: 'variant-change',
      cartError: 'cart-error',
    };
  }
  w.__UC_CONSTANTS_READY__ = true;

  if (w.__UC_PUBSUB_READY__) return;

  var subscribers = {};

  w.subscribe = function subscribe(eventName, callback) {
    if (subscribers[eventName] === undefined) {
      subscribers[eventName] = [];
    }
    subscribers[eventName] = subscribers[eventName].concat([callback]);
    return function unsubscribe() {
      subscribers[eventName] = subscribers[eventName].filter(function (cb) {
        return cb !== callback;
      });
    };
  };

  w.publish = function publish(eventName, data) {
    if (!subscribers[eventName]) return Promise.resolve();
    return Promise.all(
      subscribers[eventName].map(function (callback) {
        return callback(data);
      })
    );
  };

  w.__UC_PUBSUB_READY__ = true;
})(window);
