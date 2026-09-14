// Culturas, grupos culturais e listas de nomes para governantes, generais e dinastias.
import type { RGB } from './terrain';

export type CultureId =
  | 'lusitana' | 'hispanica' | 'francesa' | 'italica' | 'romena'
  | 'germanica' | 'neerlandesa' | 'anglo' | 'nordica'
  | 'finica' | 'hungara' | 'baltica'
  | 'eslava_oriental' | 'eslava_ocidental' | 'eslava_sul'
  | 'grega' | 'albanesa' | 'turcica' | 'caucasica' | 'persa' | 'arabe' | 'hebraica'
  | 'indica' | 'mongol' | 'chinesa' | 'japonesa' | 'coreana' | 'indochinesa' | 'malaia' | 'oceanica'
  | 'africana_ocidental' | 'bantu' | 'cushitica' | 'nilotica' | 'malgaxe' | 'inuit';

export interface CultureInfo {
  id: CultureId;
  name: string;
  group: string;
  color: RGB;
  names: string[];
  houses: string[];
}

const c = (id: CultureId, name: string, group: string, color: RGB, names: string, houses: string): CultureInfo => ({
  id, name, group, color, names: names.split(','), houses: houses.split(','),
});

export const CULTURES: Record<CultureId, CultureInfo> = {
  lusitana: c('lusitana', 'Lusitana', 'Latina', [70, 140, 90], 'Afonso,João,Pedro,Manuel,Sebastião,Duarte,Henrique,Fernando,Luís,José,Miguel,Carlos,Diniz,Teodósio', 'Avis,Bragança,Borgonha,Sousa,Albuquerque,Almeida,Coutinho,Vasconcelos'),
  hispanica: c('hispanica', 'Hispânica', 'Latina', [200, 150, 50], 'Fernando,Carlos,Felipe,Juan,Alfonso,Diego,Rodrigo,Pedro,Enrique,Sancho,Francisco,Simón,Bernardo,José', 'Trastámara,Borbón,Mendoza,Guzmán,Toledo,Castilla,Iturbide,Rosas'),
  francesa: c('francesa', 'Francesa', 'Latina', [80, 100, 190], 'Louis,Henri,Charles,François,Philippe,Napoléon,Robert,Hugues,Pierre,Jacques,Gaston,Raoul,Étienne,Jean', 'Valois,Bourbon,Capet,Orléans,Bonaparte,Anjou,Guise,Montmorency'),
  italica: c('italica', 'Itálica', 'Latina', [60, 160, 120], 'Lorenzo,Cosimo,Vittorio,Umberto,Francesco,Giovanni,Ludovico,Federico,Alessandro,Cesare,Giuseppe,Carlo,Amedeo,Filippo', 'Medici,Sforza,Savoia,Este,Gonzaga,Visconti,Farnese,Borgia'),
  romena: c('romena', 'Romena', 'Latina', [170, 140, 60], 'Mircea,Vlad,Ștefan,Mihai,Alexandru,Constantin,Radu,Petru,Carol,Ferdinand,Bogdan,Ion', 'Basarab,Mușat,Drăculești,Cantacuzino,Brâncoveanu,Cuza,Movilă,Ghica'),
  germanica: c('germanica', 'Germânica', 'Germânica', [110, 110, 120], 'Friedrich,Otto,Heinrich,Wilhelm,Maximilian,Rudolf,Leopold,Karl,Ludwig,Albrecht,Ernst,Konrad,Sigismund,Johann', 'Habsburg,Hohenzollern,Wittelsbach,Wettin,Welf,Hessen,Württemberg,Luxemburg'),
  neerlandesa: c('neerlandesa', 'Neerlandesa', 'Germânica', [230, 130, 40], 'Willem,Maurits,Frederik,Hendrik,Johan,Lodewijk,Pieter,Jan,Cornelis,Adriaan,Floris,Dirk', 'Oranje-Nassau,Nassau,Egmont,Brederode,Van Arkel,Oldenbarnevelt,Batenburg,Van Horne'),
  anglo: c('anglo', 'Anglo-saxã', 'Germânica', [190, 60, 60], 'Henry,Edward,William,Richard,George,James,Charles,John,Arthur,Thomas,Robert,Andrew,Theodore,Abraham', 'Tudor,Stuart,Windsor,Plantagenet,Lancaster,York,Hanover,Washington'),
  nordica: c('nordica', 'Nórdica', 'Germânica', [90, 150, 200], 'Gustav,Olaf,Harald,Erik,Magnus,Christian,Frederik,Karl,Haakon,Sigurd,Valdemar,Sven', 'Vasa,Oldenburg,Bernadotte,Holstein,Sture,Folkung,Glücksburg,Estridsen'),
  finica: c('finica', 'Fínica', 'Urálica', [120, 180, 190], 'Väinö,Kaarle,Juho,Urho,Mikael,Johan,Konstantin,Toomas,Lennart,Aarne,Paavo,Risto', 'Kekkonen,Mannerheim,Ståhlberg,Svinhufvud,Päts,Laidoner,Ryti,Paasikivi'),
  hungara: c('hungara', 'Magiar', 'Urálica', [150, 80, 60], 'István,Mátyás,Béla,László,András,Géza,Lajos,Ferenc,János,Imre,Zoltán,Károly', 'Árpád,Hunyadi,Zápolya,Esterházy,Batthyány,Rákóczi,Horthy,Andrássy'),
  baltica: c('baltica', 'Báltica', 'Báltica', [160, 120, 170], 'Mindaugas,Gediminas,Algirdas,Vytautas,Kęstutis,Jogaila,Kārlis,Jānis,Antanas,Kazimieras,Andris,Valdis', 'Gediminaičiai,Radvila,Sapieha,Chodkiewicz,Ulmanis,Smetona,Kettler,Biron'),
  eslava_oriental: c('eslava_oriental', 'Eslava Oriental', 'Eslava', [60, 120, 70], 'Ivan,Vasili,Piotr,Aleksandr,Nikolai,Dmitri,Boris,Mikhail,Fiódor,Aleksei,Iaroslav,Vladimir,Oleg,Sviatoslav', 'Rurikovich,Romanov,Godunov,Shuisky,Golitsyn,Olgovichi,Ostrogski,Vishnevetsky'),
  eslava_ocidental: c('eslava_ocidental', 'Eslava Ocidental', 'Eslava', [200, 90, 110], 'Kazimierz,Władysław,Zygmunt,Bolesław,Václav,Jan,Stanisław,Mieszko,Przemysł,Otakar,Jiří,Tomáš', 'Jagiellon,Piast,Přemyslid,Poniatowski,Sobieski,Waza,Poděbrady,Lubomirski'),
  eslava_sul: c('eslava_sul', 'Eslava do Sul', 'Eslava', [100, 90, 170], 'Stefan,Dušan,Lazar,Milan,Petar,Aleksandar,Tomislav,Zvonimir,Simeon,Boris,Tvrtko,Nikola', 'Nemanjić,Karađorđević,Obrenović,Petrović,Kotromanić,Asen,Šubić,Frankopan'),
  grega: c('grega', 'Grega', 'Helênica', [80, 150, 220], 'Konstantinos,Alexios,Ioannis,Manuel,Vasileios,Andronikos,Theodoros,Michail,Georgios,Leon,Nikephoros,Romanos', 'Palaiologos,Komnenos,Doukas,Angelos,Laskaris,Kantakouzenos,Glücksburg,Makedon'),
  albanesa: c('albanesa', 'Albanesa', 'Helênica', [180, 40, 40], 'Gjergj,Lekë,Gjon,Skënder,Ahmet,Zog,Ismail,Pjetër,Mehmet,Enver,Fan,Isa', 'Kastrioti,Dukagjini,Arianiti,Topia,Balsha,Muzaka,Zogolli,Toptani'),
  turcica: c('turcica', 'Túrquica', 'Turco-mongol', [180, 50, 50], 'Mehmed,Selim,Süleyman,Murad,Bayezid,Orhan,Osman,Ahmed,Mustafa,Abdülhamid,Timur,Nadir,Ilham,Tughril', 'Osmanoğlu,Seljuk,Timurid,Afshar,Akkoyunlu,Karakoyunlu,Shaybanid,Karakhanid'),
  caucasica: c('caucasica', 'Caucasiana', 'Caucasiana', [140, 60, 120], 'Davit,Giorgi,Bagrat,Vakhtang,Erekle,Tigran,Levon,Ashot,Artashes,Smbat,Gagik,Hovhannes', 'Bagrationi,Bagratuni,Artaxiad,Arsacid,Rubenid,Mamikonian,Orbeli,Dadiani'),
  persa: c('persa', 'Persa', 'Iraniana', [60, 170, 160], 'Ismail,Abbas,Tahmasp,Nader,Karim,Reza,Mohammad,Kourosh,Dariush,Shapur,Khosrow,Ardashir', 'Safavid,Afsharid,Zand,Qajar,Pahlavi,Sasanian,Achaemenid,Durrani'),
  arabe: c('arabe', 'Árabe', 'Semítica', [60, 140, 60], 'Abdullah,Faisal,Hussein,Umar,Ali,Hassan,Salah ad-Din,Saud,Khalid,Harun,Mansur,Walid,Idris,Fuad', 'Hashemita,Al Saud,Abássida,Omíada,Fatímida,Aiúbida,Alauíta,Al Sabah'),
  hebraica: c('hebraica', 'Hebraica', 'Semítica', [90, 120, 210], 'David,Shlomo,Yosef,Menachem,Yitzhak,Ariel,Binyamin,Shimon,Moshe,Eliezer,Yehuda,Avraham', 'Davídica,Hasmoneu,Herodiana,Ben-Gurion,Begin,Rabin,Meir,Weizmann'),
  indica: c('indica', 'Índica', 'Índica', [230, 150, 50], 'Akbar,Ashoka,Chandragupta,Shivaji,Ranjit,Babur,Jahangir,Shah Jahan,Aurangzeb,Rajendra,Vikram,Prithviraj,Bahadur,Jawaharlal', 'Mughal,Maurya,Gupta,Chola,Maratha,Rajput,Wodeyar,Sikh'),
  mongol: c('mongol', 'Mongol', 'Turco-mongol', [150, 130, 70], 'Temüjin,Ögedei,Kublai,Möngke,Batu,Güyük,Altan,Dayan,Ligdan,Galdan,Esen,Tolui', 'Borjigin,Oirat,Dzungar,Khalkha,Chagatai,Jochid,Yuan,Chahar'),
  chinesa: c('chinesa', 'Chinesa', 'Sínica', [200, 60, 50], 'Hongwu,Yongle,Kangxi,Qianlong,Wanli,Jiajing,Zhengde,Taizong,Guangxu,Yuanzhang,Zhongshan,Shimin', 'Ming,Qing,Tang,Song,Han,Zhu,Aisin-Gioro,Li'),
  japonesa: c('japonesa', 'Japonesa', 'Sínica', [220, 80, 90], 'Ieyasu,Nobunaga,Hideyoshi,Yoshimitsu,Takauji,Mutsuhito,Hirohito,Tokimune,Yoritomo,Masamune,Shingen,Kenshin', 'Tokugawa,Ashikaga,Oda,Toyotomi,Minamoto,Taira,Hojo,Date'),
  coreana: c('coreana', 'Coreana', 'Sínica', [70, 110, 170], 'Sejong,Taejo,Yeongjo,Jeongjo,Gojong,Sunjong,Seonjo,Injo,Hyojong,Munjong,Gwanghae,Sukjong', 'Yi,Wang,Kim,Park,Choe,Jeonju,Gaeseong,Andong'),
  indochinesa: c('indochinesa', 'Indochinesa', 'Sudeste Asiático', [190, 160, 60], 'Naresuan,Ramkhamhaeng,Chulalongkorn,Mongkut,Bayinnaung,Anawrahta,Lê Lợi,Gia Long,Minh Mạng,Jayavarman,Suryavarman,Fa Ngum', 'Chakri,Ayutthaya,Taungoo,Konbaung,Lê,Nguyễn,Varman,Lan Xang'),
  malaia: c('malaia', 'Malaia', 'Sudeste Asiático', [170, 70, 40], 'Parameswara,Mansur,Hayam Wuruk,Agung,Wijaya,Iskandar,Hamengkubuwono,Diponegoro,Lapulapu,Sulayman,Hassanal,Mahmud', 'Majapahit,Melaka,Mataram,Bolkiah,Johor,Sulu,Demak,Brunei'),
  oceanica: c('oceanica', 'Oceânica', 'Oceânica', [40, 170, 190], 'Kamehameha,Pōmare,Tupou,Cakobau,Te Rauparaha,Hongi,Malietoa,Tamasese,Seru,Kaumualiʻi,Tāufaʻāhau,Ratu', 'Kamehameha,Tupou,Pōmare,Malietoa,Bau,Kalākaua,Tuʻi Tonga,Mataʻafa'),
  africana_ocidental: c('africana_ocidental', 'Oeste-Africana', 'Africana Ocidental', [210, 120, 40], 'Musa,Sundiata,Askia,Sonni Ali,Osei Tutu,Opoku Ware,Samori,Agaja,Gezo,Usman,Idris,Bello', 'Keita,Askia,Oyoko,Sokoto,Kanem,Oyo,Dahomey,Jolof'),
  bantu: c('bantu', 'Banto', 'Banta', [150, 90, 40], 'Shaka,Mzilikazi,Moshoeshoe,Mutapa,Nzinga,Mvemba,Mwata,Lobengula,Cetshwayo,Mutesa,Kabarega,Lewanika', 'Zulu,Ndebele,Kongo,Mutapa,Buganda,Lozi,Luba,Lunda'),
  cushitica: c('cushitica', 'Cuxítica', 'Chifre da África', [120, 150, 40], 'Menelik,Tewodros,Yohannes,Zara Yaqob,Lebna Dengel,Fasilides,Iyasu,Haile,Ahmad,Mohammed,Susenyos,Dawit', 'Salomônica,Zagwe,Adal,Ajuran,Gondar,Shewa,Majerteen,Geledi'),
  nilotica: c('nilotica', 'Nilótica', 'Chifre da África', [100, 70, 50], 'Nyikang,Deng,Garang,Kiir,Mabior,Okot,Lual,Tong,Akol,Machar,Ajak,Majok', 'Shilluk,Dinka,Nuer,Anyuak,Bari,Azande,Luo,Acholi'),
  malgaxe: c('malgaxe', 'Malgaxe', 'Malgaxe', [200, 100, 140], 'Andrianampoinimerina,Radama,Andrianjaka,Ralambo,Tsiranana,Ratsiraka,Andriamanelo,Andrianjafy,Rainilaiarivony,Lamboina,Ramanetaka,Toera', 'Merina,Sakalava,Betsimisaraka,Antemoro,Bara,Zafy,Maroserana,Volamena'),
  inuit: c('inuit', 'Inuíte', 'Ártica', [170, 200, 220], 'Aputsiaq,Inuk,Kunuk,Nuka,Pita,Siku,Tulugaq,Ujarak,Malik,Hans,Kaalund,Aqqaluk', 'Egede,Rasmussen,Motzfeldt,Enoksen,Kleist,Hammond,Nissen,Lynge'),
};

export const CULTURE_IDS = Object.keys(CULTURES) as CultureId[];
