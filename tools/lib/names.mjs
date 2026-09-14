// Normalizacao de nomes para portugues do Brasil.
// O Natural Earth traz NAME_PT majoritariamente em portugues europeu.

const COUNTRY_FIX = {
  KEN: 'Quênia', IRN: 'Irã', POL: 'Polônia', VNM: 'Vietnã', EST: 'Estônia', LVA: 'Letônia',
  SVN: 'Eslovênia', MKD: 'Macedônia do Norte', ARM: 'Armênia', ROU: 'Romênia', MCO: 'Mônaco',
  MDG: 'Madagascar', CZE: 'Tchéquia', YEM: 'Iêmen', BEN: 'Benin', MUS: 'Maurício',
  NCL: 'Nova Caledônia', CYM: 'Ilhas Cayman', DJI: 'Djibuti', FRO: 'Ilhas Faroé',
  CYN: 'Chipre do Norte', BLM: 'São Bartolomeu', SAH: 'Saara Ocidental', IRL: 'Irlanda',
  COG: 'Congo', COD: 'RD do Congo', CAF: 'Centro-África', BIH: 'Bósnia',
  ARE: 'Emirados Árabes', DOM: 'República Dominicana', SWZ: 'Essuatíni', PSX: 'Palestina',
  FLK: 'Malvinas', TCA: 'Turks e Caicos', ATF: 'Terras Austrais', IOT: 'Chagos',
  SGS: 'Geórgia do Sul', UMI: 'Ilhas Menores dos EUA', VGB: 'Ilhas Virgens', VIR: 'Ilhas Virgens (EUA)',
  GRL: 'Groenlândia', NLD: 'Países Baixos', GBR: 'Reino Unido', USA: 'Estados Unidos',
  BHR: 'Bahrein', MDA: 'Moldávia', BLR: 'Bielorrússia', KOS: 'Kosovo', SOL: 'Somalilândia',
  GNQ: 'Guiné Equatorial', STP: 'São Tomé e Príncipe', PNG: 'Papua-Nova Guiné', TLS: 'Timor-Leste',
};

const CITY_FIX = {
  Moscovo: 'Moscou', Teerão: 'Teerã', Amesterdão: 'Amsterdã', Roterdão: 'Roterdã', Banguecoque: 'Bangkok',
  Bagdade: 'Bagdá', Riade: 'Riad', 'Nova Iorque': 'Nova York', Bombaim: 'Mumbai', Copenhaga: 'Copenhague',
  Carachi: 'Karachi', Islamabade: 'Islamabad', 'Abu Dabi': 'Abu Dhabi', Taipé: 'Taipei', Zagrebe: 'Zagreb',
  Duchambé: 'Dushanbe', Bisqueque: 'Bishkek', Asgabate: 'Ashgabat', 'Ulã Bator': 'Ulan Bator',
  Pionguiangue: 'Pyongyang', Daca: 'Dhaka', Rangum: 'Yangon', Nepiedó: 'Naypyidaw', Vienciana: 'Vientiane',
  'Washington, D.C.': 'Washington', Quieve: 'Kiev', Kyiv: 'Kiev', Deli: 'Délhi', 'Nova Deli': 'Nova Délhi',
  Otava: 'Ottawa', Tiblíssi: 'Tbilisi', Erevã: 'Yerevan', Bacu: 'Baku', Minsque: 'Minsk', Escópia: 'Skopje',
  Quixinau: 'Chisinau', Tasquente: 'Tashkent', Osaca: 'Osaka', Quioto: 'Kyoto', Nagóia: 'Nagoya',
  Hiroxima: 'Hiroshima', Carcóvia: 'Kharkiv', Iecaterimburgo: 'Ecaterimburgo', Abidjã: 'Abidjan',
  Jedá: 'Jidá', Colónia: 'Colônia', Génova: 'Gênova', Mónaco: 'Mônaco',
};

const LUSOPHONE = new Set(['BRA', 'PRT', 'AGO', 'MOZ', 'CPV', 'GNB', 'STP', 'TLS', 'MAC']);

