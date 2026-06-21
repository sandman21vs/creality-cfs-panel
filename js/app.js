/* Creality CFS Panel — dashboard (CFS + telemetria + controles + abas).
   Espelha a página "Dispositivo" do CrealityPrint sobre o WS:9999.
   Comandos set/get verificados contra docs/device-api.md + K1C real. */
(function () {
  "use strict";

  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };
  var M = window.CFSModel;

  var elIp = $("#ip"), elStatus = $("#status"), elBoxes = $("#boxes");
  var elEmpty = $("#empty-hint"), elDash = $("#dashboard"), elTabs = $("#tabs");

  var client = null;
  var connectedIp = null;
  var lastBoxes = [];
  var boxConfig = { autoRefill: 0, cAutoFeed: 0, cSelfTest: 0 };
  var selected = null;     // {boxId, slotId}
  var jogStep = 1;
  var camOn = false;

  // ---- utils ----
  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  var toastT = null;
  function toast(msg, kind) {
    var t = $("#toast");
    t.textContent = msg;
    t.className = "toast" + (kind ? " " + kind : "");
    t.hidden = false;
    clearTimeout(toastT);
    toastT = setTimeout(function () { t.hidden = true; }, 2600);
  }
  function send(params, okMsg) {
    if (!client || !client.set(params)) { toast("Sem conexão", "bad"); return false; }
    if (okMsg) toast(okMsg);
    return true;
  }

  function setStatus(s) {
    var map = { connecting: ["on", "conectando…"], connected: ["on", "conectado"],
      disconnected: ["off", "desconectado"], error: ["err", "erro"] };
    var e = map[s] || ["off", s];
    elStatus.className = "status " + e[0];
    elStatus.textContent = e[1];
    if (s === "connected") { elEmpty.hidden = true; elDash.hidden = false; elTabs.hidden = false; }
  }

  // ================= TELEMETRIA → painéis =================
  function setRange(id, val) {
    var el = $("#" + id);
    if (el && document.activeElement !== el) el.value = val;
  }
  function onTelemetry(t) {
    // Temperaturas
    $("#t-nozzle").textContent = M.temp(t.nozzleTemp);
    $("#t-nozzle-tgt").textContent = M.num(t.targetNozzleTemp) ? " → " + Math.round(M.num(t.targetNozzleTemp)) + "°C" : "";
    $("#t-bed").textContent = M.temp(t.bedTemp0);
    $("#t-bed-tgt").textContent = M.num(t.targetBedTemp0) ? " → " + Math.round(M.num(t.targetBedTemp0)) + "°C" : "";
    $("#t-box").textContent = M.temp(t.boxTemp);

    // LED
    if (document.activeElement !== $("#led")) $("#led").checked = !!M.num(t.lightSw);

    // Velocidade
    var spd = M.num(t.curFeedratePct);
    if (spd != null) $("#speed-val").textContent = spd + "%";

    // Ventiladores (usa os *Pct verificados)
    var fm = M.num(t.modelFanPct), fc = M.num(t.caseFanPct), fa = M.num(t.auxiliaryFanPct);
    if (fm != null) { setRange("fan-model", fm); $("#fan-model-v").textContent = fm + "%"; }
    if (fc != null) { setRange("fan-case", fc); $("#fan-case-v").textContent = fc + "%"; }
    if (fa != null) { setRange("fan-aux", fa); $("#fan-aux-v").textContent = fa + "%"; }

    // Posição (aba controle)
    var p = M.parsePosition(t.curPosition);
    $("#pos").textContent = "X " + (p.x == null ? "—" : p.x) + "  Y " + (p.y == null ? "—" : p.y) + "  Z " + (p.z == null ? "—" : p.z);

    // Impressão atual
    $("#dev-state").textContent = M.stateLabel(t.deviceState);
    var prog = M.num(t.printProgress); if (prog == null) prog = 0;
    $("#print-bar").style.width = prog + "%";
    $("#print-pct").textContent = prog + "%";
    $("#print-name").textContent = t.printFileName || "nenhum trabalho";
    $("#print-name").className = "print-name" + (t.printFileName ? "" : " muted");
    var lay = M.num(t.layer), tot = M.num(t.TotalLayer);
    $("#print-layer").textContent = (tot ? "camada " + (lay || 0) + "/" + tot : "camada —");
    $("#print-elapsed").textContent = "decorrido " + M.fmtDuration(t.printJobTime);
    $("#print-left").textContent = "restante " + M.fmtDuration(t.printLeftTime);

    var active = M.isActiveJob(t), paused = M.isPaused(t);
    $("#btn-pause").disabled = !active || paused;
    $("#btn-resume").disabled = !active || !paused;
    $("#btn-stop").disabled = !active;
  }

  // ================= CFS (boxsInfo / boxConfig) =================
  function onBoxsInfo(boxsInfo) { lastBoxes = M.parseBoxes(boxsInfo); renderCfs(); }
  function onBoxConfig(cfg) {
    boxConfig = { autoRefill: cfg && cfg.autoRefill ? 1 : 0,
      cAutoFeed: cfg && cfg.cAutoFeed ? 1 : 0, cSelfTest: cfg && cfg.cSelfTest ? 1 : 0 };
    if (document.activeElement !== $("#cfg-auto")) $("#cfg-auto").checked = !!boxConfig.autoRefill;
    if (document.activeElement !== $("#cfg-autofeed")) $("#cfg-autofeed").checked = !!boxConfig.cAutoFeed;
    renderCfs();
  }

  function pctClass(p) { return p < 0 ? "" : (p <= 10 ? "bar crit" : (p <= 30 ? "bar low" : "bar")); }

  function slotEl(box, slot, idx) {
    var d = document.createElement("div");
    var isSel = selected && selected.boxId === box.id && selected.slotId === slot.id;
    d.className = "slot" + (slot.loaded ? "" : " empty") + (isSel ? " selected" : "");
    var label = box.slotLabel(idx);
    var name = slot.loaded ? (slot.product || slot.type || "—") : "vazio";
    var type = slot.loaded && slot.product && slot.type ? slot.type : "";
    var pct = slot.percent >= 0
      ? '<div class="' + pctClass(slot.percent) + '"><i style="width:' + slot.percent + '%"></i></div><div class="pct">' + slot.percent + '%</div>'
      : "";
    var star = slot.selected ? '<div class="star">● ativo</div>' : "";
    d.innerHTML = '<div class="label">' + label + '</div>' +
      '<div class="ring" style="border-color:' + slot.color + '"><div class="hub"></div></div>' +
      '<div class="name">' + escapeHtml(name) + '</div>' +
      (type ? '<div class="type">' + escapeHtml(type) + '</div>' : "") + pct + star;
    d.addEventListener("click", function () {
      selected = { boxId: box.id, slotId: slot.id };
      renderCfs();
    });
    return d;
  }

  function cfsCard(box) {
    var card = document.createElement("div");
    card.className = "box-card cfs";
    var env = (box.temp != null || box.humidity != null)
      ? '<span class="badge env">' + (box.temp != null ? box.temp + "°C" : "") +
        (box.temp != null && box.humidity != null ? " · " : "") +
        (box.humidity != null ? box.humidity + "%" : "") + '</span>' : "";
    var auto = '<span class="badge auto ' + (boxConfig.autoRefill ? "on" : "") + '">AUTO</span>';
    card.innerHTML = '<div class="box-head"><span class="box-name">CFS ' + box.id + '</span>' +
      '<span class="box-meta">' + env + auto + '</span></div>';
    var row = document.createElement("div");
    row.className = "slots";
    box.slots.forEach(function (s, i) { row.appendChild(slotEl(box, s, i)); });
    card.appendChild(row);
    return card;
  }

  function externalCard(box) {
    var card = document.createElement("div");
    card.className = "box-card external";
    var s = box.slots[0];
    var loaded = s && s.loaded;
    card.innerHTML = '<div class="box-name" style="margin-bottom:10px">suporte bobina</div>' +
      '<div class="ring" style="border-color:' + (loaded ? s.color : "#555") + '"><div class="hub"></div></div>' +
      '<div class="name" style="margin-top:8px">' + (loaded ? escapeHtml(s.product || s.type) : "—") + '</div>';
    return card;
  }

  function selectedSlot() {
    if (!selected) return null;
    var box = lastBoxes.filter(function (b) { return b.id === selected.boxId; })[0];
    if (!box) return null;
    var slot = box.slots.filter(function (s) { return s.id === selected.slotId; })[0];
    return slot ? { box: box, slot: slot } : null;
  }

  function renderCfs() {
    elBoxes.innerHTML = "";
    lastBoxes.filter(function (b) { return !b.isCfs; }).forEach(function (b) { elBoxes.appendChild(externalCard(b)); });
    lastBoxes.filter(function (b) { return b.isCfs && b.active; }).forEach(function (b) { elBoxes.appendChild(cfsCard(b)); });

    var ctrls = $("#cfs-ctrls");
    var sel = selectedSlot();
    ctrls.hidden = !lastBoxes.length;
    if (sel) {
      $("#sel-label").textContent = sel.box.slotLabel(sel.slot.id);
      $("#sel-prod").textContent = sel.slot.loaded ? (sel.slot.product || sel.slot.type || "") : "(vazio)";
    } else {
      $("#sel-label").textContent = "—";
      $("#sel-prod").textContent = "selecione um slot";
    }
  }

  // ================= LISTAS (arquivos / histórico / vídeo) =================
  function onList(kind, data) {
    if (kind === "files") renderFiles(data);
    else if (kind === "history") renderHistory(data);
    else if (kind === "video") renderVideo(data);
  }

  function matSwatches(colorStr) {
    if (!colorStr) return "";
    return colorStr.split(";").filter(Boolean).map(function (c) {
      return '<span class="sw" style="background:' + escapeHtml(c) + '"></span>';
    }).join("");
  }

  function renderFiles(list) {
    var el = $("#files");
    if (!list || !list.length) { el.innerHTML = '<p class="hint">Nenhum arquivo.</p>'; return; }
    el.innerHTML = "";
    list.forEach(function (f) {
      var row = document.createElement("div");
      row.className = "file-row";
      var sizeMB = f.file_size ? (f.file_size / 1048576).toFixed(1) + " MB" : "";
      row.innerHTML =
        '<div class="file-main"><div class="file-name">' + escapeHtml(f.name) + '</div>' +
        '<div class="file-sub muted">' + matSwatches(f.materialColors) +
        ' ' + escapeHtml(sizeMB) + (f.timeCost ? " · ~" + M.fmtDuration(f.timeCost) : "") + '</div></div>' +
        '<div class="file-act"></div>';
      var act = row.querySelector(".file-act");
      var bp = document.createElement("button"); bp.textContent = "Imprimir";
      bp.addEventListener("click", function () {
        if (confirm("Iniciar impressão de:\n" + f.name + " ?"))
          send({ opGcodeFile: "printprt:" + f.path }, "Impressão solicitada");
      });
      var bd = document.createElement("button"); bd.textContent = "Excluir"; bd.className = "danger ghost";
      bd.addEventListener("click", function () {
        if (confirm("Excluir definitivamente:\n" + f.name + " ?")) {
          send({ opGcodeFile: "deleteprt:" + f.path }, "Excluído");
          setTimeout(function () { client.reqFiles(); }, 600);
        }
      });
      act.appendChild(bp); act.appendChild(bd);
      el.appendChild(row);
    });
  }

  function renderHistory(list) {
    var el = $("#history");
    if (!list || !list.length) { el.innerHTML = '<p class="hint">Sem registros.</p>'; return; }
    el.innerHTML = "";
    list.forEach(function (h) {
      var row = document.createElement("div");
      row.className = "file-row";
      var name = h.name || h.printName || h.fileName || h.file || "—";
      var dur = h.timeCost || h.printTime || h.totalTime;
      var ok = (h.result === 1 || h.state === 1 || h.status === "completed");
      row.innerHTML = '<div class="file-main"><div class="file-name">' + escapeHtml(name) + '</div>' +
        '<div class="file-sub muted">' + (dur ? M.fmtDuration(dur) : "") + '</div></div>' +
        '<div class="badge ' + (ok ? "auto on" : "") + '">' + (ok ? "ok" : (h.result != null ? "falhou" : "")) + '</div>';
      el.appendChild(row);
    });
  }

  function renderVideo(list) {
    var el = $("#video");
    if (!list || !list.length) { el.innerHTML = '<p class="hint">Nenhum timelapse.</p>'; return; }
    el.innerHTML = "";
    list.forEach(function (v) {
      var name = v.name || v.fileName || v.file || "vídeo";
      var url = v.url || v.path || "";
      var row = document.createElement("div");
      row.className = "file-row";
      row.innerHTML = '<div class="file-main"><div class="file-name">' + escapeHtml(name) + '</div></div>';
      if (url && connectedIp) {
        var a = document.createElement("a");
        a.href = /^https?:/.test(url) ? url : ("http://" + connectedIp + url);
        a.target = "_blank"; a.textContent = "abrir"; a.className = "link";
        row.appendChild(a);
      }
      el.appendChild(row);
    });
  }

  // ================= CÂMERA =================
  function setCam(on) {
    camOn = on;
    var img = $("#cam"), off = $("#cam-off");
    if (on && connectedIp) {
      img.src = "http://" + connectedIp + ":8080/?action=stream";
      img.hidden = false; off.hidden = true;
    } else {
      img.removeAttribute("src"); img.hidden = true; off.hidden = false;
    }
  }

  // ================= WIRING =================
  function wireDashboard() {
    // Temperaturas
    $$("button[data-set]").forEach(function (b) {
      b.addEventListener("click", function () {
        var which = b.getAttribute("data-set");
        var off = b.getAttribute("data-off");
        var val = off ? 0 : parseInt(($("#set-" + which).value || "0"), 10) || 0;
        if (which === "nozzle") send({ nozzleTempControl: val }, "Bico → " + val + "°C");
        else if (which === "bed") send({ bedTempControl: { num: 0, val: val } }, "Mesa → " + val + "°C");
      });
    });
    // LED
    $("#led").addEventListener("change", function () { send({ lightSw: this.checked ? 1 : 0 }); });
    // Velocidade presets
    $("#speed-presets").addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b) return;
      var mode = parseInt(b.getAttribute("data-mode"), 10);
      var pct = parseInt(b.getAttribute("data-pct"), 10);
      send({ speedMode: mode, setFeedratePct: pct }, "Velocidade → " + pct + "%");
    });
    // Ventiladores
    [["fan-model", "fan"], ["fan-case", "fanCase"], ["fan-aux", "fanAuxiliary"]].forEach(function (pair) {
      var el = $("#" + pair[0]);
      el.addEventListener("input", function () { $("#" + pair[0] + "-v").textContent = el.value + "%"; });
      el.addEventListener("change", function () {
        var p = {}; p[pair[1]] = parseInt(el.value, 10);
        send(p, "Ventilador → " + el.value + "%");
      });
    });
    // Controle de impressão
    $("#btn-pause").addEventListener("click", function () { if (confirm("Pausar a impressão?")) send({ pause: 1 }, "Pausando…"); });
    $("#btn-resume").addEventListener("click", function () { send({ pause: 0 }, "Retomando…"); });
    $("#btn-stop").addEventListener("click", function () { if (confirm("Cancelar a impressão?")) send({ stop: 1 }, "Cancelando…"); });
    // Câmera
    $("#cam-toggle").addEventListener("click", function () { setCam(!camOn); });
  }

  function wireCfsControls() {
    $("#btn-feed").addEventListener("click", function () {
      if (!selected) return toast("Selecione um slot", "bad");
      send({ feedInOrOut: { boxId: selected.boxId, materialId: selected.slotId, isFeed: 1 } }, "Carregando filamento…");
    });
    $("#btn-retract").addEventListener("click", function () {
      if (!selected) return toast("Selecione um slot", "bad");
      send({ feedInOrOut: { boxId: selected.boxId, materialId: selected.slotId, isFeed: 0 } }, "Retraindo filamento…");
    });
    $("#btn-refresh-rfid").addEventListener("click", function () {
      if (!selected) return toast("Selecione um slot", "bad");
      send({ refreshBox: { boxId: selected.boxId, materialId: selected.slotId } }, "Relendo RFID…");
      setTimeout(function () { client.refresh(); }, 800);
    });
    $("#cfg-auto").addEventListener("change", function () {
      boxConfig.autoRefill = this.checked ? 1 : 0;
      send({ boxConfig: boxConfig }, "AUTO " + (boxConfig.autoRefill ? "ligado" : "desligado"));
    });
    $("#cfg-autofeed").addEventListener("change", function () {
      boxConfig.cAutoFeed = this.checked ? 1 : 0;
      send({ boxConfig: boxConfig }, "Auto-feed " + (boxConfig.cAutoFeed ? "ligado" : "desligado"));
    });
    $("#btn-dry").addEventListener("click", function () {
      var v = parseInt($("#dry-temp").value || "0", 10) || 0;
      send({ boxTempControl: v }, "Secagem → " + v + "°C");
    });
    $("#btn-dry-off").addEventListener("click", function () { send({ boxTempControl: 0 }, "Secagem parada"); });
    // editar slot (modal)
    $("#btn-edit").addEventListener("click", openEdit);
    $("#edit-cancel").addEventListener("click", function () { $("#edit-modal").hidden = true; });
    $("#edit-save").addEventListener("click", saveEdit);
  }

  function openEdit() {
    var sel = selectedSlot();
    if (!sel) return toast("Selecione um slot", "bad");
    $("#edit-label").textContent = sel.box.slotLabel(sel.slot.id);
    $("#edit-type").value = sel.slot.type || "";
    $("#edit-vendor").value = sel.slot.vendor || "";
    $("#edit-name").value = sel.slot.product || "";
    $("#edit-color").value = sel.slot.color && /^#[0-9a-f]{6}$/i.test(sel.slot.color) ? sel.slot.color : "#22c55e";
    $("#edit-min").value = sel.slot.minTemp || "";
    $("#edit-max").value = sel.slot.maxTemp || "";
    $("#edit-modal").hidden = false;
  }
  function saveEdit() {
    if (!selected) return;
    var params = { modifyMaterial: {
      boxId: selected.boxId, id: selected.slotId,
      type: $("#edit-type").value.trim(),
      vendor: $("#edit-vendor").value.trim(),
      name: $("#edit-name").value.trim(),
      color: $("#edit-color").value,
      minTemp: parseInt($("#edit-min").value || "0", 10) || 0,
      maxTemp: parseInt($("#edit-max").value || "0", 10) || 0
    } };
    send(params, "Slot atualizado");
    $("#edit-modal").hidden = true;
    setTimeout(function () { client.refresh(); }, 800);
  }

  function wireControlTab() {
    $$("button[data-home]").forEach(function (b) {
      b.addEventListener("click", function () {
        send({ autohome: b.getAttribute("data-home") }, "Home " + b.getAttribute("data-home"));
      });
    });
    $("#steps").addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b) return;
      jogStep = parseFloat(b.getAttribute("data-step"));
      $$("#steps button").forEach(function (x) { x.classList.remove("active"); });
      b.classList.add("active");
    });
    $$("button[data-jog]").forEach(function (b) {
      b.addEventListener("click", function () {
        var j = b.getAttribute("data-jog");          // ex.: "X+", "Z-"
        var axis = j.charAt(0), sign = j.charAt(1) === "-" ? "-" : "";
        send({ setPosition: axis + sign + jogStep + " F3000" }, "Jog " + j + " " + jogStep);
      });
    });
    $$("button[data-zoff]").forEach(function (b) {
      b.addEventListener("click", function () {
        send({ setZOffset: b.getAttribute("data-zoff") }, "Z-offset " + b.getAttribute("data-zoff"));
      });
    });
    $("#btn-gcode").addEventListener("click", function () {
      var v = $("#gcode-in").value.trim();
      if (v) { send({ gcodeCmd: v }, "G-code enviado"); $("#gcode-in").value = ""; }
    });
    $("#gcode-in").addEventListener("keydown", function (e) { if (e.key === "Enter") $("#btn-gcode").click(); });
  }

  function wireListTabs() {
    $("#files-refresh").addEventListener("click", function () { client && client.reqFiles(); toast("Atualizando…"); });
    $("#history-refresh").addEventListener("click", function () { client && client.reqHistory(); toast("Atualizando…"); });
    $("#video-refresh").addEventListener("click", function () { client && client.reqVideos(); toast("Atualizando…"); });
  }

  function wireTabs() {
    elTabs.addEventListener("click", function (e) {
      var b = e.target.closest(".tab"); if (!b) return;
      var name = b.getAttribute("data-tab");
      $$(".tab").forEach(function (x) { x.classList.toggle("active", x === b); });
      $$(".tabpane").forEach(function (p) {
        var on = p.getAttribute("data-pane") === name;
        p.classList.toggle("active", on); p.hidden = !on;
      });
      // lazy-load list tabs on first open
      if (name === "files") client && client.reqFiles();
      else if (name === "history") client && client.reqHistory();
      else if (name === "video") client && client.reqVideos();
    });
  }

  // ================= conexão =================
  function connect() {
    var ip = elIp.value.trim();
    if (!ip) { elIp.focus(); return; }
    connectedIp = ip;
    localStorage.setItem("cfs_ip", ip);
    if (!client) client = new CFSClient({ onBoxsInfo: onBoxsInfo, onBoxConfig: onBoxConfig,
      onTelemetry: onTelemetry, onList: onList, onStatus: setStatus });
    client.connect(ip);
  }

  function demo() {
    if (client) client.disconnect(true);
    setStatus("connected");
    fetch("references/sample-boxinfo.json", { cache: "no-cache" }).then(function (r) { return r.json(); })
      .then(function (s) {
        var bi = (s.boxsInfo && s.boxsInfo.boxsInfo) || s.boxsInfo;
        var bc = (s.boxConfig && s.boxConfig.boxConfig) || s.boxConfig;
        if (bc) onBoxConfig(bc);
        if (bi) onBoxsInfo(bi);
      }).catch(function () { toast("Amostra não encontrada (Demo indisponível na impressora)", "bad"); });
  }

  // ================= init =================
  (function init() {
    M.loadCatalog().then(function () {
      var saved = localStorage.getItem("cfs_ip");
      if (saved) elIp.value = saved;
      else {
        var host = location.hostname;
        if (host && host !== "localhost" && host !== "127.0.0.1") elIp.value = host;
      }
    });
    $("#btn-connect").addEventListener("click", connect);
    $("#btn-demo").addEventListener("click", demo);
    elIp.addEventListener("keydown", function (e) { if (e.key === "Enter") connect(); });
    setCam(false);
    wireDashboard();
    wireCfsControls();
    wireControlTab();
    wireListTabs();
    wireTabs();
  })();
})();
