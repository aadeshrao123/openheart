// jsxImportSource routes every JSX element through NativeWind's runtime, which
// is what makes className work on a React Native component at all. Without it
// the prop is silently dropped and every screen renders unstyled.
// https://www.nativewind.dev/docs/getting-started/installation

module.exports = function (api) {
  api.cache(true);

  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
  };
};
