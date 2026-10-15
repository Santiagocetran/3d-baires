# Contribuir a 3d-baires

¡Toda ayuda suma! Este proyecto está abierto a personas que quieran aportar desde cualquier lugar: programación, diseño, fotografía, datos, historia, fútbol o simplemente curiosidad por Buenos Aires. **No necesitás saber programar para participar.**

## Hay muchas formas de ayudar

- **Compartir ideas:** qué te gustaría explorar, una función que falta o una forma distinta de mirar la ciudad.
- **Aportar conocimiento local:** lugares para descubrir, estadios, edificios, parques o detalles de tu barrio. Una buena fuente también es un aporte.
- **Sumar fotos y contenido:** imágenes propias o con licencia reutilizable, descripciones y enlaces que ayuden a conocer cada lugar.
- **Probar el mapa:** contar qué funciona y qué falla en tu teléfono o computadora, detectar problemas de navegación, legibilidad o accesibilidad.
- **Mejorar el diseño y los textos:** bocetos, propuestas visuales, correcciones, documentación y traducciones de la documentación.
- **Escribir código:** mejorar rendimiento, animaciones, accesibilidad, procesamiento de datos o pruebas; corregir errores también cuenta.

Una observación pequeña puede ser tan útil como una funcionalidad nueva. Si no sabés por dónde empezar, contanos qué te interesa.

## Para proponer algo o avisar de un error

[Abrí un issue](https://github.com/Santiagocetran/3d-baires/issues/new) y explicalo con tus palabras. No hace falta una propuesta técnica ni tener la solución.

Si encontraste un error, ayuda incluir qué intentabas hacer, qué ocurrió, el navegador y dispositivo, y el enlace de la vista del mapa. Una captura o un video corto puede servir; revisá que no muestre datos privados.

Para una idea grande, un boceto o una conversación inicial permite acordar el rumbo antes de dedicarle mucho trabajo. También podés comentar ideas y pruebas en los issues existentes.

## Para aportar cambios

1. Hacé un fork y creá una rama para tu aporte. Para textos y cambios pequeños también podés usar el editor de GitHub.
2. Prepará un cambio que sea fácil de revisar. Los aportes pequeños son bienvenidos.
3. Abrí un pull request hacia `master`: contá qué cambia, por qué y cómo lo revisaste. Si cambia la interfaz, una captura ayuda.

La [guía de desarrollo](docs/desarrollo.md) explica cómo preparar el entorno y los datos. El mapa completo requiere datos que no están incluidos en Git; no hace falta descargarlos para proponer ideas, corregir textos o aportar diseños.

Para cambios de frontend, ejecutá `npm run check` y `npm run build`. Si modificás lógica, ejecutá también `npm test`; para procesamiento Python, las pruebas están en `tests/`. La guía detalla las verificaciones de geometría y navegador. Indicá cuáles ejecutaste y cuáles quedaron pendientes. Una corrección de documentación no necesita compilar toda la aplicación.

## Cuidar los datos y los créditos

Queremos que el mapa sea interesante y confiable. Al proponer un lugar o corregir un dato, incluí su fuente y una ubicación verificable. Conservá los identificadores y la procedencia cuando existan. No inventemos alturas, años o relatos para completar lo que falta: lo desconocido puede seguir siendo desconocido.

Las fechas de proyecto, construcción e inauguración pueden ser distintas. Un lugar destacado tampoco identifica automáticamente cada volumen de un edificio. Si una coincidencia es dudosa, señalala para revisarla juntos.

Para fotos, datos y código de terceros, indicá autor, enlace y licencia que permita compartirlos. Conservamos los créditos de Amsterdam, las fuentes de GCBA, OpenStreetMap y cada fotografía. El código del proyecto usa [MIT](LICENSE); eso no reemplaza las licencias de los datos y las imágenes.

No incluyas credenciales, archivos `.env`, datos privados, dependencias instaladas ni descargas masivas en un pull request. Para un problema de seguridad, usá el [canal privado explicado en SECURITY.md](SECURITY.md).

## Participar con respeto

Las preguntas, los primeros aportes y los puntos de vista distintos son bienvenidos. Compartamos comentarios claros y respetuosos, y discutamos las ideas sin atacar a las personas.

Gracias por ayudar a construir otra manera de explorar Buenos Aires.
