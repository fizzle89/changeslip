/* Changeslip engine - faithful browser port of the tested Python calc.py
   (change-order build of Oct 13, tests 4/4). Exact decimal math via BigInt; no floats. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Changeslip = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  function clean(v, dflt) {
    if (v === null || v === undefined || String(v).trim() === '') v = dflt === undefined ? '0' : dflt;
    return String(v).replace(/[,$]/g, '').trim();
  }
  function toRat(s) {
    s = String(s);
    let neg = false;
    if (s.startsWith('-')) { neg = true; s = s.slice(1); }
    if (!/^\d+(\.\d+)?$/.test(s)) return { n: 0n, d: 1n };
    const dot = s.indexOf('.');
    let d = 0, digs = s;
    if (dot >= 0) { d = s.length - dot - 1; digs = s.slice(0, dot) + s.slice(dot + 1); }
    return { n: BigInt(digs || '0') * (neg ? -1n : 1n), d: 10n ** BigInt(d) };
  }
  function D(v, dflt) { return toRat(clean(v, dflt)); }
  function mulRat(a, b) { return { n: a.n * b.n, d: a.d * b.d }; }
  /* ROUND_HALF_UP to integer cents */
  function ratToCents(r) {
    const neg = r.n < 0n;
    const n = neg ? -r.n : r.n;
    const c = (n * 100n + r.d / 2n) / r.d;
    return Number(neg ? -c : c);
  }
  function money(v) { return ratToCents(D(v)); }
  function fm(cents) {
    const sign = cents < 0 ? '-' : '';
    return sign + '$' + (Math.abs(cents) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function key(t, c) { return t + '|' + (c || ''); }
  /* rates: Map/object keyed "labor|CODE" -> {rate_st, rate_ot} as rats; we accept plain object with rat values */
  function buildRates(entries) {
    const r = {};
    (entries || []).forEach(e => {
      if (!e.class_code) return;
      r[key(e.type, e.class_code)] = { rate_st: D(e.rate_st), rate_ot: e.rate_ot === undefined || e.rate_ot === null || String(e.rate_ot).trim() === '' ? null : D(e.rate_ot) };
    });
    return r;
  }
  function lineAmount(line, rates) {
    const t = line.type;
    if (t === 'labor') {
      const r = rates[key('labor', line.class_code || '')];
      let st, ot, note;
      if (r) { st = r.rate_st; ot = r.rate_ot || r.rate_st; note = 'approved rate card'; }
      else { st = ot = D(line.unit_cost); note = 'NO approved rate; unit cost typed in'; }
      // careful: hours and rates can have different scales; do it properly:
      const hSt = D(line.hours_st), hOt = D(line.hours_ot);
      const pSt = mulRat(hSt, st), pOt = mulRat(hOt, ot);
      const totalRat = { n: pSt.n * pOt.d + pOt.n * pSt.d, d: pSt.d * pOt.d };
      return { amount: ratToCents(totalRat), note };
    }
    if (t === 'equipment') {
      const r = rates[key('equipment', line.class_code || '')];
      const rate = r ? r.rate_st : D(line.unit_cost);
      return { amount: ratToCents(mulRat(D(line.qty), rate)), note: r ? 'approved rate card' : 'NO approved rate; typed in' };
    }
    return { amount: ratToCents(mulRat(D(line.qty), D(line.unit_cost))), note: 'receipt/quote price' };
  }
  function pctRat(v) { const r = D(v); return { n: r.n, d: r.d * 100n }; }
  function roundRatToInt(r) { const neg = r.n < 0n; const n = neg ? -r.n : r.n; const c = (n + r.d / 2n) / r.d; return Number(neg ? -c : c); }
  function priceTicket(lines, rates, tpl) {
    const sub = { labor: 0, material: 0, equipment: 0 };
    const out = [];
    lines.forEach(ln => {
      const la = lineAmount(ln, rates);
      sub[ln.type] += la.amount;
      out.push(Object.assign({}, ln, { amount: la.amount, rate_note: la.note }));
    });
    const mk = {};
    ['labor', 'material', 'equipment'].forEach(k => { const p = pctRat(tpl[k + '_markup']); mk[k] = roundRatToInt({ n: BigInt(sub[k]) * p.n, d: p.d }); });
    const direct = sub.labor + sub.material + sub.equipment;
    const base = direct + mk.labor + mk.material + mk.equipment;
    const ohpBase = tpl.compound ? base : direct;
    const p = pctRat(tpl.ohp_markup); const ohp = roundRatToInt({ n: BigInt(ohpBase) * p.n, d: p.d });
    return { lines: out, subtotals: sub, markups: mk, ohp, direct, total: base + ohp };
  }
  function flags(ticket, lines, docs, tpl, rates) {
    const f = [];
    const kinds = new Set(docs.map(d => d.kind));
    const docids = new Set(docs.map(d => d.id));
    if (!lines.length) f.push({ severity: 'block', text: 'No line items yet.', line_id: null });
    if (!kinds.has('signed_ticket')) f.push({ severity: 'block', text: 'No signed T&M ticket attached.', line_id: null });
    if (!(ticket.signed_by || '').trim()) f.push({ severity: 'block', text: 'Name of GC/owner rep who signed is not recorded.', line_id: null });
    if (!ticket.work_date) f.push({ severity: 'block', text: 'Work date missing.', line_id: null });
    (tpl.required_docs || []).forEach(need => {
      if (!kinds.has(need) && need !== 'signed_ticket') f.push({ severity: 'warn', text: "This GC profile asks for '" + need + "' and none is attached.", line_id: null });
    });
    lines.forEach(ln => {
      const lid = ln.id;
      const tag = ln.type + " line '" + String(ln.description || '').slice(0, 40) + "'";
      if (ln.type === 'labor') {
        if (!rates[key('labor', ln.class_code || '')]) f.push({ severity: 'block', text: tag + ": classification '" + (ln.class_code || '-') + "' has no approved rate.", line_id: lid });
        const hrs = Number(clean(ln.hours_st)) + Number(clean(ln.hours_ot));
        if (hrs <= 0) f.push({ severity: 'block', text: tag + ': zero hours.', line_id: lid });
        if (hrs > 24) f.push({ severity: 'warn', text: tag + ': over 24 hours for one line, check.', line_id: lid });
      } else if (ln.type === 'material') {
        if (Number(clean(ln.unit_cost)) <= 0 || Number(clean(ln.qty)) <= 0) f.push({ severity: 'block', text: tag + ': quantity or cost missing.', line_id: lid });
        if (!docids.has(ln.source_doc_id)) f.push({ severity: 'block', text: tag + ': no receipt or invoice linked.', line_id: lid });
      } else if (ln.type === 'equipment') {
        if (!rates[key('equipment', ln.class_code || '')] && Number(clean(ln.unit_cost)) <= 0) f.push({ severity: 'block', text: tag + ': no approved equipment rate.', line_id: lid });
      }
      if (ln.type === 'labor' && !docids.has(ln.source_doc_id)) f.push({ severity: 'warn', text: tag + ': not linked to a source document.', line_id: lid });
      if (!ln.confirmed) f.push({ severity: 'block', text: tag + ': suggested from a document and not yet confirmed by a person.', line_id: lid });
    });
    return f;
  }
  return { D, money, fm, buildRates, lineAmount, priceTicket, flags, toRat, mulRat, ratToCents };
});
