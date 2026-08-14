# Especificación funcional — App de tracking fitness con IA

**Versión:** 2.0
**Fecha:** 14 de agosto de 2026
**Estado:** especificación aprobada para construcción de MVP
**Autor:** Ionel

---

## 0. Cómo leer este documento

Cada sección describe **qué hace el sistema** y, cuando la decisión no es obvia, **por qué se decidió así**. Las decisiones que se tomaron descartando explícitamente una alternativa están marcadas como `DECISIÓN`, con su motivo. Lo que queda pendiente de decidir está marcado como `ABIERTO` y agrupado en la sección 19.

Cuando una sección dice que algo "no se hace" o "queda fuera", es una exclusión deliberada, no un olvido.

### 0.1 Cambios respecto a la v1.0

| # | Cambio | Sección |
|---|--------|---------|
| 1 | Se añade registro de entreno en vivo con rutinas guardadas (estilo Hevy, sin componente social) | 5 |
| 2 | Se añade planificación de dieta semanal + check-in diario de adherencia | 6 |
| 3 | Los objetivos pasan de dos tipos fijos (peso, PR) a un modelo genérico y abierto | 9 |
| 4 | Los insights se reestructuran en tres niveles, con base curada de principios para los niveles interpretativos | 11 |
| 5 | El aislamiento por usuario (`user_id` + RLS) pasa a ser requisito de la Fase 1, no de la Fase 3 | 7, 14 |
| 6 | El catálogo de ejercicios arranca sembrado, no vacío | 4.1 |
| 7 | Se añade sección propia de seguridad, privacidad y RGPD | 14 |
| 8 | Se añade entrada por dictado de voz | 3.4 |
| 9 | Se añade una Fase 1.5 al plan de construcción | 17 |
| 10 | Se define el comportamiento ante parseo parcialmente fallido | 7.4 |

---

## 1. Visión general

Web app responsiva (navegador, móvil y desktop) donde el usuario registra entrenos, comida y medidas corporales. Los datos se almacenan estructurados, se visualizan en gráficos de evolución, y se analizan para producir estadísticas y recomendaciones.

La entrada de datos combina **lenguaje natural** (chat, para lo improvisado y lo pasado) con **flujos estructurados** (rutinas de entreno y plan de dieta, para lo recurrente). Una IA convierte el lenguaje natural en datos estructurados; los flujos estructurados generan esos mismos datos sin pasar por la IA.

Primera versión: uso personal (un solo usuario real), pero modelada desde el inicio para escalar a multi-usuario sin reescritura.

### 1.1 Principios de diseño

Estos principios son transversales y mandan sobre cualquier decisión de detalle:

1. **La fricción de registro es el riesgo principal del producto.** Una app de tracking que cuesta alimentar se abandona en semanas. Ante la duda entre "más datos" y "menos fricción", gana menos fricción.
2. **Chat-first, no chat-only.** El lenguaje natural es la entrada universal y el plan B para todo, pero lo recurrente (una rutina, una dieta) se registra mejor con interfaz estructurada.
3. **Planificar una vez, confirmar muchas.** Tanto entreno como dieta siguen el mismo patrón: se define una plantilla con calma, y el día a día es confirmar o corregir contra ella.
4. **La IA nunca inventa.** Si falta un dato relevante, se pregunta. Si no hay base suficiente para una conclusión, se dice.
5. **Los datos estructurados son la fuente de verdad.** La IA es un traductor de entrada, nunca el almacén ni la autoridad sobre el dato.
6. **En salud, la precisión importa más que la fluidez.** Donde ambas chocan (ej. una desviación de dieta), gana la precisión.

---

## 2. Vías de entrada de datos

El sistema tiene **tres vías de entrada**, que producen exactamente los mismos datos estructurados:

| Vía | Para qué | Pasa por IA |
|-----|----------|-------------|
| A. Chat de texto libre | Lo improvisado, lo pasado, lo que no encaja en un plan | Sí |
| B. Sesión de entreno en vivo | Ejecutar una rutina guardada, serie a serie | No |
| C. Check-in de dieta | Confirmar o corregir el plan de comida del día | Solo en desviaciones |

`DECISIÓN`: no se unifica todo en chat. La v1.0 lo planteaba como punto de entrada único, pero escribir frases completas a media serie en el gimnasio tiene fricción real, y contradice el principio 1. Las vías B y C existen precisamente para lo recurrente.

`DECISIÓN`: las vías B y C **no sustituyen** al chat. Siempre se puede registrar cualquier cosa por chat, incluso lo que tiene plantilla. El chat es el plan B universal.

---

## 3. Vía A — Chat de texto libre

### 3.1 Comportamiento

- El usuario escribe en lenguaje natural. Ejemplo: *"hoy 78kg, comí pollo con arroz al mediodía, entrené pierna: sentadilla 80kg 4x8, prensa 120kg 3x10"*.
- La IA parsea el texto y lo convierte en datos estructurados (JSON validado contra un schema fijo por tipo de dato).
- Un mismo mensaje puede contener varios tipos de dato a la vez. La IA los separa y los guarda como entradas independientes.
- Si falta información relevante para estructurar un dato, la IA **pide aclaración en vez de inventar valores**.

### 3.2 Fecha y hora

- Si el usuario menciona explícitamente cuándo ocurrió algo (*"ayer entrené..."*, *"esto fue el lunes"*), la IA extrae esa fecha.
- Si no se menciona nada, se usa la fecha/hora actual del mensaje como fallback.

### 3.3 Entrenos por chat

Sigue siendo válido escribir o pegar un resumen de entreno completo, igual que se hace hoy en un chat de IA genérico. Es la vía para entrenos pasados, entrenos improvisados fuera de rutina, o cuando no se usó el registro en vivo.

`DECISIÓN`: sin integración automática con Hevy. Su API requiere suscripción de pago (Hevy Pro), y con la vía B propia deja de ser necesaria.

### 3.4 Dictado por voz

El campo de entrada del chat acepta dictado por voz además de texto escrito.

`DECISIÓN`: se implementa con la API de reconocimiento de voz nativa del navegador, no con un servicio de transcripción externo. Motivo: coste cero, sin latencia de red, y el audio no sale del dispositivo. A cambio, el soporte varía entre navegadores — si no está disponible, el campo funciona solo como texto, sin degradar nada.

