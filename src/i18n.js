// Interface copy in eight languages. Fighter names, round calls and finisher
// names stay in English on purpose: ROUND 1, FIGHT!, K.O. and TOASTED! are
// the genre's own words. On a portal the language comes from the platform,
// elsewhere from the browser.
const STRINGS = {
  en: {
    tagline: 'Rooftop. Rain. One angry goose.',
    fight: 'FIGHT', vsCpu: 'vs CPU', twoPlayers: '2 PLAYERS', sameScreen: 'same screen',
    easy: 'EASY', normal: 'NORMAL', hard: 'HARD',
    k_move: 'move', k_punch: 'punch', k_kick: 'kick', k_special: 'special', k_block: 'block',
    studio: 'a {studio} game',
    choose: 'CHOOSE YOUR FIGHTER', p1choose: 'PLAYER 1, CHOOSE', p2choose: 'PLAYER 2, CHOOSE',
    selectHint: '← → to choose · {enter} to fight',
    rematch: 'REMATCH', share: 'SHARE', change: 'Change fighter', menu: 'Main menu',
    paused: 'PAUSED', resume: 'RESUME', quit: 'QUIT',
    youWin: 'YOU WIN', youLose: 'YOU LOSE', wins: '{name} WINS', takesIt: '{name} takes it',
    vsCpuLevel: 'vs CPU · {level}', localVersus: 'Local versus', copied: 'Link copied',
    special: 'SPECIAL', pressSpecial: 'press SPECIAL',
    blurb_volt: 'Fast hands, faster bolts.', blurb_brick: 'Hits like a falling fridge.',
    blurb_shade: 'Now you see him.', blurb_goose: 'Escaped from a park. Angry.',
    special_volt: 'Lightning bolt', special_brick: 'Ground slam', special_shade: 'Shadow step', special_goose: 'HONK',
    shareWin: 'I beat the CPU on {level} as {name} in RAIN FIGHT ⚡ Your turn:',
    shareOther: 'RAIN FIGHT: {name} wins. Think you can do better? ⚡',
  },
  ru: {
    tagline: 'Крыша. Дождь. Один злой гусь.',
    fight: 'В БОЙ', vsCpu: 'против компа', twoPlayers: '2 ИГРОКА', sameScreen: 'на одном экране',
    easy: 'ЛЕГКО', normal: 'НОРМ', hard: 'ЖЁСТКО',
    k_move: 'ходьба', k_punch: 'удар', k_kick: 'пинок', k_special: 'приём', k_block: 'блок',
    studio: 'игра от {studio}',
    choose: 'ВЫБЕРИ БОЙЦА', p1choose: 'ИГРОК 1, ВЫБИРАЙ', p2choose: 'ИГРОК 2, ВЫБИРАЙ',
    selectHint: '← → выбрать · {enter} в бой',
    rematch: 'РЕВАНШ', share: 'ПОДЕЛИТЬСЯ', change: 'Сменить бойца', menu: 'Главное меню',
    paused: 'ПАУЗА', resume: 'ДАЛЬШЕ', quit: 'ВЫЙТИ',
    youWin: 'ПОБЕДА', youLose: 'ПОРАЖЕНИЕ', wins: '{name} ПОБЕЖДАЕТ', takesIt: '{name} забирает бой',
    vsCpuLevel: 'против компа · {level}', localVersus: 'Один экран', copied: 'Ссылка скопирована',
    special: 'ПРИЁМ', pressSpecial: 'жми ПРИЁМ',
    blurb_volt: 'Быстрые руки, ещё быстрее молнии.', blurb_brick: 'Бьёт как падающий холодильник.',
    blurb_shade: 'Вот он есть, а вот его нет.', blurb_goose: 'Сбежал из парка. Зол.',
    special_volt: 'Молния', special_brick: 'Удар о землю', special_shade: 'Шаг из тени', special_goose: 'ГА-ГА',
    shareWin: 'Уложил компа на {level} за {name} в RAIN FIGHT ⚡ Твоя очередь:',
    shareOther: 'RAIN FIGHT: {name} победил. Сможешь лучше? ⚡',
  },
  uk: {
    tagline: 'Дах. Дощ. Один злий гусак.',
    fight: 'У БІЙ', vsCpu: 'проти компа', twoPlayers: '2 ГРАВЦІ', sameScreen: 'на одному екрані',
    easy: 'ЛЕГКО', normal: 'НОРМ', hard: 'ЖОРСТКО',
    k_move: 'рух', k_punch: 'удар', k_kick: 'копняк', k_special: 'прийом', k_block: 'блок',
    studio: 'гра від {studio}',
    choose: 'ОБЕРИ БІЙЦЯ', p1choose: 'ГРАВЕЦЬ 1, ОБИРАЙ', p2choose: 'ГРАВЕЦЬ 2, ОБИРАЙ',
    selectHint: '← → обрати · {enter} у бій',
    rematch: 'РЕВАНШ', share: 'ПОДІЛИТИСЯ', change: 'Змінити бійця', menu: 'Головне меню',
    paused: 'ПАУЗА', resume: 'ДАЛІ', quit: 'ВИЙТИ',
    youWin: 'ПЕРЕМОГА', youLose: 'ПОРАЗКА', wins: '{name} ПЕРЕМАГАЄ', takesIt: '{name} забирає бій',
    vsCpuLevel: 'проти компа · {level}', localVersus: 'Один екран', copied: 'Посилання скопійовано',
    special: 'ПРИЙОМ', pressSpecial: 'тисни ПРИЙОМ',
    blurb_volt: 'Швидкі руки, ще швидші блискавки.', blurb_brick: 'Б’є як холодильник, що падає.',
    blurb_shade: 'Ось він є, а ось його немає.', blurb_goose: 'Втік з парку. Злий.',
    special_volt: 'Блискавка', special_brick: 'Удар об землю', special_shade: 'Крок з тіні', special_goose: 'ГА-ГА',
    shareWin: 'Поклав компа на {level} за {name} у RAIN FIGHT ⚡ Твоя черга:',
    shareOther: 'RAIN FIGHT: {name} переміг. Зможеш краще? ⚡',
  },
  es: {
    tagline: 'Azotea. Lluvia. Un ganso furioso.',
    fight: 'A PELEAR', vsCpu: 'contra la CPU', twoPlayers: '2 JUGADORES', sameScreen: 'misma pantalla',
    easy: 'FÁCIL', normal: 'NORMAL', hard: 'DIFÍCIL',
    k_move: 'mover', k_punch: 'puño', k_kick: 'patada', k_special: 'especial', k_block: 'bloquear',
    studio: 'un juego de {studio}',
    choose: 'ELIGE TU LUCHADOR', p1choose: 'JUGADOR 1, ELIGE', p2choose: 'JUGADOR 2, ELIGE',
    selectHint: '← → elegir · {enter} pelear',
    rematch: 'REVANCHA', share: 'COMPARTIR', change: 'Cambiar luchador', menu: 'Menú principal',
    paused: 'PAUSA', resume: 'SEGUIR', quit: 'SALIR',
    youWin: 'GANASTE', youLose: 'PERDISTE', wins: 'GANA {name}', takesIt: '{name} se lo lleva',
    vsCpuLevel: 'contra la CPU · {level}', localVersus: 'Versus local', copied: 'Enlace copiado',
    special: 'ESPECIAL', pressSpecial: 'pulsa ESPECIAL',
    blurb_volt: 'Manos rápidas, rayos más rápidos.', blurb_brick: 'Pega como una nevera cayendo.',
    blurb_shade: 'Ahora lo ves, ahora no.', blurb_goose: 'Se escapó de un parque. Furioso.',
    special_volt: 'Rayo', special_brick: 'Golpe al suelo', special_shade: 'Paso de sombra', special_goose: '¡HONK!',
    shareWin: 'Le gané a la CPU en {level} con {name} en RAIN FIGHT ⚡ Te toca:',
    shareOther: 'RAIN FIGHT: gana {name}. ¿Puedes hacerlo mejor? ⚡',
  },
  pt: {
    tagline: 'Telhado. Chuva. Um ganso furioso.',
    fight: 'LUTAR', vsCpu: 'contra a CPU', twoPlayers: '2 JOGADORES', sameScreen: 'mesma tela',
    easy: 'FÁCIL', normal: 'NORMAL', hard: 'DIFÍCIL',
    k_move: 'mover', k_punch: 'soco', k_kick: 'chute', k_special: 'especial', k_block: 'defender',
    studio: 'um jogo da {studio}',
    choose: 'ESCOLHA SEU LUTADOR', p1choose: 'JOGADOR 1, ESCOLHA', p2choose: 'JOGADOR 2, ESCOLHA',
    selectHint: '← → escolher · {enter} lutar',
    rematch: 'REVANCHE', share: 'COMPARTILHAR', change: 'Trocar lutador', menu: 'Menu principal',
    paused: 'PAUSADO', resume: 'CONTINUAR', quit: 'SAIR',
    youWin: 'VOCÊ VENCEU', youLose: 'VOCÊ PERDEU', wins: '{name} VENCE', takesIt: '{name} leva essa',
    vsCpuLevel: 'contra a CPU · {level}', localVersus: 'Versus local', copied: 'Link copiado',
    special: 'ESPECIAL', pressSpecial: 'aperte ESPECIAL',
    blurb_volt: 'Mãos rápidas, raios mais rápidos.', blurb_brick: 'Bate como uma geladeira caindo.',
    blurb_shade: 'Agora você vê, agora não.', blurb_goose: 'Fugiu de um parque. Furioso.',
    special_volt: 'Raio', special_brick: 'Pancada no chão', special_shade: 'Passo sombrio', special_goose: 'HONK!',
    shareWin: 'Venci a CPU no {level} com {name} no RAIN FIGHT ⚡ Sua vez:',
    shareOther: 'RAIN FIGHT: {name} venceu. Consegue fazer melhor? ⚡',
  },
  de: {
    tagline: 'Dach. Regen. Eine wütende Gans.',
    fight: 'KÄMPFEN', vsCpu: 'gegen die CPU', twoPlayers: '2 SPIELER', sameScreen: 'ein Bildschirm',
    easy: 'LEICHT', normal: 'NORMAL', hard: 'SCHWER',
    k_move: 'laufen', k_punch: 'Schlag', k_kick: 'Tritt', k_special: 'Spezial', k_block: 'Block',
    studio: 'ein Spiel von {studio}',
    choose: 'WÄHLE DEINEN KÄMPFER', p1choose: 'SPIELER 1, WÄHLE', p2choose: 'SPIELER 2, WÄHLE',
    selectHint: '← → wählen · {enter} kämpfen',
    rematch: 'REVANCHE', share: 'TEILEN', change: 'Kämpfer wechseln', menu: 'Hauptmenü',
    paused: 'PAUSE', resume: 'WEITER', quit: 'BEENDEN',
    youWin: 'GEWONNEN', youLose: 'VERLOREN', wins: '{name} GEWINNT', takesIt: '{name} holt den Sieg',
    vsCpuLevel: 'gegen die CPU · {level}', localVersus: 'Lokales Duell', copied: 'Link kopiert',
    special: 'SPEZIAL', pressSpecial: 'drück SPEZIAL',
    blurb_volt: 'Schnelle Fäuste, schnellere Blitze.', blurb_brick: 'Schlägt wie ein fallender Kühlschrank.',
    blurb_shade: 'Jetzt siehst du ihn, jetzt nicht.', blurb_goose: 'Aus dem Park geflohen. Wütend.',
    special_volt: 'Blitz', special_brick: 'Bodenschlag', special_shade: 'Schattenschritt', special_goose: 'HONK!',
    shareWin: 'Ich habe die CPU auf {level} mit {name} in RAIN FIGHT besiegt ⚡ Du bist dran:',
    shareOther: 'RAIN FIGHT: {name} gewinnt. Kannst du es besser? ⚡',
  },
  fr: {
    tagline: 'Un toit. La pluie. Une oie furieuse.',
    fight: 'COMBATTRE', vsCpu: "contre l'ordi", twoPlayers: '2 JOUEURS', sameScreen: 'même écran',
    easy: 'FACILE', normal: 'NORMAL', hard: 'DIFFICILE',
    k_move: 'bouger', k_punch: 'poing', k_kick: 'pied', k_special: 'spécial', k_block: 'garde',
    studio: 'un jeu de {studio}',
    choose: 'CHOISIS TON COMBATTANT', p1choose: 'JOUEUR 1, CHOISIS', p2choose: 'JOUEUR 2, CHOISIS',
    selectHint: '← → choisir · {enter} combattre',
    rematch: 'REVANCHE', share: 'PARTAGER', change: 'Changer de combattant', menu: 'Menu principal',
    paused: 'PAUSE', resume: 'REPRENDRE', quit: 'QUITTER',
    youWin: 'VICTOIRE', youLose: 'DÉFAITE', wins: '{name} GAGNE', takesIt: "{name} l'emporte",
    vsCpuLevel: "contre l'ordi · {level}", localVersus: 'Duel local', copied: 'Lien copié',
    special: 'SPÉCIAL', pressSpecial: 'appuie sur SPÉCIAL',
    blurb_volt: 'Mains rapides, éclairs plus rapides.', blurb_brick: 'Frappe comme un frigo qui tombe.',
    blurb_shade: 'Tu le vois, tu ne le vois plus.', blurb_goose: "Évadée d'un parc. Furieuse.",
    special_volt: 'Éclair', special_brick: 'Frappe au sol', special_shade: "Pas de l'ombre", special_goose: 'HONK !',
    shareWin: "J'ai battu l'ordi en {level} avec {name} dans RAIN FIGHT ⚡ À toi :",
    shareOther: 'RAIN FIGHT : {name} gagne. Tu fais mieux ? ⚡',
  },
  tr: {
    tagline: 'Çatı. Yağmur. Bir öfkeli kaz.',
    fight: 'DÖVÜŞ', vsCpu: 'bilgisayara karşı', twoPlayers: '2 OYUNCU', sameScreen: 'aynı ekran',
    easy: 'KOLAY', normal: 'NORMAL', hard: 'ZOR',
    k_move: 'hareket', k_punch: 'yumruk', k_kick: 'tekme', k_special: 'özel', k_block: 'blok',
    studio: 'bir {studio} oyunu',
    choose: 'DÖVÜŞÇÜNÜ SEÇ', p1choose: '1. OYUNCU, SEÇ', p2choose: '2. OYUNCU, SEÇ',
    selectHint: '← → seç · {enter} dövüş',
    rematch: 'RÖVANŞ', share: 'PAYLAŞ', change: 'Dövüşçü değiştir', menu: 'Ana menü',
    paused: 'DURAKLATILDI', resume: 'DEVAM', quit: 'ÇIK',
    youWin: 'KAZANDIN', youLose: 'KAYBETTİN', wins: '{name} KAZANDI', takesIt: '{name} kazandı',
    vsCpuLevel: 'bilgisayara karşı · {level}', localVersus: 'Yerel düello', copied: 'Bağlantı kopyalandı',
    special: 'ÖZEL', pressSpecial: "ÖZEL'e bas",
    blurb_volt: 'Hızlı eller, daha hızlı yıldırımlar.', blurb_brick: 'Düşen bir buzdolabı gibi vurur.',
    blurb_shade: 'Şimdi görüyorsun, şimdi yok.', blurb_goose: 'Parktan kaçtı. Öfkeli.',
    special_volt: 'Yıldırım', special_brick: 'Yere vuruş', special_shade: 'Gölge adımı', special_goose: 'HONK!',
    shareWin: "RAIN FIGHT'ta {name} ile {level} bilgisayarı yendim ⚡ Sıra sende:",
    shareOther: 'RAIN FIGHT: {name} kazandı. Daha iyisini yapabilir misin? ⚡',
  },
};

export const LANGUAGES = Object.keys(STRINGS);
let lang = 'en';

// Accepts 'ru', 'pt-BR', 'uk_UA'…; anything unknown falls back to English.
export function setLanguage(code) {
  const c = String(code || '').slice(0, 2).toLowerCase();
  lang = STRINGS[c] ? c : 'en';
  if (typeof document !== 'undefined') document.documentElement.lang = lang;
  return lang;
}

export const language = () => lang;

export function t(key, vars = {}) {
  const s = STRINGS[lang][key] ?? STRINGS.en[key] ?? key;
  return s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''));
}

// Every language must carry every English key: a missing one would silently
// show English. Used by the tests.
export function missingKeys() {
  const out = {};
  for (const l of LANGUAGES) {
    const miss = Object.keys(STRINGS.en).filter((k) => !(k in STRINGS[l]));
    if (miss.length) out[l] = miss;
  }
  return out;
}
