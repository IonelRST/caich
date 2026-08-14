# caich

App web de tracking fitness con IA: registro de entrenos, comida y medidas corporales, con gráficos de evolución e insights basados en el propio histórico.

**Estado:** Fase 1 en curso. Proyecto Next.js inicializado y esquema de base de datos escrito; falta conectar Supabase y construir el chat.

## Documentación

- **[ESPECIFICACION.md](ESPECIFICACION.md)** — especificación funcional completa (v2.0). Incluye el registro de decisiones de diseño con sus motivos (anexo B).

## Puesta en marcha

### 1. Crear el proyecto de Supabase

En [supabase.com](https://supabase.com), crear un proyecto nuevo. **Elegir región europea** (ej. Frankfurt): son datos de salud, y aunque en v1 con un solo usuario el RGPD no aplica (§14.2), la región no se puede cambiar después sin migrar la base de datos entera.

### 2. Aplicar las migraciones

En el panel de Supabase → **SQL Editor**, ejecutar en orden:

1. `supabase/migrations/0001_esquema_inicial.sql` — tablas, RLS y políticas
2. `supabase/migrations/0002_semilla_catalogo.sql` — 15 ejercicios iniciales

### 3. Configurar las variables de entorno

```bash
cp .env.example .env.local
```

Rellenar `.env.local` con:

- Las credenciales de Supabase (panel → Project Settings → API)
- Una clave de la API de Claude ([platform.claude.com](https://platform.claude.com) → API Keys)

`.env.local` está en `.gitignore` y nunca se sube al repositorio.

### 4. Arrancar

```bash
npm run dev
```

## Idea en una frase

Registrar entreno y dieta debe costar lo mínimo posible: rutinas y plan de comida se definen una vez, y el día a día es confirmar contra ellos. Lo improvisado se registra en lenguaje natural por chat, y una IA lo estructura.

## Stack previsto

| Capa | Elección |
|------|----------|
| Frontend | React / Next.js |
| Backend + BD | Postgres vía Supabase |
| IA | API de Claude |
| Gráficos | Recharts o similar |

## Plan de construcción

| Fase | Contenido |
|------|-----------|
| 1 | Login, base de datos con RLS, chat + parseo, historial, gráficos |
| 1.5 | Rutinas y entreno en vivo, plan de dieta y check-in, dictado por voz |
| 2 | Objetivos, base curada de principios, insights |
| 3 | Capa MCP y clientes externos |

Detalle completo en la sección 17 de la especificación.
