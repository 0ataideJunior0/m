-- Replace workouts with new M-* schedule (20 active days)
DELETE FROM workouts;

-- M-A: Quadríceps (days 1,8,15)
INSERT INTO workouts (day_number, title, exercises, video_url) VALUES
(1, 'M-A: Treino de Quadríceps',
  '[
    {"exercise":"Aquecimento - Agachamento sem peso","sets":"2","reps":"20","type":"warmup"},
    {"exercise":"Afundo (Drop Set)","sets":"3","reps":"12 + 10","note":"com peso → sem peso"},
    {"exercise":"Agachamento Livre ou Smith","sets":"4","reps":"15,12,10,6","note":"carga progressiva"},
    {"exercise":"Leg Press","sets":"4","reps":"15,12,10,6","note":"carga progressiva"},
    {"exercise":"Cadeira Extensora","sets":"3","reps":"aumentando carga","note":"+ Drop Set final 30 reps"},
    {"exercise":"Cadeira Extensora (Drop Set Final)","sets":"1","reps":"10+10+10","note":"alta→média→leve","type":"drop_set"}
  ]',
  NULL
),
(8, 'M-A: Treino de Quadríceps',
  '[
    {"exercise":"Aquecimento - Agachamento sem peso","sets":"2","reps":"20","type":"warmup"},
    {"exercise":"Afundo (Drop Set)","sets":"3","reps":"12 + 10","note":"com peso → sem peso"},
    {"exercise":"Agachamento Livre ou Smith","sets":"4","reps":"15,12,10,6","note":"carga progressiva"},
    {"exercise":"Leg Press","sets":"4","reps":"15,12,10,6","note":"carga progressiva"},
    {"exercise":"Cadeira Extensora","sets":"3","reps":"aumentando carga","note":"+ Drop Set final 30 reps"},
    {"exercise":"Cadeira Extensora (Drop Set Final)","sets":"1","reps":"10+10+10","note":"alta→média→leve","type":"drop_set"}
  ]',
  NULL
),
(15, 'M-A: Treino de Quadríceps',
  '[
    {"exercise":"Aquecimento - Agachamento sem peso","sets":"2","reps":"20","type":"warmup"},
    {"exercise":"Afundo (Drop Set)","sets":"3","reps":"12 + 10","note":"com peso → sem peso"},
    {"exercise":"Agachamento Livre ou Smith","sets":"4","reps":"15,12,10,6","note":"carga progressiva"},
    {"exercise":"Leg Press","sets":"4","reps":"15,12,10,6","note":"carga progressiva"},
    {"exercise":"Cadeira Extensora","sets":"3","reps":"aumentando carga","note":"+ Drop Set final 30 reps"},
    {"exercise":"Cadeira Extensora (Drop Set Final)","sets":"1","reps":"10+10+10","note":"alta→média→leve","type":"drop_set"}
  ]',
  NULL
);

-- M-B: Costas e Bíceps (2,9,16)
INSERT INTO workouts (day_number, title, exercises, video_url) VALUES
(2, 'M-B: Costas e Bíceps',
  '[
    {"exercise":"Remada Curvada com Barra","sets":"4","reps":"10-12"},
    {"exercise":"Remada na Máquina (Pegada Neutra)","sets":"4","reps":"15,12,10,10","note":"carga progressiva"},
    {"exercise":"Puxada Frente Aberta","sets":"4","reps":"10-12"},
    {"exercise":"Pulldown","sets":"4","reps":"10-12"},
    {"exercise":"Rosca Scott","sets":"3","reps":"12"},
    {"exercise":"Bíceps Barra","sets":"3","reps":"12"},
    {"exercise":"Prancha (pós-treino)","sets":"2","reps":"30s-1min","type":"core"}
  ]',
  NULL
),
(9, 'M-B: Costas e Bíceps',
  '[
    {"exercise":"Remada Curvada com Barra","sets":"4","reps":"10-12"},
    {"exercise":"Remada na Máquina (Pegada Neutra)","sets":"4","reps":"15,12,10,10","note":"carga progressiva"},
    {"exercise":"Puxada Frente Aberta","sets":"4","reps":"10-12"},
    {"exercise":"Pulldown","sets":"4","reps":"10-12"},
    {"exercise":"Rosca Scott","sets":"3","reps":"12"},
    {"exercise":"Bíceps Barra","sets":"3","reps":"12"},
    {"exercise":"Prancha (pós-treino)","sets":"2","reps":"30s-1min","type":"core"}
  ]',
  NULL
),
(16, 'M-B: Costas e Bíceps',
  '[
    {"exercise":"Remada Curvada com Barra","sets":"4","reps":"10-12"},
    {"exercise":"Remada na Máquina (Pegada Neutra)","sets":"4","reps":"15,12,10,10","note":"carga progressiva"},
    {"exercise":"Puxada Frente Aberta","sets":"4","reps":"10-12"},
    {"exercise":"Pulldown","sets":"4","reps":"10-12"},
    {"exercise":"Rosca Scott","sets":"3","reps":"12"},
    {"exercise":"Bíceps Barra","sets":"3","reps":"12"},
    {"exercise":"Prancha (pós-treino)","sets":"2","reps":"30s-1min","type":"core"}
  ]',
  NULL
);

