/**
 * Legacy asset name — must stay safe when included more than once.
 */
(function (w) {
  if (w.__UC_PUBSUB_READY__) return;
  if (w.__UC_THEME_CORE__ && w.subscribe && w.publish) {
    w.__UC_PUBSUB_READY__ = true;
    return;
  }

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
