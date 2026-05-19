(function () {
  "use strict";

  const I = window.Inventur;

  function initProducts(root) {
    const scope = root || document;
    const page  = I.$(".products-page", scope);
    const table = I.$(".products-table", scope);
    if (!page || !table || page.dataset.productsReady === "true") return;
    page.dataset.productsReady = "true";

    const search        = I.$(".table-search input", page);
    const filterButtons = I.$$(".table-filters .btn", page);
    const rowSizeButton = I.$(".row-size .btn", page);
    const rowSizeWrap   = I.$(".row-size", page);
    const pagination    = I.$(".pagination", page);
    const tbody         = I.$("tbody", table);
    let allProducts     = [];
    let query           = "";
    let category        = "All";
    let brand           = "All";
    let rowsPerPage     = 10;
    let currentPage     = 1;

    function escapeHtml(value) {
      return String(value ?? "").replace(/[&<>'"]/g, function (ch) {
        return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[ch];
      });
    }

    function filteredProducts() {
      return allProducts.filter(function (p) {
        const hay = I.normalize([
          p.name,
          p.sku,
          p.itemCode,
          p.category ? p.category.name : "",
          p.brand ? p.brand.name : "",
        ].join(" "));
        const catOk = category === "All" || (p.category && p.category.name === category);
        const brandOk = brand === "All" || (p.brand && p.brand.name === brand);
        return hay.includes(I.normalize(query)) && catOk && brandOk;
      });
    }

    function renderRows(products) {
      tbody.innerHTML = "";
      if (!products.length) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:40px;color:#94a3b8">Belum ada produk. Klik Add Product untuk menambah produk pertama.</td></tr>';
        return;
      }
      products.forEach(function (p) {
        const initials = p.createdBy ? p.createdBy.initials : "??";
        const creator  = p.createdBy ? p.createdBy.name : "Unknown";
        const catName  = p.category ? p.category.name : "";
        const brandName= p.brand ? p.brand.name : "";
        const imgSrc   = p.imageUrl || "../assets/img/icons/box.svg";

        const tr = document.createElement("tr");
        tr.dataset.id = p.id;
        tr.innerHTML =
          '<td><span class="check-box"></span></td>' +
          "<td>" + escapeHtml(p.sku) + "</td>" +
          '<td><div class="name-cell"><span class="item-thumb"><img src="' + escapeHtml(imgSrc) + '" alt="" onerror="this.src=\'../assets/img/icons/box.svg\'" /></span><strong>' + escapeHtml(p.name) + "</strong></div></td>" +
          "<td>" + escapeHtml(catName) + "</td>" +
          "<td>" + escapeHtml(brandName) + "</td>" +
          "<td>" + I.formatMoney(p.price) + "</td>" +
          "<td>" + escapeHtml(p.unit || "") + "</td>" +
          "<td>" + escapeHtml(p.qty ?? 0) + "</td>" +
          '<td><div class="creator-cell"><span class="avatar">' + escapeHtml(initials) + "</span>" + escapeHtml(creator) + "</div></td>" +
          '<td class="action-cell">' +
            '<button class="action-btn" data-action="view"><img src="../assets/img/icons/eye.svg" alt="" /></button>' +
            '<button class="action-btn" data-action="edit"><img src="../assets/img/icons/edit.svg" alt="" /></button>' +
            '<button class="action-btn" data-action="delete"><img src="../assets/img/icons/trashcan.svg" alt="" /></button>' +
          "</td>";
        tbody.appendChild(tr);
      });
      I.initCheckBoxes(tbody);
    }

    function pageNumbers(totalPages) {
      const pages = [];
      if (totalPages <= 7) {
        for (let i = 1; i <= totalPages; i += 1) pages.push(i);
        return pages;
      }
      pages.push(1);
      if (currentPage > 4) pages.push("...");
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i += 1) pages.push(i);
      if (currentPage < totalPages - 3) pages.push("...");
      pages.push(totalPages);
      return pages;
    }

    function renderPagination(total) {
      if (!pagination) return;
      const totalPages = rowsPerPage >= 999 ? 1 : Math.max(1, Math.ceil(total / rowsPerPage));
      currentPage = Math.min(currentPage, totalPages);
      pagination.innerHTML = "";

      if (total <= rowsPerPage || totalPages <= 1) {
        pagination.hidden = true;
        return;
      }

      pagination.hidden = false;
      const prev = document.createElement("button");
      prev.className = "page-arrow";
      prev.type = "button";
      prev.disabled = currentPage <= 1;
      prev.innerHTML = '<img src="../assets/img/icons/Previous Page.svg" alt="" />';
      prev.addEventListener("click", function () {
        if (currentPage > 1) {
          currentPage -= 1;
          applyFilters();
        }
      });
      pagination.appendChild(prev);

      pageNumbers(totalPages).forEach(function (n) {
        if (n === "...") {
          const ellipsis = document.createElement("span");
          ellipsis.className = "page-ellipsis";
          ellipsis.textContent = "...";
          pagination.appendChild(ellipsis);
          return;
        }
        const dot = document.createElement("button");
        dot.type = "button";
        dot.className = "page-dot" + (n === currentPage ? " active" : "");
        dot.textContent = n;
        dot.addEventListener("click", function () {
          currentPage = n;
          applyFilters();
        });
        pagination.appendChild(dot);
      });

      const next = document.createElement("button");
      next.className = "page-arrow";
      next.type = "button";
      next.disabled = currentPage >= totalPages;
      next.innerHTML = '<img src="../assets/img/icons/Next Page.svg" alt="" />';
      next.addEventListener("click", function () {
        if (currentPage < totalPages) {
          currentPage += 1;
          applyFilters();
        }
      });
      pagination.appendChild(next);
    }

    function updateFooter(total) {
      if (rowSizeButton) {
        const icon = I.$("img", rowSizeButton);
        rowSizeButton.textContent = rowsPerPage >= 999 ? "All " : rowsPerPage + " ";
        if (icon) rowSizeButton.appendChild(icon);
      }
      if (rowSizeWrap) {
        const totalPages = rowsPerPage >= 999 ? 1 : Math.max(1, Math.ceil(total / rowsPerPage));
        const start = total === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1;
        const end = rowsPerPage >= 999 ? total : Math.min(total, start + rowsPerPage - 1);
        rowSizeWrap.setAttribute("title", "Showing " + start + "-" + end + " of " + total + " entries, page " + currentPage + " of " + totalPages);
      }
      renderPagination(total);
    }

    function applyFilters() {
      const filtered = filteredProducts();
      const total = filtered.length;
      const totalPages = rowsPerPage >= 999 ? 1 : Math.max(1, Math.ceil(total / rowsPerPage));
      if (currentPage > totalPages) currentPage = totalPages;
      const start = rowsPerPage >= 999 ? 0 : (currentPage - 1) * rowsPerPage;
      const pageRows = rowsPerPage >= 999 ? filtered : filtered.slice(start, start + rowsPerPage);
      renderRows(pageRows);
      updateFooter(total);
      return filtered;
    }

    function updateFilterButton(button, label, value) {
      const icon = I.$("img", button);
      button.textContent = label + ": " + value + " ";
      if (icon) button.appendChild(icon);
    }

    async function loadProducts() {
      tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:40px;color:#94a3b8">Memuat data...</td></tr>';
      try {
        const res = await window.InventurAPI.getProducts({ limit: 1000 });
        allProducts = res.data || [];
        populateFilterDropdowns();
        currentPage = 1;
        applyFilters();
      } catch (err) {
        console.error("Gagal load produk:", err);
        tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:40px;color:#ef4444">Gagal memuat data produk. Pastikan server berjalan.</td></tr>';
      }
    }

    function populateFilterDropdowns() {
      const categories = ["All"].concat(
        Array.from(new Set(allProducts.map(function (p) { return p.category ? p.category.name : ""; }).filter(Boolean))).sort()
      );
      const brands = ["All"].concat(
        Array.from(new Set(allProducts.map(function (p) { return p.brand ? p.brand.name : ""; }).filter(Boolean))).sort()
      );
      if (filterButtons[0] && !filterButtons[0].dataset.dropdownReady) {
        filterButtons[0].dataset.dropdownReady = "true";
        I.makeDropdown(filterButtons[0], categories, function (value) {
          category = value;
          currentPage = 1;
          updateFilterButton(filterButtons[0], "Category", value);
          applyFilters();
        });
      }
      if (filterButtons[1] && !filterButtons[1].dataset.dropdownReady) {
        filterButtons[1].dataset.dropdownReady = "true";
        I.makeDropdown(filterButtons[1], brands, function (value) {
          brand = value;
          currentPage = 1;
          updateFilterButton(filterButtons[1], "Brand", value);
          applyFilters();
        });
      }
    }

    if (search) {
      search.addEventListener("input", I.debounce(function () {
        query = search.value;
        currentPage = 1;
        applyFilters();
      }, 200));
    }

    if (rowSizeButton && !rowSizeButton.dataset.dropdownReady) {
      rowSizeButton.dataset.dropdownReady = "true";
      I.makeDropdown(rowSizeButton, ["5", "10", "25", "50", "All"], function (value) {
        rowsPerPage = value === "All" ? 999 : Number(value);
        currentPage = 1;
        applyFilters();
      });
    }

    table.addEventListener("click", async function (event) {
      const button = event.target.closest(".action-btn");
      if (!button) return;
      const row = button.closest("tr");
      const id = row ? Number(row.dataset.id) : null;
      const action = button.dataset.action;
      const product = allProducts.find(function (p) { return p.id === id; });
      if (!product) return;

      if (action === "delete") {
        if (!confirm("Hapus produk \"" + product.name + "\"?")) return;
        try {
          await window.InventurAPI.deleteProduct(id);
          allProducts = allProducts.filter(function (p) { return p.id !== id; });
          applyFilters();
          I.toast(product.name + " berhasil dihapus");
        } catch (err) {
          I.toast("Gagal menghapus: " + err.message, "error");
        }
      } else if (action === "edit") {
        I.loadAppPage("./create-product.html?sku=" + encodeURIComponent(product.sku));
      } else {
        I.toast(product.name + " — Stok: " + product.qty + " " + product.unit + " — Nilai: " + I.formatMoney((product.price || 0) * (product.qty || 0)));
      }
    });

    function refreshHandler() {
      if (search) search.value = "";
      query = "";
      category = "All";
      brand = "All";
      currentPage = 1;
      if (filterButtons[0]) updateFilterButton(filterButtons[0], "Category", "All");
      if (filterButtons[1]) updateFilterButton(filterButtons[1], "Brand", "All");
      loadProducts();
      I.toast("Products refreshed");
    }

    document.addEventListener("inventur:refresh", refreshHandler);
    page.addEventListener("inventur:dispose", function () {
      document.removeEventListener("inventur:refresh", refreshHandler);
    }, { once: true });

    loadProducts();
  }

  I.registerPage("products", initProducts);
  I.ready(initProducts);
})();
