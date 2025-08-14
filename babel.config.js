// babel.config.js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // alias'lara ihtiyacın yoksa bu bloğu kaldırabilirsin
      ['module-resolver', {
        root: ['./src'],
        alias: {
          '@assets': './src/assets/index',
          '@components': './src/components',
          '@screens': './src/screens',
          '@context': './src/context',
          '@utils': './src/utils',
          '@theme': './src/theme'
        }
      }],
      // Reanimated plugin EN SONDA olmalı
      'react-native-reanimated/plugin',
    ],
  };
};
