const path = require('path');
const msgpack = require('msgpack-lite');
const SingleEntryPlugin = require('webpack/lib/SingleEntryPlugin');
const {getAssetPath} = require('./compat');

module.exports.run = ({prefix, favicons: options, logo}, context, compilation) => {
  // The entry file is just an empty helper
  const filename = '[hash]';
  const publicPath = compilation.outputOptions.publicPath;

  // Create an additional child compiler which takes the template
  // and turns it into an Node.JS html factory.
  // This allows us to use loaders during the compilation
  const compiler = compilation.createChildCompiler('webapp-webpack-plugin', {filename, publicPath});
  compiler.context = context;

  const loader = require.resolve('./loader');
  const query = JSON.stringify({prefix, options});

  new SingleEntryPlugin(context, `!!${loader}?${query}!${logo}`).apply(compiler);

  // Compile and return a promise
  return new Promise((resolve, reject) => {
    compiler.runAsChild((err, [chunk] = [], {hash, errors = [], assets = {}} = {}) => {
      if (err) {
        return reject(err);
      }

      if (errors.length) {
        const details = errors.map(({error, message}) => message + (error ? ':\n' + error : '')).join('\n');
        return reject(new Error('Child compilation failed:\n' + details));
      }

      // Replace [hash] placeholders in filename
      const output = getAssetPath(compilation, filename, {hash, chunk});
      const result = msgpack.decode(Buffer.from(eval(assets[output].source()), 'base64'));

      delete compilation.assets[output];
      for (const {name, contents} of result.assets) {
        compilation.assets[name] = {
          source: () => contents,
          size: () => contents.length,
        };
      }

      return resolve(result.html);
    });
  });
};
