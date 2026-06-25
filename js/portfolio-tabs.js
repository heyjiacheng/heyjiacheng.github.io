function initPortfolioTabs() {
  const filterItems = document.querySelectorAll(".portfolio-filter li");
  const groups = document.querySelectorAll(".portfolio-group");
  if (!filterItems.length || !groups.length) return;

  let current = 0;

  function activate(index) {
    filterItems.forEach(function (li) {
      li.classList.remove("sel-item");
    });
    const target = filterItems[index];
    target.classList.add("sel-item");

    const filter = target.getAttribute("data-filter");
    groups.forEach(function (grp) {
      if (filter === "*" || grp.classList.contains(filter.slice(1))) {
        grp.style.display = "";
      } else {
        grp.style.display = "none";
      }
    });
  }

  filterItems.forEach(function (li, idx) {
    li.addEventListener("click", function () {
      current = idx;
      activate(idx);
    });
  });

  activate(current);
}
