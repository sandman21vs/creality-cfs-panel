# Creality CFS Panel → Device Dashboard

Painel web (HTML/JS puro) que recria, **fora do CrealityPrint**, a página "Dispositivo" do
CrealityPrint para impressoras **Creality K1/K1C/K1 Max rooteadas (Klipper + Moonraker)**:
câmera, temperaturas, LED, ventiladores, velocidade, controle de impressão, **e o painel
do CFS** (ver slots + Feed/Retrair + AUTO + secagem + editar). Pensado para rodar ao lado
do Mainsail e ser empacotado no [Creality Helper Script](https://guilouz.github.io/Creality-Helper-Script-Wiki/).

> **Este README é o escopo completo + handoff** (o projeto cresceu de "painel CFS" para
> "dashboard de dispositivo"). Tudo que a próxima sessão precisa para continuar está aqui e
> em [docs/device-api.md](docs/device-api.md) (referência de comandos) e
> [docs/cfs-api.md](docs/cfs-api.md) (CFS) e [docs/research.md](docs/research.md) (landscape).

---

## Estado atual

- ✅ **v1 (FEITO):** painel **CFS read-only**. Conecta no WebSocket :9999, puxa `boxsInfo`+
  `boxConfig` e renderiza os slots (anel colorido, label `1A–1D`, tipo/produto via `boxsInfo`
  + catálogo, % restante, slot ativo, AUTO, temp/umidade da caixa). Tem modo **Demo** e
  auto-refresh/reconexão. Git iniciado (branch `main`, 1º commit).
- ⏳ **Próximo:** expandir para o **dashboard completo** (abaixo) e adicionar **controles** do CFS.

## Como rodar / continuar

```bash
cd C:/Users/vinic/Documents/GitHub/creality-cfs-panel
python -m http.server 8000      # serve o painel
# abrir http://localhost:8000  → botão "Demo" (amostra) ou IP 192.168.100.13 + Conectar
```
- Impressora de teste: **K1C em 192.168.100.13** (WS :9999 aberta; CFS com 4 slots).
- Amostra real para dev offline: `references/sample-boxinfo.json` (usada pelo Demo).
- `references/` tem clones de estudo (klipper-cfs, K1_Series_Klipper, Helper-Script-K1-CFS) — **fora do git**.

## Instalação na impressora (add-on)

K1/K1C/K1 Max **rooteadas** com o [Creality Helper Script](https://guilouz.github.io/Creality-Helper-Script-Wiki/)
(Moonraker + Nginx já instalados). Dois caminhos:

**A) Instalador standalone** (rápido, testável já) — via SSH na impressora:
```bash
git clone --depth 1 <repo-url> /usr/data/creality-cfs-panel-src
sh /usr/data/creality-cfs-panel-src/install.sh        # → http://<ip>:4410
sh /usr/data/creality-cfs-panel-src/uninstall.sh      # remover
```
Copia o painel p/ `/usr/data/creality-cfs-panel` e injeta um `server` block (porta **4410**)
no `nginx.conf` do Helper Script, de forma **idempotente**. Servido da própria impressora,
o painel já conecta no WS:9999 local (pré-preenche o host).

**B) Módulo do Helper Script** (entra no menu Install/Remove) — ver [helper-script/README.md](helper-script/README.md).

## Arquitetura

- **100% client-side** (sem backend). Servido por http (nginx do Helper Script / `http.server`).
- **WS:9999 (Creality)** é o transporte principal — mesmo que o CrealityPrint usa:
  - O navegador faz o handshake; a K1 usa frames **TEXT** e envia `heart_beat` → responder `"ok"`.
  - **Telemetria** chega empurrada pelo printer (temps, fans, progresso, posição…).
  - **Leitura sob demanda:** `{"method":"get","params":{<chave>:1}}` (`boxsInfo`, `boxConfig`,
    `pFileList`, `reqHistory`, `reqElapseVideoList`, …).
  - **Comandos:** `{"method":"set","params":{…}}`.
- **Câmera:** stream MJPEG em `http://<ip>:8080/?action=stream`.
- **Moonraker (:7125)** opcional para o objeto `box` (campos extras) e gcode; o caminho
  principal é o WS:9999 (paridade com CrealityPrint).
- **Catálogo de materiais** `js/materials.json` (66 itens, `filamentId→vendor/produto/tipo`),
  derivado do fork OrcaSlicer / projeto K2-RFID.

Toda a tabela de comandos `get`/`set` e os campos de telemetria estão em
[docs/device-api.md](docs/device-api.md).

## Escopo completo (espelhar a página "Dispositivo" do CrealityPrint)

Painéis da imagem de referência, cada um mapeado para WS:9999:

