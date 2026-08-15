# Especificación funcional — App de tracking fitness con IA

**Versión:** 3.0
**Fecha:** 15 de agosto de 2026
**Estado:** en construcción; §11 revisada tras contrastar con el uso real
**Autor:** Ionel

---

## 0. Cómo leer este documento

Cada sección describe **qué hace el sistema** y, cuando la decisión no es obvia, **por qué se decidió así**. Las decisiones que se tomaron descartando explícitamente una alternativa están marcadas como `DECISIÓN`, con su motivo. Lo que queda pendiente de decidir está marcado como `ABIERTO` y agrupado en la sección 19.

Cuando una sección dice que algo "no se hace" o "queda fuera", es una exclusión deliberada, no un olvido.

### 0.1 Cambios de la v3.0 (revisión tras el uso real)

| # | Cambio | Sección |
|---|--------|---------|
| 1 | La §11 se reescribe entera. Se separa "aplicar conocimiento establecido" (permitido) de "inferir patrones del histórico propio" (restringido); la v2.0 los trataba igual y bloqueaba lo útil junto con lo peligroso | 11 |
| 2 | La IA puede recomendar progresiones, ajustes de dieta y estructura de rutina, diciendo en qué se apoya | 11.3 |
| 3 | Límite médico explícito y no negociable, motivado por condiciones reales del usuario | 11.5 |
| 4 | La "base curada de principios" pasa de lista de anclas a base de conocimiento del dominio | 11.6 |
| 5 | Tono: feedback honesto por defecto, sin validación automática | 11.7 |
| 6 | El chat responde preguntas sobre el propio histórico, no solo registra | 11.2 |
| 7 | Nuevo anexo C con el análisis del uso real que motiva la revisión | Anexo C |

*Motivo de la revisión:* en un mes de uso real con un asistente genérico, solo 1 de cada 6 mensajes era registrar datos. La v2.0 solo admitía ese sexto.

### 0.2 Cambios de la v2.0 respecto a la v1.0

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

## 11. Análisis y acompañamiento

`DECISIÓN` (revisada): la v2.0 restringía a la IA a tres niveles, exigiendo un principio aprobado detrás de cualquier recomendación. Se revisa tras contrastar la especificación con el uso real (anexo C): en un mes de conversación con un asistente genérico, **solo 1 de cada 6 mensajes era registrar datos**; el resto era decidir progresiones, rediseñar la rutina, resolver dudas de comida y sostener el proceso. Una app que solo admite el sexto de mensajes que son datos no sustituye a esa conversación, y el usuario acabaría teniendo las dos cosas abiertas.

*Lo que no se revisa:* el motivo original sigue en pie. Con un solo usuario y pocas semanas de histórico, muchas "correlaciones" son ruido, y en salud una conclusión falsa pesa más que en otros dominios.

La revisión distingue **qué tipo de afirmación** se hace, en vez de restringirlas todas por igual.

### 11.1 La distinción central

Al analizar el uso real aparece algo que la v2.0 no separaba: casi nada de lo valioso que hacía el asistente era *inferir patrones del histórico personal*. Era **aplicar conocimiento de entrenamiento y nutrición bien establecido** a la situación concreta del usuario.

> *"Has cerrado las 12 repeticiones limpias en el jalón → sube a 60 kg"* no sale de analizar sus datos buscando correlaciones. Sale de una regla de progresión conocida, aplicada a un dato suyo.

Son dos cosas distintas y merecen reglas distintas:

| | Qué es | Riesgo real | Regla |
|---|---|---|---|
| **Aplicar conocimiento establecido** | Regla conocida + dato del usuario | Bajo: la regla es válida independientemente de su histórico | Permitido, diciendo en qué se apoya |
| **Inferir del histórico propio** | "En tus datos, X parece influir en Y" | Alto: n=1, pocas semanas, confusores por todas partes | Restringido (§11.4) |

La v2.0 metía ambas en el mismo saco y por eso bloqueaba lo útil junto con lo peligroso.

### 11.2 Nivel 1 — Estadística

