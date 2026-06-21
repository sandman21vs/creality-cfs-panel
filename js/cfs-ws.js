/* WebSocket client for the Creality control port (9999).
   The browser handles the WS handshake; we just send JSON get/set commands and
   ack the periodic "heart_beat" so the printer keeps the connection open. */
(function (global) {
  "use strict";

  function CFSClient(opts) {
    this.onBoxsInfo = opts.onBoxsInfo || function () {};
    this.onBoxConfig = opts.onBoxConfig || function () {};
    this.onStatus = opts.onStatus || function () {};
    this.pollMs = opts.pollMs || 3000;
    this.ws = null;
    this.ip = null;
    this._poll = null;
    this._reconnect = null;
    this._closedByUser = false;
  }

  CFSClient.prototype.connect = function (ip) {
    this.disconnect(true);
    this._closedByUser = false;
    this.ip = ip;
    this.onStatus("connecting");
    let ws;
    try {
      ws = new WebSocket("ws://" + ip + ":9999/");
    } catch (e) {
      this.onStatus("error", String(e));
      return;
    }
    this.ws = ws;

    ws.onopen = () => {
      this.onStatus("connected");
      this.refresh();
      this._poll = setInterval(() => this.refresh(), this.pollMs);
    };

    ws.onmessage = (ev) => {
      const raw = typeof ev.data === "string" ? ev.data : "";
      if (raw.indexOf("heart_beat") !== -1) { try { ws.send("ok"); } catch (e) {} return; }
      let msg;
      try { msg = JSON.parse(raw); } catch (e) { return; }
      if (msg && msg.boxsInfo)  this.onBoxsInfo(msg.boxsInfo);
      if (msg && msg.boxConfig) this.onBoxConfig(msg.boxConfig);
    };

    ws.onclose = () => {
      clearInterval(this._poll); this._poll = null;
      if (this._closedByUser) return;
      this.onStatus("disconnected");
      this._reconnect = setTimeout(() => this.connect(ip), 2500);
    };
    ws.onerror = () => { this.onStatus("error"); };
  };

  CFSClient.prototype.refresh = function () {
    this._get("boxsInfo");
    this._get("boxConfig");
  };

  CFSClient.prototype._get = function (key) {
    if (!this.ws || this.ws.readyState !== 1) return;
    const p = {}; p[key] = 1;
    try { this.ws.send(JSON.stringify({ method: "get", params: p })); } catch (e) {}
  };

  // For v2+: send a "set" command, e.g. set({feedInOrOut:{boxId,materialId,isFeed}})
  CFSClient.prototype.set = function (params) {
    if (!this.ws || this.ws.readyState !== 1) return false;
    try { this.ws.send(JSON.stringify({ method: "set", params: params })); return true; }
    catch (e) { return false; }
  };

  CFSClient.prototype.disconnect = function (silent) {
    this._closedByUser = true;
    clearInterval(this._poll); this._poll = null;
    clearTimeout(this._reconnect); this._reconnect = null;
    if (this.ws) { try { this.ws.close(); } catch (e) {} this.ws = null; }
    if (!silent) this.onStatus("disconnected");
  };

  global.CFSClient = CFSClient;
})(window);
