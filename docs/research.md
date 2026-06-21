# Pesquisa — o que já existe (jun/2026)

Objetivo: confirmar se já há um painel visual de CFS pro Mainsail/Fluidd e mapear o que dá pra reaproveitar.

## Klipper-side (controle do CFS) — já existe

- **[ityshchenko/klipper-cfs](https://github.com/ityshchenko/klipper-cfs)** — módulo Python que comunica/controla o
  CFS (leitura de sensores, controle de motor). É a camada de baixo nível.
- **[CrealityOfficial/K1_Series_Klipper](https://github.com/CrealityOfficial/K1_Series_Klipper/blob/main/docs/G-Codes.md)**
  — firmware Klipper oficial do K1; documenta os macros `BOX_*` (load/quit/cut/extrude...).
- Mods da comunidade: split do purge no START_PRINT, retrude-antes-do-corte (economia de filamento),
  tudo em macros Klipper (ex.: blog do Frederick Altrock).

## Helper Script (rooted K1) — já existe

- **[Guilouz/Creality-Helper-Script](https://guilouz.github.io/Creality-Helper-Script-Wiki/)** — base (instala
  Klipper/Moonraker/Fluidd/Mainsail, mods, etc.) em K1 rooteada.
- Forks com suporte a CFS: **[Nik-oli/Creality-Helper-Script-K1-CFS](https://github.com/Nik-oli/Creality-Helper-Script-K1-CFS)**
  e **[gebauer/Creality-Helper-Script-K1-CFS](https://github.com/gebauer/Creality-Helper-Script-K1-CFS)**.
- Discussões de suporte a CFS: [#760](https://github.com/Guilouz/Creality-Helper-Script-Wiki/discussions/760),
  [#787](https://github.com/Guilouz/Creality-Helper-Script-Wiki/discussions/787).

## Slicer-side (sync) — já existe / em andamento

- **OrcaSlicer**: PR #13752 (merged, base K-series), PRs abertos #14192 (Moonraker box) e #14089 (K1 via WS:9999).
- **Nosso fork** [OrcaSlicer-k1c-cfs](https://github.com/sandman21vs/OrcaSlicer-k1c-cfs): sync + Feed/Retrair +
  % restante + catálogo de materiais.

## Mainsail/Fluidd — a LACUNA

- **Mainsail não tem sistema de plugin/componentes.** Extensão possível só via:
  - **Macros como botões** no dashboard (Expert mode, grupos de macros) — sem painel rico;
    feature request aberta para expor comandos nativos como botões:
    [mainsail#1626](https://github.com/mainsail-crew/mainsail/issues/1626).
  - **Temas** (CSS/aparência) — não adiciona funcionalidade.
  - **Fork do Mainsail** (Vue) — adiciona painel nativo, mas custo de manutenção alto contra o upstream.
- **Não foi encontrado** nenhum painel visual de CFS (ver slots + Feed/Retrair + AUTO + secagem) para
  Mainsail/Fluidd. → **é a oportunidade deste projeto.**

## Conclusão / decisão de abordagem

Como não há API de plugin no Mainsail, a rota mais sustentável é um **painel web standalone leve** que:
1. lê o estado do CFS pelo **Moonraker** (objeto `box`, porta 7125/proxy),
2. envia comandos pelo **WS:9999** (`feedInOrOut`, `boxConfig`, `boxTempControl`) — paridade com o CrealityPrint —
   e/ou por **macros `BOX_*`** via Moonraker (modo "Klipper-native"),
3. é **servido junto do Mainsail** (nginx do Helper Script) e linkado a partir dele,
4. é **empacotável como add-on do Helper Script**.

Alternativas consideradas e descartadas (por enquanto): fork do Mainsail (manutenção), só macros-botões (UX pobre).