Aritmética sobre los propios datos, sin interpretación: *"has bajado 5,4 kg desde el inicio"*, *"tu volumen de pierna ha subido un 15%"*, *"has cumplido el plan 5 de 7 días"*.

Se calcula en código sobre los datos estructurados, no lo genera un modelo de lenguaje. Son hechos, no afirmaciones sobre causas.

**Se responden también preguntas del usuario que sean de este tipo** (*"¿cuánto he perdido?"*, *"¿cuántas calorías estoy comiendo?"*), porque son consultas al histórico, no opiniones.

### 11.3 Nivel 2 — Aplicación de conocimiento establecido

`DECISIÓN`: la IA **puede** recomendar progresiones de carga, ajustes de dieta, estructura de rutina y sustituciones de ejercicio, apoyándose en conocimiento estándar de entrenamiento y nutrición.

Requisitos:

- **Dice en qué se apoya.** No *"sube a 60 kg"*, sino *"cerraste las 12 repeticiones en las tres series, así que toca subir"*. El usuario tiene que poder discrepar del razonamiento, no solo del número.
- **Usa los datos reales del usuario**, no recomendaciones genéricas. Es la diferencia entre un entrenador y un artículo de revista.
- **Se apoya en la base de conocimiento** (§11.6), que deja de ser una lista corta de 15-20 anclas y pasa a ser el material de referencia del dominio.
- **Nada de esto es prescripción médica.** Ver §11.5.

### 11.4 Nivel 3 — Inferencia sobre el histórico propio (restringido)

Aquí sí se mantiene el freno de la v2.0, y por el motivo original.

Cuando la IA cree ver una relación **en los datos del usuario** — *"cuando comes más proteína rindes mejor"* — no la presenta como conclusión. La presenta como observación, con:

- **Los datos concretos** que la sostienen (fechas y valores), no solo la conclusión.
- **Cuántos datos la respaldan** y durante cuánto tiempo.
- **Los confusores evidentes** que no puede descartar (día de pierna vs. día de brazo, sueño, semana de vacaciones).

*Motivo:* el usuario conoce su propia vida mucho mejor que la app. Con los datos crudos delante puede caer en *"ah, ese día también dormí nueve horas"* y descartarla él. Sin ellos, solo le queda confiar a ciegas.

### 11.5 Límite médico (no negociable)

`DECISIÓN`: la ampliación de §11.3 **no alcanza a lo médico**. Ante síntomas, condiciones diagnosticadas, medicación o adicciones, la app describe lo registrado y remite a un profesional. No interpreta, no tranquiliza y no recomienda.

Esto no es cautela genérica: el usuario tiene **hígado graso diagnosticado**, **probable apnea del sueño** y está **dejando de fumar**. En el uso real aparecieron dolor bajo el diafragma y ansiedad por abstinencia. Son exactamente los temas donde una app de fitness no debe opinar.

Casos que quedan fuera, explícitamente:

- Síntomas de cualquier tipo (dolor, mareo, molestia digestiva).
- Condiciones diagnosticadas y su evolución.
- Medicación, suplementación con interacción, o dosis.
- Deshabituación tabáquica y manejo de la ansiedad asociada.
- Interpretación de analíticas.

La app **sí** puede registrar que ocurrieron (§4.3, medidas de modelo abierto) para que el usuario los lleve a su médico. Lo que no hace es opinar sobre ellos.

### 11.6 Base de conocimiento

Sustituye a la "base curada de principios" de la v2.0, que nació como lista de 15-20 anclas para autorizar afirmaciones. Con §11.3 abierta, cambia de función: es el **material de referencia** del que sale el razonamiento.

- Sigue generándose con IA y **aprobándose por el usuario**: ese orden no cambia.
- Sigue cubriendo lo no controvertido: sobrecarga progresiva, rangos de proteína, sueño y recuperación, déficit y superávit, volumen mínimo efectivo, gestión de fatiga y descargas.
- Se amplía con reglas de progresión operativas (rangos de repeticiones, cuándo subir, cuándo consolidar) y estructura de rutinas, que es lo que el uso real demandaba.
- **Lo que no esté aprobado no se usa como apoyo.** Una base que se autoaprueba no cura nada.