Arquitectónicamente no cambia nada: la voz produce texto, y ese texto entra por el mismo camino que si se hubiera escrito.

---

## 4. Tipos de dato

### 4.1 Entreno

Ejercicios realizados, con series, repeticiones y peso por serie.

**Catálogo de ejercicios.** Cada ejercicio se normaliza contra un catálogo con alias (ej. "sentadilla" = "squat" = "back squat"), para que los gráficos y PRs por ejercicio sean fiables aunque el usuario lo nombre distinto cada vez.

- **Semilla inicial:** el catálogo **no arranca vacío**. Se siembra con un conjunto inicial de ejercicios con sus alias en español e inglés ya cargados.
  - **Para MVP:** 10-15 ejercicios, suficientes para probar el flujo completo (ver anexo A).
  - **Ampliación posterior:** 40-60 ejercicios cubriendo los patrones básicos y sus variantes comunes.
  - *Motivo:* si el catálogo nace vacío, el flujo de confirmación de ejercicio nuevo se dispara constantemente en las primeras sesiones — justo cuando más se nota la fricción y menos tolerancia hay a que algo falle.
- **Autogeneración:** cuando la IA detecta un ejercicio que no está en el catálogo, genera sus metadatos (grupo muscular, tipo de equipo, alias comunes) con su propio conocimiento, sin bases de datos externas ni relleno manual.
- **Confirmación obligatoria:** antes de crear un ejercicio nuevo, la IA confirma con el usuario, por si en realidad es un alias de uno ya existente.
- **Guía de ejecución:** cada ejercicio del catálogo incluye una guía de ejecución en texto generada por IA (ej. *"pies al ancho de hombros, baja controlando la cadera hacia atrás..."*).

`DECISIÓN`: no se generan imágenes de ejecución de ejercicios. Los modelos de generación de imágenes no son fiables representando biomecánica correcta, y una demostración visual incorrecta en un ejercicio con carga real es un riesgo de lesión, no solo un fallo estético.

### 4.2 Comida

Descripción de lo comido, momento del día, y macros/calorías.

- **Si viene del plan de dieta (vía C):** los macros son los ya definidos en el plan. No hay estimación nueva.
- **Si viene de texto libre (vía A) o de una desviación del plan:** la IA estima macros a partir de la descripción, y **exige cantidades explícitas** — ver 6.3.

Cada entrada de comida guarda un **indicador de origen del dato**:

| Origen | Significado |
|--------|-------------|
| `plan` | Procede del plan de dieta, con cantidades definidas por el usuario |
| `declarado` | El usuario dio cantidades explícitas, la IA calculó macros |
| `estimado` | La IA estimó también la cantidad |

*Motivo:* los insights no deben tratar una estimación con la misma precisión que un dato declarado. Sin este campo, un histórico mezcla ambas cosas sin poder distinguirlas después.

### 4.3 Medidas corporales

Peso corporal y cualquier otra medida que el usuario mencione (% de grasa, cintura, etc.). El modelo es abierto: una medida es un nombre + valor + unidad + fecha, no una lista fija de campos.

### 4.4 Excluido de v1

- **Sueño:** fuera de alcance.
- **Notificaciones y recordatorios de registro:** fuera de alcance.

---

## 5. Vía B — Rutinas y entreno en vivo

Replica el flujo de registro de Hevy: crear rutinas y ejecutarlas serie a serie.

`DECISIÓN`: se replica **solo la parte de registro**. Todo el componente social de Hevy queda explícitamente fuera: sin feed, sin seguir a otros usuarios, sin likes ni comentarios, sin perfiles públicos, sin compartir entrenos.

### 5.1 Rutinas guardadas

- Una rutina es una plantilla con nombre (ej. "Pierna A") y una lista ordenada de ejercicios, cada uno con series, repeticiones y peso objetivo.
- Cada ejercicio de la rutina apunta al catálogo (sección 4.1), no a texto libre.
- Las rutinas se crean, editan y borran **tanto por interfaz como por chat** (ej. *"guarda esta rutina como 'Pierna A'..."*), para no romper el principio chat-first en la configuración.

### 5.2 Sesión en vivo

- El usuario elige una rutina y empieza la sesión.
- Por cada serie, la interfaz permite introducir peso y repeticiones con **controles rápidos (steppers), no escribiendo frases**.
- Cada serie muestra como referencia lo que se hizo la vez anterior en ese mismo ejercicio (ej. *"última vez: 80kg × 8"*).
- Se puede desviar de la rutina sobre la marcha: añadir un ejercicio no planificado, saltar uno, o cambiar series/peso.
- Al terminar, la sesión se guarda como un entreno estructurado.

`DECISIÓN`: el entreno en vivo **no pasa por la IA en ningún momento**. Nace ya estructurado, así que no hay parseo, ni coste de API, ni riesgo de error de interpretación.

### 5.3 Sesión interrumpida

Una sesión en curso se guarda de forma persistente mientras dura (no solo en memoria del navegador). Si se cierra la pestaña, se agota la batería o se pierde la conexión, al volver se puede retomar donde se dejó.

*Motivo:* un entreno dura una hora larga en un móvil que puede quedarse sin batería o perder cobertura. Perder la sesión entera por eso es el peor fallo posible de esta pantalla.

---

## 6. Vía C — Dieta planificada y adherencia

Mismo patrón que las rutinas de entreno, aplicado a comida: se planifica una vez, y el día a día es confirmar.

### 6.1 Plan de dieta semanal

- El usuario define un plan semanal: qué comidas tiene cada día, con qué alimentos y **cantidades**.
- Se define por chat, en un momento sin prisa. Aquí **sí** se piden cantidades faltantes de forma sistemática — es una vez por semana, no cinco veces al día.
- Los macros de cada comida planificada se calculan una vez, al definir el plan, y quedan guardados.
- El plan es editable en cualquier momento.
- El plan puede ser parcial: no hace falta planificar las 7 comidas de los 7 días para que el sistema sirva.

### 6.2 Check-in diario

Para cada comida planificada del día, el usuario responde con una interacción mínima:

