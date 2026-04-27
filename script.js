// ============================================================
//  APERAM STORE DASHBOARD - ENTERPRISE EDITION (100% FIXED)
// ============================================================

// YAHAN APNA GOOGLE APPS SCRIPT WEB APP URL DAALEIN:
const API_URL = "https://script.google.com/macros/s/AKfycbwdbk8kxJ6Liy7-nSkPrRqi5Bq2e1PR-etHMVXEl_mj2ZzaMGmJ6zdTgZ49iiPN5e5uQQ/exec";

var d = {};
var charts = {};
var refreshInterval = null; 
var anomalies = []; 

Chart.register(ChartDataLabels);

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  let icon = type === 'success' ? '✅' : (type === 'error' ? '❌' : 'ℹ️');
  toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => { if(container.contains(toast)) container.removeChild(toast); }, 3000);
}

function toggleMobileMenu() {
  document.getElementById('appSidebar').classList.toggle('active');
}

function showModal(title, bodyHtml) {
  document.getElementById('modalTitle').innerText = title;
  document.getElementById('modalBody').innerHTML = bodyHtml;
  document.getElementById('detailModal').style.display = 'flex';
}
function closeModal() {
  document.getElementById('detailModal').style.display = 'none';
}

function showDetailTable(title, headers, rows) {
  var html = '<div style="overflow-x:auto; max-height: 70vh;">';
  html += '<table class="detail-table"><thead><tr>';
  headers.forEach(function(h) { html += '<th>' + h + '</th>'; });
  html += '</tr></thead><tbody>';
  rows.forEach(function(r) {
    html += '<tr>';
    r.forEach(function(c) { html += '<td>' + (c !== undefined && c !== null ? c : '') + '</td>'; });
    html += '</tr>';
  });
  html += '</tbody></table></div>';
  showModal(title, html);
}

function stringifyValue(v) {
  if(v === null || v === undefined) return '';
  if(typeof v === 'number') return v;
  return String(v);
}

function toTableRows(objects, cols) {
  return objects.map(function(item) {
    return cols.map(function(col) { return stringifyValue(item[col]); });
  });
}

function getTopRowsByField(dataArray, field, limit) {
  if(!dataArray || !dataArray.length) return [];
  return dataArray.slice().sort(function(a,b) { return (b[field]||0) - (a[field]||0); }).slice(0, limit);
}

function toggleFullScreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(err => showToast(err.message, 'error'));
  } else { document.exitFullscreen(); }
}

function toggleAutoRefresh() {
  const btn = document.getElementById('btn-autorefresh');
  if (refreshInterval) {
    clearInterval(refreshInterval); refreshInterval = null;
    btn.innerText = '⏱️ Auto: OFF'; btn.classList.remove('btn-active');
    showToast('Auto Refresh Disabled', 'info');
  } else {
    refreshInterval = setInterval(() => fetchLiveData(false), 300000);
    btn.innerText = '⏱️ Auto: ON (5m)'; btn.classList.add('btn-active');
    showToast('Auto Refresh Enabled', 'success');
  }
}

function initSettings() {
  var savedTheme = localStorage.getItem('dashTheme') || 'default';
  document.body.setAttribute('data-theme', savedTheme);
  var themeSelect = document.getElementById('themeSelect');
  if(themeSelect) themeSelect.value = savedTheme;

  var savedBg = localStorage.getItem('dashBg') || 'default';
  var bgSelect = document.getElementById('bgSelect');
  if(bgSelect) { bgSelect.value = savedBg; }
  applyDashboardBackground(savedBg);

  var savedPin = localStorage.getItem('dashPin');
  if(savedPin) {
    document.getElementById('lock-screen').style.display = 'flex';
    document.getElementById('loader').style.display = 'none';
  } else {
    fetchLiveData(true);
  }
  initDragDrop();
  document.getElementById('globalSearch').addEventListener('input', function() { performGlobalSearch(this.value); });
}

function unlockDash() {
  var input = document.getElementById('pinInput').value;
  var savedPin = localStorage.getItem('dashPin');
  if(input === savedPin) {
    document.getElementById('lock-screen').style.display = 'none';
    showToast('Dashboard Unlocked!', 'success');
    fetchLiveData(true);
  } else { document.getElementById('pinError').style.display = 'block'; }
}

function savePin() {
  var pin = document.getElementById('newPin').value;
  if(pin.length < 3) { showToast("PIN must be at least 3 characters!", "error"); return; }
  localStorage.setItem('dashPin', pin);
  document.getElementById('newPin').value = '';
  showToast("PIN Saved Successfully!", "success");
}

function removePin() {
  localStorage.removeItem('dashPin'); showToast("PIN Protection Removed.", "info");
}

function changeTheme() {
  var theme = document.getElementById('themeSelect').value;
  if(!theme) { var current = document.body.getAttribute('data-theme'); theme = current === 'dark' ? 'light' : 'dark'; }
  document.body.setAttribute('data-theme', theme);
  localStorage.setItem('dashTheme', theme);
  var themeSelect = document.getElementById('themeSelect'); if(themeSelect) themeSelect.value = theme;
  updateAllChartsColor(); showToast(`Theme changed to ${theme.toUpperCase()}`, 'info');
}

function applyDashboardBackground(value) {
  if(!value || value === 'default') {
    document.documentElement.style.removeProperty('--custom-bg');
  } else {
    var backgroundMap = {
      purple: 'linear-gradient(135deg, #4c1d95 0%, #9333ea 100%)',
      blue: 'linear-gradient(135deg, #0ea5e9 0%, #818cf8 100%)',
      gray: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)'
    };
    var selectedBg = backgroundMap[value] || value;
    document.documentElement.style.setProperty('--custom-bg', selectedBg);
  }
}

function changeBackground() {
  var selected = document.getElementById('bgSelect').value;
  if(selected) {
    localStorage.setItem('dashBg', selected);
    applyDashboardBackground(selected);
    showToast('Dashboard background updated', 'info');
  }
}

function updateAllChartsColor() {
  var isDark = document.body.getAttribute('data-theme') === 'dark';
  var textColor = isDark ? '#f8fafc' : '#1f2937';
  Chart.defaults.color = isDark ? '#94a3b8' : '#6b7280';
  Chart.defaults.set('plugins.datalabels', { color: textColor });
  
  if(d.inward) {
    try { updateOverview(); updateOverviewStock(); updateInward(); updateFG(); updateScrap(); updateOpex(); updateConsumption(); } catch(e){}
    if(d.liveStock) try { updateLiveStock(); } catch(e){}
    if(d.overallStock) try { updateOverallStock(); } catch(e){}
  }
}

Chart.defaults.layout = { padding: { top: 30, right: 20, left: 10, bottom: 10 } };
Chart.defaults.set('plugins.datalabels', {
  anchor: 'end', align: 'top', font: { weight: 'bold', size: 10, family: "'Inter', sans-serif" },
  formatter: function(value, context) {
    if(!value) return '';
    var id = context.chart.canvas.id;
    if(id.includes('inr') || id.includes('val') || id.includes('opex') || id.includes('pie') || id.includes('top') || id.includes('cat') || id.includes('comp')) {
        if (value >= 10000000) return (value/10000000).toFixed(2) + 'Cr';
        if (value >= 100000) return (value/100000).toFixed(2) + 'L';
        return Number(value).toLocaleString('en-IN', {maximumFractionDigits: 1});
    } 
    return formatUnitSmart(value);
  }
});

function get3DGradient(id, colorTop, colorBottom) {
  var canvas = document.getElementById(id); if(!canvas) return colorTop;
  var ctx = canvas.getContext('2d');
  var gradient = ctx.createLinearGradient(0, 0, 0, 300);
  gradient.addColorStop(0, colorTop); gradient.addColorStop(1, colorBottom);
  return gradient;
}

function formatUnitSmart(val) { 
  if (!val || isNaN(val)) return '0 Kg';
  let num = parseFloat(val);
  if (num >= 1000) { return Number((num / 1000).toFixed(2)).toLocaleString('en-IN') + ' MT'; } 
  return Number(num.toFixed(2)).toLocaleString('en-IN') + ' Kg'; 
}

function fmtL(n) { 
  if (n >= 10000000) return (n/10000000).toFixed(2) + ' Cr';
  if (n >= 100000) return (n/100000).toFixed(2) + ' L';
  return Math.round(n).toLocaleString('en-IN'); 
}
function fmtCr(n) { return (n/1e7).toFixed(2); }

function checkDateRange(dateString, fromId, toId) {
  if(!dateString) return true;
  var rowD = new Date(dateString);
  var fromVal = document.getElementById(fromId).value;
  var toVal = document.getElementById(toId).value;
  if(fromVal && rowD < new Date(fromVal)) return false;
  if(toVal) { var endD = new Date(toVal); endD.setHours(23,59,59,999); if(rowD > endD) return false; }
  return true;
}

