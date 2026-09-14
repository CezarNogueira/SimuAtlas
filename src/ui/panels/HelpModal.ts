// Ajuda: controles e dicas de como observar e intervir no mundo.
import { icon } from '../dom';
import type { GameUI } from '../game/GameUI';
import { sec } from './common';
import { BasePanel } from './Panel';

export class HelpModal extends BasePanel {
  constructor(ui: GameUI) {
    super(ui, 'modal narrow');
  }

  protected isStatic(): boolean {
    return true;
  }

  protected renderHead(): string {
    return `${icon('info', 32)}<h2>Como jogar</h2><button class="px-btn square" data-close title="Fechar">${icon('close', 16)}</button>`;
  }

  protected renderBody(): string {
    const k = (s: string) => `<span class="kbd">${s}</span>`;
    const keys = `<div class="help-keys">
      <span>${k('Arrastar')}</span><span>Mover o mapa</span>
      <span>${k('Roda')} ${k('+')} ${k('−')}</span><span>Zoom (em degraus de pixel)</span>
      <span>${k('Clique')}</span><span>Selecionar nação, exército ou batalha</span>
      <span>${k('Shift')}+${k('Clique')}</span><span>Abrir o painel do estado</span>
      <span>${k('Botão direito')}</span><span>Ordenar marcha do exército selecionado</span>
      <span>${k('Duplo clique')}</span><span>Aproximar</span>
      <span>${k('W A S D')} / setas</span><span>Mover a câmera</span>
      <span>${k('Espaço')}</span><span>Pausar / continuar</span>
      <span>${k('1')}–${k('7')}</span><span>Velocidade 1x, 2x, 5x, 10x, 25x, 50x, 100x</span>
      <span>${k('.')}</span><span>Avançar um dia (pausado)</span>
      <span>${k('H')} ${k('G')} ${k('E')}</span><span>Histórico, guerras, estatísticas</span>
      <span>${k('F')}</span><span>Centralizar a seleção</span>
      <span>${k('Ctrl')}+${k('S')}</span><span>Salvamento rápido</span>
      <span>${k('Esc')}</span><span>Fechar painel / menu</span>
    </div>`;
    const tips = `<div class="result-line">
      <p>Você é o <b>observador e controlador</b> deste mundo. A simulação avança sozinha: nações recrutam exércitos,
      declaram guerras, cercam cidades, assinam tratados, se rebelam e desaparecem.</p>
      <p>Cada país é dividido em seus <b>estados</b> reais (estados, províncias ou regiões oficiais, conforme o país).
      As guerras conquistam estados inteiros, e cada cerco acontece na cidade principal do estado.</p>
      <p><b>Guerras não terminam sozinhas</b>: continuam até um lado dominar o outro ou até você decidir a paz no painel
      da guerra (paz branca ou vitória de um dos lados). Um estado ocupado aparece listrado com a cor do ocupante e, após
      dois anos de ocupação, passa a pertencer a ele; a nação que perde todo o território é anexada. Para voltar aos tratados
      automáticos, ative "Nações fazem as pazes sozinhas" nas configurações.</p>
      <p><b>População</b>: cada país cresce de 1% a 1,5% ao ano (taxa sorteada todo ano). Instabilidade, guerra, falta
      de terras, ocupação, destruição, epidemias e fome reduzem o crescimento; veja os freios no painel da nação.</p>
      <p><b>A guerra cobra seu preço</b>: tropas em campanha e armamentos custam fortunas e são pagos com dívida; a
      mobilização, a destruição e a ocupação fazem faltar produtos e a inflação dispara. Batalhas, cercos, saques e
      ocupação destroem a infraestrutura dos estados, que produzem menos até serem reconstruídos. Sem crédito, os soldos
      atrasam e os exércitos desertam, e um país pode não ter forças para concluir uma conquista ou sair enfraquecido
      de uma vitória difícil. Veja o modo de mapa <b>Destruição</b> e a seção <b>Economia de guerra</b> de cada nação.</p>
      <p>
      Cercos mostram uma barra de progresso; batalhas em andamento pulsam no mapa.</p>
      <p>Na aba <b>Ações</b> de cada nação você pode declarar guerras, forçar a paz, formar alianças, incitar rebeliões,
      mudar governos, conceder exércitos e disparar eventos. Desative a <b>diplomacia autônoma</b> para controlar uma nação sozinho.</p>
      <p>Use os <b>modos de mapa</b> à esquerda para ver terreno, diplomacia, religião, cultura, governo, desenvolvimento,
      densidade, agitação, economia e tecnologia.</p>
    </div>`;
    return sec('Controles', 'gear', keys) + sec('Dicas', 'book', tips);
  }
}
