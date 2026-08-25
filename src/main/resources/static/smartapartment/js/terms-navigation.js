(() => {
    const navigation = document.querySelector(".terms-nav");
    if (!navigation) return;

    const links = [...navigation.querySelectorAll('a[href^="#"]')];
    if (!links.length) return;

    function updateActiveLink() {
        const selected = links.find(link => link.hash === window.location.hash) || links[0];

        links.forEach(link => {
            const isActive = link === selected;
            link.classList.toggle("active", isActive);
            if (isActive) {
                link.setAttribute("aria-current", "location");
            } else {
                link.removeAttribute("aria-current");
            }
        });
    }

    window.addEventListener("hashchange", updateActiveLink);
    updateActiveLink();
})();
