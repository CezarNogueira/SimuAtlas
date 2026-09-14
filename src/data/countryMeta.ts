// Metadados culturais/religiosos dos paises reais (codigo ISO3 do Natural Earth)
// e rivalidades historicas usadas para temperar as relacoes iniciais.
import type { CultureId } from './cultures';
import type { ReligionId } from './religions';
import type { GovernmentId } from './governments';

export interface CountryMeta {
  culture: CultureId;
  religion: ReligionId;
}

const RAW = `
IDN malaia sunni|MYS malaia sunni|CHL hispanica catholic|BOL hispanica catholic|PER hispanica catholic|ARG hispanica catholic
CYP grega orthodox|IND indica hindu|CHN chinesa confucian|ISR hebraica jewish|PSX arabe sunni|LBN arabe sunni
ETH cushitica orthodox|SDS nilotica animist|SOM cushitica sunni|KEN bantu protestant|MWI bantu protestant|TZA bantu protestant
SYR arabe sunni|SOL cushitica sunni|FRA francesa catholic|SUR neerlandesa protestant|GUY anglo protestant|KOR coreana confucian
PRK coreana confucian|MAR arabe sunni|SAH arabe sunni|CRI hispanica catholic|NIC hispanica catholic|COG bantu catholic
COD bantu catholic|BTN indica buddhist|UKR eslava_oriental orthodox|BLR eslava_oriental orthodox|NAM bantu protestant|ZAF bantu protestant
OMN arabe sunni|UZB turcica sunni|KAZ turcica sunni|TJK persa sunni|LTU baltica catholic|BRA lusitana catholic
URY hispanica catholic|MNG mongol buddhist|RUS eslava_oriental orthodox|CZE eslava_ocidental catholic|DEU germanica protestant|EST finica protestant
LVA baltica protestant|NOR nordica protestant|SWE nordica protestant|FIN finica protestant|VNM indochinesa buddhist|KHM indochinesa buddhist
LUX germanica catholic|ARE arabe sunni|BEL neerlandesa catholic|GEO caucasica orthodox|MKD eslava_sul orthodox|ALB albanesa sunni
AZE turcica shia|KOS albanesa sunni|TUR turcica sunni|ESP hispanica catholic|LAO indochinesa buddhist|KGZ turcica sunni
ARM caucasica orthodox|DNK nordica protestant|LBY arabe sunni|TUN arabe sunni|ROU romena orthodox|HUN hungara catholic
SVK eslava_ocidental catholic|POL eslava_ocidental catholic|IRL anglo catholic|GBR anglo protestant|GRC grega orthodox|ZMB bantu protestant
SLE africana_ocidental sunni|GIN africana_ocidental sunni|LBR africana_ocidental protestant|CAF bantu catholic|SDN arabe sunni|DJI cushitica sunni
ERI cushitica orthodox|AUT germanica catholic|IRQ arabe shia|ITA italica catholic|CHE germanica protestant|IRN persa shia
NLD neerlandesa protestant|LIE germanica catholic|CIV africana_ocidental sunni|SRB eslava_sul orthodox|MLI africana_ocidental sunni|SEN africana_ocidental sunni
NGA africana_ocidental sunni|BEN africana_ocidental animist|AGO bantu catholic|HRV eslava_sul catholic|SVN eslava_sul catholic|QAT arabe sunni
SAU arabe sunni|BWA bantu protestant|ZWE bantu protestant|PAK indica sunni|BGR eslava_sul orthodox|THA indochinesa buddhist
SMR italica catholic|HTI francesa catholic|DOM hispanica catholic|TCD nilotica sunni|KWT arabe sunni|SLV hispanica catholic
GTM hispanica catholic|TLS malaia catholic|BRN malaia sunni|MCO francesa catholic|DZA arabe sunni|MOZ bantu catholic
SWZ bantu protestant|BDI bantu catholic|RWA bantu catholic|MMR indochinesa buddhist|BGD indica sunni|AND hispanica catholic
AFG persa sunni|MNE eslava_sul orthodox|BIH eslava_sul sunni|UGA bantu protestant|CUB hispanica catholic|HND hispanica catholic
ECU hispanica catholic|COL hispanica catholic|PRY hispanica catholic|PRT lusitana catholic|MDA romena orthodox|TKM turcica sunni
JOR arabe sunni|NPL indica hindu|LSO bantu protestant|CMR bantu catholic|GAB bantu catholic|NER africana_ocidental sunni
BFA africana_ocidental sunni|TGO africana_ocidental animist|GHA africana_ocidental protestant|GNB africana_ocidental sunni|GIB anglo catholic|USA anglo protestant
CAN anglo protestant|MEX hispanica catholic|BLZ anglo catholic|PAN hispanica catholic|VEN hispanica catholic|PNG oceanica protestant
EGY arabe sunni|YEM arabe sunni|MRT arabe sunni|GNQ bantu catholic|GMB africana_ocidental sunni|HKG chinesa confucian
VAT italica catholic|CYN turcica sunni|AUS anglo protestant|GRL inuit protestant|FJI oceanica protestant|NZL anglo protestant
NCL oceanica catholic|MDG malgaxe protestant|PHL malaia catholic|LKA indica buddhist|CUW neerlandesa catholic|ABW neerlandesa catholic
BHS anglo protestant|TCA anglo protestant|TWN chinesa confucian|JPN japonesa shinto|SPM francesa catholic|ISL nordica protestant
PCN anglo protestant|PYF oceanica protestant|ATF francesa catholic|SYC francesa catholic|KIR oceanica catholic|MHL oceanica protestant
TTO anglo catholic|GRD anglo catholic|VCT anglo protestant|BRB anglo protestant|LCA anglo catholic|DMA anglo catholic
MSR anglo protestant|ATG anglo protestant|KNA anglo protestant|VIR anglo protestant|PRI hispanica catholic|AIA anglo protestant
VGB anglo protestant|JAM anglo protestant|CYM anglo protestant|BMU anglo protestant|SHN anglo protestant|MUS indica hindu
COM bantu sunni|STP lusitana catholic|CPV lusitana catholic|MLT italica catholic|FRO nordica protestant|SGP chinesa buddhist
NFK anglo protestant|COK oceanica protestant|TON oceanica protestant|WLF oceanica catholic|WSM oceanica protestant|SLB oceanica protestant
TUV oceanica protestant|MDV indica sunni|NRU oceanica protestant|FSM oceanica catholic|FLK anglo protestant|VUT oceanica protestant
NIU oceanica protestant|ASM oceanica protestant|PLW oceanica catholic|GUM oceanica catholic|MNP oceanica catholic|BHR arabe shia
SGS anglo protestant|IOT anglo protestant|MAC chinesa confucian
`;