-- M-C: Glúteo e Posterior (3,10,17)
INSERT INTO workouts (day_number, title, exercises, video_url) VALUES
(3, 'M-C: Glúteo e Posterior',
  '[
    {"exercise":"Aquecimento - Cadeira Abdutora","sets":"2","reps":"20","note":"carga leve","type":"warmup"},
    {"exercise":"Cadeira Abdutora","sets":"5","reps":"15,12,10,6,6","note":"carga progressiva"},
    {"exercise":"Elevação Pélvica","sets":"4","reps":"15,12,10,6","note":"carga progressiva"},
    {"exercise":"Agachamento Sumô no Step","sets":"4","reps":"10-12"},
    {"exercise":"Búlgaro","sets":"3","reps":"10-12"},
    {"exercise":"Cadeira Flexora","sets":"3","reps":"bi-set","group":"A","note":"com Stiff"},
    {"exercise":"Stiff com Barra","sets":"3","reps":"bi-set","group":"A"},
    {"exercise":"Panturrilha","sets":"3","reps":"10-12"}
  ]',
  NULL
),
(10, 'M-C: Glúteo e Posterior',
  '[
    {"exercise":"Aquecimento - Cadeira Abdutora","sets":"2","reps":"20","note":"carga leve","type":"warmup"},
    {"exercise":"Cadeira Abdutora","sets":"5","reps":"15,12,10,6,6","note":"carga progressiva"},
    {"exercise":"Elevação Pélvica","sets":"4","reps":"15,12,10,6","note":"carga progressiva"},
    {"exercise":"Agachamento Sumô no Step","sets":"4","reps":"10-12"},
    {"exercise":"Búlgaro","sets":"3","reps":"10-12"},
    {"exercise":"Cadeira Flexora","sets":"3","reps":"bi-set","group":"A","note":"com Stiff"},
    {"exercise":"Stiff com Barra","sets":"3","reps":"bi-set","group":"A"},
    {"exercise":"Panturrilha","sets":"3","reps":"10-12"}
  ]',
  NULL
),
(17, 'M-C: Glúteo e Posterior',
  '[
    {"exercise":"Aquecimento - Cadeira Abdutora","sets":"2","reps":"20","note":"carga leve","type":"warmup"},
    {"exercise":"Cadeira Abdutora","sets":"5","reps":"15,12,10,6,6","note":"carga progressiva"},
    {"exercise":"Elevação Pélvica","sets":"4","reps":"15,12,10,6","note":"carga progressiva"},
    {"exercise":"Agachamento Sumô no Step","sets":"4","reps":"10-12"},
    {"exercise":"Búlgaro","sets":"3","reps":"10-12"},
    {"exercise":"Cadeira Flexora","sets":"3","reps":"bi-set","group":"A","note":"com Stiff"},
    {"exercise":"Stiff com Barra","sets":"3","reps":"bi-set","group":"A"},
    {"exercise":"Panturrilha","sets":"3","reps":"10-12"}
  ]',
  NULL
);

