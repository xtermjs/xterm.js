//Eventually?
//import { Zmodem } from './zmodemjs/dist/zmodem';

(function (addon) {
  if (typeof exports === 'object' && typeof module === 'object') {
    /*
     * CommonJS environment
     */
    module.exports = addon(require('../../Terminal').Terminal);
  } else if (typeof define == 'function') {
    /*
     * Require.js is available
     */
    define(['../../xterm'], addon);
  } else {
    /*
     * Plain browser environment
     */
    addon(window.Terminal);
  }
})(function _zmodemAddon(Terminal) {
    Object.assign(
        Terminal.prototype,
        {
            zmodemAttach: function zmodemAttach(ws) {
                var term = this;

                var senderFunc = function _ws_sender_func(octets) {
                    ws.send( new Uint8Array(octets) );
                };

                var zsentry = new Zmodem.Sentry( {
                    to_terminal: function _to_terminal(octets) {
                        term.write(
                            String.fromCharCode.apply(String, octets)
                        );
                    },

                    sender: senderFunc,

                    on_retract: function _on_retract() {
                        term.emit("zmodemRetract");
                    },

                    on_detect: function _on_detect(detection) {
                        term.emit("zmodemDetect", detection);
                    },
                } );

                function handleWSMessage(evt) {

                    //For some reason the first message from the server is text.
                    if (typeof evt.data === "string") {
                        term.write(evt.data);
                    }
                    else {
                        zsentry.consume(evt.data);
                    }
                }

                ws.binaryType = "arraybuffer";
                ws.addEventListener("message", handleWSMessage);
            },

            zmodemBrowser: Zmodem.Browser,
        }
    );
});
