/* CFS data model: parses the printer's boxsInfo / boxConfig into a normalized
   shape and resolves product names via the material catalogue. */
(function (global) {
  "use strict";

  let CATALOG = {}; // { "03001": {vendor, product, type}, ... }

  async function loadCatalog() {
    try {
      const r = await fetch("js/materials.json", { cache: "no-cache" });
      if (r.ok) CATALOG = await r.json();
    } catch (e) { /* offline: catalog stays empty, names fall back to box data */ }
    return CATALOG;
  }

  // "#0RRGGBB" / "0RRGGBB" / "#RRGGBB" -> "#RRGGBB"
  function normColor(c) {
    if (!c) return "#3a3a3f";
    let h = String(c).replace(/[^0-9a-fA-F]/g, "");
    if (h.length > 6) h = h.slice(-6);
    if (h.length !== 6) return "#3a3a3f";
    return "#" + h.toLowerCase();
  }

  // catalogue id = last 5 digits of the code/rfid
  function catLookup(code) {
    if (!code) return null;
    const k = String(code);
    return CATALOG[k] || (k.length > 5 ? CATALOG[k.slice(-5)] : null) || null;
  }

  function letter(i) { return String.fromCharCode(65 + i); } // 0->A

  // Build a normalized box list from a boxsInfo payload (already unwrapped to the
  // object holding materialBoxs).
  function parseBoxes(boxsInfo) {
    const boxes = (boxsInfo && boxsInfo.materialBoxs) || [];
    return boxes.map(function (box) {
      const isCfs = (box.type === 0 || box.type === 2);
      const slots = (box.materials || []).map(function (m) {
        const cat = catLookup(m.rfid);
        const loaded = (m.state && m.state !== 0) && !(!m.vendor && !m.type && !m.name);
        return {
          id: m.id,
          loaded: !!loaded,
          vendor: m.vendor || (cat && cat.vendor) || "",
          type: m.type || (cat && cat.type) || "",
          product: m.name || (cat && cat.product) || "",
          color: normColor(m.color),
          rfid: m.rfid || "",
          percent: (typeof m.percent === "number") ? m.percent : -1,
          selected: !!m.selected,
          minTemp: m.minTemp, maxTemp: m.maxTemp,
        };
      });
      return {
        id: box.id,
        type: box.type,
        isCfs: isCfs,
        active: box.state === 1,
        temp: (typeof box.temp === "number") ? box.temp : null,
        humidity: (typeof box.humidity === "number") ? box.humidity : null,
        slots: slots,
        slotLabel: function (idx) { return isCfs ? (box.id + letter(idx)) : "ext"; },
      };
    });
  }

  global.CFSModel = { loadCatalog, parseBoxes, normColor, catLookup };
})(window);
