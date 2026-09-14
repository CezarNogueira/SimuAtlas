import type { RGB } from './terrain';

export type ReligionId =
  | 'catholic'
  | 'protestant'
  | 'orthodox'
  | 'sunni'
  | 'shia'
  | 'jewish'
  | 'hindu'
  | 'buddhist'
  | 'confucian'
  | 'shinto'
  | 'animist';

export interface ReligionInfo {
  id: ReligionId;
  name: string;
  group: 'cristã' | 'islâmica' | 'dhármica' | 'oriental' | 'abraâmica' | 'tradicional';
  color: RGB;
}

export const RELIGIONS: Record<ReligionId, ReligionInfo> = {
  catholic: { id: 'catholic', name: 'Catolicismo', group: 'cristã', color: [214, 196, 90] },
  protestant: { id: 'protestant', name: 'Protestantismo', group: 'cristã', color: [96, 130, 196] },
  orthodox: { id: 'orthodox', name: 'Ortodoxia', group: 'cristã', color: [196, 120, 70] },
  sunni: { id: 'sunni', name: 'Islã Sunita', group: 'islâmica', color: [80, 160, 90] },
  shia: { id: 'shia', name: 'Islã Xiita', group: 'islâmica', color: [40, 120, 80] },
  jewish: { id: 'jewish', name: 'Judaísmo', group: 'abraâmica', color: [120, 150, 220] },
  hindu: { id: 'hindu', name: 'Hinduísmo', group: 'dhármica', color: [230, 140, 60] },
  buddhist: { id: 'buddhist', name: 'Budismo', group: 'oriental', color: [230, 190, 70] },
  confucian: { id: 'confucian', name: 'Confucionismo', group: 'oriental', color: [190, 80, 80] },
  shinto: { id: 'shinto', name: 'Xintoísmo', group: 'oriental', color: [210, 90, 120] },
  animist: { id: 'animist', name: 'Crenças Tradicionais', group: 'tradicional', color: [150, 110, 80] },
};

export const RELIGION_IDS = Object.keys(RELIGIONS) as ReligionId[];

export function religionAffinity(a: ReligionId, b: ReligionId): number {
  if (a === b) return 1;
  return RELIGIONS[a].group === RELIGIONS[b].group ? 0.4 : 0;
}
