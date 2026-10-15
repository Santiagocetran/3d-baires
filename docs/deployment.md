# Publicación en Vercel

La publicación usa [Build Output API](https://vercel.com/docs/build-output-api) y [deploy --prebuilt](https://vercel.com/docs/cli/deploy). El build se prepara localmente, donde ya existen los datos auditados. No alcanza con importar el repositorio en Vercel y ejecutar Vite: Git no contiene los paquetes masivos.

```sh
# Con dependencias y datos preparados según README:
npm run prepare:vercel
npx --yes vercel@64.2.0 login
npx --yes vercel@64.2.0 link
npx --yes vercel@64.2.0 deploy --prebuilt --prod
```

`prepare:vercel` valida checksums y estructura de la publicación, ejecuta TypeScript/build y genera `.vercel/output/static` con HTML, assets, límites y únicamente los paquetes/atributos referenciados en city.json. Incluye licencias y manifiesto de fuentes. Excluye crudos, credenciales y antecedentes GeoJSON/MVT. `.vercel/` permanece fuera de Git.

Los archivos de datos conservan nombres estables y deben revalidarse en caché; los assets con hash se pueden cachear un año. No hay rewrite general hacia index.html: un paquete ausente debe devolver 404. El cliente admite gzip de archivo o descompresión HTTP automática. Sin backend ni funciones.

El script aplica un presupuesto preventivo de 100.000.000 bytes al artefacto, conforme al [límite publicado de uploads CLI Hobby](https://vercel.com/docs/limits). No cambia planes ni compra servicios. La descarga inicial de geometría es de ~61 MB por visitante; los atributos se cargan bajo demanda. Las cuotas de transferencia de la cuenta siguen aplicando.

No se configura despliegue automático por push: primero hace falta una estrategia de distribución/versionado de datos para CI. Los próximos despliegues se realizan desde una copia con datos preparados mediante las órdenes anteriores.

Estado al 2026-10-15: artefacto preparado con 624 archivos y 82.689.903 bytes. Build/TypeScript aprobados. La prueba de navegador sobre la carpeta estática aprobó 601 bloques, 1.386.616 volúmenes y 13 paquetes, navegación sin descargar geometría adicional y vista general completa (`browser-vercel-local.json`; SwiftShader, 13.893 ms hasta ready). Publicación en producción completada: [3d-baires.vercel.app](https://3d-baires.vercel.app), proyecto `3d-baires` de `santiagorcetran236-8862s-projects`, deployment `dpl_C7gHNmAwLFX4g6VETKU2d4P4k5Lq`.

Verificación remota aprobada (`browser-vercel.json`): 601 bloques, 1.386.616 volúmenes, 13 paquetes, navegación por cuatro barrios sin descargas adicionales y encuadre completo de CABA. Ready en 24.114 ms en esta ejecución con Chromium/SwiftShader; no es una medición de FPS ni una garantía de tiempo en otros dispositivos. La prueba sustituye las teselas OSM por una imagen neutra: verifica aplicación y datos remotos, no el servicio externo del mapa base.

HTTP sin autenticación: raíz y manifiesto 200, paquete inexistente 404. Raíz/datos usan `public, max-age=0, must-revalidate`. SHA-256 del manifiesto remoto igual al local (`aab33af55185c38f912442111a88b2ee24b479ca7cc74e9c2a3fef7fb5ffa31b`); primer paquete y primer archivo de atributos idénticos a los locales y gzip válido.

## Preparación de la actualización visual y estadios · 2026-10-15

`npm run prepare:vercel` aprobó la validación de datos y el build para la actualización del atlas: 13 lugares (ocho estadios), filtro de fútbol, paleta renovada, máscara exterior de CABA y animación optimizada. El artefacto contiene **641 archivos / 85.712.633 bytes**, con los mismos 1.386.616 volúmenes, 601 bloques y 13 paquetes. Se verificó que las 13 fotografías y los tres manifiestos de procedencia coinciden byte a byte con sus fuentes locales. El presupuesto sigue siendo 100.000.000 bytes. Los manifiestos nuevos `data/landmarks-sources.json` y `data/stadium-points.json` se incluyen en la publicación; los datos crudos permanecen excluidos.

La prueba sobre el artefacto estático servido localmente aprobó las 13 fichas, los ocho estadios y sus coordenadas, filtro, fotos, móvil y replay (`docs/browser-design-production-local.json`). Usa fixture para geometría y SwiftShader; no mide hardware ni sustituye la verificación de la ciudad completa en producción.
