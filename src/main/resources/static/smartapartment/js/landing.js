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
        const dots = slides.map((_, index) => {
            const dot = document.createElement("button");
            dot.type = "button";
            dot.setAttribute("aria-label", `Show workspace preview ${index + 1}`);
            dot.addEventListener("click", () => show(index));
            dotsRoot.appendChild(dot);
            return dot;
        });
        function show(index) {
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
        }
        show(0);
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
    const professionalFields = [...document.querySelectorAll("[data-professional-field]")];
    const registerModal = document.getElementById("registerModal");
    const registerDetailsForm = document.getElementById("registerDetailsForm");
    const closeRegisterModal = document.getElementById("closeRegisterModal");
    const backToRegistrationBasics = document.getElementById("backToRegistrationBasics");
    const submitSociety = document.getElementById("submitSociety");
    const registrationState = document.getElementById("registrationState");
    const societyPassword = document.getElementById("societyPassword");
    const passwordGuidance = document.getElementById("passwordGuidance");
    const toggleSocietyPassword = document.getElementById("toggleSocietyPassword");
    const societyCity = document.getElementById("societyCity");
    let persona = "society";
    let modalPreviouslyFocused = null;

    const field = id => document.getElementById(id);
    const setField = (id, value) => {
        const element = field(id);
        if (element) element.value = value || "";
    };

    function setRegistrationState(message = "", type = "") {
        if (!registrationState) return;
        registrationState.textContent = message;
        registrationState.className = `registration-state${type ? ` ${type}` : ""}`;
    }

    function openRegistrationModal() {
        if (!registerModal) return;
        modalPreviouslyFocused = document.activeElement;
        registerModal.classList.remove("hidden");
        document.body.classList.add("modal-open");
        setRegistrationState();
        window.setTimeout(() => field("societyAddress")?.focus(), 80);
    }

    function closeRegistrationModal(restoreFocus = true) {
        registerModal?.classList.add("hidden");
        document.body.classList.remove("modal-open");
        if (restoreFocus && modalPreviouslyFocused instanceof HTMLElement) modalPreviouslyFocused.focus();
    }

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
        professionalFields.forEach(item => {
            item.hidden = !professional;
            item.querySelectorAll("input, select").forEach(control => control.required = professional);
        });
        const heading = demoForm?.querySelector(".registration-heading p");
        if (heading) heading.textContent = professional
            ? "Tell us who will manage the community. You can confirm the first society workspace next."
            : "Tell us who is setting up the workspace. You will review the society and administrator details next.";
    }
    personaTabs.forEach(tab => tab.addEventListener("click", () => selectPersona(tab.dataset.demoPersona)));
    demoForm?.addEventListener("submit", event => {
        event.preventDefault();
        if (!demoForm.reportValidity()) return;
        const values = Object.fromEntries(new FormData(demoForm).entries());
        const societyName = values.societyName || "";
        setField("societyName", societyName);
        setField("societyAdminName", values.name);
        setField("societyAdminEmail", values.email);
        setField("societyPhone", values.phone);
        setField("societyCity", values.city);
        setField("societyState", cityStates[values.city] || "");
        const title = document.getElementById("registerModalTitle");
        if (title) title.textContent = persona === "professional" ? "Complete Managed Workspace Setup" : "Complete Society Registration";
        const modalSocietyName = field("societyName");
        if (modalSocietyName) modalSocietyName.placeholder = persona === "professional" ? "Enter the first society to onboard" : "Example: Green Nest Apartments";
        openRegistrationModal();
    });

    closeRegisterModal?.addEventListener("click", () => closeRegistrationModal());
    backToRegistrationBasics?.addEventListener("click", () => closeRegistrationModal());
    registerModal?.addEventListener("click", event => {
        if (event.target === registerModal) closeRegistrationModal();
    });
    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && !registerModal?.classList.contains("hidden")) closeRegistrationModal();
    });

    toggleSocietyPassword?.addEventListener("click", () => {
        if (!societyPassword) return;
        const reveal = societyPassword.type === "password";
        societyPassword.type = reveal ? "text" : "password";
        toggleSocietyPassword.textContent = reveal ? "Hide" : "Show";
        toggleSocietyPassword.setAttribute("aria-label", reveal ? "Hide password" : "Show password");
    });

    societyPassword?.addEventListener("input", () => {
        const value = societyPassword.value;
        const checks = [value.length >= 8, /\d/.test(value), /[^A-Za-z0-9]/.test(value)];
        const score = checks.filter(Boolean).length;
        if (!passwordGuidance) return;
        passwordGuidance.textContent = score === 3 ? "Strong password" : score === 2 ? "Good start—add a symbol or number." : "Use 8+ characters with a number and symbol.";
        passwordGuidance.dataset.strength = String(score);
    });

    const cityStates = {
        Chennai: "Tamil Nadu",
        Bangalore: "Karnataka",
        Hyderabad: "Telangana",
        Pune: "Maharashtra",
        Mumbai: "Maharashtra",
        "Delhi NCR": "Delhi"
    };
    societyCity?.addEventListener("change", () => {
        const state = field("societyState");
        if (state && cityStates[societyCity.value]) state.value = cityStates[societyCity.value];
    });

    registerDetailsForm?.addEventListener("submit", async event => {
        event.preventDefault();
        if (!registerDetailsForm.reportValidity() || !submitSociety) return;

        const payload = {
            societyName: field("societyName")?.value.trim() || "",
            contactEmail: field("societyAdminEmail")?.value.trim() || "",
            phone: field("societyPhone")?.value.trim() || "",
            address: field("societyAddress")?.value.trim() || "",
            city: field("societyCity")?.value || "",
            state: field("societyState")?.value.trim() || "",
            country: field("societyCountry")?.value || "",
            postalCode: field("societyPostalCode")?.value.trim() || "",
            societyType: field("societyType")?.value || "",
            registrationNumber: field("societyRegistrationNumber")?.value.trim() || "",
            totalUnits: Number(field("societyTotalUnits")?.value || 0),
            totalWings: Number(field("societyTotalWings")?.value || 0),
            adminName: field("societyAdminName")?.value.trim() || "",
            adminDesignation: field("societyAdminDesignation")?.value || "",
            adminEmail: field("societyAdminEmail")?.value.trim() || "",
            password: societyPassword?.value || ""
        };

        const originalLabel = submitSociety.querySelector("span")?.textContent || "Submit for Approval";
        submitSociety.disabled = true;
        const buttonLabel = submitSociety.querySelector("span");
        if (buttonLabel) buttonLabel.textContent = "Submitting securely…";
        setRegistrationState("Creating your protected workspace request…", "loading");

        try {
            const response = await fetch("/api/auth/register-tenant", {
                method: "POST",
                headers: { "Content-Type": "application/json", Accept: "application/json" },
                body: JSON.stringify(payload)
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.message || "Registration could not be completed. Please review the details and try again.");

            setRegistrationState(data.message || "Registration submitted successfully. Your workspace is awaiting platform approval.", "success");
            registerDetailsForm.querySelectorAll("input, select, textarea, button").forEach(control => control.disabled = true);
            window.setTimeout(() => {
                closeRegistrationModal(false);
                demoForm?.reset();
                registerDetailsForm.reset();
                selectPersona("society");
                registerDetailsForm.querySelectorAll("input, select, textarea, button").forEach(control => control.disabled = false);
                if (buttonLabel) buttonLabel.textContent = originalLabel;
            }, 1800);
        } catch (error) {
            setRegistrationState(error.message, "error");
            submitSociety.disabled = false;
            if (buttonLabel) buttonLabel.textContent = originalLabel;
        }
    });
    selectPersona("society");

    setupPhoneCarousel();
    setupTestimonialCarousel();
})();
