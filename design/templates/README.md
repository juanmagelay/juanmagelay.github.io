# Portfolio templates

Referencia visual y de estructura para el sitio en Astro y para el design system en Figma. No es código de producción: es el contrato que el código y Figma tienen que respetar.

## Archivos

- `home.html`, `case-study.html`, `article.html`: páginas autocontenidas. El `<style>` de cada una es idéntico a `styles.css`.
- `styles.css`: fuente de verdad de tokens y componentes.

Se pueden guardar en `design/templates/` dentro del repo: no tienen contenido sensible y Astro no publica carpetas fuera de `src/` y `public/`.

## Cómo leerlo

1. `styles.css` sección 1: tokens del design system, tal cual el .md, y el tema oscuro. Sección 2: tokens que agrega el template, aprobados para el código en la #6.
2. Cada clase de componente corresponde a un componente de Astro (tabla abajo).
3. El texto entre corchetes `[así]` se completa con datos reales. No se inventa. Una métrica solo aparece si es real y está autorizada.
4. `.placeholder` existe solo en el template: se reemplaza por `<Image />` de `astro:assets` con el alt real (los alt del artículo ya están en el `aria-label`).
5. Se mantienen los atributos `data-umami-event` del sitio actual. Los `href` son paths de producción (`/`, `/work/...`, `/writing/`, `/games/...`), por eso no navegan entre archivos locales.
6. Fuentes: el sitio las sirve desde su propio dominio, con los archivos oficiales de Google Fonts (subset latin, variables) en `src/assets/fonts/`, configurados en `astro.config.mjs`. Incluye la itálica 400 de Schibsted Grotesk, porque los artículos usan `<em>`. Las páginas de este template usan el link de Google Fonts solo para poder abrirse sueltas.

## Del sitio actual a este sistema

| Sitio actual | Template |
| --- | --- |
| `--font-sans` (Atkinson Hyperlegible Next) | `--font-voice`, `--font-text`, `--font-data` |
| `--color-ink-muted` | `--color-text-secondary` |
| `--color-rule` | `--color-border` |
| `--type-size-lg` | `--type-size-lead` |
| `.article-head` | `.page-head` + `.page-head-with-aside` |
| `.article-meta` | `.spec-list` dentro de `.page-head-text` |
| `.game-sheet` | `.fact-sheet` con `.spec-list-stacked` |
| `figcaption > .figure-caption` | `figcaption` |
| Nav con Contact y CV | Work, Writing, About, Contact y botón de CV separado (`.site-cv`) |

Se mantienen sin cambios de nombre: `--space-N`, `--type-size-display`, `--type-size-sm`, `--layout-prose`, `--layout-figure`, `.skip-link`, `.container`, `.site-header`, `.site-name`, `.site-nav`, `.button`, `.button-quiet`, `.prose`, `.figure`, `.article-credits`, `.contact`, `.copy-email`, `.contact-links`, `.site-footer`, `.site-footer-base`.

## Componentes

| Componente (Figma) | Clase | Variantes | Astro sugerido | Dónde |
| --- | --- | --- | --- | --- |
| Site header | `.site-header` | página actual (`aria-current="page"`), sección actual en sus páginas internas, como un post en Writing (`aria-current="true"`); las dos van subrayadas | `SiteHeader.astro` | todas |
| Button | `.button` | primary, quiet | `Button.astro` | todas |
| Section title | `.section-title` | | estilo de texto | todas |
| Spec list | `.spec-list` | grid, stacked | `SpecList.astro` | hero, encabezados, resumen, fact sheet |
| Tag | `.tag` | | `Tag.astro` | tarjetas, encabezado de caso |
| Copy email | `.copy-email` | | `CopyEmail.astro` | hero, footer |
| Case card | `.case-card` | default, featured | `CaseCard.astro` | home, siguiente caso |
| Row | `.row` | con link, sin link, con descripción, con miniatura (`.row-with-image`) | `RowList.astro` | home, writing |
| Page head | `.page-head` | con aside, sin aside | `PageHead.astro` | caso, artículo |
| Fact sheet | `.fact-sheet` | | `FactSheet.astro` | artículos de juegos |
| Case summary | `.case-summary` | con o sin link al repo | `CaseSummary.astro` | caso |
| Table of contents | `.toc` | | `Toc.astro` | caso, desde 1024px |
| Split | `.split` | | markup en MDX | caso |
| Decision | `.decision` | | `Decision.astro` | caso |
| AI log | `.ai-log` | | `AiLog.astro` | caso |
| Figure | `.figure` | ancho con `--figure-width` | `Figure.astro` (ya existe) | caso, artículo |
| Contact footer | `.site-footer` | | `SiteFooter.astro` | todas |

