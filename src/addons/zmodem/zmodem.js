/**
 *
 * Allow xterm.js to handle ZMODEM uploads and downloads.
 *
 * This addon is a wrapper around zmodem.js. It adds the following:
 *
 * - function `zmodemAttach(<WebSocket>)` - creates a Zmodem.Sentry
 *      on the passed WebSocket object.
 *
 * - event `zmodemDetect` - fired on Zmodem.Sentry’s `on_detect` callback.
 *      Passes the zmodem.js Detection object.
 *
 * - event `zmodemRetract` - fired on Zmodem.Sentry’s `on_retract` callback.
 *
 * You’ll need to provide logic to handle uploads and downloads.
 * See zmodem.js’s documentation for more details.
 *
 * **IMPORTANT:** After you confirm() a zmodem.js Detection, if you have
 *  used the `attach` or `terminado` addons, you’ll need to suspend their
 *  operation for the duration of the ZMODEM session. (The demo does this
 *  via `detach()` and a re-`attach()`.)
 */
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
