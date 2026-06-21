# Device API — WS:9999 (Creality) — referência completa

Extraído da web app do CrealityPrint (`resources/web/deviceMgr`) e verificado na K1C real.
Para o CFS especificamente, ver também [cfs-api.md](cfs-api.md).

## Conexão

- `ws://<ip>:9999/` — o navegador faz o handshake (101). Frames **TEXT**.
- A impressora envia `heart_beat` periódico → responder com o texto `ok`.
- Após conectar, o printer **empurra telemetria** (objetos JSON) continuamente. Também dá pra
  pedir dados: `{"method":"get","params":{<chave>:1}}`. Comandos: `{"method":"set","params":{…}}`.

## Telemetria (campos empurrados — para LEITURA)

Parsear no `onmessage` (os campos aparecem em mensagens de status):

| Campo | Significado |
|---|---|
| `nozzleTemp`, `targetNozzleTemp`, `nozzleTemp2` | temp bico atual/alvo (2 = segundo bico) |
| `bedTemp0`, `targetBedTemp0`, `bedTemp2` | temp mesa atual/alvo |
| `boxTemp` | temp da câmara |
| `fanPct` / `fan`, `fanCase`, `fanAuxiliary` | % dos ventiladores (modelo/caso/lateral) |
| `lightSw` | LED on/off |
| `curFeedratePct` | velocidade de impressão (%) |
| `printProgress` | progresso (%) |
| `printJobTime`, `printLeftTime` | tempo decorrido / restante |
| `TotalLayer`, `layer` | camadas |
| `printName` | nome do arquivo em impressão |
| `curPosition` | posição X/Y/Z |
| `deviceState` / `printStatus` | estado (idle/printing/paused/…) |

## Comandos SET (controle)

### Temperaturas
```jsonc
{"method":"set","params":{"nozzleTempControl": 220}}          // bico
{"method":"set","params":{"bedTempControl": {"num":0,"val":60}}} // mesa (num=índice)
// câmara: via gcode, ex.: {"method":"set","params":{"gcodeCmd":"M141 S35"}} (confirmar macro)
```
### LED / Ventiladores
```jsonc
{"method":"set","params":{"lightSw": 1}}            // 0/1
{"method":"set","params":{"fan": 100}}              // ventilador do modelo (0..100)  (ou gcodeCmd "M106 P0 S<0..255>")
{"method":"set","params":{"fanCase": 100}}          // ventilador do caso          (M106 P2)
{"method":"set","params":{"fanAuxiliary": 100}}     // ventilador lateral/aux       (M106 P1)
```
### Velocidade
```jsonc
{"method":"set","params":{"speedMode":0,"setFeedratePct": 100}} // presets: Silencioso/Estável50/Padrão100/Ultra125
{"method":"set","params":{"setFeedratePct": 100}}
```
### Controle de impressão
```jsonc
{"method":"set","params":{"pause": 1}}   // 1=pausa, 0=retoma
{"method":"set","params":{"stop": 1}}    // cancela
```
### Movimento (aba Controle XYZ)
```jsonc
{"method":"set","params":{"autohome":"X Y Z"}}            // ou "X", "Y", "Z", "X Y"
{"method":"set","params":{"setPosition":"X10 F3000"}}     // jog relativo (X/-X/Y/-Y/Z/-Z + passo)
{"method":"set","params":{"setZOffset":"+0.01"}}          // baby-step Z
```
### Arquivos (aba Arquivos locais)
```jsonc
{"method":"get","params":{"pFileList": 1, "onePageNum": 50}}      // listar (paginado)
{"method":"set","params":{"opGcodeFile":"printprt:<path>/<file>"}} // imprimir
{"method":"set","params":{"opGcodeFile":"deleteprt:<path>/<file>"}}// excluir
{"method":"set","params":{"opGcodeFile":"renameprt:<old>::<new>"}} // renomear (confirmar separador)
```
### CFS (aba Filamento) — detalhes em cfs-api.md
```jsonc
{"method":"get","params":{"boxsInfo":1}}
{"method":"get","params":{"boxConfig":1}}
{"method":"set","params":{"feedInOrOut":{"boxId":1,"materialId":0,"isFeed":1}}}    // 1=feed,0=retract
{"method":"set","params":{"boxConfig":{"autoRefill":1,"cAutoFeed":1,"cSelfTest":0}}}
{"method":"set","params":{"boxTempControl": 50}}                                    // secagem
{"method":"set","params":{"refreshBox":{"boxId":1,"materialId":0}}}                 // reler RFID
{"method":"set","params":{"modifyMaterial":{"boxId":1,"id":0,"type":"PLA","vendor":"Creality","name":"Hyper PLA","color":"#RRGGBB","minTemp":190,"maxTemp":230,"pressure":0.04}}}
{"method":"set","params":{"feedOption": 2}}   // 0/1/2 — opções de runout/continuação (confirmar semântica)
```
### Outras leituras úteis
```jsonc
{"method":"get","params":{"reqGcodeFile":1,"reqGcodeList":1,"reqMaterials":1,"boxsInfo":1,"boxConfig":1}} // bulk
{"method":"get","params":{"reqHistory":1}}        // histórico (aba Registros)
{"method":"get","params":{"reqElapseVideoList":1}}// timelapses (aba Vídeo)
{"method":"get","params":{"spaceInfo":1}}         // espaço em disco
```

## Câmera
`http://<ip>:8080/?action=stream` (MJPEG) — usar direto num `<img>`. Snapshot: `?action=snapshot`.

## A confirmar na implementação (testar na K1C)
- Comando exato da **temperatura da câmara** (gcode M141? ou chave própria).
- Separador do **renameprt**.
- Semântica de **feedOption 0/1/2** (provavelmente: cancelar / continuar / etc. no runout).
- Índices de ventilador vs `M106 P0/P1/P2` por modelo.
