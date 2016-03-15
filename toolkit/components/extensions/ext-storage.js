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
        get: function(spec, callback) {
          return context.wrapPromise(
            ExtensionStorage.get(extension.id, spec), callback);
        },
        set: function(items, callback) {
          return context.wrapPromise(
            ExtensionStorage.set(extension.id, items), callback);
        },
        remove: function(keys, callback) {
          return context.wrapPromise(
            ExtensionStorage.remove(extension.id, keys), callback);
        },
        clear: function(callback) {
          return context.wrapPromise(
            ExtensionStorage.clear(extension.id), callback);
        },
      },

      sync: {
        get: function(spec, callback) {
          return context.wrapPromise(
            ExtensionStorageSync.get(extension.id, spec).catch(wrapRejection),
            callback);
        },
        set: function(items, callback) {
          return context.wrapPromise(
            ExtensionStorageSync.set(extension.id, items).catch(wrapRejection),
            callback);
        },
        remove: function(keys, callback) {
          return context.wrapPromise(
            ExtensionStorageSync.remove(extension.id, keys).catch(wrapRejection),
            callback);
        },
        clear: function(callback) {
          return context.wrapPromise(
            ExtensionStorageSync.clear(extension.id).catch(wrapRejection),
            callback);
        },
      },

      onChanged: new EventManager(context, "storage.onChanged", fire => {
        let listenerLocal = changes => {
          fire(changes, 'local');
        };
        let listenerSync = changes => {
          fire(changes, 'sync');
        };

        ExtensionStorage.addOnChangedListener(extension.id, listenerLocal);
        ExtensionStorageSync.addOnChangedListener(extension.id, listenerSync);
        return () => {
          ExtensionStorage.removeOnChangedListener(extension.id, listenerLocal);
          ExtensionStorageSync.removeOnChangedListener(extension.id, listenerSync);
        };
      }).api(),
    },
  };
});
