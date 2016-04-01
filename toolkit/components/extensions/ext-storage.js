"use strict";

var {classes: Cc, interfaces: Ci, utils: Cu} = Components;

XPCOMUtils.defineLazyModuleGetter(this, "ExtensionStorage",
                                  "resource://gre/modules/ExtensionStorage.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "ExtensionStorageSync",
                                  "resource://gre/modules/ExtensionStorageSync.jsm");

Cu.import("resource://gre/modules/ExtensionUtils.jsm");
var {
  EventManager,
} = ExtensionUtils;

function wrapRejection(err) {
  if (typeof err === 'string') {
    return Promise.reject({ message: err });
  }
  return Promise.reject({ message: err.message });
}

extensions.registerSchemaAPI("storage", "storage", (extension, context) => {
  return {
    storage: {
      local: {
        get: function(keys, callback) {
          return context.wrapPromise(
            ExtensionStorage.get(extension.id, keys), callback);
        },
        set: function(items, callback) {
          return context.wrapPromise(
            ExtensionStorage.set(extension.id, items), callback);
        },
        remove: function(items, callback) {
          return context.wrapPromise(
            ExtensionStorage.remove(extension.id, items), callback);
        },
        clear: function(callback) {
          return context.wrapPromise(
            ExtensionStorage.clear(extension.id), callback);
        },
      },

      sync: {
        get: function(keys, callback) {
          return context.wrapPromise(
            ExtensionStorageSync.get(extension.id, keys).catch(wrapRejection),
            callback);
        },
        set: function(items, callback) {
          return context.wrapPromise(
            ExtensionStorageSync.set(extension.id, items).catch(wrapRejection),
            callback);
        },
        remove: function(items, callback) {
          return context.wrapPromise(
            ExtensionStorageSync.remove(extension.id, items).catch(wrapRejection),
            callback);
        },
        clear: function(callback) {
          return context.wrapPromise(
            ExtensionStorageSync.clear(extension.id).catch(wrapRejection),
            callback);
        },
      },

      onChanged: new EventManager(context, "storage.local.onChanged", fire => {
        let listener = changes => {
          fire(changes, "local");
        };

        ExtensionStorage.addOnChangedListener(extension.id, listener);
        return () => {
          ExtensionStorage.removeOnChangedListener(extension.id, listener);
        };
      }).api(),
    },
  };
});
