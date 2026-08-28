export type Language = 'es' | 'en';

export type CompiledLexicon = {
  text: string;
  count: number;
  rejected: number;
};

const STARTER_SPANISH = `adios
agua
aire
alegre
amable
amar
amigo
amor
animal
arbol
azul
baile
barco
bello
bien
boca
bosque
bueno
cafe
calle
calor
campo
casa
causa
claro
comer
comida
corazon
correr
cosa
dia
dulce
flor
fruta
fuego
gato
grande
hablar
hielo
hijo
hogar
hola
juego
jugar
lago
libro
lindo
luna
madre
mano
mar
mesa
mirar
montaña
mundo
murcielago
musica
nacer
naturaleza
niño
noche
nube
nuevo
ojo
padre
pais
palabra
pan
papel
parque
paso
perro
piedra
playa
puerta
queso
rio
rojo
saber
sal
sol
sueño
tarde
tierra
tiempo
trabajo
tren
uno
verde
viaje
vida
viento
voz`;

const STARTER_ENGLISH = `about
above
after
again
air
apple
away
beautiful
bird
black
blue
book
bright
cat
chair
clear
cloud
coffee
cold
color
day
dog
door
dream
earth
easy
eat
family
fast
fire
flower
food
forest
friend
game
garden
good
green
happy
hello
home
house
ice
joy
kind
lake
large
learn
life
light
love
moon
mother
music
new
night
ocean
orange
paper
park
peace
play
quick
quiet
read
red
river
road
run
scrabble
sea
small
smile
snow
song
star
stone
sun
table
time
train
tree
walk
warm
water
white
wind
word
world
write
yellow`;

export function normalizeWord(input: string, language: Language): string {
  const locale = language === 'es' ? 'es' : 'en';
  let value = input.normalize('NFKC').trim().toLocaleLowerCase(locale);

  if (language === 'es') {
    value = value.replace(/ñ/g, '\uE000');
  }

  value = value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\uE000/g, 'ñ');

  return value;
}

export function countTiles(word: string, language: Language): number {
  if (language === 'en') return word.length;

  let tiles = 0;
  for (let index = 0; index < word.length; index += 1) {
    const pair = word.slice(index, index + 2);
    if (pair === 'ch' || pair === 'll' || pair === 'rr') index += 1;
    tiles += 1;
  }
  return tiles;
}

export function getInputError(word: string, language: Language): string | null {
  if (!word) return 'Escribe una palabra para comprobarla.';
  const pattern = language === 'es' ? /^[a-zñ]+$/ : /^[a-z]+$/;
  if (!pattern.test(word)) return 'Usa solo letras, sin espacios, guiones ni signos.';
  if (word.length < 2) return 'Las jugadas válidas deben tener al menos 2 letras.';
  if (countTiles(word, language) > 15) return 'Este juez admite palabras de hasta 15 fichas.';
  return null;
}

export function compileLexicon(source: string, language: Language): CompiledLexicon {
  const words = new Set<string>();
  let rejected = 0;

  for (const rawLine of source.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const word = normalizeWord(line, language);
    if (getInputError(word, language)) {
      rejected += 1;
      continue;
    }
    words.add(word);
  }

  const sorted = Array.from(words).sort();
  return { text: sorted.join('\n'), count: sorted.length, rejected };
}

export function hasWord(lexicon: string, target: string): boolean {
  let low = 0;
  let high = lexicon.length;

  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    const start = middle === 0 ? 0 : lexicon.lastIndexOf('\n', middle - 1) + 1;
    const foundEnd = lexicon.indexOf('\n', middle);
    const end = foundEnd === -1 ? lexicon.length : foundEnd;
    const candidate = lexicon.slice(start, end);

    if (candidate === target) return true;
    if (candidate < target) low = end + 1;
    else high = start;
  }

  return false;
}

export const STARTER_LEXICONS: Record<Language, CompiledLexicon> = {
  es: compileLexicon(STARTER_SPANISH, 'es'),
  en: compileLexicon(STARTER_ENGLISH, 'en'),
};
