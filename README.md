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
| Tecnologias | `T` |
| Centralizar na seleção | `F` |
| Fechar painel / menu do jogo | `Esc` |
| Salvamento rápido | `Ctrl+S` |

## Eras e tecnologia

A era é definida pelo ano da simulação: **Era Medieval** (476–1453), **Era Moderna** (1454–1759), **Primeira Revolução**
(1760–1850), **Segunda Revolução** (1851–1969), **Terceira Revolução** (1970–2010) e **Quarta Revolução** (2011 em
diante). A mudança de era é registrada no histórico, mas não libera tecnologia nenhuma: ela só dá o contexto histórico.

O banco de tecnologias (`src/data/technologies/`) reúne 327 descobertas e invenções, da irrigação e da roda à IA
generativa, cada uma com data histórica, categoria, origem real, custo base, complexidade, recursos e infraestrutura
necessários, efeitos, dependências, tecnologias desbloqueadas, valor estratégico, raridade e tempos para dominar e
produzir. `npm run techs` valida datas, dependências (sempre anteriores e sem ciclos), eras, categorias e recursos.

Cada tecnologia tem trajetória própria:

1. **Descoberta.** Nenhuma tecnologia existe antes da sua data. Os países pesquisam com antecedência e, quando o ano
   chega, são elegíveis os que dominam as dependências, têm a infraestrutura e concluíram a pesquisa preparatória. O
   descobridor é sorteado com peso pela capacidade científica. Se ninguém estiver apto, a descoberta espera.
2. **Propriedade.** O descobridor produz e detém o monopólio. Cada produtor escolhe uma política: vender a tecnologia,
   licenciá-la com royalties, só exportar produtos ou manter segredo (mais comum em tecnologias militares e
   estratégicas; a idade e a difusão abrem o mercado).
3. **Mercado.** O preço é calculado por fórmula (complexidade, raridade, valor estratégico, idade, dificuldade de
   produção, oferta, demanda, difusão, monopólio, alternativas, recursos, infraestrutura, riqueza do vendedor, poder
   econômico do comprador e relações diplomáticas) e convertido para a moeda da época. O painel mostra a composição
   do custo em cada era: ouro e trabalhadores na Idade Média, capital e máquinas na era industrial, P&D e profissionais
   na era digital.
4. **Aquisição.** Compra, tratado, licenciamento, investimento estrangeiro, importação de produtos prontos,
   transferência científica entre aliados, intercâmbio, universidades, migração de cientistas, espionagem e roubo,
   captura de cientistas e fábricas na guerra, conquista e anexação, acordos pós-guerra, pesquisa própria e
   desenvolvimento independente. Antes de 1850, comércio e espionagem só alcançam vizinhos, parceiros e aliados.
5. **Produção.** Conhecer não é produzir: o país precisa de fábricas, matérias-primas (próprias, de parceiros ou do
   mercado mundial), mão de obra especializada, infraestrutura e capital, e passa por um período de adaptação.
6. **Difusão e obsolescência.** O conhecimento se espalha devagar na Idade Média e rapidamente no século XXI. Uma
   tecnologia fica obsoleta quando a que a substitui já é produzida por boa parte do mundo.

A capacidade de pesquisa de cada país depende de educação, universidades, cientistas, tamanho, riqueza,
estabilidade, desenvolvimento, industrialização e das tecnologias que já domina. Os efeitos são reais: produtividade,
indústria, agricultura, infraestrutura, administração, comércio, medicina, educação, pesquisa, poder militar,
defesa, cercos, marinha e força aérea. O nível tecnológico de cada país é calculado a partir do que ele domina.

Cenários iniciais: 476, 1444, 1523, 1750, 1836, 1936, 2000 e 2015. O conhecimento anterior ao ano inicial é distribuído
pela tradição científica de cada cultura na época e, nos séculos recentes, pela renda do país. O painel de
tecnologias (tecla `T`) mostra o banco por era e categoria. O painel de cada tecnologia mostra descobridor,
proprietários, quem domina e quem importa, preço, difusão, complexidade e toda a trajetória. A aba Tecnologia da nação
reúne pesquisas, adaptações, contratos, monopólios e aquisições.

## População

Todo ano cada país sorteia uma taxa natural de crescimento entre 1% e 1,5% ao ano. A taxa é distribuída pelos meses
com juros compostos e um leve ciclo sazonal (mais nascimentos na primavera, mais mortes no inverno, quase nada nos
trópicos), de modo que doze meses nas mesmas condições fecham exatamente a taxa sorteada. A taxa é ajustada à
situação de cada país e de cada estado:

- **Estabilidade** baixa e **guerra** reduzem os nascimentos.
- **Terra disponível:** um estado cresce livremente até 80% da sua capacidade de sustento (terreno, tecnologia e
  desenvolvimento), desacelera até parar em 130% e encolhe se ficar superpovoado.
- **Ocupação, destruição, epidemias, fome, escassez e inflação descontrolada** tiram pontos da taxa e podem fazer a
  população diminuir. A medicina reduz o peso de epidemias e fome.

O painel da nação mostra a taxa atual, a taxa natural sorteada e os freios ao crescimento.