### 11.7 Tono

`DECISIÓN`: feedback honesto por defecto, no validación. El usuario lo pidió explícitamente en el uso real: *"que no se le dé siempre la razón"*.

- Si los datos contradicen lo que el usuario cree, se dice.
- Si una decisión suya parece un error, se dice una vez, con el motivo, y se sigue.
- Sin motivación vacía ni respuestas genéricas.

**Animar sí; celebrar el registro no.** Son cosas distintas y la v3.0 las separa:

| Sí | No |
|----|-----|
| El mensaje cambia porque **el dato cambió**: "te faltan 800 g" donde antes decía "te faltan 3 kg" | Celebrar el acto de registrar: "¡bien hecho por apuntarlo!" |
| Señalar un hito real cuando se cruza | Rachas, medallas, confeti, contadores de días seguidos |
| Reconocer una tendencia sostenida que está en los datos | Ánimo genérico que diría lo mismo con cualquier dato |

*Motivo:* lo que la §21.1 prohíbe es premiar el registro, porque empuja a registrar para sentirse bien en vez de para medir bien. Que el texto se vuelva más cercano según te acercas al objetivo no es eso: es el dato hablando. La prueba para distinguirlos es simple — **si el mensaje diría lo mismo con datos peores, es motivación vacía.**

### 11.8 Modos de entrega

- **Bajo demanda:** el usuario pregunta en el chat y recibe respuesta inmediata.
- **Automático periódico:** resúmenes sin petición (ej. semanal), cruzando el histórico acumulado.

### 11.9 Datos insuficientes

Si el histórico es demasiado corto para lo que se pregunta, se reconoce explícitamente en vez de forzar una respuesta con poca base. Aplica sobre todo al nivel 3: aplicar una regla conocida (§11.3) no necesita histórico largo, inferir un patrón (§11.4) sí.

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
- **Estados de carga:** feedback visual mientras la IA procesa un mensaje o genera un insight (shimmer/pulso sutil, no un spinner genérico). La forma concreta está definida en §21.8.
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
| 1 | Cómo distingue el sistema una pregunta médica de una de entrenamiento | 11.5 | Al implementar la §11 revisada: es donde el límite se hace o se rompe |
| 2 | Ampliación del catálogo de ejercicios de 10-15 a 40-60 | 4.1 | Al empezar a usar la app en serio |
| 3 | Ampliación de la base de conocimiento del dominio | 11.6 | Gradual, según haga falta |
| 4 | Formato exacto de las preguntas rápidas de desviación de dieta | 6.3 | Al construir la Fase 1.5 |
| 5 | Segunda persona (Carol): plan propio, compra conjunta, rutinas coordinadas | Anexo C.5 | Cuando la §11 revisada esté implementada |
| 6 | Ejecución de la rutina 1:1 con Hevy: qué se copia exactamente | 5.2, 21 | Antes de tocar la sesión en vivo |
| 7 | Si el límite médico (§11.5) hace innecesaria la base de conocimiento (§11.6) | 11.3, 11.6 | Antes de aplicar la migración `0003` |
| 8 | Lista de la compra derivada del plan de dieta semanal | 6.1 | Con la Fase 1.5 en uso real |
| 9 | Clave de API, proveedor y modelo elegidos por el usuario | 14, 15 | Antes de abrir la app a nadie más |

**Sobre el 6.** "1:1 con Hevy" está sin acotar, y la respuesta cambia el trabajo entero. Copiar el *flujo* —serie a serie, temporizador de descanso, valores de la última sesión precargados, deslizar para completar— es compatible con lo que ya hay. Copiar además el *lenguaje visual* choca de frente con la §21, cerrada el 14 de agosto: la §21.2 obliga a arrancar la sesión en vivo en oscuro reforzado, y la §21.1 descarta el carácter de app que se celebra a sí misma. Hasta que no se decida cuál de las dos cosas es, no se empieza.

