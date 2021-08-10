Cursory test that 'xterm-headless' works:

```
# From root of this repo
npm run compile # Outputs to out/headless
npx webpack --config webpack.config.headless.js # Outputs to lib
cd node-test
npm link ../lib/
node index.js
```
