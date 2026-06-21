# Creality CFS Panel

Um painel web para **ver e controlar o CFS (Creality Filament System)** em impressoras
Creality K1/K1C/K1 Max **rooteadas com Klipper + Moonraker** — recriando, fora do
CrealityPrint, as funções do painel "Configurações do filamento": ver os slots
(cor/tipo/produto/% restante), **carregar (Feed) / descarregar (Retrair)** por slot,
**AUTO** (auto-refill/continuidade) e **secagem**.

> ⚠️ Projeto independente, em fase de concepção. Para impressoras rooteadas (Helper Script).
> Reaproveita as descobertas e o catálogo de materiais do fork
> [OrcaSlicer-k1c-cfs](https://github.com/sandman21vs/OrcaSlicer-k1c-cfs).

## Objetivo

1. **Painel web do CFS** acessível junto do Mainsail/Fluidd (ou standalone).
2. **Integração futura no [Creality Helper Script](https://guilouz.github.io/Creality-Helper-Script-Wiki/)**
   como add-on instalável (ex.: forks K1-CFS do Nik-oli/gebauer).
3. **Reuso do fork OrcaSlicer**: mesmo schema do objeto `box`, mesmo comando de
   feed/retração e o **catálogo de materiais** (`filamentId → produto`).

## Por que um painel novo (e não um "plugin Mainsail")

O **Mainsail não tem API de plugin/componentes**. As únicas formas de estender são:
macros como botões no dashboard (sem painel rico), temas (CSS), ou **fork** do Mainsail.
Logo, a abordagem recomendada é um **painel web standalone leve** (HTML/JS ou Vue) que
fala direto com o **Moonraker** (e, quando preciso, com o WebSocket 9999 da Creality),
e que pode ser **servido ao lado do Mainsail** (mesma stack nginx do Helper Script) e
linkado a partir dele. Mais simples de manter que um fork do Mainsail e portável pro
Helper Script.

Ver alternativas e trade-offs em [docs/research.md](docs/research.md).

## O que já existe (e o que falta)

| Peça | Existe? | Projeto |
|---|---|---|
| Módulo Klipper p/ CFS | ✅ | [ityshchenko/klipper-cfs](https://github.com/ityshchenko/klipper-cfs) |
| Macros `BOX_*` (load/quit/cut...) | ✅ | [K1_Series_Klipper](https://github.com/CrealityOfficial/K1_Series_Klipper) |
| Helper Script p/ K1 CFS | ✅ | [Nik-oli](https://github.com/Nik-oli/Creality-Helper-Script-K1-CFS) / [gebauer](https://github.com/gebauer/Creality-Helper-Script-K1-CFS) |
| Sync de filamento no slicer | ✅ | nosso fork OrcaSlicer + PRs #13752/#14192 |
| **Painel visual de CFS no Mainsail/Fluidd** | ❌ | **(este projeto)** |

## Arquitetura proposta (rascunho)

- **Leitura de estado:** `GET http://<ip>:7125/printer/objects/query?box` (Moonraker) →
  objeto `box` com `same_material`, `T1..T4` (`material_type`, `color_value`,
  `remain_len`, `state`). Detecção dinâmica via `/printer/objects/list` (procura `box`).
- **Controle (Feed/Retrair):** WebSocket porta **9999** com
  `{"method":"set","params":{"feedInOrOut":{"boxId":B,"materialId":S,"isFeed":1|0}}}`
  (CFS = boxId 1; boxId 0 = suporte externo). Alternativa "Klipper-native": macros
  `BOX_LOAD_MATERIAL_*` / `BOX_QUIT_MATERIAL` via `/printer/gcode/script`.
- **AUTO / continuidade:** `{"method":"set","params":{"boxConfig":{"autoRefill":..,"cAutoFeed":..}}}`.
- **Secagem:** `{"method":"set","params":{"boxTempControl":<temp>}}`.
- **Nomes de produto:** catálogo `filamentId → (vendor, produto, tipo)` (66 entradas)
  reaproveitado do fork — ver [docs/cfs-api.md](docs/cfs-api.md).

## Roadmap (proposto)

1. **MVP read-only:** página que lê o `box` via Moonraker e mostra os 4 slots
   (cor + tipo + produto via catálogo + % restante).
2. **Feed/Retrair** por slot (WS:9999 `feedInOrOut`), com seleção de slot.
3. **AUTO (auto-refill)** e **secagem**.
4. **Empacotar como add-on do Helper Script** (servir via nginx + entrada no menu).
5. (Opcional) avaliar contribuir um modo "Klipper-native" (só macros) p/ quem não quer o WS 9999.

## Status

- [x] Pesquisa inicial (landscape + lacuna) — [docs/research.md](docs/research.md)
- [x] API reutilizável documentada — [docs/cfs-api.md](docs/cfs-api.md)
- [ ] Decisão de stack (HTML/JS puro vs Vue) e forma de servir
- [ ] MVP read-only
