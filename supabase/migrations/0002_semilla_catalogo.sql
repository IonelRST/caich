-- =============================================================================
-- caich — Semilla inicial del catálogo de ejercicios (ESPECIFICACION.md anexo A)
--
-- user_id null = ejercicio global, visible para todos los usuarios.
--
-- Motivo (§4.1): si el catálogo naciera vacío, el flujo de confirmación de
-- ejercicio nuevo se dispararía constantemente en las primeras sesiones — justo
-- cuando más se nota la fricción y menos tolerancia hay a que algo falle.
--
-- Estos 15 cubren los patrones básicos, suficientes para probar el flujo
-- completo. La ampliación a 40-60 queda pendiente (§19, punto 2).
-- =============================================================================

insert into catalogo_ejercicio (user_id, nombre_canonico, alias, grupo_muscular, equipo) values
  (null, 'Sentadilla trasera',    array['squat','back squat','sentadilla','sentadillas'],                'Pierna (cuádriceps)',        'Barra'),
  (null, 'Sentadilla frontal',    array['front squat','frontal','sentadilla frontal'],                   'Pierna (cuádriceps)',        'Barra'),
  (null, 'Prensa de piernas',     array['prensa','leg press','prensa piernas'],                          'Pierna (cuádriceps)',        'Máquina'),
  (null, 'Peso muerto',           array['deadlift','muerto','peso muerto convencional'],                 'Espalda / cadena posterior', 'Barra'),
  (null, 'Peso muerto rumano',    array['rdl','romanian deadlift','rumano','peso muerto piernas rectas'],'Femoral / glúteo',           'Barra'),
  (null, 'Hip thrust',            array['empuje de cadera','thrust','elevacion de cadera'],              'Glúteo',                     'Barra'),
  (null, 'Press de banca',        array['bench press','banca','press banca','press pecho'],              'Pecho',                      'Barra'),
  (null, 'Press inclinado',       array['incline press','inclinado','press banca inclinado'],            'Pecho (superior)',           'Barra / mancuernas'),
  (null, 'Press militar',         array['overhead press','ohp','militar','press hombro'],                'Hombro',                     'Barra'),
  (null, 'Dominadas',             array['pull up','pullups','dominada','pull-ups'],                      'Espalda',                    'Peso corporal'),
  (null, 'Jalón al pecho',        array['lat pulldown','jalon','polea alta','jalon pecho'],              'Espalda',                    'Polea'),
  (null, 'Remo con barra',        array['barbell row','remo','remo barra'],                              'Espalda',                    'Barra'),
  (null, 'Curl de bíceps',        array['biceps curl','curl','curl biceps'],                             'Bíceps',                     'Barra / mancuernas'),
  (null, 'Extensión de tríceps',  array['triceps extension','extensiones','extension triceps'],          'Tríceps',                    'Polea / mancuerna'),
  (null, 'Zancadas',              array['lunges','lunge','zancada','desplantes'],                        'Pierna',                     'Mancuernas / peso corporal');
