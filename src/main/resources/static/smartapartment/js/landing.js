(() => {
    "use strict";

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const nav = document.getElementById("nav");
    const menuButton = document.getElementById("menuButton");

    const revealItems = [...document.querySelectorAll(".landing-reveal, .landing-reveal-right")];
    if (reducedMotion || !("IntersectionObserver" in window)) {
        revealItems.forEach(item => item.classList.add("in"));
    } else {
        const revealObserver = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) return;
                entry.target.classList.add("in");
                revealObserver.unobserve(entry.target);
            });
        }, { threshold: 0.08 });
        revealItems.forEach(item => revealObserver.observe(item));
    }

    const counters = [...document.querySelectorAll("[data-counter]")];
    function animateCounter(element) {
        const target = Number(element.dataset.counter || 0);
        const suffix = element.dataset.suffix || "";
        if (reducedMotion || target <= 1) {
            element.textContent = target.toLocaleString("en-IN") + suffix;
            return;
        }
        const startedAt = performance.now();
        const duration = 1800;
        const step = now => {
            const progress = Math.min((now - startedAt) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 4);
            element.textContent = Math.floor(target * eased).toLocaleString("en-IN") + suffix;
            if (progress < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
    }
    if ("IntersectionObserver" in window) {
        const counterObserver = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (!entry.isIntersecting || entry.target.dataset.counted) return;
                entry.target.dataset.counted = "true";
                animateCounter(entry.target);
                counterObserver.unobserve(entry.target);
            });
        }, { threshold: 0.45 });
        counters.forEach(counter => counterObserver.observe(counter));
    } else {
        counters.forEach(animateCounter);
    }

    const sectionLinks = [...document.querySelectorAll(".nav-links a[href^='#']")];
    const sections = sectionLinks.map(link => document.querySelector(link.getAttribute("href"))).filter(Boolean);
    let navFrame = 0;
    function updateActiveNavigation() {
        navFrame = 0;
        const marker = window.scrollY + 150;
        let current = sections[0]?.id || "home";
        sections.forEach(section => {
            if (marker >= section.offsetTop) current = section.id;
        });
        sectionLinks.forEach(link => {
            const active = link.getAttribute("href") === `#${current}`;
            link.classList.toggle("active", active);
            if (active) link.setAttribute("aria-current", "page");
            else link.removeAttribute("aria-current");
        });
    }
    window.addEventListener("scroll", () => {
        if (!navFrame) navFrame = requestAnimationFrame(updateActiveNavigation);
    }, { passive: true });
    updateActiveNavigation();

    function closeMobileNavigation() {
        nav?.classList.remove("open");
        menuButton?.classList.remove("open");
        menuButton?.setAttribute("aria-expanded", "false");
        document.body.classList.remove("menu-open");
    }
    menuButton?.addEventListener("click", () => {
        window.setTimeout(() => {
            const open = nav?.classList.contains("open") || false;
            menuButton.classList.toggle("open", open);
            menuButton.setAttribute("aria-expanded", String(open));
            document.body.classList.toggle("menu-open", open);
        }, 0);
    });
    nav?.querySelectorAll("a").forEach(link => link.addEventListener("click", closeMobileNavigation));
    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && nav?.classList.contains("open")) closeMobileNavigation();
    });

    function setupPhoneCarousel() {
        const root = document.getElementById("phoneCarousel");
        const slides = [...root?.querySelectorAll(".phone-slide") || []];
        const dotsRoot = document.getElementById("phoneDots");
        if (!root || !dotsRoot || slides.length < 2) return;
        let active = 0;
        let timer = 0;
        const dots = slides.map((_, index) => {
            const dot = document.createElement("button");
            dot.type = "button";
            dot.setAttribute("aria-label", `Show workspace preview ${index + 1}`);
            dot.addEventListener("click", () => show(index, true));
            dotsRoot.appendChild(dot);
            return dot;
        });
        function show(index, resetTimer = false) {
            active = (index + slides.length) % slides.length;
            slides.forEach((slide, slideIndex) => slide.classList.toggle("active", slideIndex === active));
            dots.forEach((dot, dotIndex) => {
                const selected = dotIndex === active;
                dot.classList.toggle("active", selected);
                dot.setAttribute("aria-current", selected ? "true" : "false");
            });
            if (resetTimer) start();
        }
        function stop() { window.clearInterval(timer); }
        function start() {
            stop();
            if (!reducedMotion) timer = window.setInterval(() => show(active + 1), 3000);
        }
        root.addEventListener("mouseenter", stop);
        root.addEventListener("mouseleave", start);
        root.addEventListener("focusin", stop);
        root.addEventListener("focusout", start);
        show(0);
        start();
    }

    function setupTestimonialCarousel() {
        const viewport = document.getElementById("testimonialViewport");
        const track = document.getElementById("testimonialTrack");
        const dotsRoot = document.getElementById("testimonialDots");
        const slides = [...track?.querySelectorAll(".testimonial-slide") || []];
        if (!viewport || !track || !dotsRoot || slides.length < 2) return;
        let active = 0;
        let timer = 0;
        const dots = slides.map((_, index) => {
            const dot = document.createElement("button");
            dot.type = "button";
            dot.setAttribute("aria-label", `Show role story ${index + 1}`);
            dot.addEventListener("click", () => show(index, true));
            dotsRoot.appendChild(dot);
            return dot;
        });
        function show(index, resetTimer = false) {
            active = (index + slides.length) % slides.length;
            track.style.transform = `translateX(-${active * 100}%)`;
            dots.forEach((dot, dotIndex) => {
                const selected = dotIndex === active;
                dot.classList.toggle("active", selected);
                dot.setAttribute("aria-current", selected ? "true" : "false");
            });
            if (resetTimer) start();
        }
        function stop() { window.clearInterval(timer); }
        function start() {
            stop();
            if (!reducedMotion) timer = window.setInterval(() => show(active + 1), 3500);
        }
        viewport.addEventListener("mouseenter", stop);
        viewport.addEventListener("mouseleave", start);
        viewport.addEventListener("focusin", stop);
        viewport.addEventListener("focusout", start);
        show(0);
        start();
    }

    const tutorialTabs = [...document.querySelectorAll("[data-tutorial-filter]")];
    const tutorialCards = [...document.querySelectorAll("#tutorialGrid [data-category]")];
    tutorialTabs.forEach(tab => tab.addEventListener("click", () => {
        const category = tab.dataset.tutorialFilter;
        tutorialTabs.forEach(item => {
            const selected = item === tab;
            item.classList.toggle("active", selected);
            item.setAttribute("aria-selected", String(selected));
        });
        tutorialCards.forEach(card => {
            const visible = category === "all" || card.dataset.category === category;
            card.hidden = !visible;
        });
    }));

    const demoForm = document.getElementById("landingDemoForm");
    const personaTabs = [...document.querySelectorAll("[data-demo-persona]")];
    const societyField = document.getElementById("inlineSocietyField");
    const societyInput = demoForm?.elements.societyName;
    let persona = "society";
    function selectPersona(nextPersona) {
        persona = nextPersona === "professional" ? "professional" : "society";
        personaTabs.forEach(tab => {
            const selected = tab.dataset.demoPersona === persona;
            tab.classList.toggle("active", selected);
            tab.setAttribute("aria-selected", String(selected));
        });
        const professional = persona === "professional";
        if (societyField) societyField.hidden = professional;
        if (societyInput) societyInput.required = !professional;
    }
    personaTabs.forEach(tab => tab.addEventListener("click", () => selectPersona(tab.dataset.demoPersona)));
    demoForm?.addEventListener("submit", event => {
        event.preventDefault();
        if (!demoForm.reportValidity()) return;
        const values = Object.fromEntries(new FormData(demoForm).entries());
        const societyName = values.societyName || `${values.name}'s Managed Community`;
        const assign = (id, value) => {
            const element = document.getElementById(id);
            if (element) element.value = value || "";
        };
        assign("societyName", societyName);
        assign("societyAdminName", values.name);
        assign("societyAdminEmail", values.email);
        assign("societyPhone", values.phone);
        assign("societyCity", values.city);
        const title = document.getElementById("registerModalTitle");
        if (title) title.textContent = persona === "professional" ? "Create a Managed Society Workspace" : "Register Society";
        document.getElementById("registerModal")?.classList.remove("hidden");
        window.setTimeout(() => document.getElementById("societyAddress")?.focus(), 80);
    });
    selectPersona("society");

    setupPhoneCarousel();
    setupTestimonialCarousel();
})();
