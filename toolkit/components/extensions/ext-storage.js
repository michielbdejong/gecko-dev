"use strict";

const STORAGE_SYNC_ENABLED = 'extension.storage.sync.enabled';

var {classes: Cc, interfaces: Ci, utils: Cu} = Components;

XPCOMUtils.defineLazyModuleGetter(this, "ExtensionStorage",
                                  "resource://gre/modules/ExtensionStorage.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "Preferences",
                                  "resource://gre/modules/Preferences.jsm");

Cu.import("resource://gre/modules/ExtensionUtils.jsm");
var {
  EventManager,
} = ExtensionUtils;

function rejection(message) {
  return Promise.reject({ message });
}

function checkEnabled() {
  if (Preferences.get(STORAGE_SYNC_ENABLED, false) !== true) {
    return rejection(`Please set ${STORAGE_SYNC_ENABLED} to true in about:config`);
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
            return rejection('Not implemented');
          }), callback);
        },
        set: function(items, callback) {
          return context.wrapPromise(checkEnabled().then(() => {
            return rejection('Not implemented');
          }), callback);
        },
        remove: function(items, callback) {
          return context.wrapPromise(checkEnabled().then(() => {
            return rejection('Not implemented');
          }), callback);
        },
        clear: function(callback) {
          return context.wrapPromise(checkEnabled().then(() => {
            return rejection('Not implemented');
          }), callback);
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
