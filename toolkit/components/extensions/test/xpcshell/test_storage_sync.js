

Cu.import("resource://gre/modules/ExtensionStorageSync.jsm");

function run_test() {
  equal(typeof ExtensionStorageSync, 'object');
  equal(keyToId('foo'), 'acbd18db-4cc2-f85c-edef-654fccc4a4d8');
  equal(keyToId('bar'), '37b51d19-4a75-13e4-5b56-f6524f2d51f2');
  equal(keyToId(''),    'd41d8cd9-8f00-b204-e980-0998ecf8427e');
  equal(keyToId('what\'s the md5 of this String?'),
                        '27e4d99e-fdd0-090f-07fc-ea6e8ab12ca2');
}