// Regras genericas PT-PT -> PT-BR para nomes estrangeiros ("Polónia" -> "Polônia", "Arménia" -> "Armênia").
// Exige vogal apos n/m para nao estragar nomes proprios como "León", "Concepción" ou "Veszprém".
function brazilian(name) {
  let s = name.replace(/ó(?=[nm][aeiou])/g, 'ô').replace(/é(?=[nm][aeiou])/g, 'ê');
  s = s.replace(/sque$/, 'sk');
  return s;
}

export function countryName(code, namePt, nameEn) {
  if (COUNTRY_FIX[code]) return COUNTRY_FIX[code];
  const base = namePt || nameEn || code;
  return LUSOPHONE.has(code) ? base : brazilian(base);
}

export function cityName(namePt, name, adm0) {
  const raw = (namePt || name || '').trim();
  if (!raw) return name || '?';
  if (CITY_FIX[raw]) return CITY_FIX[raw];
  if (LUSOPHONE.has(adm0)) return raw;
  return brazilian(raw);
}

export function regionName(namePt, name, adm0) {
  return cityName(namePt, name, adm0);
}

// ---------------------------------------------------------------------------------------------
// Estados. Nestes paises o admin-1 do Natural Earth esta um nivel abaixo do "estado" (condados,
// departamentos, provincias, municipios): as unidades sao agrupadas pela regiao oficial.
const REGION_GROUPS = {
  FRA: {
    'Hauts-de-France': 'Altos da França', 'Grand Est': 'Grande Leste', "Provence-Alpes-Côte-d'Azur": 'Provença-Alpes-Costa Azul',
    'Auvergne-Rhône-Alpes': 'Auvérnia-Ródano-Alpes', 'Nouvelle-Aquitaine': 'Nova Aquitânia', Occitanie: 'Occitânia',
    'Bourgogne-Franche-Comté': 'Borgonha-Franco-Condado', 'Pays de la Loire': 'Países do Loire', Bretagne: 'Bretanha',
    Normandie: 'Normandia', 'Centre-Val de Loire': 'Centro-Vale do Loire', 'Île-de-France': 'Ilha de França', Corse: 'Córsega',
    'Guyane française': 'Guiana Francesa', Martinique: 'Martinica', Guadeloupe: 'Guadalupe', Réunion: 'Reunião', Mayotte: 'Mayotte',
  },
  ITA: {
    "Valle d'Aosta": 'Vale de Aosta', Piemonte: 'Piemonte', Lombardia: 'Lombardia', 'Trentino-Alto Adige': 'Trentino-Alto Ádige',
    Liguria: 'Ligúria', 'Emilia-Romagna': 'Emília-Romanha', Marche: 'Marcas', Veneto: 'Vêneto', 'Friuli-Venezia Giulia': 'Friul-Veneza Júlia',
    Abruzzo: 'Abruzos', Molise: 'Molise', Apulia: 'Apúlia', Basilicata: 'Basilicata', Calabria: 'Calábria', Campania: 'Campânia',
    Lazio: 'Lácio', Toscana: 'Toscana', Sicily: 'Sicília', Sardegna: 'Sardenha', Umbria: 'Úmbria',
  },
  ESP: {
    Ceuta: 'Ceuta', Melilla: 'Melilla', 'Foral de Navarra': 'Navarra', 'País Vasco': 'País Basco', Aragón: 'Aragão', Cataluña: 'Catalunha',
    Extremadura: 'Estremadura', Andalucía: 'Andaluzia', Galicia: 'Galiza', 'Castilla y León': 'Castela e Leão', Valenciana: 'Valência',
    Murcia: 'Múrcia', Asturias: 'Astúrias', Cantabria: 'Cantábria', 'Canary Is.': 'Canárias', 'Islas Baleares': 'Baleares',
    'La Rioja': 'La Rioja', 'Castilla-La Mancha': 'Castela-Mancha', Madrid: 'Madri',
  },
  GBR: {
    'Northern Ireland': 'Irlanda do Norte', 'West Wales and the Valleys': 'País de Gales', 'East Wales': 'País de Gales',
    Eastern: 'Escócia', 'South Western': 'Escócia', 'North Eastern': 'Escócia', 'Highlands and Islands': 'Escócia',
    'North West': 'Noroeste da Inglaterra', 'North East': 'Nordeste da Inglaterra', 'Yorkshire and the Humber': 'Yorkshire',
    'East Midlands': 'Midlands Orientais', 'West Midlands': 'Midlands Ocidentais', East: 'Leste da Inglaterra',
    'Greater London': 'Londres', 'South East': 'Sudeste da Inglaterra', 'South West': 'Sudoeste da Inglaterra',
  },
  SVN: {
    'Obalno-kraška': 'Litoral-Carste', Pomurska: 'Pomurje', Gorenjska: 'Alta Carníola', Goriška: 'Goriška', Podravska: 'Podravje',
    Koroška: 'Caríntia Eslovena', Savinjska: 'Savinja', Spodnjeposavska: 'Baixa Sava', 'Jugovzhodna Slovenija': 'Sudeste da Eslovênia',
    'Notranjsko-kraška': 'Carníola Interior', Osrednjeslovenska: 'Eslovênia Central', Zasavska: 'Zasavje',
  },
  LVA: { Vidzeme: 'Vidzeme', Riga: 'Riga', Latgale: 'Letgália', Zemgale: 'Semigália', Kurzeme: 'Curlândia' },
  MKD: {
    Southwestern: 'Macedônia do Sudoeste', Polog: 'Polog', Southeastern: 'Macedônia do Sudeste', Vardar: 'Vardar', Pelagonia: 'Pelagônia',
    Skopje: 'Escópia', 'Greater Skopje': 'Escópia', Northeastern: 'Macedônia do Nordeste', Eastern: 'Macedônia Oriental',
  },
  AZE: {
    'Ganja-Gazakh Economic Region': 'Ganja-Gazakh', 'Kalbajar-Lachin Economic Region': 'Kalbajar-Lachin',
    'Naxçıvan Autonomous Republic': 'Naquichevão', 'Shaki-Zaqatala Economic Region': 'Shaki-Zaqatala',
    'Guba-Khachmaz Economic Region': 'Guba-Khachmaz', 'Aran Economic Region': 'Aran', 'Lankaran Economic Region': 'Lankaran',
    'Yukhari Garabakh Economic Region': 'Alto Karabakh', 'Absheron Economic Region': 'Absheron', 'Daghlig Shirvan Economic Region': 'Shirvan Montanhoso',
  },
  MLT: { 'Malta Xlokk': 'Malta', 'Malta Majjistral': 'Malta', Gozo: 'Gozo' },
  UGA: { Western: 'Uganda Ocidental', Central: 'Uganda Central', Eastern: 'Uganda Oriental', Northern: 'Uganda Setentrional' },
  KOS: {
    Đakovica: 'Đakovica', Prizren: 'Prizren', Gnjilane: 'Gnjilane', Uroševac: 'Uroševac', 'Kosovska Mitrovica': 'Mitrovica',
    Pristina: 'Pristina', Peć: 'Peć',
  },
  PHL: {
    'Autonomous Region in Muslim Mindanao (ARMM)': 'Mindanao Muçulmano', 'Davao (Region XI)': 'Davao',
    'Zamboanga Peninsula (Region IX)': 'Península de Zamboanga', 'MIMAROPA (Region IV-B)': 'Mimaropa', 'Dinagat Islands (Region XIII)': 'Caraga',
    'Northern Mindanao (Region X)': 'Mindanao Setentrional', 'SOCCSKSARGEN (Region XII)': 'Soccsksargen',
    'Eastern Visayas (Region VIII)': 'Visayas Orientais', 'Central Luzon (Region III)': 'Luzon Central', 'CALABARZON (Region IV-A)': 'Calabarzon',
    'Bicol (Region V)': 'Bicol', 'National Capital Region': 'Manila', 'Ilocos (Region I)': 'Ilocos', 'Cagayan Valley (Region II)': 'Vale do Cagayan',
    'Central Visayas (Region VII)': 'Visayas Centrais', 'Western Visayas (Region VI)': 'Visayas Ocidentais',
    'Cordillera Administrative Region (CAR)': 'Cordilheira',
  },
};

