# Voz y tono

Cómo escribo los posts del sitio. Vale para cualquier texto nuevo, corrección o traducción, en los tres idiomas. Los ejemplos salen de mis correcciones reales en la #13: "No" es lo que había y "Sí" es cómo lo dejé.

Las reglas que ya están en `CLAUDE.md` no se repiten acá: sin rayas, títulos en sentence case, sin buzzwords, español de Argentina con vos, portugués de Brasil, nombres de unidades de la versión en español del juego y citas en inglés traducidas por nosotros, con aviso.

## La voz en una línea

Un UX Manager que analiza un videojuego como analizaría un producto: en primera persona, con lo que vivió como jugador, con datos concretos y con opiniones dichas como opiniones.

## Principios

### Lo concreto antes que lo efectista

Cuento qué pasaba en el juego y qué costaba, no cómo se sentía de forma dramática.

- No: "Perder unidades comunes era parte del plan. Perder a mi héroe se sentía personal."
- Sí: "Perder unidades comunes era parte del plan, pero el héroe era alguien para entrenar y cuidar."
- No: "Dolía: tenía que pelear un rato sin él y pagar para revivirlo en el altar."
- Sí: "Dolía: pelear sin él era una desventaja grande, perdía la oportunidad de entrenarlo en esa batalla y pagaba para revivirlo en el altar."

### Sin frases armadas

Nada de cierres en tríada, de "no era X sino Y" ni de oraciones que repiten la anterior con más adorno. Si una oración no suma un dato, sale.

- No: "Un mensaje, una sola vez, y el límite deja de sentirse como un bug y pasa a leerse como una regla."
- Sí: "Con un mensaje creo que el límite deja de sentirse como un bug y pasa a leerse como una regla."
- No: "Para mí y para muchos jugadores, la plataforma no era una PC en casa sino una sala llena de ellas, conectadas por LAN."
- No: "Ya no tenía que elegir entre los juegos que me gustaban." Repetía la oración anterior.
- No: "…así que cada sesión se sentía completa." El final adornaba un dato que ya estaba dicho.

### Mis opiniones, dichas como opiniones

Un análisis es mi lectura, no una demostración. Uso "considero", "creo" o "supongamos", y no prometo explicar más de lo que el texto muestra.

- No: "Ahora puedo explicar por qué funciona: una regla que los jugadores tenían que descubrir fallando se vuelve información que aparece cuando importa."
- Sí: "Considero que hubiera sido mejor que los jugadores conocieran por un mensaje una regla que, si no, tenían que descubrir fallando."

### Supuestos a la vista, sin especular

Si no sé algo, lo digo y planteo el supuesto con el que sigo. No invento razones posibles para completar.

- No: "No conozco las restricciones del equipo, que en 2002 quizás incluían límites técnicos o de espacio en pantalla, así que no tocaría el límite."
- Sí: "No conozco las restricciones que había en ese momento, en 2002, así que supongamos que el límite de 12 había que mantenerlo."

### Fiel a lo que viví

Cuento mi experiencia como fue, sin generalizarla a "muchos jugadores" ni acomodarla para que cierre un argumento.

- No: "Los juegos de PC vivían en los cibercafés, los cibers, como les decíamos, y ahí fue donde Warcraft III despegó."
- Sí: "Warcraft III lo practicaba en casa y lo jugaba multiplayer en los cibercafés (los cibers, como les decíamos), y ahí fue donde despegó."

### Le hablo al lector, de vos

Las invitaciones van en segunda persona y no se pueden leer de dos maneras.

- No: "Seguí este análisis en la parte 2." Se puede leer como un pedido o como un pasado.
- Sí: "Podés seguir leyendo otro análisis del juego en la parte 2."
- No: "qué enseña sobre la experiencia del jugador"
- Sí: "qué podés mejorar en la experiencia del jugador"

### El vocabulario del oficio

Uso los términos de UX y de desarrollo de juegos como los decimos en el trabajo, aunque vengan del inglés, sin forzar traducciones literales. Y elijo la palabra exacta: la acción del juego, el tipo de juego.