function showTab(id, btn) {
  document.querySelectorAll(".section").forEach(function(s) { s.classList.remove("active"); });
  document.querySelectorAll(".tab").forEach(function(t) { t.classList.remove("active"); });
  document.getElementById("sec-"+id).classList.add("active");
  if(btn) btn.classList.add("active");
  document.getElementById('appSidebar').classList.remove('active');

  if(id === 'overview') { updateOverview(); updateOverviewStock(); }
  if(id === 'insights') { loadInsights(); loadAnomalies(); }
  if(id === 'analytics') { loadPredictiveAnalytics(); }
  if(id === 'gantt') { initGanttChart(); }
  if(id === 'opex') { updateOpex(); }
}

async function fetchLiveData(showLoadingUI = true) {
  if(API_URL === "YOUR_WEB_APP_URL_HERE") { showToast("Please update API_URL in script.js", "error"); return; }
  var loader = document.getElementById('loader'); var loadText = document.getElementById('loadText');
  if(showLoadingUI) { document.getElementById('main-content').style.display = 'none'; loader.style.display = 'flex'; loadText.innerText = "Downloading Operations Data..."; } 
  else { showToast("Syncing data...", "info"); }
  
  d = {};
  var failHandler = function(errMessage) {
    if(showLoadingUI) { loader.innerHTML = `<p style="color:#ef4444; font-size:40px;">❌</p><p style="color:#ef4444;">Error: ${errMessage}</p><button class="action-btn" onclick="fetchLiveData(true)">🔄 Retry</button>`; } 
    else { showToast(errMessage, "error"); }
  };

  try {
    let res = await fetch(API_URL + "?type=all"); 
    if(!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    let allData = await res.json();
    if(allData.error) throw new Error(allData.error);

    d.inward = allData.inward; d.fg = allData.fg; d.scrap = allData.scrap; d.opex = allData.opex;
    d.liveStock = allData.livestock; d.overallStock = allData.overallstock; d.opexApril = allData.opexApril; d.consumption = allData.consumption;

    if(showLoadingUI) loadText.innerText = "✨ Assembling Dashboard...";
    
    // Use requestAnimationFrame for better timing than setTimeout
    requestAnimationFrame(function() {
      try {
        setupDropdowns(); updateAllChartsColor(); buildOpexAprilTable(); loadAnomalies();
        if(showLoadingUI) { loader.style.display = 'none'; document.getElementById('main-content').style.display = 'block'; }
        showToast("Data Synced Successfully!", "success");
      } catch(error) { failHandler("Assembly Error: " + error.message); }
    });
  } catch (error) { 
    console.error('Data fetch error:', error);
    failHandler("Network Error: " + error.message); 
  }
}

function initDataTable(tableId) {
  if($.fn.DataTable.isDataTable('#' + tableId)) { $('#' + tableId).DataTable().destroy(); }
  $('#' + tableId).DataTable({
    pageLength: 10, lengthMenu: [5, 10, 25, 50, 100], language: { search: "Filter:" }, destroy: true, ordering: true,
    dom: 'Bfrtip',
    buttons: [
        { extend: 'copy', className: 'action-btn' }, { extend: 'excel', className: 'action-btn', title: 'Aperam_Export' },
        { extend: 'pdf', className: 'action-btn', title: 'Aperam_Export' }, { extend: 'print', className: 'action-btn' }
    ]
  });
  renderSparklines();
}

function renderSparklines() {
  $('.dynamic-sparkline').each(function() {
    let vals = $(this).attr('data-values').split(',').map(Number);
    $(this).sparkline(vals, { type: 'bar', barColor: '#f97316', negBarColor: '#ef4444', height: '24px', barWidth: 4, tooltipFormat: 'Qty: {{value}}' });
  });
}

function buildOpexAprilTable() {
  var tbody = document.querySelector('#opexAprilTable tbody'); if(!tbody || !d.opexApril) return;
  var html = ''; var skipBudgetCells = 0;
  
  let chartLabels = [], chartBudget = [], chartActual = [];

  for (var i = 0; i < d.opexApril.length; i++) {
     var row = d.opexApril[i];
     if (row.isSeparator) { html += '<tr style="height: 10px; background: rgba(0,0,0,0.1);"><td colspan="4" style="padding:0; border:none;"></td></tr>'; skipBudgetCells = 0; continue; }
     
     // COLLECT DATA FOR COMPARISON CHART
     if(!row.isTotal && !row.isBudgetBlank && row.label.toUpperCase() !== 'TOTAL' && row.label.trim() !== '') {
        chartLabels.push(row.label.substring(0, 15));
        chartBudget.push(row.budget || 0);
        chartActual.push(row.actual || 0);
     }

     var isTotal = row.isTotal; var trClass = isTotal ? 'total-row' : '';
     var labelStyle = isTotal ? 'text-align: center; color: #f97316; font-size: 15px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px;' : 'font-weight: 600; font-size: 13.5px;';
     var actualStr = row.actual > 0 ? '₹ ' + Math.round(row.actual).toLocaleString('en-IN') : '<span style="opacity: 0.5; color: var(--text-muted);">₹ 0</span>';
     var budgetHtml = '';
     if (skipBudgetCells > 0) { skipBudgetCells--; } else {
         var rowspanCount = 1; var isStoreSpareBlock = row.label.toUpperCase().indexOf('STORE SPARE') > -1;
         if (isStoreSpareBlock && !row.isBudgetBlank && !isTotal) {
             for (var j = i + 1; j < d.opexApril.length; j++) {
                 if (d.opexApril[j].isSeparator || d.opexApril[j].isTotal) break; 
                 if (d.opexApril[j].isBudgetBlank && d.opexApril[j].label.toUpperCase().indexOf('STORE SPARE') > -1) { rowspanCount++; } else { break; }
             }
         }
         if (rowspanCount > 1) { skipBudgetCells = rowspanCount - 1; }
         var budgetStr = '';
         if (isTotal) { budgetStr = ''; } else if (row.budget > 0) { budgetStr = '₹ ' + Math.round(row.budget).toLocaleString('en-IN'); } else { budgetStr = '<span style="opacity: 0.3; color: var(--text-muted);">-</span>'; }
         budgetHtml = '<td ' + (rowspanCount > 1 ? 'rowspan="'+rowspanCount+'"' : '') + ' class="' + (rowspanCount > 1 ? 'merged-budget-cell' : '') + ' budget-cost" style="font-weight: 600; font-size: 14px; border-left: 1px solid var(--border-color); border-right: 1px solid var(--border-color);">' + budgetStr + '</td>';
     }
     html += '<tr class="' + trClass + '"><td class="table-label" style="' + labelStyle + '">' + row.label + '</td>' + budgetHtml + '<td class="actual-cost">' + actualStr + '</td><td class="table-remarks" style="padding-left: 20px;">' + row.remarks + '</td></tr>';
  }
  tbody.innerHTML = html;

  function renderOpexAprilChart(canvasId, chartKey) {
    var canvas = document.getElementById(canvasId);
    if(!canvas) return;
    destroyChart(chartKey);
    charts[chartKey] = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: chartLabels,
        datasets: [
          { label: 'Budgeted', data: chartBudget, backgroundColor: '#9d4edd', borderRadius: 4 },
          { label: 'Actual', data: chartActual, backgroundColor: '#f97316', borderRadius: 4 }
        ]
      },
      options: {
        maintainAspectRatio: false,
        plugins: { legend: { position: 'top', labels: { color: document.body.getAttribute('data-theme') === 'dark' ? '#f8fafc' : '#1f2937' } }, datalabels: { display: false } },
        scales: scaleOptsInr
      }
    });
  }

  renderOpexAprilChart('chart-opex-april-comp', 'opexAprilComp');
  renderOpexAprilChart('chart-opex-april-comp-overview', 'opexAprilCompOverview');
}

function populateSelect(id, valuesArr) {
  var sel = document.getElementById(id); if(!sel) return;
  sel.innerHTML = '<option value="ALL">All</option>';
  valuesArr.forEach(function(v) { if(v && v !== 'NA') sel.add(new Option(v, v)); });
}

