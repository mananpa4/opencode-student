# Integraciones funcionales para OpenCode Student

Análisis de lo que se puede **cablear de verdad** desde `Neuron-AI`, `H:\` (NeuralForge y
compañía) y `CompactFiles`, descartando lo que solo sería decorativo.

Criterio de admisión: la pieza tiene que enchufarse a un punto de extensión que ya existe
(provider, tool, RPC de escritorio, skill) o a uno pequeño y aislado. Si para integrarla hay
que reescribir un paquete, no entra.

---

## Resumen priorizado

| # | Integración | Origen | Punto de enchufe | Esfuerzo | Valor | Estado |
|---|---|---|---|---|---|---|
| 1 | Puter como proveedor de modelos | `Neuron-AI` | Puente local OpenAI-compatible + `provider` | M | Alto | Implementado |
| 2 | Puter `txt2img` como proveedor de imagen | `Neuron-AI` | Provider de imagen | S | Medio | Endpoint listo, falta el provider de imagen |
| 3 | OCR de captura de pantalla | `NeuralForge` + `Neuron-AI` | RPC `AppCaptureScreen` + tool | M | Alto | Pendiente |
| 4 | Búsqueda semántica local | `NeuralForge` | Tool + tabla SQLite | M | Alto | Pendiente |
| 5 | Wikipedia offline (ZIM) | `H:\wikipedia_zim` | Tool `wikipedia.*` | M | Alto | Pendiente (bloqueado por libzim) |
| 6 | Sanitización anti-inyección en web | `Neuron-AI` + `Scrap-Crawl` | Boundary de `webfetch` | S | Alto | Implementado |
| 7 | Enmascaramiento de red | `Scrap-Crawl` | Identidad de navegador en `webfetch` | S | Alto | Implementado |
| 8 | Proxy privado por proveedor | `Neuron-AI` | `fetch` custom del provider | S | Medio | Pendiente |
| 9 | Skill `minimax-docx` | `H:\.minimax\skills` | `.opencode/skills/` | S | Medio | Pendiente |
| 10 | ToolSearch por intención | `Neuron-AI` | Registry de tools | S | Bajo | Pendiente |
| 11 | Configuración y base de datos propias | OpenCode instalado | `OPENCODE_CONFIG_DIR` + `OPENCODE_DB` + siembra | M | Alto | Implementado |

---

## 1. Puter como proveedor de modelos

**Qué es.** Puter.js expone inferencia gratis desde el navegador, autenticando con una sesión
web en vez de una API key. `Neuron-AI` ya lo resolvió: una `BrowserWindow` oculta con partición
persistente ejecuta `puter.ai.chat(...)` y devuelve el texto al proceso principal.

**Dónde está en tu repo**

- `Neuron-AI/electron/main.cjs` → `createPuterBridge()` (ventana oculta, `persist:neuron-puter`),
  `runPrivatePuterChat()`, `runPuterScript()`.
- `Neuron-AI/public/assets/puter-bridge.html` → `neuronWaitForPuter()`, `neuronAutologin()`,
  `neuronTextFromResponse()`, `neuronImageToSource()`.
- `Neuron-AI/src/core/models.js` → catálogo de modelos y alias.

**Por qué no se puede copiar tal cual.** El bridge devuelve texto por `executeJavaScript`. Eso
sirve para un chat propio, no para OpenCode, que habla con proveedores por HTTP/SSE a través de
`packages/ai`. Copiar el bridge dejaría a Puter fuera del pipeline de modelos, herramientas,
streaming y contabilidad de tokens.

**Cómo quedó cableado.** Un puente local que habla el protocolo que OpenCode ya entiende:

1. `packages/desktop/src/main/puter/bridge.ts`
   - `node:http` en `127.0.0.1:0` (puerto efímero), token aleatorio por arranque. No usa
     `Bun.serve`: el main de Electron es Node.
   - `GET /v1/models` → catálogo de Puter, o el catálogo de reserva mientras no hay sesión.
   - `POST /v1/chat/completions` → SSE (`data: {...}` + `data: [DONE]`) o respuesta completa.
   - `POST /v1/images/generations` → `puter.ai.txt2img()` como data URL.
   - `POST /internal/stream/<id>` → canal por el que la página empuja los deltas del stream.
2. `packages/desktop/src/main/puter/page.ts`
   - HTML servido en `http://127.0.0.1:<puerto>/` porque `signIn()` exige un origen http(s) y un
     gesto del usuario; en `file://` falla.
   - El SDK (`resources/puter/js.puter.js`, copia local sin CDN) se sirve en `/puter.js`.
   - `window.ocPuter` expone `status`, `signIn`, `models`, `chat` (con streaming) e `image`.
   - Ventana con `partition: "persist:opencode-student-puter"`, `sandbox: true`,
     `contextIsolation: true`, `nodeIntegration: false`. La página no necesita `window.puter`
     del preload: el SDK crea su propio `globalThis.puter`.
