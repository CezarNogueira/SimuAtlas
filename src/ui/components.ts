// Componentes visuais padronizados da interface, escritos com utilitarios do Tailwind: botoes, campos, chips,
// avisos, secoes, pares rotulo/valor, linhas de lista, barras, tabelas e cabecalhos de painel. Paineis, HUD e
// telas montam o HTML com estes blocos: pixel art nos titulos e botoes, Open Sans nos dados.
import { esc, icon } from './dom';

// ---------- Botoes ----------
export type Tone = 'default' | 'primary' | 'danger';
export type Size = 'md' | 'sm' | 'xs' | 'lg' | 'menu' | 'icon' | 'tab' | 'mode' | 'speed' | 'card';

const BTN_LAYOUT = 'inline-flex items-center justify-center gap-1.5 whitespace-nowrap leading-none';
const BTN_BASE = 'cursor-pointer select-none border-2 border-edge font-pixel disabled:cursor-default disabled:opacity-45';
const BTN_TONES: Record<Tone, string> = {
  default:
    'bg-paper-2 text-ink bevel hover:bg-hover active:bg-pressed active:bevel-in aria-pressed:bg-pressed aria-pressed:font-bold aria-pressed:text-[#1a0f06] aria-pressed:bevel-in',
  primary: 'bg-red-2 text-[#fff3dc] bevel-primary hover:bg-[#d24c38]',
  danger: 'bg-danger text-ink bevel hover:bg-[#e6ad99] active:bevel-in',
};
const BTN_SIZES: Record<Size, string> = {
  md: 'min-h-8 px-2.5 py-1 text-sm',
  sm: 'min-h-6 px-1.5 py-0.5 text-[13px]',
  xs: 'min-h-[22px] px-1.5 py-px text-xs',
  lg: 'min-h-[46px] px-2.5 py-1 text-lg',
  menu: 'min-h-10 px-2.5 py-1 text-lg',
  icon: 'min-h-8 w-9 p-0',
  tab: 'min-h-[26px] px-[7px] py-0.5 text-[13px]',
  mode: 'size-10 p-0',
  speed: 'min-h-8 min-w-11 px-2 py-1 text-sm',
  card: 'min-h-[58px] px-2 py-1.5 text-sm',
};

// Classes de um botao; `layout` substitui o arranjo padrao (ex.: cartoes com varias linhas).
export function btnClass(tone: Tone = 'default', size: Size = 'md', layout = BTN_LAYOUT): string {
  return `${layout} ${BTN_BASE} ${BTN_TONES[tone]} ${BTN_SIZES[size]}`;
}

export interface ButtonOptions {
  tone?: Tone;
  size?: Size;
  icon?: string;
  iconSize?: number;
  title?: string;
  attrs?: string;
  pressed?: boolean;
}

// Botao com icone opcional; `label` ja deve vir escapado.
export function button(label: string, opts: ButtonOptions = {}): string {
  const size = opts.size ?? 'md';
  const ic = opts.icon ? icon(opts.icon, opts.iconSize ?? (size === 'sm' || size === 'xs' ? 14 : 16)) : '';
  const pressed = opts.pressed === undefined ? '' : ` aria-pressed="${opts.pressed}"`;
  const title = opts.title ? ` title="${esc(opts.title)}"` : '';
  return `<button class="${btnClass(opts.tone, size)}"${pressed}${title}${opts.attrs ? ` ${opts.attrs}` : ''}>${ic}${label}</button>`;
}

export const closeButton = (title = 'Fechar') => button(icon('close', 16), { size: 'icon', title, attrs: 'data-close' });
export const focusButton = (title = 'Centralizar no mapa') => button(icon('target', 16), { size: 'icon', title, attrs: 'data-action="focus"' });

