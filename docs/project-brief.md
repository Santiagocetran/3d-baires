# 3d-baires · enfoque actual

Explorar Capital Federal en 3D mediante volúmenes reales de Tejido Urbano. Prioridades: geometría, navegación fluida, colores por altura, animación de entrada y futura visualización de antigüedad. Historias y cronología se retiran de la interfaz; fuentes y trabajo previo se conservan.

## Decisiones

- Toda CABA, sin AMBA. Auditoría de 1.386.616 registros y 48 barrios; no es un censo independiente de edificios.
- Ciudad persistente con Three.js integrada en MapLibre: bloques binarios, workers y texturas de atributos siguiendo la arquitectura MIT de Amsterdam. Sin eliminación de mallas al navegar o cambiar zoom; sin recorte por bloque ni descarte por densidad. Simplificación topológica visual de 0,25 m; originales preservados.
- Conservar `source_row` como identidad de selección, porque hay IDs originales duplicados; preservar identificador original y procedencia.
- Altura publicada en metros. Valores sospechosos planos; sin inferencia desde pisos o ilustraciones.
- Animación de llegada por volumen ejecutada en GPU, repetible y adaptada de Amsterdam. No representa construcción temporal. Respeta movimiento reducido.
- Antigüedad desconocida en gris. No hay fechas verificadas asociadas a volúmenes en la entrega actual. No inventar un gradiente de edades ni trasladar fechas de inauguración a construcción.
- OSM opcional, atribución y dependencia de red visibles. Sin despliegues, remotos ni contacto con terceros.

## Iteración de fiabilidad y exploración · 2026-10-15

Transporte gzip compatible con Fetch, manifiesto/índices validados y estados completos verificables. Selección con errores independientes. Vista general basada en límites oficiales, URL de cámara/capa y panel móvil plegable. Checkpoints verificables y publicación recuperable. Plan auditado antes de implementar; revisión final y evidencia en documentos de validación.

## Backlog priorizado

1. Encontrar y auditar una fuente reutilizable de antigüedad/año de construcción con identificadores compatibles. Separar fecha de proyecto, permiso, construcción e inauguración; resolver cambios catastrales y ambigüedades.
2. Medir memoria y FPS de la ciudad residente en escritorio y móvil; reducir consumo de buffers y draw calls manteniendo continuidad visual. La ciudad ya no tiene umbral de zoom para edificios.
3. Revisar frescura del relevamiento, SMP sin correspondencia, conflictos espaciales y altura extrema.
4. Historias y otras capas: pospuestas por decisión de producto.

La investigación web adicional no identificó un recurso abierto de años compatible con todo Tejido. Eso no demuestra que no exista. Atlas y documentación catastral son líneas para investigar, no una cobertura ya adquirida.
