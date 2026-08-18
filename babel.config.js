module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
    // react-native-worklets/plugin substitui o antigo reanimated/plugin (Reanimated 4).
    // Deve ser SEMPRE o último plugin da lista.
    plugins: ["react-native-worklets/plugin"],
  };
};