3. `packages/desktop/src/main/puter/config.ts`
   - `studentConfigDir()` = `app.getPath("userData")/config`; Student solo lee y escribe ahí.
     La config de OpenCode no se lee ni se copia: son perfiles distintos (ver sección 11).
   - `providers.puter` se reescribe en cada arranque porque el puerto y el token cambian; el
     `provider.puter` legado de la versión V1 se migra en el mismo archivo.
   - Escritura atómica (`write` + `rename`) y nunca se sobrescribe un config que no se puede
     parsear.
4. `packages/desktop/src/main/service/background-service.ts` arranca el puente y fija
   `OPENCODE_CONFIG_DIR`, `XDG_DATA_HOME`, `XDG_CACHE_HOME` y `OPENCODE_DB` **antes** de
   `client.Service.ensure`, para que el sidecar lea la config y la BD de Student.

La config generada usa las claves reales del esquema (`package`, `settings`), no las de V1:

```jsonc
{
  "providers": {
    "puter": {
      "name": "Puter",
      "package": "@ai-sdk/openai-compatible",
      "settings": { "baseURL": "http://127.0.0.1:<puerto>/v1", "apiKey": "<token>" },
      "models": { "gpt-5-nano": { "name": "GPT-5 nano" } }
    }
  }
}
```

`packages/ai/src/providers/openai-compatible.ts` y el catálogo ya aceptan `settings.baseURL` /
`settings.apiKey` por provider, así que agentes, tools, permisos y coste funcionan sin cambios.

**Detalles que hay que respetar**

- **No hardcodear la lista de modelos.** `resources/puter/catalogue.ts` solo es la lista de
  reserva para que el selector ofrezca Puter antes del primer login; con sesión manda
  `puter.ai.listModels()`.
- **Autenticación bajo demanda.** `ensureSignedIn()` solo se llama desde
  `/v1/chat/completions` y `/v1/images/generations`, y solo muestra la ventana si no hay sesión.
  `/v1/models` nunca abre nada. La partición persistente evita el login repetido.
- **Streaming.** `puter.ai.chat(..., { stream: true })` devuelve un async iterable; cada parte se
  reemite como delta SSE y se cierra con `[DONE]`.
- **Riesgos.** ToS de Puter para uso automatizado, rate limits por sesión y caducidad de la
  sesión. El proveedor normal sigue disponible como fallback.

---

## 2. Puter `txt2img` como proveedor de imagen

`runPrivatePuterImage()` en `main.cjs` ya resuelve prompt → imagen → data URL. En Student vive en
`POST /v1/images/generations` del mismo puente del punto 1: `puter.ai.txt2img()` devuelve un
`Image` cuyo `src` es un data URL, y el puente lo entrega como `{ data: [{ url }] }`.