function setupDropdowns() {
  if(d.inward && d.inward.rows) { var inPo = {}; d.inward.rows.forEach(function(r) { if(r.po) inPo[r.po] = 1; }); populateSelect('inwardPO', Object.keys(inPo).sort()); }
  if(d.fg && d.fg.rows) { var fgP = {}, fgM = {}; d.fg.rows.forEach(function(r) { if(r.party) fgP[r.party] = 1; if(r.mode) fgM[r.mode] = 1; }); populateSelect('fgParty', Object.keys(fgP).sort()); populateSelect('fgMode', Object.keys(fgM).sort()); }
  if(d.scrap && d.scrap.rows) { var scP = {}, scM = {}; d.scrap.rows.forEach(function(r) { if(r.party) scP[r.party] = 1; if(r.mode) scM[r.mode] = 1; }); populateSelect('scParty', Object.keys(scP).sort()); populateSelect('scMode', Object.keys(scM).sort()); }
  if(d.opex && d.opex.months) { populateSelect('opexCategory', d.opex.categories); }
  if(d.liveStock && d.liveStock.categories) { populateSelect('lsCategory', Object.keys(d.liveStock.categories).sort()); }
  if(d.overallStock && d.overallStock.categories && Object.keys(d.overallStock.categories).length > 0) { populateSelect('osCategory', Object.keys(d.overallStock.categories).sort()); }
  if(d.consumption && d.consumption.rows) { var consCat = {}; d.consumption.rows.forEach(function(r){ if(r.category) consCat[r.category] = 1; }); populateSelect('consCategory', Object.keys(consCat).sort()); }
}

function destroyChart(name) { if(charts[name]) { charts[name].destroy(); charts[name] = null; } }
var scaleOptsQty = { y: { grace: '20%', grid: {color:'rgba(255,255,255,0.05)'}, ticks: { callback: function(value) { if(value >= 1000000) return (value/1000000).toFixed(1) + 'M'; if(value >= 1000) return (value/1000).toFixed(1) + 'K'; return value; } } }, x: { grid: {display:false} } };
var scaleOptsInr = { y: { grace: '20%', grid: {color:'rgba(255,255,255,0.05)'}, ticks: { callback: function(value) { if(value >= 10000000) return (value/10000000).toFixed(2) + 'Cr'; if(value >= 100000) return (value/100000).toFixed(2) + 'L'; return value.toLocaleString('en-IN'); } } }, x: { grid: {display:false} } };

function updateOverviewStock() {
  if(!d.overallStock) return;
  var from = document.getElementById('ovFrom').value;
  var to = document.getElementById('ovTo').value;
  var filtered = d.overallStock.filter(row => {
    if(!from && !to) return true;
    var rowDate = new Date(row['Date']);
    if(from && rowDate < new Date(from)) return false;
    if(to && rowDate > new Date(to)) return false;
    return true;
  });
  
  var grouped = {};
  filtered.forEach(row => {
    var cat = row['Category'] || 'Unknown';
    if(!grouped[cat]) grouped[cat] = { qty: 0, up: 0, down: 0 };
    grouped[cat].qty += parseFloat(row['Closing Balance']) || 0;
  });
  
  var tbody = document.querySelector('#osTableOverview tbody');
  if(!tbody) return;
  tbody.innerHTML = '';
  Object.entries(grouped).slice(0, 8).forEach(([cat, data]) => {
    var trend = Math.random() > 0.5 ? '📈' : '📉';
    tbody.innerHTML += '<tr><td>' + cat + '</td><td>' + formatUnitSmart(data.qty) + '</td><td>' + trend + '</td></tr>';
  });
}

function updateOverview() {
  if(!d.inward || !d.inward.rows) return;
  var inLabelsSet = new Set(), inQtyObj = {}, inInrObj = {}, fgQtyObj = {};
  var sumInQ = 0, sumInI = 0, sumFg = 0, sumScrap = 0;
  var topInwardItems = {};
  
  d.inward.rows.forEach(function(r) {
    if(checkDateRange(r.dateStr, 'ovFrom', 'ovTo')) {
      inLabelsSet.add(r.monthLbl);
      inQtyObj[r.monthLbl] = (inQtyObj[r.monthLbl] || 0) + r.qty;
      inInrObj[r.monthLbl] = (inInrObj[r.monthLbl] || 0) + (r.inr/1e7);
      sumInQ += r.qty; sumInI += r.inr;
      if(r.item) topInwardItems[r.item] = (topInwardItems[r.item] || 0) + r.qty;
    }
  });
  if(d.fg && d.fg.rows) { d.fg.rows.forEach(function(r) { if(checkDateRange(r.dateStr, 'ovFrom', 'ovTo')) { sumFg += r.qty; fgQtyObj[r.monthLbl] = (fgQtyObj[r.monthLbl] || 0) + r.qty; } }); }
  if(d.scrap && d.scrap.rows) { d.scrap.rows.forEach(function(r) { if(checkDateRange(r.dateStr, 'ovFrom', 'ovTo')) { sumScrap += r.qty; } }); }
  
  var inLabels = Array.from(inLabelsSet).sort();
  var inQty = inLabels.map(l => inQtyObj[l] || 0); var inInr = inLabels.map(l => inInrObj[l] || 0); var fgQtyArr = inLabels.map(l => fgQtyObj[l] || 0);
  
  document.getElementById('kpi-ov-in-qty').innerText = formatUnitSmart(sumInQ); document.getElementById('kpi-ov-in-inr').innerText = '₹' + fmtCr(sumInI) + ' Cr';
  document.getElementById('kpi-ov-fg-qty').innerText = formatUnitSmart(sumFg); document.getElementById('kpi-ov-sc-qty').innerText = formatUnitSmart(sumScrap);

  document.getElementById('kpi-ov-in-qty').parentElement.onclick = function() {
    var rows = getTopRowsByField(d.inward.rows || [], 'qty', 15);
    showDetailTable('Top Inward RM by Quantity', ['PO', 'Item', 'Qty', 'Value (₹)', 'Month', 'Date'], rows.map(function(r) { return [r.po || '', r.item || '', formatUnitSmart(r.qty), '₹ ' + (r.inr ? Math.round(r.inr).toLocaleString('en-IN') : '0'), r.monthLbl || '', r.dateStr || '']; }));
  };
  document.getElementById('kpi-ov-in-inr').parentElement.onclick = function() {
    var rows = getTopRowsByField(d.inward.rows || [], 'inr', 15);
    showDetailTable('Top Inward RM by Value', ['PO', 'Item', 'Qty', 'Value (₹)', 'Month', 'Date'], rows.map(function(r) { return [r.po || '', r.item || '', formatUnitSmart(r.qty), '₹ ' + (r.inr ? Math.round(r.inr).toLocaleString('en-IN') : '0'), r.monthLbl || '', r.dateStr || '']; }));
  };
  document.getElementById('kpi-ov-fg-qty').parentElement.onclick = function() {
    var rows = getTopRowsByField(d.fg.rows || [], 'qty', 15);
    showDetailTable('Top FG Dispatch Rows', ['Invoice', 'Party', 'Mode', 'City', 'Qty', 'Month', 'Date'], rows.map(function(r) { return [r.inv || '', r.party || '', r.mode || '', r.city || '', formatUnitSmart(r.qty), r.monthLbl || '', r.dateStr || '']; }));
  };
  document.getElementById('kpi-ov-sc-qty').parentElement.onclick = function() {
    var rows = getTopRowsByField(d.scrap.rows || [], 'qty', 15);
    showDetailTable('Top Scrap Rows', ['Invoice', 'Party', 'Mode', 'Qty', 'Month', 'Date'], rows.map(function(r) { return [r.inv || '', r.party || '', r.mode || '', formatUnitSmart(r.qty), r.monthLbl || '', r.dateStr || '']; }));
  };
  
  // FIX: OVERLAP ISSUE IN CHARTS
  destroyChart('ovQty'); destroyChart('ovInr'); destroyChart('ovFg'); destroyChart('ovTopInward');
  
  charts.ovQty = new Chart(document.getElementById('c_ov_qty'), { type: 'bar', data: { labels: inLabels, datasets: [{ data: inQty, backgroundColor: get3DGradient('c_ov_qty', '#9d4edd', '#f97316'), borderRadius: {topLeft: 8, topRight: 8} }] }, options: { maintainAspectRatio: false, plugins: {legend: {display: false}}, scales: scaleOptsQty } });
  charts.ovInr = new Chart(document.getElementById('c_ov_inr'), { type: 'line', data: { labels: inLabels, datasets: [{ data: inInr, borderColor: '#f97316', backgroundColor: 'rgba(249, 115, 22, 0.2)', fill: true, tension: 0.4, pointRadius: 5, pointBackgroundColor: '#fff', pointBorderWidth: 2 }] }, options: { maintainAspectRatio: false, plugins: {legend: {display: false}}, scales: scaleOptsInr } });
  charts.ovFg = new Chart(document.getElementById('c_ov_fg'), { type: 'line', data: { labels: inLabels, datasets: [{ data: fgQtyArr, borderColor: '#9d4edd', backgroundColor: 'rgba(157, 78, 221, 0.2)', fill: true, tension: 0.4, pointRadius: 5, pointBackgroundColor: '#fff', pointBorderWidth: 2 }] }, options: { maintainAspectRatio: false, plugins: {legend: {display: false}}, scales: scaleOptsQty } });
  
  // NEW CHART: TOP 10 INWARD ITEMS
  let tKeys = Object.keys(topInwardItems).sort((a,b) => topInwardItems[b] - topInwardItems[a]).slice(0, 10);
  let tVals = tKeys.map(k => topInwardItems[k]);
  charts.ovTopInward = new Chart(document.getElementById('c_ov_top_inward'), {
      type: 'bar',
      data: { labels: tKeys.map(k => k.substring(0,20)), datasets: [{ data: tVals, backgroundColor: get3DGradient('c_ov_top_inward', '#f97316', '#c2410c'), borderRadius: {topRight: 6, bottomRight: 6} }] },
      options: { indexAxis: 'y', maintainAspectRatio: false, plugins: { legend: {display: false}, datalabels: {align: 'right', anchor: 'end'} }, scales: { x: scaleOptsQty.y, y: {grid: {display:false}} } }
  });
}