const TABLE = new Map<string, CountryMeta>();
for (const row of RAW.split(/[|\n]/)) {
  const parts = row.trim().split(/\s+/);
  if (parts.length === 3) TABLE.set(parts[0], { culture: parts[1] as CultureId, religion: parts[2] as ReligionId });
}

const SUBREGION_DEFAULT: Record<string, CountryMeta> = {
  'Western Europe': { culture: 'germanica', religion: 'catholic' },
  'Northern Europe': { culture: 'nordica', religion: 'protestant' },
  'Southern Europe': { culture: 'italica', religion: 'catholic' },
  'Eastern Europe': { culture: 'eslava_oriental', religion: 'orthodox' },
  'Western Asia': { culture: 'arabe', religion: 'sunni' },
  'Central Asia': { culture: 'turcica', religion: 'sunni' },
  'Southern Asia': { culture: 'indica', religion: 'hindu' },
  'Eastern Asia': { culture: 'chinesa', religion: 'confucian' },
  'South-Eastern Asia': { culture: 'malaia', religion: 'buddhist' },
  'Northern Africa': { culture: 'arabe', religion: 'sunni' },
  'Western Africa': { culture: 'africana_ocidental', religion: 'sunni' },
  'Eastern Africa': { culture: 'bantu', religion: 'protestant' },
  'Middle Africa': { culture: 'bantu', religion: 'catholic' },
  'Southern Africa': { culture: 'bantu', religion: 'protestant' },
  'Northern America': { culture: 'anglo', religion: 'protestant' },
  'Central America': { culture: 'hispanica', religion: 'catholic' },
  Caribbean: { culture: 'hispanica', religion: 'catholic' },
  'South America': { culture: 'hispanica', religion: 'catholic' },
  'Australia and New Zealand': { culture: 'anglo', religion: 'protestant' },
  Melanesia: { culture: 'oceanica', religion: 'protestant' },
  Micronesia: { culture: 'oceanica', religion: 'catholic' },
  Polynesia: { culture: 'oceanica', religion: 'protestant' },
};

