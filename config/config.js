module.exports = {
  serverName: process.env.SERVER_NAME || 'ElysiusRP',
  maxPlayers: 250,

  radioStations: [
    { id: 'lofi',       name: 'Lo-Fi Beats',       genre: 'Lo-Fi / Chill',        url: 'https://stream.zeno.fm/f3wvbbqmdg8uv' },
    { id: 'synthwave',  name: 'Synthwave Radio',    genre: 'Synthwave / Retrowave', url: 'https://stream.zeno.fm/yr5rbb0rxcxuv' },
    { id: 'hiphop',     name: 'Hip Hop Hits',       genre: 'Hip Hop',               url: 'https://stream.zeno.fm/0r0xa792kwzuv' },
    { id: 'electronic', name: 'Electronic Mix',     genre: 'Electronic / EDM',      url: 'https://stream.zeno.fm/uvxrp5uh5bhvv' },
  ],

  tvSlides: [
    {
      id: 1,
      title: 'BEM-VINDO',
      subtitle: 'Leia as regras antes de jogar',
      body: 'Nosso servidor tem regras claras para garantir a melhor experiência de todos os jogadores.',
      tag: 'IMPORTANTE',
      accent: '#00e8ff',
    },
    {
      id: 2,
      title: 'REGRAS BÁSICAS',
      subtitle: 'Respeite todos os jogadores',
      body: 'Proibido uso de exploits, hacking ou qualquer mecânica que prejudique a experiência alheia.',
      tag: 'REGRAS',
      accent: '#ff0055',
    },
    {
      id: 3,
      title: 'DISCORD',
      subtitle: 'Junte-se à nossa comunidade',
      body: 'Acesse o nosso Discord para suporte, eventos exclusivos e as últimas novidades do servidor.',
      tag: 'COMUNIDADE',
      accent: '#7289da',
    },
    {
      id: 4,
      title: 'SUPORTE',
      subtitle: 'Encontrou algum problema?',
      body: 'Abra um ticket no Discord ou utilize o comando /report dentro do jogo para reportar problemas.',
      tag: 'SUPORTE',
      accent: '#ffb300',
    },
  ],

  chat: {
    maxLength: 120,
    rateLimit: { messages: 1, windowMs: 2000 },
  },
};
