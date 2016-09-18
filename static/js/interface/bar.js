define(["require", "exports", "../utils"], function (require, exports, utils_1) {
    "use strict";
    var $body = document.querySelector("body");
    var Bar = (function () {
        function Bar(id) {
            var _this = this;
            this.$nav = document.querySelector("#" + id);
            this.linkSelect = "a[href=\"#" + id + "\"]";
            this.$toggle = document.querySelector(this.linkSelect);
            this.$close = document.createElement("a");
            this.$close.href = "#";
            this.$close.className = "close";
            this.$close.tabIndex = 0;
            this.$nav.appendChild(this.$close);
            if (!this.$nav) {
                return;
            }
            // Event: Prevent clicks/taps inside the nav from bubbling.
            utils_1.addEventsListener(this.$nav, "click touchend", function (event) { return event.stopPropagation(); });
            // Event: Hide nav on body click/tap.
            utils_1.addEventsListener($body, "click touchend", function (event) {
                // on ios safari, when navToggle is clicked,
                // this function executes too, so if the target
                // is the toggle button, exit this function
                if (event.target.matches(_this.linkSelect)) {
                    return;
                }
                if (!_this.ignoreNextClick) {
                    _this.close();
                }
                _this.ignoreNextClick = false;
            });
            // Event: Hide on ESC.
            window.addEventListener("keydown", function (event) {
                if (event.keyCode === 27) {
                    _this.close();
                }
            });
            // Event: Toggle on click.
            if (this.$toggle) {
                this.$toggle.addEventListener("click", function (event) {
                    event.preventDefault();
                    event.stopPropagation();
                    _this.toggle();
                });
            }
            // Event: Hide nav on click.
            this.$close.addEventListener("click", function (event) {
                event.preventDefault();
                event.stopPropagation();
                _this.close();
            });
        }
        Bar.prototype.open = function () {
            this.$nav.classList.add("visible");
        };
        Bar.prototype.close = function () {
            this.$nav.classList.remove("visible");
        };
        Bar.prototype.toggle = function () {
            this.$nav.classList.toggle("visible");
        };
        Bar.prototype.stayOpenOnce = function () {
            this.ignoreNextClick = true;
        };
        Bar.prototype.getRoot = function () {
            return this.$nav;
        };
        return Bar;
    }());
    exports.Bar = Bar;
});
//# sourceMappingURL=bar.js.map