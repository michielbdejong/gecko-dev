/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

this.EXPORTED_SYMBOLS = ["ExtensionStorageSync"];

const Ci = Components.interfaces;
const Cc = Components.classes;
const Cu = Components.utils;
const Cr = Components.results;


const STORAGE_SYNC_ENABLED = 'extension.storage.sync.enabled';
const AREA_NAME = 'sync';


Cu.import("resource://services-common/moz-kinto-client.js");

Cu.import("resource://gre/modules/Preferences.jsm");

Cu.import("resource://gre/modules/Task.jsm");

/* globals ExtensionStorageSync */

var collPromise;

function openColl() {
  dump('Loading Kinto\n');
  const Kinto = loadKinto();
  var coll;
  if (!Kinto) {
    return Promise.reject(new Error('Not supported'));
  }
  return Task.spawn(function* () {
    const db = new Kinto({
      adapter: Kinto.adapters.FirefoxAdapter,
    });
    coll = db.collection("items");
    yield coll.db.open();
  }).then(() => {
    return coll;
  }).catch(err => {
    dump('error opening SqlLite '+err.message);
    throw err;
  });
}

function checkEnabled() {
  if (Preferences.get(STORAGE_SYNC_ENABLED, false) !== true) {
    return Promise.reject(`Please set ${STORAGE_SYNC_ENABLED} to true in about:config`);
  }
  if (!collPromise) {
    collPromise = openColl();
  }
  return collPromise;
}

var md5 = function(str) {
  // In a deterministic way, make sure string is long enough:
  str = '-----------------------------' + str;
  // Adapted from toolkit/components/url-classifier/content/moz/cryptohasher.js:
  var hasher_ = Cc["@mozilla.org/security/hash;1"]
                   .createInstance(Ci.nsICryptoHash);
  hasher_.init(Ci.nsICryptoHash.MD5);
  var stream = Cc['@mozilla.org/io/string-input-stream;1']
                 .createInstance(Ci.nsIStringInputStream);
  stream.setData(str, str.length);
  if (stream.available()) {
    hasher_.updateFromStream(stream, stream.available());
  }

  var digest = hasher_.finish(false /* not b64 encoded */);

  var hexchars = '0123456789ABCDEF';
  var hexrep = new Array(str.length * 2);

  for (var i = 0; i < str.length; ++i) {
    hexrep[i * 2] = hexchars.charAt((digest.charCodeAt(i) >> 4) & 15);
    hexrep[i * 2 + 1] = hexchars.charAt(digest.charCodeAt(i) & 15);
  }
  return hexrep.join('').toLowerCase();
}

function keyToId(key) {
  let md5Str = md5(key);
  const parts = [];
  [8,4,4,4,12].map(numChars => {
    parts.push(md5Str.substr(0, numChars));
    md5Str = md5Str.substr(numChars);
  });
  dump('keyToId ' + key + ' -> ' + parts.join('-') + '\n\n\n');
  return parts.join("-");
}

this.ExtensionStorageSync = {
  listeners: new Map(),

  set(extensionId, items) {
    dump('setting' + JSON.stringify(items));
    return checkEnabled().then(coll => {
      let changes = {};

      function createOrUpdateItem(record) {
        function createItem() {
          changes[record.key] = {
            oldValue: undefined,
            newValue: record.data
          };
          return coll.create(record, {useRecordId: true});
        }

        function updateItem(old_record) {
          changes[record.key] = {
            oldValue: old_record,
            newValue: record.data
          };
          if (old_record._status === "deleted") {
            return coll.delete(old_record.id, { virtual: false }).then(() => {
              return coll.create(record, {useRecordId: true});
            });
          }
          return coll.update(record);
        }

        return coll.get(record.id, { includeDeleted: true })
          .then(function(old_record) {
            return updateItem(old_record.data);
          }, function(reason) {
            if (reason.message.indexOf(" not found.") !== -1) {
              return createItem();
            }
            dump('\n\nhave reason ' + reason + JSON.stringify(record));
            throw reason;
          });
        }

        const promises = [];
        dump('setting items' + JSON.stringify(items));
        for(let itemId in items) {
          promises.push(createOrUpdateItem({
            id: keyToId(itemId),
            key: itemId,
            data: items[itemId]
          }));
        }
        return Promise.all(promises).then(results => {
          this.notifyListeners(extensionId, changes);
        });
    });
  },

  remove(extensionId, keys) {
    return checkEnabled().then(coll => {
      keys = [].concat(keys);
      let changes = {};

      function removeItem(key) {
        dump('removing key '+key);
        return coll.get(keyToId(key)).then(record => {
          if (!record) {
            return;
          }
          changes[key] = {
            oldValue: record.data.data,
            newValue: undefined
          };
          return coll.delete(keyToId(key));
        }).catch(err => {
          if (err.message.indexOf(" not found.") !== -1) {
            return;
          }
          throw err;
        });
      }
      return Promise.all(keys.map(removeItem))
        .then(() => {
          this.notifyListeners(extensionId, changes);
        });

    });
  },

  clear(extensionId) {
    return checkEnabled().then(coll => {
      let changes = [];
      coll.list()
        .then(records => {
          const promises = records.data.map(record => {
            changes[record.key] = {
              oldValue: record.data,
              newValue: undefined
            };
            return coll.delete(record.id);
          });
          return Promise.all(promises);
        }).then(() => {
          this.notifyListeners(extensionId, changes);
        });
    });
  },

  get(extensionId, spec) {
    return checkEnabled().then(coll => {
      let keys, records;
      if (spec === null) {
        return coll.list().then(function(res) {
          return res.data;
        });
      }
      if (typeof spec === 'string') {
        keys = [spec];
        records = {};
      } else if (Array.isArray(spec)) {
        keys = spec;
        records = {};
      } else {
        keys = Object.keys(spec);
        records = spec;
      }

      return Promise.all(keys.map(key => {
        dump('getting key '+key);
        return coll.get(keyToId(key)).then(function (res) {
          if (res) {
            records[res.data.key] = res.data.data;
            return res.data;
          } else {
            return Promise.reject("boom");
          }
        }, function () {
          // XXX we just swallow the error and not set any key
        });
      })).then(() => {
        return records;
      });
    });
  },

  addOnChangedListener(extensionId, listener) {
    let listeners = this.listeners.get(extensionId) || new Set();
    listeners.add(listener);
    this.listeners.set(extensionId, listeners);
  },

  removeOnChangedListener(extensionId, listener) {
    let listeners = this.listeners.get(extensionId);
    listeners.delete(listener);
  },

  notifyListeners(extensionId, changes) {
    let listeners = this.listeners.get(extensionId);
    if (listeners) {
      for (let listener of listeners) {
        listener(changes);
      }
    }
  },
};
