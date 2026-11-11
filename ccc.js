// ccc.js — the finance math for the ElectroMart CCC app.
// These are plain functions: they never touch the web page, so they can be
// checked with Node, for example:
//   node -e "const c=require('./ccc.js'); console.log(c.days(1200000, 6000000, 365))"

(function (root) {
  'use strict';

  // Turn CSV text into an array of objects, one per row, keyed by the header.
  // Handles simple CSVs and quoted fields that contain commas.
  function parseCSV(text) {
    const rows = [];
    let field = '';
    let row = [];
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (inQuotes) {
        if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
        else if (ch === '"') { inQuotes = false; }
        else { field += ch; }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        row.push(field); field = '';
      } else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(field); field = '';
        if (row.some(function (f) { return f.trim() !== ''; })) rows.push(row);
        row = [];
      } else {
        field += ch;
      }
    }
    row.push(field);
    if (row.some(function (f) { return f.trim() !== ''; })) rows.push(row);

    const header = rows.shift().map(function (h) { return h.trim(); });
    return rows.map(function (r) {
      const obj = {};
      header.forEach(function (h, j) { obj[h] = (r[j] || '').trim(); });
      return obj;
    });
  }

  // Statements CSV (section,item,before,after) -> { before: {...}, after: {...}, sections: {...} }
  function readStatements(rows) {
    const out = { before: {}, after: {}, sections: {} };
    rows.forEach(function (r) {
      out.before[r.item] = Number(r.before);
      out.after[r.item] = Number(r.after);
      out.sections[r.item] = r.section;
    });
    return out;
  }

  // Assumptions CSV (assumption,value,note) -> { days_in_year: 365, bank_rate: 0.08, ... }
  function readAssumptions(rows) {
    const out = {};
    rows.forEach(function (r) { out[r.assumption] = Number(r.value); });
    return out;
  }

  // Days a balance represents: balance / annual flow × days in year.
  function days(balance, annualFlow, daysInYear) {
    return balance / annualFlow * daysInYear;
  }

  // DIO, DSO, DPO and the cash conversion cycle for one period.
  // DIO = Inventory / COGS × 365
  // DSO = Accounts receivable / Revenue × 365 (all sales are on credit)
  // DPO = Accounts payable / COGS × 365 (purchases equal COGS)
  // CCC = DIO + DSO − DPO
  function cycle(period, daysInYear) {
    const dio = days(period.inventory, period.cogs, daysInYear);
    const dso = days(period.accounts_receivable, period.revenue, daysInYear);
    const dpo = days(period.accounts_payable, period.cogs, daysInYear);
    return { dio: dio, dso: dso, dpo: dpo, ccc: dio + dso - dpo };
  }

  // Cash freed by each lever, from the balance sheet change.
  // A drop in an asset frees cash; a rise in accounts payable frees cash.
  function cashFreed(before, after) {
    const inventory = before.inventory - after.inventory;
    const receivables = before.accounts_receivable - after.accounts_receivable;
    const payables = after.accounts_payable - before.accounts_payable;
    return {
      inventory: inventory,
      receivables: receivables,
      payables: payables,
      total: inventory + receivables + payables
    };
  }

  // The same cash freed, worked out from the days instead:
  // days changed × annual COGS (or revenue) / days in year.
  // Should equal cashFreed() — a check that the two methods agree.
  function cashFreedFromDays(beforeCycle, afterCycle, before, daysInYear) {
    const inventory = (beforeCycle.dio - afterCycle.dio) * before.cogs / daysInYear;
    const receivables = (beforeCycle.dso - afterCycle.dso) * before.revenue / daysInYear;
    const payables = (afterCycle.dpo - beforeCycle.dpo) * before.cogs / daysInYear;
    return {
      inventory: inventory,
      receivables: receivables,
      payables: payables,
      total: inventory + receivables + payables
    };
  }

  const api = {
    parseCSV: parseCSV,
    readStatements: readStatements,
    readAssumptions: readAssumptions,
    days: days,
    cycle: cycle,
    cashFreed: cashFreed,
    cashFreedFromDays: cashFreedFromDays
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api; // Node
  else root.CCC = api; // browser
})(this);
