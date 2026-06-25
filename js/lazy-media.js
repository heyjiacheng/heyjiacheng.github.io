var lazyMediaObserver = null;
var travelWarmStarted = false;

function initLazyMedia() {
  if (!("IntersectionObserver" in window)) {
    return;
  }
  if (lazyMediaObserver) {
    return;
  }
  lazyMediaObserver = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) {
          return;
        }
        activateLazyImage(entry.target);
      });
    },
    { rootMargin: "900px 0px", threshold: 0.01 }
  );
}

function activateLazyImage(img) {
  var src = img.getAttribute("data-src");
  if (!src) {
    return;
  }
  img.decoding = "async";
  img.src = src;
  img.removeAttribute("data-src");
  img.removeAttribute("loading");
  if (lazyMediaObserver) {
    lazyMediaObserver.unobserve(img);
  }
}

function deferImagesInHtml(html) {
  return html.replace(/(<img\b[^>]*?\s)src=(["'])/gi, "$1data-src=$2");
}

function observeLazyMedia(root) {
  initLazyMedia();
  var scope = root && root.querySelectorAll ? root : document;
  var images = scope.querySelectorAll
    ? scope.querySelectorAll("img[data-src]")
    : document.querySelectorAll("img[data-src]");
  if (!lazyMediaObserver) {
    images.forEach(function (img) {
      activateLazyImage(img);
    });
    return;
  }
  images.forEach(function (img) {
    lazyMediaObserver.observe(img);
  });
}

function getPublicationLazyImages(root, selectedOnly) {
  var scope = root || document.getElementById("main-pub-card-container");
  if (!scope) {
    return [];
  }
  var selector = selectedOnly
    ? '.pub-card[data-selected="true"] img[data-src]'
    : "img[data-src]";
  return Array.prototype.slice.call(scope.querySelectorAll(selector));
}

function warmPublicationImages(root, selectedOnly) {
  var images = getPublicationLazyImages(root, selectedOnly);
  if (!images.length) {
    return;
  }

  if (selectedOnly || images.length <= 15) {
    images.forEach(activateLazyImage);
    return;
  }

  var index = 0;
  var batchSize = 4;

  function loadBatch() {
    var count = 0;
    while (index < images.length && count < batchSize) {
      activateLazyImage(images[index]);
      index += 1;
      count += 1;
    }

    if (index < images.length) {
      if ("requestIdleCallback" in window) {
        requestIdleCallback(loadBatch, { timeout: 400 });
      } else {
        setTimeout(loadBatch, 120);
      }
    }
  }

  loadBatch();
}

function schedulePublicationImageWarm(root, selectedOnly) {
  var images = getPublicationLazyImages(root, selectedOnly);
  if (!images.length) {
    return;
  }

  var run = function () {
    warmPublicationImages(root, selectedOnly);
  };

  if (selectedOnly || images.length <= 15) {
    run();
    return;
  }

  if ("requestIdleCallback" in window) {
    requestIdleCallback(run, { timeout: 800 });
  } else {
    setTimeout(run, 100);
  }
}

function getTravelLazyImages(root) {
  var scope = root || document.getElementById("portfolio");
  if (!scope) {
    return [];
  }
  return Array.prototype.slice.call(
    scope.querySelectorAll(".portfolio-group.robot img[data-src], .portfolio-group.robot img[src]")
  );
}

function scheduleTravelImageWarm(root) {
  if (travelWarmStarted) {
    return;
  }
  var images = getTravelLazyImages(root);
  if (!images.length) {
    return;
  }
  travelWarmStarted = true;

  var run = function () {
    warmTravelImages(root);
  };

  if ("requestIdleCallback" in window) {
    requestIdleCallback(run, { timeout: 250 });
  } else {
    setTimeout(run, 120);
  }
}

function warmTravelImages(root) {
  var images = getTravelLazyImages(root);
  if (!images.length) {
    return;
  }

  var index = 0;
  var batchSize = 8;

  function loadBatch() {
    var count = 0;
    while (index < images.length && count < batchSize) {
      if (images[index].hasAttribute("data-src")) {
        activateLazyImage(images[index]);
      } else {
        images[index].removeAttribute("loading");
      }
      index += 1;
      count += 1;
    }

    if (index < images.length) {
      if ("requestIdleCallback" in window) {
        requestIdleCallback(loadBatch, { timeout: 250 });
      } else {
        setTimeout(loadBatch, 80);
      }
    }
  }

  loadBatch();
}
