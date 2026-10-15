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

Estado al 2026-10-15: artefacto preparado con 624 archivos y 82.689.903 bytes. Build/TypeScript aprobados. La prueba de navegador sobre la carpeta estática aprobó 601 bloques, 1.386.616 volúmenes y 13 paquetes, navegación sin descargar geometría adicional y vista general completa (`browser-vercel-local.json`; SwiftShader, 13.893 ms hasta ready). Autenticación y publicación en Vercel pendientes; todavía no hay una URL pública verificada. El resultado remoto se registrará tras verificar sus endpoints.
