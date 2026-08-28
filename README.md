# Palabra justa

Juez de palabras responsive para español e inglés. Toda validación ocurre en el navegador: no usa una API, un backend ni una conexión de red. Los léxicos importados se guardan localmente en IndexedDB y se consultan mediante búsqueda binaria sobre texto ordenado para reducir memoria y mantener respuestas rápidas.

> La aplicación incluye únicamente vocabularios pequeños de demostración. **No son léxicos oficiales ni completos.** Las listas oficiales de Scrabble pueden estar sujetas a licencia y no se redistribuyen en este repositorio.

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

Las pruebas del motor se ejecutan con:

```bash
npm test
```

## Añadir un léxico autorizado

En la aplicación, elige el idioma, pulsa **Diccionarios** y selecciona **Importar archivo .TXT**. El archivo debe cumplir exactamente este formato:

- Texto plano UTF-8, extensión `.txt`, máximo 25 MB.
- Una palabra por línea; finales de línea LF o CRLF.
- Palabras de 2 a 15 letras.
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

Para incorporar un léxico con licencia, obtén el TXT del editor, federación u organización correspondiente y sigue el proceso anterior. También se puede reemplazar el vocabulario inicial en `lib/word-judge.ts` durante una distribución privada, siempre que la licencia permita empaquetarlo.

## Normalización y privacidad

- Se eliminan espacios al principio y al final y se ignoran mayúsculas/minúsculas.
- En español, `ÁRBOL` se consulta como `arbol`, mientras `NIÑO` se consulta como `niño`.
- No se permiten espacios internos, guiones, apóstrofos ni signos.
- El archivo importado se procesa y almacena en el dispositivo. No se envía a ningún servidor.
- El service worker guarda la aplicación después de la primera carga para permitir su uso sin conexión.

## Estructura

- `app/page.tsx`: interfaz, importación y flujo de validación.
- `lib/word-judge.ts`: normalización, compilación y búsqueda binaria.
- `lib/lexicon-store.ts`: persistencia local de léxicos importados.
- `lib/word-judge.test.ts`: pruebas unitarias.
- `public/sw.js`: disponibilidad sin conexión.
