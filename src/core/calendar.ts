// Calendario do jogo: dias absolutos desde 1 de janeiro do ano inicial (anos de 365 dias).
export const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
export const MONTH_NAMES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];
export const MONTH_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export const YEAR_DAYS = 365;

const MONTH_START: number[] = [];
{
  let acc = 0;
  for (const d of MONTH_DAYS) {
    MONTH_START.push(acc);
    acc += d;
  }
}

export interface GameDate {
  year: number;
  month: number; // 1..12
  day: number; // 1..31
  dayOfYear: number; // 0..364
}

export function dateFromDay(absDay: number, startYear: number): GameDate {
  const year = startYear + Math.floor(absDay / YEAR_DAYS);
  const doy = ((absDay % YEAR_DAYS) + YEAR_DAYS) % YEAR_DAYS;
  let m = 11;
  while (MONTH_START[m] > doy) m--;
  return { year, month: m + 1, day: doy - MONTH_START[m] + 1, dayOfYear: doy };
}

export const yearOf = (absDay: number, startYear: number) => startYear + Math.floor(absDay / YEAR_DAYS);
export const monthsElapsed = (absDay: number) => {
  const d = dateFromDay(absDay, 0);
  return d.year * 12 + d.month - 1;
};
export const isMonthStart = (absDay: number) => dateFromDay(absDay, 0).day === 1;
export const isYearStart = (absDay: number) => absDay % YEAR_DAYS === 0;

const pad = (n: number) => String(n).padStart(2, '0');

export function formatDate(absDay: number, startYear: number): string {
  const d = dateFromDay(absDay, startYear);
  return `${pad(d.day)}/${pad(d.month)}/${d.year}`;
}

export function formatDateLong(absDay: number, startYear: number): string {
  const d = dateFromDay(absDay, startYear);
  return `${d.day} de ${MONTH_NAMES[d.month - 1]} de ${d.year}`;
}

export function formatMonthYear(absDay: number, startYear: number): string {
  const d = dateFromDay(absDay, startYear);
  return `${MONTH_SHORT[d.month - 1]} ${d.year}`;
}

export function formatDuration(days: number): string {
  const years = Math.floor(days / YEAR_DAYS);
  const months = Math.floor((days % YEAR_DAYS) / 30.4);
  if (years <= 0) return months <= 1 ? `${Math.max(1, Math.round(days))} dias` : `${months} meses`;
  if (months === 0) return years === 1 ? '1 ano' : `${years} anos`;
  return `${years} ${years === 1 ? 'ano' : 'anos'} e ${months} ${months === 1 ? 'mês' : 'meses'}`;
}

// Estacao aproximada (hemisferio norte se lat >= 0): 0 inverno, 1 primavera, 2 verao, 3 outono.
export function season(absDay: number, lat: number): number {
  const m = dateFromDay(absDay, 0).month;
  const north = m === 12 || m <= 2 ? 0 : m <= 5 ? 1 : m <= 8 ? 2 : 3;
  return lat >= 0 ? north : (north + 2) % 4;
}
