const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');
const exclusionList = require('metro-config/src/defaults/exclusionList');

const config = {
  resolver: {
    blockList: exclusionList([
      /node_modules[\/\\].*[\/\\]android[\/\\]build[\/\\].*/,
    ]),
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
