const SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID_HERE';
const SHEET_NAMES = {
  inward: 'Inward',
  fg: 'FG',
  scrap: 'Scrap',
  opex: 'Opex',
  opexApril: 'OpexApril',
  livestock: 'LiveStock',
  overallstock: 'OverallStock',
  consumption: 'Consumption'
};

function doGet(e) {
  const result = getDashboardData();
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}

function getDashboardData() {
  if (!SPREADSHEET_ID || SPREADSHEET_ID === 'YOUR_SPREADSHEET_ID_HERE') {
    return { error: 'Please configure SPREADSHEET_ID in Code.gs before using this endpoint.' };
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const data = {};

  Object.keys(SHEET_NAMES).forEach(key => {
    const sheet = ss.getSheetByName(SHEET_NAMES[key]);
    data[key] = { rows: sheet ? readSheetWithHeader(sheet) : [] };
  });

  return data;
}

function readSheetWithHeader(sheet) {
  const values = sheet.getDataRange().getValues();
  if (!values || values.length < 2) return [];

  const headers = values[0].map(header => String(header || '').trim());
  const rows = [];

  for (let i = 1; i < values.length; i++) {
    const row = {};
    values[i].forEach((cell, j) => {
      row[headers[j] || `column_${j + 1}`] = cell;
    });
    rows.push(row);
  }

  return rows;
}
