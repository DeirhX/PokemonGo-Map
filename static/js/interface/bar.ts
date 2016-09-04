import {addEventsListener} from "../utils";

let $body = document.querySelector("body");

export class Bar {
    public $nav: Element;
    public $toggle: Element;
    public $close: HTMLAnchorElement;

    private linkSelect: string;

    constructor(id: string) {
        this.$nav = document.querySelector(`#${id}`);
        this.linkSelect =  `a[href="#${id}"]`;
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
        addEventsListener(this.$nav, "click touchend", event => event.stopPropagation());

        // Event: Hide nav on body click/tap.
        addEventsListener($body, "click touchend", event =>  {
            // on ios safari, when navToggle is clicked,
            // this function executes too, so if the target
            // is the toggle button, exit this function
            if (event.target.matches(this.linkSelect)) {
                return;
            }
            this.$nav.classList.remove("visible");
        });

        // Event: Hide on ESC.
        window.addEventListener("keydown", event => {
            if (event.keyCode === 27) {
                this.$nav.classList.remove("visible");
            }
        });

        // Event: Toggle on click.
        if (this.$toggle) {
            this.$toggle.addEventListener("click", event => {
                event.preventDefault();
                event.stopPropagation();
                this.$nav.classList.toggle("visible");
            });
        }

        // Event: Hide nav on click.
        this.$close.addEventListener("click", event => {
            event.preventDefault();
            event.stopPropagation();
            this.$nav.classList.remove("visible");
        });
    }
}