- No: "Usabilidad vs. enganche"
- Sí: "Usabilidad y engagement"
- No: "El ciclo de juego principal era el que ya conocía de AoE: recolectar recursos, construir una base, entrenar un ejército y pelear."
- Sí: "El *core loop* era el que ya conocía de AoE: recolectar recursos, construir una base, entrenar un ejército y atacar."
- No: "Un análisis de UX de juegos". "Juegos" también pueden ser de mesa.
- Sí: "Un análisis de UX de videojuegos"

### Títulos que dicen de qué habla la sección

Un título resume su sección. No repite la consigna del curso ni es una etiqueta genérica.

- No: "El momento"
- Sí: "Tres géneros en un solo juego"
- No: "Lo que me enseñó"
- Sí: "Lo que me enseñó analizar la experiencia del jugador"

## Formato

### La idea de cada párrafo, en negrita

- Una idea corta por párrafo, de 15 palabras o menos, tomada tal cual del texto. La negrita no cambia ninguna palabra.
- Un rótulo al principio del párrafo, como "Mantener:" o "Cambiar:", no cuenta como idea.
- No va en títulos, captions, citas de fuentes, textos de links ni en la lista de fuentes.
- Quedan sin negrita la bio, la pregunta final, el link a otro post y la nota de que las citas son traducciones propias. Un párrafo que solo enumera, como la lista de juegos que jugaba antes de Warcraft III, puede quedar sin negrita si la idea está en el párrafo siguiente.
- Cada traducción lleva negrita en los mismos párrafos. Si en otro idioma la idea pasa de 15 palabras, se reordena la oración.

`tests/key-ideas.test.mjs` chequea todo esto menos qué frase se elige, que valido yo.

### Cursivas

- El término que estoy definiendo: "Eso es *usabilidad*", "Eso es *frustración por diseño*".
- Un término en inglés que todavía no es de uso común en español o en portugués: *core loop*. En inglés va sin cursiva.
- Sin cursiva, los términos que ya usamos todos los días: engagement, feedback, tooltip, onboarding, HUD, multiplayer.
- Los títulos de libros: *Thinking, Fast and Slow*.

### Nombres

- La primera vez, el nombre completo con la sigla: "Age of Empires I y II (AoE)". Después, solo la sigla, sin repetir el nombre completo cerca.
- Edificios y unidades en minúscula cuando son genéricos ("el altar"), y como los muestra el juego cuando son nombres propios ("Altar of Darkness").

## Traducción

Las correcciones las hago primero en español. Cuando apruebo el español, se pasan al inglés, que es el original del sitio y el que va a Medium, y al portugués de Brasil.

- Se traduce la idea, no la palabra: cada idioma usa lo que diría alguien del oficio en ese idioma.
- Mismos párrafos, mismas ideas en negrita y mismos links.
- Un mensaje de interfaz que propongo suena natural en cada idioma.

| | Español (Argentina) | Inglés | Portugués (Brasil) |
| --- | --- | --- | --- |
| El concepto de Hodent | engagement | engageability (su término) | engajamento |
| El ciclo central del juego | *core loop* | core loop | *core loop* |
| El tipo de post | Análisis de UX de videojuegos | Game UX analysis | Análise de UX de games |
| Primera mención | Age of Empires I y II (AoE) | Age of Empires I and II (AoE) | Age of Empires I e II (AoE) |
| Mensaje cuando muere el héroe | "Tu héroe cayó" | "Your hero has fallen" | "Seu herói caiu" |

En portugués, "videogame" suele querer decir la consola, por eso el tipo dice "games". En el texto alcanza con "jogo".

## Antes de dar un borrador por terminado

- [ ] Cada oración suma un dato, algo que viví o una opinión mía. Las que solo adornan, salen.
- [ ] No hay "no era X sino Y", cierres en tríada ni oraciones que repiten la anterior.
- [ ] Lo que no sé está dicho, junto con el supuesto con el que sigo.
- [ ] Las opiniones se presentan como opiniones.
- [ ] Cada título dice de qué habla su sección.
- [ ] Cada párrafo tiene su idea en negrita, con las excepciones de arriba.
- [ ] Términos y nombres siguen la tabla de traducción.

## Cómo se mantiene

Cuando corrijo un texto y la corrección muestra un patrón nuevo, se suma acá: como principio nuevo con su "No" y su "Sí", o como un ejemplo más de un principio que ya existe. Cada principio tiene al menos un "No" y un "Sí"; lo chequea `tests/key-ideas.test.mjs`.
