-- Reset workouts and insert Musa Fit 20 dias schedule (T-A..T-E repeated 4x)
DELETE FROM workouts;

-- Helper notes:
-- Fields in exercises JSON: exercise, sets, reps, note, group, type

-- T-A: Glúteo e Posterior
INSERT INTO workouts (day_number, title, exercises, video_url) VALUES
(1, 'T-A: Glúteo e Posterior',
  '[
    {"exercise":"Aquecimento - Cadeira Abdutora","sets":"2","reps":"20","note":"carga leve","type":"warmup"},
    {"exercise":"Cadeira Abdutora","sets":"5","reps":"15,12,10,6,6","note":"carga progressiva"},
    {"exercise":"Elevação Pélvica","sets":"4","reps":"15,12,10,6","note":"carga progressiva"},
    {"exercise":"Agachamento Sumô no Step","sets":"4","reps":"10-12"},
    {"exercise":"Búlgaro","sets":"3","reps":"10-12"},
    {"exercise":"Cadeira Flexora","sets":"3","reps":"bi-set","group":"A","note":"com Stiff com Barra"},
    {"exercise":"Stiff com Barra","sets":"3","reps":"bi-set","group":"A"},
    {"exercise":"Panturrilha","sets":"3","reps":"10-12"}
  ]',
  'https://www.youtube.com/shorts/5QXUBKWqe4w'
),
(6, 'T-A: Glúteo e Posterior',
  '[
    {"exercise":"Aquecimento - Cadeira Abdutora","sets":"2","reps":"20","note":"carga leve","type":"warmup"},
    {"exercise":"Cadeira Abdutora","sets":"5","reps":"15,12,10,6,6","note":"carga progressiva"},
    {"exercise":"Elevação Pélvica","sets":"4","reps":"15,12,10,6","note":"carga progressiva"},
    {"exercise":"Agachamento Sumô no Step","sets":"4","reps":"10-12"},
    {"exercise":"Búlgaro","sets":"3","reps":"10-12"},
    {"exercise":"Cadeira Flexora","sets":"3","reps":"bi-set","group":"A","note":"com Stiff com Barra"},
    {"exercise":"Stiff com Barra","sets":"3","reps":"bi-set","group":"A"},
    {"exercise":"Panturrilha","sets":"3","reps":"10-12"}
  ]',
  'https://www.youtube.com/shorts/5QXUBKWqe4w'
),
(11, 'T-A: Glúteo e Posterior',
  '[
    {"exercise":"Aquecimento - Cadeira Abdutora","sets":"2","reps":"20","note":"carga leve","type":"warmup"},
    {"exercise":"Cadeira Abdutora","sets":"5","reps":"15,12,10,6,6","note":"carga progressiva"},
    {"exercise":"Elevação Pélvica","sets":"4","reps":"15,12,10,6","note":"carga progressiva"},
    {"exercise":"Agachamento Sumô no Step","sets":"4","reps":"10-12"},
    {"exercise":"Búlgaro","sets":"3","reps":"10-12"},
    {"exercise":"Cadeira Flexora","sets":"3","reps":"bi-set","group":"A","note":"com Stiff com Barra"},
    {"exercise":"Stiff com Barra","sets":"3","reps":"bi-set","group":"A"},
    {"exercise":"Panturrilha","sets":"3","reps":"10-12"}
  ]',
  'https://www.youtube.com/shorts/5QXUBKWqe4w'
),
(16, 'T-A: Glúteo e Posterior',
  '[
    {"exercise":"Aquecimento - Cadeira Abdutora","sets":"2","reps":"20","note":"carga leve","type":"warmup"},
    {"exercise":"Cadeira Abdutora","sets":"5","reps":"15,12,10,6,6","note":"carga progressiva"},
    {"exercise":"Elevação Pélvica","sets":"4","reps":"15,12,10,6","note":"carga progressiva"},
    {"exercise":"Agachamento Sumô no Step","sets":"4","reps":"10-12"},
    {"exercise":"Búlgaro","sets":"3","reps":"10-12"},
    {"exercise":"Cadeira Flexora","sets":"3","reps":"bi-set","group":"A","note":"com Stiff com Barra"},
    {"exercise":"Stiff com Barra","sets":"3","reps":"bi-set","group":"A"},
    {"exercise":"Panturrilha","sets":"3","reps":"10-12"}
  ]',
  'https://www.youtube.com/shorts/5QXUBKWqe4w'
);