// ---------- Campos ----------
const FIELD_CORE = 'min-h-[30px] border-2 border-edge bg-hl px-1.5 py-1 font-sans text-[13px] text-ink outline-none inset-field focus:bg-[#fffaf0]';
export const FIELD = `${FIELD_CORE} min-w-0`;
// Campo que divide a linha com botoes (cresce, mas nao fica estreito demais).
export const FIELD_GROW = `${FIELD_CORE} min-w-[120px] flex-1`;
export const CHECK = 'size-[18px] shrink-0 cursor-pointer accent-red';
export const CHECK_LABEL = 'flex min-h-7 items-center gap-2 text-[13px]';
export const FIELD_LABEL = 'flex flex-col items-stretch gap-[3px] text-[13px]';

// ---------- Texto ----------
export const MUTED = 'text-xs font-normal text-ink-soft';
export const muted = (html: string) => `<span class="${MUTED}">${html}</span>`;
export const mutedBlock = (html: string, extra = '') => `<div class="${MUTED}${extra ? ` ${extra}` : ''}">${html}</div>`;
// Informacao secundaria de um valor, numa linha menor abaixo dele.
export const sub = (html: string) => `<span class="block text-[11.5px] font-normal leading-[15px] text-ink-soft">${html}</span>`;
export const signed = (html: string, positive: boolean) => `<span class="${positive ? 'text-pos' : 'text-neg'}">${html}</span>`;
export const LINK = 'cursor-pointer underline decoration-dotted underline-offset-[3px] hover:text-red';
export const empty = (html: string) => `<div class="p-5 text-center text-ink-soft">${html}</div>`;
export const TIP_MUTED = 'text-tip-soft';
export const KBD = 'inline-block min-w-5 border-2 border-edge bg-hl px-[5px] text-center font-pixel text-xs';

// ---------- Chips, avisos e dicas ----------
export type ChipTone = 'plain' | 'red' | 'blue' | 'green' | 'gold';
const TONE_BG: Record<ChipTone, string> = {
  plain: 'bg-paper-2',
  red: 'bg-chip-red',
  blue: 'bg-chip-blue',
  green: 'bg-chip-green',
  gold: 'bg-chip-gold',
};
export const chip = (html: string, tone: ChipTone = 'plain', attrs = '') =>
  `<span class="m-px inline-flex shrink-0 items-center gap-[3px] border-2 border-edge px-[5px] py-px text-xs ${TONE_BG[tone]}"${attrs ? ` ${attrs}` : ''}>${html}</span>`;
export const banner = (html: string, tone: ChipTone = 'plain') =>
  `<div class="my-1.5 border-2 border-edge px-2 py-1.5 font-semibold leading-snug ${TONE_BG[tone]}">${html}</div>`;
export const hint = (html: string) => `<div class="my-1.5 border-2 border-dashed border-paper-dark p-1.5 text-xs leading-[1.35] text-ink-soft">${html}</div>`;

// ---------- Secoes e pares rotulo/valor ----------
export const section = (title: string, iconName: string, content: string) =>
  `<section class="mt-2.5 mb-3.5"><h3 class="mb-1.5 flex items-center gap-1.5 border-b-2 border-dotted border-ink-soft pb-[3px] font-pixel text-sm uppercase tracking-[1.5px]">${icon(iconName, 16)}${esc(title)}</h3>${content}</section>`;

// Grade de pares: icone, rotulo (coluna do tamanho do maior rotulo, ate 58%) e valor que quebra linha.
export const kvGrid = (rows: string[]) =>
  `<div class="grid grid-cols-[18px_fit-content(58%)_minmax(0,1fr)] items-start gap-x-2.5 gap-y-1 text-[13px] leading-[18px]">${rows.join('')}</div>`;

export function kv(iconName: string, label: string, value: string): string {
  return `${iconName ? icon(iconName, 16, '', 'mt-px') : '<span></span>'}<span class="text-ink-soft [overflow-wrap:break-word]" data-k>${esc(label)}</span><span class="min-w-0 text-right font-semibold [overflow-wrap:anywhere]">${value}</span>`;
}