-- M-D: Ombro e Tríceps (4,11,18)
INSERT INTO workouts (day_number, title, exercises, video_url) VALUES
(4, 'M-D: Ombro e Tríceps',
  '[
    {"exercise":"Desenvolvimento com Barra","sets":"4","reps":"10-12"},
    {"exercise":"Elevação Lateral (Drop Set)","sets":"3","reps":"12 + 12","note":"peso maior→menor","type":"drop_set"},
    {"exercise":"Elevação Frontal com Anilha","sets":"3","reps":"20"},
    {"exercise":"Face Pull","sets":"4","reps":"10-12"},
    {"exercise":"Tríceps Francês com Halter","sets":"3","reps":"10-12"},
    {"exercise":"Tríceps Corda","sets":"4","reps":"10-12"},
    {"exercise":"Abdominal (Remador)","sets":"3","reps":"12","type":"core"}
  ]',
  NULL
),
(11, 'M-D: Ombro e Tríceps',
  '[
    {"exercise":"Desenvolvimento com Barra","sets":"4","reps":"10-12"},
    {"exercise":"Elevação Lateral (Drop Set)","sets":"3","reps":"12 + 12","note":"peso maior→menor","type":"drop_set"},
    {"exercise":"Elevação Frontal com Anilha","sets":"3","reps":"20"},
    {"exercise":"Face Pull","sets":"4","reps":"10-12"},
    {"exercise":"Tríceps Francês com Halter","sets":"3","reps":"10-12"},
    {"exercise":"Tríceps Corda","sets":"4","reps":"10-12"},
    {"exercise":"Abdominal (Remador)","sets":"3","reps":"12","type":"core"}
  ]',
  NULL
),
(18, 'M-D: Ombro e Tríceps',
  '[
    {"exercise":"Desenvolvimento com Barra","sets":"4","reps":"10-12"},
    {"exercise":"Elevação Lateral (Drop Set)","sets":"3","reps":"12 + 12","note":"peso maior→menor","type":"drop_set"},
    {"exercise":"Elevação Frontal com Anilha","sets":"3","reps":"20"},
    {"exercise":"Face Pull","sets":"4","reps":"10-12"},
    {"exercise":"Tríceps Francês com Halter","sets":"3","reps":"10-12"},
    {"exercise":"Tríceps Corda","sets":"4","reps":"10-12"},
    {"exercise":"Abdominal (Remador)","sets":"3","reps":"12","type":"core"}
  ]',
  NULL
);

-- M-E: Inferiores Completo (5,12,19)
INSERT INTO workouts (day_number, title, exercises, video_url) VALUES
(5, 'M-E: Inferiores Completo',
  '[
    {"exercise":"Aquecimento - Agachamento","sets":"2","reps":"20","type":"warmup"},
    {"exercise":"Búlgaro","sets":"3","reps":"12"},
    {"exercise":"Elevação Pélvica","sets":"4","reps":"10-12"},
    {"exercise":"Cadeira Abdutora","sets":"4","reps":"15,12,10,6","note":"carga progressiva"},
    {"exercise":"Stiff com Barra","sets":"4","reps":"10-12"},
    {"exercise":"Cadeira Extensora","sets":"3","reps":"12","group":"B","note":"Bi-set com Agachamento Taça"},
    {"exercise":"Agachamento Taça","sets":"3","reps":"12","group":"B","note":"Bi-set"}
  ]',
  NULL
),
(12, 'M-E: Inferiores Completo',
  '[
    {"exercise":"Aquecimento - Agachamento","sets":"2","reps":"20","type":"warmup"},
    {"exercise":"Búlgaro","sets":"3","reps":"12"},
    {"exercise":"Elevação Pélvica","sets":"4","reps":"10-12"},
    {"exercise":"Cadeira Abdutora","sets":"4","reps":"15,12,10,6","note":"carga progressiva"},
    {"exercise":"Stiff com Barra","sets":"4","reps":"10-12"},
    {"exercise":"Cadeira Extensora","sets":"3","reps":"12","group":"B","note":"Bi-set com Agachamento Taça"},
    {"exercise":"Agachamento Taça","sets":"3","reps":"12","group":"B","note":"Bi-set"}
  ]',
  NULL
),
(19, 'M-E: Inferiores Completo',
  '[
    {"exercise":"Aquecimento - Agachamento","sets":"2","reps":"20","type":"warmup"},
    {"exercise":"Búlgaro","sets":"3","reps":"12"},
    {"exercise":"Elevação Pélvica","sets":"4","reps":"10-12"},
    {"exercise":"Cadeira Abdutora","sets":"4","reps":"15,12,10,6","note":"carga progressiva"},
    {"exercise":"Stiff com Barra","sets":"4","reps":"10-12"},
    {"exercise":"Cadeira Extensora","sets":"3","reps":"12","group":"B","note":"Bi-set com Agachamento Taça"},
    {"exercise":"Agachamento Taça","sets":"3","reps":"12","group":"B","note":"Bi-set"}
  ]',
  NULL
);