| Respuesta | Qué se registra |
|-----------|-----------------|
| **Igual que el plan** | Se registra la comida con los datos del plan, origen `plan`. Sin estimación nueva. |
| **Más de lo planificado** | Requiere detalle explícito (ver 6.3) |
| **Menos de lo planificado** | Requiere detalle explícito (ver 6.3) |
| **Otra cosa** | Requiere descripción y cantidades explícitas, como texto libre |
| **No la comí** | Se registra como comida omitida |

*Nota:* confirmar contra el plan es **más preciso** que describir por texto libre, no menos — las cantidades se pensaron una vez con calma en vez de estimarse al vuelo cinco veces al día.

### 6.3 Regla de desviación

`DECISIÓN`: cuando el usuario se desvía del plan (come de más, de menos, u otra cosa), **las cantidades son obligatorias**. La IA no estima el tamaño de la desviación: pregunta hasta tenerlo.

*Motivo:* una desviación es exactamente el dato que explica por qué el resultado de la semana no cuadra con el plan. Estimarla a ojo destruye el único valor que tiene registrarla.

Para que la obligatoriedad no se convierta en fricción, la pregunta debe ser lo más rápida posible de responder: opciones concretas y tocables (ej. *"¿la mitad, el doble, otra cantidad?"*) antes que un campo de texto libre pidiendo gramos exactos.

### 6.4 Comida fuera de plan

Cuando no hay plan para esa comida (comer fuera, un día sin planificar), se registra por chat de texto libre, con la misma regla: **si no hay cantidad explícita, se pregunta**.

`DECISIÓN`: se descarta la alternativa de estimar en silencio con un margen amplio. Contradice el principio 4 y el propio motivo de la regla de desviación.

### 6.5 Modelo común con las rutinas

Rutinas de entreno y plan de dieta comparten la misma forma: **plantilla programada + registro diario de adherencia contra esa plantilla**. Se modelan sobre el mismo patrón de datos, no como dos sistemas separados.

*Motivo:* la lógica de "qué estaba planificado / qué se hizo realmente / cuánto se desvió" es idéntica en ambos casos. Duplicarla obliga a arreglar cada bug dos veces.

---

## 7. Estructuración y almacenamiento

### 7.1 Reglas fundamentales

- Los datos parseados por la IA son **la entrada, nunca la fuente de verdad**. Todo se guarda estructurado en base de datos.
- Los gráficos, el historial y los insights se calculan **siempre sobre los datos estructurados**, nunca sobre el texto original.
- El texto original de cada mensaje **se conserva**, para poder reprocesar o auditar si el parseo falla o cambia de criterio.

### 7.2 Aislamiento por usuario

- **Cada registro va ligado a un `user_id` desde la primera tabla creada en Fase 1**, aunque en v1 solo exista un usuario real.
- Toda consulta pasa por el usuario autenticado de la sesión.
- **Row Level Security (RLS) se activa en la primera migración**, no como parche posterior.

`DECISIÓN`: esto es requisito de Fase 1, no de Fase 3. En la v1.0 el aislamiento aparecía ligado a la capa MCP; si el aislamiento nace ahí, todo lo construido antes queda sin él, y la capa MCP se convierte en un parche sobre un modelo ya permeable. Ver sección 14.

### 7.3 Trazabilidad de cada registro

Cada registro guarda, además de sus datos propios:

- `user_id`
- Fecha/hora del evento (cuándo ocurrió) y fecha/hora de registro (cuándo se guardó) — son distintas cuando se registra algo pasado
- Origen del dato: `chat`, `sesion_en_vivo`, `plan_dieta`, `edicion_manual`
- Referencia al mensaje original, si vino por chat

### 7.4 Parseo parcialmente fallido

Cuando un mensaje contiene varios datos y solo algunos se parsean correctamente:

`DECISIÓN`: **se guardan los que sí se entendieron** y se pregunta explícitamente por los que no. No se rechaza el mensaje entero.

Ejemplo: de *"78kg, comí algo, sentadilla 80kg 4x8"* se guardan el peso y el entreno, y se pregunta solo por la comida.

*Motivo:* rechazar el mensaje completo obliga a reescribir lo que ya estaba bien, que es fricción pura. La alternativa (guardar solo lo que se entendió y callar) es peor todavía: el usuario cree que registró tres cosas y registró dos.

---

## 8. Gestión de datos ya guardados

- **Edición/corrección:** cualquier dato guardado se puede editar, tanto por interfaz sobre el historial como pidiéndoselo a la IA por chat.
- **Borrado:** disponible por ambas vías.
- **Historial completo:** vista de lista/tabla con todos los registros, no solo su representación en gráficos. Filtrable por tipo de dato y rango de fechas.
- **Desambiguación en edición por chat:** si una petición por chat (ej. *"cambia el peso de ayer a 77kg"*) coincide con más de un registro posible, la IA **no asume cuál**: muestra los candidatos y pregunta antes de aplicar el cambio.

---

## 9. Objetivos

### 9.1 Modelo genérico

`DECISIÓN`: los objetivos **no** son una lista cerrada de tipos. La v1.0 los limitaba a peso objetivo y PRs de ejercicios; el modelo es abierto para que cualquier métrica del sistema pueda convertirse en objetivo sin tocar el esquema de datos.

Un objetivo se compone de:

| Campo | Descripción | Ejemplo |
|-------|-------------|---------|
| `descripcion` | Texto libre del usuario | "Bajar cintura" |
| `metrica` | Qué métrica sigue | `measurement:cintura` |
| `valor_objetivo` | Valor a alcanzar | 80 |
| `unidad` | Unidad de medida | cm |
| `direccion` | Si el éxito es subir o bajar | bajar |
| `fecha_objetivo` | Opcional | 2026-12-31 |

Ejemplos de métricas válidas: `measurement:peso`, `measurement:cintura`, `exercise_pr:sentadilla`, `nutrition:proteina_diaria`, `training:sesiones_semanales`.

### 9.2 Comportamiento

- El progreso se mide y visualiza contra cada objetivo (ej. *"te faltan 3kg para tu objetivo de peso"*, *"tu PR de sentadilla ha subido un 8% en 2 meses"*).
- Los objetivos son editables y actualizables en cualquier momento.
- Un objetivo cumplido se marca como tal, pero **no se borra**: queda en el histórico.

---

## 10. Gráficos de evolución

Visualización de evolución temporal para cada tipo de dato:

