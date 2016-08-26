"use strict";

function isThirdLevelShift(ev, isMac, isMSWindows) {
    var thirdLevelKey =
        (isMac && ev.altKey && !ev.ctrlKey && !ev.metaKey) ||
        (isMSWindows && ev.altKey && ev.ctrlKey && !ev.metaKey);

    if (ev.type == 'keypress') {
      return thirdLevelKey;
    }

    // Don't invoke for arrows, pageDown, home, backspace, etc. (on non-keypress events)
    return thirdLevelKey && (!ev.keyCode || ev.keyCode > 47);
}

module.exports = isThirdLevelShift;