export function regionGroup(code, region) {
  const table = REGION_GROUPS[code];
  if (!table || !region) return null;
  return table[region] ?? region.replace(/\s*\(.*\)\s*$/, '').trim();
}

// Correcoes pontuais de name_pt (traducoes erradas, genericas ou em portugues europeu).
const STATE_FIX = {
  'CZE|Plzeň-Ciudad': 'Plzeň', 'ETH|das Nações': 'Povos do Sul', 'BHR|da Capital': 'Manama', 'RUS|Krai do Litoral': 'Primória',
  'RUS|Judaico': 'Birobidjan', 'RUS|República Autónoma da Crimeia': 'Crimeia', 'BRA|Federal': 'Distrito Federal',
  'USA|Nova Iorque': 'Nova York', 'USA|Nova Jérsia': 'Nova Jersey', 'IND|Andra Pradexe': 'Andhra Pradesh', 'IND|Carnataca': 'Karnataka',
  'GRC|Attica': 'Ática', 'GRC|de Peloponnes': 'Peloponeso', 'BGR|Província da Cidade de Sófia': 'Sófia (cidade)',
  'SGP|Região Central de Singapura': 'Singapura', 'VCT|Charlottr': 'Charlotte', 'BLR|Voblast de Homiel': 'Gomel',
  'BLR|Voblast de Viciebsk': 'Vitebsk', 'BLR|Voblast de Mahilou': 'Mogilev', 'BLR|Voblast de Minsk': 'Minsk', 'BLR|Hrodna': 'Grodno',
  'MAR|Oued ed-Dahab provins': 'Oued ed-Dahab', 'CHN|do Tibete': 'Tibete', 'KOS|Pluzine': 'Prizren',
  // Nomes ja limpos que ainda precisam de ajuste.
  'DNK|Capital': 'Copenhague', 'SRB|Norte de Backa': 'Bačka do Norte', 'SRB|Backa Oeste': 'Bačka Ocidental',
  'SRB|Norte de Banat': 'Banat do Norte', 'SRB|Central de Banat': 'Banat Central', 'SRB|Sul de Backa': 'Bačka do Sul',
  'SRB|Sul de Banat': 'Banat do Sul', 'SRB|Sumadija': 'Šumadija', 'SRB|Nisava': 'Nišava', 'SRB|Zajecar': 'Zaječar', 'SRB|Pcinja': 'Pčinja',
  'BIH|Tuzla Canton': 'Tuzla', 'BIH|Bósnia': 'Bósnia Central', 'BIH|Sarajevo-romanija': 'Sarajevo-Romanija',
  'BIH|Oeste Herzegovina': 'Herzegovina Ocidental', 'BIH|Una Sana': 'Una-Sana', 'MNE|Niksic': 'Nikšić', 'ARM|Lorri': 'Lori',
  'ARM|Ararate': 'Ararat', 'ISL|Vestfirðir': 'Fiordes Ocidentais', 'ISL|Norðurland Vestra': 'Islândia do Noroeste',
  'ISL|Norðurland Eystra': 'Islândia do Nordeste', 'ISL|Suðurland': 'Islândia do Sul', 'ISL|Austurland': 'Islândia Oriental',
  'ISL|Vesturland': 'Islândia Ocidental', 'GRL|Parque Nacional do Nordeste da Gronelândia': 'Nordeste da Groenlândia',
  'PAK|Território Federal das Áreas Tribais': 'Áreas Tribais', 'VNM|Sudeste': 'Sudeste do Vietnã',
};

const STATE_PREFIX =
  /^(?:(?:de|do|da|dos|das) |Voivodia de |Voblast de |Governorado de |Governadoria |Prefeitura de |Preeitura de |Krai de |Krai do |Município de |Município |Cidade Municipal de |Cidade Municipal do )(?=\p{Lu})/u;

export function stateName(props) {
  const code = props.adm0_a3;
  const raw = String(props.name_pt || props.name_en || props.name || '').trim();
  const fixed = STATE_FIX[`${code}|${raw}`];
  if (fixed) return fixed;
  let s = raw;
  for (let k = 0; k < 3 && STATE_PREFIX.test(s); k++) s = s.replace(STATE_PREFIX, '');
  if (code === 'RUS') s = s.replace(/^República (?:de |da |do )?(?=\p{Lu})/u, '');
  s = s.replace(/ provins$/, '').trim();
  if (!s) s = String(props.name || '?');
  const clean = cityName(s, props.name, code);
  return STATE_FIX[`${code}|${clean}`] ?? clean;
}
