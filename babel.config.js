module.exports = function (api) {
  api.cache(true);
  return {
    // babel-preset-expo (SDK 50+) automatically includes the
    // react-native-reanimated worklet plugin when reanimated is installed.
    // react-native-keyboard-controller (KeyboardAwareScrollView /
    // KeyboardAvoidingView) is reanimated-based and requires that plugin.
    presets: ['babel-preset-expo'],
  };
};
