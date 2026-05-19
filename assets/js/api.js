/**
 * api.js — Helper untuk semua request ke backend Inventur API
 * Base URL: http://localhost:3001/api
 */
(function () {
  "use strict";

  const BASE = "http://localhost:3001/api";

  function getToken() {
    try {
      const s = localStorage.getItem("inventur.session");
      return s ? JSON.parse(s).token : null;
    } catch {
      return null;
    }
  }

  function authHeaders() {
    const token = getToken();
    const h = { "Content-Type": "application/json" };
    if (token) h["Authorization"] = "Bearer " + token;
    return h;
  }

  async function request(method, path, body) {
    const opts = { method, headers: authHeaders() };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(BASE + path, opts);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(data.error || "Request gagal"), { status: res.status, data });
    return data;
  }

  const API = {
    // Auth
    login:       (email, password) => request("POST", "/auth/login", { email, password }),
    register:    (name, email, password) => request("POST", "/auth/register", { name, email, password }),
    googleLogin: (credential)      => request("POST", "/auth/google", { credential }),
    getAuthConfig: ()              => request("GET",  "/auth/config"),
    me:          ()                => request("GET",  "/auth/me"),

    // Products
    getProducts:   (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return request("GET", "/products" + (q ? "?" + q : ""));
    },
    getProduct:    (id)          => request("GET",    "/products/" + id),
    getProductBySku:(sku)        => request("GET",    "/products/sku/" + encodeURIComponent(sku)),
    createProduct: (data)        => request("POST",   "/products", data),
    updateProduct: (id, data)    => request("PUT",    "/products/" + id, data),
    deleteProduct: (id)          => request("DELETE", "/products/" + id),

    // Categories
    getCategories:    ()         => request("GET",    "/categories"),
    createCategory:   (name)     => request("POST",   "/categories", { name }),
    deleteCategory:   (id)       => request("DELETE", "/categories/" + id),

    // Brands
    getBrands:    ()             => request("GET",    "/brands"),
    createBrand:  (name)         => request("POST",   "/brands", { name }),
    deleteBrand:  (id)           => request("DELETE", "/brands/" + id),

    // Transactions
    createTransaction: (data)     => request("POST", "/transactions", data),

    // Invoices
    getInvoices:  (params = {})  => {
      const q = new URLSearchParams(params).toString();
      return request("GET", "/invoices" + (q ? "?" + q : ""));
    },
    createInvoice: (data)        => request("POST",   "/invoices", data),
    updateInvoice: (id, data)    => request("PUT",    "/invoices/" + id, data),

    // Dashboard
    getDashboard: ()             => request("GET", "/dashboard"),
  };

  window.InventurAPI = API;
})();
