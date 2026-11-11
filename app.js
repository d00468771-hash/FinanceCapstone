// app.js — loads the CSV files, asks ccc.js for the numbers, and fills in the page.
(function () {
  'use strict';

  const fmtDays = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtDollars = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  const fmtPct = new Intl.NumberFormat('en-US', { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2 });

  function signed(text, value) {
    return (value > 0 ? '+' : '') + text;
  }

  function tone(value) {
    return value > 0 ? 'pos' : value < 0 ? 'neg' : '';
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

  function $(id) { return document.getElementById(id); }

  function loadText(path) {
    return fetch(path, { cache: 'no-cache' }).then(function (res) {
      if (!res.ok) throw new Error('Could not load ' + path + ' (' + res.status + ')');
      return res.text();
    });
  }

  // ---- Before / After tables --------------------------------------------

  function renderTables(statements, assumptions, b, a) {
    const diy = assumptions.days_in_year;
    const before = statements.before;
    const after = statements.after;

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
    $('cycle-note').textContent = 'CCC = DIO + DSO − DPO, using a ' + diy + '-day year.';
    $('diy').textContent = diy;

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
        cell(fmtDollars.format(r[2]), tone(r[2]))
      ]);
    });
    row(freedBody, [cell('Total'), cell(''), cell(fmtDollars.format(freed.total))], 'total');
  }

  // ---- Levers -------------------------------------------------------------

  function setupLevers(statements, assumptions, b, a) {
    const before = statements.before;
    const after = statements.after;
    const keys = ['dio', 'dso', 'dpo'];
    // The exact days the levers hold. Sliders and boxes only display them.
    const state = { dio: b.dio, dso: b.dso, dpo: b.dpo };

    $('net-days').textContent = assumptions.net_days;
    $('disc-pct').textContent = fmtPct.format(assumptions.supplier_discount).replace('.00', '');

    keys.forEach(function (k) {
      const range = $(k + '-range');
      const num = $(k + '-num');
      // Slider runs from 0 to about twice the larger of Before and After, rounded up to 10.
      range.max = Math.ceil(Math.max(b[k], a[k]) * 2 / 10) * 10;

      range.addEventListener('input', function () {
        state[k] = Number(range.value);
        num.value = state[k].toFixed(2);
        update();
      });
      num.addEventListener('input', function () {
        const v = Number(num.value);
        if (num.value === '' || !isFinite(v) || v < 0) return;
        state[k] = v;
        range.value = v;
        update();
      });
    });

    function setAll(days) {
      keys.forEach(function (k) {
        state[k] = days[k];
        $(k + '-range').value = days[k];
        $(k + '-num').value = days[k].toFixed(2);
      });
      update();
    }

    $('set-before').addEventListener('click', function () { setAll(b); });
    $('set-after').addEventListener('click', function () { setAll(a); });

    function update() {
      const s = CCC.scenario(state, before, assumptions);

      // 1. The new cash conversion cycle
      $('lever-ccc').textContent = fmtDays.format(s.ccc) + ' days';
      const change = s.ccc - b.ccc;
      $('lever-ccc-change').textContent = signed(fmtDays.format(change), change) + ' days vs Before (' + fmtDays.format(b.ccc) + ')';

      // 2 and 3. Implied balances and cash freed
      const body = document.querySelector('#lever-table tbody');
      body.innerHTML = '';
      [
        ['Inventory', before.inventory, s.balances.inventory, s.cashFreed.inventory],
        ['Receivables', before.accounts_receivable, s.balances.accounts_receivable, s.cashFreed.receivables],
        ['Payables', before.accounts_payable, s.balances.accounts_payable, s.cashFreed.payables]
      ].forEach(function (r) {
        row(body, [
          cell(r[0]),
          cell(fmtDollars.format(r[1])),
          cell(fmtDollars.format(r[2])),
          cell(fmtDollars.format(r[3]), tone(r[3]))
        ]);
      });
      row(body, [cell('Total cash freed'), cell(''), cell(''),
        cell(fmtDollars.format(s.cashFreed.total), tone(s.cashFreed.total))], 'total');

      // 4. Interest saved on the bank line
      const interest = $('lever-interest');
      interest.textContent = fmtDollars.format(s.interestSaved);
      interest.className = tone(s.interestSaved);
      const line = before.notes_payable;
      const rate = fmtPct.format(assumptions.bank_rate);
      let note = 'Interest saved assumes every freed dollar pays down the bank line (' +
        fmtDollars.format(line) + ' Before, at ' + rate + '). ';
      if (s.cashFreed.total > line) {
        note += 'Only the first ' + fmtDollars.format(line) + ' counts, because that pays off the whole line. ';
      } else if (s.cashFreed.total < 0) {
        note += 'Cash freed is negative, so ElectroMart must borrow more. The negative number is extra interest. ';
      }
      const paidDown = before.notes_payable - after.notes_payable;
      const cashKept = after.cash - before.cash;
      if (paidDown !== 0 || cashKept !== 0) {
        note += 'In the case’s own After balance sheet, the bank line fell ' + fmtDollars.format(paidDown) +
          ' and cash rose ' + fmtDollars.format(cashKept) + ', so not every freed dollar went to the bank.';
      }
      $('interest-note').textContent = note;

      // 5. Supplier terms
      $('lever-pastdue').textContent = fmtDays.format(s.daysPastDue) + ' days';
      const disc = $('lever-disc');
      if (s.discountCost === null) {
        disc.textContent = 'Takes discount';
        $('disc-note').textContent = 'ElectroMart pays within ' + assumptions.discount_days +
          ' days, so it takes the discount.';
      } else {
        disc.textContent = fmtPct.format(s.discountCost);
        const d = assumptions.supplier_discount;
        $('disc-note').textContent = 'ElectroMart pays on day ' + fmtDays.format(state.dpo) +
          ', after the ' + assumptions.discount_days + '-day discount period, so it skips the discount. Cost = ' +
          fmtPct.format(d) + ' / (1 − ' + fmtPct.format(d) + ') × ' + assumptions.days_in_year +
          ' / (' + fmtDays.format(state.dpo) + ' − ' + assumptions.discount_days + ').';
      }
    }

    setAll(b);
  }

  // Register the service worker so the app installs and works offline.
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function (err) {
        console.warn('Service worker not registered:', err);
      });
    });
  }

  const status = $('status');
  Promise.all([loadText('data/electromart.csv'), loadText('data/assumptions.csv')])
    .then(function (texts) {
      const statements = CCC.readStatements(CCC.parseCSV(texts[0]));
      const assumptions = CCC.readAssumptions(CCC.parseCSV(texts[1]));
      const diy = assumptions.days_in_year;
      const b = CCC.cycle(statements.before, diy);
      const a = CCC.cycle(statements.after, diy);
      renderTables(statements, assumptions, b, a);
      setupLevers(statements, assumptions, b, a);
      status.hidden = true;
    })
    .catch(function (err) {
      status.textContent = err.message;
      status.className = 'status error';
    });
})();
