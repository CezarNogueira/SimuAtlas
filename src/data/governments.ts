// Formas de governo e seus modificadores sobre estabilidade, economia, diplomacia e militar.
export type GovernmentId =
  | 'republic'
  | 'monarchy'
  | 'empire'
  | 'democracy'
  | 'dictatorship'
  | 'theocracy'
  | 'federation'
  | 'confederation';

export interface GovernmentInfo {
  id: GovernmentId;
  name: string;
  title: string; // prefixo do nome formal ("Reino de ...")
  rulerTitle: string;
  stability: number; // deslocamento da estabilidade-alvo
  corruption: number; // corrupcao base (0..1)
  tax: number; // eficiencia de arrecadacao
  diplomacy: number; // bonus de relacoes
  military: number; // multiplicador de mobilizacao
  growth: number; // multiplicador de crescimento economico
  rebellion: number; // multiplicador de agitacao
  centralization: number; // gravidade da queda da capital (0..1)
  aggression: number; // ajuste da agressividade da IA
  electionYears: number; // 0 = sucessao hereditaria/vitalicia
  description: string;
}

export const GOVERNMENTS: Record<GovernmentId, GovernmentInfo> = {
  republic: {
    id: 'republic', name: 'República', title: 'República', rulerTitle: 'Presidente',
    stability: 4, corruption: 0.14, tax: 1.0, diplomacy: 5, military: 1.0, growth: 1.02, rebellion: 1.0,
    centralization: 0.6, aggression: 0, electionYears: 6,
    description: 'Governo eletivo. Estável e comercialmente ativo.',
  },
  monarchy: {
    id: 'monarchy', name: 'Monarquia', title: 'Reino', rulerTitle: 'Rei',
    stability: 7, corruption: 0.16, tax: 0.95, diplomacy: 0, military: 1.05, growth: 0.98, rebellion: 1.0,
    centralization: 0.75, aggression: 0.05, electionYears: 0,
    description: 'Sucessão hereditária. Estável, mas vulnerável a crises dinásticas.',
  },
  empire: {
    id: 'empire', name: 'Império', title: 'Império', rulerTitle: 'Imperador',
    stability: 3, corruption: 0.22, tax: 1.05, diplomacy: -6, military: 1.2, growth: 1.0, rebellion: 1.2,
    centralization: 0.9, aggression: 0.15, electionYears: 0,
    description: 'Poder militar concentrado. Territórios diversos geram agitação.',
  },
  democracy: {
    id: 'democracy', name: 'Democracia', title: 'República', rulerTitle: 'Primeiro-Ministro',
    stability: 9, corruption: 0.08, tax: 1.05, diplomacy: 10, military: 0.85, growth: 1.07, rebellion: 0.7,
    centralization: 0.45, aggression: -0.15, electionYears: 4,
    description: 'Eleições livres. Economia forte, pouco belicosa.',
  },
  dictatorship: {
    id: 'dictatorship', name: 'Ditadura', title: 'Regime', rulerTitle: 'Ditador',
    stability: -2, corruption: 0.32, tax: 1.1, diplomacy: -10, military: 1.3, growth: 0.95, rebellion: 1.15,
    centralization: 1.0, aggression: 0.2, electionYears: 0,
    description: 'Poder absoluto de um líder. Militarizada e instável.',
  },
  theocracy: {
    id: 'theocracy', name: 'Teocracia', title: 'Teocracia', rulerTitle: 'Sumo Sacerdote',
    stability: 6, corruption: 0.15, tax: 0.9, diplomacy: -5, military: 1.1, growth: 0.94, rebellion: 0.9,
    centralization: 0.8, aggression: 0.08, electionYears: 0,
    description: 'Governo religioso. Coeso, hostil a outras fés.',
  },
  federation: {
    id: 'federation', name: 'Federação', title: 'Federação', rulerTitle: 'Presidente',
    stability: 6, corruption: 0.12, tax: 1.0, diplomacy: 5, military: 1.0, growth: 1.03, rebellion: 0.8,
    centralization: 0.35, aggression: -0.05, electionYears: 5,
    description: 'Estados autônomos unidos. Resiste bem à perda da capital.',
  },
  confederation: {
    id: 'confederation', name: 'Confederação', title: 'Confederação', rulerTitle: 'Chanceler',
    stability: -3, corruption: 0.15, tax: 0.85, diplomacy: 5, military: 0.9, growth: 1.0, rebellion: 1.1,
    centralization: 0.2, aggression: -0.05, electionYears: 5,
    description: 'Aliança frouxa de membros soberanos. Descentralizada.',
  },
};

export const GOVERNMENT_IDS = Object.keys(GOVERNMENTS) as GovernmentId[];