-- T-B: Costas e Bíceps
INSERT INTO workouts (day_number, title, exercises, video_url) VALUES
(2, 'T-B: Costas e Bíceps',
  '[
    {"exercise":"Remada Curvada com Barra","sets":"4","reps":"10-12"},
    {"exercise":"Remada na Máquina (Pegada Neutra)","sets":"4","reps":"15,12,10,10","note":"carga progressiva"},
    {"exercise":"Puxada Frente Aberta","sets":"4","reps":"10-12"},
    {"exercise":"Pulldown","sets":"4","reps":"10-12"},
    {"exercise":"Rosca Scott","sets":"3","reps":"12"},
    {"exercise":"Bíceps Barra","sets":"3","reps":"12"},
    {"exercise":"Prancha (pós-treino)","sets":"2","reps":"30s-1min","type":"core"}
  ]',
  'https://www.youtube.com/shorts/R9buc95ALUk'
),
(7, 'T-B: Costas e Bíceps',
  '[
    {"exercise":"Remada Curvada com Barra","sets":"4","reps":"10-12"},
    {"exercise":"Remada na Máquina (Pegada Neutra)","sets":"4","reps":"15,12,10,10","note":"carga progressiva"},
    {"exercise":"Puxada Frente Aberta","sets":"4","reps":"10-12"},
    {"exercise":"Pulldown","sets":"4","reps":"10-12"},
    {"exercise":"Rosca Scott","sets":"3","reps":"12"},
    {"exercise":"Bíceps Barra","sets":"3","reps":"12"},
    {"exercise":"Prancha (pós-treino)","sets":"2","reps":"30s-1min","type":"core"}
  ]',
  'https://www.youtube.com/shorts/R9buc95ALUk'
),
(12, 'T-B: Costas e Bíceps',
  '[
    {"exercise":"Remada Curvada com Barra","sets":"4","reps":"10-12"},
    {"exercise":"Remada na Máquina (Pegada Neutra)","sets":"4","reps":"15,12,10,10","note":"carga progressiva"},
    {"exercise":"Puxada Frente Aberta","sets":"4","reps":"10-12"},
    {"exercise":"Pulldown","sets":"4","reps":"10-12"},
    {"exercise":"Rosca Scott","sets":"3","reps":"12"},
    {"exercise":"Bíceps Barra","sets":"3","reps":"12"},
    {"exercise":"Prancha (pós-treino)","sets":"2","reps":"30s-1min","type":"core"}
  ]',
  'https://www.youtube.com/shorts/R9buc95ALUk'
),
(17, 'T-B: Costas e Bíceps',
  '[
    {"exercise":"Remada Curvada com Barra","sets":"4","reps":"10-12"},
    {"exercise":"Remada na Máquina (Pegada Neutra)","sets":"4","reps":"15,12,10,10","note":"carga progressiva"},
    {"exercise":"Puxada Frente Aberta","sets":"4","reps":"10-12"},
    {"exercise":"Pulldown","sets":"4","reps":"10-12"},
    {"exercise":"Rosca Scott","sets":"3","reps":"12"},
    {"exercise":"Bíceps Barra","sets":"3","reps":"12"},
    {"exercise":"Prancha (pós-treino)","sets":"2","reps":"30s-1min","type":"core"}
  ]',
  'https://www.youtube.com/shorts/R9buc95ALUk'
);

