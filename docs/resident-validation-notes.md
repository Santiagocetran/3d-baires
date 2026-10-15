# Verificación de la ciudad residente · 2026-10-15

## Ejecutado

- 15 pruebas Python aprobadas: parsing, identidad, coordenadas, huecos, altura desconocida, checkpoints corruptos/configuración distinta y rollback/recuperación tras interrupción de publicación.
- 10 pruebas TypeScript aprobadas: cámara/URL, triangulación y huecos, índices/alturas/coordenadas inválidos, identidad worker y transporte mediante HTTP real (gzip como archivo y Content-Encoding, reintento, HTML, truncamiento, tamaño y aborto).
- `npm run check` y producción aprobados con MapLibre 6.4.1, Vite 6.4.4. `npm audit` sin avisos en esta revisión (`dependency-audit.json`). Se conserva el aviso de chunk principal grande: ~1,63 MB sin comprimir / 437 KB gzip, además de workers.
- `npm run validate:city`: todas las mallas, 1.386.616 source_row únicos, 24.436.400 triángulos, 18.136.158 vértices y 1 altura desconocida/plana. 1.202 muestras de atributos contrastadas. `validate_city` Python verificó todos los checksums comprimidos, tamaños, rangos y conteos de atributos de la publicación existente.
- Ciudad completa en desarrollo: conjuntos exactos de 601 bloques y 13 paquetes, 1.386.616 volúmenes; ready tras render, sin nuevas solicitudes de geometría ni cambios de buffers al recorrer Palermo, Villa Lugano, Belgrano y Monserrat. `browser-city.json`.
- Muestra de 800 volúmenes reales: selección nueva del ID 44958 en DPR 1/2, vista cenital, inclinación/giro y resize; selección vacía; panel móvil/control de zoom; URL restaura cámara/capa; movimiento reducido mantiene píxeles al repetir animación. Cada intento limpia el detalle anterior para evitar falso positivo. `browser-smoke.json`.
- Atributos tardíos no restauran una selección descartada. HTTP 503 en atributos mantiene ciudad ready; después se selecciona el ID 219524 de otro bloque. Se comprobaron errores exclusivamente esperados, sin fallos extra de solicitudes. `browser-attributes.json`.
- Siete casos negativos: HTTP, HTML, bytes corruptos y aborto después de cargar un bloque; error/messageerror de worker inyectados; pérdida real de contexto con WEBGL_lose_context. Todos terminan en error, nunca ready parcial. Tras fallo de carga aumentan los renders al navegar y se conserva geometría visible. `browser-negative.json`.
- El runner completo salió con código 1 y escribió failed ante fallo parcial, timeout de 1 ms y ejecutable de Chromium inexistente. `browser-city-negative.json`, `browser-timeout-negative.json` y `browser-launch-negative.json` son **fallos deliberados esperados**, no pruebas positivas de ciudad. No conservar resultados anteriores como éxito es parte del contrato comprobado.

## Inspección y límites

Capturas inspeccionadas en `data/processed/browser-check/`: ciudad completa, escritorio/móvil, selección, atribución y mallas conservadas tras error parcial. Capturas y fixture están ignorados por Git; nunca sustituyen los datos del producto. La escala se elevó para no solaparse con atribuciones. La preparación local usa style.load y no espera que termine OSM.

Las pruebas usan Chromium headless/SwiftShader y sustituyen teselas OSM por PNG neutro local. **No** verifican conectividad externa ni alineación visual sobre cartografía OSM real; la transformación sí tiene pruebas numéricas independientes y la geometría proviene de WGS84 auditado. No se midieron FPS de hardware, memoria GPU real, interacción táctil física ni móviles con memoria limitada. La inyección de fallo de compilación de shader no se ejecutó; existe manejo terminal.

431.099.114 bytes corresponden a arrays de malla/texturas CPU contabilizados. Three.js conserva estos arrays y crea recursos GPU al dibujar; no es memoria total del proceso ni prueba de que todos los recursos estén subidos a GPU. Los paquetes consumidos se liberan y las mallas permanecen. El tiempo dev de 25.156 ms tuvo concurrencia temporal con una prueba pequeña y sólo es evidencia funcional, no una medición aislada.

Los datos originales no se volvieron a descargar ni se repitió la preparación completa: no cambiaron geometría ni alturas. Los cambios de checkpoints/publicación se probaron con fixtures temporales, incluida corrupción e interrupción entre renombres. El empaquetado inicial había requerido reanudación; sus 139,6 s registrados corresponden al tramo reanudado, no a una preparación completa desde cero. Checkpoints antiguos sin firma completa se rechazan.

## Auditorías

Plan y revisión final de Astra documentados en `plan-audit.md` y `implementation-audit.md`. La relectura final no identificó correcciones obligatorias de código pendientes; exige cerrar la comprobación final de producción y documentación. Las pruebas de navegador posteriores a la lectura detectaron además messageerror y orden de limpieza al perder contexto: ambos corregidos y verificados.

El informe anterior de 967 ms/1 paquete fue un falso positivo y quedó invalidado en el commit de punto de partida. Los informes nuevos exigen identidad del manifiesto, conjuntos completos y estado explícito; nunca infieren finalización por desaparición del texto de progreso.

## Producción final y vista general

El build final pasó la carga completa y navegación en `http://127.0.0.1:4173`, sin otro navegador de prueba simultáneo. `browser-preview.json` registra **15.087 ms** hasta ready en SwiftShader, 601 bloques, 1.386.616 volúmenes y 13 paquetes; mismos 431.099.114 bytes de buffers y cero paquetes retenidos/nuevas descargas de geometría después de navegar. No es una promesa de tiempo en otro equipo o conexión.

La prueba final pulsa «Ver toda CABA» y comprueba que las esquinas del envolvente oficial estén dentro del canvas, con cámara cenital y nuevos renders. La vista completa se inspeccionó en `city-overview.png`. El zoom resultante 11,21 coincide con 11,2056 calculado para ese viewport; una primera aserción arbitraria <=11 había fallado y fue sustituida por la comprobación espacial, documentada también en `browser-overview-fixture.json`. El resultado final pasó; no se relajó la exigencia de mostrar toda CABA.

Cierre: correcciones auditadas aplicadas, pruebas afectadas aprobadas y sin trabajo de implementación pendiente en este plan. Permanecen los límites de datos y hardware descritos arriba; siguiente investigación: fuente de antigüedad vinculable y perfil de memoria/FPS en equipo real.
