(function () {
  "use strict";

  const doc = document;

  function ready(callback) {
    if (doc.readyState === "loading") {
      doc.addEventListener("DOMContentLoaded", callback);
      return;
    }
    callback();
  }

  function $(selector, root) {
    return (root || doc).querySelector(selector);
  }

  function $$(selector, root) {
    return Array.from((root || doc).querySelectorAll(selector));
  }

  function text(element) {
    return element ? element.textContent.trim() : "";
  }

  function normalize(value) {
    return String(value || "").toLowerCase().replace(/\s+/g, " ").trim();
  }

  function slugify(value) {
    return normalize(value)
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }

  function moneyToNumber(value) {
    const parsed = Number(String(value || "").replace(/[^0-9.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function formatMoney(value) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2,
    }).format(Number(value) || 0);
  }

  function randomCode(prefix, length) {
    const size = length || 5;
    const number = Math.floor(Math.random() * Math.pow(10, size));
    return prefix + String(number).padStart(size, "0");
  }

  function debounce(callback, wait) {
    let timer;
    return function () {
      const args = arguments;
      window.clearTimeout(timer);
      timer = window.setTimeout(function () {
        callback.apply(null, args);
      }, wait || 160);
    };
  }

  function toast(message, tone) {
    let wrap = $(".js-toast-wrap");
    if (!wrap) {
      wrap = doc.createElement("div");
      wrap.className = "js-toast-wrap";
      wrap.style.cssText =
        "position:fixed;right:18px;bottom:18px;z-index:9999;display:grid;gap:10px;max-width:min(360px,calc(100vw - 36px));";
      doc.body.appendChild(wrap);
    }

    const item = doc.createElement("div");
    item.textContent = message;
    const palette = tone === "error" ? "#dc2626" : tone === "warn" ? "#d97706" : "#0f172a";
    item.style.cssText =
      "padding:12px 14px;border-radius:8px;background:" +
      palette +
      ";color:#fff;font:600 14px/1.35 'Nunito Sans',sans-serif;box-shadow:0 16px 36px rgba(15,23,42,.18);";
    wrap.appendChild(item);

    window.setTimeout(function () {
      item.style.opacity = "0";
      item.style.transform = "translateY(8px)";
      item.style.transition = "opacity .18s ease, transform .18s ease";
      window.setTimeout(function () {
        item.remove();
      }, 200);
    }, 2400);
  }

  function pageFileFromUrl(url) {
    return (url || location).pathname.split("/").pop() || "dashboard.html";
  }

  function pageKeyFromUrl(url) {
    return pageFileFromUrl(url).replace(/\.html$/i, "");
  }

  function navPageFor(pageFile) {
    return pageFile === "create-product.html" ? "products.html" : pageFile;
  }

  function setActiveNav(pageFile) {
    const page = navPageFor(pageFile || pageFileFromUrl(location));
    $$(".nav-link").forEach(function (link) {
      const href = link.getAttribute("href") || "";
      link.classList.toggle("active", href.endsWith(page));
    });
  }

  function initRefreshButtons(root) {
    const scope = root || doc;
    $$("button", scope).forEach(function (button) {
      if (button.dataset.inventurRefreshReady === "true") return;
      const icon = $("img", button);
      if (!icon || !(icon.getAttribute("src") || "").includes("Refresh Icon")) return;
      button.dataset.inventurRefreshReady = "true";
      button.addEventListener("click", function () {
        icon.animate(
          [{ transform: "rotate(0deg)" }, { transform: "rotate(360deg)" }],
          { duration: 420, easing: "ease" }
        );
        doc.dispatchEvent(new CustomEvent("inventur:refresh"));
      });
    });
  }

  function initCheckBoxes(root) {
    const scope = root || doc;
    $$(".check-box", scope).forEach(function (box) {
      if (box.dataset.inventurCheckboxReady === "true") return;
      box.dataset.inventurCheckboxReady = "true";
      box.setAttribute("role", "checkbox");
      box.setAttribute("tabindex", "0");
      box.style.cursor = "pointer";

      function toggle() {
        const checked = box.getAttribute("aria-checked") === "true";
        setChecked(box, !checked);
      }

      box.addEventListener("click", toggle);
      box.addEventListener("keydown", function (event) {
        if (event.key === " " || event.key === "Enter") {
          event.preventDefault();
          toggle();
        }
      });
    });
  }

  function setChecked(box, checked) {
    box.setAttribute("aria-checked", String(checked));
    box.style.background = checked ? "#0f172a" : "";
    box.style.borderColor = checked ? "#0f172a" : "";
    box.style.boxShadow = checked ? "inset 0 0 0 3px #fff" : "";
  }

  function initPagination(root, onChange) {
    const scope = root || doc;
    $$(".pagination", scope).forEach(function (pagination) {
      if (pagination.dataset.inventurPaginationReady === "true") return;
      pagination.dataset.inventurPaginationReady = "true";
      const dots = $$(".page-dot", pagination);
      dots.forEach(function (dot) {
        dot.addEventListener("click", function () {
          dots.forEach(function (item) {
            item.classList.remove("active");
          });
          dot.classList.add("active");
          if (onChange) onChange(Number(dot.textContent) || 1);
        });
      });
    });
  }

  const pageInitializers = {};
  const loadedPageScripts = {};

  function registerPage(name, callback) {
    if (name && typeof callback === "function") {
      pageInitializers[name] = callback;
    }
  }

  function initCommon(root) {
    initRefreshButtons(root);
    initCheckBoxes(root);
    initPagination(root);
  }

  function runPageInit(pageKey, root) {
    initCommon(root);
    const init = pageInitializers[pageKey];
    if (init) init(root || doc);
  }

  function addPageStyles(targetDoc, targetUrl) {
    $$('link[rel="stylesheet"]', targetDoc).forEach(function (link) {
      const rawHref = link.getAttribute("href") || "";
      if (!rawHref || rawHref.includes("tailwind.css") || rawHref.includes("app.css")) return;

      const href = new URL(rawHref, targetUrl).href;
      const exists = $$('link[rel="stylesheet"]', doc).some(function (item) {
        return item.href === href;
      });
      if (exists) return;

      const next = doc.createElement("link");
      next.rel = "stylesheet";
      next.href = href;
      next.dataset.inventurPageStyle = "true";
      doc.head.appendChild(next);
    });
  }

  function ensurePageScripts(targetDoc, targetUrl) {
    const scripts = $$("script[src]", targetDoc).filter(function (script) {
      const src = script.getAttribute("src") || "";
      return !src.endsWith("app.js");
    });

    return Promise.all(scripts.map(function (script) {
      const src = new URL(script.getAttribute("src"), targetUrl).href;
      if (loadedPageScripts[src]) return Promise.resolve(false);

      loadedPageScripts[src] = true;
      return new Promise(function (resolve, reject) {
        const next = doc.createElement("script");
        next.src = src;
        next.onload = function () {
          resolve(true);
        };
        next.onerror = reject;
        doc.body.appendChild(next);
      });
    })).then(function (results) {
      return results.some(Boolean);
    });
  }

  function shouldHandleAppLink(anchor, event) {
    if (!anchor || !anchor.href) return false;
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
    if (anchor.target && anchor.target !== "_self") return false;
    if (anchor.hasAttribute("download")) return false;

    const url = new URL(anchor.href, location.href);
    if (url.origin !== location.origin) return false;
    if (pageFileFromUrl(url) === "sign-in.html") return false;
    return url.pathname.includes("/pages/");
  }

  function loadAppPage(url, options) {
    const targetUrl = new URL(url, location.href);
    const currentContent = $(".app-content");
    if (!currentContent) {
      location.href = targetUrl.href;
      return Promise.resolve(false);
    }

    return fetch(targetUrl.href, { headers: { "X-Inventur-Navigation": "partial" } })
      .then(function (response) {
        if (!response.ok) throw new Error("Unable to load page");
        return response.text();
      })
      .then(function (html) {
        const targetDoc = new DOMParser().parseFromString(html, "text/html");
        const nextContent = $(".app-content", targetDoc);
        if (!nextContent) {
          location.href = targetUrl.href;
          return false;
        }

        currentContent.dispatchEvent(new CustomEvent("inventur:dispose", { bubbles: true }));
        addPageStyles(targetDoc, targetUrl);
        currentContent.replaceWith(doc.importNode(nextContent, true));
        doc.title = targetDoc.title || doc.title;
        setActiveNav(pageFileFromUrl(targetUrl));
        closeDropdowns();
        window.scrollTo({ top: 0, left: 0 });

        if (!options || options.history !== false) {
          history.pushState({ inventurPage: true }, "", targetUrl.href);
        }

        const freshContent = $(".app-content");
        initCommon(freshContent);
        return ensurePageScripts(targetDoc, targetUrl).then(function (loadedNewScript) {
          if (!loadedNewScript) runPageInit(pageKeyFromUrl(targetUrl), freshContent);
          doc.dispatchEvent(new CustomEvent("inventur:page:loaded", { detail: { page: pageKeyFromUrl(targetUrl) } }));
          return true;
        });
      })
      .catch(function () {
        location.href = targetUrl.href;
        return false;
      });
  }

  function makeDropdown(button, items, onPick) {
    button.addEventListener("click", function (event) {
      event.preventDefault();
      closeDropdowns();

      const menu = doc.createElement("div");
      menu.className = "js-dropdown";
      menu.style.cssText =
        "position:absolute;z-index:50;min-width:150px;padding:6px;background:#fff;border:1px solid #e5e7eb;border-radius:8px;box-shadow:0 18px 40px rgba(15,23,42,.14);";

      items.forEach(function (item) {
        const option = doc.createElement("button");
        option.type = "button";
        option.textContent = item;
        option.style.cssText =
          "display:block;width:100%;border:0;background:transparent;text-align:left;padding:9px 10px;border-radius:6px;font:600 13px 'Nunito Sans',sans-serif;color:#334155;cursor:pointer;";
        option.addEventListener("mouseenter", function () {
          option.style.background = "#f8fafc";
        });
        option.addEventListener("mouseleave", function () {
          option.style.background = "transparent";
        });
        option.addEventListener("click", function () {
          onPick(item);
          closeDropdowns();
        });
        menu.appendChild(option);
      });

      doc.body.appendChild(menu);
      const rect = button.getBoundingClientRect();
      menu.style.left = rect.left + window.scrollX + "px";
      menu.style.top = rect.bottom + window.scrollY + 8 + "px";
    });
  }

  function closeDropdowns() {
    $$(".js-dropdown").forEach(function (menu) {
      menu.remove();
    });
  }

  doc.addEventListener("click", function (event) {
    if (!event.target.closest(".js-dropdown") && !event.target.closest("button")) {
      closeDropdowns();
    }
  });

  function getRows(table) {
    return $$("tbody tr", table);
  }

  function filterTable(table, predicate) {
    let visible = 0;
    getRows(table).forEach(function (row) {
      const show = predicate(row);
      row.hidden = !show;
      if (show) visible += 1;
    });
    return visible;
  }

  doc.addEventListener("click", function (event) {
    const anchor = event.target.closest("a[href]");
    if (anchor && pageFileFromUrl(anchor.href) === "sign-in.html") {
      localStorage.removeItem("inventur.session");
    }
    if (!shouldHandleAppLink(anchor, event)) return;
    event.preventDefault();
    loadAppPage(anchor.href);
  });

  window.addEventListener("popstate", function () {
    loadAppPage(location.href, { history: false });
  });

  ready(function () {
    $$("script[src]", doc).forEach(function (script) {
      loadedPageScripts[new URL(script.getAttribute("src"), location.href).href] = true;
    });
    setActiveNav();
    initCommon();
  });

  window.Inventur = {
    ready: ready,
    $: $,
    $$: $$,
    text: text,
    normalize: normalize,
    slugify: slugify,
    moneyToNumber: moneyToNumber,
    formatMoney: formatMoney,
    randomCode: randomCode,
    debounce: debounce,
    toast: toast,
    initCheckBoxes: initCheckBoxes,
    initPagination: initPagination,
    registerPage: registerPage,
    runPageInit: runPageInit,
    loadAppPage: loadAppPage,
    makeDropdown: makeDropdown,
    closeDropdowns: closeDropdowns,
    getRows: getRows,
    filterTable: filterTable,
    setChecked: setChecked,
  };
})();
