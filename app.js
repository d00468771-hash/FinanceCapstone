// app.js — loads the CSV files, asks ccc.js for the numbers, and fills in the page.
(function () {
  'use strict';

  const fmtDays = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtDollars = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

  function signed(text, value) {
    return (value > 0 ? '+' : '') + text;
  }

  function cell(text, cls) {
    const td = document.createElement('td');
    td.textContent = text;
    if (cls) td.className = cls;
    return td;
  }

  function row(tbody, cells, cls) {
    const tr = document.createElement('tr');
    if (cls) tr.className = cls;
    cells.forEach(function (c) { tr.appendChild(c); });
    tbody.appendChild(tr);
  }

  function loadText(path) {
    return fetch(path, { cache: 'no-cache' }).then(function (res) {
      if (!res.ok) throw new Error('Could not load ' + path + ' (' + res.status + ')');
      return res.text();
    });
  }

  function render(statements, assumptions) {
    const diy = assumptions.days_in_year;
    const before = statements.before;
    const after = statements.after;
    const b = CCC.cycle(before, diy);
    const a = CCC.cycle(after, diy);

    // Cycle table
    const cycleBody = document.querySelector('#cycle-table tbody');
    cycleBody.innerHTML = '';
    [
      ['DIO (days inventory outstanding)', 'dio'],
      ['DSO (days sales outstanding)', 'dso'],
      ['DPO (days payables outstanding)', 'dpo'],
      ['Cash conversion cycle', 'ccc']
    ].forEach(function (pair) {
      const key = pair[1];
      const change = a[key] - b[key];
      row(cycleBody, [
        cell(pair[0]),
        cell(fmtDays.format(b[key])),
        cell(fmtDays.format(a[key])),
        cell(signed(fmtDays.format(change), change))
      ], key === 'ccc' ? 'total' : '');
    });
    document.getElementById('cycle-note').textContent =
      'CCC = DIO + DSO − DPO, using a ' + diy + '-day year.';
    document.getElementById('diy').textContent = diy;

    // Cash freed table
    const freed = CCC.cashFreed(before, after);
    const freedBody = document.querySelector('#freed-table tbody');
    freedBody.innerHTML = '';
    [
      ['Inventory', after.inventory - before.inventory, freed.inventory],
      ['Receivables', after.accounts_receivable - before.accounts_receivable, freed.receivables],
      ['Payables', after.accounts_payable - before.accounts_payable, freed.payables]
    ].forEach(function (r) {
      row(freedBody, [
        cell(r[0]),
        cell(signed(fmtDollars.format(r[1]), r[1])),
        cell(fmtDollars.format(r[2]), r[2] > 0 ? 'pos' : r[2] < 0 ? 'neg' : '')
      ]);
    });
    row(freedBody, [cell('Total'), cell(''), cell(fmtDollars.format(freed.total))], 'total');
  }

  const status = document.getElementById('status');
  Promise.all([loadText('data/electromart.csv'), loadText('data/assumptions.csv')])
    .then(function (texts) {
      const statements = CCC.readStatements(CCC.parseCSV(texts[0]));
      const assumptions = CCC.readAssumptions(CCC.parseCSV(texts[1]));
      render(statements, assumptions);
      status.hidden = true;
    })
    .catch(function (err) {
      status.textContent = err.message;
      status.className = 'status error';
    });
})();
