/**
 * NestJS webpack wrapper: bundle workspace @beauty/* packages (ESM)
 * into the CJS output so Node can require() the API without dual packages.
 */
module.exports = (options) => {
  const prev = options.externals;

  const beautyAwareExternals = ({ context, request }, callback) => {
    if (request && String(request).startsWith('@beauty/')) {
      // Do not externalize — webpack will bundle these
      return callback();
    }

    if (typeof prev === 'function') {
      return prev({ context, request }, callback);
    }

    if (Array.isArray(prev)) {
      // Nest usually provides a single function in an array
      const fn = prev.find((e) => typeof e === 'function');
      if (fn) {
        return fn({ context, request }, callback);
      }
      // Fall through: treat listed strings as externals
      if (prev.includes(request)) {
        return callback(null, 'commonjs ' + request);
      }
    }

    return callback();
  };

  return {
    ...options,
    externals: [beautyAwareExternals],
  };
};
