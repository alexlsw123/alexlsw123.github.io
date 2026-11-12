(function () {
  var nav = document.querySelector("header.nav");
  function onScroll() { nav.classList.toggle("scrolled", window.scrollY > 8); }
  window.addEventListener("scroll", onScroll, { passive: true }); onScroll();

  // Chronos reference line sits at 0.892 on a 0.860–0.900 axis (80%) inside the track column.
  var dp = document.getElementById("dp"), ref = document.getElementById("dpref");
  function placeRef() {
    var track = dp.querySelector(".dp-track");
    if (!track) return;
    var x = track.offsetLeft + track.offsetWidth * 0.80;
    ref.style.left = x + "px";
  }
  placeRef(); window.addEventListener("resize", placeRef);

  // tooltips for chart marks
  var tip = document.getElementById("tip");
  function show(el) {
    var p = (el.getAttribute("data-tip") || "").split("|");
    tip.innerHTML = "";
    var t = document.createElement("div"); t.textContent = p[0]; tip.appendChild(t);
    var v = document.createElement("b"); v.textContent = p[1]; tip.appendChild(v);
    if (p[2]) { var d = document.createElement("div"); d.textContent = p[2]; d.style.opacity = ".75"; tip.appendChild(d); }
    var r = el.getBoundingClientRect();
    tip.classList.add("on");
    var tw = tip.offsetWidth, th = tip.offsetHeight;
    var x = Math.min(Math.max(8, r.left + r.width / 2 - tw / 2), window.innerWidth - tw - 8);
    var y = r.top - th - 10; if (y < 70) y = r.bottom + 10;
    tip.style.left = x + "px"; tip.style.top = y + "px";
  }
  function hide() { tip.classList.remove("on"); }
  document.querySelectorAll("[data-tip]").forEach(function (el) {
    el.addEventListener("mouseenter", function () { show(el); });
    el.addEventListener("mouseleave", hide);
    el.addEventListener("focus", function () { show(el); });
    el.addEventListener("blur", hide);
  });
  window.addEventListener("scroll", hide, { passive: true });
})();
