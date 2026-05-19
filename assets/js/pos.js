(function () {
  "use strict";

  const I = window.Inventur;

  I.ready(function () {
    const screen = I.$(".pos-screen");
    if (!screen) return;

    const productsWrap = I.$(".pos-products", screen);
    const categoriesWrap = I.$(".pos-categories", screen);
    const search = I.$(".pos-products-head input", screen);
    const added = I.$(".pos-added", screen);
    const addedHeader = I.$(".pos-added h3 span", screen);
    const clearAll = I.$(".pos-added button", screen);
    const emptyState = I.$(".pos-empty", screen);
    const totalButton = I.$(".pos-total", screen);
    const discountInput = I.$(".pos-billing-fields input", screen);
    const shippingSelect = I.$$(".pos-billing-fields select", screen)[1];
    const taxSelect = I.$$(".pos-billing-fields select", screen)[0];
    const productSelect = I.$(".pos-customer select:last-child", screen);
    const customerSelect = I.$(".pos-customer select:first-child", screen);
    const orderId = I.$(".pos-order-head p", screen);
    const order = new Map();
    let allProducts = [];
    let category = "All Categories";
    let orderCount = Number(localStorage.getItem("inventur.orderCount") || "0");
    let selectedPayment = "cash";
    let lastTotal = 0;

    function productData(product) {
      return {
        key: String(product.id),
        id: product.id,
        name: product.name,
        category: product.category ? product.category.name : "Uncategorized",
        stock: Number(product.qty) || 0,
        unit: product.unit || "Pc",
        price: Number(product.price) || 0,
        image: product.imageUrl || "../assets/img/icons/box.svg",
      };
    }

    function itemCountByCategory(name) {
      if (name === "All Categories") return allProducts.length;
      return allProducts.filter(function (p) {
        return productData(p).category === name;
      }).length;
    }

    function renderCategories() {
      if (!categoriesWrap) return;
      const names = ["All Categories"].concat(
        Array.from(new Set(allProducts.map(function (p) { return productData(p).category; }))).sort()
      );
      categoriesWrap.innerHTML = "";
      names.forEach(function (name) {
        const button = document.createElement("button");
        button.className = "pos-category" + (name === category ? " active" : "");
        button.type = "button";
        button.dataset.category = name;
        button.innerHTML =
          '<img src="../assets/img/categories/Icon categories.svg" alt="" />' +
          "<strong>" + name + "</strong><span>" + itemCountByCategory(name) + " Items</span>";
        button.addEventListener("click", function () {
          category = name;
          I.$$(".pos-category", categoriesWrap).forEach(function (item) { item.classList.remove("active"); });
          button.classList.add("active");
          renderProducts();
        });
        categoriesWrap.appendChild(button);
      });
    }

    function renderProducts() {
      if (!productsWrap) return;
      const q = I.normalize(search ? search.value : "");
      const filtered = allProducts.filter(function (product) {
        const data = productData(product);
        const categoryOk = category === "All Categories" || data.category === category;
        const queryOk = I.normalize(data.name + " " + data.category + " " + (product.sku || "")).includes(q);
        return categoryOk && queryOk;
      });

      productsWrap.innerHTML = "";
      if (!filtered.length) {
        const msg = allProducts.length ? "Produk tidak ditemukan." : "Belum ada produk. Tambahkan produk dulu dari menu Products.";
        const empty = document.createElement("div");
        empty.className = "pos-empty-state";
        empty.textContent = msg;
        empty.style.cssText = "grid-column:1/-1;padding:42px;text-align:center;color:#94a3b8;background:#fff;border:1px dashed #e5e7eb;border-radius:8px;";
        productsWrap.appendChild(empty);
        return;
      }

      filtered.forEach(function (product) {
        const data = productData(product);
        const card = document.createElement("article");
        card.className = "pos-product";
        card.dataset.id = data.id;
        card.innerHTML =
          '<img src="' + data.image + '" alt="' + data.name + '" onerror="this.src=\'../assets/img/icons/box.svg\'" />' +
          "<span>" + data.category + "</span>" +
          "<strong>" + data.name + "</strong>" +
          "<div><em>" + data.stock + " " + data.unit + "</em><b>" + I.formatMoney(data.price) + "</b></div>";
        card.style.cursor = data.stock > 0 ? "pointer" : "not-allowed";
        card.style.opacity = data.stock > 0 ? "1" : ".55";
        card.addEventListener("click", function () {
          if (data.stock <= 0) {
            I.toast("Stok produk habis", "warn");
            return;
          }
          addProduct(data);
        });
        productsWrap.appendChild(card);
      });
    }

    function populateProductSelect() {
      if (!productSelect) return;
      productSelect.innerHTML = '<option value="">Search Products</option>';
      allProducts.map(productData).forEach(function (product) {
        const option = document.createElement("option");
        option.textContent = product.name + " — " + product.stock + " " + product.unit;
        option.value = product.key;
        productSelect.appendChild(option);
      });
    }

    async function loadProducts() {
      if (productsWrap) {
        productsWrap.innerHTML = '<div class="pos-empty-state" style="grid-column:1/-1;padding:42px;text-align:center;color:#94a3b8;background:#fff;border:1px dashed #e5e7eb;border-radius:8px;">Memuat produk...</div>';
      }
      try {
        const res = await window.InventurAPI.getProducts({ limit: 500 });
        allProducts = res.data || [];
        if (!allProducts.some(function (p) { return productData(p).category === category; })) category = "All Categories";
        renderCategories();
        renderProducts();
        populateProductSelect();
      } catch (err) {
        console.error("Gagal load produk POS:", err);
        if (productsWrap) {
          productsWrap.innerHTML = '<div class="pos-empty-state" style="grid-column:1/-1;padding:42px;text-align:center;color:#ef4444;background:#fff;border:1px dashed #fecaca;border-radius:8px;">Gagal memuat produk. Pastikan server berjalan.</div>';
        }
      }
    }

    function ensureList() {
      let list = I.$(".js-pos-order-list", added);
      if (!list) {
        list = document.createElement("div");
        list.className = "js-pos-order-list";
        list.style.cssText = "display:grid;gap:10px;margin-top:12px;";
        added.appendChild(list);
      }
      return list;
    }

    function renderOrder() {
      const list = ensureList();
      list.innerHTML = "";
      const items = Array.from(order.values());
      if (addedHeader) addedHeader.textContent = String(items.reduce(function (sum, item) { return sum + item.qty; }, 0));
      if (emptyState) emptyState.hidden = items.length > 0;

      items.forEach(function (item) {
        const row = document.createElement("article");
        row.style.cssText =
          "display:grid;grid-template-columns:44px 1fr auto;align-items:center;gap:10px;padding:10px;border:1px solid #e5e7eb;border-radius:8px;background:#fff;";
        row.innerHTML =
          '<img src="' + item.image + '" alt="" onerror="this.src=\'../assets/img/icons/box.svg\'" style="width:44px;height:44px;object-fit:contain;border-radius:7px;background:#f8fafc">' +
          '<div style="min-width:0"><strong style="display:block;font-size:13px;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' +
          item.name +
          '</strong><span style="font-size:12px;color:#64748b">' +
          I.formatMoney(item.price) +
          "</span></div>" +
          '<div style="display:flex;align-items:center;gap:6px"><button type="button" data-action="minus">-</button><b>' +
          item.qty +
          '</b><button type="button" data-action="plus">+</button><button type="button" data-action="remove">x</button></div>';
        I.$$("button", row).forEach(function (button) {
          button.style.cssText = "width:26px;height:26px;border:1px solid #e5e7eb;border-radius:6px;background:#fff;cursor:pointer;";
          button.addEventListener("click", function () {
            if (button.dataset.action === "plus") {
              if (item.qty >= item.stock) {
                I.toast("Stok tidak cukup", "warn");
                return;
              }
              item.qty += 1;
            }
            if (button.dataset.action === "minus") item.qty -= 1;
            if (button.dataset.action === "remove" || item.qty <= 0) order.delete(item.key);
            renderOrder();
          });
        });
        list.appendChild(row);
      });

      updateTotal();
    }

    function updateTotal() {
      const subtotal = Array.from(order.values()).reduce(function (sum, item) {
        return sum + item.price * item.qty;
      }, 0);
      const discount = subtotal * ((Number(discountInput && discountInput.value) || 0) / 100);
      const shipping = Number(shippingSelect && shippingSelect.value) || 0;
      const taxRate = taxSelect && taxSelect.value === "10%" ? 0.1 : 0;
      lastTotal = Math.max(0, subtotal - discount + shipping + subtotal * taxRate);
      if (totalButton) totalButton.textContent = "Grand Total : " + I.formatMoney(lastTotal);
    }

    function addProduct(data) {
      const current = order.get(data.key) || Object.assign({}, data, { qty: 0 });
      if (current.qty >= data.stock) {
        I.toast("Stok tidak cukup", "warn");
        return;
      }
      current.qty += 1;
      order.set(data.key, current);
      renderOrder();
    }

    function resetOrder(showToast) {
      order.clear();
      if (search) search.value = "";
      category = "All Categories";
      renderOrder();
      renderCategories();
      renderProducts();
      populateProductSelect();
      if (showToast) I.toast("POS reset");
    }

    if (search) search.addEventListener("input", I.debounce(renderProducts, 120));
    if (discountInput) discountInput.addEventListener("input", updateTotal);
    if (shippingSelect) shippingSelect.addEventListener("change", updateTotal);
    if (taxSelect) {
      taxSelect.innerHTML = "<option>Choose</option><option>10%</option>";
      taxSelect.addEventListener("change", updateTotal);
    }
    if (shippingSelect) shippingSelect.innerHTML = "<option>0</option><option>5</option><option>10</option><option>25</option>";

    if (productSelect) {
      productSelect.addEventListener("change", function () {
        const product = allProducts.map(productData).find(function (item) { return item.key === productSelect.value; });
        if (product) addProduct(product);
        productSelect.selectedIndex = 0;
      });
    }

    I.$$(".pos-payment-methods button", screen).forEach(function (button) {
      button.addEventListener("click", function () {
        I.$$(".pos-payment-methods button", screen).forEach(function (item) { item.classList.remove("active"); });
        button.classList.add("active");
        selectedPayment = I.normalize(I.text(button)).replace(/\s+/g, "-") || "cash";
      });
    });

    I.$$(".pos-slide-buttons button", screen).forEach(function (button, index) {
      button.addEventListener("click", function () {
        const wrap = I.$(".pos-categories", screen);
        if (wrap) wrap.scrollBy({ left: index === 0 ? -220 : 220, behavior: "smooth" });
      });
    });

    if (clearAll) clearAll.addEventListener("click", function () { resetOrder(false); });
    const deleteOrder = I.$(".pos-order-head button", screen);
    if (deleteOrder) deleteOrder.addEventListener("click", function () {
      resetOrder(false);
      I.toast("Order cleared");
    });

    I.$$(".pos-actions .pos-action", screen).forEach(function (button) {
      button.addEventListener("click", function () {
        const label = I.text(button);
        if (label.includes("Reset")) {
          resetOrder(true);
        } else if (label.includes("Transaction")) {
          orderCount += 1;
          localStorage.setItem("inventur.orderCount", String(orderCount));
          if (orderId) orderId.textContent = "Id : #" + orderCount;
          I.toast("Transaction #" + orderCount + " started");
        } else {
          I.toast(order.size + " product type(s) in current order");
        }
      });
    });

    async function submitPayment() {
      if (!order.size) {
        I.toast("Tambahkan produk sebelum payment", "warn");
        return;
      }
      const items = Array.from(order.values()).map(function (item) {
        return { productId: item.id, qty: item.qty };
      });
      const payload = {
        customer: customerSelect ? customerSelect.value || "Walk In Customer" : "Walk In Customer",
        items,
        discount: Number(discountInput && discountInput.value) || 0,
        shipping: Number(shippingSelect && shippingSelect.value) || 0,
        tax: taxSelect && taxSelect.value === "10%" ? 10 : 0,
        payment: selectedPayment,
      };

      try {
        const result = await window.InventurAPI.createTransaction(payload);
        order.clear();
        orderCount += 1;
        localStorage.setItem("inventur.orderCount", String(orderCount));
        if (orderId) orderId.textContent = "Id : #" + orderCount;
        renderOrder();
        await loadProducts();
        I.toast("Payment completed: " + result.orderId + " (" + I.formatMoney(result.total || lastTotal) + ")");
      } catch (err) {
        I.toast(err.message || "Payment gagal", "error");
      }
    }

    I.$$(".pos-final-actions button", screen).forEach(function (button) {
      button.addEventListener("click", function () {
        const action = I.text(button);
        if (action.includes("Payment")) {
          submitPayment();
        } else if (action.includes("Void")) {
          resetOrder(false);
          I.toast("Order voided");
        } else {
          I.toast("Order held");
        }
      });
    });

    if (orderId) orderId.textContent = "Id : #" + orderCount;
    renderOrder();
    loadProducts();
  });
})();
