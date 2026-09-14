# Atlas Vivo — simulador geopolítico em pixel art

Simulador de mapas geopolíticos inspirado na experiência de *Fantasy Map Simulator*, escrito do zero
(sem código, arte ou marcas do jogo original). Nações disputam territórios reais com população, economia,
tecnologia, governos, diplomacia, guerras com exércitos visíveis, batalhas, cercos, rebeliões e eventos,
tudo registrado em uma história navegável.

## Como executar

Requisitos: Node.js 20+.

```bash
npm install
npm run dev          # abre em http://127.0.0.1:5173
npm run build        # verificação de tipos + build de produção em dist/
npm run preview      # serve o build de produção
```

Os mapas já processados ficam em `public/maps/`. Para regenerá-los a partir dos dados brutos:

```bash
npm run fetch-data   # baixa Natural Earth e NASA Blue Marble para data-raw/
npm run build-maps   # gera public/maps/<mapa>/ (map.json, grid.dat, preview.png)
```

## Mapas

| Mapa | Projeção | Estados |
|---|---|---|
| Mapa Mundial | Miller | 1518 |
| Mapa das Américas | Miller | 368 |
| Mapa da Europa | Cônica conforme de Lambert | 697 |
| Mapa da Ásia + Oceania | Miller | 717 |
| Mapa Europa + Ásia | Miller | 967 |
| Mapa da África | Miller | 592 |

Cada mapa tem litorais, rios, lagos, relevo e vegetação reais. Os países são divididos em seus **estados reais**
(Natural Earth admin-1: estados, províncias ou regiões oficiais, conforme o país). Onde a divisão disponível é
fina demais (condados, departamentos, municípios), as unidades são agrupadas pela região oficial — regiões da
França e da Itália, comunidades autônomas da Espanha, Inglaterra/Escócia/Gales/Irlanda do Norte etc. Estados
pequenos demais para a escala do mapa, como cidades-estado encravadas (Berlim, Viena, Moscou), são fundidos ao
estado vizinho. Com `STATES_REPORT=<pasta>`, o `build-maps` grava a lista de estados de cada mapa para conferência.

## Controles

| Ação | Tecla / mouse |
|---|---|
| Mover o mapa | arrastar, WASD ou setas |
| Zoom | roda do mouse, `+` / `-`, pinça |
| Selecionar nação, estado, exército, batalha | clique |
| Ordenar movimento do exército selecionado | clique direito |
| Pausar / continuar | `Espaço` |
| Velocidade 1x, 2x, 5x, 10x, 25x, 50x, 100x | `1` … `7` |
| Avançar um dia (pausado) | `.` |
| Histórico / Guerras / Estatísticas | `H` / `G` / `E` |
| Centralizar na seleção | `F` |
| Fechar painel / menu do jogo | `Esc` |
| Salvamento rápido | `Ctrl+S` |

## Guerras

Por padrão, as nações **não fazem as pazes sozinhas**: uma guerra só termina quando um lado domina o outro ou quando
você decide, no painel da guerra (paz branca ou vitória de um dos lados). Durante a guerra, um estado ocupado por dois
anos passa a pertencer ao ocupante, a nação que perde o controle de todo o território é anexada e a guerra acaba quando
o líder de um dos lados é dominado. Um líder reduzido a no máximo dois estados, sem combates há três anos e muito mais
fraco que o inimigo, rende-se. Guerras paradas levam os exércitos a ofensivas mais ousadas. A opção "Nações fazem as
pazes sozinhas" (novo jogo ou configurações) restaura os tratados automáticos.

## Arquitetura

```
tools/                 pipeline de dados (Node): projeções, rasterização, terreno, estados, rotas marítimas
public/maps/           mapas processados (grade binária gzip + metadados)
src/core/              RNG determinístico, calendário, formatação, EventBus
src/data/              dados modulares: terrenos, governos, personalidades, religiões, culturas,
                       ideologias, tecnologias, eras, recursos, paleta
src/state/types.ts     GAME STATE: todo o estado serializável da partida
src/map/               MapData (grade, estados, cidades, grafo de adjacência)
src/sim/               SIMULATION LOGIC: Simulation, WorldIndex, Pathfinder, criação do mundo, ações do jogador
src/sim/engines/       Country, Province, City, Population, Economy, Tech, Government, Military,
                       Battle, War, Diplomacy, AI, ArmyAI, Event, Rebellion, History, Stats
src/render/            MAP RENDERING: câmera, camadas (terreno, político, rótulos, marcadores, unidades),
                       sprites em pixel art e modos de mapa
src/ui/                UI: telas, HUD, painéis (nação, estado, exército, batalha, guerra, histórico),
                       modais (estatísticas, configurações, salvar/carregar) e gráficos
src/persistence/       saves no IndexedDB (gzip), exportação/importação .avsave
src/app/               App (fluxo de telas) e GameLoop (velocidades)
scripts/               simulação sem interface e teste de ponta a ponta no navegador
```

A simulação avança em dias. Movimento de exércitos, batalhas e cercos são diários; economia, população,
diplomacia, guerras, rebeliões e eventos são mensais; tecnologia, governos e estatísticas são anuais.
Tudo é determinístico a partir da semente, e o estado completo (inclusive o RNG) é salvo.

## Pixel art

Ícones e sprites são desenhados em pixel art e exibidos com escala inteira, sem suavização. O mapa é uma
grade de células renderizada como textura nítida: com zoom, cada célula vira um bloco de pixels, com
símbolos de montanhas, florestas e dunas, fronteiras desenhadas e rótulos em fonte pixelada.

## Testes

```bash
npm run typecheck
npm run sim -- europe 100 renaissance 12345   # 100 anos sem interface + verificação de integridade
npm run e2e -- saida europe                   # Chrome headless com o servidor de dev rodando
```

O teste de ponta a ponta usa o Chrome instalado (`CHROME` pode apontar para outro executável) e salva
capturas de tela da partida, dos painéis, das estatísticas e do salvamento/carregamento.

## Créditos

Dados geográficos: Natural Earth e NASA Blue Marble (domínio público). Fontes: Pixelify Sans,
Jacquarda Bastarda 9 e Tiny5 (SIL Open Font License), via Fontsource.
