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

Cu.import("resource://services-common/moz-kinto-client.js");

Cu.import("resource://gre/modules/Preferences.jsm");

/* globals ExtensionStorageSync */

var items;

function checkEnabled() {
  if (Preferences.get(STORAGE_SYNC_ENABLED, false) !== true) {
    return Promise.reject(`Please set ${STORAGE_SYNC_ENABLED} to true in about:config`);
  }
  if (!Kinto) {
    return Promise.reject(new Error('Not supported'));
  }
  if (!items) {
    const Kinto = loadKinto();
    const db = new Kinto({
      adapter: Kinto.adapters.FirefoxAdapter,
    });
    const tmp = db.collection("items");
    return tmp.db.open().then(() => {
      items = tmp;
    }, Cu.reportError);
  }
  return Promise.resolve();
}

function keyToId(key) {
  return '12345678-1234-1234-1234-1234567890ab';
}

this.ExtensionStorageSync = {
  set(extensionId, items) {
    return checkEnabled().then(() => {
      return Promise.reject(new Error('chrome.storage.sync.set not implemented'));
    });
  },

  remove(extensionId, items) {
    return checkEnabled().then(() => {
      return Promise.reject(new Error('chrome.storage.sync.remove not implemented'));
    });
  },

  clear(extensionId) {
    return checkEnabled().then(() => {
      return Promise.reject(new Error('chrome.storage.sync.clear not implemented'));
    });
  },

  get(extensionId, keys) {
    return checkEnabled().then(() => {
      const records = {};

      function getRecord(key) {
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
