/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

this.EXPORTED_SYMBOLS = ["ExtensionStorageSync", "keyToId"];

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

var collPromise = {};

function openColl(extensionId) {
  var collectionId = md5(extensionId);
  const Kinto = loadKinto();
  var coll;
  if (!Kinto) {
    return Promise.reject(new Error('Not supported'));
  }
  return Promise.resolve().then(() => {
    //TODO: implement sync process
    return Task.spawn(function* () {
      const db = new Kinto({
        adapter: Kinto.adapters.FirefoxAdapter
      });
      coll = db.collection(collectionId, {
      });
      yield coll.db.open('storage-sync.sqlite');
    });
  }).then(() => {
    return coll;
  });
}

var md5 = function(str) {
  // In a deterministic way, make sure string is long enough:
  // str = '-----------------------------' + str;
  str = '' + str;
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

  var hexchars = '0123456789abcdef';
  var hexrep = new Array(32);

  for (var i = 0; i < 16; ++i) {
    hexrep[i * 2] = hexchars.charAt((digest.charCodeAt(i) >> 4) & 15);
    hexrep[i * 2 + 1] = hexchars.charAt(digest.charCodeAt(i) & 15);
  }
  return hexrep.join('');
}

function keyToId(key) {
  let md5Str = md5(key);
  const parts = [];
  [8,4,4,4,12].map(numChars => {
    parts.push(md5Str.substr(0, numChars));
    md5Str = md5Str.substr(numChars);
  });
  return parts.join("-");
}

this.ExtensionStorageSync = {
  listeners: new Map(),

  getCollection(extensionId) {
    if (Preferences.get(STORAGE_SYNC_ENABLED, false) !== true) {
      return Promise.reject(`Please set ${STORAGE_SYNC_ENABLED} to true in about:config`);
    }
    if (!collPromise[extensionId]) {
      collPromise[extensionId] = openColl(extensionId);
    }
    return collPromise[extensionId];
  },

  set(extensionId, items) {
    return this.getCollection(extensionId).then(coll => {
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
          if (old_record._status === "deleted") {
            changes[record.key] = {
              oldValue: undefined,
              newValue: record.data
            };
            return coll.delete(old_record.id, { virtual: false }).then(() => {
              return coll.create(record, {useRecordId: true});
            });
          }
          changes[record.key] = {
            oldValue: old_record.data,
            newValue: record.data
          };
          return coll.update(record);
        }

        return coll.get(record.id, { includeDeleted: true })
          .then(function(old_record) {
            return updateItem(old_record.data);
          }, function(reason) {
            if (reason.message.indexOf(" not found.") !== -1) {
              return createItem();
            }
            throw reason;
          });
      }

      const promises = [];
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
    return this.getCollection(extensionId).then(coll => {
      keys = [].concat(keys);
      let changes = {};

      function removeItem(key) {
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
    return this.getCollection(extensionId).then(coll => {
      let changes = [];
      return coll.list().then(records => {
        const promises = records.data.map(record => {
          changes[record.key] = {
            oldValue: record.data,
            newValue: undefined
          };
          return coll.delete(record.id);
        });
        return Promise.all(promises);
      }).then(result => {
        this.notifyListeners(extensionId, changes);
      });
    });
  },

  get(extensionId, spec) {
    return this.getCollection(extensionId).then(coll => {
      let keys, records;
      if (spec === null) {
        records = {};
        return coll.list().then(function(res) {
          res.data.map(record => {
            records[record.key] = record.data;
          });
          return records;
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