## Guerras

Por padrão, as nações **não fazem as pazes sozinhas**: uma guerra só termina quando um lado domina o outro ou quando
você decide, no painel da guerra (paz branca ou vitória de um dos lados). Durante a guerra, um estado ocupado por dois
anos passa a pertencer ao ocupante, a nação que perde o controle de todo o território é anexada e a guerra acaba quando
o líder de um dos lados é dominado. Um líder reduzido a no máximo dois estados, sem combates há três anos e muito mais
fraco que o inimigo, rende-se. Guerras paradas levam os exércitos a ofensivas mais ousadas. A opção "Nações fazem as
pazes sozinhas" (novo jogo ou configurações) restaura os tratados automáticos.

Só nações de personalidade **expansionista** ou **imperialista** iniciam guerras de conquista, e apenas quando têm poder
real na sua região: pelo menos 15% do poder da maior potência entre elas e seus vizinhos (população, economia e força
militar) e 50% a mais de força que o alvo e seus defensores. Nações fortes com outras personalidades só lutam para se
defender, em coalizões ou ao lado de aliados, e ao vencer apenas recuperam os estados que eram seus: não anexam o
território do inimigo. Países fracos (menos de 15% do poder da maior potência vizinha, como microestados e ilhas
pequenas) não conquistam território: não anexam estados ocupados, não recebem cessões na paz nem na dominação e não
absorvem vassalos nem uniões. Estados ocupados que nenhum vencedor pode anexar voltam ao dono no fim da guerra. As
nações do jogador (diplomacia autônoma desativada) não seguem a personalidade, mas também precisam de poder regional.

Parâmetros do mundo (novo jogo ou configurações):

- **Agressividade das nações**: *Pacíficas* (nenhum conflito entre nações), *Padrão* (0,5% de chance por mês de
  surgir um conflito entre nações: raros, mas possíveis) ou *Agressivas* (75% de chance por mês). Quando o sorteio do
  mês cria um conflito, ele é iniciado por quem tem motivo e meios: a conquista de uma nação expansionista com poder
  na região, a guerra de uma coalizão contra um expansionista ou a luta de um vassalo pela independência.
- **Rebeliões**: ligadas ou desligadas (revoltas, revoluções, guerras civis, colapsos e lutas de vassalos). As ações
  do jogador de incitar rebeliões e guerras civis funcionam mesmo com elas desligadas.
- **Atividade diplomática**: ligada ou desligada (alianças, pactos, comércio, garantias, sanções e coalizões
  decididas pelas próprias nações).
- **Eventos**: não são configuráveis; há 50% de chance de acontecer um evento no mundo a cada mês.

**Bandeiras**: cada país real dos mapas tem a sua bandeira verdadeira desenhada em pixel art (32x20), sempre com o
mesmo desenho e as mesmas cores, em qualquer mundo e semente (`src/data/realFlags.ts`). Nações que surgem durante a
simulação (rebeldes, independências de regiões) recebem bandeiras procedurais.

A guerra tem custos reais para quem luta:

- **Dívida:** tropas em campanha custam de 2,3 a 3,5 vezes mais (soldos, armamentos, munição e provisões). O governo
  emite títulos para cobrir metade do déficit mesmo tendo reservas e pode se endividar até 120% do PIB para manter
  os exércitos.
- **Inflação e escassez:** a dívida, a mobilização, a produção destruída e o território ocupado fazem a inflação
  subir. Acima de 20% instala-se a escassez, com mais instabilidade e fome, menos produção e menos crescimento.
- **Destruição:** batalhas, cercos, saques de cidades tomadas e exércitos inimigos vivendo do território destroem a
  infraestrutura. Estados arrasados produzem até 75% menos, abastecem mal os exércitos e só se recuperam devagar
  ou com dinheiro para reconstruir.
- **Crédito esgotado:** sem crédito e com o tesouro vazio, os soldos atrasam, as tropas desertam e o moral cai.

Assim, um país pode ficar sem forças para concluir uma conquista ou sair mais fraco de uma vitória difícil. O modo de
mapa "Destruição" e a seção "Economia de guerra" do painel de cada nação mostram esses efeitos.

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
                       modais (estatísticas, configurações, salvar/carregar) e gráficos, em Tailwind:
                       tema e utilitários de pixel art em styles.css, componentes em components.ts
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
npm run techs                                 # valida o banco de tecnologias
npm run sim -- europe 100 renaissance 12345   # 100 anos sem interface + integridade e relatório tecnológico
npm run e2e -- saida europe                   # Chrome headless com o servidor de dev rodando
```

O teste de ponta a ponta usa o Chrome instalado (`CHROME` pode apontar para outro executável) e salva
capturas de tela da partida, dos painéis, das estatísticas e do salvamento/carregamento.

## Créditos

Dados geográficos: Natural Earth e NASA Blue Marble (domínio público). Fontes: Pixelify Sans,
Jacquarda Bastarda 9, Tiny5 e Open Sans (SIL Open Font License), via Fontsource. A interface usa
Tailwind CSS: dados em Open Sans e títulos, botões e HUD em fonte pixelada.
