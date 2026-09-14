// Icones de interface em pixel art: desenhados em grade 16x16 e ampliados para 64x64.
import { PixelArt } from './PixelArt';

const I: Record<string, string[]> = {
  pause: [
    '................', '................', '................', '...kkkk..kkkk...', '...kwwk..kwwk...', '...kwwk..kwwk...',
    '...kwwk..kwwk...', '...kwwk..kwwk...', '...kwwk..kwwk...', '...kwwk..kwwk...', '...kwwk..kwwk...', '...kwwk..kwwk...',
    '...kkkk..kkkk...', '................', '................', '................',
  ],
  play: [
    '................', '................', '....kk..........', '....kwk.........', '....kwwk........', '....kwwwk.......',
    '....kwwwwk......', '....kwwwwwk.....', '....kwwwwwk.....', '....kwwwwk......', '....kwwwk.......', '....kwwk........',
    '....kwk.........', '....kk..........', '................', '................',
  ],
  ff: [
    '................', '................', '................', '..kk.....kk.....', '..kwk....kwk....', '..kwwk...kwwk...',
    '..kwwwk..kwwwk..', '..kwwwwk.kwwwwk.', '..kwwwwk.kwwwwk.', '..kwwwk..kwwwk..', '..kwwk...kwwk...', '..kwk....kwk....',
    '..kk.....kk.....', '................', '................', '................',
  ],
  people: [
    '................', '....kkk.........', '...ksssk..kkk...', '...ksssk.ksssk..', '...ksssk.ksssk..', '....kkk..ksssk..',
    '...kuuuk..kkk...', '..kuuuuuk.krrrk.', '..kuuuuukkrrrrrk', '..kuuuuukkrrrrrk', '..kuuuuukkrrrrrk', '..kkkkkkkkkkkkkk',
    '................', '................', '................', '................',
  ],
  coins: [
    '................', '................', '................', '....kkkkkkk.....', '...kyyyyyyyk....', '...kYYYYYYYk....',
    '...kkkkkkkkk....', '...kyyyyyyyk....', '...kYYYYYYYk....', '..kkkkkkkkkkk...', '..kyyyyyyyyyk...', '..kYYYYYYYYYk...',
    '..kkkkkkkkkkk...', '................', '................', '................',
  ],
  chart: [
    '................', '................', '.k..............', '.k..........kkk.', '.k..........kek.', '.k......kkk.kek.',
    '.k......kek.kek.', '.k..kkk.kek.kek.', '.k..kek.kek.kek.', '.k..kek.kek.kek.', '.k..kek.kek.kek.', '.k..kek.kek.kek.',
    '.kkkkkkkkkkkkkkk', '................', '................', '................',
  ],
  sword: [
    '................', '..............k.', '.............kwk', '............kwk.', '...........kwk..', '..........kwk...',
    '.........kwk....', '....kk..kwk.....', '....kyk.kk......', '.....kyk........', '....kbkyk.......', '...kbk.kyk......',
    '..kbk...kk......', '..kk............', '................', '................',
  ],
  swords: [
    '................', '.kk..........kk.', '.kwk........kwk.', '..kwk......kwk..', '...kwk....kwk...', '....kwk..kwk....',
    '.....kwkkwk.....', '......kwwk......', '......kwwk......', '.....kykkyk.....', '..kkkyk..kykkk..', '..kbbk....kbbk..',
    '.kbbk......kbbk.', '.kkk........kkk.', '................', '................',
  ],
  scales: [
    '................', '.......kk.......', '.......yy.......', '.kkkkkkyykkkkkk.', '.k.....yy.....k.', 'kyk....yy....kyk',
    'kyk....yy....kyk', 'kyyk...yy...kyyk', 'kkkk...yy...kkkk', '.......yy.......', '.......yy.......', '.....kyyyyk.....',
    '....kyyyyyyk....', '....kkkkkkkk....', '................', '................',
  ],
  gear: [
    '................', '......kkkk......', '..kk..kmmk..kk..', '..kmkkkmmkkkmk..', '...kmmmmmmmmk...', '..kkmmmkkmmmkk..',
    '.kmmmmk..kmmmmk.', '.kmmmk....kmmmk.', '.kmmmk....kmmmk.', '.kmmmmk..kmmmmk.', '..kkmmmkkmmmkk..', '...kmmmmmmmmk...',
    '..kmkkkmmkkkmk..', '..kk..kmmk..kk..', '......kkkk......', '................',
  ],
  crown: [
    '................', '................', '................', '..k....kk....k..', '.kyk..kyyk..kyk.', '.kyyk.kyyk.kyyk.',
    '.kyyykyyyykyyyk.', '.kyyyyyyyyyyyyk.', '.kyyyryyyyuyyyk.', '.kyyrrryyuuuyyk.', '.kyyyryyyyuyyyk.', '.kYYYYYYYYYYYYk.',
    '.kyyyyyyyyyyyyk.', '.kkkkkkkkkkkkkk.', '................', '................',
  ],
  smile: [
    '................', '.....kkkkkk.....', '...kkyyyyyykk...', '..kyyyyyyyyyyk..', '.kyyyyyyyyyyyyk.', '.kyyykyyyykyyyk.',
    'kyyyykyyyykyyyyk', 'kyyyyyyyyyyyyyyk', 'kyyyyyyyyyyyyyyk', 'kyykyyyyyyyykyyk', '.kyykkyyyykkyyk.', '.kyyyykkkkyyyyk.',
    '..kyyyyyyyyyyk..', '...kkyyyyyykk...', '.....kkkkkk.....', '................',
  ],
  temple: [
    '................', '.......kk.......', '......kyyk......', '.....kyyyyk.....', '....kkkkkkkk....', '...kwwwwwwwwk...',
    '..kkkkkkkkkkkk..', '...kwk.kk.kwk...', '...kwk.kk.kwk...', '...kwk.kk.kwk...', '...kwk.kk.kwk...', '...kwk.kk.kwk...',
    '..kkkkkkkkkkkk..', '.kwwwwwwwwwwwwk.', '.kkkkkkkkkkkkkk.', '................',
  ],
  helmet: [
    '................', '................', '.....kkkkkk.....', '...kkmmmmmmkk...', '..kmmmmmmmmmmk..', '..kmmmmmmmmmmk..',
    '.kmmmmmmmmmmmmk.', '.kmkkkkkkkkkkmk.', '.kmk.k.kk.k.kmk.', '.kmk.k.kk.k.kmk.', '.kmkkkkkkkkkkmk.', '.kmmmmmmmmmmmmk.',
    '..kmmmmmmmmmmk..', '...kkkkkkkkkk...', '................', '................',
  ],
  chest: [
    '................', '................', '................', '...kkkkkkkkkk...', '..kbbbbbbbbbbk..', '.kbbbbbbbbbbbbk.',
    '.kYYYYYYYYYYYYk.', '.kkkkkkyykkkkkk.', '.kbbbbkyykbbbbk.', '.kbbbbbkkbbbbbk.', '.kbbbbbbbbbbbbk.', '.kYYYYYYYYYYYYk.',
    '.kbbbbbbbbbbbbk.', '.kkkkkkkkkkkkkk.', '................', '................',
  ],
  scroll: [
    '................', '..kkkkkkkkkkk...', '.knnnnnnnnnnnk..', '.kNkkkkkkkkkNk..', '..kwwwwwwwwwk...', '..kwkkkkkkwwk...',
    '..kwwwwwwwwwk...', '..kwkkkkkwwwk...', '..kwwwwwwwwwk...', '..kwkkkkkkkwk...', '..kwwwwwwkkkk...', '..kwwwwwkrrrk...',
    '.kkkkkkkkrRrk...', '.knnnnnnnkrk....', '..kkkkkkkk.k....', '................',
  ],
  book: [
    '................', '................', '.kkkkkk..kkkkkk.', '.kwwwwwkkwwwwwk.', '.kwkkkwkkwkkkwk.', '.kwwwwwkkwwwwwk.',
    '.kwkkkwkkwkkkwk.', '.kwwwwwkkwwwwwk.', '.kwkkkwkkwkkwwk.', '.kwwwwwkkwwwwwk.', '.kwkkwwkkwkkkwk.', '.kwwwwwkkwwwwwk.',
    '.kkkkkkkkkkkkkk.', '..kbbbbbbbbbbk..', '...kkkkkkkkkk...', '................',
  ],
  dove: [
    '................', '................', '.........kkk....', '........kwwwk...', '.......kwwwkok..', '..kk..kwwwwkk...',
    '.kwwkkwwwwwk....', '.kwwwwwwwwk.....', '..kwwwwwwwk.....', '...kwwwwwwwk....', '....kkwwwwwwk...', '......kkkwwwkk..',
    '.........kkk....', '...ee...........', '................', '................',
  ],
  shield: [
    '................', '..kkkkkkkkkkkk..', '..kuuuuukyyyyk..', '..kuuuuukyyyyk..', '..kuuuuukyyyyk..', '..kuuuuukyyyyk..',
    '..kkkkkkkkkkkk..', '..kyyyyykuuuuk..', '..kyyyyykuuuuk..', '...kyyyykuuuk...', '...kyyyykuuuk...', '....kyyykuuk....',
    '.....kyykuk.....', '......kkkk......', '................', '................',
  ],
  fire: [
    '................', '.......k........', '......kok.......', '......kok...k...', '.....koOok.kok..', '..k..koOOokkok..',
    '.kok.koOOOkoOk..', '.koOkkoOOOoOOk..', '.koOOoOOwOOOOk..', '.koOOOOwwwOOok..', '..koOOwwwwOOk...', '..koOOwwwwOok...',
    '...kooOOOOok....', '....kkkkkkk.....', '................', '................',
  ],
  flag: [
    '................', '..k.............', '..kkkkkkkkkkk...', '..krrrrrrrrrrk..', '..krrrrrrrrrrk..', '..krrrwwwrrrrk..',
    '..krrwwwwwrrrk..', '..krrrwwwrrrrk..', '..krrrrrrrrrrk..', '..kkkkkkkkkkkk..', '..k.............', '..k.............',
    '..k.............', '..k.............', '.kkk............', '................',
  ],
  mountain: [
    '................', '................', '.....kk.........', '....kwwk........', '...kwwgdk.......', '...kwggdk..kk...',
    '..kgggddk.kwwk..', '..kgggdddkwggdk.', '.kggggdddkgggddk', '.kgggddddkggdddk', 'kgggggddkgggdddk', 'kkkkkkkkkkkkkkkk',
    '................', '................', '................', '................',
  ],
  building: [
    '................', '.......kk.......', '......kbbk......', '.....kbbbbk.....', '....kkkkkkkk....', '....kwwwwwwk....',
    '....kwkwwkwk....', '....kwwwwwwk....', '..kkkkkkkkkkkk..', '..kwwwwwwwwwwk..', '..kwkwkwwkwkwk..', '..kwwwwwwwwwwk..',
    '..kwkwkbbkwkwk..', '..kwwwwbbwwwwk..', '..kkkkkkkkkkkk..', '................',
  ],
  anchor: [
    '................', '.......kk.......', '......kmmk......', '......kmmk......', '.......kk.......', '....kkkmmkkk....',
    '....kmmmmmmk....', '....kkkmmkkk....', '.......mm.......', '..k....mm....k..', '.kmk...mm...kmk.', '.kmmk..mm..kmmk.',
    '..kmmkkmmkkmmk..', '...kmmmmmmmmk...', '....kkkkkkkk....', '................',
  ],
  plane: [
    '................', '.......kk.......', '......kmmk......', '......kmmk......', '......kmmk......', '..kkkkkmmkkkkk..',
    '.kmmmmmmmmmmmmk.', '.kkkkkkmmkkkkkk.', '......kmmk......', '......kmmk......', '.....kkmmkk.....', '....kmmmmmmk....',
    '....kkkkkkkk....', '................', '................', '................',
  ],
  pin: [
    '................', '.....kkkkk......', '....krrrrrk.....', '...krrwwrrrk....', '...krwwwwrrk....', '...krrwwrrrk....',
    '...krrrrrrrk....', '....krrrrrk.....', '.....krrrk......', '......krk.......', '......krk.......', '.......k........',
    '................', '................', '................', '................',
  ],
  house: [
    '................', '................', '.......kk.......', '......krrk......', '.....krrrrk.....', '....krrrrrrk....',
    '...krrrrrrrrk...', '..kkkkkkkkkkkk..', '...kwwwwwwwwk...', '...kwkkwwkkwk...', '...kwkkwwkkwk...', '...kwwwwwwwwk...',
    '...kwwwkkwwwk...', '...kwwwkkwwwk...', '...kkkkkkkkkk...', '................',
  ],
  skull: [
    '................', '................', '.....kkkkkk.....', '....kwwwwwwk....', '...kwwwwwwwwk...', '...kwwwwwwwwk...',
    '...kwkkwwkkwk...', '...kwkkwwkkwk...', '...kwwwwwwwwk...', '....kwwkkwwk....', '....kwwwwwwk....', '....kwkwkwkk....',
    '.....kkkkkk.....', '................', '................', '................',
  ],
  trophy: [
    '................', '..kkkkkkkkkkkk..', '.kkyyyyyyyyyykk.', 'kyykyyyyyyyykyyk', 'ky.kyyyyyyyyk.yk', 'kyykyyyyyyyykyyk',
    '.kkkyyyyyyyykkk.', '...kyyyyyyyyk...', '....kyyyyyyk....', '.....kyyyyk.....', '......kyyk......', '......kyyk......',
    '....kkyyyykk....', '...kYYYYYYYYk...', '...kkkkkkkkkk...', '................',
  ],
  save: [
    '................', '.kkkkkkkkkkkkk..', '.kuuuwwwwwwuukk.', '.kuuuwwwwwwuuuk.', '.kuuuwwwwkwuuuk.', '.kuuuwwwwkwuuuk.',
    '.kuuuwwwwwwuuuk.', '.kuuuuuuuuuuuuk.', '.kuukkkkkkkkuuk.', '.kuukwwwwwwkuuk.', '.kuukwkkkkwkuuk.', '.kuukwwwwwwkuuk.',
    '.kuukwkkkkwkuuk.', '.kuukwwwwwwkuuk.', '.kkkkkkkkkkkkkk.', '................',
  ],
  folder: [
    '................', '................', '.kkkkk..........', '.kyyyyk.........', '.kyyyyykkkkkkkk.', '.kyyyyyyyyyyyyk.',
    '.kYYYYYYYYYYYYk.', '.kyyyyyyyyyyyyk.', '.kyyyyyyyyyyyyk.', '.kyyyyyyyyyyyyk.', '.kyyyyyyyyyyyyk.', '.kyyyyyyyyyyyyk.',
    '.kkkkkkkkkkkkkk.', '................', '................', '................',
  ],
  close: [
    '................', '................', '..kk........kk..', '.kwwk......kwwk.', '.kwwwk....kwwwk.', '..kwwwk..kwwwk..',
    '...kwwwkkwwwk...', '....kwwwwwwk....', '....kwwwwwwk....', '...kwwwkkwwwk...', '..kwwwk..kwwwk..', '.kwwwk....kwwwk.',
    '.kwwk......kwwk.', '..kk........kk..', '................', '................',
  ],
  globe: [
    '................', '.....kkkkkk.....', '...kkuueeuukk...', '..kuueeeeuuuuk..', '.kuueeeeeuuuuuk.', '.kuuueeeuuueeuk.',
    'kuuuuueuuueeeeuk', 'kuuuuuuuueeeeeuk', 'kuueeuuuuueeeuuk', 'kueeeeuuuuueuuuk', '.keeeeeuuuuuuuk.', '.kueeeuuuuuuuuk.',
    '..kuueuuuuuuuk..', '...kkuuuuuukk...', '.....kkkkkk.....', '................',
  ],
  castle: [
    '................', '..kk.kk..kk.kk..', '..kkkkk..kkkkk..', '..kgggk..kgggk..', '..kgkgkkkkgkgk..', '..kggggggggggk..',
    '..kggggggggggk..', '..kggkkkkkkggk..', '..kggkbbbbkggk..', '..kggkbbbbkggk..', '..kggkbbbbkggk..', '..kkkkkkkkkkkk..',
    '................', '................', '................', '................',
  ],
  info: [
    '................', '......kkkk......', '......kwwk......', '......kkkk......', '................', '.....kkkkk......',
    '.....kwwwk......', '......kwwk......', '......kwwk......', '......kwwk......', '......kwwk......', '.....kkwwkk.....',
    '.....kwwwwk.....', '.....kkkkkk.....', '................', '................',
  ],
  target: [
    '................', '......kkkk......', '....kkrrrrkk....', '...krrwwwwrrk...', '..krwwkkkkwwrk..', '..krwkrrrrkwrk..',
    '.krwkrrwwrrkwrk.', '.krwkrwkkwrkwrk.', '.krwkrwkkwrkwrk.', '.krwkrrwwrrkwrk.', '..krwkrrrrkwrk..', '..krwwkkkkwwrk..',
    '...krrwwwwrrk...', '....kkrrrrkk....', '......kkkk......', '................',
  ],
};