**Sobre el 7.** Las dos piezas no hacen el mismo trabajo, así que una no sustituye a la otra. El límite médico **corta**: hay preguntas que no se responden. La base de conocimiento **sostiene**: la §11.3 exige que toda recomendación de progresión o de dieta se apoye en material aprobado y diga en qué se apoya. Sin ella, el nivel 2 no desaparece — queda apoyado en lo que el modelo recuerde, que es justo lo que la §11.6 evita al exigir aprobación previa (*"una base que se autoaprueba no cura nada"*).

Si aun así se retira, hay que decidir qué pasa con el nivel 2: o baja entero a nivel 3 (observaciones sin conclusión), o se acepta recomendación sin anclaje. Y quedan sin uso la migración `0003`, `src/app/principios/`, `src/lib/ia/principios.ts` y `src/lib/datos/principios-acciones.ts`.

**Sobre el 9.** `src/lib/ia/proveedor.ts` es hoy, por decisión escrita en el propio archivo, *"un interruptor de desarrollo, no una capa de abstracción de proveedores"*. Dejar elegir proveedor y modelo al usuario lo convierte exactamente en lo segundo. Antes hay que resolver dos cosas que la §14 no cubre: dónde se guarda una clave de terceros (no en `mensaje_original`, no en texto plano) y qué se le enseña al usuario cuando su elección manda datos de salud a un tercero ajeno a Anthropic. La advertencia de la §14 deja de ser una nota para desarrolladores y pasa a ser interfaz.

*Cerrado:* la dirección visual (§21). Decidida el 14 de agosto de 2026 — ver §21 y decisión 13 del anexo B.

*Cerrado:* el refinamiento del marco de insights con uso real era el punto 1. Se hizo el 15 de agosto de 2026 al contrastar con la conversación real (anexo C), y produjo la §11 revisada.

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
| Acción | `#F97316` (texto encima `#0F172A`) | `#C2410C` (texto encima `#FFFFFF`) | Confirmar serie, guardar, enviar |
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

## 22. Estructura de navegación

### 22.1 Patrón

`DECISIÓN`: **drawer en móvil, barra lateral persistente en pantalla grande.** Un único componente de navegación con dos presentaciones según el ancho disponible, no dos menús distintos que haya que mantener en paralelo.

| Ancho | Presentación |
|-------|--------------|
| < 1024px | Oculto. Se abre con un botón en la cabecera y se superpone al contenido sobre un velo |
| ≥ 1024px | Barra lateral fija a la izquierda, 240px, siempre visible. Sin botón de menú |

`DECISIÓN`: se descarta la barra de navegación inferior de cinco iconos. La app tiene siete destinos (chat, entreno, dieta, historial, evolución, objetivos, ajustes) y una barra inferior soporta cinco como máximo antes de degradarse. Meter los dos restantes en un botón "más" convierte esa entrada en un cajón sin significado, y decidir cuáles caen dentro es una decisión arbitraria que el usuario tiene que aprender de memoria.

*Motivo del patrón dual:* en desktop hay espacio horizontal de sobra y esconder la navegación detrás de un clic no gana nada. En móvil, ese mismo espacio es el que necesitan los gráficos y las tablas del historial.

### 22.2 Destinos

Orden fijo en ambas presentaciones. La navegación no se reordena por uso reciente: la memoria muscular de "el tercero de la lista" vale más que la optimización.

| # | Destino | Contenido |
|---|---------|-----------|
| 1 | Hoy | Chat de entrada libre (§3) y check-in de dieta del día (§6.2) |
| 2 | Entreno | Rutinas guardadas (§5.1) y arranque de sesión en vivo |
| 3 | Dieta | Plan semanal (§6.1) |
| 4 | Historial | Lista filtrable de todos los registros (§8) |
| 5 | Evolución | Gráficos (§10) e insights (§11) |
| 6 | Objetivos | Objetivos y progreso (§9) |
| 7 | Ajustes | Unidades, exportación, cuenta (§13) |

El destino activo se marca con indicador de forma (barra lateral de acento) **además** de color, nunca solo con color — misma regla que §21.4.

### 22.3 La sesión en vivo no tiene navegación

