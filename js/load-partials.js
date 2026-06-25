(function () {
  "use strict";

  var siteInitialized = false;
  var siteInitializing = false;
  var homeFirstDone = false;
  var portfolioHtmlPromise = null;
  var portfolioWarmStarted = false;
  var selectedVideoPreloads = [];
  var HOME_BG = "images/background/sky.png";
  var HOME_MIN_DISPLAY_MS = 400;

  function fetchPartial(url, retries) {
    var attempts = retries == null ? 3 : retries;

    function attemptFetch(remaining) {
      return new Promise(function (resolve, reject) {
        var settled = false;
        var timer = setTimeout(function () {
          if (settled) {
            return;
          }
          settled = true;
          if (remaining > 1) {
            attemptFetch(remaining - 1).then(resolve).catch(reject);
            return;
          }
          reject(new Error("Timed out loading partial: " + url));
        }, 15000);

        fetch(url)
          .then(function (response) {
            if (settled) {
              return null;
            }
            if (!response.ok) {
              throw new Error("Failed to load partial: " + url + " (" + response.status + ")");
            }
            return response.arrayBuffer();
          })
          .then(function (buffer) {
            if (settled || buffer == null) {
              return;
            }
            settled = true;
            clearTimeout(timer);
            resolve(new TextDecoder("utf-8").decode(buffer));
          })
          .catch(function (err) {
            if (settled) {
              return;
            }
            settled = true;
            clearTimeout(timer);
            if (remaining > 1) {
              attemptFetch(remaining - 1).then(resolve).catch(reject);
              return;
            }
            reject(err);
          });
      });
    }

    return attemptFetch(attempts);
  }

  function preserveScroll(run) {
    var scrollY = window.scrollY || window.pageYOffset || 0;
    return Promise.resolve(run()).then(function (result) {
      if (scrollY > 0) {
        window.scrollTo(0, scrollY);
      }
      return result;
    });
  }

  async function replacePartial(placeholderId, url, deferImages) {
    var html = await fetchPartial(url);
    if (deferImages !== false) {
      html = deferImagesInHtml(html);
    }
    await replacePartialHtml(placeholderId, html);
  }

  async function injectHtmlInto(selector, html, deferImages) {
    if (selector === "#main-pub-card-container") {
      preloadVideoUrls(extractSelectedVideoSources(html));
    }
    if (deferImages !== false) {
      html = deferImagesInHtml(html);
    }
    var target = document.querySelector(selector);
    if (!target) {
      throw new Error("Missing target: " + selector);
    }

    await preserveScroll(function () {
      target.innerHTML = html;
      observeLazyMedia(target);
      if (window.siteNavigation) {
        window.siteNavigation.refresh();
      }
    });
  }

  async function replacePartialHtml(placeholderId, html) {
    var placeholder = document.getElementById(placeholderId);
    if (!placeholder) {
      throw new Error("Missing placeholder: " + placeholderId);
    }

    await preserveScroll(function () {
      placeholder.outerHTML = html;
      var root = document.getElementById(placeholderId.replace("partial-", ""));
      if (root) {
        observeLazyMedia(root);
      }
      if (window.siteNavigation) {
        window.siteNavigation.refresh();
      }
    });
  }

  function getPortfolioHtml() {
    if (!portfolioHtmlPromise) {
      portfolioHtmlPromise = fetchPartial("partials/portfolio.html");
    }
    return portfolioHtmlPromise;
  }

  async function injectInto(selector, url) {
    var html = await fetchPartial(url);
    await injectHtmlInto(selector, html);
  }

  function revealSectionsIfReady() {
    if (typeof window.revealPageSections === "function") {
      window.revealPageSections();
    }
  }

  function revealLoadedSections() {
    document.documentElement.classList.remove("site-loading");
    revealSectionsIfReady();
  }

  function scrollToInitialHash() {
    var hash = (window.location.hash || "").toLowerCase();
    var sectionIndexByHash = {
      "#home": "0",
      "#about": "1",
      "#research": "2",
      "#portfolio": "3",
    };
    var index = sectionIndexByHash[hash];

    if (index == null || !window.siteNavigation) {
      return;
    }

    setTimeout(function () {
      window.siteNavigation.scrollTo(index);
    }, 80);
  }

  function siteContentMissing() {
    return !document.getElementById("about") || !document.getElementById("research");
  }

  function waitForNextFrame() {
    return new Promise(function (resolve) {
      requestAnimationFrame(function () {
        requestAnimationFrame(resolve);
      });
    });
  }

  function preloadImage(src) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = resolve;
      img.onerror = resolve;
      img.src = src;
    });
  }

  function finishHomeFirstPhase() {
    if (homeFirstDone) {
      return Promise.resolve();
    }
    homeFirstDone = true;

    var home = document.getElementById("home");
    if (home) {
      home.style.minHeight = window.innerHeight + "px";
    }

    return new Promise(function (resolve) {
      setTimeout(function () {
        resolve();
      }, HOME_MIN_DISPLAY_MS);
    });
  }

  function waitWithTimeout(promise, timeoutMs) {
    return Promise.race([
      promise,
      new Promise(function (resolve) {
        setTimeout(resolve, timeoutMs);
      }),
    ]);
  }

  function waitForImageReady(img) {
    if (!img) {
      return Promise.resolve();
    }

    if (typeof activateLazyImage === "function") {
      activateLazyImage(img);
    }

    img.loading = "eager";
    img.decoding = "async";
    img.setAttribute("fetchpriority", "high");

    if (img.complete && img.naturalWidth > 0) {
      if (typeof img.decode === "function") {
        return img.decode().catch(function () {});
      }
      return Promise.resolve();
    }

    return new Promise(function (resolve) {
      img.addEventListener("load", resolve, { once: true });
      img.addEventListener("error", resolve, { once: true });
    }).then(function () {
      if (typeof img.decode === "function") {
        return img.decode().catch(function () {});
      }
    });
  }

  function waitForVideoReady(video) {
    if (!video) {
      return Promise.resolve();
    }

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

    return new Promise(function (resolve) {
      if (video.readyState >= 2) {
        resolve();
        return;
      }

      video.addEventListener("loadeddata", resolve, { once: true });
      video.addEventListener("canplay", resolve, { once: true });
      video.addEventListener("error", resolve, { once: true });
      video.load();
      var playPromise = video.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(function () {});
      }
    });
  }

  function waitForCoreMediaReady() {
    var about = document.getElementById("about");
    var publications = document.getElementById("main-pub-card-container");
    var mediaPromises = [];

    if (about) {
      Array.prototype.slice.call(about.querySelectorAll("img")).forEach(function (img) {
        mediaPromises.push(waitForImageReady(img));
      });
    }

    if (publications) {
      Array.prototype.slice.call(publications.querySelectorAll("img")).forEach(function (img) {
        mediaPromises.push(waitForImageReady(img));
      });
      Array.prototype.slice.call(publications.querySelectorAll("video")).forEach(function (video) {
        mediaPromises.push(waitForVideoReady(video));
      });
    }

    return waitWithTimeout(Promise.all(mediaPromises), 2800);
  }

  function waitForHomeReady() {
    return new Promise(function (resolve) {
      var settled = false;
      var timeoutId = setTimeout(function () {
        if (settled) {
          return;
        }
        settled = true;
        finishHomeFirstPhase().then(resolve);
      }, 8000);

      preloadImage(HOME_BG)
        .then(waitForNextFrame)
        .then(function () {
          if (settled) {
            return;
          }
          settled = true;
          clearTimeout(timeoutId);
          return finishHomeFirstPhase();
        })
        .then(resolve);
    });
  }

  function extractTravelImageSources(html) {
    var doc = new DOMParser().parseFromString(html, "text/html");
    var images = doc.querySelectorAll(".portfolio-group.robot img[src]");
    return Array.prototype.slice.call(images)
      .map(function (img) {
        return img.getAttribute("src");
      })
      .filter(Boolean);
  }

  function extractSelectedVideoSources(html) {
    var doc = new DOMParser().parseFromString(html, "text/html");
    var sources = doc.querySelectorAll('.pub-card[data-selected="true"] video source[src]');
    return Array.prototype.slice.call(sources)
      .map(function (source) {
        return source.getAttribute("src");
      })
      .filter(Boolean);
  }

  function preloadVideoUrls(urls) {
    urls.forEach(function (url) {
      var video = document.createElement("video");
      video.muted = true;
      video.defaultMuted = true;
      video.playsInline = true;
      video.preload = "auto";
      video.src = url;
      video.load();
      selectedVideoPreloads.push(video);
    });
  }

  function preloadImageUrls(urls) {
    var index = 0;
    var batchSize = 5;

    function loadBatch() {
      var count = 0;
      while (index < urls.length && count < batchSize) {
        var img = new Image();
        img.decoding = "async";
        img.src = urls[index];
        index += 1;
        count += 1;
      }

      if (index < urls.length) {
        if ("requestIdleCallback" in window) {
          requestIdleCallback(loadBatch, { timeout: 500 });
        } else {
          setTimeout(loadBatch, 120);
        }
      }
    }

    loadBatch();
  }

  function runWhenIdle(fn, timeout) {
    if ("requestIdleCallback" in window) {
      requestIdleCallback(fn, { timeout: timeout || 1000 });
    } else {
      setTimeout(fn, Math.min(timeout || 1000, 300));
    }
  }

  function loadFooterExtras() {
    runWhenIdle(function () {
      Array.prototype.slice
        .call(document.querySelectorAll("img[data-footer-src]"))
        .forEach(function (img) {
          img.src = img.getAttribute("data-footer-src");
          img.removeAttribute("data-footer-src");
        });

      var globe = document.getElementById("visitor-globe");
      if (!globe || globe.getAttribute("data-loaded") === "true") {
        return;
      }

      var src = globe.getAttribute("data-script-src");
      if (!src) {
        return;
      }

      var iframe = document.createElement("iframe");
      iframe.title = "Visitor map";
      iframe.loading = "lazy";
      iframe.style.cssText = "border:0;width:100%;height:100%;overflow:hidden;";
      iframe.srcdoc =
        '<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;width:100%;height:100%;overflow:hidden;}</style></head><body><script src="' +
        src.replace(/"/g, "%22") +
        '"><\/script></body></html>';
      globe.setAttribute("data-loaded", "true");
      globe.appendChild(iframe);
    }, 2500);
  }

  function startPortfolioWarmup() {
    if (portfolioWarmStarted) {
      return;
    }
    portfolioWarmStarted = true;

    setTimeout(function () {
      getPortfolioHtml()
        .then(function (html) {
          preloadImageUrls(extractTravelImageSources(html));
        })
        .catch(function (err) {
          console.error(err);
        });
    }, 300);
  }

  async function loadPortfolioPartial() {
    if (document.getElementById("portfolio")) {
      scheduleTravelImageWarm(document.getElementById("portfolio"));
      return;
    }
    var html = deferImagesInHtml(await getPortfolioHtml());
    await replacePartialHtml("partial-portfolio", html);
    initPortfolioTabs();
    observeLazyMedia(document.getElementById("portfolio"));
    scheduleTravelImageWarm(document.getElementById("portfolio"));
  }

  async function initSite() {
    if (siteInitialized || siteInitializing) {
      return;
    }
    siteInitializing = true;

    try {
      var aboutHtmlPromise = fetchPartial("partials/about.html");
      var researchHtmlPromise = fetchPartial("partials/research.html");
      var publicationsHtmlPromise = fetchPartial("partials/publications.html");

      await replacePartialHtml("partial-about", await aboutHtmlPromise);
      initAboutEmail();

      await replacePartialHtml(
        "partial-research",
        deferImagesInHtml(await researchHtmlPromise)
      );
      await injectHtmlInto("#main-pub-card-container", await publicationsHtmlPromise);
      schedulePublicationImageWarm(
        document.getElementById("main-pub-card-container"),
        true
      );

      initPublications();
      initHiddenAbstracts();

      await waitForCoreMediaReady();
      revealLoadedSections();
      siteInitialized = true;
      scrollToInitialHash();

      startPortfolioWarmup();
      loadFooterExtras();
      loadPortfolioPartial().catch(function (err) {
        console.error(err);
      });
    } finally {
      siteInitializing = false;
    }
  }

  function showLoadError(err) {
    console.error(err);
    document.documentElement.classList.remove("site-loading");
    var msg = document.createElement("div");
    msg.style.cssText =
      "position:fixed;top:0;left:0;right:0;padding:12px 16px;background:#fff3cd;color:#664d03;z-index:99999;font-family:sans-serif;";
    msg.textContent =
      "Page failed to load. Refresh the page or check your connection — " + err.message;
    document.body.appendChild(msg);
  }

  function bootSite() {
    if (siteInitialized || siteInitializing) {
      return;
    }
    waitForHomeReady()
      .then(function () {
        return initSite();
      })
      .catch(showLoadError);
  }

  window.addEventListener("pageshow", function (event) {
    if (event.persisted && siteContentMissing()) {
      siteInitialized = false;
      homeFirstDone = false;
      document.documentElement.classList.add("site-loading");
      bootSite();
    }
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootSite);
  } else {
    bootSite();
  }
})();
