# Simulador PUR

Aplicación web (PWA) para preparar la **Prueba Única de Residencias Médicas** de Uruguay.
Practicá por área con preguntas reales, corrección comentada y análisis de desempeño.
Funciona sin conexión y se instala en el celular como una app.

---

## Características

- **Banco de 343 preguntas**: 130 reales de la PUR 2025 (con clave oficial) y 213 de práctica, nuevas y validadas, que cubren los 71 temas del temario oficial. Se puede filtrar por tipo (oficiales / práctica / todas).
- **Práctica por área** o examen completo, con cantidad configurable.
- **Dos modos**: Práctica (corrección inmediata con explicación) y Examen (corrección al final).
- **Cronómetro** ascendente, cuenta regresiva a ritmo real (≈1:51 por pregunta) o sin cronómetro.
- **Navegador de preguntas** con estado (respondida / correcta / incorrecta / marcada).
- **Marcar para revisar** preguntas y volver después.
- **Atajos de teclado**: `A`–`D` o `1`–`4` para responder, `←` `→` para navegar, `Enter` siguiente, `F` marcar.
- **Modo oscuro** con detección automática del sistema.
- **Puntaje ponderado** que respeta el valor real de las preguntas de desempate (2–5 puntos).
- **Progreso acumulado** y racha de días, guardados en el dispositivo.
- **Accesibilidad**: correcto/incorrecto se indica con icono además del color; roles ARIA; foco visible.
- **PWA**: instalable y 100 % offline tras la primera carga.

---

## Estructura del proyecto

Estructura plana (todos los archivos en la raíz, ideal para GitHub Pages):

```
simulador-pur/
├── index.html              Shell de la app
├── styles.css              Estilos (tema claro y oscuro)
├── app.js                  Lógica de la aplicación
├── preguntas.json          Base de datos de preguntas
├── manifest.webmanifest    Metadatos PWA
├── sw.js                   Service worker (offline)
├── icon-192.png            Iconos de la app / PWA
├── icon-512.png
├── icon-maskable.png
├── apple-touch-icon.png
├── favicon.png
└── README.md
```

---

## Correr en local

El navegador bloquea `fetch` de archivos vía `file://`, así que hace falta un servidor estático:

```bash
cd simulador-pur
python3 -m http.server 8080
# abrí http://localhost:8080
```

Cualquier alternativa sirve: `npx serve`, `php -S localhost:8080`, etc.

---

## Publicar en GitHub Pages

1. Creá un repositorio y subí el contenido de esta carpeta a la raíz:

   ```bash
   cd simulador-pur
   git init
   git add .
   git commit -m "Simulador PUR"
   git branch -M main
   git remote add origin git@github.com:USUARIO/simulador-pur.git
   git push -u origin main
   ```

2. En el repo: **Settings → Pages → Build and deployment → Source: Deploy from a branch**,
   rama `main`, carpeta `/ (root)`.

3. Quedará publicado en `https://USUARIO.github.io/simulador-pur/`.
   Como GitHub Pages sirve por HTTPS, el service worker y la instalación PWA funcionan sin configuración extra.

> Las rutas del proyecto son **relativas**, así que funciona igual en la raíz del dominio
> o en un subdirectorio (`/simulador-pur/`).

---

## Base de datos de preguntas

Las preguntas viven en `preguntas.json`. Estructura:

```json
{
  "meta": { "titulo": "...", "version": "1.0", "anios": [2025], "total": 130 },
  "preguntas": [
    {
      "id": "2025-001",
      "anio": 2025,
      "n": 1,
      "area": "Pediatría",
      "desempate": false,
      "puntos": 1,
      "caso": "Texto del caso clínico (puede ser vacío).",
      "pregunta": "Enunciado de la pregunta.",
      "opciones": [
        { "l": "a", "t": "Opción A" },
        { "l": "b", "t": "Opción B" },
        { "l": "c", "t": "Opción C" },
        { "l": "d", "t": "Opción D" }
      ],
      "correcta": ["d"],
      "explicacion": "Por qué esa es la respuesta correcta.",
      "claveTipo": "oficial"
    }
  ]
}
```

### Campos

| Campo         | Tipo            | Notas |
|---------------|-----------------|-------|
| `id`          | string          | Único. Convención: `AÑO-NNN`. |
| `anio`        | number          | Año de la prueba. |
| `n`           | number          | Número de pregunta dentro de la prueba. |
| `area`        | string          | Una de las 8 áreas (ver abajo). |
| `desempate`   | boolean         | `true` para las preguntas de desempate. |
| `puntos`      | number          | 1 para preguntas comunes; 2–5 para desempate. |
| `caso`        | string          | Caso clínico compartido; `""` si no hay. |
| `pregunta`    | string          | Enunciado. |
| `opciones`    | array           | 4 objetos `{ l, t }` con letra y texto. |
| `correcta`    | array de string | Una o más letras correctas (admite doble respuesta). |
| `explicacion` | string          | Texto que se muestra al corregir. |
| `claveTipo`   | string          | `oficial`, `revisión` o `sugerida` (origen de la clave). |

Áreas válidas: `Pediatría`, `Cirugía`, `Clínica Médica`, `Ginecotocología`,
`Medicina Familiar y Comunitaria`, `Bioética`, `Psiquiatría`, `Medicina Legal`.

### Agregar más preguntas (p. ej. PUR 2023 / 2024)

Solo hay que **añadir objetos al array `preguntas`** con el mismo formato y actualizar
`meta.anios` y `meta.total`. No hace falta tocar el código. Después de modificar
`preguntas.json`, subí el número de versión del caché en `sw.js` (`pur-sim-v1` → `v2`)
para que los usuarios reciban la actualización.

---

## Notas

- Esta es una herramienta de estudio. No reemplaza la bibliografía oficial de la
  Escuela de Graduados de la Facultad de Medicina (UdelaR).
- El progreso se guarda con `localStorage`; es por dispositivo y navegador.
- Sin dependencias ni build: HTML, CSS y JavaScript puro.