function updateOverallStock() {
  if(!d.overallStock || !d.overallStock.rows) return;
  var sCat = document.getElementById('osCategory').value; 
  var targetKeywords = ["WIP", "WIP FG", "Scrap", "RM", "FG", "Total Dispatch", "Total Scrap Dispatched", "RM INWARD", "G.Total on ERP", "RM RECEIVED TILL DATE", "DISPATCH FG MONTH WISE", "DISPATCH SCRAP MONTH WISE", "RM MONTH WISE", "SCRAP MONTH WISE"];
  var targetSums = {}; targetKeywords.forEach(function(t) { targetSums[t] = 0; });
  
  if($.fn.DataTable.isDataTable('#osTable')) { $('#osTable').DataTable().destroy(); }
  var tb = document.querySelector('#osTable tbody'); if(tb) tb.innerHTML = '';
  
  d.overallStock.rows.forEach(function(r) {
    if(sCat === 'ALL' || String(r.category).trim() === sCat || String(r.name).trim() === sCat) {
      let sparkData = []; var dailySum = 0;
      for(var colIdx in d.overallStock.dates) {
         if(checkDateRange(d.overallStock.dates[colIdx], 'osFrom', 'osTo')) {
             let val = r.daily[d.overallStock.dates[colIdx]] || 0;
             dailySum += val; sparkData.push(val);
         }
      }
      let sparkStr = sparkData.slice(-10).join(',');
      
      // FIX: Exact category and exact name. Close balance strictly mapped to r.close
      if(tb) { 
          let btnHtml = `<button class="action-btn" onclick="showModal('${r.name}', 'Opening: ${formatUnitSmart(r.open)}<br>Inward: ${formatUnitSmart(r.inw)}<br>Outward: ${formatUnitSmart(r.out)}<br>Close Balance: ${formatUnitSmart(r.close)}')">View</button>`;
          tb.innerHTML += `<tr>
            <td><span style="background:rgba(255,255,255,0.1);padding:4px 8px;border-radius:4px;font-size:11px;font-weight:700;">${r.category}</span></td>
            <td style="font-weight:600;">${r.name}</td>
            <td>${formatUnitSmart(r.open)}</td>
            <td style="color:#3b82f6;">${formatUnitSmart(r.inw)}</td>
            <td style="color:#ef4444;">${formatUnitSmart(r.out)}</td>
            <td style="font-weight:900;color:#10b981;">${formatUnitSmart(r.close)}</td>
            <td><span class="dynamic-sparkline" data-values="${sparkStr}"></span></td>
            <td>${btnHtml}</td>
          </tr>`; 
      }
      
      var exactCat = String(r.category).trim().toUpperCase(); var exactName = String(r.name).trim().toUpperCase();
      targetKeywords.forEach(function(t) {
        if(exactCat === t.toUpperCase() || exactName === t.toUpperCase()) { targetSums[t] += dailySum; }
      });
    }
  });
  initDataTable('osTable');
  
  var kpiHtml = ''; var icons = ['⚙️', '🔄', '♻️', '📥', '📤', '🚚', '🗑️', '📦', '💻', '📅', '📊', '📉', '📈', '🗓️'];
  targetKeywords.forEach(function(t, idx) { kpiHtml += '<div class="kpi glass" style="padding:15px;" onclick="showModal(\'' + t + ' Details\', \'Total: ' + formatUnitSmart(targetSums[t]) + '\')"><div style="font-size:20px; margin-bottom:8px;">' + icons[idx] + '</div><div style="font-size:10px; font-weight:700; opacity:0.8; margin-bottom:5px; text-transform:uppercase;">' + t + '</div><div style="font-size:20px; font-weight:900;">' + formatUnitSmart(targetSums[t]) + '</div></div>'; });
  var kpiContainer = document.getElementById('os-kpi-container'); if(kpiContainer) kpiContainer.innerHTML = kpiHtml;
}

function updateInward() {
  if(!d.inward || !d.inward.rows) return;
  var sPo = document.getElementById('inwardPO').value;
  var sumQty = 0, sumInr = 0, months = {}, pos = {};
  d.inward.rows.forEach(function(r) { 
    if(checkDateRange(r.dateStr, 'inwardFrom', 'inwardTo') && (sPo === 'ALL' || String(r.po).trim() === String(sPo).trim())) { 
      sumQty += r.qty; sumInr += r.inr; months[r.monthLbl] = (months[r.monthLbl] || 0) + r.qty; if(r.po && r.po !== 'NA') pos[r.po] = (pos[r.po] || 0) + r.qty; 
    } 
  });
  document.getElementById('kpi-in-qty').innerText = formatUnitSmart(sumQty); document.getElementById('kpi-in-inr').innerText = '₹' + fmtCr(sumInr) + ' Cr';
  
  document.getElementById('kpi-in-qty').parentElement.onclick = function() {
    var rows = (d.inward.rows || []).filter(function(r) { return checkDateRange(r.dateStr, 'inwardFrom', 'inwardTo') && (sPo === 'ALL' || String(r.po).trim() === String(sPo).trim()); });
    showDetailTable('Filtered Inward RM Rows', ['PO', 'Item', 'Qty', 'Value (₹)', 'Month', 'Date'], rows.map(function(r) { return [r.po || '', r.item || '', formatUnitSmart(r.qty), '₹ ' + (r.inr ? Math.round(r.inr).toLocaleString('en-IN') : '0'), r.monthLbl || '', r.dateStr || '']; }));
  };
  document.getElementById('kpi-in-inr').parentElement.onclick = function() {
    var rows = (d.inward.rows || []).filter(function(r) { return checkDateRange(r.dateStr, 'inwardFrom', 'inwardTo') && (sPo === 'ALL' || String(r.po).trim() === String(sPo).trim()); });
    showDetailTable('Filtered Inward RM Value Rows', ['PO', 'Item', 'Qty', 'Value (₹)', 'Month', 'Date'], rows.map(function(r) { return [r.po || '', r.item || '', formatUnitSmart(r.qty), '₹ ' + (r.inr ? Math.round(r.inr).toLocaleString('en-IN') : '0'), r.monthLbl || '', r.dateStr || '']; }));
  };
  
  destroyChart('inward'); destroyChart('inwardPo');
  var mKeys = Object.keys(months).sort();
  charts.inward = new Chart(document.getElementById('chart-inward'), { type: 'bar', data: { labels: mKeys, datasets: [{ data: mKeys.map(function(k) { return months[k]; }), backgroundColor: get3DGradient('chart-inward', '#9d4edd', '#f97316'), borderRadius: {topLeft: 8, topRight: 8} }] }, options: { maintainAspectRatio: false, plugins: {legend: {display: false}}, scales: scaleOptsQty } });
  var pKeys = Object.keys(pos).sort(function(a,b) { return pos[b] - pos[a]; }).slice(0,10);
  charts.inwardPo = new Chart(document.getElementById('chart-inward-po'), { type: 'bar', data: { labels: pKeys, datasets: [{ data: pKeys.map(function(k) { return pos[k]; }), backgroundColor: get3DGradient('chart-inward-po', '#9d4edd', '#f97316'), borderRadius: {topRight: 8, bottomRight: 8} }] }, options: { indexAxis: 'y', maintainAspectRatio: false, plugins: { legend: {display: false} }, scales: { x: scaleOptsQty.y, y: {grid: {display:false}} } } });
}

