function togglebib(id) {
  var bib = document.getElementById(id);
  if (!bib) return;
  if (bib.style.display === "none") {
    bib.style.display = "block";
  } else {
    bib.style.display = "none";
  }
}

function initHiddenAbstracts() {
  var ids = [
    "history_guidance_abs",
    "df_abs",
    "dittogym_abs",
    "spatialvlm_abs",
    "ramp_abs",
    "nlmap_abs",
    "keypoint3D_abs",
    "rpg_abs",
    "sap_abs",
  ];
  ids.forEach(function (id) {
    var block = document.getElementById(id);
    if (block) {
      block.style.display = "none";
    }
  });
}