-- T-C: Quadríceps
INSERT INTO workouts (day_number, title, exercises, video_url) VALUES
(3, 'T-C: Quadríceps',
  '[
    {"exercise":"Aquecimento - Agachamento sem peso","sets":"2","reps":"20","type":"warmup"},
    {"exercise":"Afundo (Drop Set)","sets":"3","reps":"12 + 10","note":"com e sem peso"},
    {"exercise":"Agachamento Livre ou Smith","sets":"4","reps":"15,12,10,6","note":"carga progressiva"},
    {"exercise":"Leg Press","sets":"4","reps":"15,12,10,6","note":"carga progressiva"},
    {"exercise":"Cadeira Extensora","sets":"3","reps":"aumentando carga","note":"+ 1 Drop Set final 30 reps"},
    {"exercise":"Cadeira Extensora (Drop Set Final)","sets":"1","reps":"10+10+10","note":"alta→média→leve","type":"drop_set"}
  ]',
  'https://www.youtube.com/shorts/FA8JMD09M4E'
),
(8, 'T-C: Quadríceps',
  '[
    {"exercise":"Aquecimento - Agachamento sem peso","sets":"2","reps":"20","type":"warmup"},
    {"exercise":"Afundo (Drop Set)","sets":"3","reps":"12 + 10","note":"com e sem peso"},
    {"exercise":"Agachamento Livre ou Smith","sets":"4","reps":"15,12,10,6","note":"carga progressiva"},
    {"exercise":"Leg Press","sets":"4","reps":"15,12,10,6","note":"carga progressiva"},
    {"exercise":"Cadeira Extensora","sets":"3","reps":"aumentando carga","note":"+ 1 Drop Set final 30 reps"},
    {"exercise":"Cadeira Extensora (Drop Set Final)","sets":"1","reps":"10+10+10","note":"alta→média→leve","type":"drop_set"}
  ]',
  'https://www.youtube.com/shorts/FA8JMD09M4E'
),
(13, 'T-C: Quadríceps',
  '[
    {"exercise":"Aquecimento - Agachamento sem peso","sets":"2","reps":"20","type":"warmup"},
    {"exercise":"Afundo (Drop Set)","sets":"3","reps":"12 + 10","note":"com e sem peso"},
    {"exercise":"Agachamento Livre ou Smith","sets":"4","reps":"15,12,10,6","note":"carga progressiva"},
    {"exercise":"Leg Press","sets":"4","reps":"15,12,10,6","note":"carga progressiva"},
    {"exercise":"Cadeira Extensora","sets":"3","reps":"aumentando carga","note":"+ 1 Drop Set final 30 reps"},
    {"exercise":"Cadeira Extensora (Drop Set Final)","sets":"1","reps":"10+10+10","note":"alta→média→leve","type":"drop_set"}
  ]',
  'https://www.youtube.com/shorts/FA8JMD09M4E'
),
(18, 'T-C: Quadríceps',
  '[
    {"exercise":"Aquecimento - Agachamento sem peso","sets":"2","reps":"20","type":"warmup"},
    {"exercise":"Afundo (Drop Set)","sets":"3","reps":"12 + 10","note":"com e sem peso"},
    {"exercise":"Agachamento Livre ou Smith","sets":"4","reps":"15,12,10,6","note":"carga progressiva"},
    {"exercise":"Leg Press","sets":"4","reps":"15,12,10,6","note":"carga progressiva"},
    {"exercise":"Cadeira Extensora","sets":"3","reps":"aumentando carga","note":"+ 1 Drop Set final 30 reps"},
    {"exercise":"Cadeira Extensora (Drop Set Final)","sets":"1","reps":"10+10+10","note":"alta→média→leve","type":"drop_set"}
  ]',
  'https://www.youtube.com/shorts/FA8JMD09M4E'
);

-- T-D: Ombro e Tríceps
INSERT INTO workouts (day_number, title, exercises, video_url) VALUES
(4, 'T-D: Ombro e Tríceps',
  '[
    {"exercise":"Desenvolvimento com Barra","sets":"4","reps":"10-12"},
    {"exercise":"Elevação Lateral sentado (Drop Set)","sets":"3","reps":"12 + 12","note":"peso maior→menor","type":"drop_set"},
    {"exercise":"Elevação Frontal com Anilha","sets":"3","reps":"20"},
    {"exercise":"Face Pull","sets":"4","reps":"10-12"},
    {"exercise":"Tríceps Francês com Halter","sets":"3","reps":"10-12"},
    {"exercise":"Tríceps Corda","sets":"4","reps":"10-12"},
    {"exercise":"Abdominal (Remador)","sets":"3","reps":"12","type":"core"}
  ]',
  'https://www.youtube.com/shorts/H59irhx1u14'
),
(9, 'T-D: Ombro e Tríceps',
  '[
    {"exercise":"Desenvolvimento com Barra","sets":"4","reps":"10-12"},
    {"exercise":"Elevação Lateral sentado (Drop Set)","sets":"3","reps":"12 + 12","note":"peso maior→menor","type":"drop_set"},
    {"exercise":"Elevação Frontal com Anilha","sets":"3","reps":"20"},
    {"exercise":"Face Pull","sets":"4","reps":"10-12"},
    {"exercise":"Tríceps Francês com Halter","sets":"3","reps":"10-12"},
    {"exercise":"Tríceps Corda","sets":"4","reps":"10-12"},
    {"exercise":"Abdominal (Remador)","sets":"3","reps":"12","type":"core"}
  ]',
  'https://www.youtube.com/shorts/H59irhx1u14'
),
(14, 'T-D: Ombro e Tríceps',
  '[
    {"exercise":"Desenvolvimento com Barra","sets":"4","reps":"10-12"},
    {"exercise":"Elevação Lateral sentado (Drop Set)","sets":"3","reps":"12 + 12","note":"peso maior→menor","type":"drop_set"},
    {"exercise":"Elevação Frontal com Anilha","sets":"3","reps":"20"},
    {"exercise":"Face Pull","sets":"4","reps":"10-12"},
    {"exercise":"Tríceps Francês com Halter","sets":"3","reps":"10-12"},
    {"exercise":"Tríceps Corda","sets":"4","reps":"10-12"},
    {"exercise":"Abdominal (Remador)","sets":"3","reps":"12","type":"core"}
  ]',
  'https://www.youtube.com/shorts/H59irhx1u14'
),
(19, 'T-D: Ombro e Tríceps',
  '[
    {"exercise":"Desenvolvimento com Barra","sets":"4","reps":"10-12"},
    {"exercise":"Elevação Lateral sentado (Drop Set)","sets":"3","reps":"12 + 12","note":"peso maior→menor","type":"drop_set"},
    {"exercise":"Elevação Frontal com Anilha","sets":"3","reps":"20"},
    {"exercise":"Face Pull","sets":"4","reps":"10-12"},
    {"exercise":"Tríceps Francês com Halter","sets":"3","reps":"10-12"},
    {"exercise":"Tríceps Corda","sets":"4","reps":"10-12"},
    {"exercise":"Abdominal (Remador)","sets":"3","reps":"12","type":"core"}
  ]',
  'https://www.youtube.com/shorts/H59irhx1u14'
);