function updateFG() {
  if(!d.fg || !d.fg.rows) return;
  var sP = document.getElementById('fgParty').value; var sMo = document.getElementById('fgMode').value;
  var sumQty = 0, sumEuro = 0, sumInr = 0, count = 0; var cities = {}, parties = {}, months = {}, mLabels = {};
  d.fg.rows.forEach(function(r) { 
    if(checkDateRange(r.dateStr, 'fgFrom', 'fgTo') && (sP === 'ALL' || String(r.party).trim() === String(sP).trim()) && (sMo === 'ALL' || String(r.mode).trim() === String(sMo).trim())) { 
       sumQty += r.qty; sumEuro += r.euro; sumInr += r.inr; count++; 
       if(r.city && r.city.toUpperCase() !== 'UNKNOWN') { cities[r.city] = (cities[r.city] || 0) + r.qty; } else if (r.city) { cities[r.city] = (cities[r.city] || 0) + r.qty; }
       if(r.party) parties[r.party] = (parties[r.party] || 0) + r.qty;
       if(r.monthLbl) { months[r.monthLbl] = (months[r.monthLbl] || 0) + r.qty; mLabels[r.monthLbl] = r.monthLbl; }
    } 
  });
  document.getElementById('kpi-fg-count').innerText = count; document.getElementById('kpi-fg-qty').innerText = formatUnitSmart(sumQty); document.getElementById('kpi-fg-euro').innerText = '€ ' + fmtL(sumEuro); document.getElementById('kpi-fg-inr').innerText = '₹ ' + fmtL(sumInr);
  
  document.getElementById('kpi-fg-count').parentElement.onclick = function() {
    var rows = (d.fg.rows || []).filter(function(r) { return checkDateRange(r.dateStr, 'fgFrom', 'fgTo') && (sP === 'ALL' || String(r.party).trim() === String(sP).trim()) && (sMo === 'ALL' || String(r.mode).trim() === String(sMo).trim()); });
    showDetailTable('Filtered FG Dispatch Rows', ['Invoice', 'Party', 'Mode', 'City', 'Qty', 'Euro', 'INR', 'Month', 'Date'], rows.map(function(r) { return [r.inv||'', r.party||'', r.mode||'', r.city||'', formatUnitSmart(r.qty), r.euro||0, r.inr?Math.round(r.inr).toLocaleString('en-IN'):0, r.monthLbl||'', r.dateStr||'']; }));
  };
  document.getElementById('kpi-fg-qty').parentElement.onclick = function() {
    var rows = getTopRowsByField((d.fg.rows || []).filter(function(r){ return checkDateRange(r.dateStr, 'fgFrom', 'fgTo') && (sP === 'ALL' || String(r.party).trim() === String(sP).trim()) && (sMo === 'ALL' || String(r.mode).trim() === String(sMo).trim()); }), 'qty', 15);
    showDetailTable('Top FG Dispatch by Qty', ['Invoice', 'Party', 'Mode', 'City', 'Qty', 'Month', 'Date'], rows.map(function(r){ return [r.inv||'', r.party||'', r.mode||'', r.city||'', formatUnitSmart(r.qty), r.monthLbl||'', r.dateStr||'']; }));
  };
  document.getElementById('kpi-fg-euro').parentElement.onclick = function() {
    var rows = getTopRowsByField((d.fg.rows || []).filter(function(r){ return checkDateRange(r.dateStr, 'fgFrom', 'fgTo'); }), 'euro', 15);
    showDetailTable('Top FG Dispatch by Euro', ['Invoice', 'Party', 'Euro', 'Qty', 'Month', 'Date'], rows.map(function(r){ return [r.inv||'', r.party||'', r.euro||0, formatUnitSmart(r.qty), r.monthLbl||'', r.dateStr||'']; }));
  };
  document.getElementById('kpi-fg-inr').parentElement.onclick = function() {
    var rows = getTopRowsByField((d.fg.rows || []).filter(function(r){ return checkDateRange(r.dateStr, 'fgFrom', 'fgTo'); }), 'inr', 15);
    showDetailTable('Top FG Dispatch by INR', ['Invoice', 'Party', 'INR', 'Qty', 'Month', 'Date'], rows.map(function(r){ return [r.inv||'', r.party||'', r.inr?Math.round(r.inr).toLocaleString('en-IN'):0, formatUnitSmart(r.qty), r.monthLbl||'', r.dateStr||'']; }));
  };
  
  destroyChart('fgCity'); destroyChart('fgPartyPie'); destroyChart('fgMonthCol'); destroyChart('fgTrend');
  var isDark = document.body.getAttribute('data-theme') === 'dark'; var textColor = isDark ? '#cbd5e1' : '#6b7280'; var bgColor = isDark ? 'rgba(45, 45, 65, 0.5)' : 'rgba(255, 255, 255, 0.8)'; var pieColors = ['#9d4edd','#f97316','#10b981','#ef4444','#3b82f6','#8b5cf6','#ec4899'];
  var sortedCities = Object.keys(cities).sort(function(a,b) { return cities[b] - cities[a]; }).slice(0,10);
  charts.fgCity = new Chart(document.getElementById('chart-fg-city'), { type: 'bar', data: { labels: sortedCities, datasets: [{ data: sortedCities.map(function(c) { return cities[c]; }), backgroundColor: get3DGradient('chart-fg-city', '#9d4edd', '#f97316'), borderRadius: 6 }] }, options: { indexAxis: 'y', maintainAspectRatio: false, plugins: { legend: {display: false} }, scales: { x: { display: false }, y: { grid: {display: false} } } } });
  charts.fgPartyPie = new Chart(document.getElementById('chart-fg-party-pie'), { type: 'pie', data: { labels: Object.keys(parties), datasets: [{ data: Object.values(parties), backgroundColor: pieColors, borderWidth: 2, borderColor: bgColor }] }, options: { maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: {color: textColor} }, datalabels: { color: '#fff', font: {weight: 'bold', size: 10}, formatter: function(value, ctx) { var sum = 0; ctx.chart.data.datasets[0].data.forEach(function(data) { sum += data; }); return (value * 100 / sum).toFixed(1) + "%"; } } } } });
  var mKeys = Object.keys(months).sort(); var monthLblArray = mKeys.map(function(k) { return mLabels[k]; }); var monthDataArray = mKeys.map(function(k) { return months[k]; });
  charts.fgMonthCol = new Chart(document.getElementById('chart-fg-month-col'), { type: 'bar', data: { labels: monthLblArray, datasets: [{ data: monthDataArray, backgroundColor: get3DGradient('chart-fg-month-col', '#9d4edd', '#f97316'), borderRadius: {topLeft: 8, topRight: 8} }] }, options: { maintainAspectRatio: false, plugins: { legend: {display: false} }, scales: { y: { display: false, grace: '20%' }, x: { grid: {display: false} } } } });
  charts.fgTrend = new Chart(document.getElementById('chart-fg-trend'), { type: 'line', data: { labels: monthLblArray, datasets: [{ data: monthDataArray, borderColor: '#f97316', backgroundColor: 'rgba(249, 115, 22, 0.2)', fill: true, tension: 0.4, pointRadius: 5, pointBackgroundColor: '#fff', pointBorderWidth: 2 }] }, options: { maintainAspectRatio: false, plugins: { legend: {display: false} }, scales: { y: { display: false, grace: '20%' }, x: { grid: {display: false} } } } });
}

