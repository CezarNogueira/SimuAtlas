// Arvore tecnologica linear por nivel. O nivel de cada pais e continuo;
// tecnologias sao desbloqueadas ao atingir o nivel e seus efeitos se acumulam.
export interface TechEffects {
  military: number; // bonus de poder de combate
  economy: number; // bonus de produtividade
  growth: number; // medicina: reduz o peso de epidemias e fome sobre o crescimento populacional
  movement: number; // bonus de velocidade de marcha
  seaRange: number; // alcance naval extra (em rotas)
  siege: number; // bonus de cerco
  defense: number; // bonus defensivo
  research: number; // bonus de pesquisa
}

export interface TechInfo {
  level: number;
  id: string;
  name: string;
  description: string;
  effects: Partial<TechEffects>;
}

export const TECHS: TechInfo[] = [
  { level: 1, id: 'longbow', name: 'Arco Longo', description: 'Arqueiros disciplinados dominam o campo.', effects: { military: 0.04 } },
  { level: 2, id: 'stone_castles', name: 'Castelos de Pedra', description: 'Fortificações resistem a cercos.', effects: { defense: 0.06 } },
  { level: 3, id: 'gunpowder', name: 'Pólvora', description: 'Canhões mudam a guerra de cerco.', effects: { siege: 0.15, military: 0.04 } },
  { level: 4, id: 'printing', name: 'Imprensa', description: 'O conhecimento se espalha mais rápido.', effects: { research: 0.12 } },
  { level: 5, id: 'ocean_navigation', name: 'Navegação Oceânica', description: 'Caravelas cruzam oceanos.', effects: { seaRange: 1, economy: 0.04 } },
  { level: 6, id: 'arquebus', name: 'Arcabuzes', description: 'Infantaria com armas de fogo.', effects: { military: 0.06 } },
  { level: 7, id: 'bronze_artillery', name: 'Artilharia de Bronze', description: 'Canhões móveis e confiáveis.', effects: { siege: 0.12, military: 0.04 } },
  { level: 8, id: 'banking', name: 'Bancos', description: 'Crédito e comércio florescem.', effects: { economy: 0.08 } },
  { level: 9, id: 'bayonet', name: 'Mosquete com Baioneta', description: 'Infantaria de linha.', effects: { military: 0.07 } },
  { level: 10, id: 'modern_science', name: 'Ciência Moderna', description: 'Método científico e academias.', effects: { research: 0.15, growth: 0.02 } },
  { level: 11, id: 'field_artillery', name: 'Artilharia de Campanha', description: 'Canhões leves acompanham exércitos.', effects: { military: 0.07 } },
  { level: 12, id: 'steam_engine', name: 'Máquina a Vapor', description: 'Revolução industrial.', effects: { economy: 0.15, seaRange: 1 } },
  { level: 13, id: 'railways', name: 'Ferrovias', description: 'Tropas e cargas cruzam o país em dias.', effects: { movement: 0.25, economy: 0.06 } },
  { level: 14, id: 'telegraph', name: 'Telégrafo', description: 'Comando e controle à distância.', effects: { military: 0.05, research: 0.06 } },
  { level: 15, id: 'rifles', name: 'Fuzis de Retrocarga', description: 'Poder de fogo devastador.', effects: { military: 0.1 } },
  { level: 16, id: 'modern_medicine', name: 'Medicina Moderna', description: 'Vacinas e saneamento.', effects: { growth: 0.06 } },
  { level: 17, id: 'machine_gun', name: 'Metralhadora', description: 'A defesa domina o campo de batalha.', effects: { defense: 0.12, military: 0.05 } },
  { level: 18, id: 'combustion', name: 'Motor a Combustão', description: 'Caminhões, navios a diesel e petróleo.', effects: { movement: 0.2, economy: 0.1, seaRange: 1 } },
  { level: 19, id: 'aviation', name: 'Aviação', description: 'Forças aéreas surgem.', effects: { military: 0.08 } },
  { level: 20, id: 'tanks', name: 'Blindados', description: 'Tanques rompem frentes fortificadas.', effects: { military: 0.1, siege: 0.15 } },
  { level: 21, id: 'radar', name: 'Radar', description: 'Detecção antecipada de ataques.', effects: { defense: 0.08 } },
  { level: 22, id: 'antibiotics', name: 'Antibióticos', description: 'Mortalidade despenca.', effects: { growth: 0.05 } },
  { level: 23, id: 'nuclear', name: 'Energia Nuclear', description: 'Dissuasão e energia abundante.', effects: { defense: 0.1, economy: 0.08 } },
  { level: 24, id: 'computers', name: 'Computadores', description: 'Automação e cálculo.', effects: { research: 0.15, economy: 0.1 } },
  { level: 25, id: 'guided_missiles', name: 'Mísseis Guiados', description: 'Ataques de precisão.', effects: { military: 0.1 } },
  { level: 26, id: 'internet', name: 'Internet', description: 'Economia global conectada.', effects: { economy: 0.12, research: 0.1 } },
  { level: 27, id: 'drones', name: 'Drones', description: 'Guerra remota.', effects: { military: 0.1 } },
  { level: 28, id: 'ai', name: 'Inteligência Artificial', description: 'Planejamento e produção automatizados.', effects: { economy: 0.15, research: 0.15 } },
];

export const EMPTY_EFFECTS: TechEffects = { military: 0, economy: 0, growth: 0, movement: 0, seaRange: 0, siege: 0, defense: 0, research: 0 };

const cumulative: TechEffects[] = [];
{
  let acc = { ...EMPTY_EFFECTS };
  for (let lvl = 0; lvl <= 40; lvl++) {
    for (const t of TECHS) {
      if (t.level !== lvl) continue;
      const next = { ...acc };
      for (const [k, v] of Object.entries(t.effects)) next[k as keyof TechEffects] += v as number;
      acc = next;
    }
    cumulative.push(acc);
  }
}

export function techEffects(level: number): TechEffects {
  return cumulative[Math.max(0, Math.min(cumulative.length - 1, Math.floor(level)))];
}

export const unlockedTechs = (level: number) => TECHS.filter((t) => t.level <= level);
export const nextTech = (level: number) => TECHS.find((t) => t.level > level);

export function eraName(level: number): string {
  if (level < 3) return 'Medieval';
  if (level < 6) return 'Renascimento';
  if (level < 10) return 'Era da Pólvora';
  if (level < 12) return 'Iluminismo';
  if (level < 16) return 'Era Industrial';
  if (level < 20) return 'Era Moderna';
  if (level < 25) return 'Era Atômica';
  return 'Era Digital';
}

export const hasAirForce = (level: number) => level >= 19;
export const cavalryName = (level: number) => (level >= 20 ? 'Blindados' : 'Cavalaria');