Hechos en la #6: Site header, Button, Section title, Spec list, Copy email, Page head, Fact sheet, Figure y Contact footer. En la #10: Row. El resto se crea cuando una página lo necesite.

Writing (decidido en la #10): la sección reúne todos los posts, de juegos y de otros temas, del más nuevo al más antiguo. Cada fila lleva una miniatura 3:2 a la izquierda, al ancho del rail (12rem), y arriba a todo el ancho por debajo de 40rem. La miniatura es siempre la primera imagen del post, con su mismo alt: no se elige a mano (`src/lib/first-figure.mjs`). Los posts conservan su URL en `/games/...` y `/games/` redirige a `/writing/`.

Artículos (decidido en la #6): cada bloque tiene el mismo espacio a ambos lados. El encabezado va al ancho del contenedor, igual que el header del sitio: el título en el borde izquierdo y, desde 56rem, la ficha del juego en el borde derecho. El cuerpo va en una columna central (`.container-reading`) donde cada bloque se centra: el texto a 42rem y las figuras hasta 52rem.

## Tokens que agrega el template (aprobados en la #6; Figma se alinea a estos)

- Radio en tres niveles: `--radius-card` 14 (sistema), `--radius-control` 8 para botones, `--radius-media` 4 para imágenes y `kbd`. Más `--radius-pill` para tags.
- Escala tipográfica dentro de los rangos del .md: display 40 a 68, title 36 a 56, h2 26 a 32, h3 21, card 24, row 20, lead 17 a 19, base 16, sm 15, meta 13, tag 12.5.
- Interlineado: display 1.04, headings 1.15, body 1.5.
- Espaciado en base 4 con los nombres del sitio actual, más `--space-22` (88) para el hero.
- Layout: prose 42rem, figure 52rem, rail 12rem, gutter fluido de 20 a 40.
- Foco: 2px en acento con 3px de offset.

## Reglas del .md que aplica el template

- Bajada en acento. Links en ink con hover en acento. Viñetas en acento.
- JetBrains Mono solo en metadatos: etiquetas, tags, títulos de sección, email, pie.
- Divisorias de 1px. Header y footer a todo el ancho; las secciones, al ancho del contenido.
- Sin sombras, gradientes ni emojis. Los placeholders son líneas de 1px.
- Tamaño táctil mínimo de 44px.
- Tema claro u oscuro según el sistema operativo del visitante (`prefers-color-scheme`), sin toggle. Los componentes usan siempre `--color-ink`, `--color-text-secondary`, `--color-accent`, `--color-border` y `--color-paper`; en oscuro toman los valores de los tokens `*-on-dark` del .md. No hace falta escribir estilos oscuros por componente.

## Para Figma

- Variables: una colección Primitives con los 11 colores del .md y una colección Theme con los 5 tokens de uso (ink, text-secondary, accent, border, paper) en dos modos, Light y Dark, que apuntan a los primitivos. Más Space, Radius y Type size.
- Cada pantalla se revisa en los dos modos antes de pasarla a código.
- Estilos de texto: Display, Title, H2, H3, Card title, Row title, Lead, Body, Body small, Meta, Section title, Tag.
- Breakpoints del CSS: 640, 768, 832, 896 y 1024. Frames de referencia: 1440 y 390.

## Prompt sugerido para Claude Code

> Leé `design/templates/README.md`, `styles.css` y las tres páginas. Proponé un plan antes de tocar código: qué tokens cambian en el CSS global, qué componentes de Astro se modifican y cuáles se crean, siguiendo la tabla "Del sitio actual a este sistema". No implementes hasta que lo apruebe. No inventes contenido: lo que está entre corchetes queda como TODO.
