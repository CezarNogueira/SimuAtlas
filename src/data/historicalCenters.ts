// Tradicao cientifica historica por cultura ao longo dos seculos (0..1). Usada para distribuir o conhecimento
// existente no inicio da partida e a capacidade cientifica inicial: a China Tang e o Califado Abassida lideram
// na Idade Media, a Europa ocidental a partir do Renascimento, e o mundo converge no seculo XX.
import type { CultureId } from './cultures';

const YEARS = [476, 800, 1100, 1300, 1450, 1600, 1750, 1850, 1950, 2000];

const TRADITION: Record<CultureId, number[]> = {
  lusitana: [0.5, 0.4, 0.5, 0.6, 0.8, 0.85, 0.75, 0.55, 0.7, 0.8],
  hispanica: [0.5, 0.45, 0.55, 0.65, 0.8, 0.85, 0.75, 0.6, 0.75, 0.85],
  francesa: [0.5, 0.45, 0.55, 0.7, 0.8, 0.9, 0.95, 0.95, 0.95, 0.95],
  italica: [0.7, 0.5, 0.6, 0.8, 0.9, 0.9, 0.8, 0.75, 0.85, 0.9],
  romena: [0.3, 0.3, 0.3, 0.35, 0.4, 0.45, 0.5, 0.6, 0.75, 0.8],
  germanica: [0.3, 0.35, 0.45, 0.6, 0.8, 0.85, 0.9, 1, 1, 1],
  neerlandesa: [0.3, 0.35, 0.45, 0.6, 0.8, 0.95, 0.95, 0.9, 0.95, 1],
  anglo: [0.25, 0.35, 0.45, 0.55, 0.7, 0.85, 0.95, 1, 1, 1],
  nordica: [0.2, 0.25, 0.35, 0.45, 0.6, 0.75, 0.85, 0.9, 0.95, 1],
  finica: [0.15, 0.2, 0.25, 0.35, 0.45, 0.55, 0.6, 0.7, 0.85, 0.95],
  hungara: [0.2, 0.25, 0.4, 0.5, 0.6, 0.55, 0.6, 0.7, 0.8, 0.85],
  baltica: [0.15, 0.2, 0.25, 0.35, 0.45, 0.55, 0.6, 0.65, 0.8, 0.85],
  eslava_oriental: [0.2, 0.25, 0.4, 0.4, 0.45, 0.5, 0.6, 0.75, 0.9, 0.85],
  eslava_ocidental: [0.2, 0.25, 0.4, 0.5, 0.6, 0.6, 0.6, 0.7, 0.8, 0.85],
  eslava_sul: [0.3, 0.35, 0.45, 0.5, 0.45, 0.45, 0.45, 0.55, 0.7, 0.75],
  grega: [0.9, 0.85, 0.85, 0.7, 0.55, 0.45, 0.45, 0.55, 0.7, 0.8],
  albanesa: [0.4, 0.4, 0.45, 0.4, 0.35, 0.35, 0.35, 0.4, 0.55, 0.65],
  turcica: [0.6, 0.6, 0.75, 0.75, 0.8, 0.75, 0.65, 0.55, 0.65, 0.75],
  caucasica: [0.6, 0.6, 0.65, 0.55, 0.5, 0.45, 0.45, 0.55, 0.7, 0.75],
  persa: [0.85, 0.9, 0.95, 0.8, 0.75, 0.7, 0.6, 0.5, 0.6, 0.7],
  arabe: [0.55, 0.95, 0.95, 0.8, 0.7, 0.55, 0.45, 0.45, 0.55, 0.7],
  hebraica: [0.6, 0.6, 0.65, 0.65, 0.65, 0.65, 0.65, 0.75, 0.95, 1],
  indica: [0.85, 0.9, 0.85, 0.75, 0.75, 0.75, 0.65, 0.5, 0.6, 0.75],
  mongol: [0.3, 0.3, 0.35, 0.5, 0.4, 0.35, 0.3, 0.35, 0.5, 0.6],
  chinesa: [0.9, 1, 1, 0.95, 0.9, 0.8, 0.7, 0.55, 0.6, 0.85],
  japonesa: [0.4, 0.55, 0.6, 0.65, 0.65, 0.7, 0.7, 0.75, 0.95, 1],
  coreana: [0.5, 0.6, 0.7, 0.75, 0.75, 0.7, 0.65, 0.6, 0.75, 0.95],
  indochinesa: [0.45, 0.5, 0.6, 0.6, 0.55, 0.5, 0.5, 0.45, 0.55, 0.7],
  malaia: [0.45, 0.5, 0.55, 0.55, 0.55, 0.45, 0.4, 0.4, 0.5, 0.65],
  oceanica: [0.1, 0.1, 0.15, 0.15, 0.15, 0.2, 0.2, 0.3, 0.5, 0.7],
  africana_ocidental: [0.35, 0.4, 0.5, 0.55, 0.45, 0.35, 0.3, 0.3, 0.4, 0.5],
  bantu: [0.3, 0.3, 0.35, 0.4, 0.35, 0.3, 0.3, 0.3, 0.4, 0.5],
  cushitica: [0.55, 0.5, 0.45, 0.45, 0.4, 0.35, 0.35, 0.35, 0.4, 0.45],
  nilotica: [0.3, 0.3, 0.3, 0.3, 0.3, 0.25, 0.25, 0.25, 0.35, 0.45],
  malgaxe: [0.25, 0.3, 0.35, 0.35, 0.35, 0.3, 0.3, 0.35, 0.4, 0.45],
  inuit: [0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.15, 0.3, 0.6],
};

export function scientificTradition(culture: CultureId, year: number): number {
  const row = TRADITION[culture] ?? TRADITION.hispanica;
  if (year <= YEARS[0]) return row[0];
  for (let i = 1; i < YEARS.length; i++) {
    if (year <= YEARS[i]) {
      const t = (year - YEARS[i - 1]) / (YEARS[i] - YEARS[i - 1]);
      return row[i - 1] + (row[i] - row[i - 1]) * t;
    }
  }
  return row[row.length - 1];
}

// No Novo Mundo e na Oceania, os Estados atuais so herdam plenamente a tradicao cientifica da sua cultura depois da
// colonizacao consolidada e das independencias.
export function newWorldFactor(continent: string, year: number): number {
  if (continent !== 'North America' && continent !== 'South America' && continent !== 'Oceania') return 1;
  if (year <= 1600) return 0.45;
  if (year >= 1850) return 1;
  return 0.45 + ((year - 1600) / 250) * 0.55;
}

// Nivel de avanco inicial de um pais: tradicao da sua cultura na epoca e, cada vez mais a partir do seculo XVI,
// o nivel de renda do pais atual que ele representa.
export function historicalAdvancement(culture: CultureId, incomeLevel: number, year: number, continent = ''): number {
  const incomeWeight = Math.max(0, Math.min(1, (year - 1500) / 500)) * 0.35;
  return scientificTradition(culture, year) * newWorldFactor(continent, year) * (1 - incomeWeight) + (incomeLevel / 4) * incomeWeight;
}
