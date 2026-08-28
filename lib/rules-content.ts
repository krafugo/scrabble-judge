import type { Language } from './word-judge';

export type RulesContent = {
  eyebrow: string;
  title: string;
  intro: string;
  edition: string;
  facts: Array<{ value: string; label: string }>;
  correctionTitle: string;
  corrections: string[];
  sections: Array<{
    number: string;
    title: string;
    summary: string;
    points: string[];
  }>;
  sourceTitle: string;
  sourceNote: string;
  sources: Array<{ label: string; url: string }>;
};

export const RULES_CONTENT: Record<Language, RulesContent> = {
  es: {
    eyebrow: 'GUÍA DE JUEGO VERIFICADA',
    title: 'Reglas de Scrabble',
    intro: 'Un resumen práctico de las reglas clásicas y competitivas, contrastado con la documentación oficial. Abre cada apartado para consultar los detalles.',
    edition: 'Español · Modalidad clásica FILE 2024',
    facts: [
      { value: '15×15', label: 'casillas en el tablero' },
      { value: '7', label: 'fichas en el atril' },
      { value: '+50', label: 'puntos por scrabble' },
    ],
    correctionTitle: 'Aclaraciones importantes',
    corrections: [
      'Una raíz válida no hace válidas automáticamente todas sus flexiones o derivados: cada forma debe figurar en el lexicón activo.',
      'Los nombres de animales, comidas, préstamos y epónimos no forman categorías válidas por sí mismas; se aceptan únicamente si están en el lexicón.',
      'Los días y meses no tienen una excepción general en inglés. Las voces que siempre llevan mayúscula quedan excluidas; un homógrafo común puede ser válido si el léxico lo recoge.',
    ],
    sections: [
      {
        number: '01',
        title: 'Objetivo y preparación',
        summary: 'Formar palabras enlazadas y terminar con la puntuación más alta.',
        points: [
          'La modalidad clásica FILE enfrenta a dos jugadores con un tablero de 15 × 15 y una bolsa de 100 fichas.',
          'Cada jugador extrae siete fichas. En partidas informales, el turno inicial puede sortearse; en torneo lo determina el sistema de pareos.',
          'Las palabras se leen de izquierda a derecha o de arriba hacia abajo. No se permiten jugadas diagonales.',
        ],
      },
      {
        number: '02',
        title: 'Primera jugada y conexión',
        summary: 'La primera palabra cruza el centro; las siguientes deben unirse al conjunto.',
        points: [
          'La primera jugada debe tener al menos dos fichas y ocupar la estrella central, que funciona como doble tanto de palabra.',
          'En cada turno, todas las fichas nuevas se colocan en una sola fila o columna y deben formar una palabra completa.',
          'Toda palabra transversal creada por contacto con otras fichas también debe ser válida. Se puntúan todas las palabras nuevas o modificadas.',
          'Las fichas ya confirmadas no pueden moverse en turnos posteriores.',
        ],
      },
      {
        number: '03',
        title: 'Turno, cambio y comodines',
        summary: 'Juega, cambia fichas o pasa; después repón el atril hasta siete.',
        points: [
          'Una jugada puede añadir letras a una palabra, cruzarla o colocarse en paralelo formando conexiones válidas.',
          'En lugar de jugar, puedes cambiar entre una y siete fichas y perder el turno. Si quedan menos de siete en la bolsa, FILE permite cambiar como máximo esa cantidad.',
          'También puedes pasar sin cambiar fichas y anotar cero puntos.',
          'El comodín vale cero, representa una ficha disponible en el juego y conserva esa identidad durante toda la partida.',
          'CH, LL y RR son fichas propias: no pueden sustituirse por C+H, L+L o R+R.',
        ],
      },
      {
        number: '04',
        title: 'Palabras válidas',
        summary: 'La autoridad es el lexicón acordado, no una regla gramatical general.',
        points: [
          'En competición FILE, la validez se determina con el Lexicón FISE 2 y su reglamento léxico vigente.',
          'Se juegan palabras de dos a quince fichas. Las tildes y la diéresis no aparecen en las fichas; la Ñ sí es distinta de la N.',
          'No se admiten nombres propios como tales, abreviaturas, siglas puras, elementos con guion o apóstrofo ni prefijos o sufijos aislados, salvo que el lexicón los registre como palabras independientes.',
          'No es necesario conocer el significado de una palabra para jugarla.',
        ],
      },
      {
        number: '05',
        title: 'Cómo se puntúa',
        summary: 'Suma las fichas, aplica premios de letra y después premios de palabra.',
        points: [
          'Las casillas de doble o triple letra afectan solo a la ficha recién colocada. Después se aplican los dobles o triples de palabra.',
          'Si una palabra cubre varios premios de palabra, los multiplicadores se acumulan: dos dobles producen ×4 y dos triples, ×9.',
          'Los premios se usan una sola vez, en el turno en que se cubren. Una ficha existente conserva después únicamente su valor nominal.',
          'Cada palabra formada en el turno se puntúa por separado; las fichas compartidas cuentan en cada una.',
          'Usar las siete fichas del atril en un turno añade 50 puntos, incluso si se emplean comodines.',
        ],
      },
      {
        number: '06',
        title: 'Cuestionar una palabra',
        summary: 'En FILE 2024, la consulta ocurre antes de aceptar y anotar la jugada.',
        points: [
          'El oponente dice «consulta» después del recuento de puntos y antes de anotar la puntuación; el reloj se detiene para verificar la jugada.',
          'Si alguna palabra cuestionada es inválida, se retiran las fichas de esa jugada, vuelven al atril y el jugador pierde el turno.',
          'Si la jugada es válida, permanece. El reglamento FILE no impone al cuestionante la pérdida automática del turno por una consulta fallida.',
          'Al anotar la puntuación del oponente se acepta la jugada y ya no puede impugnarse.',
          'Esta herramienta sirve para arbitrar después de jugar; consultar una palabra antes de colocarla no está permitido en competición FILE.',
        ],
      },
      {
        number: '07',
        title: 'Final de la partida',
        summary: 'La forma de cierre determina cómo se descuentan las fichas restantes.',
        points: [
          'El cierre normal ocurre cuando la bolsa está vacía y un jugador usa todas sus fichas. Ese jugador suma el valor de las fichas del rival y al rival se le resta la misma cantidad.',
          'También termina cuando cada jugador pasa dos veces consecutivas, sin cambios entre esos pases, o tras doce turnos consecutivos de pases, cambios o jugadas inválidas.',
          'En esos cierres sin vaciar el atril, cada jugador resta el valor de sus propias fichas restantes.',
          'En torneo también pueden aplicarse un límite total de partida, reloj, sanciones y decisiones del director.',
        ],
      },
    ],
    sourceTitle: 'Fuentes oficiales',
    sourceNote: 'Esta guía resume las normas y no sustituye el reglamento completo ni las condiciones particulares de cada torneo. El diccionario incluido en la app es una referencia; usa el lexicón exigido por la organización.',
    sources: [
      { label: 'Reglamento clásico FILE 2024 (PDF)', url: 'https://www.filexico.com/_files/ugd/86eae9_218ad5c749024cfc9259ed4ef82d9de4.pdf' },
      { label: 'Federación Internacional de Léxico en Español', url: 'https://www.filexico.com/' },
      { label: 'Reglamento de Léxico FISE 2016', url: 'https://www.filexico.com/recursos' },
    ],
  },
  en: {
    eyebrow: 'VERIFIED PLAY GUIDE',
    title: 'Scrabble Rules',
    intro: 'A practical summary of classic and competitive play, checked against official documentation. Open each section for details.',
    edition: 'English · Hasbro classic rules with tournament notes',
    facts: [
      { value: '15×15', label: 'squares on the board' },
      { value: '7', label: 'tiles on the rack' },
      { value: '+50', label: 'points for a bingo' },
    ],
    correctionTitle: 'Important clarifications',
    corrections: [
      'A valid root does not automatically make every inflection or derivative playable: each exact form must appear in the selected word list.',
      'Animals, foods, loanwords and eponyms are not automatically valid categories; a word is acceptable only when the chosen lexicon includes it.',
      'Days and months receive no blanket exception. Words that are always capitalized are excluded; a lowercase homograph may be valid when the lexicon lists its common-word sense.',
    ],
    sections: [
      {
        number: '01',
        title: 'Object and setup',
        summary: 'Build connected words and finish with the highest score.',
        points: [
          'Classic home play uses a 15 × 15 board, 100 tiles including two blanks, and two to four players.',
          'Each player draws seven tiles. To choose who starts, each player may draw one tile; the tile nearest A goes first and a blank precedes A.',
          'Words read from left to right or top to bottom. Diagonal plays are not allowed.',
        ],
      },
      {
        number: '02',
        title: 'Opening and connecting plays',
        summary: 'The opening covers the center; every later play joins the crossword.',
        points: [
          'The first play uses at least two tiles and covers the center star, a double-word square.',
          'All new tiles in a turn must lie in one row or column and form one complete word.',
          'Any crosswords made by adjacent tiles must also be acceptable. Score every word created or modified by the play.',
          'Tiles already confirmed on the board cannot be moved.',
        ],
      },
      {
        number: '03',
        title: 'Turns, exchanges and blanks',
        summary: 'Play tiles, exchange, or pass; then refill the rack to seven.',
        points: [
          'A play may extend an existing word, cross it at right angles, or run parallel while creating valid crosswords.',
          'Instead of playing, a player may exchange tiles according to the chosen rule set and loses that turn. A player may also pass for zero points.',
          'A blank scores zero and may represent any letter. Its declared identity cannot change later in the game.',
          'Tournament procedures for drawing, exchanging and timing are stricter than casual home play.',
        ],
      },
      {
        number: '04',
        title: 'Acceptable words',
        summary: 'The agreed word list decides each exact spelling.',
        points: [
          'Before play, agree on the word authority. North American tournaments generally use the NASPA Word List; international play uses Collins Scrabble Words under WESPA rules.',
          'Standard rules permit entries labeled as parts of speech, including accepted foreign, archaic, obsolete, colloquial and slang words.',
          'Words always capitalized, abbreviations, standalone prefixes or suffixes, and forms requiring a hyphen or apostrophe are excluded.',
          'A familiar category or grammatical pattern is not enough: the exact letter sequence must be present in the active lexicon.',
        ],
      },
      {
        number: '05',
        title: 'Scoring',
        summary: 'Add tile values, apply letter premiums, then word premiums.',
        points: [
          'Double- and triple-letter squares affect only the newly placed tile. Apply double- and triple-word premiums after letter premiums.',
          'Multiple word premiums compound: two double-word squares produce ×4 and two triple-word squares produce ×9.',
          'A premium square is used only on the turn when a tile first covers it. Existing tiles later count at face value.',
          'Score each word made in the turn; a shared tile counts in every applicable word.',
          'Playing all seven rack tiles in one turn adds 50 points after the word score.',
        ],
      },
      {
        number: '06',
        title: 'Challenges',
        summary: 'The penalty depends on whether you use home, NASPA or WESPA rules.',
        points: [
          'Under Hasbro classic rules, challenge before the next turn begins. An unacceptable play is removed and its player loses the turn; if it is acceptable, the challenger loses the next turn.',
          'Tournament challenge systems are not universal. NASPA and WESPA events may use different timing and penalties, including point penalties.',
          'The organizer must announce the word list and challenge rule before play. Apply that published policy instead of mixing systems.',
          'Check all words formed by the play when the selected rules require a multiword challenge.',
        ],
      },
      {
        number: '07',
        title: 'Ending the game',
        summary: 'Finish when a player goes out with an empty bag or no plays remain.',
        points: [
          'Under classic rules, the game ends when all tiles have been drawn and one player uses the last rack tile, or when all possible plays have been made.',
          'Each player subtracts the value of unplayed rack tiles. A player who goes out also adds the opponents’ remaining tile values.',
          'The highest final score wins. Under classic Hasbro rules, a tie goes to the player with the higher score before rack adjustments.',
          'Tournament rules may define consecutive scoreless turns, clocks and adjudication procedures more precisely.',
        ],
      },
    ],
    sourceTitle: 'Official sources',
    sourceNote: 'This guide is a summary, not a replacement for the complete rulebook or an event’s published conditions. The app’s bundled dictionary is a reference list; use the lexicon required by your organizer.',
    sources: [
      { label: 'Hasbro classic Scrabble rules (PDF)', url: 'https://www.hasbro.com/common/instruct/Scrabble%2CStandard.PDF' },
      { label: 'WESPA Rules 5.1 (PDF)', url: 'https://wespa.org/wp-content/uploads/2024/09/Rules-V5.1.pdf' },
      { label: 'NASPA Official Tournament Rules', url: 'https://scrabbleplayers.org/w/Official_Tournament_Rules' },
    ],
  },
};