`DECISIÓN`: la pantalla de sesión de entreno en vivo (§5.2) **no muestra el botón de menú ni la barra lateral**, en ningún ancho. Su única salida es un control explícito de terminar o pausar la sesión.

*Motivo:* es la pantalla que se usa de pie, con prisa y con las manos sudadas (§5.2, §21.2). Un icono de menú ahí ocupa la superficie táctil más escasa de la app y añade una forma de salirse del entreno por accidente. La sesión persistente de §5.3 protege contra perder los datos, pero no contra la interrupción.

### 22.4 Requisitos de comportamiento

- **Foco:** al abrirse el drawer, el foco entra en él y queda contenido mientras está abierto; al cerrarse, vuelve al botón que lo abrió.
- **Cierre:** con `Escape`, tocando el velo, o deslizando hacia el lado. El botón de menú refleja su estado con `aria-expanded` y apunta al panel con `aria-controls`.
- **Historial del navegador:** abrir el drawer **no** crea una entrada de historial. El botón atrás vuelve a la página anterior, no cierra el menú.
- **Objetivos táctiles:** botón de menú y entradas del drawer cumplen el mínimo de 44×44px de §21.7.
- **Sin desplazamiento del contenido:** el drawer se superpone, no empuja la página. En la barra lateral persistente sí se reserva el espacio en el layout, sin solapar.
- **Movimiento:** entrada 200ms, salida 150ms; bajo `prefers-reduced-motion: reduce`, aparece y desaparece sin desplazamiento.

---

## 23. Devolución

`DECISIÓN`: la entrada por lenguaje natural **no produce una conversación**. Produce una **devolución**: la app digiere lo que escribes y te devuelve una lectura estructurada, en su propio lenguaje visual. Sin burbujas de mensaje, sin hilo, sin historial de chat.

*Motivo:* el uso real (anexo C) mostraba a un asistente devolviendo lecturas del estado —"has roto la barrera de los 117, la tendencia sigue bajando"—, y eso es lo que hacía falta. Pero un hilo de conversación arrastra consigo el formato chat, que empuja al tono que la §21.1 descarta y abre la puerta a preguntar cualquier cosa, incluido lo que la §11.5 no debe responder. Un panel devuelve lo que la app sabe calcular.

`DECISIÓN`: se descarta el chat conversacional con historial. La entrada de texto se mantiene —es la vía más rápida de soltar *"hoy 116,9, comí X, entrené Y"*— pero es un campo de entrada, no un interlocutor.

### 23.1 Dos superficies

| Superficie | Cuándo | Qué muestra |
|------------|--------|-------------|
| **Devolución inmediata** | Justo después de registrar | La lectura de lo que acabas de meter. Se queda hasta el siguiente registro |
| **Panel de estado** | Cuando quieras consultarlo | Tu situación general: peso y tendencia, adherencia, cargas, progreso hacia objetivos |

La primera responde a *"¿y esto qué significa?"*; la segunda a *"¿cómo voy?"*. Comparten el mismo motor de cálculo: la devolución inmediata es ese motor aplicado a un registro concreto.

### 23.2 Qué devuelve cada tipo de dato

**Medida corporal** — el valor, el cambio desde el inicio y desde el registro anterior, la tendencia reciente, y el progreso hacia el objetivo si existe.

**Entreno** — series y volumen de la sesión, qué ejercicios subieron respecto a la última vez, PRs si los hubo, y qué toca la próxima vez según la regla de progresión (§11.3).

**Comida** — adherencia al plan del día y macros acumulados frente al objetivo.

### 23.3 Preguntas

Una pregunta que no es un registro **también devuelve un bloque**, no prosa: *"¿cuánto he perdido?"* devuelve el bloque de evolución de peso; *"¿cuántas calorías estoy comiendo?"* devuelve el de ingesta. La pregunta elige qué te enseña la app.

El bloque puede ir acompañado de **una frase corta** cuando aporta algo que el bloque no dice por sí solo (*"llevas tres semanas bajando de forma sostenida"*).

`ABIERTO`: esa frase es la puerta por la que puede volver a entrar el tono de chat. Regla de contención mientras se ajusta: **una sola frase, y solo si dice algo que los números no dicen ya.** Si repite lo que hay justo encima, sobra.