-- T-E: Inferiores Completo
INSERT INTO workouts (day_number, title, exercises, video_url) VALUES
(5, 'T-E: Inferiores Completo',
  '[
    {"exercise":"Aquecimento - Agachamento","sets":"2","reps":"20","type":"warmup"},
    {"exercise":"Búlgaro","sets":"3","reps":"12"},
    {"exercise":"Elevação Pélvica","sets":"4","reps":"10-12"},
    {"exercise":"Cadeira Abdutora","sets":"4","reps":"15,12,10,6","note":"carga progressiva"},
    {"exercise":"Stiff com Barra","sets":"4","reps":"10-12"},
    {"exercise":"Cadeira Extensora","sets":"3","reps":"12","group":"B","note":"Bi-set com Agachamento Taça"},
    {"exercise":"Agachamento Taça","sets":"3","reps":"12","group":"B","note":"Bi-set"}
  ]',
  'https://www.youtube.com/shorts/AiiK07TgAio'
),
(10, 'T-E: Inferiores Completo',
  '[
    {"exercise":"Aquecimento - Agachamento","sets":"2","reps":"20","type":"warmup"},
    {"exercise":"Búlgaro","sets":"3","reps":"12"},
    {"exercise":"Elevação Pélvica","sets":"4","reps":"10-12"},
    {"exercise":"Cadeira Abdutora","sets":"4","reps":"15,12,10,6","note":"carga progressiva"},
    {"exercise":"Stiff com Barra","sets":"4","reps":"10-12"},
    {"exercise":"Cadeira Extensora","sets":"3","reps":"12","group":"B","note":"Bi-set com Agachamento Taça"},
    {"exercise":"Agachamento Taça","sets":"3","reps":"12","group":"B","note":"Bi-set"}
  ]',
  'https://www.youtube.com/shorts/AiiK07TgAio'
),
(15, 'T-E: Inferiores Completo',
  '[
    {"exercise":"Aquecimento - Agachamento","sets":"2","reps":"20","type":"warmup"},
    {"exercise":"Búlgaro","sets":"3","reps":"12"},
    {"exercise":"Elevação Pélvica","sets":"4","reps":"10-12"},
    {"exercise":"Cadeira Abdutora","sets":"4","reps":"15,12,10,6","note":"carga progressiva"},
    {"exercise":"Stiff com Barra","sets":"4","reps":"10-12"},
    {"exercise":"Cadeira Extensora","sets":"3","reps":"12","group":"B","note":"Bi-set com Agachamento Taça"},
    {"exercise":"Agachamento Taça","sets":"3","reps":"12","group":"B","note":"Bi-set"}
  ]',
  'https://www.youtube.com/shorts/AiiK07TgAio'
),
(20, 'T-E: Inferiores Completo',
  '[
    {"exercise":"Aquecimento - Agachamento","sets":"2","reps":"20","type":"warmup"},
    {"exercise":"Búlgaro","sets":"3","reps":"12"},
    {"exercise":"Elevação Pélvica","sets":"4","reps":"10-12"},
    {"exercise":"Cadeira Abdutora","sets":"4","reps":"15,12,10,6","note":"carga progressiva"},
    {"exercise":"Stiff com Barra","sets":"4","reps":"10-12"},
    {"exercise":"Cadeira Extensora","sets":"3","reps":"12","group":"B","note":"Bi-set com Agachamento Taça"},
    {"exercise":"Agachamento Taça","sets":"3","reps":"12","group":"B","note":"Bi-set"}
  ]',
  'https://www.youtube.com/shorts/AiiK07TgAio'
);