| Painel | Ler | Controlar |
|---|---|---|
| **Câmera** | MJPEG `:8080/?action=stream` | — |
| **Impressão atual** | `printStatus`/`deviceState`, `printProgress`, `printJobTime`, `printLeftTime`, `TotalLayer`/`layer`, `printName` | `set {pause:1/0}`, `set {stop:1}` |
| **Temperaturas** (mesa/bico/câmara) | `bedTemp0`/`targetBedTemp0`, `nozzleTemp`/`targetNozzleTemp`, `boxTemp` (câmara) | `set {bedTempControl:{num:0,val}}`, `set {nozzleTempControl:val}`, câmara via `gcodeCmd` |
| **LED** | `lightSw` | `set {lightSw:0/1}` |
| **Ventiladores** (modelo/caso/lateral) | `fanPct`, `fanCase`, `fanAuxiliary` | `set {fan:v}`, `set {fanCase:v}`, `set {fanAuxiliary:v}` (ou `gcodeCmd M106 P0/P1/P2 S`) |
| **Velocidade** (Silencioso/Estável 50/Padrão 100/Ultra 125) | `curFeedratePct` | `set {speedMode:n, setFeedratePct:v}` |
| **Aba Controle XYZ** | `curPosition` | `set {autohome:"X Y Z"}`, `set {setPosition:"X<d> F3000"}`, `set {setZOffset:"+/-<d>"}` |
| **Aba Arquivos locais** | `get {pFileList:…, onePageNum}` | `set {opGcodeFile:"printprt:<path>"}` / `"deleteprt:…"` / `"renameprt:…"` |
| **Aba Registros** | `get {reqHistory:1}` | — |
| **Aba Vídeo** | `get {reqElapseVideoList:1}` | — |
| **Aba Filamento (CFS)** | `get {boxsInfo:1}`, `get {boxConfig:1}` | `feedInOrOut`, `boxConfig`, `boxTempControl`, `modifyMaterial`, `refreshBox`, `feedOption` (ver docs/cfs-api.md) |

## Roadmap

1. **v1 — CFS read-only** ✅
2. **v2 — CFS controles:** selecionar slot + **Feed/Retrair** (`feedInOrOut`); **AUTO** (`boxConfig`);
   **secagem** (`boxTempControl`); **editar slot** (`modifyMaterial`); **refresh RFID** (`refreshBox`).
3. **v3 — Telemetria + topo do dashboard:** parsear o stream WS; painéis **Temperaturas**, **LED**,
   **Ventiladores**, **Velocidade**, **Impressão atual** (com pause/resume/stop) e **Câmera** (MJPEG).
4. **v4 — Abas:** **Controle XYZ** (jog/home/z-offset), **Arquivos locais** (listar/imprimir/excluir),
   **Registros**, **Vídeo**.
5. **v5 — Empacotamento:** ✅ instalador standalone (`install.sh`/`uninstall.sh`, nginx :4410) +
   módulo do Helper Script (`helper-script/`). ⏳ Falta: criar repo no GitHub + push; link no Mainsail.

## Estrutura de arquivos

```
creality-cfs-panel/
├── index.html            # layout (v1: CFS; crescerá p/ dashboard com abas)
├── css/styles.css        # tema dark estilo CrealityPrint
├── js/
│   ├── cfs-ws.js         # cliente WS:9999 (handshake/heartbeat/get/set/reconnect) — reusar p/ tudo
│   ├── cfs-model.js      # parse boxsInfo/boxConfig + catálogo + normalização de cor
│   ├── materials.json    # catálogo filamentId->produto (66)
│   └── app.js            # render + auto-refresh (v1); crescerá p/ telemetria + abas
├── docs/
│   ├── device-api.md     # referência COMPLETA de comandos get/set + telemetria  ← LER
│   ├── cfs-api.md        # protocolo WS:9999 + schema boxsInfo + boxId + portas
│   └── research.md       # o que já existe (klipper-cfs, helper scripts) + a lacuna
└── references/           # clones de estudo (gitignored)
```

## Notas / gotchas (importante p/ a próxima sessão)

- **Portas:** 9999 = WS controle Creality (principal) · 8080 = câmera MJPEG · 7125 = Moonraker · 80 = SPA Creality.
- **WS:9999:** frames **TEXT**; responder `"ok"` ao `heart_beat`; a telemetria vem empurrada (parsear no `onmessage`).
- **boxsInfo:** msg = `{"boxsInfo":{materialBoxs:[…], same_material:[…]}}`. **boxId 1 = CFS**, **boxId 0 = suporte externo** (type 1).
- **Cor:** `"#0RRGGBB"` → usar os 6 hex finais (`#RRGGBB`).
- **Produto exato:** `boxsInfo` já traz `name`/`vendor`/`type`; catálogo é fallback via `rfid` (id de 5 díg.).
- **Controle precisa do WS:9999** (não dá só por Moonraker). Para impressora não-rooteada isso pode não existir — público-alvo é K1 rooteada (Helper Script).
- **Validar sempre** contra a K1C real (192.168.100.13) e comparar lado a lado com o CrealityPrint.
