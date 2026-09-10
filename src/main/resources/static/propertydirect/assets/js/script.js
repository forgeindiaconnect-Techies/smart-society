'use strict';

/**
 * element toggle function
 */

const elemToggleFunc = function (elem) { elem.classList.toggle("active"); }



/**
 * navbar toggle
 */

const navbar = document.querySelector("[data-navbar]");
const overlay = document.querySelector("[data-overlay]");
const navCloseBtn = document.querySelector("[data-nav-close-btn]");
const navOpenBtn = document.querySelector("[data-nav-open-btn]");
const navbarLinks = document.querySelectorAll("[data-nav-link]");

const navElemArr = [overlay, navCloseBtn, navOpenBtn];

/**
 * close navbar when click on any navbar link
 */

for (let i = 0; i < navbarLinks.length; i++) { navElemArr.push(navbarLinks[i]); }

/**
 * addd event on all elements for toggling navbar
 */

for (let i = 0; i < navElemArr.length; i++) {
  if (!navElemArr[i]) continue;
  navElemArr[i].addEventListener("click", function () {
    elemToggleFunc(navbar);
    elemToggleFunc(overlay);
  });
}

window.openPropertyDirectLoginModal = function (event) {
  const modal = document.getElementById('pdLoginModal');
  const username = document.getElementById('pdLoginUsername');
  const form = document.getElementById('pdLoginForm');
  const signupForm = document.getElementById('pdSignupForm');
  if (!modal || !form || !signupForm) return;
  event?.preventDefault?.();
  form.classList.remove('is-hidden');
  signupForm.classList.add('is-hidden');
  document.querySelectorAll('[data-pd-auth-mode]').forEach((tab) => {
    const active = tab.dataset.pdAuthMode === 'signin';
    tab.classList.toggle('is-active', active);
    tab.setAttribute('aria-selected', String(active));
  });
  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden', 'false');
  window.setTimeout(() => username?.focus(), 0);
};

document.addEventListener('click', function (event) {
  const loginTrigger = event.target.closest?.('#pdLoginTrigger, [data-pd-login-trigger]');
  if (loginTrigger) window.openPropertyDirectLoginModal(event);
}, true);



// PropertyDirect keeps its header fixed at the top. The original Homiee
// scroll animation moved the header upward, which made it appear to jump.
