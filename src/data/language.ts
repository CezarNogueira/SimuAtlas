// Regras de linguagem em portugues para nomes de paises: artigos e contracoes
// ("do Brasil", "da França", "de Portugal", "à Argentina").

const NO_ARTICLE = new Set([
  'Portugal', 'Cuba', 'Malta', 'Israel', 'Moçambique', 'Angola', 'Timor-Leste', 'Madagascar', 'Singapura',
  'Mônaco', 'Luxemburgo', 'Chipre', 'Chipre do Norte', 'Taiwan', 'Omã', 'Honduras', 'El Salvador', 'Belize',
  'Porto Rico', 'Barbados', 'Granada', 'Santa Lúcia', 'São Tomé e Príncipe', 'Cabo Verde', 'Djibuti',
  'Hong Kong', 'Kosovo', 'Andorra', 'San Marino', 'Liechtenstein', 'Aruba', 'Curaçao', 'Nauru', 'Tuvalu',
  'Kiribati', 'Samoa', 'Tonga', 'Fiji', 'Vanuatu', 'Palau', 'Myanmar', 'Bangladesh', 'Brunei', 'Marrocos',
  'Gana', 'Botsuana', 'Ruanda', 'Uganda', 'Macau', 'Trinidad e Tobago', 'Antígua e Barbuda', 'Guam', 'Niue',
  'Montserrat', 'Anguilla', 'Burkina Faso', 'Papua-Nova Guiné', 'Essuatíni', 'Mianmar', 'Jersey', 'Guernsey',
]);
const MASC_A = new Set(['Quênia', 'Camboja', 'Sri Lanka', 'Canadá', 'Panamá', 'Saara Ocidental', 'Nepal']);
const PLURAL_M = new Set(['Estados Unidos', 'Países Baixos', 'Emirados Árabes', 'Camarões']);
const PLURAL_F = new Set(['Filipinas', 'Maldivas', 'Bahamas', 'Malvinas', 'Comores', 'Seychelles', 'Bermudas', 'Terras Austrais']);

export type Article = '' | 'o' | 'a' | 'os' | 'as';

export function articleFor(name: string): Article {
  if (NO_ARTICLE.has(name)) return '';
  if (PLURAL_M.has(name)) return 'os';
  if (PLURAL_F.has(name) || name.startsWith('Ilhas ')) return 'as';
  if (MASC_A.has(name)) return 'o';
  const first = name.split(/[\s-]/)[0];
  if (/(República|Confederação|Federação|Teocracia|Liga|União|Coroa|Monarquia)$/.test(first)) return 'a';
  if (/(Reino|Império|Estado|Sultanato|Califado|Canato|Principado|Grão-Ducado|Ducado)$/.test(first)) return 'o';
  if (/[aáé]$/.test(first) || /ia$/.test(first)) return 'a';
  return 'o';
}

export function deName(name: string, article: Article): string {
  switch (article) {
    case 'o': return `do ${name}`;
    case 'a': return `da ${name}`;
    case 'os': return `dos ${name}`;
    case 'as': return `das ${name}`;
    default: return `de ${name}`;
  }
}

export function toName(name: string, article: Article): string {
  switch (article) {
    case 'o': return `ao ${name}`;
    case 'a': return `à ${name}`;
    case 'os': return `aos ${name}`;
    case 'as': return `às ${name}`;
    default: return `a ${name}`;
  }
}

export function inName(name: string, article: Article): string {
  switch (article) {
    case 'o': return `no ${name}`;
    case 'a': return `na ${name}`;
    case 'os': return `nos ${name}`;
    case 'as': return `nas ${name}`;
    default: return `em ${name}`;
  }
}

export function withName(name: string, article: Article): string {
  switch (article) {
    case 'o': return `com o ${name}`;
    case 'a': return `com a ${name}`;
    case 'os': return `com os ${name}`;
    case 'as': return `com as ${name}`;
    default: return `com ${name}`;
  }
}

const ROMAN: [number, string][] = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
export function roman(n: number): string {
  let out = '';
  let v = n;
  for (const [k, s] of ROMAN) {
    while (v >= k) {
      out += s;
      v -= k;
    }
  }
  return out;
}

export const ordinal = (n: number) => `${n}º`;
