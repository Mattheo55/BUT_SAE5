const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

const { resolver } = config;

resolver.assetExts.push('tflite');

resolver.sourceExts = [...resolver.sourceExts, 'cjs', 'mjs'];

module.exports = config;