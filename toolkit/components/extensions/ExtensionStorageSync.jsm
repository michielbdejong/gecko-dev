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
const Kinto = loadKinto();

Cu.import("resource://gre/modules/Preferences.jsm");

/* globals ExtensionStorageSync */

function checkEnabled() {
  if (Preferences.get(STORAGE_SYNC_ENABLED, false) !== true) {
    return Promise.reject(`Please set ${STORAGE_SYNC_ENABLED} to true in about:config`);
  }
  if (!Kinto) {
    return Promise.reject(new Error('Not supported'));
  }
  return Promise.resolve();
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
      return Promise.reject(new Error('chrome.storage.sync.get not implemented'));
    });
  },
};
