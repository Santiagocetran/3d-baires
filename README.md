# 3d-baires

Un mapa interactivo para recorrer **Buenos Aires en 3D**, explorar sus 48 barrios y descubrir la ciudad a través de sus edificios, monumentos y estadios de fútbol.

**[Explorar 3d-baires.vercel.app](https://3d-baires.vercel.app)**

## La inspiración

El proyecto se inspira en [Amsterdam, building by building](https://github.com/alexbarakov/amsterdam-by-building), de alexbarakov: una manera de conocer una ciudad recorriendo su arquitectura en un mapa tridimensional. 3d-baires lleva esa idea a Buenos Aires y adapta parte de su motor 3D, conservando su atribución y licencia MIT.

## Cómo se hizo

Se utilizaron datos abiertos del Gobierno de la Ciudad de Buenos Aires para representar las formas y alturas publicadas de los volúmenes urbanos. Python prepara los datos; Three.js dibuja la ciudad en 3D y MapLibre permite recorrerla sobre un mapa de OpenStreetMap. La interfaz está hecha con React y TypeScript, y el sitio está publicado en Vercel.

La ciudad permanece cargada al desplazarse o cambiar el zoom. Los colores permiten distinguir alturas, y cada volumen se puede seleccionar para consultar sus datos.

## Qué podés descubrir

Podés recorrer los barrios, alternar entre vistas 2D y 3D y compartir el enlace de una vista. Los lugares destacados tienen fotografías y fichas propias: Teatro Colón, Casa Rosada, Obelisco, Cabildo y Palacio Barolo, junto con ocho estadios de fútbol porteños. El filtro «Fútbol» permite explorar las canchas de Boca, River, San Lorenzo, Huracán, Vélez, Argentinos Juniors, Ferro y Atlanta.

## Sobre los datos

La geometría procede de Tejido Urbano de GCBA, con datos hasta 2021, por lo que puede diferir de la ciudad actual. Un edificio puede estar representado por varios volúmenes. Las alturas desconocidas se muestran planas y no se inventan años de construcción.

Las fichas de lugares usan fuentes de Turismo BA y del catálogo oficial de estadios. Las fotografías provienen de Wikimedia Commons y muestran sus créditos y licencias en cada ficha.

## Créditos y documentación

Código bajo [licencia MIT](LICENSE), con [atribución al proyecto de Amsterdam](licenses/amsterdam-by-building-MIT.txt). Los datos de GCBA, la cartografía de OpenStreetMap y las fotografías conservan sus propias licencias.

Para profundizar: [desarrollo y verificación](docs/desarrollo.md), [fuentes y límites de los datos](docs/data-audit.md) y [créditos de las fotografías](licenses/landmark-photos.md).
