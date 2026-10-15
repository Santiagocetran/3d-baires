# Revisión del repositorio antes de compartirlo

Revisión ejecutada el **15 de octubre de 2026**. No se encontraron bloqueos en los controles realizados para compartir el repositorio y el sitio público. Es una revisión acotada y fechada, no una certificación de seguridad.

El punto de partida fue `a2f495c`, con 11 commits y un historial completo, no superficial. También se revisan los archivos nuevos de esta entrega antes del push. El resumen verificable está en [security-review.json](security-review.json).

## Controles ejecutados

| Control | Resultado |
| --- | --- |
| Historial de todas las referencias Git disponibles | Gitleaks 8.30.1: 11 commits, sin hallazgos. Binario descargado de su publicación oficial y checksum SHA-256 verificado. |
| Archivos sensibles en el historial | 120 rutas únicas revisadas; no aparecen `.env`, credenciales cloud, claves privadas ni configuración local de Vercel. |
| Artefacto público preparado | Gitleaks sobre `.vercel/output/static`: sin hallazgos. Los archivos locales de credenciales no forman parte del artefacto. |
| Archivos candidatos a publicar y build nuevo | Gitleaks: sin hallazgos en los 113 archivos versionados/nuevos ni en `dist` recién generado. Los archivos locales ignorados se excluyeron del snapshot del repositorio. |
| TypeScript, build y enlaces de documentación | `npm run check`, `npm run build`, enlaces Markdown locales y `git diff --check`: aprobados. No se repitieron pruebas unitarias o de navegador porque sólo cambian documentación y reglas de exclusión. |
| Dependencias npm, incluidas las de desarrollo | `npm audit --json`: cero vulnerabilidades conocidas, 141 dependencias según el informe del gestor. |
| Dependencias Python fijadas | `pip-audit`: cinco paquetes auditados, cero vulnerabilidades conocidas. Las versiones instaladas coinciden con `requirements.txt`. |
| Reglas de exclusión | Se verificaron diez rutas de credenciales/claves con `git check-ignore`; se ampliaron las reglas preventivas de `.gitignore`. |
| Acceso web a rutas sensibles | `/.env`, `/.env.local`, `/.git/config` y `/.vercel/project.json`: 404. `/.aws/credentials`: 403. Esos sondeos no sirvieron los archivos solicitados. |
| Protecciones GitHub | Secret scanning y push protection habilitados y confirmados por API; cero alertas de secretos abiertas al consultar. |
| Reportes privados | Habilitados y confirmados; [SECURITY.md](../SECURITY.md) indica el canal para reportar sin publicar secretos. |

La revisión dirigida del código no encontró uso de `dangerouslySetInnerHTML`, `innerHTML`, `eval` o generación dinámica de código en la aplicación. Los atributos de edificios se presentan como texto mediante React y los marcadores usan `textContent`. Las atribuciones HTML son constantes del proyecto. El manifiesto valida rutas, tamaños e identidades antes de cargar geometría. La aplicación no tiene backend propio, autenticación ni formularios de subida.

Las credenciales de herramientas locales no se imprimieron, no se añadieron al repositorio y no se probaron contra servicios externos. Los archivos de salida del escáner se redactaron; el informe público conserva resultados y alcance, no posibles valores secretos.

## Repetir las comprobaciones

Con [Gitleaks](https://github.com/gitleaks/gitleaks) instalado, desde la raíz:

```sh
gitleaks git --log-opts=--all --redact=100
npm audit
```

Con [pip-audit](https://github.com/pypa/pip-audit) disponible, para los paquetes fijados en este proyecto:

```sh
pip-audit --no-deps --disable-pip -r requirements.txt
```

La modalidad Python audita las cinco dependencias explícitamente fijadas, no todas las herramientas adicionales de cualquier entorno de desarrollo. Si se agregan dependencias, hay que revisar también sus transitivas.

## Límites

Un escáner reconoce determinados formatos y patrones; puede no detectar un secreto desconocido u oculto en contenido binario. Las auditorías de dependencias cubren avisos conocidos a la fecha, no vulnerabilidades futuras. Una respuesta 403/404 tampoco sustituye la revisión del artefacto que se publica.

No se hizo una prueba de penetración exhaustiva, ni una revisión completa de permisos de cuentas, infraestructura o dispositivos de colaboradores. No se cambiaron planes, permisos de colaboradores, historial Git ni código de la aplicación. La habilitación de reportes privados no implica un plazo garantizado de respuesta. Las protecciones y las versiones deben volver a revisarse cuando cambie el proyecto.