- Peso corporal y otras medidas
- Volumen y carga de entreno, por ejercicio y por grupo muscular
- PRs por ejercicio a lo largo del tiempo
- Ingesta: calorías y macros por día
- Adherencia: planificado vs. real, tanto en entreno como en dieta
- Progreso visual contra los objetivos fijados (sección 9)

---

## 11. Insights

`DECISIÓN`: esta es la sección más reformulada respecto a la v1.0. El motivo es explícito: **son datos de salud, y una IA interpretando libremente un histórico personal no es una base aceptable para decidir sobre entreno o dieta.** La v1.0 dejaba que la IA detectara patrones y recomendara sin más ancla que un nivel de confianza declarado. Eso se sustituye por tres niveles con reglas distintas.

### 11.1 Nivel 1 — Estadísticas puras

Aritmética sobre los propios datos del usuario. Sin interpretación.

- Ejemplos: *"tu peso ha bajado 2kg este mes"*, *"tu volumen de pierna ha subido un 15%"*, *"has cumplido el plan de dieta 5 de 7 días"*.
- No requieren ancla externa: son hechos, no afirmaciones sobre causas.
- Se calculan sobre los datos estructurados, no los genera un modelo de lenguaje.

### 11.2 Nivel 2 — Relaciones y recomendaciones

Cualquier afirmación de que X influye en Y, o cualquier sugerencia de cambiar algo.

**Regla:** la IA solo puede afirmar una relación causal o dar una recomendación si **conecta con un principio de la base curada** (11.4), y **lo dice explícitamente** al presentarlo.

Ejemplo correcto:
> *"Tu volumen de pierna bajó un 20% en 2 semanas. Esto suele asociarse con fatiga acumulada; puede valer la pena revisar sueño y descanso."*

Requisitos de presentación:
- El principio invocado se nombra explícitamente. No basta con que la IA lo tenga en cuenta internamente.
- Se muestran **los datos concretos que sostienen el insight**, no solo la conclusión (ej. las fechas y valores implicados), para que el usuario pueda verificarlo por sí mismo.
- Se indica cuántos datos lo respaldan (ej. *"con solo 5 días de datos, esta tendencia es débil"*).

### 11.3 Nivel 3 — Observaciones sin conclusión

Cuando la IA detecta algo en los datos que **no encaja con ningún principio de la base curada**, no inventa una relación nueva.

- Como mucho, señala la coincidencia en bruto: *"estos dos datos han coincidido estas semanas"*, sin afirmar causalidad ni recomendar nada.
- Para cualquier cosa fuera de los principios básicos, lo dice explícitamente y remite a un profesional real (entrenador, nutricionista, médico) en vez de improvisar.

### 11.4 Base curada de principios

Una lista revisada y aprobada por el usuario de principios de entrenamiento y nutrición **bien establecidos y no controvertidos**.

- **Generación:** la IA redacta un borrador inicial con su conocimiento; el usuario lo revisa y aprueba una vez. Mismo patrón que el catálogo de ejercicios.
- **Tamaño para MVP:** 15-20 principios. No una enciclopedia.
- **Contenido inicial:** sobrecarga progresiva, rangos de proteína para hipertrofia, papel del sueño en la recuperación, déficit/superávit calórico para cambio de peso, volumen mínimo efectivo, gestión de fatiga y deloads.
- **Ampliación:** posterior y gradual.

*Nota:* revisar una lista pequeña y estable una sola vez es cualitativamente distinto de confiar en que la IA razone en caliente sobre la salud del usuario en cada consulta.

`ABIERTO`: el marco de tres niveles se considera suficiente para el MVP, pero se pulirá con uso real. Ver sección 19.

### 11.5 Modos de entrega

- **Bajo demanda:** el usuario pregunta en el chat (*"¿cómo voy esta semana?"*) y recibe una lectura inmediata.
- **Automático periódico:** resúmenes generados sin petición (ej. resumen semanal), cruzando el histórico acumulado.

### 11.6 Datos insuficientes

Si el histórico es demasiado corto para un análisis fiable, la IA lo reconoce explícitamente (*"aún no tengo suficiente historial para detectar patrones fiables"*) en vez de forzar una respuesta con poca base.

---

## 12. Arquitectura de comunicación IA ↔ datos (MCP)

Para evitar dar a la IA acceso directo a la base de datos, la comunicación se hace mediante un servidor MCP que expone funciones concretas y validadas:

```
add_workout(...)          add_meal(...)           add_measurement(...)
update_entry(...)         delete_entry(...)       get_progress(...)
set_goal(...)             get_goal_progress(...)
save_routine(...)         log_routine_session(...)
save_diet_plan(...)       log_diet_checkin(...)
```

Cada función:

- **Valida sus propios inputs** (rechaza pesos negativos, fechas imposibles, cantidades absurdas).
- **Opera únicamente sobre el `user_id` de la sesión activa.** No existe ninguna función que permita acceder a datos de otro usuario.
- **Es auditable:** queda registrado qué se llamó, cuándo y con qué parámetros.

### 12.1 Punto crítico de seguridad

El vínculo entre el `user_id` de la sesión autenticada y el servidor MCP es **el punto de seguridad más importante de esta capa**, por encima de las validaciones de cada función. Un fallo aquí expone datos de salud entre usuarios; un fallo de validación solo produce un dato malo.

Este binding se implementa y se prueba explícitamente, y el aislamiento de la sección 7.2 (RLS a nivel de base de datos) actúa como segunda línea de defensa independiente.

### 12.2 Motivo de esta capa

El aislamiento IA↔BD por sí solo se consigue con tool calling normal de la API de Claude, sin montar un servidor MCP completo. El motivo real de esta capa es **dejar la puerta abierta a que otros clientes compatibles con MCP (Claude Desktop, Claude Code) lean y escriban estos mismos datos usando las mismas funciones, sin duplicar lógica**.

Por eso está en Fase 3 y no bloquea el MVP.

---

## 13. Autenticación y básicos de la web

