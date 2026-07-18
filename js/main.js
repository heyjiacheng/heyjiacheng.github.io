/************* Main Js File ************************
    Template Name: Boyuan - Website
    Author: cosmos-themes
    Version: 2.0
    Copyright 2021
****************************************/

function revealPageSections() {
  var navBar = document.getElementById("navbar");
  if (navBar) {
    navBar.style.display = "";
  }
  var bannerSection = document.getElementById("home");
  if (bannerSection) {
    bannerSection.style.display = "block";
  }
  ["about", "featured-writing", "research"].forEach(function (id) {
    var section = document.getElementById(id);
    if (section) {
      section.style.display = "";
    }
  });
  var footer = document.getElementById("footer");
  if (footer) {
    footer.style.display = "";
  }
}

window.revealPageSections = revealPageSections;

var windowLoadTasksDone = false;

function onWindowLoadTasks() {
  if (windowLoadTasksDone) {
    return;
  }
  windowLoadTasksDone = true;
  revealPageSections();
}

/*========Window Load Function========*/
$(window).on("load", onWindowLoadTasks);
if (document.readyState === "complete") {
  onWindowLoadTasks();
}

/*========Document Ready Function========*/
$(function () {
  "use strict";
  var wind = $(window);

  //Home Section Height
  function homeHeight() {
    $("#home").css({
      height: $(window).height() + "px",
    });
  }
  homeHeight();
  wind.resize(homeHeight);

  //Highlight the last nav item when scrolled to the bottom
  wind.scroll(function () {
    var navItem = $("nav .navbar-nav .nav-item .nav-link[data-scroll-nav]").last();
    if ($(window).scrollTop() + $(window).height() == $(document).height()) {
      if (!navItem.hasClass("active")) {
        $("nav .navbar-nav .nav-item .nav-link").removeClass("active");
        navItem.addClass("last-active");
      }
    }
    if (navItem.hasClass("last-active")) {
      if ($("nav .navbar-nav .nav-item .nav-link").hasClass("active")) {
        navItem.removeClass("last-active");
      }
    }
  });

  /*========Navbar Scrolling Background========*/
  wind.on("scroll", function () {
    var navbar = $(".navbar");
    if (wind.scrollTop() > 300) {
      navbar.addClass("fixed-top");
    } else {
      navbar.removeClass("fixed-top");
    }
  });

  /*========Navbar Close On Click Mobile Responsive========*/
  $(".nav-item .nav-link").on("click", function () {
    $(".navbar-collapse").removeClass("show");
  });

  /*========Stellar (parallax) Setup========*/
  wind.stellar({
    horizontalScrolling: false,
  });
});
