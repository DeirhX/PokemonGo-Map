
export function isTouchDevice() {
    // Should cover most browsers
    return "ontouchstart" in window || navigator.maxTouchPoints;
};

