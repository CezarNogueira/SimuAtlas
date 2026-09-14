// Bandeiras reais em pixel art (32x20) pelo codigo do pais nos mapas. Cada pais real tem sempre o mesmo desenho e
// as mesmas cores, em qualquer mundo e semente; nacoes criadas durante a simulacao (rebeldes, independencias) usam
// bandeiras procedurais.
import type { FlagPainter } from '../render/sprites/FlagPainter';

type FlagSpec = (p: FlagPainter) => void;

const W = '#ffffff';
const K = '#000000';

const EAGLE = [
  'X.........X',
  'XX..X.X..XX',
  'XXX.XXX.XXX',
  '.XXXXXXXXX.',
  '..XXXXXXX..',
  '...XXXXX...',
  '....XXX....',
  '...XX.XX...',
  '..X.X.X.X..',
];

const MAPLE = ['....X....', '...XXX...', '.X.XXX.X.', 'XXXXXXXXX', '.XXXXXXX.', '..XXXXX..', '.XXXXXXX.', '....X....', '....X....'];

const PENTAGRAM = ['...X...', '..X.X..', 'XXXXXXX', '.X...X.', '..X.X..', '.X.X.X.', 'X.....X'];

export const REAL_FLAGS: Record<string, FlagSpec> = {
  // Europa
  ALB: (p) => p.fill('#e41e20').sprite(EAGLE, 11, 5, { X: K }),
  ARM: (p) => p.h(['#d90012', '#0033a0', '#f2a800']),
  AUT: (p) => p.h(['#ed2939', W, '#ed2939']),
  AZE: (p) => p.h(['#00b5e2', '#ef3340', '#509e2f']).crescent(15, 10, 3.4, W, 1.1, 0, 2.8).star(19, 10, 2, W),
  BEL: (p) => p.v([K, '#fdda24', '#ef3340']),
  BGR: (p) => p.h([W, '#00966e', '#d62612']),
  BIH: (p) => {
    p.fill('#002395').each((x, y) => (x >= 9 + y * 0.75 && x <= 24 ? '#fecb00' : null));
    for (let y = 1; y < 20; y += 3) p.px(Math.round(6 + y * 0.75), y, W);
  },
  BLR: (p) =>
    p.h(['#c8313e', '#4aa657'], [2, 1]).rect(0, 0, 5, 20, W).each((x, y) => (x > 1 && x < 4 && (Math.floor(x) + Math.floor(y)) % 3 === 1 ? '#c8313e' : null)),
  CHE: (p) => p.fill('#da291c').rect(14, 4, 4, 12, W).rect(10, 8, 12, 4, W),
  CYN: (p) => p.fill(W).rect(0, 2, 32, 2, '#e30a17').rect(0, 16, 32, 2, '#e30a17').crescent(14, 10, 3.6, '#e30a17', 1.2, 0, 3).star(19, 10, 2, '#e30a17'),
  CYP: (p) =>
    p
      .fill(W)
      .sprite(['...OOOOOOO..', 'OOOOOOOOOOOO', '..OOOOOOOO..', '....OO......'], 10, 6, { O: '#d57800' })
      .sprite(['G..........G', '.GG......GG.', '...GGGGGG...'], 10, 12, { G: '#4e5b31' }),
  CZE: (p) => p.h([W, '#d7141a']).triangle('#11457e', 15),
  DEU: (p) => p.h([K, '#dd0000', '#ffce00']),
  DNK: (p) => p.nordic('#c8102e', W),
  ESP: (p) =>
    p.h(['#aa151b', '#f1bf00', '#aa151b'], [1, 2, 1]).sprite(['.ggg.', 'rrwww', 'rgwpw', 'wwwrr', 'wpwrg', '.wwr.'], 6, 7, {
      g: '#b08d00',
      r: '#aa151b',
      w: W,
      p: '#6b2d7b',
    }),
  EST: (p) => p.h(['#0072ce', K, W]),
  FIN: (p) => p.nordic(W, '#002f6c'),
  FRA: (p) => p.v(['#002654', W, '#ce1126']),
  FRO: (p) => p.nordic(W, '#0065bd', '#ef303e'),
  GBR: (p) => p.unionJack(0, 0, 32, 20),
  GEO: (p) => {
    const plus = ['.X.', 'XXX', '.X.'];
    p.fill(W).cross('#ff0000', 4);
    for (const [x, y] of [[6, 3], [24, 3], [6, 15], [24, 15]]) p.sprite(plus, x, y, { X: '#ff0000' });
  },
  GRC: (p) => p.stripes(9, '#0d5eaf', W).rect(0, 0, 12, 11, '#0d5eaf').rect(5, 0, 2, 11, W).rect(0, 4, 12, 2, W),
  HRV: (p) =>
    p.h(['#ff0000', W, '#171796']).sprite(['bbbbbb', 'rwrwrw', 'wrwrwr', 'rwrwrw', 'wrwrwr', '.rwrw.', '..wr..'], 13, 5, { r: '#ff0000', w: W, b: '#0093dd' }),
  HUN: (p) => p.h(['#ce2939', W, '#477050']),
  IRL: (p) => p.v(['#169b62', W, '#ff883e']),
  ISL: (p) => p.nordic('#02529c', W, '#dc1e35'),
  ITA: (p) => p.v(['#009246', W, '#ce2b37']),
  KOS: (p) => {
    p.fill('#244aa5').sprite(['..GGG...', '.GGGGGG.', 'GGGGGGGG', '.GGGGGG.', '..GGGG..'], 12, 9, { G: '#d0a650' });
    for (const [x, y] of [[10, 6], [12, 5], [14, 4], [17, 4], [19, 5], [21, 6]]) p.px(x, y, W);
  },
  LTU: (p) => p.h(['#fdb913', '#006a44', '#c1272d']),
  LUX: (p) => p.h(['#ed2939', W, '#00a1de']),
  LVA: (p) => p.h(['#9e3039', W, '#9e3039'], [2, 1, 2]),
  MDA: (p) => p.v(['#0046ae', '#ffd200', '#cc092f']).sprite(['b...b', 'bbbbb', '.rbr.', '.bbb.', '..b..'], 14, 7, { b: '#8a5a2b', r: '#cc092f' }),
  MKD: (p) =>
    p
      .fill('#d20000')
      .each((x, y) => {
        const k = Math.atan2(y - 10, (x - 16) * 0.625) / (Math.PI / 4);
        return Math.abs(k - Math.round(k)) < 0.2 ? '#ffe600' : null;
      })
      .disc(16, 10, 4.3, '#d20000')
      .disc(16, 10, 3.3, '#ffe600'),
  MLT: (p) => p.v([W, '#cf142b']).sprite(['.g.', 'ggg', '.g.'], 2, 2, { g: '#9e9e9e' }),
  MNE: (p) => p.fill('#c40308').border('#d4af3a', 1).sprite(EAGLE, 11, 5, { X: '#d4af3a' }),
  NLD: (p) => p.h(['#ae1c28', W, '#21468b']),
  NOR: (p) => p.nordic('#ba0c2f', W, '#00205b'),
  POL: (p) => p.h([W, '#dc143c']),
  PRT: (p) => p.v(['#006600', '#ff0000'], [2, 3]).disc(13, 10, 4.2, '#ffcc00').disc(13, 10, 3, '#ff0000').rect(12, 9, 2, 3, W),
  ROU: (p) => p.v(['#002b7f', '#fcd116', '#ce1126']),
  RUS: (p) => p.h([W, '#0039a6', '#d52b1e']),
  SRB: (p) => p.h(['#c6363c', '#0c4076', W]).sprite(['.yyy.', 'rrwrr', 'wwwww', 'rrwrr', 'rrwrr', '.rrr.'], 6, 6, { r: '#c6363c', w: W, y: '#d4af3a' }),
  SVK: (p) =>
    p
      .h([W, '#0b4ea2', '#ee1c25'])
      .sprite(['wwwwwwww', 'wrrwwrrw', 'wrwwwwrw', 'wrrwwrrw', 'wwwwwwww', 'wrrwwrrw', 'wbbwwbbw', 'wbbbbbbw', '.wbbbbw.', '..wwww..'], 7, 4, {
        w: W,
        r: '#ee1c25',
        b: '#0b4ea2',
      }),
  SVN: (p) =>
    p.h([W, '#005da4', '#ed1c24']).sprite(['rrrrrr', 'rbbbbr', 'rbwbbr', 'rwwwbr', 'rwwwwr', '.rbbr.', '..rr..'], 6, 3, { r: '#ed1c24', b: '#005da4', w: W }),
  SWE: (p) => p.nordic('#006aa7', '#fecc02'),
  TUR: (p) => p.fill('#e30a17').crescent(11, 10, 5, W, 1.3, 0, 4).star(18, 10, 3, W),
  UKR: (p) => p.h(['#0057b7', '#ffd700']),

  // Africa
  AGO: (p) => p.h(['#cc092f', K]).crescent(15, 10, 4, '#ffcb00', 0.8, -0.8, 3).star(17, 8, 2, '#ffcb00'),
  BDI: (p) =>
    p
      .quarters('#ce1126', '#1eb53a')
      .saltire(W, 3)
      .disc(16, 10, 5, W)
      .star(16, 7, 2, '#ce1126')
      .star(13, 11, 2, '#ce1126')
      .star(18, 11, 2, '#ce1126'),
  BEN: (p) => p.h(['#fcd116', '#e8112d']).rect(0, 0, 12, 20, '#008751'),
  BFA: (p) => p.h(['#ef2b2d', '#009e49']).star(16, 10, 4, '#fcd116'),
  BWA: (p) => p.fill('#75aadb').rect(0, 7, 32, 6, W).rect(0, 8, 32, 4, K),
  CAF: (p) => p.h(['#003082', W, '#289728', '#ffce00']).rect(14, 0, 4, 20, '#d21034').star(5, 2, 2, '#ffce00'),
  CIV: (p) => p.v(['#f77f00', W, '#009e60']),
  CMR: (p) => p.v(['#007a5e', '#ce1126', '#fcd116']).star(16, 10, 3, '#fcd116'),
  COD: (p) => p.fill('#007fff').band('#f7d618', 7, 'up').band('#ce1021', 4, 'up').star(6, 5, 4, '#f7d618'),
  COG: (p) => p.diagonal('#009543', '#dc241f', 'up').band('#fbde4a', 7, 'up'),
  COM: (p) =>
    p
      .h(['#ffc61e', W, '#ce1126', '#3a75c4'])
      .triangle('#3d8e33', 13)
      .crescent(5, 10, 3.5, W, 1.4, 0, 3)
      .px(8, 7, W)
      .px(8, 9, W)
      .px(8, 11, W)
      .px(8, 13, W),
  CPV: (p) => {
    p.fill('#003893').rect(0, 10, 32, 2, W).rect(0, 12, 32, 2, '#cf2027').rect(0, 14, 32, 2, W);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      p.px(Math.round(12 + 5 * Math.cos(a) - 0.5), Math.round(12.5 + 4.5 * Math.sin(a) - 0.5), '#f7d116');
    }
  },
  DJI: (p) => p.h(['#6ab2e7', '#12ad2b']).triangle(W, 14).star(5, 10, 3, '#d7141a'),
  DZA: (p) => p.v(['#006633', W]).crescent(16, 10, 5, '#d21034', 1.6, 0, 4.1).star(19, 10, 3, '#d21034'),
  EGY: (p) => p.h(['#ce1126', W, K]).sprite(['.y.y.', 'yyyyy', '.yyy.', '.y.y.'], 14, 8, { y: '#c09300' }),
  ERI: (p) => p.h(['#12ad2b', '#4189dd']).triangle('#ea0437', 32).ring(8, 10, 3.5, 1, '#ffc726').rect(8, 8, 1, 4, '#ffc726'),
  ETH: (p) => p.h(['#078930', '#fcdd09', '#da121a']).disc(16, 10, 5.5, '#0f47af').star(16, 10, 4, '#fcdd09'),
  GAB: (p) => p.h(['#009e60', '#fcd116', '#3a75c4']),
  GHA: (p) => p.h(['#ce1126', '#fcd116', '#006b3f']).star(16, 10, 3, K),
  GIN: (p) => p.v(['#ce1126', '#fcd116', '#009460']),
  GMB: (p) => p.h(['#ce1126', W, '#0c1c8c', W, '#3a7728'], [6, 1, 4, 1, 6]),
  GNB: (p) => p.h(['#fcd116', '#009e49']).rect(0, 0, 11, 20, '#ce1126').star(5, 10, 3, K),
  GNQ: (p) => p.h(['#3e9a00', W, '#e32118']).triangle('#0073ce', 8).sprite(['.g.', 'ggg', '.b.'], 15, 8, { g: '#3e9a00', b: '#8a5a2b' }),
  KEN: (p) =>
    p
      .h([K, W, '#bb0000', W, '#006600'], [6, 1, 6, 1, 6])
      .sprite(['..k..', '.rrr.', 'krwrk', 'krwrk', 'krwrk', 'krwrk', '.rrr.', '..k..'], 14, 6, { k: K, r: '#bb0000', w: W }),
  LBR: (p) => p.stripes(11, '#bf0a30', W).rect(0, 0, 10, 9, '#002868').star(5, 4, 3, W),
  LBY: (p) => p.h(['#e70013', K, '#239e46'], [1, 2, 1]).crescent(15, 10, 3.5, W, 1.2, 0, 2.9).star(18, 10, 2, W),
  LSO: (p) => p.h(['#00209f', W, '#009543'], [3, 4, 3]).sprite(['...k...', '..kkk..', '.kk.kk.', 'kkkkkkk'], 13, 8, { k: K }),
  MAR: (p) => p.fill('#c1272d').sprite(PENTAGRAM, 13, 7, { X: '#006233' }),
  MDG: (p) => p.h(['#fc3d32', '#007e3a']).rect(0, 0, 11, 20, W),
  MLI: (p) => p.v(['#14b53a', '#fcd116', '#ce1126']),
  MOZ: (p) => p.h(['#007168', W, K, W, '#fce100'], [6, 1, 6, 1, 6]).triangle('#d21034', 12).star(4, 10, 4, '#fce100'),
  MRT: (p) =>
    p.fill('#006233').rect(0, 0, 32, 3, '#d01c1f').rect(0, 17, 32, 3, '#d01c1f').crescent(16, 9, 5, '#ffc400', 0, -1.8, 4.3).star(16, 6, 2, '#ffc400'),
  MUS: (p) => p.h(['#ea2839', '#1a206d', '#ffd500', '#00a551']),
  MWI: (p) =>
    p.h([K, '#ce1126', '#339e35']).each((x, y) => {
      const d = Math.hypot(x - 16, y - 7);
      const k = Math.atan2(7 - y, x - 16) / (Math.PI / 8);
      return y < 7 && (d <= 3 || (d >= 4 && d <= 6.5 && Math.abs(k - Math.round(k)) < 0.18)) ? '#ce1126' : null;
    }),
  NAM: (p) => p.diagonal('#003580', '#009543', 'up').band(W, 8, 'up').band('#d21034', 5, 'up').disc(6, 5, 2.5, '#ffce00'),
  NER: (p) => p.h(['#e05206', W, '#0db02b']).disc(16, 10, 2.6, '#e05206'),
  NGA: (p) => p.v(['#008751', W, '#008751']),
  RWA: (p) => p.h(['#00a1de', '#fad201', '#20603d'], [2, 1, 1]).disc(26, 5, 3, '#e5be01').disc(26, 5, 2, '#00a1de').disc(26, 5, 1.5, '#e5be01'),
  SAH: (p) => p.h([K, W, '#007a3d']).triangle('#c4111b', 11).crescent(17, 10, 3, '#c4111b', 1, 0, 2.5).star(19, 10, 2, '#c4111b'),
  SDN: (p) => p.h(['#d21034', W, K]).triangle('#007229', 12),
  SDS: (p) => p.h([K, W, '#da121a', W, '#078930'], [6, 1, 6, 1, 6]).triangle('#0f47af', 13).star(4, 10, 3, '#fcdd09'),
  SEN: (p) => p.v(['#00853f', '#fdef42', '#e31b23']).star(16, 10, 3, '#00853f'),
  SHN: (p) =>
    p
      .fill('#012169')
      .unionJack(0, 0, 16, 10)
      .sprite(['aaaaa', 'ayyya', 'aaaaa', 'bbbbb', 'bwbwb', '.bbb.'], 22, 7, { a: '#6cace4', y: '#ffcd00', b: '#1e3f7a', w: W }),
  SLE: (p) => p.h(['#1eb53a', W, '#0072c6']),
  SOL: (p) =>
    p
      .h(['#009a44', W, '#d00c27'])
      .star(16, 10, 3, K)
      .each((x, y) => (Math.floor(y) === 3 && Math.floor(x) >= 10 && Math.floor(x) <= 21 && Math.floor(x) % 2 === 0 ? W : null)),
  SOM: (p) => p.fill('#4189dd').star(16, 10, 4, W),
  STP: (p) => p.h(['#12ad2b', '#ffce00', '#12ad2b'], [2, 3, 2]).triangle('#d21034', 10).star(15, 10, 3, K).star(23, 10, 3, K),
  SWZ: (p) =>
    p
      .h(['#3e5eb9', '#ffd900', '#b10c0c', '#ffd900', '#3e5eb9'], [4, 1, 10, 1, 4])
      .sprite(['..wwwwkkkk..', '.wwwwwkkkkk.', 'wwkwwwkkwkkk', '.wwwwwkkkkk.', '..wwwwkkkk..'], 10, 8, { w: W, k: K }),
  SYC: (p) =>
    p.each((x, y) => {
      const a = Math.atan2(20 - y, x);
      return a > 1.081 ? '#003f87' : a > 0.753 ? '#fcd856' : a > 0.395 ? '#d62828' : a > 0.205 ? W : '#007a3d';
    }),
  TCD: (p) => p.v(['#002664', '#fecb00', '#c60c30']),
  TGO: (p) => p.stripes(5, '#006a4e', '#ffce00').rect(0, 0, 12, 12, '#d21034').star(6, 6, 4, W),
  TUN: (p) => p.fill('#e70013').disc(16, 10, 5.5, W).crescent(15.5, 10, 4, '#e70013', 1.3, 0, 3.3).star(18, 10, 3, '#e70013'),
  TZA: (p) => p.diagonal('#1eb53a', '#00a3dd', 'up').band('#fcd116', 9, 'up').band(K, 6, 'up'),
  UGA: (p) =>
    p
      .h([K, '#fcdc04', '#d90000', K, '#fcdc04', '#d90000'])
      .disc(16, 10, 4.5, W)
      .sprite(['.kk.', 'kkyk', '.kr.', '.kk.', '.k..'], 14, 8, { k: K, y: '#fcdc04', r: '#d90000' }),
  ZAF: (p) =>
    p
      .h(['#e03c31', '#001489'])
      .pall(W, '#007749', 7, 4.2, 13)
      .triangle('#ffb81c', 10, 2.6, 17.4)
      .triangle(K, 8, 3.8, 16.2),
  ZMB: (p) => p.fill('#198a00').v(['#de2010', K, '#ef7d00'], [1, 1, 1], 20, 8, 12, 12).sprite(['o.o.o', '.ooo.', '..o..'], 24, 3, { o: '#ef7d00' }),
  ZWE: (p) =>
    p
      .h(['#006400', '#ffd200', '#d40000', K, '#d40000', '#ffd200', '#006400'])
      .triangle(K, 13)
      .triangle(W, 12, 0.7, 19.3)
      .star(4, 10, 3, '#d40000'),

  // Americas
  ARG: (p) => p.h(['#74acdf', W, '#74acdf']).disc(16, 10, 2.5, '#f6b40e'),
  BHS: (p) => p.h(['#00778b', '#ffc72c', '#00778b']).triangle(K, 13),
  BLZ: (p) =>
    p
      .fill('#003f87')
      .rect(0, 0, 32, 2, '#ce1126')
      .rect(0, 18, 32, 2, '#ce1126')
      .disc(16, 10, 5.5, W)
      .ring(16, 10, 5.5, 1, '#4a8f3c')
      .sprite(['.kk.', 'kwwk', 'kwwk', '.kk.'], 14, 8, { k: '#5b3a1e', w: W }),
  BOL: (p) => p.h(['#d52b1e', '#f9e300', '#007934']),
  BRA: (p) =>
    p
      .fill('#009c3b')
      .each((x, y) => (Math.abs(x - 16) / 13.5 + Math.abs(y - 10) / 8.5 <= 1 ? '#ffdf00' : null))
      .disc(16, 10, 5.2, '#002776')
      .each((x, y) => ((x - 16) ** 2 + (y - 10) ** 2 <= 27 && Math.abs(y - (10.3 - (x - 16) * 0.18 + (x - 16) ** 2 * 0.03)) < 0.75 ? W : null))
      .px(14, 12, W)
      .px(17, 13, W)
      .px(19, 11, W)
      .px(15, 14, W)
      .px(12, 11, W),
  CAN: (p) => p.v(['#d52b1e', W, '#d52b1e'], [1, 2, 1]).sprite(MAPLE, 12, 5, { X: '#d52b1e' }),
  CHL: (p) => p.h([W, '#d52b1e']).rect(0, 0, 11, 10, '#0039a6').star(5, 5, 3, W),
  COL: (p) => p.h(['#fcd116', '#003893', '#ce1126'], [2, 1, 1]),
  CRI: (p) => p.h(['#002b7f', W, '#ce1126', W, '#002b7f'], [1, 1, 2, 1, 1]),
  CUB: (p) => p.stripes(5, '#002a8f', W).triangle('#cb1515', 14).star(5, 10, 3, W),
  DOM: (p) =>
    p
      .fill(W)
      .rect(0, 0, 14, 8, '#002d62')
      .rect(18, 0, 14, 8, '#ce1126')
      .rect(0, 12, 14, 8, '#ce1126')
      .rect(18, 12, 14, 8, '#002d62')
      .rect(15, 9, 2, 2, '#1e7b3a'),
  ECU: (p) =>
    p
      .h(['#ffdd00', '#034ea2', '#ed1c24'], [2, 1, 1])
      .sprite(['.b.b.', 'bbbbb', '.cyc.', '.cgc.', '..c..'], 14, 7, { b: '#6d4c2f', c: '#c8a200', y: '#ffdd00', g: '#2e8b57' }),
  FLK: (p) =>
    p.fill('#012169').unionJack(0, 0, 16, 10).sprite(['.www.', 'wwwww', 'wbwbw', 'wwwww', '.bbb.', '..b..'], 22, 6, { w: W, b: '#3a75c4' }),
  GRL: (p) => p.h([W, '#d00c33']).each((x, y) => ((x - 12) ** 2 + (y - 10) ** 2 <= 36 ? (y < 10 ? '#d00c33' : W) : null)),
  GTM: (p) => p.v(['#4997d0', W, '#4997d0']).ring(16, 10, 3, 1, '#6c8c2e').rect(15, 9, 2, 2, '#2f7d32'),
  GUY: (p) => p.fill('#009e49').triangle(W, 32).triangle('#fcd116', 30, 1.2, 18.8).triangle(K, 16).triangle('#ce1126', 14, 1.4, 18.6),
  HND: (p) =>
    p.h(['#00bce4', W, '#00bce4']).px(12, 9, '#00bce4').px(12, 11, '#00bce4').px(16, 10, '#00bce4').px(20, 9, '#00bce4').px(20, 11, '#00bce4'),
  HTI: (p) => p.h(['#00209f', '#d21034']).rect(11, 6, 10, 8, W).rect(15, 8, 2, 4, '#2e7d32').rect(13, 11, 6, 2, '#2e7d32'),
  JAM: (p) => p.quarters('#009b3a', K).saltire('#fed100', 4),
  MEX: (p) => p.v(['#006847', W, '#ce1126']).sprite(['.bb..', 'bbbb.', '.bbbb', '..bb.', 'ggggg'], 14, 7, { b: '#8c5a2b', g: '#2e7d32' }),
  NIC: (p) => p.h(['#0067c6', W, '#0067c6']).sprite(['..y..', '.yby.', 'ybbby'], 14, 9, { y: '#c8a200', b: '#0067c6' }),
  PAN: (p) =>
    p.fill(W).rect(16, 0, 16, 10, '#da121a').rect(0, 10, 16, 10, '#072357').star(8, 5, 3, '#072357').star(24, 15, 3, '#da121a'),
  PER: (p) => p.v(['#d91023', W, '#d91023']),
  PRI: (p) => p.stripes(5, '#ed0000', W).triangle('#0050f0', 14).star(5, 10, 3, W),
  PRY: (p) => p.h(['#d52b1e', W, '#0038a8']).ring(16, 10, 2.8, 1, '#2e7d32').rect(15, 9, 2, 2, '#fcd116'),
  SLV: (p) => p.h(['#0047ab', W, '#0047ab']).sprite(['..y..', '.ygy.', 'yyyyy'], 14, 9, { y: '#c8a200', g: '#2e7d32' }),
  SUR: (p) => p.h(['#377e3f', W, '#b40a2d', W, '#377e3f'], [2, 1, 4, 1, 2]).star(16, 10, 4, '#ecc81d'),
  TCA: (p) =>
    p
      .fill('#012169')
      .unionJack(0, 0, 16, 10)
      .sprite(['yyyyy', 'yoyyy', 'yyygy', 'yyyyy', '.yyy.'], 22, 6, { y: '#fcd116', o: '#ff8c00', g: '#2e7d32' }),
  TTO: (p) => p.fill('#da1a35').band(W, 8, 'down').band(K, 5, 'down'),
  URY: (p) => p.stripes(9, W, '#0038a8').rect(0, 0, 12, 11, W).disc(6, 5.5, 3.2, '#fcd116'),
  USA: (p) =>
    p
      .stripes(13, '#b22234', W)
      .rect(0, 0, 14, 11, '#3c3b6e')
      .each((x, y) => {
        const i = Math.floor(x);
        const j = Math.floor(y);
        return i >= 1 && i <= 12 && j >= 1 && j <= 9 && (i + j) % 2 === 0 ? W : null;
      }),
  VEN: (p) => {
    p.h(['#ffcc00', '#00247d', '#cf142b']);
    for (let i = 0; i < 8; i++) {
      const a = Math.PI * (1.1 + (0.8 * i) / 7);
      p.px(Math.round(15.5 + 5 * Math.cos(a)), Math.round(12 + 4 * Math.sin(a)), W);
    }
  },
  VIR: (p) =>
    p
      .fill(W)
      .sprite(['y.......y', 'yy.yyy.yy', 'yyyybyyyy', '.yyrbry..', '..yyyyy..', '.y..y..y.'], 12, 6, { y: '#f4c300', b: '#0a3b8c', r: '#ce1126' })
      .px(7, 10, '#0a3b8c')
      .px(24, 10, '#0a3b8c'),

  // Asia e Oriente Medio
  AFG: (p) => p.v([K, '#d32011', '#007a36']).ring(16, 10, 3, 1, W),
  ARE: (p) => p.h(['#00732f', W, K]).rect(0, 0, 8, 20, '#ff0000'),
  BGD: (p) => p.fill('#006a4e').disc(14, 10, 6, '#f42a41'),
  BHR: (p) => p.fill('#ce1126').serrated(W, 7, 3, 5),
  BRN: (p) =>
    p
      .fill('#f7e017')
      .band(W, 3.5, 'down', -1.8)
      .band(K, 3.5, 'down', 1.8)
      .sprite(['r...r', 'rr.rr', '.rrr.', '..r..', '.rrr.'], 14, 8, { r: '#cf1126' }),
  BTN: (p) =>
    p
      .diagonal('#ffd520', '#ff4e12', 'up')
      .each((x, y) => (Math.abs(y - (20 - x * 0.625)) < 1.6 && x > 7 && x < 25 && Math.floor(x) % 3 !== 0 ? W : null)),
  CHN: (p) =>
    p
      .fill('#de2910')
      .star(6, 5, 4, '#ffde00')
      .px(11, 2, '#ffde00')
      .px(13, 4, '#ffde00')
      .px(13, 7, '#ffde00')
      .px(11, 9, '#ffde00'),
  IDN: (p) => p.h(['#ce1126', W]),
  IND: (p) => p.h(['#ff9933', W, '#138808']).ring(16, 10, 3, 1, '#000080').rect(15, 9, 2, 2, '#000080'),
  IRN: (p) =>
    p
      .h(['#239f40', W, '#da0000'])
      .sprite(['.r.r.', 'rr.rr', '.r.r.', '..r..'], 14, 8, { r: '#da0000' })
      .each((x, y) => ((Math.floor(y) === 6 || Math.floor(y) === 13) && Math.floor(x) % 2 === 0 ? W : null)),
  IRQ: (p) =>
    p
      .h(['#ce1126', W, K])
      .each((x, y) => (Math.floor(y) >= 9 && Math.floor(y) <= 10 && Math.floor(x) >= 10 && Math.floor(x) <= 21 && Math.floor(x) % 3 !== 2 ? '#007a3d' : null)),
  ISR: (p) =>
    p
      .fill(W)
      .rect(0, 2, 32, 3, '#0038b8')
      .rect(0, 15, 32, 3, '#0038b8')
      .line(16, 6, 12, 12, '#0038b8')
      .line(16, 6, 20, 12, '#0038b8')
      .line(12, 12, 20, 12, '#0038b8')
      .line(16, 14, 12, 8, '#0038b8')
      .line(16, 14, 20, 8, '#0038b8')
      .line(12, 8, 20, 8, '#0038b8'),
  JOR: (p) => p.h([K, W, '#007a3d']).triangle('#ce1126', 15).star(5, 10, 2, W),
  JPN: (p) => p.fill(W).disc(16, 10, 5.5, '#bc002d'),
  KAZ: (p) =>
    p
      .fill('#00afca')
      .disc(16, 9, 3.6, '#fec50c')
      .sprite(['y.y.y', '.yyy.'], 14, 13, { y: '#fec50c' })
      .each((x, y) => (Math.floor(x) === 2 + (Math.floor(y) % 2) ? '#fec50c' : null)),
  KGZ: (p) =>
    p
      .fill('#e8112d')
      .disc(16, 10, 5.2, '#ffef00')
      .disc(16, 10, 3.2, '#e8112d')
      .disc(16, 10, 2.3, '#ffef00')
      .line(14, 9, 18, 9, '#e8112d')
      .line(14, 11, 18, 11, '#e8112d'),
  KHM: (p) =>
    p.h(['#032ea1', '#e00025', '#032ea1'], [1, 2, 1]).sprite(['....w....', '...www...', '.w.www.w.', 'wwwwwwwww', 'wwwwwwwww'], 12, 8, { w: W }),
  KOR: (p) =>
    p
      .fill(W)
      .each((x, y) => {
        const dx = x - 16;
        const dy = y - 10;
        if (dx * dx + dy * dy > 20) return null;
        return dy + 1.3 * Math.sin(dx * 0.75) < 0 ? '#cd2e3a' : '#0047a0';
      })
      .rect(3, 2, 5, 1, K)
      .rect(3, 4, 5, 1, K)
      .rect(3, 6, 5, 1, K)
      .rect(24, 2, 2, 1, K)
      .rect(27, 2, 2, 1, K)
      .rect(24, 4, 5, 1, K)
      .rect(24, 6, 2, 1, K)
      .rect(27, 6, 2, 1, K)
      .rect(3, 13, 5, 1, K)
      .rect(3, 15, 2, 1, K)
      .rect(6, 15, 2, 1, K)
      .rect(3, 17, 5, 1, K)
      .rect(24, 13, 2, 1, K)
      .rect(27, 13, 2, 1, K)
      .rect(24, 15, 2, 1, K)
      .rect(27, 15, 2, 1, K)
      .rect(24, 17, 2, 1, K)
      .rect(27, 17, 2, 1, K),
  KWT: (p) => p.h(['#007a3d', W, '#ce1126']).each((x, y) => (x < Math.min(8, (8 * Math.min(y, 20 - y)) / 6.67) ? K : null)),
  LAO: (p) => p.h(['#ce1126', '#002868', '#ce1126'], [1, 2, 1]).disc(16, 10, 4, W),
  LBN: (p) =>
    p
      .h(['#ed1c24', W, '#ed1c24'], [1, 2, 1])
      .sprite(['...g...', '..ggg..', '.ggggg.', '..ggg..', '.ggggg.', 'ggggggg', '...b...'], 13, 6, { g: '#00a651', b: '#6b4423' }),
  LKA: (p) =>
    p
      .fill('#ffb700')
      .rect(1, 1, 4, 18, '#005f56')
      .rect(5, 1, 4, 18, '#ff5b00')
      .rect(10, 1, 21, 18, '#8d153a')
      .sprite(['..yy....', '.yyyy..y', 'yyyyyyy.', '.yyyyyy.', '.y.y..y.'], 16, 8, { y: '#ffb700' }),
  MMR: (p) => p.h(['#fecb00', '#34b233', '#ea2839']).star(16, 10, 4, W),
  MNG: (p) => p.v(['#c4272f', '#015197', '#c4272f']).sprite(['.y.', 'yyy', '...', 'yyy', 'y.y', 'yyy', '...', 'yyy'], 4, 6, { y: '#f9cf02' }),
  MYS: (p) => p.stripes(14, '#cc0001', W).rect(0, 0, 16, 11, '#010066').crescent(5, 5.5, 3.5, '#ffcc00', 1.3, 0, 2.9).star(10, 5, 3, '#ffcc00'),
  NPL: (p) => {
    // Unica bandeira nao retangular: o fundo fora das flamulas fica transparente.
    const inside = (x: number, y: number, m: number) => {
      const u = x - 8;
      if (u < m) return false;
      const upper = y >= m && y <= 11 - m * 0.5 && u <= (16 * y) / 11 - m * 1.8;
      const lower = y >= 9 && y <= 20 - m && u <= (18 * (y - 9)) / 11 - m * 1.8;
      return upper || lower;
    };
    p.each((x, y) => (inside(x, y, 1) ? '#dc143c' : inside(x, y, 0) ? '#003893' : null))
      .sprite(['w...w', '.www.'], 10, 6, { w: W })
      .star(12, 15, 2, W);
  },
  OMN: (p) => p.fill('#db161b').rect(9, 0, 23, 7, W).rect(9, 13, 23, 7, '#008000').sprite(['w.w', '.w.', 'w.w'], 3, 2, { w: W }),
  PAK: (p) => p.fill('#01411c').rect(0, 0, 8, 20, W).crescent(19, 10.5, 5.5, W, 1.5, -1.5, 4.6).star(22, 7, 3, W),
  PHL: (p) =>
    p.h(['#0038a8', '#ce1126']).triangle(W, 17).disc(5.5, 10, 2.5, '#fcd116').px(1, 2, '#fcd116').px(1, 17, '#fcd116').px(13, 10, '#fcd116'),
  PNG: (p) =>
    p
      .diagonal('#ce1126', K, 'down')
      .sprite(['yy.....', '.yyy...', '..yyyyy', '...yy..', '..y.y..'], 20, 3, { y: '#fcd116' })
      .px(6, 11, W)
      .px(4, 13, W)
      .px(8, 13, W)
      .px(6, 16, W)
      .px(7, 14, W),
  PRK: (p) => p.h(['#024fa2', W, '#ed1c27', W, '#024fa2'], [6, 1, 12, 1, 6]).disc(10, 10, 4.2, W).star(10, 10, 4, '#ed1c27'),
  PSX: (p) => p.h([K, W, '#007a3d']).triangle('#ce1126', 13),
  QAT: (p) => p.fill('#8a1538').serrated(W, 8, 3, 9),
  SAU: (p) =>
    p
      .fill('#006c35')
      .each((x, y) => {
        const i = Math.floor(x);
        const j = Math.floor(y);
        return j >= 6 && j <= 8 && i >= 8 && i <= 23 && (i * 7 + j * 3) % 4 !== 0 ? W : null;
      })
      .rect(9, 12, 14, 1, W)
      .rect(21, 11, 1, 3, W),
  SGP: (p) =>
    p.h(['#ef3340', W]).crescent(6, 5, 3.4, W, 1.2, 0, 2.9).px(10, 3, W).px(12, 4, W).px(11, 7, W).px(9, 7, W).px(8, 4, W),
  SYR: (p) => p.h(['#007a3d', W, K]).star(10, 10, 3, '#ce1126').star(16, 10, 3, '#ce1126').star(22, 10, 3, '#ce1126'),
  THA: (p) => p.h(['#a51931', '#f4f5f8', '#2d2a4a', '#f4f5f8', '#a51931'], [1, 1, 2, 1, 1]),
  TJK: (p) => p.h(['#cc0000', W, '#006600'], [2, 3, 2]).sprite(['y.y.y', '.yyy.', 'yyyyy'], 14, 9, { y: '#f8c300' }),
  TKM: (p) =>
    p
      .fill('#28ae66')
      .rect(4, 0, 6, 20, '#d22630')
      .each((x, y) => {
        const i = Math.floor(x);
        const j = Math.floor(y);
        return i >= 5 && i <= 8 && j % 4 !== 3 && (i + j) % 2 === 0 ? '#f2c14e' : null;
      })
      .crescent(14, 4, 2.6, W, 1, 0, 2.1)
      .px(17, 2, W)
      .px(18, 4, W)
      .px(17, 6, W),
  TLS: (p) => p.fill('#dc241f').triangle('#ffc726', 15).triangle(K, 10).star(3, 10, 3, W),
  TWN: (p) =>
    p
      .fill('#fe0000')
      .rect(0, 0, 16, 10, '#000095')
      .each((x, y) => {
        const d = Math.hypot(x - 8, y - 5);
        const k = Math.atan2(y - 5, x - 8) / (Math.PI / 6);
        return x < 16 && y < 10 && d < 4.6 && Math.abs(k - Math.round(k)) < 0.3 ? W : null;
      })
      .disc(8, 5, 3, W)
      .disc(8, 5, 2.2, '#000095')
      .disc(8, 5, 1.7, W),
  UZB: (p) =>
    p
      .h(['#0099b5', '#ce1126', W, '#ce1126', '#1eb53a'], [6, 1, 6, 1, 6])
      .crescent(5, 3.5, 2.6, W, 1, 0, 2.1)
      .px(9, 2, W)
      .px(11, 2, W)
      .px(9, 4, W)
      .px(11, 4, W),
  VNM: (p) => p.fill('#da251d').star(16, 10, 4, '#ffff00'),
  YEM: (p) => p.h(['#ce1126', W, K]),

  // Oceania e territorios
  ATF: (p) =>
    p
      .fill('#002654')
      .rect(0, 0, 12, 8, W)
      .v(['#002654', W, '#ed2939'], [1, 1, 1], 0, 0, 11, 7)
      .sprite(['www.w.w', '..w.www', '..w.w.w'], 18, 8, { w: W })
      .px(19, 14, W)
      .px(22, 15, W)
      .px(25, 14, W)
      .px(21, 12, W)
      .px(24, 12, W),
  AUS: (p) =>
    p
      .fill('#012169')
      .unionJack(0, 0, 16, 10)
      .star(8, 15, 4, W)
      .star(24, 4, 2, W)
      .star(20, 9, 2, W)
      .star(28, 8, 2, W)
      .star(24, 16, 2, W)
      .px(26, 11, W),
  FJI: (p) =>
    p
      .fill('#68bfe5')
      .unionJack(0, 0, 16, 10)
      .sprite(['wwwww', 'wrwrw', 'rrrrr', 'wwrww', 'wwrww', '.wrw.'], 22, 7, { w: W, r: '#ce1126' }),
  FSM: (p) => p.fill('#75b2dd').star(16, 5, 3, W).star(10, 10, 3, W).star(22, 10, 3, W).star(16, 15, 3, W),
  MNP: (p) => p.fill('#0071bc').ring(16, 10, 6, 1, '#7a9e3a').disc(16, 10, 4.2, '#9e9e9e').star(16, 10, 4, W),
  NCL: (p) => p.h(['#0035ad', '#e2001a', '#009543']).disc(12, 10, 6, K).disc(12, 10, 5, '#ffd200').sprite(['.k.', 'kkk', '.k.', '.k.', 'kkk'], 11, 8, { k: K }),
  NZL: (p) => {
    p.fill('#00247d').unionJack(0, 0, 16, 10);
    for (const [x, y] of [[24, 4], [21, 9], [27, 8], [24, 16]]) p.star(x, y, 2, W).px(x, y, '#cc142b');
  },
  PYF: (p) => p.h(['#ce1126', W, '#ce1126'], [1, 2, 1]).each((x, y) => ((x - 16) ** 2 + (y - 10) ** 2 <= 12.5 ? (y > 10.5 ? '#0055a4' : '#f9a51b') : null)),
  SGS: (p) =>
    p.fill('#012169').unionJack(0, 0, 16, 10).sprite(['.www.', 'wgwgw', 'wwwww', '.wbw.', '..w..'], 22, 6, { w: W, g: '#8fbc8f', b: '#6b4423' }),
  SLB: (p) => p.diagonal('#0051ba', '#215b33', 'up').band('#fcd116', 2.5, 'up').px(2, 2, W).px(6, 2, W).px(4, 4, W).px(2, 6, W).px(6, 6, W),
  TON: (p) => p.fill('#c10000').rect(0, 0, 13, 10, W).rect(5, 2, 3, 6, '#c10000').rect(3, 4, 7, 2, '#c10000'),
  VUT: (p) =>
    p
      .h(['#d21034', '#009543'])
      .pall(K, '#fdce12', 5, 3, 13)
      .triangle(K, 10, 2.5, 17.5)
      .sprite(['.yy.', 'y..y', 'y...', '.yy.'], 2, 8, { y: '#fdce12' }),
  WSM: (p) => p.fill('#ce1126').rect(0, 0, 16, 10, '#002b7f').px(8, 2, W).star(5, 5, 2, W).star(11, 4, 2, W).star(8, 8, 2, W).px(10, 6, W),
};

export const hasRealFlag = (code: string): boolean => Object.prototype.hasOwnProperty.call(REAL_FLAGS, code);
