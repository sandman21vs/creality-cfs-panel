# CFS API — referência reutilizável (verificado em K1C, jun/2026)

Tudo aqui foi verificado numa **K1C real** (firmware 1.0.0, CFS/box `version 1.1.3`) durante o
desenvolvimento do fork OrcaSlicer-k1c-cfs. É a base técnica deste painel.

## Portas

| Porta | Serviço |
|------|---------|
| 80 | API/UI de controle da Creality (SPA Vue). NÃO é o Moonraker. |
| 4408 / 4409 | Fluidd / Mainsail (nginx proxy → Moonraker) |
| 7125 | **Moonraker** (direto) |
| 9999 | **WebSocket de controle da Creality** (`{"method":"set"/"get",...}`) |

## Ler o estado do CFS (Moonraker)

Detecção dinâmica (sem allowlist de modelo):
```bash
curl -s "http://<ip>:7125/printer/objects/list"      # procure o objeto "box"
curl -s "http://<ip>:7125/printer/objects/query?box" # estado do CFS
```

Schema do objeto `box` (resumo):
```jsonc
"box": {
  "same_material": [
    ["103001","0000000",["T1A"],"ABS"],   // [filamentId, "0RRGGBB", [label], tipo]
    ["114001","00B359A",["T1B"],"PLA"], ...
  ],
  "T1": {                                  // uma unidade (T1..T4)
    "state": "connect",                    // "None" quando ausente
    "material_type": ["103001","114001","104001","101001"],
    "color_value":   ["0000000","00B359A","0F8E911","0FA7C0C"],  // "0RRGGBB"
    "remain_len":    ["41","29","100","41"],                     // % restante por slot
    "temp": 28.0, "humidity": 24.0
  },
  "T2".."T4": { "state": "None", ... }
}
```
- **Label `T<unidade><slot>`**: unidade 1..4, slot A..D → índice global 0-based = `(unidade-1)*4 + (A..D)`.
- **Cor** vem como `"0RRGGBB"` (7 hex) → use os 6 finais → `#RRGGBB`.
- **% restante**: `T<n>.remain_len[slot]`.

> O mesmo `boxsInfo` também é obtido pela **WS:9999** (`{"method":"get","params":{"boxsInfo":1}}`), onde os
> slots vêm com `boxId`/`materialId` explícitos (CFS = **boxId 1**; suporte externo = **boxId 0**, `type:1`).

## Controlar o CFS (WebSocket porta 9999)

Mesmos comandos que o CrealityPrint/UI da Creality enviam (`resources/web/deviceMgr`):

```jsonc
// Carregar (Feed) / Descarregar (Retrair) um slot:
{"method":"set","params":{"feedInOrOut":{"boxId":1,"materialId":0,"isFeed":1}}}  // feed
{"method":"set","params":{"feedInOrOut":{"boxId":1,"materialId":0,"isFeed":0}}}  // retract

// AUTO / continuidade (auto-refill):
{"method":"set","params":{"boxConfig":{"autoRefill":1,"cAutoFeed":1,"cSelfTest":0,"ignoreColorAutoFeed":0}}}

// Secagem (temperatura da caixa):
{"method":"set","params":{"boxTempControl":50}}

// Editar metadados de um slot:
{"method":"set","params":{"modifyMaterial":{"boxId":1,"id":0,"type":"PLA","vendor":"Creality","name":"Hyper PLA","color":"#RRGGBB",...}}}
```
- **boxId 1 = CFS**, boxId 0 = suporte de bobina externo (vazio na maioria dos casos).
- A 9999 é **WebSocket de verdade** (handshake `101`); a K1 usa frames **TEXT** e manda `heart_beat`
  periódico — responda `ok` pra manter a conexão (ver tratamento no #14089).

### Alternativa "Klipper-native" (sem WS proprietária)
Via `POST http://<ip>:7125/printer/gcode/script` com macros do firmware:
`BOX_LOAD_MATERIAL_WITH_MATERIAL`, `BOX_LOAD_MATERIAL_WITHOUT_MATERIAL`, `BOX_QUIT_MATERIAL`,
`BOX_INFO_REFRESH ADDR=<box> NUM=<slot>`, `MODIFY_BOX_CFG`/`SAVE_BOX_CFG`. (Mapeamento exato de slot a confirmar.)

## Catálogo de materiais (filamentId → produto)

O slot reporta um `filamentId` numérico (ex.: `103001`). Os **5 últimos dígitos** são o id de catálogo
(o 1º dígito é prefixo de série). Resolver isso dá o produto exato ("Hyper PLA", "CR-PLA Matte"...).

- **Tabela pronta (66 entradas):** reaproveitar de
  `OrcaSlicer-k1c-cfs/src/slic3r/Utils/CrealityMaterialCatalog.hpp` (fácil converter pra JSON).
- **Fonte original:** `/mnt/UDISK/creality/userdata/box/material_database.json` na impressora; espelhada no
  projeto comunitário **K2-RFID** (`db/{k1,k2,hi}.json`).

Exemplos validados na K1C: `101001`→Hyper PLA, `103001`→Hyper ABS, `104001`→CR-PLA, `114001`→CR-PLA Matte.

## Mapeamento de tool (impressão multicor)
O módulo `box` registra `Tn` nativamente: enviar `Tn` carrega o slot N (índice global). Útil pra remapear
filamento→slot reescrevendo `T0/T1...` no gcode (abordagem do PR #14192 do OrcaSlicer).
