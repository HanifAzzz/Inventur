(function () {
  "use strict";

  const I = window.Inventur;

  function initDashboard(root) {
    const page = I.$(".dashboard-page", root || document);
    if (!page) return;

    const dateButton = I.$(".dashboard-greeting .page-actions .btn", page);
    const greeting   = I.$(".dashboard-greeting h1", page);
    const earning    = I.$(".earning-card strong", page);
    const sales      = I.$(".sales-card strong", page);
    const purchases  = I.$(".purchase-card strong", page);
    const ranges     = ["week", "month", "allTime"];
    let rangeIndex   = 0;

    function setGreeting() {
      try {
        const session = JSON.parse(localStorage.getItem("inventur.session") || "{}");
        if (greeting && session.name) {
          greeting.innerHTML = "👋 Hi " + session.name + ", <span>here's what's happening with your store today.</span>";
        }
      } catch {}
    }

    function formatDate(date) {
      return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    }

    function currentRange(mode) {
      const now   = new Date();
      const start = new Date(now);
      const end   = new Date(now);
      if (mode === "allTime") return "All Time";
      if (mode === "month") {
        start.setDate(1);
        end.setMonth(end.getMonth() + 1, 0);
      } else {
        const day = now.getDay() || 7;
        start.setDate(now.getDate() - day + 1);
        end.setDate(start.getDate() + 6);
      }
      return formatDate(start) + " - " + formatDate(end);
    }

    function setDateRange() {
      if (!dateButton) return;
      const icon = I.$("img", dateButton);
      dateButton.textContent = currentRange(ranges[rangeIndex]);
      if (icon) dateButton.prepend(icon);
    }

    function setEmptyMetrics() {
      if (earning)   earning.textContent   = I.formatMoney(0);
      if (sales)     sales.textContent     = "0";
      if (purchases) purchases.textContent = "0";
    }

    async function loadDashboard() {
      try {
        const data = await window.InventurAPI.getDashboard();
        const mode = ranges[rangeIndex];
        const earn = mode === "week"    ? data.earnings.week
                   : mode === "month"   ? data.earnings.month
                   : data.earnings.allTime;

        const inventoryValue = Number(data.inventoryValue || 0);
        if (earning)   earning.textContent   = I.formatMoney(inventoryValue || earn || 0);
        if (sales)     sales.textContent     = String(data.sales || 0);
        if (purchases) purchases.textContent = String(data.totalProducts || data.purchases || 0);
      } catch (err) {
        console.error("Gagal load dashboard:", err);
        setEmptyMetrics();
        I.toast("Gagal memuat dashboard. Pastikan server berjalan.", "error");
      }
    }

    if (dateButton) {
      dateButton.addEventListener("click", function () {
        rangeIndex = (rangeIndex + 1) % ranges.length;
        setDateRange();
        loadDashboard();
      });
    }

    function refreshHandler() {
      loadDashboard();
      I.toast("Dashboard data refreshed");
    }

    document.addEventListener("inventur:refresh", refreshHandler);
    page.addEventListener("inventur:dispose", function () {
      document.removeEventListener("inventur:refresh", refreshHandler);
    }, { once: true });

    setGreeting();
    setDateRange();
    setEmptyMetrics();
    loadDashboard();
  }

  I.registerPage("dashboard", initDashboard);
  I.ready(initDashboard);
})();
