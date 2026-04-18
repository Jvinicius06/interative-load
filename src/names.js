const GREEK_NAMES = [
  'Aelythos',  'Kryndaros', 'Thalyxion', 'Myrathos',  'Zephandros',
  'Eryxion',   'Calydros',  'Nytherion', 'Xylaros',   'Oryphos',
  'Delythar',  'Pyrionax',  'Kaerythos', 'Lysarion',  'Threxion',
  'Andrythos', 'Melkryon',  'Zorythas',  'Aethonar',  'Phorynax',
  'Kylandros', 'Thamerys',  'Xandryth',  'Myzethos',  'Olyndros',
  'Karyphos',  'Elarthys',  'Drathion',  'Nyxandor',  'Typheryn',
  'Zephoryx',  'Krythanos', 'Aegirion',  'Phalorys',  'Thalyndor',
  'Xeryphos',  'Mylarion',  'Orkynos',   'Zetharion', 'Calyphor',
  'Aethryon',  'Kytherion', 'Thalerys',  'Damarion',  'Eryndor',
  'Xandryon',  'Melanthos', 'Pyrelios',  'Calystron', 'Zephyros',
  'Andrykos',  'Lykarios',  'Myrionyx',  'Helionis',  'Drakion',
  'Orphelios', 'Nyxaris',   'Theryon',   'Krylos',    'Erythion',
  'Zorathys',  'Aegorys',   'Phaleryn',  'Tyrrion',   'Kaelithos',
  'Oryndax',   'Lysandros', 'Mykareon',  'Xyphoros',  'Thamyris',
  'Elarion',   'Kryphos',   'Varythos',  'Zethyron',  'Andelios',
  'Pyranthos', 'Kalyrex',   'Thorynax',  'Mytherion', 'Xandrelos',
];

function randomNick() {
  return GREEK_NAMES[Math.floor(Math.random() * GREEK_NAMES.length)];
}

module.exports = { GREEK_NAMES, randomNick };
