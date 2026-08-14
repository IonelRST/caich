# caich

App web de tracking fitness con IA: registro de entrenos, comida y medidas corporales, con gráficos de evolución e insights basados en el propio histórico.

**Estado:** en diseño. Todavía no hay código.

## Documentación

- **[ESPECIFICACION.md](ESPECIFICACION.md)** — especificación funcional completa (v2.0). Incluye el registro de decisiones de diseño con sus motivos (anexo B).

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
