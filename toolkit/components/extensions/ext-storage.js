"use strict";

const STORAGE_SYNC_ENABLED = 'extension.storage.sync.enabled';

var {classes: Cc, interfaces: Ci, utils: Cu} = Components;

XPCOMUtils.defineLazyModuleGetter(this, "ExtensionStorage",
                                  "resource://gre/modules/ExtensionStorage.jsm");
// XPCOMUtils.defineLazyModuleGetter(this, "ExtensionStorageSync",
//                                   "resource://gre/modules/ExtensionStorageSync.jsm");

Cu.import("resource://services-common/moz-kinto-client.js");
const Kinto = loadKinto();

XPCOMUtils.defineLazyModuleGetter(this, "Preferences",
                                  "resource://gre/modules/Preferences.jsm");

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

function checkEnabled() {
  if (Preferences.get(STORAGE_SYNC_ENABLED, false) !== true) {
    return Promise.reject(`Please set ${STORAGE_SYNC_ENABLED} to true in about:config`);
  }
  return Promise.resolve();
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
          return context.wrapPromise(checkEnabled().then(() => {
            // return ExtensionStorageSync.get(extension.id, keys);
            if (!Kinto) {
              return Promise.reject(new Error('Not supported'));
            }
            return Promise.reject(new Error('Not implemented'));
          }).catch(wrapRejection), callback);
        },
        set: function(items, callback) {
          return context.wrapPromise(checkEnabled().then(() => {
            // return ExtensionStorageSync.set(extension.id, items);
            if (!Kinto) {
              return Promise.reject(new Error('Not supported'));
            }
            return Promise.reject(new Error('Not implemented'));
          }).catch(wrapRejection), callback);
        },
        remove: function(items, callback) {
          return context.wrapPromise(checkEnabled().then(() => {
            // return ExtensionStorageSync.remove(extension.id, items);
            if (!Kinto) {
              return Promise.reject(new Error('Not supported'));
            }
            return Promise.reject(new Error('Not implemented'));
          }).catch(wrapRejection), callback);
        },
        clear: function(callback) {
          return context.wrapPromise(checkEnabled().then(() => {
            // return ExtensionStorageSync.clear(extension.id);
            if (!Kinto) {
              return Promise.reject(new Error('Not supported'));
            }
            return Promise.reject(new Error('Not implemented'));
          }).catch(wrapRejection), callback);
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
