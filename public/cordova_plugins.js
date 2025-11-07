// Cordova plugins configuration
cordova.define('cordova/plugin_list', function(require, exports, module) {
  module.exports = [
    {
      "id": "cordova-plugin-purchase",
      "file": "plugins/cordova-plugin-purchase/www/store.js",
      "pluginId": "cordova-plugin-purchase",
      "clobbers": [
        "store"
      ]
    }
  ];
  module.exports.metadata = {
    "cordova-plugin-purchase": "13.12.1"
  };
});