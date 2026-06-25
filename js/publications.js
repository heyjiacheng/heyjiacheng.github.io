$.fn.isInViewport = function () {
  var elementTop = $(this).offset().top;
  var elementBottom = elementTop + $(this).outerHeight();
  var viewportTop = $(window).scrollTop();
  var viewportBottom = viewportTop + $(window).height();
  return elementBottom > viewportTop && elementTop < viewportBottom;
};

var allPublications = null;
var allTopicsLink = null;
var allTopics = [];

function publicationBySelected() {
  document.getElementById("publication-by-selected").classList.add("selected-btn");
  document.getElementById("publication-by-date").classList.remove("selected-btn");
  document.getElementById("publication-by-topic").classList.remove("selected-btn");

  var a = $("#publication-by-selected");
  if (a.hasClass("activated")) {
    return;
  }

  $("#main-pub-container .subtitle a").removeClass("activated");
  $("#main-pub-container .subtitle-aux a").removeClass("activated");
  a.addClass("activated");

  var scrollY = window.scrollY || window.pageYOffset || 0;
  $("#main-pub-card-container").html("");
  for (var pubId = 0; pubId < allPublications.length; pubId++) {
    var pub = $(allPublications[pubId]);
    if (pub.data("selected") == true) {
      $("#main-pub-card-container").append(pub);
    }
  }
  if (scrollY > 0) {
    window.scrollTo(0, scrollY);
  }
  refreshPublicationImages();
}

function publicationByDate() {
  document.getElementById("publication-by-selected").classList.remove("selected-btn");
  document.getElementById("publication-by-date").classList.add("selected-btn");
  document.getElementById("publication-by-topic").classList.remove("selected-btn");

  var a = $("#publication-by-date");
  if (a.hasClass("activated")) {
    return;
  }

  $("#main-pub-container .subtitle a").removeClass("activated");
  $("#main-pub-container .subtitle-aux a").removeClass("activated");
  a.addClass("activated");

  $("#main-pub-card-container").html("");
  for (var pubId = 0; pubId < allPublications.length; pubId++) {
    if (
      pubId == 0 ||
      $(allPublications[pubId - 1]).data("year") != $(allPublications[pubId]).data("year")
    ) {
      var year = $(allPublications[pubId]).data("year");
      $("#main-pub-card-container").append(
        $("<h5 id='year-" + year.toString() + "'>" + year.toString() + "</h5>")
      );
    }
    $("#main-pub-card-container").append(allPublications[pubId]);
  }
  refreshPublicationImages();
}

function publicationByTopicInner() {
  var a = $("#publication-by-topic");
  if (a.hasClass("activated")) {
    return;
  }
  $("#main-pub-container .subtitle a").removeClass("activated");
  a.addClass("activated");

  $("#main-pub-card-container").html("");
  for (var topicId in allTopics) {
    var topic = allTopics[topicId].name;
    var topicTitle = allTopics[topicId].title;
    $("#main-pub-card-container").append(
      $("<h5 id='topic-" + topic + "'>" + topicTitle + "</h5>")
    );
    for (var pubId = 0; pubId < allPublications.length; pubId++) {
      var pub = $(allPublications[pubId]);
      if (pub.data("topic").indexOf(topic) != -1) {
        $("#main-pub-card-container").append(pub);
      }
    }
  }
  refreshPublicationImages();
}

function publicationByTopicSpecificInner(a) {
  if ($(a).hasClass("activated")) {
    return false;
  }

  $("#main-pub-container .subtitle-aux a").removeClass("activated");
  $(a).addClass("activated");
}

function publicationByTopic() {
  document.getElementById("publication-by-selected").classList.remove("selected-btn");
  document.getElementById("publication-by-date").classList.remove("selected-btn");
  document.getElementById("publication-by-topic").classList.add("selected-btn");

  publicationByTopicInner();
  publicationByTopicSpecificInner($("#main-pub-container .subtitle-aux a:first"));
  return true;
}

function publicationByTopicSpecific(a) {
  if (!$("#publication-by-topic").hasClass("activated")) {
    publicationByTopic();
  } else {
    publicationByTopicInner();
    document.getElementById("publication-by-selected").classList.remove("selected-btn");
    document.getElementById("publication-by-date").classList.remove("selected-btn");
    document.getElementById("publication-by-topic").classList.add("selected-btn");
  }

  publicationByTopicSpecificInner(a);

  var hash = a.hash;
  if (hash && hash.length > 1) {
    var target = $(hash);
    if (target.length && !target.isInViewport()) {
      $("html, body").animate({ scrollTop: target.offset().top - 15 }, 600);
    }
    if (history.replaceState) {
      history.replaceState(null, "", hash);
    }
  }
  return false;
}

function refreshPublicationImages() {
  var container = document.getElementById("main-pub-card-container");
  var showingSelected = $("#publication-by-selected").hasClass("activated");
  schedulePublicationImageWarm(container, showingSelected);
  observeLazyMedia(container);
  refreshPublicationVideos(container);
}

function refreshPublicationVideos(container) {
  if (!container) {
    return;
  }
  Array.prototype.slice.call(container.querySelectorAll("video")).forEach(function (video) {
    var started = false;

    function startVideo() {
      if (started && video.readyState >= 2) {
        return;
      }
      started = true;
      video.muted = true;
      video.defaultMuted = true;
      video.loop = true;
      video.autoplay = true;
      video.playsInline = true;
      video.setAttribute("muted", "");
      video.setAttribute("loop", "");
      video.setAttribute("autoplay", "");
      video.setAttribute("playsinline", "");
      video.setAttribute("webkit-playsinline", "");
      video.setAttribute("preload", "auto");
      video.preload = "auto";

      if (video.readyState === 0) {
        video.load();
      }

      var playPromise = video.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(function () {
          started = false;
        });
      }
    }

    video.preload = "auto";
    video.addEventListener("loadedmetadata", startVideo, { once: true });
    video.addEventListener("canplay", startVideo, { once: true });
    video.load();
    startVideo();
    setTimeout(startVideo, 500);
    setTimeout(startVideo, 1500);
  });
}

function initPublications() {
  allPublications = $("#main-pub-card-container .pub-card");
  allTopicsLink = $("#main-pub-container .subtitle-aux a");
  allTopics = [];
  for (var topicId = 0; topicId < allTopicsLink.length; topicId++) {
    allTopics.push({
      name: $(allTopicsLink[topicId]).data("topic"),
      title: $(allTopicsLink[topicId]).html(),
    });
  }

  document.getElementById("publication-by-selected").classList.add("selected-btn");
  document.getElementById("publication-by-date").classList.remove("selected-btn");
  document.getElementById("publication-by-topic").classList.remove("selected-btn");
  $("#main-pub-container .subtitle a").removeClass("activated");
  $("#main-pub-container .subtitle-aux a").removeClass("activated");
  $("#publication-by-selected").addClass("activated");
  $("#main-pub-card-container").removeClass("hide");

  var container = $("#main-pub-card-container");
  var scrollY = window.scrollY || window.pageYOffset || 0;
  container.empty();
  allPublications.each(function () {
    if ($(this).data("selected") == true) {
      container.append(this);
    }
  });

  if (scrollY > 0) {
    window.scrollTo(0, scrollY);
  }

  schedulePublicationImageWarm(container[0], true);
  observeLazyMedia(container[0]);
  refreshPublicationVideos(container[0]);
}
