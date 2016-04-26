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
        get: function(spec) {
          return ExtensionStorage.get(extension.id, spec).catch(wrapRejection);
        },
        set: function(items) {
          return ExtensionStorage.set(extension.id, items, context.cloneScope).catch(wrapRejection);
        },
        remove: function(keys) {
          return ExtensionStorage.remove(extension.id, keys).catch(wrapRejection);
        },
        clear: function() {
          return ExtensionStorage.clear(extension.id).catch(wrapRejection);
        },
      },

      sync: {
        get: function(spec) {
          return ExtensionStorageSync.get(extension.id, spec).catch(wrapRejection);
        },
        set: function(items) {
          return ExtensionStorageSync.set(extension.id, items).catch(wrapRejection);
        },
        remove: function(keys) {
          return ExtensionStorageSync.remove(extension.id, keys).catch(wrapRejection);
        },
        clear: function() {
          return ExtensionStorageSync.clear(extension.id).catch(wrapRejection);
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
          try {
            ExtensionStorageSync.addOnChangedListener(extension.id, listenerSync);
          } catch(e) {
            dump('error accessing ExtensionStorageSync: ' + e.message);
          }
          return () => {
            ExtensionStorage.removeOnChangedListener(extension.id, listenerLocal);
            try {
              ExtensionStorageSync.removeOnChangedListener(extension.id, listenerSync);
            } catch(e) {
              dump('error accessing ExtensionStorageSync: ' + e.message);
            }
          };
      }).api(),
    },
  };
});