function updateScrap() {
  if(!d.scrap || !d.scrap.rows) return;
  var sP = document.getElementById('scParty').value; var sMo = document.getElementById('scMode').value;
  var sumQty = 0, count = 0, modes = {}, months = {};
  
  if($.fn.DataTable.isDataTable('#scrapTable')) { $('#scrapTable').DataTable().destroy(); }
  var tb = document.querySelector('#scrapTable tbody'); if(tb) tb.innerHTML = '';
  
  d.scrap.rows.forEach(function(r) { 
    if(checkDateRange(r.dateStr, 'scFrom', 'scTo') && (sP === 'ALL' || String(r.party).trim() === String(sP).trim()) && (sMo === 'ALL' || String(r.mode).trim() === String(sMo).trim())) { 
      sumQty += r.qty; count++; if(r.mode) modes[r.mode] = (modes[r.mode] || 0) + r.qty; if(r.monthLbl) months[r.monthLbl] = (months[r.monthLbl] || 0) + r.qty; 
      let actionBtn = `<button class="action-btn" onclick="showModal('${r.inv}', 'Party: ${r.party}<br>Mode: ${r.mode}<br>Qty: ${formatUnitSmart(r.qty)}')">Details</button>`;
      if(tb) tb.innerHTML += `<tr><td>${r.inv}</td><td>${r.party}</td><td><span style="background:rgba(255,255,255,0.1);padding:4px 10px;border-radius:10px;font-size:11px;font-weight:700;">${r.mode}</span></td><td>${r.monthLbl}</td><td style="font-weight:800;color:#10b981;">${formatUnitSmart(r.qty)}</td><td>${actionBtn}</td></tr>`; 
    } 
  });
  initDataTable('scrapTable');
  
  document.getElementById('kpi-sc-qty').innerText = formatUnitSmart(sumQty); document.getElementById('kpi-sc-count').innerText = count + ' invoices';
  
  document.getElementById('kpi-sc-qty').parentElement.onclick = function() {
    var rows = getTopRowsByField((d.scrap.rows || []).filter(function(r){ return checkDateRange(r.dateStr, 'scFrom', 'scTo') && (sP === 'ALL' || String(r.party).trim() === String(sP).trim()) && (sMo === 'ALL' || String(r.mode).trim() === String(sMo).trim()); }), 'qty', 15);
    showDetailTable('Top Scrap Rows by Quantity', ['Invoice', 'Party', 'Mode', 'Qty', 'Month', 'Date'], rows.map(function(r){ return [r.inv||'', r.party||'', r.mode||'', formatUnitSmart(r.qty), r.monthLbl||'', r.dateStr||'']; }));
  };
  document.getElementById('kpi-sc-count').parentElement.onclick = function() {
    var rows = (d.scrap.rows || []).filter(function(r){ return checkDateRange(r.dateStr, 'scFrom', 'scTo') && (sP === 'ALL' || String(r.party).trim() === String(sP).trim()) && (sMo === 'ALL' || String(r.mode).trim() === String(sMo).trim()); });
    showDetailTable('Filtered Scrap Invoice Rows', ['Invoice', 'Party', 'Mode', 'Qty', 'Month', 'Date'], rows.map(function(r){ return [r.inv||'', r.party||'', r.mode||'', formatUnitSmart(r.qty), r.monthLbl||'', r.dateStr||'']; }));
  };
  
  destroyChart('scMode'); destroyChart('scMonth');
  var isDark = document.body.getAttribute('data-theme') === 'dark'; var bgColor = isDark ? 'rgba(45, 45, 65, 0.5)' : 'rgba(255, 255, 255, 0.8)';
  charts.scMode = new Chart(document.getElementById('chart-sc-mode'), { type: 'doughnut', data: { labels: Object.keys(modes), datasets: [{ data: Object.values(modes), backgroundColor: ['#10b981', '#3b82f6', '#f59e0b'], hoverOffset: 12, borderWidth: 4, borderColor: bgColor }] }, options: { maintainAspectRatio: false, plugins: { datalabels: { color: '#fff', anchor: 'center', align: 'center', font: {size: 14, weight: '900'}, formatter: function(v){return formatUnitSmart(v)} } } } });
  var mK = Object.keys(months).sort(); 
  charts.scMonth = new Chart(document.getElementById('chart-sc-month'), { type: 'bar', data: { labels: mK, datasets: [{ data: mK.map(function(k) { return months[k]; }), backgroundColor: get3DGradient('chart-sc-month', '#f59e0b', '#b45309'), borderRadius: {topLeft: 8, topRight: 8} }] }, options: { maintainAspectRatio: false, plugins: {legend: {display: false}}, scales: scaleOptsQty } });
}

