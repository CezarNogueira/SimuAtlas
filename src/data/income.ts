// Nivel de renda (0..4) a partir da classificacao do Banco Mundial presente nos dados do mapa.
export function incomeLevel(income: string): number {
  if (!income) return 1;
  if (income.startsWith('1')) return 4;
  if (income.startsWith('2')) return 3;
  if (income.startsWith('3')) return 2;
  if (income.startsWith('4')) return 1;
  return 0;
}