### 23.4 Tono de la devolución

Se rige por la §11.7. En concreto: el texto **puede cambiar según te acerques al objetivo** —"te faltan 800 g" donde antes decía "te faltan 3 kg"— porque eso es el dato hablando. Lo que no hace es premiar el hecho de haber registrado.

La prueba para distinguirlos, tomada de la §11.7: **si el mensaje diría lo mismo con datos peores, sobra.**

### 23.5 Qué pasa cuando salta el límite médico

Si el texto activa el límite (§11.5), la devolución **no interpreta**: registra lo registrable y muestra el aviso. No se acompaña de lectura ni de frase de ánimo. Un panel que devuelve "vas muy bien" junto a un síntoma sin interpretar sería peor que no decir nada.

---

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
| 16 | Drawer en móvil + barra lateral en desktop | Barra de navegación inferior de 5 iconos | Hay 7 destinos; los dos sobrantes acabarían en un "más" arbitrario | 22.1 |
| 17 | Sesión en vivo sin navegación | Cabecera con menú igual que el resto de pantallas | Superficie táctil escasa y riesgo de salir del entreno sin querer | 22.3 |

---

## Anexo C — Análisis del uso real (contraste con la v2.0)

Origen de la revisión de la §11. Se analizó una conversación de un mes con un asistente genérico (Gemini), que es como el usuario llevaba el seguimiento antes de esta app.

### C.1 Reparto de los mensajes

De 113 mensajes del usuario:

| Qué hacía | Mensajes | % |
|-----------|---------:|--:|
| Pegar entrenos exportados de Hevy | 9 | 8 % |
| Registrar peso | ~9 | 8 % |
| Registrar medidas corporales | 1 | 1 % |
| **Conversación: preguntas, decisiones, acompañamiento** | **~94** | **83 %** |

**Solo 1 de cada 6 mensajes era registrar datos.** Una app que solo acepta ese sexto no sustituye la conversación: obliga a mantener las dos abiertas.

### C.2 De qué trataba la conversación

| Tema | Mensajes aprox. |
|------|----------------:|
| Dejar de fumar (ansiedad, recaída, impacto en la relación) | 17 |
| Rediseño de rutina (de full-body a split de 4 días) | 19 |
| Dudas de comida y sustituciones | 12 |
| Preguntas sobre el propio histórico (cuánto he perdido, cuántas kcal como) | 8 |
| Composición corporal y medidas | 5 |
| Equipamiento (pulseras de actividad) | 5 |
| Carol (segunda persona) | 4 |
| Síntomas físicos | 2 |

### C.3 Hallazgo que motivó la revisión

Casi nada de lo valioso que hacía el asistente era **inferir patrones del histórico personal** — el riesgo contra el que se diseñó la v2.0. Era **aplicar conocimiento establecido** a la situación concreta:

> *"Cerraste las 12 repeticiones limpias en el jalón → sube a 60 kg"* no sale de buscar correlaciones en sus datos. Sale de una regla de progresión conocida.

La v2.0 trataba ambas cosas igual y bloqueaba lo útil junto con lo peligroso. La §11 revisada las separa.

### C.4 Lo que confirmó las cautelas existentes

- **Señales médicas reales:** dolor bajo el diafragma con hígado graso diagnosticado, apnea del sueño probable, deshabituación tabáquica. El hilo más largo de toda la conversación no era de fitness. Motiva el límite de la §11.5.
- **Tono pedido explícitamente:** *"feedback honesto; que no se le dé siempre la razón"*. Recogido en la §11.7.
- **Pérdida de contexto:** un mensaje del usuario reprocha al asistente haber olvidado sus referencias. Es justo lo que evita tener el histórico estructurado (§7.1) en vez de dentro de un hilo de chat.

### C.5 Pendiente derivado: segunda persona

La conversación incluye a una segunda persona (Carol) con plan propio, compra conjunta y rutinas coordinadas para coincidir en grupos musculares. El modelo de datos ya lo soporta (`user_id` desde la primera migración), pero no hay nada construido. Ver §19.