OpenCode ya tiene providers de imagen (`black-forest-labs.ts`, `fal.ts`, `replicate.ts`,
`stability.ts`, `runway.ts`). El endpoint está listo, pero el provider de imagen de Puter todavía
no se registra: hoy el chat funciona y la generación de imágenes queda como siguiente paso.

Valor real: generar ilustraciones dentro del chat sin API key, útil para el flujo de documentos
y slides que ya existe en la app.

---

## 3. OCR de captura de pantalla

**Origen.** `H:\NeuralForge\services\ocr\ocr-service.ts` (servicio Express que lanza un binario
externo) y `Neuron-AI/electron/main.cjs` → `neuron:screenshot` (`captureWindow()`).

**Qué se reutiliza y qué no.** El servicio de NeuralForge no es portable (spawn de EasyOCR).
Lo que sí vale es el flujo: capturar → reconocer → adjuntar. En Electron se hace con
`desktopCapturer` + un OCR embebido (`tesseract.js`, WASM, sin binarios externos).

**Cableado**

- `packages/desktop/src/main/ipc-handlers/app.ts`: RPC `AppCaptureScreen` → devuelve PNG en base64.
- `packages/core/src/tool/screen.ts`: tool `screen.read` que acepta `{ region?: "window" | "screen" }`
  y devuelve texto + la imagen como adjunto.
- Permiso propio (`permission.screen`) para que no capture sin aprobación.

Valor real: "mira este error en pantalla y arréglalo" sin guardar un archivo antes.

---

## 4. Búsqueda semántica local

**Origen.** `H:\NeuralForge\services\embeddings\embeddings-service.ts`. Ojo: el "FAISS" del
repo es un `Map` en memoria con coseno en JS; el `faiss-node`/`hnswlib-node` del `package.json`
no se usa. Sirve como diseño, no como implementación.

**Implementación real.** `@huggingface/transformers` con un MiniLM de 384 dimensiones corriendo
en el proceso (Bun lo soporta), vectores guardados como `BLOB` en la SQLite que ya existe, y
coseno calculado en el mismo proceso. Sin servicio HTTP ni índice externo: con decenas de miles
de fragmentos alcanza de sobra.

**Cableado**

- `packages/core/src/search/semantic.ts`: `index(sessionID, text)` y `query(text, k)`.
- Tabla nueva en la migración de `packages/core/src/database` (`session_embedding(session_id,
  part_id, vector BLOB, text)`).
- Tool `session.search` y un panel de resultados en la app.
- Indexado incremental desde el proyector de eventos, no en un job aparte.

Valor real: hoy OpenCode busca por texto; no puede responder "¿en qué sesión resolví el bug de
caché del cliente HTTP?".

---

## 5. Wikipedia offline (ZIM)

**Lo que ya tienes en disco** (`H:\wikipedia_zim`):

| Archivo | Tamaño |
|---|---|
| `wikipedia_en_all_maxi_2026-02.zim` | ~115 GB |
| `wikipedia_es_all_maxi_2026-02.zim` | ~38 GB |
| `wikipedia_es_all_mini_2026-02.zim` | ~3.2 GB |

**Hallazgo verificado en esta máquina.** `zim-tools 3.6.0` (libzim 9.3.0) **falla** al abrir los
archivos 2026-02: `zimdump info` y `zimdump show` terminan con `0xC0000005` (violación de
acceso), aunque `zimdump --version` funciona. `zimsearch` también crashea. Es decir: los
binarios que están en `H:\` no sirven para estos ZIM, hace falta un libzim más nuevo.

**Ruta viable.** `libzim.wasm` de kiwix-js (libzim reciente compilado a WASM) cargado en el
proceso principal; lee el ZIM por rangos del archivo, sin descomprimir los 115 GB.

**Cableado.** Tool `wikipedia.search` / `wikipedia.read` en `packages/core/src/tool`, con la
ruta del ZIM y el idioma en la config de Student. Devuelve extractos en markdown con la URL
`kiwix://` del artículo.