// Conteudo que ocupa as colunas de rotulo e valor (barras, textos longos).
export const kvFull = (html: string) => `<span></span><div class="col-start-2 col-end-4 self-center">${html}</div>`;
// Itens que fluem lado a lado abaixo do rotulo, quebrando linha quando nao cabem.
export const kvItems = (items: string[]) =>
  `<span></span><div class="col-start-2 col-end-4 -mt-[3px] flex flex-wrap gap-x-3.5 gap-y-0.5 text-[12.5px] font-semibold">${items.map((i) => `<span>${i}</span>`).join('')}</div>`;
export const kvList = (iconName: string, label: string, items: string[], emptyHtml = muted('nenhum')) =>
  items.length ? kv(iconName, label, '') + kvItems(items) : kv(iconName, label, emptyHtml);

// ---------- Barras ----------
export const COLORS = {
  green: 'var(--color-green)',
  red: 'var(--color-red-2)',
  gold: 'var(--color-gold)',
  blue: 'var(--color-blue)',
} as const;

const BAR = 'relative h-3 min-w-[70px] border-2 border-edge bg-[#c9ad74]';

export function bar(value: number, color: string = COLORS.green): string {
  const pct = Math.max(0, Math.min(100, value * 100));
  return `<div class="${BAR}"><i class="absolute inset-y-0 left-0" style="width:${pct.toFixed(1)}%;background:${color}"></i></div>`;
}

// Barra centrada (-1..1).
export function centerBar(value: number): string {
  const v = Math.max(-1, Math.min(1, value));
  const w = Math.abs(v) * 50;
  const left = v < 0 ? 50 - w : 50;
  const color = v < 0 ? COLORS.red : COLORS.green;
  return `<div class="${BAR}"><i class="absolute inset-y-0" style="left:${left}%;width:${w}%;background:${color}"></i><span class="absolute -top-0.5 -bottom-0.5 left-1/2 w-0.5 bg-edge"></span></div>`;
}

export const barRow = (value: number, color: string) => kvFull(bar(value, color));

// Placar de guerra: fundo vermelho (defensores) / verde (atacantes) com marcador.
export const warScore = (pct: number, height = 'h-[18px]') =>
  `<div class="relative border-2 border-edge bg-[linear-gradient(90deg,#cf8a78_0_50%,#9fbf86_50%_100%)] ${height}"><i class="absolute -top-1 -bottom-1 w-1 bg-edge" style="left:calc(${pct}% - 2px)"></i></div>`;

// ---------- Listas ----------
export const ROWS = 'flex flex-col gap-0.5';
export const rows = (html: string) => `<div class="${ROWS}">${html}</div>`;

export interface RowOptions {
  attrs?: string;
  link?: boolean;
  top?: boolean;
  extra?: string;
}

// Linha de lista (icone, texto que cresce e numeros); `top` alinha pelo topo quando ha texto em duas linhas.
export function row(content: string, opts: RowOptions = {}): string {
  const cls = `flex ${opts.top ? 'items-start' : 'items-center'} gap-1.5 border border-transparent px-1 py-[3px] text-[13px]${opts.link ? ' cursor-pointer hover:border-paper-dark hover:bg-paper-2' : ''}${opts.extra ? ` ${opts.extra}` : ''}`;
  return `<div class="${cls}"${opts.attrs ? ` ${opts.attrs}` : ''}>${content}</div>`;
}

export const grow = (html: string) => `<span class="min-w-0 flex-1 truncate">${html}</span>`;
export const stack = (html: string) => `<span class="min-w-0 flex-1 [overflow-wrap:anywhere]">${html}</span>`;
export const num = (html: string, extra = '') => `<span class="whitespace-nowrap font-semibold${extra ? ` ${extra}` : ''}">${html}</span>`;
export const ACTIONS = 'flex flex-wrap items-center gap-1.5';
export const actions = (html: string, extra = '') => `<div class="${ACTIONS}${extra ? ` ${extra}` : ''}">${html}</div>`;
export const LOG = 'flex flex-col gap-[3px] text-[12.5px] leading-[1.35]';
export const WHEN = 'mr-1.5 text-ink-soft';

