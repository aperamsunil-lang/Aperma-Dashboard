let currentData = null;
let currentTab = 'overview';
let chartInstance = null;

function switchTab(tabId) {
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('tab-active'));
  const activeButton = document.getElementById(`tab-${tabId}`);
  if (activeButton) activeButton.classList.add('tab-active');
  currentTab = tabId;
  renderView();
}

function showDashboard() {
  document.getElementById('empty-state').classList.add('hidden');
  document.getElementById('dashboard-ui').classList.remove('hidden');
  updateStats();
  renderView();
}

function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  document.getElementById('loading').classList.remove('hidden');
  document.getElementById('loading-text').innerText = 'Reading file data...';

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      currentData = JSON.parse(e.target.result);
      showDashboard();
      document.getElementById('localFileInput').value = '';
    } catch (err) {
      alert('Error parsing JSON file. Make sure it is valid JSON.');
      console.error(err);
    } finally {
      document.getElementById('loading').classList.add('hidden');
    }
  };

  reader.onerror = function() {
    alert('Error reading file');
    document.getElementById('loading').classList.add('hidden');
  };

  reader.readAsText(file);
}

async function fetchLiveData() {
  const url = document.getElementById('scriptUrl').value.trim();
  if (!url) {
    alert('Please enter your Apps Script Web App URL first.');
    return;
  }

  document.getElementById('loading').classList.remove('hidden');
  document.getElementById('loading-text').innerText = 'Fetching live data from Google Sheets...';

  try {
    const response = await fetch(url + '?type=all');
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    const data = await response.json();
    if (data.error) throw new Error(data.error);

    currentData = data;
    showDashboard();
  } catch (err) {
    alert('Error fetching live data: ' + err.message + '\n\nMake sure the script is deployed as Anyone and CORS is allowed.');
    console.error(err);
  } finally {
    document.getElementById('loading').classList.add('hidden');
  }
}

async function loadDefaultData() {
  document.getElementById('loading').classList.remove('hidden');
  document.getElementById('loading-text').innerText = 'Loading local dashboard data...';

  try {
    const response = await fetch('all_data.json');
    if (response.ok) {
      const data = await response.json();
      if (data && Object.keys(data).length) {
        currentData = data;
        showDashboard();
        return;
      }
    }
  } catch (err) {
    console.warn('all_data.json could not be loaded locally', err);
  } finally {
    document.getElementById('loading').classList.add('hidden');
  }
}

function updateStats() {
  if (!currentData) return;

  const inwTotal = (currentData.inward?.rows || []).reduce((sum, r) => sum + (Number(r.qty) || 0), 0);
  document.getElementById('stat-inward-qty').innerText = inwTotal.toLocaleString();

  const fgTotal = (currentData.fg?.rows || []).reduce((sum, r) => sum + (Number(r.qty) || 0), 0);
  document.getElementById('stat-fg-qty').innerText = fgTotal.toLocaleString();

  const stockVal = (currentData.livestock?.rows || []).reduce((sum, r) => sum + (Number(r.val) || 0), 0);
  document.getElementById('stat-stock-val').innerText = '₹' + Math.round(stockVal).toLocaleString();

  const scrapTotal = (currentData.scrap?.rows || []).reduce((sum, r) => sum + (Number(r.qty) || 0), 0);
  document.getElementById('stat-scrap-qty').innerText = scrapTotal.toLocaleString();
}

function renderView() {
  if (!currentData) return;

  const container1 = document.getElementById('view-container-1');
  const container2 = document.getElementById('view-container-2');
  if (chartInstance) chartInstance.destroy();
  container2.innerHTML = '<h4 class="font-bold text-slate-700 mb-4">Data Summary</h4><div id="recent-table" class="overflow-x-auto overflow-y-auto max-h-[350px] text-sm custom-scrollbar"></div>';

  switch (currentTab) {
    case 'overview':
      renderOverview();
      break;
    case 'inward':
      renderTable(currentData.inward?.rows || [], ['monthLbl', 'item', 'qty', 'inr'], ['Date', 'Item', 'Qty', 'Value']);
      break;
    case 'fg':
      renderTable(currentData.fg?.rows || [], ['monthLbl', 'party', 'qty', 'inr', 'city'], ['Date', 'Customer', 'Qty', 'Value', 'City']);
      break;
    case 'scrap':
      renderTable(currentData.scrap?.rows || [], ['monthLbl', 'party', 'qty', 'inv'], ['Date', 'Buyer', 'Qty', 'Invoice']);
      break;
    case 'opex':
      renderOpexView();
      break;
    case 'stock':
      renderStockView();
      break;
    case 'consumption':
      renderTable(currentData.consumption?.rows || [], ['dateLbl', 'item', 'category', 'qty', 'val'], ['Date', 'Item', 'Cat', 'Qty', 'Val']);
      break;
    default:
      renderOverview();
      break;
  }
}

