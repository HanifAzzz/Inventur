(function () {
  "use strict";

  const I = window.Inventur;

  function initInvoiceReports(root) {
    const scope = root || document;
    const page  = I.$(".report-page", scope);
    const table = I.$(".report-table", scope);
    if (!page || !table || page.dataset.invoiceReady === "true") return;
    page.dataset.invoiceReady = "true";

    const dateStartInput = I.$(".date-start", page);
    const dateEndInput   = I.$(".date-end", page);
    const customerSelect = I.$(".report-filter label:nth-child(2) select", page);
    const statusSelect   = I.$(".report-filter label:nth-child(3) select", page);
    const generateButton = I.$(".report-filter .btn-primary", page);
    const exportButtons  = I.$$(".table-toolbar .action-btn", page);
    const stats          = I.$$(".report-stat strong", page);
    const tbody          = I.$("tbody", table);
    const rowSizeButton  = I.$(".row-size .btn", page);
    const pagination     = I.$(".pagination", page);
    const rowSizeWrap    = I.$(".row-size", page);

    let allInvoices = [];
    let customer = "All";
    let status = "All";
    let rowsPerPage = 10;
    let currentPage = 1;

    function escapeHtml(value) {
      return String(value ?? "").replace(/[&<>'"]/g, function (ch) {
        return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[ch];
      });
    }

    function toInputDate(date) {
      return date.toISOString().slice(0, 10);
    }

    function setDefaultDates() {
      const now = new Date();
      const start = new Date(now.getFullYear(), 0, 1);
      const end = new Date(now.getFullYear(), 11, 31);
      if (dateStartInput && !dateStartInput.value) dateStartInput.value = toInputDate(start);
      if (dateEndInput && !dateEndInput.value) dateEndInput.value = toInputDate(end);
    }

    function invoiceFilterDate(inv) {
      return inv.createdAt ? new Date(inv.createdAt) : new Date(inv.dueDate);
    }

    function filteredInvoices() {
      const start = dateStartInput && dateStartInput.value ? new Date(dateStartInput.value + "T00:00:00") : null;
      const end = dateEndInput && dateEndInput.value ? new Date(dateEndInput.value + "T23:59:59") : null;
      return allInvoices.filter(function (inv) {
        const invDate = invoiceFilterDate(inv);
        const dateOk = (!start || invDate >= start) && (!end || invDate <= end);
        const customerOk = customer === "All" || inv.customer === customer;
        const dueDate = new Date(inv.dueDate);
        const isOverdue = inv.status !== "Paid" && dueDate < new Date();
        const statusOk = status === "All" || (status === "Overdue" ? isOverdue : inv.status === status);
        return dateOk && customerOk && statusOk;
      });
    }

    function renderRows(invoices) {
      tbody.innerHTML = "";
      if (!invoices.length) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:40px;color:#94a3b8">Tidak ada invoice untuk filter ini</td></tr>';
        return;
      }
      invoices.forEach(function (inv) {
        const due = new Date(inv.dueDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
        const statusClass = inv.status === "Paid" ? "badge-paid" : "badge-unpaid";
        const tr = document.createElement("tr");
        tr.innerHTML =
          "<td><a>" + escapeHtml(inv.invoiceNumber) + "</a></td>" +
          "<td>" + escapeHtml(inv.customer) + "</td>" +
          "<td>" + due + "</td>" +
          "<td>" + I.formatMoney(inv.amount) + "</td>" +
          "<td>" + I.formatMoney(inv.paid) + "</td>" +
          "<td>" + I.formatMoney(inv.due) + "</td>" +
          '<td><span class="badge ' + statusClass + '">• ' + escapeHtml(inv.status) + "</span></td>";
        tbody.appendChild(tr);
      });
    }

    function updateStats(invoices) {
      const now = new Date();
      const totals = invoices.reduce(function (acc, inv) {
        acc.amount += Number(inv.amount) || 0;
        acc.paid += Number(inv.paid) || 0;
        acc.due += Number(inv.due) || 0;
        const dueDate = new Date(inv.dueDate);
        if (inv.status !== "Paid" && dueDate < now) acc.overdue += Number(inv.due) || 0;
        return acc;
      }, { amount: 0, paid: 0, due: 0, overdue: 0 });

      [totals.amount, totals.paid, totals.due, totals.overdue].forEach(function (val, i) {
        if (stats[i]) stats[i].textContent = I.formatMoney(val);
      });
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
        const start = total === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1;
        const end = rowsPerPage >= 999 ? total : Math.min(total, start + rowsPerPage - 1);
        rowSizeWrap.setAttribute("title", "Showing " + start + "-" + end + " of " + total + " entries");
      }
      renderPagination(total);
    }

    function applyFilters() {
      const filtered = filteredInvoices();
      const total = filtered.length;
      const totalPages = rowsPerPage >= 999 ? 1 : Math.max(1, Math.ceil(total / rowsPerPage));
      if (currentPage > totalPages) currentPage = totalPages;
      const start = rowsPerPage >= 999 ? 0 : (currentPage - 1) * rowsPerPage;
      const pageRows = rowsPerPage >= 999 ? filtered : filtered.slice(start, start + rowsPerPage);
      renderRows(pageRows);
      updateStats(filtered);
      updateFooter(total);
      return filtered;
    }

    function populateCustomerSelect() {
      if (!customerSelect) return;
      const current = customerSelect.value || "All";
      const customers = Array.from(new Set(allInvoices.map(function (i) { return i.customer; }).filter(Boolean))).sort();
      customerSelect.innerHTML = '<option value="All">All</option>';
      customers.forEach(function (c) {
        const opt = document.createElement("option");
        opt.value = opt.textContent = c;
        customerSelect.appendChild(opt);
      });
      customerSelect.value = customers.includes(current) ? current : "All";
      customer = customerSelect.value;
    }

    function populateStatusSelect() {
      if (!statusSelect) return;
      const current = statusSelect.value || "All";
      statusSelect.innerHTML = '<option value="All">All</option>';
      ["Paid", "Unpaid", "Overdue"].forEach(function (s) {
        const opt = document.createElement("option");
        opt.value = opt.textContent = s;
        statusSelect.appendChild(opt);
      });
      statusSelect.value = ["Paid", "Unpaid", "Overdue"].includes(current) ? current : "All";
      status = statusSelect.value;
    }

    async function loadInvoices() {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:40px;color:#94a3b8">Memuat data...</td></tr>';
      try {
        const res = await window.InventurAPI.getInvoices();
        allInvoices = res.data || [];
        populateCustomerSelect();
        populateStatusSelect();
        currentPage = 1;
        applyFilters();
      } catch (err) {
        console.error("Gagal load invoices:", err);
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:40px;color:#ef4444">Gagal memuat invoice. Pastikan server berjalan.</td></tr>';
      }
    }

    function reportRows() {
      return filteredInvoices();
    }

    function csvEscape(value) {
      return '"' + String(value ?? "").replace(/"/g, '""') + '"';
    }

    function downloadBlob(filename, type, content) {
      const link = document.createElement("a");
      link.href = URL.createObjectURL(new Blob([content], { type: type }));
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(function () { URL.revokeObjectURL(link.href); }, 500);
    }

    function rowsForExport() {
      const rows = reportRows();
      return rows.map(function (inv) {
        return [
          inv.invoiceNumber,
          inv.customer,
          new Date(inv.dueDate).toLocaleDateString("en-GB"),
          Number(inv.amount) || 0,
          Number(inv.paid) || 0,
          Number(inv.due) || 0,
          inv.status,
        ];
      });
    }

    function exportExcel() {
      const headers = ["Invoice", "Customer", "Due Date", "Amount", "Paid", "Due", "Status"];
      const body = rowsForExport().map(function (row) {
        return "<tr>" + row.map(function (cell) { return "<td>" + escapeHtml(cell) + "</td>"; }).join("") + "</tr>";
      }).join("");
      const html = "<html><head><meta charset='UTF-8'></head><body><table border='1'><thead><tr>" +
        headers.map(function (h) { return "<th>" + h + "</th>"; }).join("") +
        "</tr></thead><tbody>" + body + "</tbody></table></body></html>";
      downloadBlob("invoice-report.xls", "application/vnd.ms-excel;charset=utf-8", html);
      I.toast("Excel berhasil diekspor");
    }

    function pdfEscape(value) {
      return String(value ?? "").replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
    }

    function buildSimplePdf(lines) {
      const objects = [];
      function addObject(content) {
        objects.push(content);
        return objects.length;
      }
      const catalogId = addObject("<< /Type /Catalog /Pages 2 0 R >>");
      const pagesId = addObject("__PAGES__");
      const fontId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
      const pageIds = [];
      const lineHeight = 15;
      const perPage = 48;
      for (let start = 0; start < Math.max(lines.length, 1); start += perPage) {
        const chunk = lines.slice(start, start + perPage);
        let y = 800;
        const commands = ["BT", "/F1 10 Tf", "40 " + y + " Td"];
        if (!chunk.length) chunk.push("Tidak ada data");
        chunk.forEach(function (line, i) {
          if (i > 0) commands.push("0 -" + lineHeight + " Td");
          commands.push("(" + pdfEscape(line).slice(0, 95) + ") Tj");
        });
        commands.push("ET");
        const stream = commands.join("\n");
        const contentId = addObject("<< /Length " + stream.length + " >>\nstream\n" + stream + "\nendstream");
        const pageId = addObject("<< /Type /Page /Parent " + pagesId + " 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 " + fontId + " 0 R >> >> /Contents " + contentId + " 0 R >>");
        pageIds.push(pageId);
      }
      objects[pagesId - 1] = "<< /Type /Pages /Kids [" + pageIds.map(function (id) { return id + " 0 R"; }).join(" ") + "] /Count " + pageIds.length + " >>";

      let pdf = "%PDF-1.4\n";
      const offsets = [0];
      objects.forEach(function (object, index) {
        offsets.push(pdf.length);
        pdf += (index + 1) + " 0 obj\n" + object + "\nendobj\n";
      });
      const xref = pdf.length;
      pdf += "xref\n0 " + (objects.length + 1) + "\n0000000000 65535 f \n";
      for (let i = 1; i < offsets.length; i += 1) pdf += String(offsets[i]).padStart(10, "0") + " 00000 n \n";
      pdf += "trailer\n<< /Size " + (objects.length + 1) + " /Root " + catalogId + " 0 R >>\nstartxref\n" + xref + "\n%%EOF";
      return pdf;
    }

    function exportPdf() {
      const rows = rowsForExport();
      const lines = [
        "Inventur - Invoice Report",
        "Generated: " + new Date().toLocaleString(),
        "Filter date: " + (dateStartInput ? dateStartInput.value : "") + " - " + (dateEndInput ? dateEndInput.value : ""),
        "Customer: " + customer + " | Status: " + status,
        "",
        "Invoice | Customer | Due Date | Amount | Paid | Due | Status",
      ];
      rows.forEach(function (row) {
        lines.push(row[0] + " | " + row[1] + " | " + row[2] + " | " + row[3] + " | " + row[4] + " | " + row[5] + " | " + row[6]);
      });
      downloadBlob("invoice-report.pdf", "application/pdf", buildSimplePdf(lines));
      I.toast("PDF berhasil diekspor");
    }

    function printReport() {
      const headers = ["Invoice", "Customer", "Due Date", "Amount", "Paid", "Due", "Status"];
      const rows = rowsForExport();
      const htmlRows = rows.map(function (row) {
        return "<tr>" + row.map(function (cell) { return "<td>" + escapeHtml(cell) + "</td>"; }).join("") + "</tr>";
      }).join("");
      const win = window.open("", "_blank", "width=1000,height=700");
      if (!win) {
        window.print();
        return;
      }
      win.document.write("<!doctype html><html><head><title>Invoice Report</title><style>body{font-family:Arial,sans-serif;padding:24px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f5f5f5}</style></head><body><h1>Invoice Report</h1><p>" + escapeHtml(new Date().toLocaleString()) + "</p><table><thead><tr>" + headers.map(function (h) { return "<th>" + h + "</th>"; }).join("") + "</tr></thead><tbody>" + htmlRows + "</tbody></table></body></html>");
      win.document.close();
      win.focus();
      win.print();
    }

    if (customerSelect) customerSelect.addEventListener("change", function () { customer = customerSelect.value; });
    if (statusSelect) statusSelect.addEventListener("change", function () { status = statusSelect.value; });
    if (dateStartInput) dateStartInput.addEventListener("change", function () { if (dateEndInput && dateEndInput.value && dateStartInput.value > dateEndInput.value) dateEndInput.value = dateStartInput.value; });
    if (dateEndInput) dateEndInput.addEventListener("change", function () { if (dateStartInput && dateStartInput.value && dateEndInput.value < dateStartInput.value) dateStartInput.value = dateEndInput.value; });

    if (generateButton) generateButton.addEventListener("click", function () {
      customer = customerSelect ? customerSelect.value : "All";
      status = statusSelect ? statusSelect.value : "All";
      currentPage = 1;
      const count = applyFilters().length;
      I.toast(count + " invoice ditemukan");
    });

    if (rowSizeButton && !rowSizeButton.dataset.dropdownReady) {
      rowSizeButton.dataset.dropdownReady = "true";
      I.makeDropdown(rowSizeButton, ["5", "10", "25", "50", "All"], function (value) {
        rowsPerPage = value === "All" ? 999 : Number(value);
        currentPage = 1;
        applyFilters();
      });
    }

    exportButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        customer = customerSelect ? customerSelect.value : "All";
        status = statusSelect ? statusSelect.value : "All";
        applyFilters();
        const icon = I.$("img", button);
        const src = icon ? icon.getAttribute("src") || "" : "";
        if (src.includes("PDF")) exportPdf();
        else if (src.includes("Excel")) exportExcel();
        else if (src.includes("printer")) printReport();
      });
    });

    function refreshHandler() {
      customer = "All";
      status = "All";
      currentPage = 1;
      if (customerSelect) customerSelect.value = "All";
      if (statusSelect) statusSelect.value = "All";
      setDefaultDates();
      loadInvoices();
      I.toast("Invoice report refreshed");
    }

    document.addEventListener("inventur:refresh", refreshHandler);
    page.addEventListener("inventur:dispose", function () {
      document.removeEventListener("inventur:refresh", refreshHandler);
    }, { once: true });

    setDefaultDates();
    loadInvoices();
  }

  I.registerPage("invoice-reports", initInvoiceReports);
  I.ready(initInvoiceReports);
})();
