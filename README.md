# caich

App web de tracking fitness con IA: registro de entrenos, comida y medidas corporales, con gráficos de evolución e insights basados en el propio histórico.

**Estado:** Fases 1 y 1.5 completas salvo el dictado por voz. Fase 2 construida.

| Área | Estado |
|------|--------|
| Login, RLS, historial, exportación | Funcionando |
| Biblioteca de comidas (§6.1, §6.2) | Construido, **requiere aplicar la migración 0005** |
| Plan de dieta semanal, ahora opcional (§6.4) | Funcionando |
| Rutinas y entreno en vivo 1:1 con Hevy (§5) | Construido, **requiere aplicar la migración 0004** |
| Chat de texto libre + parseo a datos (§3, §7) | Funcionando |
| Objetivos y gráficos de evolución | Funcionando |
| Insights de nivel 1 — estadísticas puras (§11.1) | Funcionando |
| Base curada de principios | **Retirada** el 16/08/2026 (§11.6) — ver más abajo |
| Insights de nivel 2 y 3 (§11.2, §11.3, §11.4) | Construido, sin verificar en uso real |
| Dictado por voz (§3.4) | Pendiente |
| Resúmenes automáticos periódicos (§11.5) | Pendiente |
| Capa MCP (§12) | Pendiente |

## Documentación

- **[ESPECIFICACION.md](ESPECIFICACION.md)** — especificación funcional completa (v2.0). Incluye el registro de decisiones de diseño con sus motivos (anexo B).

## Puesta en marcha

### 1. Crear el proyecto de Supabase

En [supabase.com](https://supabase.com), crear un proyecto nuevo. **Elegir región europea** (ej. Frankfurt): son datos de salud, y aunque en v1 con un solo usuario el RGPD no aplica (§14.2), la región no se puede cambiar después sin migrar la base de datos entera.

### 2. Aplicar las migraciones

En el panel de Supabase → **SQL Editor**, ejecutar en orden:

1. `supabase/migrations/0001_esquema_inicial.sql` — tablas, RLS y políticas
2. `supabase/migrations/0002_semilla_catalogo.sql` — 15 ejercicios iniciales
3. `supabase/migrations/0003_principios_base.sql` — base de principios, **ya no se usa** (§11.6)
4. `supabase/migrations/0004_series_de_rutina.sql` — series como filas (§5.1, §5.2)
5. `supabase/migrations/0005_biblioteca_de_comidas.sql` — biblioteca de comidas (§6.1)

> **La 0003 quedó obsoleta.** La base de principios se retiró el 16 de agosto de 2026
> (§11.6): 18 principios redactados por la IA, ninguno aprobado, y mientras tanto la
> puerta impedía emitir cualquier insight de nivel 2. La tabla `principio_base` no se
> borra —dejar de usarla es reversible, tirarla no— pero nada la lee. La migración se
> mantiene en el repositorio como historia; aplicarla en una instalación nueva no hace
> daño y tampoco sirve para nada.

> **La 0004 está sin aplicar.** Es obligatoria para `/rutinas` y `/entreno`: crea
> `plantilla_serie`, añade columnas a las tablas de sesión y **elimina**
> `series_objetivo`, `reps_objetivo` y `peso_objetivo` de `plantilla_item`. Hasta
> ejecutarla, esas dos pantallas fallan al consultar. Convierte sola las rutinas
> que ya existan: cada ejercicio pasa a tener sus N series con el mismo objetivo.

### 3. Configurar las variables de entorno

```bash
cp .env.example .env.local
```

Rellenar `.env.local` con:

- Las credenciales de Supabase (panel → Project Settings → API)
- Una clave de modelo: `ANTHROPIC_API_KEY`, `TENSORX_API_KEY`, o ambas

`.env.local` está en `.gitignore` y nunca se sube al repositorio.

### 3.1 Elección de modelo

Todo el acceso a modelos pasa por [`src/lib/ia/proveedor.ts`](src/lib/ia/proveedor.ts),
que es un interruptor de desarrollo, no una capa de abstracción de proveedores.

| `IA_PROVEEDOR` | Modelo | Para qué |
|----------------|--------|----------|
| `claude` | `claude-sonnet-4-5` | Uso real |
| `tensorx` | `deepseek/deepseek-v4-flash-0731` | Pruebas: mucho más barato |
| sin definir | TensorX si hay `TENSORX_API_KEY`, si no Claude | — |

**TensorX es un tercero ajeno a Anthropic y estos mensajes son datos de salud
(§14).** Para uso real, `IA_PROVEEDOR=claude`.

Para probar el modelo sin arrancar la app:

```bash
node --env-file=.env.local scripts/probar-tensorx.mjs "dime hola en una frase"
```

### 4. Arrancar

```bash
npm run dev
```

## Cómo está organizado

```
src/lib/ia/          proveedor.ts (interruptor de modelo), esquemas y prompts
src/lib/datos/       lectura y escritura contra Supabase, más cálculo puro
src/app/marco.tsx    barra lateral y drawer (§22), excluidos de la sesión en vivo
src/lib/navegacion.ts destinos y rutas sin navegación
```

Tres decisiones que no se ven leyendo un archivo suelto:

- **El parseo del chat nunca inventa.** Si falta un dato relevante, la respuesta
  trae una pregunta en vez de un valor (§3.1, §7.4). Lo entendido se guarda igual;
  solo lo dudoso queda pendiente, y el texto original se conserva siempre.
- **Los insights de nivel 1 son aritmética, no salida de un modelo** (§11.1). Viven
  en [`src/lib/datos/insights.ts`](src/lib/datos/insights.ts) como funciones puras
  sobre filas ya leídas, para que el cálculo que sostiene un dato de salud se pueda
  comprobar sin levantar una base de datos.
- **Lo que separa un insight de nivel 2 de uno de nivel 3 es el tipo de afirmación**
  (§11.3, §11.4): aplicar conocimiento establecido del dominio puede concluir; inferir
  un patrón del histórico propio, no —es n=1 y con confusores que la app no puede
  descartar. La garantía del nivel 2 es decir en qué se apoya, y eso se comprueba en
  código: un nivel 2 sin apoyo escrito no se descarta en silencio, baja a nivel 3.
  Pedirlo solo en el prompt no bastaría.

## Idea en una frase

Registrar entreno y dieta debe costar lo mínimo posible: rutinas y plan de comida se definen una vez, y el día a día es confirmar contra ellos. Lo improvisado se registra en lenguaje natural por chat, y una IA lo estructura.

## Stack previsto

| Capa | Elección |
|------|----------|
| Frontend | React / Next.js |
| Backend + BD | Postgres vía Supabase |
| IA | API de Claude (DeepSeek vía TensorX para pruebas) |
| Gráficos | Recharts |
| Iconos | Lucide (§21.9 descarta emoji) |

## Plan de construcción

| Fase | Contenido |
|------|-----------|
| 1 | Login, base de datos con RLS, chat + parseo, historial, gráficos |
| 1.5 | Rutinas y entreno en vivo, plan de dieta y check-in, dictado por voz |
| 2 | Objetivos e insights |
| 3 | Capa MCP y clientes externos |

Detalle completo en la sección 17 de la especificación.
