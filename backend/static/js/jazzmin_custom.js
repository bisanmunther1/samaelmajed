// Visually de-emphasizes the trailing sidebar groups (framework-level apps:
// Authentication and Authorization, Token Blacklist) so business models
// (Trips, Hotels, Trip Features, Profiles, Statistics) read as the primary
// section. Relies on JAZZMIN_SETTINGS["order_with_respect_to"] keeping those
// apps last; Jazzmin renders the sidebar as a flat list of .nav-header /
// .nav-item siblings with no per-app wrapper, so there's no CSS-only way to
// select "the last two groups" without this small runtime walk.
(function () {
  function muteTrailingGroups(count) {
    var nav = document.getElementById("jazzy-navigation");
    if (!nav) return;

    var headers = Array.prototype.filter.call(nav.children, function (el) {
      return el.classList.contains("nav-header");
    });

    headers.slice(-count).forEach(function (header) {
      header.classList.add("jazzmin-muted-group");
      var sibling = header.nextElementSibling;
      while (sibling && !sibling.classList.contains("nav-header")) {
        sibling.classList.add("jazzmin-muted-group");
        sibling = sibling.nextElementSibling;
      }
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    muteTrailingGroups(2);
  });
})();
