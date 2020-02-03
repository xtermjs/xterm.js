## xterm-addon-serialize

An addon for [xterm.js](https://github.com/xtermjs/xterm.js) that enables xterm.js to serialize a terminal framebuffer into string or html. This addon requires xterm.js v4+.

⚠️ This is an experimental addon that is still under construction ⚠️

### Install

```bash
npm install --save xterm-addon-serialize
```

### Usage

```ts
import { Terminal } from "xterm";
import { SerializeAddon } from "xterm-addon-serialize";

const terminal = new Terminal();
const serializeAddon = new SerializeAddon();
terminal.loadAddon(serializeAddon);

terminal.write("something...", () => {
  console.log(serializeAddon.serialize());
});
```

See the full [API](https://github.com/xtermjs/xterm.js/blob/master/addons/xterm-addon-serialize/typings/xterm-addon-serialize.d.ts) for more advanced usage.

### Benchmark

⚠️ Ensure you have `lolcat`, `hexdump` programs installed in your computer

```shell
$ git clone https://github.com/xtermjs/xterm.js.git
$ cd xterm.js
$ yarn
$ cd addons/xterm-addon-serialize
$ yarn benchmark && yarn benchmark-baseline
$ # change some code in `xterm-addon-serialize`
$ yarn benchmark-eval
```