- **Login/registro:** email+contraseña u OAuth (ej. Google), con sesión persistente. Existe desde el inicio aunque v1 tenga un único usuario real, porque es la pieza más cara de añadir a posteriori.
- **Recuperación de contraseña**, si se usa email+contraseña.
- **Perfil de usuario:** nombre, unidades preferidas (kg/lbs, cm/in), gestión de objetivos.
- **Responsive real:** chat, gráficos y sesión de entreno en vivo usables en móvil y desktop. La sesión en vivo se diseña **mobile-first**: es la única pantalla que se usa de pie, con una mano y con prisa.
- **Manejo de errores:** mensajes claros si la IA no consigue parsear un mensaje o falla la conexión, sin pantallas rotas.
- **Estados de carga:** feedback visual mientras la IA procesa un mensaje o genera un insight (shimmer/pulso sutil, no un spinner genérico).
- **Exportación/backup:** el usuario puede exportar todo su histórico (CSV/JSON), tanto por ser datos de salud personales como por no depender al 100% de la infraestructura propia.
- **Ajustes:** cambiar unidades, editar objetivos, gestionar rutinas y plan de dieta, borrar cuenta y datos.

---

## 14. Seguridad, privacidad y RGPD

### 14.1 Requisitos desde Fase 1

- HTTPS en todo el tráfico.
- Contraseñas hasheadas, si se gestionan directamente.
- `user_id` en todas las tablas y RLS activo desde la primera migración (sección 7.2).
- Registro auditable de las operaciones sobre datos.

### 14.2 Situación legal en v1

Peso, % de grasa, comida y entreno son **datos de salud** bajo el RGPD (categoría especial, art. 9): aplica a cualquier dato de fitness o wellness del que se pueda inferir el estado físico de una persona, no solo a historiales médicos.

**En v1 esto no requiere acción.** Con un único usuario que además es dueño y operador de la app, para uso estrictamente personal, aplica la excepción de actividad puramente personal o doméstica (art. 2.2.c) y el RGPD no entra en juego.

### 14.3 Checklist previo a abrir la app a otros usuarios

Nada de esto se construye en v1. Es la lista que debe revisarse **antes** de que exista un segundo usuario real:

- [ ] **Consentimiento explícito y específico** para tratamiento de datos de salud en el registro. Un check genérico de "acepto los términos" no es suficiente: debe ser un paso separado que nombre explícitamente que se procesan datos de salud.
- [ ] **Alojamiento en región UE** de la base de datos, si hay usuarios europeos (Supabase permite elegir región, ej. Frankfurt).
- [ ] **Política de privacidad** que declare qué se recoge, para qué, cuánto tiempo se retiene y quién más lo procesa. Debe incluir explícitamente a la **API de Claude como sub-encargado del tratamiento**, ya que procesa el texto de comida y entreno para estructurarlo.
- [ ] **Cifrado en reposo**, no solo en tránsito. Para datos de categoría especial se espera más protección que para datos ordinarios.
- [ ] **Derecho de acceso y portabilidad:** ya cubierto por la exportación (sección 13).
- [ ] **Derecho de supresión:** ya cubierto por el borrado de cuenta (sección 13).
- [ ] El registro de auditoría de las funciones MCP (sección 12) sirve como evidencia de *accountability*.

> **Aviso:** esto no es asesoría legal. Si se llega a tener usuarios reales en la UE, conviene una revisión con alguien especializado en RGPD, especialmente sobre la forma del consentimiento.

---

## 15. Coste y rendimiento de la IA

- Cada mensaje de chat implica al menos una llamada a la API de Claude para parsear texto → JSON estructurado. Los insights implican llamadas adicionales.
- **Las vías B y C no consumen API** salvo en desviaciones de dieta. Esto reduce el coste operativo del uso diario, además de la fricción.
- **Modelo según tarea:** modelo rápido y económico para el parseo estructurado (tarea simple y repetitiva); mayor capacidad de razonamiento reservada para los insights de nivel 2.
- **Prompt caching:** el catálogo de ejercicios, el schema de parseo y la base curada de principios van como contexto en muchas llamadas. Cachearlos reduce coste directamente.
- **Cacheo de insights:** no recalcular un insight periódico si los datos de base no han cambiado desde el último cálculo.

---

## 16. Modelo de datos (conceptual)

No es un esquema SQL definitivo, sino las entidades y sus relaciones.

```
usuario
  └─ user_id (presente en TODAS las entidades siguientes)

catalogo_ejercicio
  ├─ nombre canónico, alias[], grupo muscular, equipo
  └─ guía de ejecución (texto)

plantilla                          ← patrón común (sección 6.5)
  ├─ tipo: rutina_entreno | plan_dieta
  ├─ nombre
  └─ items[] (ejercicios+series objetivo | comidas+cantidades objetivo)

registro_entreno
  ├─ fecha evento / fecha registro / origen
  ├─ plantilla_id (opcional: null si fue improvisado)
  └─ ejercicios[] → series[] (peso, reps) → catalogo_ejercicio

registro_comida
  ├─ fecha evento / fecha registro / origen
  ├─ plantilla_id + estado adherencia (igual | más | menos | otra | omitida)
  ├─ descripción, macros, calorías
  └─ origen_dato: plan | declarado | estimado

registro_medida
  └─ nombre, valor, unidad, fecha

objetivo
  └─ descripción, métrica, valor objetivo, unidad, dirección, fecha objetivo

mensaje_original
  └─ texto crudo + referencias a los registros que generó

principio_base                     ← base curada (sección 11.4)
  └─ enunciado, ámbito, aprobado_por_usuario
```

---

## 17. Plan de construcción por fases

### Fase 1 — Núcleo

**Objetivo:** poder registrar y ver datos, con las bases estructurales correctas.

1. Login (email+contraseña u OAuth) y perfil básico.
2. Esquema de base de datos con `user_id` en todas las tablas y **RLS activo desde la primera migración**.
3. Catálogo de ejercicios sembrado con 10-15 ejercicios (anexo A).
4. Chat de texto libre + parseo estructurado + guardado.
5. Historial completo, filtrable, con edición y borrado.
6. Gráficos de evolución simples.
7. Exportación de datos.

**Criterio de finalización:** se puede registrar peso, comida y entreno por chat, verlos en el historial, corregirlos y exportarlos.

### Fase 1.5 — Registro estructurado

**Objetivo:** eliminar la fricción del registro diario, que es el riesgo principal del producto (principio 1).

