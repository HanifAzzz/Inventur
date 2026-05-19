(function () {
  "use strict";

  const I = window.Inventur;

  function initCreateProduct(root) {
    const form = I.$(".create-form", root || document);
    if (!form || form.dataset.createProductReady === "true") return;
    form.dataset.createProductReady = "true";

    const addButton       = Array.from(I.$$(".form-actions .btn", form)).find(function (b) { return I.text(b) === "Add Product"; });
    const cancelButton    = Array.from(I.$$(".form-actions .btn", form)).find(function (b) { return I.text(b) === "Cancel"; });
    const uploadButton    = I.$(".upload-box", form);
    const description     = I.$(".editor textarea", form);
    const descriptionHint = I.$(".description-label small", form);
    let selectedImageUrl  = "";

    function labeledInput(labelText) {
      const label = I.$$(".field-label", form).find(function (l) {
        return I.text(l).replace("*", "").trim() === labelText;
      });
      return label ? label.closest("label").querySelector("input, select, textarea") : null;
    }

    const productName = labeledInput("Product Name");
    const slug        = labeledInput("Slug");
    const sku         = labeledInput("SKU");
    const itemCode    = labeledInput("Item Code");
    const priceInput  = labeledInput("Price");
    const qtyInput    = labeledInput("Quantity");
    const storeInput  = labeledInput("Store");
    const warehouseInput = labeledInput("Warehouse");
    const sellingTypeInput = labeledInput("Selling Type");
    const subCategoryInput = labeledInput("Sub Category");
    const barcodeInput = labeledInput("Barcode Symbology");
    const taxTypeInput = labeledInput("Tax Type");
    const discountTypeInput = labeledInput("Discount Type");
    const warrantyInput = labeledInput("Warranty");

    const DEFAULT_SELECT_OPTIONS = {
      "Store": ["Main Store", "Outlet A", "Outlet B"],
      "Warehouse": ["Central Warehouse", "North Warehouse", "Online Stock"],
      "Selling Type": ["Retail", "Wholesale", "POS"],
      "Sub Category": ["Laptop", "Headphones", "Sneakers", "Chair", "Backpack", "Phone Accessories"],
      "Unit": ["Pc", "Box", "Pack", "Kg", "Liter"],
      "Barcode Symbology": ["Code 128", "Code 39", "EAN-13", "UPC-A"],
      "Tax Type": ["Exclusive", "Inclusive", "No Tax"],
      "Discount Type": ["Percentage", "Fixed"],
      "Warranty": ["No Warranty", "6 Months", "1 Year", "2 Years"],
    };

    const DEFAULT_CATEGORIES = ["Computers", "Electronics", "Shoe", "Furniture", "Bags", "Phone"];
    const DEFAULT_BRANDS = ["Lenovo", "Apple", "Nike", "Beats", "Amazon", "Dior"];

    function fillStaticSelect(labelText, options, keepCurrent) {
      const select = labeledInput(labelText);
      if (!select || select.tagName !== "SELECT") return;
      const previousValue = keepCurrent ? select.value : "";
      select.innerHTML = '<option value="">Select</option>';
      options.forEach(function (optionText) {
        const opt = document.createElement("option");
        opt.value = optionText;
        opt.textContent = optionText;
        select.appendChild(opt);
      });
      if (previousValue) select.value = previousValue;
    }

    function populateStaticSelects() {
      Object.keys(DEFAULT_SELECT_OPTIONS).forEach(function (labelText) {
        fillStaticSelect(labelText, DEFAULT_SELECT_OPTIONS[labelText], true);
      });
    }

    async function ensureDefaultMasterData(getFn, createFn, defaultNames) {
      let items = await getFn();
      if (Array.isArray(items) && items.length) return items;

      for (const name of defaultNames) {
        try { await createFn(name); } catch (err) {}
      }

      try { items = await getFn(); } catch { items = []; }
      return Array.isArray(items) ? items : [];
    }

    async function populateSelects() {
      populateStaticSelects();

      function fillMasterSelect(labelText, items, fallbackNames) {
        const select = labeledInput(labelText);
        if (!select || select.tagName !== "SELECT") return;

        if (!Array.isArray(items) || !items.length) {
          fillStaticSelect(labelText, fallbackNames, true);
          return;
        }

        const previousValue = select.value;
        select.innerHTML = '<option value="">Select</option>';
        items.forEach(function (item) {
          const opt = document.createElement("option");
          opt.value = item.id;
          opt.textContent = item.name;
          select.appendChild(opt);
        });
        if (previousValue) {
          const byId = Array.from(select.options).some(function (opt) { return opt.value === String(previousValue); });
          const byName = items.find(function (item) { return item.name === previousValue; });
          select.value = byId ? String(previousValue) : (byName ? String(byName.id) : "");
        }
      }

      try {
        const [categoriesRes, brandsRes] = await Promise.all([
          ensureDefaultMasterData(window.InventurAPI.getCategories, window.InventurAPI.createCategory, DEFAULT_CATEGORIES),
          ensureDefaultMasterData(window.InventurAPI.getBrands, window.InventurAPI.createBrand, DEFAULT_BRANDS),
        ]);

        fillMasterSelect("Category", categoriesRes, DEFAULT_CATEGORIES);
        fillMasterSelect("Brand", brandsRes, DEFAULT_BRANDS);
        bindAddNewMasterLinks();
      } catch (err) {
        console.warn("Gagal load categories/brands:", err);
        fillStaticSelect("Category", DEFAULT_CATEGORIES, true);
        fillStaticSelect("Brand", DEFAULT_BRANDS, true);
        bindAddNewMasterLinks();
      }
    }

    function bindAddNewMasterLinks() {
      const addNewLinks = I.$$(".label-action a", form);
      addNewLinks.forEach(function (link) {
        if (link.dataset.addNewReady) return;
        link.dataset.addNewReady = "true";
        link.style.cursor = "pointer";
        link.addEventListener("click", async function (e) {
          e.preventDefault();
          const label = link.closest("label");
          const labelText = label ? I.text(I.$(".field-label", label)) : "";
          const isCategory = labelText.includes("Category");
          const isBrand = labelText.includes("Brand");
          const name = prompt(isCategory ? "Nama kategori baru:" : "Nama brand baru:");
          if (!name || !name.trim()) return;

          try {
            const created = isCategory
              ? await window.InventurAPI.createCategory(name.trim())
              : await window.InventurAPI.createBrand(name.trim());
            const select = labeledInput(isCategory ? "Category" : "Brand");
            const opt = document.createElement("option");
            opt.value = created.id;
            opt.textContent = created.name;
            select.appendChild(opt);
            select.value = created.id;
            I.toast("✅ " + (isCategory ? "Kategori" : "Brand") + " \"" + created.name + "\" ditambahkan");
          } catch (err) {
            I.toast("Gagal tambah data: " + err.message, "error");
          }
        });
      });
    }

    function setUploadPreview(src, name) {
      if (!uploadButton) return;
      uploadButton.innerHTML = "";
      if (src) {
        const img = document.createElement("img");
        img.className = "upload-preview";
        img.src = src;
        img.alt = name || "Product image";
        uploadButton.appendChild(img);
        const caption = document.createElement("span");
        caption.textContent = name || "Change Image";
        uploadButton.appendChild(caption);
      } else {
        uploadButton.innerHTML = '<img src="../assets/img/icons/circle-plus.svg" alt="" />Add Image';
      }
    }

    function readImageAsDataUrl(file) {
      return new Promise(function (resolve, reject) {
        const reader = new FileReader();
        reader.onload = function () { resolve(reader.result); };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    }

    async function prefillIfEdit() {
      const params = new URLSearchParams(location.search);
      const skuVal = params.get("sku");
      if (!skuVal) return;
      try {
        const product = await window.InventurAPI.getProductBySku(skuVal);
        if (productName) productName.value = product.name;
        if (slug)        slug.value        = product.slug;
        if (sku)         sku.value         = product.sku;
        if (itemCode)    itemCode.value    = product.itemCode;
        if (priceInput)  priceInput.value  = product.price;
        if (qtyInput)    qtyInput.value    = product.qty || 0;
        if (storeInput)  storeInput.value  = product.store || "";
        if (warehouseInput) warehouseInput.value = product.warehouse || "";
        if (sellingTypeInput) sellingTypeInput.value = product.sellingType || "";
        if (subCategoryInput) subCategoryInput.value = product.subCategory || "";
        if (barcodeInput) barcodeInput.value = product.barcodeSymbology || "";
        if (taxTypeInput) taxTypeInput.value = product.taxType || "";
        if (discountTypeInput) discountTypeInput.value = product.discountType || "";
        if (warrantyInput) warrantyInput.value = product.warranty || "";
        const categorySelect = labeledInput("Category");
        const brandSelect = labeledInput("Brand");
        const unitSelect = labeledInput("Unit");
        if (categorySelect && product.categoryId) categorySelect.value = product.categoryId;
        if (brandSelect && product.brandId) brandSelect.value = product.brandId;
        if (unitSelect && product.unit) unitSelect.value = product.unit;
        if (description) description.value = product.description || "";
        if (product.imageUrl) {
          selectedImageUrl = product.imageUrl;
          setUploadPreview(product.imageUrl, "Change Image");
        }

        form.dataset.editId  = product.id;
        form.dataset.editSku = product.sku;
        if (addButton) addButton.textContent = "Update Product";
        I.toast("Data produk dimuat untuk diedit");
      } catch {
        I.toast("Produk tidak ditemukan", "warn");
      }
    }

    function markInvalid(input, invalid) {
      input.style.borderColor = invalid ? "#ef4444" : "";
      input.style.boxShadow   = invalid ? "0 0 0 3px rgba(239,68,68,.10)" : "";
    }

    function validate() {
      let valid = true;
      I.$$(".required", form).forEach(function (req) {
        const input = req.closest("label") ? req.closest("label").querySelector("input, select, textarea") : null;
        if (!input) return;
        const invalid = !String(input.value || "").trim();
        markInvalid(input, invalid);
        if (invalid) valid = false;
      });
      return valid;
    }

    function updateDescriptionCount() {
      if (!description || !descriptionHint) return;
      const words = I.normalize(description.value).split(" ").filter(Boolean);
      if (words.length > 60) description.value = words.slice(0, 60).join(" ");
      descriptionHint.textContent = Math.min(words.length, 60) + "/60 Words";
    }

    if (productName && slug) {
      productName.addEventListener("input", function () {
        if (!slug.dataset.touched) slug.value = I.slugify(productName.value);
      });
      slug.addEventListener("input", function () {
        slug.dataset.touched = "true";
        slug.value = I.slugify(slug.value);
      });
    }

    I.$$(".input-action button", form).forEach(function (button) {
      button.addEventListener("click", function () {
        const input = button.closest(".input-action").querySelector("input");
        input.value = input === sku ? I.randomCode("SKU-", 5) : I.randomCode("ITM-", 6);
        markInvalid(input, false);
      });
    });

    I.$$(".form-card > header", form).forEach(function (header) {
      header.style.cursor = "pointer";
      header.addEventListener("click", function () {
        const card = header.closest(".form-card");
        Array.from(card.children).forEach(function (child, index) {
          if (index > 0) child.hidden = !child.hidden;
        });
      });
    });

    if (description) {
      description.addEventListener("input", updateDescriptionCount);
      updateDescriptionCount();
    }

    if (uploadButton) {
      uploadButton.addEventListener("click", function () {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/*";
        input.addEventListener("change", async function () {
          const file = input.files && input.files[0];
          if (!file) return;
          if (file.size > 4 * 1024 * 1024) {
            I.toast("Ukuran gambar maksimal 4 MB", "error");
            return;
          }
          try {
            selectedImageUrl = await readImageAsDataUrl(file);
            setUploadPreview(selectedImageUrl, file.name);
            I.toast("Gambar berhasil dipilih: " + file.name);
          } catch (err) {
            I.toast("Gagal membaca gambar", "error");
          }
        });
        input.click();
      });
    }

    if (cancelButton) {
      cancelButton.addEventListener("click", function () {
        I.loadAppPage("./products.html");
      });
    }

    if (addButton) {
      addButton.addEventListener("click", async function () {
        if (!validate()) {
          I.toast("Lengkapi semua field yang wajib diisi", "error");
          return;
        }

        const categorySelect = labeledInput("Category");
        const brandSelect    = labeledInput("Brand");
        const unitSelect     = labeledInput("Unit");
        const editId         = form.dataset.editId;

        const payload = {
          sku:         sku         ? sku.value         : "",
          itemCode:    itemCode    ? itemCode.value     : "",
          name:        productName ? productName.value  : "",
          slug:        slug        ? slug.value         : "",
          description: description ? description.value  : "",
          price:       priceInput  ? priceInput.value   : 0,
          qty:         qtyInput    ? qtyInput.value     : 0,
          unit:        unitSelect  ? unitSelect.value   : "Pc",
          store:       storeInput  ? storeInput.value   : "",
          warehouse:   warehouseInput ? warehouseInput.value : "",
          sellingType: sellingTypeInput ? sellingTypeInput.value : "",
          subCategory: subCategoryInput ? subCategoryInput.value : "",
          barcodeSymbology: barcodeInput ? barcodeInput.value : "",
          taxType:     taxTypeInput ? taxTypeInput.value : "",
          discountType: discountTypeInput ? discountTypeInput.value : "",
          warranty:    warrantyInput ? warrantyInput.value : "",
          imageUrl:    selectedImageUrl || "",
          categoryId:  categorySelect ? categorySelect.value : null,
          brandId:     brandSelect    ? brandSelect.value    : null,
        };

        addButton.disabled = true;
        addButton.textContent = "Menyimpan...";

        try {
          if (editId) {
            await window.InventurAPI.updateProduct(Number(editId), payload);
            I.toast("Produk berhasil diupdate!");
          } else {
            await window.InventurAPI.createProduct(payload);
            I.toast("Produk berhasil ditambahkan!");
          }
          setTimeout(function () { I.loadAppPage("./products.html"); }, 800);
        } catch (err) {
          I.toast("Gagal menyimpan: " + err.message, "error");
          addButton.disabled = false;
          addButton.textContent = editId ? "Update Product" : "Add Product";
        }
      });
    }

    if (!sku || !sku.value) {
      if (sku) sku.value = I.randomCode("SKU-", 5);
      if (itemCode) itemCode.value = I.randomCode("ITM-", 6);
    }

    populateSelects().then(prefillIfEdit);
  }

  I.registerPage("create-product", initCreateProduct);
  I.ready(initCreateProduct);
})();
