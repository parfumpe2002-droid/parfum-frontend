(() => {
    "use strict";

    const carousel = document.querySelector("[data-sponsor-carousel]");
    const track = document.getElementById("heroTrack");
    const previousButton = document.getElementById("heroPrev");
    const nextButton = document.getElementById("heroNext");
    const dotsContainer = document.getElementById("heroDots");

    if (!carousel || !track || !dotsContainer) return;

    const slides = [...track.querySelectorAll(".hero-slide")];
    const realSlides = [...track.querySelectorAll("[data-real-slide]")];
    if (realSlides.length < 2 || slides.length !== realSlides.length + 2) return;

    const AUTOPLAY_DELAY = 4800;
    const TRANSITION_MS = 850;
    let position = 1;
    let autoplayId = null;
    let transitionLocked = false;
    let pointerStartX = null;
    let unlockTimer = null;
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

    const dots = realSlides.map((_, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.setAttribute("aria-label", `Mostrar banner ${index + 1}`);
        button.addEventListener("click", () => goToRealSlide(index));
        dotsContainer.appendChild(button);
        return button;
    });

    function realIndex() {
        if (position === 0) return realSlides.length - 1;
        if (position === slides.length - 1) return 0;
        return position - 1;
    }

    function updateAccessibility() {
        const activeRealIndex = realIndex();
        dots.forEach((dot, index) => {
            const active = index === activeRealIndex;
            dot.classList.toggle("active", active);
            dot.setAttribute("aria-current", active ? "true" : "false");
        });

        realSlides.forEach((slide, index) => {
            const active = index === activeRealIndex;
            slide.setAttribute("aria-hidden", String(!active));
            slide.querySelectorAll("a, button").forEach(element => {
                if (active) element.removeAttribute("tabindex");
                else element.setAttribute("tabindex", "-1");
            });
        });
    }

    function paint(animate = true) {
        const shouldAnimate = animate && !reduceMotion;
        track.style.transition = shouldAnimate ? `transform ${TRANSITION_MS}ms cubic-bezier(.65,0,.35,1)` : "none";
        track.style.transform = `translate3d(-${position * 100}%, 0, 0)`;
        updateAccessibility();
    }

    function finishTransition() {
        window.clearTimeout(unlockTimer);

        if (position === slides.length - 1) {
            position = 1;
            paint(false);
        } else if (position === 0) {
            position = realSlides.length;
            paint(false);
        }

        transitionLocked = false;
    }

    function scheduleUnlock() {
        window.clearTimeout(unlockTimer);
        unlockTimer = window.setTimeout(finishTransition, reduceMotion ? 40 : TRANSITION_MS + 160);
    }

    function restartAutoplay() {
        window.clearInterval(autoplayId);
        autoplayId = window.setInterval(() => move(1, false), AUTOPLAY_DELAY);
    }

    function move(direction, userAction = true) {
        if (transitionLocked) return;
        transitionLocked = true;
        position += direction;
        paint(true);
        scheduleUnlock();
        if (userAction) restartAutoplay();
    }

    function goToRealSlide(index) {
        if (transitionLocked || index < 0 || index >= realSlides.length) return;
        const targetPosition = index + 1;
        if (targetPosition === position) {
            restartAutoplay();
            return;
        }
        transitionLocked = true;
        position = targetPosition;
        paint(true);
        scheduleUnlock();
        restartAutoplay();
    }

    track.addEventListener("transitionend", event => {
        if (event.propertyName === "transform") finishTransition();
    });

    previousButton?.addEventListener("click", () => move(-1));
    nextButton?.addEventListener("click", () => move(1));

    carousel.addEventListener("pointerdown", event => {
        if (event.pointerType === "mouse" && event.button !== 0) return;
        pointerStartX = event.clientX;
    });
    carousel.addEventListener("pointerup", event => {
        if (pointerStartX === null) return;
        const distance = event.clientX - pointerStartX;
        pointerStartX = null;
        if (Math.abs(distance) >= 55) move(distance < 0 ? 1 : -1);
    });
    carousel.addEventListener("pointercancel", () => { pointerStartX = null; });

    document.addEventListener("visibilitychange", () => {
        if (document.hidden) window.clearInterval(autoplayId);
        else restartAutoplay();
    });

    carousel.addEventListener("mouseenter", () => window.clearInterval(autoplayId));
    carousel.addEventListener("mouseleave", restartAutoplay);
    carousel.addEventListener("focusin", () => window.clearInterval(autoplayId));
    carousel.addEventListener("focusout", event => {
        if (!carousel.contains(event.relatedTarget)) restartAutoplay();
    });

    // Empieza en el primer banner real; los clones quedan fuera de vista.
    paint(false);
    restartAutoplay();
})();
