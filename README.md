# LightMagedon — sitio de descarga del modpack

Sitio estático (HTML + CSS + JS sin dependencias) para publicar en **GitHub Pages**.
Sirve como "host" del `.zip` del modpack: muestra el archivo, sus metadatos y
descargarlo con barra de progreso real.

- **Versión del juego:** Minecraft Java Edition **1.19.2** (Fabric)
- **Tema:** servidor de Minecraft inspirado en el cielo

---

## Estructura

```
lightmagedon/
├─ index.html                     # toda la estructura y el texto
├─ .nojekyll                      # evita que Jekyll procese el repo
├─ assets/
│  ├─ css/styles.css              # estilos, animaciones, responsive
│  ├─ js/main.js                  # CONFIG + toda la lógica
│  └─ img/
│     ├─ fondo.jpg                # fondo del cielo
│     ├─ logo-outline.png         # logo con contorno (el que se ve en el hero)
│     ├─ logo.png                 # logo limpio, sin contorno
│     └─ logo-mark.png            # 192px para navbar y favicon
└─ modpack/
   └─ LightMagedon-Modpack-v1.0.0.zip   ← PLACEHOLDER, cámbialo por el real
```

---

## Publicar en GitHub Pages

1. Crea un repo (puede ser privado con el plan Pro, o público con Pages gratis).
2. Sube esta carpeta tal cual, en la **raíz** del repo.
3. En el repo: **Settings → Pages → Build and deployment**
   - Source: **Deploy from a branch**
   - Branch: `main` / root (`/ (root)`)
4. Espera 1–2 minutos. Quedará en `https://<usuario>.github.io/<repo>/`.

El `.nojekyll` ya está incluido, así que los archivos con guion bajo
(`__test-mobile.html` y similares) no se filtrarán.

### Rutas relativas

Todo usa rutas relativas (`./assets/...`), por lo que el sitio funciona igual en
`usuario.github.io/repo/` que si se publica en la raíz de un dominio propio.

---

## Cambiar el contenido

Casi todo lo editable está al principio de `assets/js/main.js`, en el objeto
`CONFIG`:

```js
var CONFIG = {
  file: './modpack/LightMagedon-Modpack-v1.0.0.zip',  // ruta del .zip
  fileName: 'LightMagedon-Modpack-v1.0.0.zip',         // nombre que se descarga
  serverIp: 'play.lightmagedon.net',                  // IP del servidor
  streaming: true,          // barra de progreso real
  streamLimitMB: 80,        // por encima de esto, descarga directa
  mods: [ /* la lista de la sección "Mods" */ ]
};
```

El **tamaño real del archivo se lee solo** con una petición `HEAD`, así que no
hay que actualizarlo a mano.

### Textos de la página

Están directamente en `index.html`: título, descripción, IP, textos de las
secciones y del FAQ. Busca y reemplaza `LightMagedon` o `1.19.2` según
necesites.

---

## ⚠️ IMPORTANTE: el logo

Los PNG se generaron a partir de `Descargas/Logo.jpe`, que **tenía el fondo
negro quemado** (es un JPEG, no admite transparencia). El script recreó el canal
alpha y le añadió un contorno azul oscuro para que el logo resalte sobre el cielo
claro.

**Si el logo que usaste decía otro nombre**, reemplaza estos archivos y listo:

| Archivo | Para qué sirve | Tamaño recomendado |
|---|---|---|
| `logo-outline.png` | hero, versionado con `logo.png` | 1000×1000 px |
| `logo.png` | logo sin contorno | 1000×1000 px |
| `logo-mark.png` | navbar y favicon | 192×192 px |

Idealmente deben ser **PNG con transparencia**. Si tienes el logo original con
alpha, úsalo tal cual.

---

## ⚠️ IMPORTANTE: el `.zip` es un placeholder

`modpack/LightMagedon-Modpack-v1.0.0.zip` (17 MB) es un **archivo de prueba**.
No contiene mods reales: es una estructura vacía con `mods/`, `config/`,
`shaderpacks/`, etc., y dentro un README que lo dice claramente.

Para publicarlo de verdad:

1. Pon tu `.zip` real en `modpack/`.
2. Actualiza `file` y `fileName` en `CONFIG`.
3. Si lo nombras distinto, no olvides actualizar también el `<h3 id="fileName">`
   y el `<title>`/`<meta description>` de `index.html`.
4. Revisa que el peso y el nº de mods que salen en los chips cuadren.

### Límite de tamaño de GitHub

GitHub **bloquea archivos de más de 100 MB** en el repositorio (avisa a partir de
50 MB) y la descarga por `fetch` acumularía el archivo entero en memoria del
navegador. Por eso:

- Si tu pack **supera los 80 MB**, deja que el sitio use la descarga directa
  (el navegador lo escribe a disco en streaming, sin barra de progreso).
  Puedes ajustar el umbral en `streamLimitMB`.
- Si **supera los 100 MB**, GitHub no lo aceptará en el repo. Opciones:
  subirlo a **GitHub Releases** y poner la URL en `CONFIG.file`, o alojarlo en
  otro sitio (Mega, MediaFire, CurseForge, un bucket S3…).

---

## Cómo funcionan las animaciones

Todo el movimiento usa únicamente `transform` y `opacity`, así que va por la
GPU y no provoca layout.

| Dónde | Qué hace |
|---|---|
| Fondo | Parallax suave según el scroll + efecto Ken Burns muy lento |
| Nubes | Dos capas con desplazamiento infinito a velocidades distintas |
| Rayos de sol | Cono de gradiente rotando muy lentamente |
| Partículas | Canvas con cuadrados a la deriva; se pausa si la pestaña oculta |
| Logo | Flotación vertical + halo que respira |
| Secciones | Entrada escalonada al hacer scroll (`IntersectionObserver`) |
| Botones | Efecto magnético, barrido de luz, sombra 3D estilo Minecraft |
| Descarga | Barra con progreso, velocidad y tiempo restante reales |

Todo se desactiva solo con **`prefers-reduced-motion`** activado en el sistema.

---

## Accesibilidad y SEO

Auditado con Lighthouse: **100 / 100 / 100** (accesibilidad, buenas prácticas, SEO).

- Navegación por teclado y `skip-link` al contenido.
- El acordeón usa `<details>` nativo.
- Etiquetas y `aria-*` en los controles.
- `<title>`, `<meta description>`, Open Graph y datos estructurados implícitos.
- Modo `prefers-contrast: more` y hoja de impresión incluidas.

---

## Probarlo en local

GitHub Pages es estático, así que cualquier servidor sirve:

```bash
# con Python
python -m http.server 8000

# o con Node
npx serve .
```

Luego abre `http://localhost:8000`.

> Nota: el portapapeles moderno (`navigator.clipboard`) exige HTTPS o
> `localhost`. En otros casos el sitio cae automáticamente al método clásico,
> así que "Copiar enlace" y "Copiar IP" funcionan igual.

---

## Créditos

No afiliado a Mojang ni a Microsoft. Minecraft® es una marca de Mojang AB.
Los fondos y logos usados pertenecen a sus respectivos autores.
