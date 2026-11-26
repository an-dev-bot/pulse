# Especificación P2.2: tope de edad en el Top 3 (26-nov-2026)

Lee `AGENTS.md` si existe, `ESPEC_P2_PULSE.md`, `app/js/rank.js` (`pickTop3`, `storyScore`), `app/js/config.js` (`RANK`) y
`tests/p2-9-ahora.test.mjs`. Se hace en `main`. No hacer commit.

## Problema
`pickTop3` ordena solo por impacto × recencia (vida media de 8 h). Una historia de Alto impacto con más de 24 h
todavía puede quedar primera en «Top 3 ahora» si hoy no hay mucho. Caso real del 26-nov: la historia de Nvidia del
25-nov (17:19 UTC) estaba en el Top 3 a las 18:20 del 26-nov, con más de 24 h.

## Cambio
1. En `config.js`, dentro de `RANK`, agrega `top3MaxAgeHours: 12`.
2. En `pickTop3` (solo allí; `rankStories`, la lista «Historias» y `storyScore` no cambian):
   - Edad = la misma que usa `storyScore` (`now - Date.parse(s.time)`).
   - Historias «frescas» = edad ≤ `top3MaxAgeHours`.
   - Orden del resultado, tomando las primeras 3:
     1. frescas de Alto/Medio (orden de `rankStories`),
     2. frescas «Bajo»,
     3. viejas (de cualquier nivel, orden de `rankStories`), solo para rellenar si no hay 3.
   - Una historia vieja **nunca** queda antes que una fresca.
3. Debe seguir cumpliéndose lo de P2.1: «Bajo» no entra si hay 3 de Alto/Medio **frescas**.

## Decisión ya tomada por la dueña (26-nov-2026)
La edad se mide desde la primera aparición (`s.time`), como hace hoy `storyScore`, para que el Top 3 y el
orden «Top» sean coherentes. No usar `s.last`. No preguntar de nuevo.

## Pruebas (prefijo `p2-2`, archivo nuevo `tests/p2-10-top3-edad.test.mjs`)
1. Con la lista del caso real del 26-nov (`now` = 2026-11-26T18:20Z): la historia `nv` (25-nov 17:19) no está en el
   Top 3 si hay 3 frescas de Alto/Medio.
2. Con solo 2 frescas: la tercera es la fresca «Bajo» si existe; si no, la vieja con mejor puntaje.
3. Una historia de exactamente 12 h entra como fresca; una de 12 h 1 min no.
4. Las historias viejas siguen apareciendo en «Historias» (el tope no las oculta).
5. La prueba de P2.1 (`p2-9-ahora`) sigue pasando sin cambiarla.

Corre `npm run p2` completo (una sola corrida) y muestra el resultado. Muestra el diff antes de dar por terminado.