// ---------- Tabelas ----------
const TH = 'border-b-2 border-paper-dark px-1 py-0.5 text-left text-xs font-semibold text-ink-soft';
const TH_NUM = 'border-b-2 border-paper-dark px-1 py-0.5 text-right text-xs font-semibold whitespace-nowrap text-ink-soft';
const TD = 'border-b border-dashed border-paper-dark px-1 py-0.5 align-middle';
const TD_NUM = 'border-b border-dashed border-paper-dark px-1 py-0.5 text-right align-middle whitespace-nowrap';
export const TR_LINK = 'cursor-pointer hover:bg-paper-2';

// Tabela compacta: cabecalho [rotulo, numerico?] e linhas ja montadas com `td`.
export function table(head: [string, boolean?][], body: string): string {
  const th = head.length ? `<thead><tr>${head.map(([label, numeric]) => `<th class="${numeric ? TH_NUM : TH}">${label}</th>`).join('')}</tr></thead>` : '';
  return `<table class="w-full border-collapse text-[12.5px]">${th}<tbody>${body}</tbody></table>`;
}
export const td = (html: string, numeric = false, extra = '') => `<td class="${numeric ? TD_NUM : TD}${extra ? ` ${extra}` : ''}">${html}</td>`;

// ---------- Graficos ----------
export const SPARK = 'block h-[90px] w-full border-2 border-edge bg-hl';
export const CHART_WRAP = 'mt-2 border-2 border-edge bg-hl p-1.5';
export const chartTitle = (iconName: string, title: string) =>
  `<div class="mt-2 mb-0.5 flex items-center gap-1.5 font-pixel text-[13px] font-bold">${icon(iconName, 16)}${esc(title)}</div>`;

// ---------- Confronto (guerras e batalhas) ----------
export const VS = 'grid grid-cols-[1fr_auto_1fr] items-start gap-2';
export const SIDE_BOX = 'min-w-0 border-2 border-edge bg-paper-2 p-1.5';
export const VS_MID = 'self-center font-pixel font-bold text-red';

// ---------- Cabecalhos ----------
// Titulo e subtitulos de um painel lateral; `title` e os subtitulos ja devem vir escapados.
export const headTitles = (title: string, subs: string[] = []) =>
  `<div class="min-w-0 flex-1"><h2 class="font-pixel text-[21px] leading-[1.05] [overflow-wrap:anywhere]">${title}</h2>${subs.map((s) => `<div class="mt-0.5 text-[13px] text-ink-soft">${s}</div>`).join('')}</div>`;
export const headButtons = (html: string) => `<div class="flex shrink-0 flex-col gap-1">${html}</div>`;
export const modalTitle = (iconName: string, title: string) => `${icon(iconName, 32)}<h2 class="flex-1 font-pixel text-[22px]">${esc(title)}</h2>${closeButton()}`;

// ---------- Telas ----------
export const SCREEN = 'fixed inset-0 flex items-center justify-center';
export const SCREEN_BG =
  "pixelated absolute inset-0 bg-cover bg-center brightness-[0.55] saturate-[0.85] after:absolute after:inset-0 after:bg-[radial-gradient(ellipse_at_center,rgb(20_12_6/0)_30%,rgb(20_12_6/0.85)_100%)] after:content-['']";
export const SCREEN_SECTION = 'mt-4 mb-1.5 flex items-center gap-1.5 border-b-2 border-dotted border-ink-soft pb-[3px] font-pixel text-base uppercase tracking-[2px]';
export const screenBg = (url: string) => `<div class="${SCREEN_BG}" style="background-image:url('${url}')"></div>`;
