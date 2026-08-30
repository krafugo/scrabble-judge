# Palabra justa

Juez de palabras responsive para español e inglés. Toda validación ocurre en el navegador: no usa una API ni un backend. Los diccionarios predeterminados se incluyen con la aplicación y los léxicos importados se guardan localmente en IndexedDB. Las consultas usan búsqueda binaria sobre texto ordenado para reducir memoria y mantener respuestas rápidas.

La aplicación carga automáticamente estos archivos desde la raíz del proyecto:

- `spanish-scrabble-words.txt`: diccionario predeterminado de español, con 662.806 palabras.
- `english-scrabble-words.txt`: diccionario predeterminado de inglés, con 268.134 palabras.

Después de la primera carga, el service worker conserva la aplicación y ambos diccionarios para usarlos sin conexión.
Si un diccionario completo no puede cargarse, la validación se desactiva y la interfaz ofrece reintentar o importar un TXT local; nunca se sustituye silenciosamente por una lista parcial.

> Diccionarios de Scrabble (FISE-2 y TWL06/SOWPODS) obtenidos del repositorio de código abierto de diccionarios de Scrabble ([kamilmielnik/scrabble-dictionaries](https://github.com/kamilmielnik/scrabble-dictionaries) en GitHub).

Antes de usar la aplicación en una competición, comprueba siempre qué lexicón y versión exige la organización del torneo.

## Significados opcionales (español e inglés)

Después de comprobar una palabra **válida**, pulsa **Ver significado**. En el modo
de anagramas, selecciona un resultado y pulsa el mismo botón. No se realiza ninguna
consulta externa al escribir ni al validar: únicamente al pedir el significado.

- Español: [Wikcionario](https://es.wiktionary.org/). Inglés: [Wiktionary](https://en.wiktionary.org/).
- API pública de MediaWiki con CORS, directamente desde el navegador: sin claves, backend ni proxy.
  Compatible con GitHub Pages y con su ruta base `/scrabble-judge/`.
- La primera consulta necesita conexión y envía la palabra al proveedor (que también
  recibe la IP, como cualquier servicio web). No se envían cookies ni el referente de la app.
- Se guardan hasta 60 consultas exitosas en `localStorage`, sin HTML, para reutilizarlas
  offline. **Actualizar en línea** renueva una copia. **Diccionarios → Borrar significados
  guardados** elimina esta caché sin tocar los léxicos ni otros datos.
- Si el almacenamiento está bloqueado o lleno, se muestra el significado pero se avisa
  de que no pudo guardarse. Limpiar los datos del navegador elimina las copias.
- La búsqueda conserva la ortografía escrita y las tildes (`papa` y `papá` se guardan
  por separado); en español busca también títulos equivalentes a las fichas, sin
  confundir `n` y `ñ`. Muestra hasta tres grafías y seis acepciones por entrada,
  con enlace a la entrada completa. La búsqueda de variantes es acotada, no exhaustiva.
- La cobertura no es total: hay formas flexionadas, regionalismos y términos del
  léxico que no tienen una entrada extraíble. Se indica claramente cuando no hay
  definición, hay un fallo de red o falta conexión. **Nada de esto cambia la validez
  del resultado de Scrabble.** Tampoco una acepción mostrada prueba que ese uso
  concreto esté admitido por las reglas (por ejemplo, como nombre propio).
- Las consultas se cancelan al cambiar de palabra y tienen un límite de 15 segundos.
  Un HTTP 429 muestra un aviso y desactiva temporalmente el reintento según
  `Retry-After` (60 segundos si no se especifica). No se reintenta automáticamente.
- No son definiciones oficiales de Scrabble ni de la RAE. Se extrae únicamente la
  sección del idioma elegido. No se muestran traducciones de otra lengua por accidente.

### Fuente y licencia de definiciones

Las acepciones se atribuyen a Wikcionario/Wiktionary y sus colaboradores, con enlace
a la revisión consultada, a la entrada completa y a
[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). Las selecciones y
adaptaciones de esas definiciones se ofrecen bajo esa misma licencia. Se omiten
ejemplos citados, imágenes y tablas; se convierte a texto y se acotan las acepciones
y su longitud, sin insertar HTML del proveedor en la página.
Consulta las [condiciones de Wikimedia](https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use)
y los avisos de cada entrada antes de redistribuir contenido.

La estructura editorial puede cambiar: mantener el extractor y sus pruebas si cambia
el HTML de Wiktionary. No hay garantía de disponibilidad del servicio externo; no se
utilizan proxies públicos como alternativa. Para cobertura completa sin conexión haría
falta incorporar y mantener un conjunto de definiciones con licencia compatible,
independiente de los TXT actuales, que contienen solo palabras.

## Reglas bilingües

La sección **Reglas** permite alternar entre español e inglés. El resumen en español sigue el Reglamento de Juego — Modalidad Clásica de FILE aprobado en septiembre de 2024; el resumen en inglés parte de las reglas clásicas de Hasbro y distingue las variantes competitivas de WESPA y NASPA. La propia sección enlaza los documentos completos de cada organización.

## Ejecutar localmente

Requiere Node.js 22.13 o posterior.

```bash
npm install
npm run dev
```

Abre la dirección local indicada. Para crear una versión de producción:

```bash
npm run build
npm start
```

Para crear y revisar la versión completamente estática usada por GitHub Pages:

```bash
npm run build:pages
npm run preview:pages
```

Las pruebas del motor se ejecutan con:

```bash
npm test
```

## Publicación en GitHub Pages

La rama `main` se publica automáticamente mediante `.github/workflows/pages.yml`. El flujo ejecuta las pruebas, construye `dist-pages` con la ruta base `/scrabble-judge/` y despliega el resultado con las acciones oficiales de GitHub Pages.

Para la primera publicación, selecciona **GitHub Actions** en **Settings → Pages → Build and deployment → Source**. Las publicaciones posteriores se realizan automáticamente con cada actualización de `main`.

## Importar otro léxico

En la aplicación, elige el idioma, pulsa **Diccionarios** y selecciona **Importar archivo .TXT**. El archivo debe cumplir exactamente este formato:

- Texto plano UTF-8, extensión `.txt`, máximo 25 MB.
- Una palabra por línea; finales de línea LF o CRLF.
- Palabras de 2 a 15 fichas.
- En español, los dígrafos `CH`, `LL` y `RR` cuentan como una sola ficha.
- En español se aceptan vocales con tilde o diéresis, que se normalizan a la ficha sin marca. `Ñ` se conserva como una letra distinta de `N`.
- En inglés se aceptan letras A–Z.
- Se ignoran líneas vacías y líneas cuyo primer carácter visible sea `#`.
- Se eliminan duplicados automáticamente.

Ejemplo:

```text
# Léxico autorizado para este torneo
árbol
niño
murciélago
```

Para incorporar un léxico distinto, obtén el TXT del editor, federación u organización correspondiente y sigue el proceso anterior. Para cambiar permanentemente los diccionarios incluidos, reemplaza los archivos de la raíz conservando sus nombres y actualiza sus conteos en `lib/default-lexicons.ts`.

## Normalización y privacidad

- Se eliminan espacios al principio y al final y se ignoran mayúsculas/minúsculas.
- En español, `ÁRBOL` se consulta como `arbol`, mientras `NIÑO` se consulta como `niño`.
- No se permiten espacios internos, guiones, apóstrofos ni signos.
- El archivo importado se procesa y almacena en el dispositivo. No se envía a ningún servidor.
- El service worker guarda la aplicación después de la primera carga para permitir su uso sin conexión.

## Estructura

- `app/page.tsx`: interfaz, importación y flujo de validación.
- `english-scrabble-words.txt`: diccionario predeterminado de inglés.
- `spanish-scrabble-words.txt`: diccionario predeterminado de español.
- `lib/default-lexicons.ts`: nombres, conteos y carga eficiente de los diccionarios incluidos.
- `lib/rules-content.ts`: guía bilingüe verificada y enlaces a reglamentos oficiales.
- `lib/word-judge.ts`: normalización, compilación y búsqueda binaria.
- `lib/lexicon-store.ts`: persistencia local de léxicos importados.
- `components/word-meaning.tsx`: consulta opcional y selección desde anagramas.
- `lib/word-meanings.ts`: proveedor, extracción por idioma y variantes ortográficas.
- `lib/meaning-cache.ts`: caché local acotada, validación de datos y limpieza.
- `lib/word-meanings.test.ts`, `lib/meaning-cache.test.ts`, `lib/word-meaning-ui.test.ts`: pruebas sin llamadas externas.
- `lib/word-judge.test.ts`: pruebas unitarias.
- `public/sw.js`: disponibilidad sin conexión.