Valor real: investigación sin red y sin coste, sobre 150 GB que ya están descargados.

---

## 6. Sanitización anti-inyección para contenido web

**Origen.** `Neuron-AI/src/core/sanitize.js` y, sobre todo, el módulo `@aio/security` de
`Scrap-Crawl` (`sanitizeText`). Elimina caracteres invisibles (`U+200B–U+200F`, `U+202A–U+202E`,
`U+2060–U+2064`, `U+FEFF`) y neutraliza patrones de secuestro de instrucciones ("ignore previous
instructions", `<system>`, `system prompt:`, "execute shell command", marcadores `!!`).

**Implementado.** `packages/core/src/network/sanitize.ts` expone `sanitizeWebContent()` con el
mismo criterio: devuelve `{ clean, flagged, events }`, y si el texto superviviente es menos del
20 % del original el resultado se descarta entero en vez de recortarse.

Se aplica en los dos puntos donde texto de terceros entra al contexto:

- `packages/core/src/tool/plugin/webfetch.ts`: sanea el documento convertido, falla con un error
  explícito si `flagged`, y publica `metadata.sanitized` con los eventos aplicados.
- `packages/core/src/tool/plugin/websearch.ts`: sanea el `content` de cada resultado antes de
  construir el markdown.

Valor real: es una defensa concreta contra prompt injection desde páginas web, y cuesta una
función pura sin dependencias.

---

## 7. Enmascaramiento de red

**Origen.** El `UA_POOL` y la capa anti-bot de `Scrap-Crawl` (`apps/tunnel/src/index.ts`).

**Implementado.** `packages/core/src/network/identity.ts`:

- `browserProfile()` elige uno de cuatro perfiles de navegador de escritorio (Chrome en Windows,
  Firefox en Windows, Safari en macOS, Chrome en Linux) al azar por petición.
- `browserHeaders(accept, profile)` envía las cabeceras que ese navegador enviaría: `Accept`,
  `Accept-Language`, `Accept-Encoding`, `Cache-Control`, `Pragma`, `Sec-Fetch-Dest/Mode/Site/User`,
  `Upgrade-Insecure-Requests` y, solo en perfiles Chromium, los client hints `sec-ch-ua*`
  coherentes con su User-Agent.

`webfetch` lo usa en cada petición y, ante un challenge de Cloudflare, reintenta con un perfil
nuevo. `websearch` sanea los snippets con el punto 6.

**Límite explícito.** No se lee ni se deriva identidad de la máquina: ni hostname, ni MAC, ni
número de serie, ni RAM, ni HWID. El perfil se elige al azar y no contiene nada del equipo que
hace la petición. Tampoco hay un proxy propio: el tráfico sigue saliendo por la conexión del
usuario, solo con una identidad de navegador en vez de una firma de CLI.

---

## 8. Proxy privado por proveedor

**Origen.** `Neuron-AI/electron/main.cjs` → `applyPrivateProxy()`: si existe
`127.0.0.1:18000` o `NEURON_PRIVATE_PROXY`, la sesión del bridge sale por ahí (setup tipo
MasterDnsVPN).

**Cableado.** `packages/ai` ya acepta un `fetch` por provider en los tests
(`model(..., { fetch: customFetch })`). Basta exponer `provider.<id>.options.proxy` y construir
el `fetch` con el dispatcher del proxy.

Valor real: aislar el tráfico de un proveedor sin afectar al resto de la app.

---

## 9. Skill `minimax-docx`

**Origen.** `H:\.minimax\skills\minimax-docx`. Trae la enciclopedia OpenXML, guías de tipografía
CJK, `track_changes`, plantillas universitarias y scripts .NET de análisis/validación.

**Cableado.** Copiar a `.opencode/skills/minimax-docx` (el repo ya usa ese directorio). No hace
falta tocar código: el cargador de skills lo levanta.

Valor real: generar y editar `.docx` de verdad (no markdown disfrazado) desde el chat.

---

## 10. ToolSearch por intención

**Origen.** `Neuron-AI/src/core/tool-search.js` + `tool-catalog.js`: puntuación por tokens sobre
nombre, descripción y keywords.

**Estado en OpenCode Student.** Ya hay `skill` + registry de tools, y el modelo ve las
descripciones. Solo valdría la pena si el catálogo crece hasta el punto de que no quepa en el
prompt. Baja prioridad; si se hace, reutilizar el mismo scorer sobre el registry en vez de
mantener un catálogo paralelo.

---

## 11. Configuración, base de datos y registro propios

**Qué problema resuelve.** Student no escribe nada en la instalación de OpenCode, y tampoco lee su
perfil: ni su usuario, ni sus API keys, ni sus proveedores, ni suscripciones. Student es un agente
distinto y configura todo eso por su cuenta.

**Configuración.** Student escribe y lee en `%APPDATA%\ai.opencode.desktop.dev\config`
(`OPENCODE_CONFIG_DIR`). `~/.config/opencode` no se abre, no se hereda y no se copia.

| Prioridad | Fuente | Quién escribe |
|---|---|---|
| 1 (menor) | global `OPENCODE_CONFIG_DIR` | Student (`Config.update`, Puter) |
| 2 | explícita `OPENCODE_CONFIG` | usuario |
| 3 | directa (`--config`) | usuario |
| 4 | proyecto | repo |
| 5 | contenido (`OPENCODE_CONFIG_CONTENT`) | runtime |
| 6 (mayor) | gestionada (sistema/MDM) | administrador |

**Identidad: usuario, API keys y suscripciones.** Las credenciales viven en la tabla `credential`
de la propia BD de Student (la migración `import_legacy_credentials` las importa desde
`global.data/auth.json`, que apunta al data root de Student, no al de OpenCode). El siembra/import
nunca fusiona `account`, `account_state`, `control_account` ni `credential`: el usuario, los proveedores
y cualquier suscripción de OpenCode no pasan a Student. Si Student debe usar una API key, se añade
aquí (o vía el proveedor Puter integrado).

**Base de datos.** Student abre `%APPDATA%\...\data\opencode.db` (`OPENCODE_DB`). En el primer
arranque, y solo si la BD instalada existe, llama a `POST /api/experimental/database/import`
(merge `INSERT OR IGNORE`, origen abierto en solo lectura) **antes** de entregar credenciales al
renderer, para que la primera lista de sesiones ya incluya lo importado. El merge solo lleva
sesiones, proyectos, mensajes y permisos; las tablas de identidad se omiten. El marcador
`studentDatabaseSeeded` evita repetirlo; si el import falla, se reintenta en el siguiente arranque.

**Registro y estado.** Student usa su propio registro de servicio
(`%APPDATA%\ai.opencode.desktop.dev\opencode\service-local.json` en dev,
`service.json` en empaquetado) y sus propios locks. El registro se pasa explícito a
`Service.ensure`/`Service.discover` y al hijo se le inyecta `XDG_STATE_HOME = userData` mediante
`env`, porque el desktop borra un `XDG_STATE_HOME` heredado en Windows. Por eso Student nunca
adopta ni reemplaza el servicio de OpenCode: cada app corre su propio `serve`.

**Datos y caché propios.** `XDG_DATA_HOME` y `XDG_CACHE_HOME` se fijan bajo `userData`
(`data-root`, `cache`), así que los logs, `repos`, `snapshot`, `shell`, `mcp-auth.json` y el
catálogo viven de OpenCode no se mezclan ni se tocan. `installedDatabaseFile()` se resuelve desde
`app.getPath("home")` explícito, no desde `XDG_DATA_HOME`, para que la siembra lea la BD instalada
sin apuntar a la de Student.

**Archivos.** `packages/desktop/src/main/service/student-paths.ts`, `seed-database.ts`,
`background-service.ts`, `packages/desktop/src/main/puter/config.ts`,
`packages/core/src/database/transfer.ts` (excluye tablas de identidad),
`packages/core/src/config.ts`, `packages/core/src/config/discovery.ts`,
`packages/core/src/config/watch.ts`, `packages/server/src/options.ts` y
`packages/cli/src/server-process.ts`.

---

## Descartado a propósito

- **`H:\CHISMY\sngine-the-ultimate-social-network-platform`** y **`H:\Hosting\*.zip`**: son
  backups de sitios (Sngine, WordPress). No hay nada que conectar a un cliente de escritorio.
- **`H:\logos`, `H:\Interfaz`**: imágenes sueltas.
- **`H:\wikipedia_zim` (APKs, ISOs)**: contenido ajeno al producto.
- **`Neuron-AI/src/core/opencode.js`**: no integra OpenCode, solo genera texto describiendo su
  repo local. No aporta.

---

## Transparencia real de ventana (CompactFiles)

`CompactFiles` no dibuja transparencia con CSS: usa el material nativo del sistema.

```xml
<!-- CompactFiles/MainWindow.xaml -->
WindowBackdropType="Acrylic"
```

```xml
<!-- CompactFiles/Application.xaml -->
<system:Double x:Key="RootBackgroundOpacity">1.0</system:Double>
```

Es decir: el sistema compone el fondo detrás de la ventana (Mica/Acrylic) y la app solo pinta
encima con opacidad controlada. Eso es lo que hace que se vea el escritorio de Windows.

**Equivalente en Electron**

| Plataforma | Opción | Disponibilidad |
|---|---|---|
| Windows 11 22H2+ | `backgroundMaterial: "acrylic"` | DWM compone el material |
| Windows 10 | `transparent: true` + `backgroundColor: "#00000000"` | alfa por píxel |
| macOS | `vibrancy: "under-window"` + `visualEffectState: "active"` | `NSVisualEffectView` |

**Esta máquina es Windows 10 (build 19044)**, así que `backgroundMaterial` no aplica: la ruta
real aquí es `transparent: true`. Eso obliga a que `html`, `body` y `#root` no pinten un fondo
opaco, y a que las superficies de cristal mantengan alfa > 0 para que los clics no atraviesen la
ventana.

El modo viaja al renderer en el bootstrap de la ventana (`transparency: "alpha" | "system-backdrop" | "off"`)
y el preload lo escribe como `data-window-transparency` antes del primer paint, así que el CSS
puede distinguirlos:

| Modo | Quién compone el fondo | Qué hace el CSS |
|---|---|---|
| `system-backdrop` | DWM (Mica/Acrylic) | tokens normales de cristal |
| `alpha` | la propia ventana, sin blur | suelo esmerilado + texto de alto contraste |

En `alpha` no hay blur del escritorio: lo que esté detrás de la ventana se dibuja nítido. Por eso
el suelo sube a `rgba(255,255,255,0.68)` (claro) / `rgba(8,8,14,0.6)` (oscuro) en vez de un tinte
fino: por debajo de media opacidad el texto de la ventana de atrás se lee a través del sidebar.

Para la legibilidad se usa el halo de **7.css** (`github.com/khang-nd/7.css`), que repite la misma
sombra en vez de ensanchar un blur, de modo que las capas se apilan en un anillo opaco alrededor
de cada glifo: `--glass-glow-aero` (8 × `0 0 10px`) en la barra de título, `--glass-glow`
(3 × 5px + 1px) en las superficies y `--glass-glow-soft` (2 × 3px + 1px) en `body` y controles.
Los controles de formulario de Chromium no heredan `text-shadow`, así que se declara aparte.

Queda implementado en `packages/desktop/src/main/windows/transparency.ts`,
`packages/desktop/src/main/windows/bootstrap.ts`, `packages/app/public/oc-theme-preload.js` y
`packages/ui/src/styles/glass.css` + `glass-tokens.css`.
