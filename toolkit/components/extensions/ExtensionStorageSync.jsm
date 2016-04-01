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

var itemsPromise;

function openItems() {
  dump('Loading Kinto\n');
  const Kinto = loadKinto();
  var items;
  if (!Kinto) {
    return Promise.reject(new Error('Not supported'));
  }
  return Task.spawn(function* () {
    const db = new Kinto({
      adapter: Kinto.adapters.FirefoxAdapter,
    });
    items = db.collection("items");
    yield items.db.open();
  }).then(() => {
    return items;
  }).catch(err => {
    dump('error opening SqlLite '+err.message);
    throw err;
  });
}

function checkEnabled() {
  if (Preferences.get(STORAGE_SYNC_ENABLED, false) !== true) {
    return Promise.reject(`Please set ${STORAGE_SYNC_ENABLED} to true in about:config`);
  }
  if (!itemsPromise) {
    itemsPromise = openItems();
  }
  return itemsPromise;
}

var md5 = function(str) {
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
  set(extensionId, items) {
    dump('setting' + JSON.stringify(items));
    return checkEnabled().then(items => {
      function createOrUpdateItem(record) {
        function createItem() {
          // storage.onChanged._addChange(AREA_NAME, record.key, undefined, record.data);
          return items.create(record, {useRecordId: true});
        }

        function updateItem(old_record) {
          // storage.onChanged._addChange(AREA_NAME, record.key, old_record, record.data);
          if (old_record._status === "deleted") {
            return items.delete(old_record.id, { virtual: false }).then(() => {
              return items.create(record, {useRecordId: true});
            });
          }
          return items.update(record);
        }

        return items.get(record.id, { includeDeleted: true })
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
          // storage.onChanged._emit(AREA_NAME);
        });
    });
  },

  remove(extensionId, keys) {
    return checkEnabled().then(items => {
      keys = [].concat(keys);

      function removeItem(key) {
        dump('removing key '+key);
        return items.get(keyToId(key)).then(record => {
          if (!record) {
            return;
          }
          // storage.onChanged._addChange(AREA_NAME, key, record.data.data, undefined);
          return items.delete(keyToId(key));
        }).catch(err => {
          if (err.message.indexOf(" not found.") !== -1) {
            return;
          }
          throw err;
        });
      }
      return Promise.all(keys.map(removeItem))
        .then(() => {
          // storage.onChanged._emit(AREA_NAME);
        });

    });
  },

  clear(extensionId) {
    return checkEnabled().then(items => {
      items.list()
        .then(records => {
          const promises = records.data.map(record => {
            // storage.onChanged._addChange(AREA_NAME, record.key, record.data, undefined);
            return items.delete(record.id);
          });
          return Promise.all(promises);
        }).then(() => {
          // storage.onChanged._emit(AREA_NAME);
        });
    });
  },

  get(extensionId, keys) {
    return checkEnabled().then(items => {
      const records = {};

      function getRecord(key) {
        dump('getting key '+key);
        return items.get(keyToId(key)).then(function (res) {
          if (res) {
            records[res.data.key] = res.data.data;
            return res.data;
          } else {
            return Promise.reject("boom");
          }
        },
        function (rejected) {
          // XXX we just swallow the error and not set any key
        });
      }
      function getRecords(keys) {
        return Promise.all(keys.map(key => getRecord(key)));
      }

      if (!keys) {
        keys = [];
        // XXX suboptimal: fetching all ids - then doing a second query
        return items.list().then(function(res) {
          res.data.map(r => keys.push(r.key));
        }).then(function() {return getRecords(keys);});
      } else {
        keys = [].concat(keys);
        return getRecords(keys);
      }
    });
  },
};