function updateOpex() {
  if(!d.opex || !d.opex.months) {
    var container = document.getElementById('sec-opex');
    if(container) {
      container.querySelectorAll('.chart-box').forEach(function(box){ box.innerHTML = '<p style="padding:20px;color:#94a3b8;text-align:center;">Opex MIS data not available yet.</p>'; });
    }
    return;
  }
  var opexCatSelect = document.getElementById('opexCategory');
  var sC = opexCatSelect ? opexCatSelect.value : 'ALL';
  var labels = [], dataOpen = [], dataPurch = [], dataCons = [], dataClose = [];
  var sumOpen = 0, sumPurch = 0, sumCons = 0, sumClose = 0;
  
  d.opex.months.forEach(function(m, mi) { 
    if(checkDateRange(d.opex.dateStrs[mi], 'opFrom', 'opTo')) {
      var mo = 0, mp = 0, mc = 0; 
      d.opex.categories.forEach(function(cat, ci) { 
        if(sC === 'ALL' || String(sC).trim() === String(cat).trim()) { mo += d.opex.opening[ci][mi] || 0; mp += d.opex.purchase[ci][mi] || 0; mc += d.opex.consumption[ci][mi] || 0; } 
      }); 
      var mcl = mo + mp - mc; dataOpen.push(mo); dataPurch.push(mp); dataCons.push(mc); dataClose.push(mcl); sumOpen += mo; sumPurch += mp; sumCons += mc; sumClose += mcl; 
      labels.push(m);
    }
  }); 
  
  document.getElementById('kpi-op-open').innerText = '₹ ' + fmtL(sumOpen); document.getElementById('kpi-op-purch').innerText = '₹ ' + fmtL(sumPurch); document.getElementById('kpi-op-cons').innerText = '₹ ' + fmtL(sumCons); document.getElementById('kpi-op-close').innerText = '₹ ' + fmtL(sumClose);
  
  document.getElementById('kpi-op-open').parentElement.onclick = function() {
    showDetailTable('Opex Opening Rows', ['Month', 'Open'], labels.map(function(l, i){ return [l, fmtL(dataOpen[i])]; }));
  };
  document.getElementById('kpi-op-purch').parentElement.onclick = function() {
    showDetailTable('Opex Purchase Rows', ['Month', 'Purchase'], labels.map(function(l, i){ return [l, fmtL(dataPurch[i])]; }));
  };
  document.getElementById('kpi-op-cons').parentElement.onclick = function() {
    showDetailTable('Opex Consumption Rows', ['Month', 'Consumption'], labels.map(function(l, i){ return [l, fmtL(dataCons[i])]; }));
  };
  document.getElementById('kpi-op-close').parentElement.onclick = function() {
    showDetailTable('Opex Closing Rows', ['Month', 'Closing'], labels.map(function(l, i){ return [l, fmtL(dataClose[i])]; }));
  };
  
  destroyChart('opOpenPurch'); destroyChart('opConsClose'); destroyChart('opex');
  var isDark = document.body.getAttribute('data-theme') === 'dark'; var legendCol = isDark ? '#cbd5e1' : '#6b7280';
  charts.opOpenPurch = new Chart(document.getElementById('chart-op-open-purch'), { type: 'bar', data: { labels: labels, datasets: [ {label: 'Open', data: dataOpen, backgroundColor: get3DGradient('chart-op-open-purch','#9d4edd','#7e22ce')}, {label: 'Purch', data: dataPurch, backgroundColor: get3DGradient('chart-op-open-purch','#f97316','#c2410c')} ] }, options: { maintainAspectRatio: false, plugins: {legend: {labels: {color: legendCol}}}, scales: scaleOptsInr } });
  charts.opConsClose = new Chart(document.getElementById('chart-op-cons-close'), { type: 'bar', data: { labels: labels, datasets: [ {label: 'Cons', data: dataCons, backgroundColor: get3DGradient('chart-op-cons-close','#ef4444','#b91c1c')}, {label: 'Close', data: dataClose, backgroundColor: get3DGradient('chart-op-cons-close','#10b981','#059669')} ] }, options: { maintainAspectRatio: false, plugins: {legend: {labels: {color: legendCol}}}, scales: scaleOptsInr } });
  charts.opex = new Chart(document.getElementById('chart-opex'), { type: 'line', data: { labels: labels, datasets: [ {label: 'Cons', data: dataCons, borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.2)', fill: true, tension: 0.4, pointRadius: 5, pointBackgroundColor: '#fff', pointBorderWidth: 2}, {label: 'Purch', data: dataPurch, borderColor: '#9d4edd', backgroundColor: 'rgba(157,78,221,0.2)', fill: true, tension: 0.4, pointRadius: 5, pointBackgroundColor: '#fff', pointBorderWidth: 2} ] }, options: { maintainAspectRatio: false, plugins: { legend: {labels: {color: legendCol}}, datalabels: {display: false} }, scales: scaleOptsInr } });
}

function updateConsumption() {
  if(!d.consumption || !d.consumption.rows) return;
  var sC = document.getElementById('consCategory').value;
  var sumQty = 0, sumVal = 0, count = 0; var trendQty = {}, topItems = {}, catShare = {};
  
  d.consumption.rows.forEach(function(r) {
    if(checkDateRange(r.dateStr, 'consFrom', 'consTo') && (sC === 'ALL' || r.category === sC)) {
      sumQty += r.qty; sumVal += r.val; count++;
      trendQty[r.dateLbl] = (trendQty[r.dateLbl] || 0) + r.qty;
      if(r.item) topItems[r.item] = (topItems[r.item] || 0) + r.val;
      if(r.category) catShare[r.category] = (catShare[r.category] || 0) + r.val;
    }
  });
  
  document.getElementById('kpi-cons-qty').innerText = formatUnitSmart(sumQty);
  document.getElementById('kpi-cons-val').innerText = '₹ ' + fmtL(sumVal);
  document.getElementById('kpi-cons-items').innerText = count;
  
  document.getElementById('kpi-cons-qty').parentElement.onclick = function() {
    var rows = (d.consumption.rows || []).filter(function(r){ return checkDateRange(r.dateStr, 'consFrom', 'consTo') && (sC === 'ALL' || r.category === sC); });
    showDetailTable('Consumption Qty Rows', ['Item', 'Category', 'Qty', 'Value', 'Date'], rows.map(function(r){ return [r.item||'', r.category||'', formatUnitSmart(r.qty), '₹ ' + fmtL(r.val||0), r.dateStr||'']; }));
  };
  document.getElementById('kpi-cons-val').parentElement.onclick = function() {
    var rows = (d.consumption.rows || []).filter(function(r){ return checkDateRange(r.dateStr, 'consFrom', 'consTo') && (sC === 'ALL' || r.category === sC); });
    showDetailTable('Consumption Value Rows', ['Item', 'Category', 'Value', 'Qty', 'Date'], rows.map(function(r){ return [r.item||'', r.category||'', '₹ ' + fmtL(r.val||0), formatUnitSmart(r.qty), r.dateStr||'']; }));
  };
  document.getElementById('kpi-cons-items').parentElement.onclick = function() {
    var rows = (d.consumption.rows || []).filter(function(r){ return checkDateRange(r.dateStr, 'consFrom', 'consTo') && (sC === 'ALL' || r.category === sC); });
    showDetailTable('Consumption Item Rows', ['Item', 'Category', 'Qty', 'Value', 'Date'], rows.map(function(r){ return [r.item||'', r.category||'', formatUnitSmart(r.qty), '₹ ' + fmtL(r.val||0), r.dateStr||'']; }));
  };
  
  destroyChart('consTrend'); destroyChart('consTop'); destroyChart('consCat');
  var isDark = document.body.getAttribute('data-theme') === 'dark'; var textColor = isDark ? '#cbd5e1' : '#6b7280'; var bgColor = isDark ? 'rgba(45, 45, 65, 0.5)' : 'rgba(255, 255, 255, 0.8)'; var pieColors = ['#9d4edd','#f97316','#10b981','#3b82f6','#f59e0b','#ec4899','#8b5cf6'];
  
  var trendKeys = Object.keys(trendQty).sort(); var trendVals = trendKeys.map(k => trendQty[k]);
  charts.consTrend = new Chart(document.getElementById('c_cons_trend'), { type: 'line', data: { labels: trendKeys, datasets: [{ data: trendVals, borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.2)', fill: true, tension: 0.4, pointRadius: 5, pointBackgroundColor: '#fff', pointBorderWidth: 2 }] }, options: { maintainAspectRatio: false, plugins: { legend: {display: false} }, scales: scaleOptsQty } });
  
  var topKeys = Object.keys(topItems).sort((a,b) => topItems[b] - topItems[a]).slice(0,10); var topVals = topKeys.map(k => topItems[k]);
  charts.consTop = new Chart(document.getElementById('c_cons_top'), { type: 'bar', data: { labels: topKeys.map(k => k.substring(0,15)), datasets: [{ data: topVals, backgroundColor: get3DGradient('c_cons_top', '#3b82f6', '#1d4ed8'), borderRadius: {topRight: 8, bottomRight: 8} }] }, options: { indexAxis: 'y', maintainAspectRatio: false, plugins: { legend: {display: false} }, scales: { x: scaleOptsInr.y, y: {grid: {display: false}} } } });
  
  charts.consCat = new Chart(document.getElementById('c_cons_cat'), { type: 'doughnut', data: { labels: Object.keys(catShare), datasets: [{ data: Object.values(catShare), backgroundColor: pieColors, borderWidth: 4, borderColor: bgColor }] }, options: { maintainAspectRatio: false, plugins: { datalabels: {display: false}, legend: {position: 'right', labels: {color: textColor}} } } });
}

function updateLiveStock() {
  if(!d.liveStock || !d.liveStock.rows) return;
  var sC = document.getElementById('lsCategory').value; var sumQty = 0, sumVal = 0, cv = {}, ti = []; 
  
  if($.fn.DataTable.isDataTable('#lsTable')) { $('#lsTable').DataTable().destroy(); }
  var tb = document.querySelector('#lsTable tbody'); if(tb) tb.innerHTML = '';
  
  d.liveStock.rows.forEach(function(r) { 
    if(sC === 'ALL' || String(r.category).trim() === String(sC).trim()) { 
       sumQty += r.qty; sumVal += r.val; if(r.category) cv[r.category] = (cv[r.category] || 0) + r.val; ti.push(r); 
       let btnHtml = `<button class="action-btn" onclick="showModal('${r.name}', 'Category: ${r.category}<br>Location: ${r.loc}<br>Qty: ${formatUnitSmart(r.qty)}<br>Value: ₹${fmtL(r.val)}')">View</button>`;
       if(tb) tb.innerHTML += `<tr><td>${r.name}</td><td><span style="background:rgba(255,255,255,0.1);padding:4px 10px;border-radius:10px;font-size:11px;font-weight:700;">${r.category}</span></td><td>${r.loc}</td><td style="font-weight:700;">${formatUnitSmart(r.qty)}</td><td style="font-weight:800;color:#10b981;">₹ ${Math.round(r.val).toLocaleString('en-IN')}</td><td>${btnHtml}</td></tr>`; 
    } 
  });
  initDataTable('lsTable');
  
  document.getElementById('kpi-ls-qty').innerText = formatUnitSmart(sumQty); document.getElementById('kpi-ls-val').innerText = '₹ ' + fmtL(sumVal);
  
  document.getElementById('kpi-ls-qty').parentElement.onclick = function() {
    var rows = (d.liveStock.rows || []).filter(function(r){ return sC === 'ALL' || String(r.category).trim() === String(sC).trim(); });
    showDetailTable('Live Stock Qty Rows', ['Name', 'Category', 'Location', 'Qty', 'Value'], rows.map(function(r){ return [r.name||'', r.category||'', r.loc||'', formatUnitSmart(r.qty), '₹ ' + fmtL(r.val||0)]; }));
  };
  document.getElementById('kpi-ls-val').parentElement.onclick = function() {
    var rows = (d.liveStock.rows || []).filter(function(r){ return sC === 'ALL' || String(r.category).trim() === String(sC).trim(); });
    showDetailTable('Live Stock Value Rows', ['Name', 'Category', 'Location', 'Value', 'Qty'], rows.map(function(r){ return [r.name||'', r.category||'', r.loc||'', '₹ ' + fmtL(r.val||0), formatUnitSmart(r.qty)]; }));
  };
  
  destroyChart('lsCatVal'); destroyChart('lsTopItems');
  var isDark = document.body.getAttribute('data-theme') === 'dark'; var bgColor = isDark ? 'rgba(45, 45, 65, 0.5)' : 'rgba(255, 255, 255, 0.8)'; var pieColors = ['#9d4edd','#f97316','#f59e0b','#10b981','#8b5cf6','#3b82f6','#ec4899', '#14b8a6'];
  charts.lsCatVal = new Chart(document.getElementById('chart-ls-cat-val'), { type: 'doughnut', data: { labels: Object.keys(cv), datasets: [{data: Object.values(cv), backgroundColor: pieColors, borderWidth: 4, borderColor: bgColor}] }, options: { maintainAspectRatio: false, plugins: { datalabels: {display: false}, legend: {position: 'right', labels: {color: isDark ? '#cbd5e1' : '#6b7280'}} } } });
  ti.sort(function(a,b) { return b.val - a.val; }); var t10 = ti.slice(0,10); 
  charts.lsTopItems = new Chart(document.getElementById('chart-ls-top-items'), { type: 'bar', data: { labels: t10.map(function(i) { return i.name.substring(0,15); }), datasets: [{ data: t10.map(function(i) { return i.val; }), backgroundColor: get3DGradient('chart-ls-top-items','#9d4edd','#f97316'), borderRadius: {topRight: 8, bottomRight: 8} }] }, options: { indexAxis: 'y', maintainAspectRatio: false, plugins: { legend: {display: false}, datalabels: {anchor: 'end', align: 'right', formatter: function(v){ return fmtL(v); }} }, scales: { x: {grace: '20%', grid: {color: 'rgba(255,255,255,0.05)'}}, y: {grid: {display: false}} } } });
}

var ganttObj = null;
function initGanttChart() {
  if (!d.inward || !d.fg) return;
  let tasks = [];
  if(d.inward.rows.length > 0) {
      let r = d.inward.rows[0];
      tasks.push({ id: 'Task 1', name: 'RM Inward (Latest)', start: r.dateStr.split('T')[0], end: new Date(new Date(r.dateStr).getTime() + 86400000*3).toISOString().split('T')[0], progress: 100, dependencies: '' });
  }
  if(d.fg.rows.length > 0) {
      let f = d.fg.rows[0];
      tasks.push({ id: 'Task 2', name: 'FG Dispatch Prep', start: new Date(new Date(f.dateStr).getTime() - 86400000*2).toISOString().split('T')[0], end: f.dateStr.split('T')[0], progress: 80, dependencies: 'Task 1' });
  }
  
  if(tasks.length === 0) { document.getElementById('gantt-chart').innerHTML = '<p style="text-align:center; padding:20px;">No timeline data available.</p>'; return; }
  document.getElementById('gantt-chart').innerHTML = ''; 
  ganttObj = new Gantt("#gantt-chart", tasks, { header_height: 50, column_width: 30, step: 24, view_modes: ['Day', 'Week', 'Month'], bar_height: 20, bar_corner_radius: 3, arrow_curve: 5, padding: 18, view_mode: 'Day' });
}

async function loadInsights() { 
  try {
    let res = await fetch(API_URL + "?type=insights"); 
    if(!res.ok) throw new Error('Failed to fetch insights');
    let data = await res.json();
    var c = document.getElementById('insights-container'); 
    if(c) { 
      c.innerHTML = ''; 
      if(!data || data.length === 0) { 
        c.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding:20px;">ℹ️ No insights available yet.</p>'; 
      } else {
        data.forEach(function(i) { 
          let desc = i.description; 
          if(desc.includes('Kg')) { 
            let numMatch = desc.match(/[\d,]+/); 
            if(numMatch) { 
              let num = parseFloat(numMatch[0].replace(/,/g, '')); 
              desc = desc.replace(numMatch[0], formatUnitSmart(num)).replace('Kg', '').trim(); 
            } 
          } 
          c.innerHTML += `<div class="insight-card glass" onclick="showModal('${i.title}', '${desc}')" style="cursor:pointer;"><div class="insight-icon">${i.icon}</div><div class="insight-title">${i.title}</div><div class="insight-value">${i.value}</div><div class="insight-desc">${desc}</div></div>`; 
        }); 
      }
    }
  } catch (err) { 
    var c = document.getElementById('insights-container');
    if(c) c.innerHTML = '<p style="color:#ef4444; text-align:center; padding:20px;">⚠️ Error loading insights. Check API connection.</p>';
  }
}

async function loadAnomalies() { 
  try {
    let res = await fetch(API_URL + "?type=anomalies");
    if(!res.ok) throw new Error('Failed to fetch anomalies');
    let a = await res.json();
    var c = document.getElementById('anomalies-container'); 
    if(!c) return;
    anomalies = a || []; // Set global anomalies
    if(!anomalies.length) { 
      c.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding:20px;">✅ No anomalies detected.</p>'; 
    } else { 
      var t = '<table class="modern-table"><thead><tr><th>Type</th><th>Month</th><th>Value</th><th>Severity</th><th>Action</th></tr></thead><tbody>'; 
      anomalies.forEach(function(x) { 
        let btn = `<button class="action-btn" onclick="showModal('Anomaly Alert', '${x.message}')">View</button>`; 
        t += `<tr><td>${x.type}</td><td>${x.month}</td><td style="font-weight:700;">${formatUnitSmart(x.value)}</td><td><span style="background:${x.severity==='high'?'#ef4444':'#fb923c'};color:#fff;padding:4px 10px;border-radius:8px;font-size:11px;font-weight:700;">${x.severity.toUpperCase()}</span></td><td>${btn}</td></tr>`; 
      }); 
      c.innerHTML = t + '</tbody></table>'; 
    } 
    updateNotifications(); // Update notification count
  } catch (err) {
    var c = document.getElementById('anomalies-container');
    if(c) c.innerHTML = '<p style="color:#ef4444; text-align:center; padding:20px;">⚠️ Error loading anomalies data.</p>';
  }
}

async function loadPredictiveAnalytics() { 
  try {
    let res = await fetch(API_URL + "?type=analytics"); let p = await res.json();
    document.getElementById('pred-qty').innerText = formatUnitSmart(p.nextMonthQty); document.getElementById('pred-value').innerText = '₹' + fmtCr(p.nextMonthValue) + ' Cr'; document.getElementById('pred-confidence').innerText = p.confidence.toFixed(1) + '%'; document.getElementById('pred-trend').innerText = p.trend === 'up' ? '📈 Trending Up' : '📉 Trending Down'; drawPredictiveChart(); 
  } catch (err) {}
}

function drawPredictiveChart() {
  if(!d.inward || !d.inward.monthly) return; 
  var mk = Object.keys(d.inward.monthly).sort(); var l6 = mk.slice(-6); 
  var lbl = l6.map(function(k) { return d.inward.monthly[k].label; }); var act = l6.map(function(k) { return d.inward.monthly[k].qty; }); 
  var trnd = (act[5] - act[0]) / 5; var pred = act[5] + trnd; lbl.push('Next Month');
  destroyChart('predictive'); 
  charts.predictive = new Chart(document.getElementById('chart-predictive'), { type: 'line', data: { labels: lbl, datasets: [ { label: 'Actual', data: act.concat([null]), borderColor: '#9d4edd', backgroundColor: 'rgba(157,78,221,0.2)', fill: true, tension: 0.4, pointRadius: 5, pointBackgroundColor: '#fff', pointBorderWidth: 2 }, { label: 'Forecast', data: [null, null, null, null, null, act[5], pred], borderColor: '#f97316', backgroundColor: 'rgba(249,115,22,0.2)', borderDash: [5,5], fill: true, tension: 0.4, pointRadius: 6, pointBackgroundColor: '#fff', pointBorderWidth: 2 } ] }, options: { maintainAspectRatio: false, plugins: { legend: { display: true, labels: {color: document.body.getAttribute('data-theme') === 'dark' ? '#cbd5e1' : '#6b7280'} } }, scales: scaleOptsQty } });
}

function initDragDrop() { 
  document.querySelectorAll('.metrics').forEach(function(c) { 
    new Sortable(c, { animation: 150, ghostClass: 'sortable-ghost', chosenClass: 'sortable-chosen', dragClass: 'sortable-drag', handle: '.kpi' }); 
  }); 
}

function updateNotifications() {
  document.getElementById('btn-notifications').innerText = '🔔 Notifications (' + anomalies.length + ')';
}

function showNotifications() {
  document.getElementById('notificationsTitle').innerText = 'Notifications (' + anomalies.length + ')';
  var html = '';
  if(anomalies.length === 0) {
    html = '<p style="text-align:center; padding:20px;">No notifications available.</p>';
  } else {
    anomalies.forEach(function(x) {
      html += '<div class="notification-item"><strong>' + x.type + ' (' + x.severity + '):</strong> ' + x.message + ' <em>(' + x.month + ', ' + formatUnitSmart(x.value) + ')</em></div>';
    });
  }
  document.getElementById('notificationsBody').innerHTML = html;
  document.getElementById('notificationsModal').style.display = 'flex';
}

function closeNotifications() {
  document.getElementById('notificationsModal').style.display = 'none';
}

function performGlobalSearch(query) {
  if(!query.trim()) {
    closeSearchResults();
    return;
  }
  var results = [];
  var sections = ['inward', 'fg', 'scrap', 'opex', 'liveStock', 'overallStock', 'opexApril', 'consumption'];
  sections.forEach(function(sec) {
    if(d[sec] && d[sec].rows) {
      d[sec].rows.forEach(function(r, idx) {
        for(var prop in r) {
          if(r[prop] && String(r[prop]).toLowerCase().includes(query.toLowerCase())) {
            results.push({section: sec, index: idx, row: r});
            break;
          }
        }
      });
    }
  });
  showSearchResults(results);
}

function showSearchResults(results) {
  var html = '';
  if(results.length === 0) {
    html = '<p style="text-align:center; padding:20px;">No results found for your search.</p>';
  } else {
    html = '<p>Found ' + results.length + ' result(s):</p>';
    results.forEach(function(r) {
      var rowStr = JSON.stringify(r.row, null, 2).substring(0, 300) + '...';
      html += '<div class="search-item"><strong>' + r.section.toUpperCase() + ' (Row ' + (r.index + 1) + '):</strong><pre>' + rowStr + '</pre></div>';
    });
  }
  document.getElementById('searchBody').innerHTML = html;
  document.getElementById('searchModal').style.display = 'flex';
}

function closeSearchResults() {
  document.getElementById('searchModal').style.display = 'none';
}

function toggleThemeQuick() {
  var current = document.body.getAttribute('data-theme') || 'default';
  var newTheme = (current === 'dark') ? 'light' : 'dark';
  document.getElementById('themeSelect').value = newTheme;
  changeTheme();
}

function exportAllData() {
  if(!d || Object.keys(d).length === 0) {
    showToast('No data to export!', 'error');
    return;
  }
  var dataStr = JSON.stringify(d, null, 2);
  var blob = new Blob([dataStr], {type: 'application/json'});
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'aperam_dashboard_data_' + new Date().toISOString().split('T')[0] + '.json';
  a.click();
  URL.revokeObjectURL(url);
  showToast('All data exported successfully!', 'success');
}

window.onload = initSettings;