export function countryMeta(code: string, subregion: string): CountryMeta {
  return TABLE.get(code) ?? SUBREGION_DEFAULT[subregion] ?? { culture: 'hispanica', religion: 'catholic' };
}

// Rivalidades historicas (relacao inicial reduzida).
export const RIVALRIES: [string, string, number][] = [
  ['FRA', 'GBR', -30], ['FRA', 'DEU', -35], ['RUS', 'TUR', -35], ['IND', 'PAK', -45], ['CHN', 'JPN', -35],
  ['KOR', 'JPN', -25], ['PRK', 'KOR', -60], ['BRA', 'ARG', -20], ['PER', 'CHL', -25], ['BOL', 'CHL', -25],
  ['GRC', 'TUR', -40], ['ISR', 'SYR', -50], ['ISR', 'IRN', -50], ['ARM', 'AZE', -55], ['IRN', 'IRQ', -35],
  ['IRN', 'SAU', -40], ['ESP', 'PRT', -10], ['POL', 'RUS', -35], ['POL', 'DEU', -25], ['AUT', 'HUN', -10],
  ['SRB', 'HRV', -30], ['SRB', 'KOS', -50], ['ETH', 'ERI', -45], ['ETH', 'SOM', -30], ['SDN', 'SDS', -40],
  ['MAR', 'DZA', -30], ['EGY', 'ISR', -30], ['VNM', 'CHN', -25], ['THA', 'MMR', -25], ['USA', 'MEX', -10],
  ['USA', 'RUS', -30], ['USA', 'CUB', -35], ['COL', 'VEN', -20], ['ECU', 'PER', -25], ['PRY', 'BOL', -20],
  ['CHN', 'IND', -25], ['UKR', 'RUS', -30], ['GEO', 'RUS', -30], ['SWE', 'DNK', -15], ['SWE', 'RUS', -20],
];

// Afinidades historicas (relacao inicial ampliada).
export const FRIENDSHIPS: [string, string, number][] = [
  ['PRT', 'GBR', 25], ['PRT', 'BRA', 30], ['USA', 'GBR', 30], ['USA', 'CAN', 35], ['AUS', 'NZL', 40],
  ['FRA', 'BEL', 15], ['DEU', 'AUT', 25], ['CZE', 'SVK', 30], ['NOR', 'SWE', 20], ['NOR', 'DNK', 20],
  ['RUS', 'SRB', 25], ['RUS', 'BLR', 35], ['ARG', 'URY', 15], ['ESP', 'MEX', 15], ['SAU', 'ARE', 30],
  ['CHN', 'PRK', 25], ['TUR', 'AZE', 35], ['GRC', 'CYP', 40], ['TUR', 'CYN', 50], ['JPN', 'TWN', 15],
];

// Governos "reais" aproximados para a era contemporanea.
export const MODERN_GOVERNMENT: Record<string, GovernmentId> = {
  USA: 'federation', BRA: 'federation', RUS: 'federation', IND: 'federation', DEU: 'federation', CAN: 'federation',
  AUS: 'federation', MEX: 'federation', ARG: 'federation', NGA: 'federation', MYS: 'federation', PAK: 'federation',
  ETH: 'federation', AUT: 'federation', CHE: 'confederation', BEL: 'federation', BIH: 'federation', VEN: 'federation',
  ARE: 'federation', GBR: 'monarchy', ESP: 'monarchy', NLD: 'monarchy', SWE: 'monarchy', NOR: 'monarchy',
  DNK: 'monarchy', JPN: 'monarchy', THA: 'monarchy', SAU: 'monarchy', MAR: 'monarchy', JOR: 'monarchy',
  KWT: 'monarchy', QAT: 'monarchy', OMN: 'monarchy', BHR: 'monarchy', BTN: 'monarchy', KHM: 'monarchy',
  BRN: 'monarchy', LSO: 'monarchy', SWZ: 'monarchy', TON: 'monarchy', LUX: 'monarchy', IRN: 'theocracy',
  AFG: 'theocracy', PRK: 'dictatorship', ERI: 'dictatorship', TKM: 'dictatorship', BLR: 'dictatorship',
  SYR: 'dictatorship', CHN: 'republic', VNM: 'republic', LAO: 'republic', CUB: 'republic',
};