-- M-F: Bíceps e Tríceps (Sábado) (6,13,20) – todos bi-sets
INSERT INTO workouts (day_number, title, exercises, video_url) VALUES
(6, 'M-F: Bíceps e Tríceps (Bi-sets)',
  '[
    {"exercise":"Rosca Scott","sets":"3","reps":"10-12","group":"C"},
    {"exercise":"Tríceps Barra Reta","sets":"3","reps":"10-12","group":"C"},
    {"exercise":"Bíceps Barra Reta","sets":"3","reps":"10-12","group":"D"},
    {"exercise":"Tríceps Testa na Polia c/ Barra Reta","sets":"3","reps":"10-12","group":"D"},
    {"exercise":"Rosca Halteres no Banco Inclinado","sets":"3","reps":"10-12","group":"E"},
    {"exercise":"Tríceps Francês com Halter","sets":"3","reps":"10-12","group":"E"}
  ]',
  NULL
),
(13, 'M-F: Bíceps e Tríceps (Bi-sets)',
  '[
    {"exercise":"Rosca Scott","sets":"3","reps":"10-12","group":"C"},
    {"exercise":"Tríceps Barra Reta","sets":"3","reps":"10-12","group":"C"},
    {"exercise":"Bíceps Barra Reta","sets":"3","reps":"10-12","group":"D"},
    {"exercise":"Tríceps Testa na Polia c/ Barra Reta","sets":"3","reps":"10-12","group":"D"},
    {"exercise":"Rosca Halteres no Banco Inclinado","sets":"3","reps":"10-12","group":"E"},
    {"exercise":"Tríceps Francês com Halter","sets":"3","reps":"10-12","group":"E"}
  ]',
  NULL
),
(20, 'M-F: Bíceps e Tríceps (Bi-sets)',
  '[
    {"exercise":"Rosca Scott","sets":"3","reps":"10-12","group":"C"},
    {"exercise":"Tríceps Barra Reta","sets":"3","reps":"10-12","group":"C"},
    {"exercise":"Bíceps Barra Reta","sets":"3","reps":"10-12","group":"D"},
    {"exercise":"Tríceps Testa na Polia c/ Barra Reta","sets":"3","reps":"10-12","group":"D"},
    {"exercise":"Rosca Halteres no Banco Inclinado","sets":"3","reps":"10-12","group":"E"},
    {"exercise":"Tríceps Francês com Halter","sets":"3","reps":"10-12","group":"E"}
  ]',
  NULL
);

-- M-G: Glúteo Isolado (Domingo) (7,14)
INSERT INTO workouts (day_number, title, exercises, video_url) VALUES
(7, 'M-G: Glúteo Isolado',
  '[
    {"exercise":"Aquecimento - Cadeira Abdutora","sets":"2","reps":"20","type":"warmup"},
    {"exercise":"Cadeira Abdutora","sets":"3","reps":"15,12,10","note":"aumentando carga"},
    {"exercise":"Cadeira Abdutora (Drop Set Final)","sets":"1","reps":"10+10+10","note":"alta→média→leve","type":"drop_set"},
    {"exercise":"Elevação Pélvica","sets":"4","reps":"10-12","note":"segurar 2s no pico"},
    {"exercise":"Extensão de Quadril na Polia","sets":"3","reps":"10-12"},
    {"exercise":"Abdução de Quadril na Polia","sets":"3","reps":"10-12"}
  ]',
  NULL
),
(14, 'M-G: Glúteo Isolado',
  '[
    {"exercise":"Aquecimento - Cadeira Abdutora","sets":"2","reps":"20","type":"warmup"},
    {"exercise":"Cadeira Abdutora","sets":"3","reps":"15,12,10","note":"aumentando carga"},
    {"exercise":"Cadeira Abdutora (Drop Set Final)","sets":"1","reps":"10+10+10","note":"alta→média→leve","type":"drop_set"},
    {"exercise":"Elevação Pélvica","sets":"4","reps":"10-12","note":"segurar 2s no pico"},
    {"exercise":"Extensão de Quadril na Polia","sets":"3","reps":"10-12"},
    {"exercise":"Abdução de Quadril na Polia","sets":"3","reps":"10-12"}
  ]',
  NULL
);

