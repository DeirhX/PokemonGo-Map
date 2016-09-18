define(["require", "exports"], function (require, exports) {
    "use strict";
    function isTouchDevice() {
        // Should cover most browsers
        return "ontouchstart" in window || navigator.maxTouchPoints;
    }
    exports.isTouchDevice = isTouchDevice;
    ;
});
//# sourceMappingURL=environment.js.map