1. Creación y edición de rutinas de entreno (interfaz + chat).
2. Sesión de entreno en vivo, mobile-first, con persistencia ante interrupción.
3. Plan de dieta semanal.
4. Check-in diario de adherencia, con regla de desviación obligatoria.
5. Dictado por voz en el chat.

`DECISIÓN`: esta fase va **antes** de objetivos e insights, no después. Si registrar sigue siendo incómodo, el resto de funcionalidad da igual: la app se abandona antes de acumular histórico suficiente para que los insights valgan algo.

**Criterio de finalización:** un entreno completo se registra sin escribir una sola frase, y un día de dieta se confirma en menos de un minuto.

### Fase 2 — Objetivos e insights

1. Objetivos genéricos y progreso contra ellos.
2. Base curada de principios (15-20, generada por IA y aprobada por el usuario).
3. Insights de nivel 1 (estadísticas puras).
4. Insights de nivel 2 y 3, con las reglas de anclaje y presentación de la sección 11.
5. Insights bajo demanda y resúmenes automáticos periódicos.

### Fase 3 — Capa MCP

1. Exponer las funciones como servidor MCP.
2. Binding estricto de `user_id` de sesión, con pruebas explícitas.
3. Registro de auditoría.
4. Conexión de clientes externos (Claude Desktop / Claude Code).

---

## 18. Fuera de alcance

### 18.1 Fuera de alcance permanente

- **Componente social de Hevy:** feed, seguir usuarios, likes, comentarios, perfiles públicos, compartir entrenos.
- **Imágenes generadas de ejecución de ejercicios** (motivo en 4.1).

### 18.2 Fuera de alcance en v1, posible a futuro

- Seguimiento de sueño.
- Integración automática con Hevy vía su API (requiere Hevy Pro de pago; con la vía B propia deja de ser necesaria).
- Apertura real a múltiples usuarios: el modelo de datos y el aislamiento ya lo soportan desde Fase 1, pero la apertura requiere el checklist de 14.3.
- App instalable (PWA/nativa). Se empieza con web responsiva.
- Notificaciones y recordatorios de registro.
- Base de datos de alimentos con códigos de barras.

---

## 19. Puntos abiertos

| # | Punto | Sección | Cuándo decidir |
|---|-------|---------|----------------|
| 1 | Refinamiento del marco de insights (nivel 2 y 3) con uso real | 11 | Tras la Fase 2, con histórico acumulado |
| 2 | Ampliación del catálogo de ejercicios de 10-15 a 40-60 | 4.1 | Al empezar a usar la app en serio |
| 3 | Ampliación de la base curada de principios más allá de 15-20 | 11.4 | Gradual, según haga falta |
| 4 | Formato exacto de las preguntas rápidas de desviación de dieta | 6.3 | Al construir la Fase 1.5 |

*Cerrado:* la dirección visual (§21) era el punto 5 de esta tabla. Se decidió el 14 de agosto de 2026 — ver §21 y decisión 13 del anexo B.

---

## 20. Stack propuesto

*A validar en implementación.*

| Capa | Elección | Nota |
|------|----------|------|
| Frontend | React / Next.js | Responsive de serie |
| Backend + BD | Postgres vía Supabase | Da auth y RLS de serie |
| IA | API de Claude | Parseo texto→JSON (tool calling) e insights |
| Gráficos | Recharts o similar | |
| Voz | API de reconocimiento de voz del navegador | Sin servicio externo (3.4) |

---

## 21. Dirección visual

**Nombre de la dirección: "Instrumento dual".**

La app es un instrumento de medida, no un entrenador motivacional. Debe leerse como algo preciso y sin ruido, con una única excepción deliberada: la sesión de entreno en vivo, que se comporta como un panel de gimnasio — oscuro, enorme y de un solo golpe de vista.

Dos restricciones condicionan todo lo que sigue:

1. **La sesión de entreno en vivo es la pantalla crítica** (§5.2, §13). Se usa de pie, con una mano, con prisa y a veces con las manos sudadas. Contraste alto y objetivos táctiles grandes no son preferencias estéticas aquí: son requisitos de uso.
2. **Los gráficos de evolución** (§10) necesitan una paleta que funcione para series de datos, no solo para interfaz.

### 21.1 Carácter

| Es | No es |
|----|-------|
| Instrumento de precisión: el dato manda sobre la decoración | App motivacional que celebra cada registro |
| Silencioso en reposo, contundente en la sesión en vivo | Uniformemente enérgico en todas las pantallas |
| Honesto con la incertidumbre (§4.2, §11.6): un dato estimado no se ve igual que uno declarado | Presentador de conclusiones seguras |
| Denso donde hay datos, espacioso donde hay decisiones | Dashboard saturado por defecto |

*Motivo:* el principio 6 de la §1.1 (*en salud, la precisión importa más que la fluidez*) tiene consecuencia visual directa. Una interfaz que se celebra a sí misma empuja a registrar para sentirse bien, no para medir bien.

### 21.2 Modo dual

`DECISIÓN`: dos temas de primera clase — claro y oscuro — y **la sesión de entreno en vivo arranca siempre en oscuro reforzado**, independientemente del tema elegido en el resto de la app.

*Motivo:* son dos contextos de uso opuestos. El análisis se hace sentado, con calma, donde el fondo claro da mejor densidad de lectura para tablas e historial. La sesión en vivo se hace de pie, con el brazo estirado y a veces con luz de fluorescente contra la pantalla; ahí un fondo claro es un foco en la cara y una pérdida real de legibilidad. No es una preferencia del usuario: es una propiedad de la pantalla.

`DECISIÓN`: se descarta que la sesión en vivo herede el tema general. Obligaría al usuario a cambiar el tema al entrar y salir del gimnasio, que es fricción (principio 1) por una consistencia que a nadie le sirve.

### 21.3 Paleta de interfaz

**Tema claro** (análisis, historial, chat, planificación):

| Rol | Valor | Uso |
|-----|-------|-----|
| Fondo | `#F7F7F8` | Lienzo de la app |
| Superficie | `#FFFFFF` | Tarjetas, tablas, modales |
| Borde | `#E4E4E7` | Separadores y contornos |
| Texto | `#18181B` | Cuerpo y cifras |
| Texto atenuado | `#52525B` | Etiquetas, unidades, metadatos |

**Tema oscuro** (misma app, de noche):

