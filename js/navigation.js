(function () {
  "use strict";

  var retryTimer = null;
  var scrollUpdatePending = false;

  function getSectionByIndex(index) {
    return document.querySelector('[data-scroll-index="' + index + '"]');
  }

  function getNavLinks() {
    return Array.prototype.slice.call(
      document.querySelectorAll("[data-scroll-nav], [data-scroll-goto]")
    );
  }

  function getLinkIndex(link) {
    return link.getAttribute("data-scroll-nav") || link.getAttribute("data-scroll-goto");
  }

  function closeMobileNav() {
    var collapse = document.querySelector(".navbar-collapse");
    if (collapse) {
      collapse.classList.remove("show");
    }
  }

  function setActiveNav(index) {
    getNavLinks().forEach(function (link) {
      if (!link.classList.contains("nav-link")) {
        return;
      }
      if (getLinkIndex(link) === String(index)) {
        link.classList.add("active");
        link.classList.remove("last-active");
      } else {
        link.classList.remove("active", "last-active");
      }
    });
  }

  function scrollToSection(index) {
    var target = getSectionByIndex(index);
    if (!target) {
      return false;
    }

    var top = target.getBoundingClientRect().top + window.pageYOffset - 15;
    window.scrollTo({
      top: Math.max(0, top),
      behavior: "smooth",
    });
    setActiveNav(index);
    return true;
  }

  function scrollToSectionWhenReady(index) {
    if (retryTimer) {
      clearInterval(retryTimer);
      retryTimer = null;
    }

    if (scrollToSection(index)) {
      return;
    }

    var attempts = 0;
    retryTimer = setInterval(function () {
      attempts += 1;
      if (scrollToSection(index) || attempts >= 50) {
        clearInterval(retryTimer);
        retryTimer = null;
      }
    }, 100);
  }

  function handleNavigationClick(event) {
    var link = event.target.closest("[data-scroll-nav], [data-scroll-goto]");
    if (!link) {
      return;
    }

    var index = getLinkIndex(link);
    if (index == null) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    if (typeof event.stopImmediatePropagation === "function") {
      event.stopImmediatePropagation();
    }

    closeMobileNav();
    setActiveNav(index);
    scrollToSectionWhenReady(index);
  }

  function updateActiveNavFromScroll() {
    scrollUpdatePending = false;

    var sections = Array.prototype.slice.call(document.querySelectorAll("[data-scroll-index]"));
    if (!sections.length) {
      return;
    }

    var current = sections[0].getAttribute("data-scroll-index");
    var probe = window.pageYOffset + 120;

    sections.forEach(function (section) {
      if (section.offsetTop <= probe) {
        current = section.getAttribute("data-scroll-index");
      }
    });

    setActiveNav(current);
  }

  function scheduleActiveNavUpdate() {
    if (scrollUpdatePending) {
      return;
    }
    scrollUpdatePending = true;
    window.requestAnimationFrame(updateActiveNavFromScroll);
  }

  document.addEventListener("click", handleNavigationClick, true);
  window.addEventListener("scroll", scheduleActiveNavUpdate, { passive: true });
  window.addEventListener("resize", scheduleActiveNavUpdate);

  window.siteNavigation = {
    refresh: scheduleActiveNavUpdate,
    scrollTo: scrollToSectionWhenReady,
  };
})();
