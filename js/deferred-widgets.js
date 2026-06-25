function loadDeferredFooterWidgets() {
  var badge = document.querySelector("#footer .visitor-badge img[data-src]");
  if (badge) {
    badge.src = badge.getAttribute("data-src");
    badge.removeAttribute("data-src");
  }

  if (document.getElementById("clstr_globe")) {
    return;
  }

  var globeHost = document.getElementById("clstr-globe-host");
  if (!globeHost) {
    return;
  }

  var script = document.createElement("script");
  script.type = "text/javascript";
  script.id = "clstr_globe";
  script.src =
    "//clustrmaps.com/globe.js?d=M8imizPcXVt23duN96Du8a9SIfARtXP6_eGpIQjZlsI";
  globeHost.appendChild(script);
}

if (document.readyState === "complete") {
  loadDeferredFooterWidgets();
} else {
  window.addEventListener("load", loadDeferredFooterWidgets);
}
