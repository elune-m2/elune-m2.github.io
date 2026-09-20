/* Elune M2 docs: theme toggle, moon-phase glyphs, table of contents,
   screenshot slots and a lightbox. No dependencies. */
(function () {
  "use strict";

  var IMAGE_DIR = "images/";
  var IMAGE_EXTS = ["png", "jpg", "gif", "webp"];

  /* ---------- theme ---------- */
  var root = document.documentElement;
  try {
    var saved = localStorage.getItem("elune-theme");
    if (saved === "light" || saved === "dark") root.setAttribute("data-theme", saved);
  } catch (e) { /* storage blocked: follow the OS setting */ }

  function currentTheme() {
    var t = root.getAttribute("data-theme");
    if (t) return t;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  var themeBtn = document.querySelector("[data-theme-toggle]");
  if (themeBtn) {
    themeBtn.addEventListener("click", function () {
      var next = currentTheme() === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      try { localStorage.setItem("elune-theme", next); } catch (e) { /* ignore */ }
    });
  }

  /* ---------- moon phases ----------
     fraction 0 = new moon, 1 = full moon (waxing, lit from the right). */
  var SVG_NS = "http://www.w3.org/2000/svg";

  function moonSvg(fraction) {
    var f = Math.max(0, Math.min(1, fraction));
    var svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("class", "phase");
    svg.setAttribute("aria-hidden", "true");
    var disc = document.createElementNS(SVG_NS, "circle");
    disc.setAttribute("class", "disc");
    disc.setAttribute("cx", 12); disc.setAttribute("cy", 12); disc.setAttribute("r", 10);
    svg.appendChild(disc);
    if (f > 0.02) {
      var rx = (10 * Math.abs(1 - 2 * f)).toFixed(2);
      var sweep = f > 0.5 ? 1 : 0;
      var lit = document.createElementNS(SVG_NS, "path");
      lit.setAttribute("class", "lit");
      lit.setAttribute("d", "M12 2 A10 10 0 0 1 12 22 A" + rx + " 10 0 0 " + sweep + " 12 2 Z");
      svg.appendChild(lit);
    }
    return svg;
  }

  var strip = document.querySelector("[data-phases-strip]");
  if (strip) {
    for (var i = 0; i < 8; i++) strip.appendChild(moonSvg((i + 1) / 8));
  }

  /* ---------- table of contents (documentation page) ---------- */
  var toc = document.querySelector("[data-toc]");
  var main = document.querySelector("main.content");
  var linkById = {};

  if (toc && main) {
    var h2s = main.querySelectorAll("h2[id]");
    h2s.forEach(function (h2, idx) {
      var fraction = h2s.length > 1 ? (idx + 1) / h2s.length : 1;
      h2.insertBefore(moonSvg(fraction), h2.firstChild);

      var li = document.createElement("li");
      var a = document.createElement("a");
      a.href = "#" + h2.id;
      a.appendChild(moonSvg(fraction));
      var badge = h2.querySelector(".badge");
      var title = h2.textContent;
      if (badge) title = title.replace(badge.textContent, "");
      a.appendChild(document.createTextNode(title.trim()));
      if (badge) a.appendChild(badge.cloneNode(true));
      li.appendChild(a);
      linkById[h2.id] = a;

      var sub = document.createElement("ul");
      var el = h2.nextElementSibling;
      while (el && el.tagName !== "H2") {
        if (el.tagName === "H3" && el.id) {
          var sli = document.createElement("li");
          var sa = document.createElement("a");
          sa.href = "#" + el.id;
          sa.textContent = el.textContent.trim();
          sli.appendChild(sa);
          sub.appendChild(sli);
          linkById[el.id] = sa;
        }
        el = el.nextElementSibling;
      }
      if (sub.children.length) li.appendChild(sub);
      toc.appendChild(li);
    });

    /* highlight the section being read */
    var headings = Array.prototype.slice.call(main.querySelectorAll("h2[id], h3[id]"));
    var ticking = false;
    function markActive() {
      ticking = false;
      var current = headings[0];
      for (var i = 0; i < headings.length; i++) {
        if (headings[i].getBoundingClientRect().top <= 110) current = headings[i];
        else break;
      }
      Object.keys(linkById).forEach(function (id) { linkById[id].classList.remove("is-active"); });
      if (!current) return;
      var link = linkById[current.id];
      if (link) link.classList.add("is-active");
      if (current.tagName === "H3") {
        var p = current.previousElementSibling;
        while (p && p.tagName !== "H2") p = p.previousElementSibling;
        if (p && linkById[p.id]) linkById[p.id].classList.add("is-active");
      }
    }
    window.addEventListener("scroll", function () {
      if (!ticking) { ticking = true; window.requestAnimationFrame(markActive); }
    }, { passive: true });
    markActive();

    /* filter box */
    var filter = document.querySelector("[data-toc-filter]");
    if (filter) {
      filter.addEventListener("input", function () {
        var q = filter.value.trim().toLowerCase();
        toc.querySelectorAll(":scope > li").forEach(function (li) {
          var top = li.querySelector(":scope > a");
          var topHit = !q || top.textContent.toLowerCase().indexOf(q) !== -1;
          var anySub = false;
          li.querySelectorAll("ul li").forEach(function (sli) {
            var hit = topHit || sli.textContent.toLowerCase().indexOf(q) !== -1;
            sli.classList.toggle("is-hidden", !hit);
            if (hit) anySub = true;
          });
          li.classList.toggle("is-hidden", !(topHit || anySub));
        });
      });
    }

    /* mobile drawer */
    var menuBtn = document.querySelector("[data-menu-toggle]");
    if (menuBtn) {
      menuBtn.addEventListener("click", function () {
        var open = document.body.classList.toggle("nav-open");
        menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
      });
      toc.addEventListener("click", function (e) {
        if (e.target.closest("a")) {
          document.body.classList.remove("nav-open");
          menuBtn.setAttribute("aria-expanded", "false");
        }
      });
    }
  }

  /* ---------- screenshot slots ----------
     <figure class="shot" data-shot="import-dialog" data-hint="what to capture">
     Drop docs/images/import-dialog.png (or .jpg/.gif/.webp) and it appears.
     Until then the slot shows the expected file name. */
  var lightbox = null;
  function openLightbox(src, alt) {
    if (!lightbox) {
      lightbox = document.createElement("dialog");
      lightbox.className = "lightbox";
      lightbox.appendChild(document.createElement("img"));
      lightbox.addEventListener("click", function () { lightbox.close(); });
      document.body.appendChild(lightbox);
    }
    var img = lightbox.querySelector("img");
    img.src = src; img.alt = alt;
    if (lightbox.showModal) lightbox.showModal();
  }

  function fillSlot(fig) {
    var name = fig.getAttribute("data-shot");
    var hint = fig.getAttribute("data-hint") || "";
    var caption = fig.querySelector("figcaption");
    var alt = caption ? caption.textContent.trim() : name;

    function placeholder() {
      var box = document.createElement("div");
      box.className = "shot-empty";
      box.innerHTML =
        '<span class="shot-label">Image slot</span>' +
        '<span class="shot-file">docs/images/' + name + '.png</span>' +
        (hint ? '<span class="shot-hint"></span>' : "");
      if (hint) box.querySelector(".shot-hint").textContent = hint;
      fig.insertBefore(box, fig.firstChild);
    }

    function tryExt(i) {
      if (i >= IMAGE_EXTS.length) { placeholder(); return; }
      var probe = new Image();
      probe.onload = function () {
        probe.alt = alt;
        probe.loading = "lazy";
        probe.addEventListener("click", function () { openLightbox(probe.src, alt); });
        fig.insertBefore(probe, fig.firstChild);
      };
      probe.onerror = function () { tryExt(i + 1); };
      probe.src = IMAGE_DIR + name + "." + IMAGE_EXTS[i];
    }
    tryExt(0);
  }

  document.querySelectorAll("figure.shot[data-shot]").forEach(fillSlot);
})();