function renderOverview() {
  const labels = [];
  const inwData = [];
  const fgData = [];

  const inwRows = currentData.inward?.rows || [];
  const fgRows = currentData.fg?.rows || [];
  const months = [...new Set([...inwRows.map(r => r.monthLbl), ...fgRows.map(r => r.monthLbl)])].filter(Boolean).sort();

  months.slice(-8).forEach(m => {
    labels.push(m);
    inwData.push(inwRows.filter(r => r.monthLbl === m).reduce((s, r) => s + (Number(r.qty) || 0), 0));
    fgData.push(fgRows.filter(r => r.monthLbl === m).reduce((s, r) => s + (Number(r.qty) || 0), 0));
  });

  const ctx = document.getElementById('mainChart').getContext('2d');
  chartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Inward RM', data: inwData, backgroundColor: '#2563eb' },
        { label: 'FG Dispatch', data: fgData, backgroundColor: '#10b981' }
      ]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
  });

  const parties = {};
  fgRows.forEach(r => { if (r.party) parties[r.party] = (parties[r.party] || 0) + (Number(r.qty) || 0); });
  const topParties = Object.entries(parties).sort((a, b) => b[1] - a[1]).slice(0, 10);
  renderTable(topParties.map(p => ({ name: p[0], qty: p[1] })), ['name', 'qty'], ['Customer Name', 'Total Qty (Kgs)']);
}

function renderStockView() {
  const ctx = document.getElementById('mainChart').getContext('2d');
  const catData = currentData.livestock?.categories || {};

  if (Object.keys(catData).length > 0) {
    chartInstance = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: Object.keys(catData),
        datasets: [{ data: Object.values(catData), backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'] }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } } }
    });
  } else {
    document.getElementById('mainChart').parentElement.innerHTML = '<div class="h-full flex items-center justify-center text-slate-400">No stock categories found</div>';
  }

  renderTable(currentData.livestock?.rows?.slice(0, 50) || [], ['name', 'category', 'qty', 'val', 'loc'], ['Item', 'Category', 'Qty', 'Value', 'Loc']);
}

function renderOpexView() {
  const container = document.getElementById('view-container-1');
  container.innerHTML = '<h4 class="font-bold text-slate-700 mb-4">OPEX Breakdown (April)</h4><div class="overflow-y-auto max-h-[350px] text-xs custom-scrollbar" id="opex-scroll"></div>';

  let html = `<table class="w-full text-left border-collapse relative"><thead class="sticky top-0 bg-white shadow-sm z-10"><tr class="text-slate-500 border-b"><th class="py-2 px-1">Label</th><th class="py-2 px-1">Budget</th><th class="py-2 px-1">Actual</th><th class="py-2 px-1">Remarks</th></tr></thead><tbody>`;

  (currentData.opexApril || []).forEach(row => {
    if (row.isSeparator) {
      html += '<tr class="bg-slate-50"><td colspan="4" class="h-2 border-b"></td></tr>';
      return;
    }
    const rowClass = row.isTotal ? 'font-bold bg-blue-50' : 'border-b border-slate-100';
    html += `<tr class="${rowClass} hover:bg-slate-50"><td class="py-2 px-1">${row.label || ''}</td><td class="py-2 px-1">${row.isBudgetBlank ? '-' : '₹' + (Number(row.budget) || 0).toLocaleString()}</td><td class="py-2 px-1">₹${(Number(row.actual) || 0).toLocaleString()}</td><td class="py-2 px-1 text-[10px] text-slate-400">${row.remarks || ''}</td></tr>`;
  });

  html += '</tbody></table>';
  document.getElementById('opex-scroll').innerHTML = html;

  const ctxContainer = document.getElementById('view-container-2').querySelector('div');
  ctxContainer.innerHTML = '<canvas id="opexChart" height="300"></canvas>';

  if (currentData.opex && Array.isArray(currentData.opex.months) && Array.isArray(currentData.opex.categories)) {
    const opexCtx = document.getElementById('opexChart').getContext('2d');
    chartInstance = new Chart(opexCtx, {
      type: 'line',
      data: {
        labels: currentData.opex.months,
        datasets: currentData.opex.categories.map((cat, idx) => ({
          label: cat,
          data: currentData.opex.consumption?.[idx] || [],
          borderColor: `hsl(${idx * 45}, 70%, 50%)`,
          tension: 0.3
        }))
      },
      options: { responsive: true, maintainAspectRatio: false }
    });
  }
}

function renderTable(rows, keys, headers) {
  const tableDiv = document.getElementById('recent-table');
  if (!rows || rows.length === 0) {
    tableDiv.innerHTML = '<div class="text-slate-400 text-center py-8">No data found in this category</div>';
    return;
  }

  let html = `<table class="w-full text-left border-collapse relative"><thead class="sticky top-0 bg-white shadow-sm z-10"><tr class="text-slate-500 border-b">${headers.map(h => `<th class="py-3 px-2 font-semibold">${h}</th>`).join('')}</tr></thead><tbody>`;

  rows.slice(0, 100).forEach(row => {
    html += `<tr class="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">${keys.map(k => {
      let val = row[k];
      if (typeof val === 'number') val = val.toLocaleString();
      return `<td class="py-3 px-2 text-slate-600">${val || '-'}</td>`;
    }).join('')}</tr>`;
  });

  html += '</tbody></table>';
  if (rows.length > 100) html += '<p class="p-4 text-center text-xs text-slate-400 italic sticky bottom-0 bg-white/90 backdrop-blur">Showing top 100 records</p>';
  tableDiv.innerHTML = html;
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(err => console.warn('Service Worker registration failed:', err));
  }
}

window.addEventListener('load', () => {
  registerServiceWorker();
  loadDefaultData();
});
