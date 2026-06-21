/* Creality CFS Panel — v1 (read-only): connect, pull boxsInfo/boxConfig, render. */
(function () {
  "use strict";

  const $ = (s) => document.querySelector(s);
  const elIp = $("#ip"), elStatus = $("#status"), elBoxes = $("#boxes");
  const elEmpty = $("#empty-hint"), elSelectHint = $("#select-hint");

  let client = null;
  let lastBoxes = [];
  let autoRefill = false;
  let selected = null; // {boxId, slotId}

  // ---- status ----
  function setStatus(s) {
    const map = { connecting: ["on", "conectando…"], connected: ["on", "conectado"],
      disconnected: ["off", "desconectado"], error: ["err", "erro"] };
    const [cls, txt] = map[s] || ["off", s];
    elStatus.className = "status " + cls;
    elStatus.textContent = txt;
  }

  // ---- data in ----
  function onBoxsInfo(boxsInfo) {
    lastBoxes = CFSModel.parseBoxes(boxsInfo);
    render();
  }
  function onBoxConfig(cfg) {
    autoRefill = !!(cfg && cfg.autoRefill);
    render();
  }

  // ---- render ----
  function pctClass(p) { return p < 0 ? "" : (p <= 10 ? "bar crit" : (p <= 30 ? "bar low" : "bar")); }

  function slotEl(box, slot, idx) {
    const d = document.createElement("div");
    d.className = "slot" + (slot.loaded ? "" : " empty") +
      (selected && selected.boxId === box.id && selected.slotId === slot.id ? " selected" : "");
    const label = box.slotLabel(idx);
    const ring = `<div class="ring" style="border-color:${slot.color}"><div class="hub"></div></div>`;
    const name = slot.loaded ? (slot.product || slot.type || "—") : "vazio";
    const type = slot.loaded && slot.product && slot.type ? slot.type : "";
    const pct = slot.percent >= 0
      ? `<div class="${pctClass(slot.percent)}"><i style="width:${slot.percent}%"></i></div><div class="pct">${slot.percent}%</div>`
      : "";
    const star = slot.selected ? `<div class="star">● ativo</div>` : "";
    d.innerHTML =
      `<div class="label">${label}</div>${ring}` +
      `<div class="name">${escapeHtml(name)}</div>` +
      (type ? `<div class="type">${escapeHtml(type)}</div>` : "") + pct + star;
    d.addEventListener("click", () => {
      selected = { boxId: box.id, slotId: slot.id };
      render();
    });
    return d;
  }

  function cfsCard(box) {
    const card = document.createElement("div");
    card.className = "box-card cfs";
    const env = (box.temp != null || box.humidity != null)
      ? `<span class="badge env">${box.temp != null ? box.temp + "°C" : ""}${box.temp != null && box.humidity != null ? " · " : ""}${box.humidity != null ? box.humidity + "%" : ""}</span>`
      : "";
    const auto = `<span class="badge auto ${autoRefill ? "on" : ""}">AUTO</span>`;
    card.innerHTML = `<div class="box-head"><span class="box-name">CFS ${box.id}</span>` +
      `<span class="box-meta">${env}${auto}</span></div>`;
    const row = document.createElement("div");
    row.className = "slots";
    box.slots.forEach((s, i) => row.appendChild(slotEl(box, s, i)));
    card.appendChild(row);
    return card;
  }

  function externalCard(box) {
    const card = document.createElement("div");
    card.className = "box-card external";
    const s = box.slots[0];
    const loaded = s && s.loaded;
    card.innerHTML = `<div class="box-name" style="margin-bottom:10px">suporte bobina</div>` +
      `<div class="ring" style="border-color:${loaded ? s.color : "#555"}"><div class="hub"></div></div>` +
      `<div class="name" style="margin-top:8px">${loaded ? escapeHtml(s.product || s.type) : "—"}</div>`;
    return card;
  }

  function render() {
    elBoxes.innerHTML = "";
    if (!lastBoxes.length) return;
    elEmpty.hidden = true;
    elSelectHint.hidden = false;
    // external (type 1) first, then CFS
    lastBoxes.filter((b) => !b.isCfs).forEach((b) => elBoxes.appendChild(externalCard(b)));
    lastBoxes.filter((b) => b.isCfs && b.active).forEach((b) => elBoxes.appendChild(cfsCard(b)));
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }

  // ---- actions ----
  function connect() {
    const ip = elIp.value.trim();
    if (!ip) { elIp.focus(); return; }
    localStorage.setItem("cfs_ip", ip);
    if (!client) client = new CFSClient({ onBoxsInfo, onBoxConfig, onStatus: setStatus });
    client.connect(ip);
  }

  async function demo() {
    if (client) client.disconnect(true);
    setStatus("connected");
    try {
      const r = await fetch("references/sample-boxinfo.json", { cache: "no-cache" });
      const s = await r.json();
      const bi = (s.boxsInfo && s.boxsInfo.boxsInfo) || s.boxsInfo;
      const bc = (s.boxConfig && s.boxConfig.boxConfig) || s.boxConfig;
      if (bc) onBoxConfig(bc);
      if (bi) onBoxsInfo(bi);
    } catch (e) {
      elEmpty.hidden = false;
      elEmpty.textContent = "Amostra não encontrada (references/sample-boxinfo.json).";
    }
  }

  // ---- init ----
  (async function init() {
    await CFSModel.loadCatalog();
    const saved = localStorage.getItem("cfs_ip");
    if (saved) {
      elIp.value = saved;
    } else {
      // Servido a partir da própria impressora (add-on Helper Script): o WS:9999
      // está no mesmo host. Pré-preenche para conectar sem digitar nada.
      const host = location.hostname;
      if (host && host !== "localhost" && host !== "127.0.0.1" && host !== "") {
        elIp.value = host;
      }
    }
    $("#btn-connect").addEventListener("click", connect);
    $("#btn-demo").addEventListener("click", demo);
    elIp.addEventListener("keydown", (e) => { if (e.key === "Enter") connect(); });
  })();
})();