| Rol | Valor |
|-----|-------|
| Fondo | `#0B0F1A` |
| Superficie | `#141A26` |
| Borde | `#263041` |
| Texto | `#F8FAFC` |
| Texto atenuado | `#94A3B8` |

**Sesión en vivo** (oscuro reforzado, no es el tema oscuro normal):

| Rol | Valor |
|-----|-------|
| Fondo | `#020617` |
| Superficie | `#0E1223` |
| Borde | `#334155` |
| Texto | `#F8FAFC` |

### 21.4 Acento y estados

`DECISIÓN`: **un solo acento, reservado exclusivamente a la acción primaria.** El naranja no aparece en gráficos, ni en iconos decorativos, ni en cabeceras. Si algo es naranja, se toca.

| Rol | Sobre fondo oscuro | Sobre fondo claro | Significado |
|-----|--------------------|-------------------|-------------|
| Acción | `#F97316` (texto encima `#0F172A`) | `#EA580C` (texto encima `#FFFFFF`); como texto sobre claro, `#C2410C` | Confirmar serie, guardar, enviar |
| Éxito | `#22C55E` | `#15803D` | Adherencia cumplida, objetivo alcanzado, dato guardado |
| Error | `#F87171` | `#DC2626` | Parseo fallido, validación, fallo de conexión |
| Aviso | `#FBBF24` | `#B45309` | Desviación de plan, dato estimado, histórico insuficiente |

*Motivo del acento único:* en una pantalla que se usa con prisa y a una mano, el color tiene que responder a una sola pregunta — "¿dónde toco?". Repartir el acento entre decoración y acción destruye esa señal justo donde más importa.

**Regla de estimación** (§4.2): un valor de origen `estimado` se marca siempre con el color de aviso **y** con un indicador no cromático (icono o etiqueta textual). Nunca solo con color.

### 21.5 Paleta de series de datos

`DECISIÓN`: los gráficos (§10) usan una **paleta categórica propia, disjunta de la paleta de interfaz**. Ningún color de estado ni el acento de acción aparece como color de serie.

| # | Valor | Estilo de línea |
|---|-------|-----------------|
| 1 | `#2563EB` | Sólida |
| 2 | `#7C3AED` | Discontinua |
| 3 | `#0891B2` | Punteada |
| 4 | `#DB2777` | Sólida fina |
| 5 | `#475569` | Discontinua larga |

Reglas de uso:

- **El tono nunca es el único canal.** Cada serie lleva además estilo de línea propio y etiqueta directa sobre el trazo cuando el espacio lo permite. Un gráfico legible solo en color no es legible.
- **Máximo 5-6 series por gráfico.** Por encima de eso el gráfico deja de comunicar; se parte en varios.
- **Zonas de referencia** (rango objetivo, banda de plan): relleno del tono correspondiente al 15% de opacidad, nunca línea sólida — se distingue del dato real por forma, no por intensidad.
- Los objetivos (§9) se dibujan como línea horizontal de referencia en `#475569` discontinua, con etiqueta del valor.
- Todo gráfico tiene equivalente accesible: tabla de datos visible o desplegable, y navegación por teclado que revela los valores punto a punto.

*Motivo:* si el verde de "éxito" es también el color de una serie de calorías, un pico de esa serie se lee como una señal positiva que nadie ha querido decir. Separar los dos vocabularios evita afirmar cosas por accidente — que es la versión visual del principio 4 (*la IA nunca inventa*).

### 21.6 Tipografía

`DECISIÓN`: **una sola familia para toda la interfaz — Inter** —, con una segunda familia acotada a un único uso.

| Uso | Familia | Notas |
|-----|---------|-------|
| Titulares, cuerpo, etiquetas, tablas | Inter | Variable; pesos 400 / 500 / 600 / 700 |
| Cifras en tablas, historial y gráficos | Inter con `font-variant-numeric: tabular-nums` | Obligatorio: los pesos y macros deben alinearse en columna |
| Dígitos grandes de la sesión en vivo | Barlow Condensed 600-700 | **Solo aquí.** No aparece en ninguna otra pantalla |

*Motivo de la segunda familia:* en la sesión en vivo, "112,5 kg × 8" tiene que caber grande en un móvil estrecho y leerse con el brazo estirado. Una condensada gana el tamaño que hace falta sin partir la línea. Fuera de esa pantalla no aporta nada, así que no entra.

Escala mínima: cuerpo 16px, nunca texto informativo por debajo de 12px, interlineado 1.5 en texto corrido. En la sesión en vivo, el valor de la serie se muestra a 32px o más.

### 21.7 Objetivos táctiles y espaciado

- **Mínimo global:** 44×44px con 8px de separación entre objetivos.
- **En la sesión en vivo:** 56px de alto mínimo para steppers y botón de confirmar serie, con al menos 12px de separación. El botón de confirmar serie es el elemento más grande de la pantalla y está en el tercio inferior, alcanzable con el pulgar.
- **Densidad:** alta en historial, tablas y gráficos (escala de 8-32px); espaciada en chat, planificación y ajustes (16-48px).
- Se respetan las áreas seguras del dispositivo (notch, barra inferior); nada accionable queda debajo del borde de gesto.

### 21.8 Estados de carga

Esto resuelve lo que la §13 pedía sin definir.

`DECISIÓN`: **esqueleto con la forma del contenido final + pulso de opacidad.** Sin spinner genérico, y sin el barrido de brillo diagonal habitual.

- El esqueleto reserva el espacio exacto del dato que va a llegar, para que nada salte al aparecer.
- Animación: opacidad `0.45 → 1 → 0.45`, 1600ms, `ease-in-out`, en bucle. Es un pulso, no un barrido.
- Con `prefers-reduced-motion: reduce`, el esqueleto se queda estático a opacidad 0.6. No se sustituye por un spinner.
- **Mientras la IA parsea un mensaje** (§3.1), el pulso ocurre sobre el hueco de la respuesta en el hilo del chat, no sobre un overlay que bloquee la pantalla: el usuario puede seguir escribiendo.
- **Duración de transiciones de interfaz:** 150-250ms. Un único valor para todo es un antipatrón; las salidas van más rápidas que las entradas.

