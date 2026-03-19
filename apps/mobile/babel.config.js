module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: [
      require("babel-preset-expo/build/expo-router-plugin").expoRouterBabelPlugin,
    ],
  };
};