// Aliases semanticos usados pela interface.
const ALIAS: Record<string, string> = {
  handshake: 'scroll',
  chain: 'shield',
  mask: 'people',
  population: 'people',
  gdp: 'chart',
  army: 'sword',
  war: 'swords',
  battle: 'swords',
  stability: 'scales',
  tech: 'gear',
  settings: 'gear',
  prestige: 'crown',
  government: 'crown',
  happiness: 'smile',
  religion: 'temple',
  manpower: 'helmet',
  treasury: 'chest',
  diplomacy: 'scroll',
  history: 'book',
  peace: 'dove',
  alliance: 'shield',
  unrest: 'fire',
  rebellion: 'fire',
  terrain: 'mountain',
  development: 'building',
  navy: 'anchor',
  air: 'plane',
  province: 'pin',
  city: 'house',
  destroyed: 'skull',
  victory: 'trophy',
  load: 'folder',
  menu: 'globe',
  fort: 'castle',
  locate: 'target',
  stats: 'chart',
};

const cache = new Map<string, string>();

export function iconArt(name: string): PixelArt {
  const key = I[name] ? name : ALIAS[name] ?? 'info';
  return new PixelArt(16).rows(I[key]).scaled(4);
}

// Data URL do icone (64x64) para uso em <img> e CSS.
export function iconUrl(name: string): string {
  let url = cache.get(name);
  if (!url) {
    url = iconArt(name).toCanvas().toDataURL();
    cache.set(name, url);
  }
  return url;
}

export const iconNames = () => [...Object.keys(I), ...Object.keys(ALIAS)];