*Motivo:* un spinner dice "algo está pasando". Un esqueleto dice "va a aparecer esto, aquí". Con datos que tardan lo que tarda una llamada a la API de Claude, la segunda frase es la que evita que el usuario reenvíe el mensaje.

### 21.9 Antipatrones

Explícitamente prohibido en este producto:

| Antipatrón | Motivo |
|------------|--------|
| **Gamificación**: rachas, medallas, confeti, celebraciones al registrar | Premia registrar, no medir. Choca con el carácter (21.1) y con el principio 6 |
| **Emoji como iconos** | Se usa un set SVG coherente (Lucide). Los emoji cambian de forma según el sistema operativo |
| **Color como único canal de significado** | Estados, series y desviaciones llevan siempre forma, icono o texto además del color |
| **Gris sobre gris** | Todo texto informativo cumple 4.5:1 como mínimo; el texto atenuado de la 21.3 ya está calculado para eso |
| **Spinner genérico** | Sustituido por 21.8 |
| **Fondo claro en la sesión en vivo** | Contradice 21.2 |
| **El acento de acción en gráficos o decoración** | Contradice 21.4 |
| **Quitar el anillo de foco** | El chat y los formularios se usan con teclado en desktop |
| **Números que se animan al cambiar** (contadores que suben) | Un peso corporal no "sube": se mide. Animarlo lo convierte en espectáculo |
| **Fotos de gimnasio, siluetas musculadas, imágenes de stock fitness** | Es una herramienta personal de medición, no una marca deportiva |

`DECISIÓN`: se descartan las dos direcciones alternativas evaluadas. Una paleta de gimnasio saturada (naranja de marca sobre fondo oscuro en toda la app) fallaba en las pantallas de análisis, donde el acento compite con las series de datos. Una dirección minimalista en claro para todo fallaba en la sesión en vivo, que es exactamente la pantalla que no se puede permitir fallar.

## Anexo A — Semilla inicial del catálogo de ejercicios (MVP)

Conjunto mínimo para probar el flujo completo. Cada entrada lleva sus alias en español e inglés.

| # | Nombre canónico | Alias | Grupo muscular | Equipo |
|---|-----------------|-------|----------------|--------|
| 1 | Sentadilla trasera | squat, back squat, sentadilla | Pierna (cuádriceps) | Barra |
| 2 | Sentadilla frontal | front squat, frontal | Pierna (cuádriceps) | Barra |
| 3 | Prensa de piernas | prensa, leg press | Pierna (cuádriceps) | Máquina |
| 4 | Peso muerto | deadlift, muerto | Espalda / cadena posterior | Barra |
| 5 | Peso muerto rumano | RDL, romanian deadlift, rumano | Femoral / glúteo | Barra |
| 6 | Hip thrust | empuje de cadera, thrust | Glúteo | Barra |
| 7 | Press de banca | bench press, banca, press banca | Pecho | Barra |
| 8 | Press inclinado | incline press, inclinado | Pecho (superior) | Barra / mancuernas |
| 9 | Press militar | overhead press, OHP, militar | Hombro | Barra |
| 10 | Dominadas | pull up, pullups, dominada | Espalda | Peso corporal |
| 11 | Jalón al pecho | lat pulldown, jalón, polea alta | Espalda | Polea |
| 12 | Remo con barra | barbell row, remo | Espalda | Barra |
| 13 | Curl de bíceps | biceps curl, curl | Bíceps | Barra / mancuernas |
| 14 | Extensión de tríceps | triceps extension, extensiones | Tríceps | Polea / mancuerna |
| 15 | Zancadas | lunges, lunge, zancada | Pierna | Mancuernas / peso corporal |

---

## Anexo B — Registro de decisiones

| # | Decisión | Alternativa descartada | Motivo | Sección |
|---|----------|------------------------|--------|---------|
| 1 | Tres vías de entrada | Chat como único punto de entrada | Fricción real en gimnasio y en comida diaria | 2 |
| 2 | Replicar registro de Hevy, no lo social | Clonar Hevy completo / integrar su API | La API es de pago; lo social no aporta al uso personal | 5 |
| 3 | Voz con API del navegador | Servicio de transcripción externo | Coste cero, sin latencia, audio no sale del dispositivo | 3.4 |
| 4 | Cantidades obligatorias en desviaciones | Estimar en silencio con margen amplio | La desviación es justo el dato que explica el resultado | 6.3 |
| 5 | Objetivos genéricos | Enum fijo (peso, PR) | Evita migración de datos al añadir tipos nuevos | 9.1 |
| 6 | Insights en tres niveles con base curada | IA interpretando libremente con nivel de confianza | Son datos de salud; la interpretación libre no es base aceptable | 11 |
| 7 | RLS y `user_id` en Fase 1 | Aislamiento al llegar la capa MCP (Fase 3) | Si nace en Fase 3, todo lo anterior queda permeable | 7.2 |
| 8 | Catálogo sembrado | Catálogo vacío autogenerado | La desambiguación fallaría justo en las primeras sesiones | 4.1 |
| 9 | Guardar lo parseado, preguntar lo fallido | Rechazar el mensaje entero | Rechazar obliga a reescribir lo que ya estaba bien | 7.4 |
| 10 | Fase 1.5 antes de insights | Objetivos e insights primero | Sin registro cómodo no hay histórico que analizar | 17 |
| 11 | Sin imágenes de ejecución | Generar imágenes con IA | Biomecánica incorrecta = riesgo de lesión | 4.1 |
| 12 | Plantilla+adherencia como patrón único | Rutinas y dieta como sistemas separados | Misma lógica; duplicarla obliga a arreglar bugs dos veces | 6.5 |
| 13 | Dirección visual "Instrumento dual": tema dual + sesión en vivo siempre oscura | Paleta de gimnasio saturada en toda la app / minimalismo claro en toda la app | Análisis y sesión en vivo son contextos de uso opuestos; una sola piel falla en uno de los dos | 21 |
| 14 | Acento único de acción, disjunto de la paleta de series | Reutilizar el acento y los colores de estado en los gráficos | Un color de estado en una serie afirma cosas que nadie ha querido decir | 21.4, 21.5 |
| 15 | Esqueleto con pulso de opacidad | Spinner genérico / barrido de brillo | Reserva el espacio del dato y evita el reenvío por impaciencia | 21.8 |
