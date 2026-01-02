-- Programa de 30 dias com progressão em 4 semanas
-- Remove treinos anteriores e insere novo cronograma

DELETE FROM workouts;

WITH base(day_in_week, code, title, video_url, exercises_json) AS (
  VALUES
  (1,'M-A','Segunda • Quadríceps','https://www.youtube.com/shorts/FA8JMD09M4E',
   '[
     {"exercise":"Mobilidade/Alongamento","reps":"5-8 min","type":"warmup","note":"Mobilidade de quadril/joelho"},
     {"exercise":"Agachamento livre","sets":"4","reps":"15/12/10/6","note":"Aumentar carga a cada série"},
     {"exercise":"Leg Press 45°","sets":"4","reps":"12","note":"Rest-pause na última: 3x(6 rep + 10s)"},
     {"exercise":"Afundo com halteres","sets":"3","reps":"12","note":"Drop set: 12 com peso + 10 sem peso"},
     {"exercise":"Cadeira extensora","sets":"4","reps":"7-7-7-7","note":"Método 7+7 parciais, repetir 4 vezes/ série"}
   ]'),
  (2,'M-B','Terça • Costas e Bíceps','https://www.youtube.com/shorts/R9buc95ALUk',
   '[
     {"exercise":"Puxada pulley aberta","sets":"4","reps":"12","note":"Progredir carga"},
     {"exercise":"Remada unilateral com halter","sets":"3","reps":"12"},
     {"exercise":"Remada baixa com barra","sets":"4","reps":"12"},
     {"exercise":"Pulldown","sets":"4","reps":"12"},
     {"exercise":"Crucifixo invertido na polia","sets":"3","reps":"12"},
     {"exercise":"Rosca Scott","sets":"4","reps":"12"},
     {"exercise":"Abdominal prancha","sets":"2","reps":"60s"},
     {"exercise":"Abdominal supra com peso","sets":"2","reps":"12-15"}
   ]'),
  (3,'M-C','Quarta • Glúteo e Posterior','https://www.youtube.com/shorts/5QXUBKWqe4w',
   '[
     {"exercise":"Mobilidade/Alongamento","reps":"5-8 min","type":"warmup"},
     {"exercise":"Cadeira abdutora","sets":"3","reps":"12","note":"Aumentar carga + drop set na última"},
     {"exercise":"Elevação pélvica","sets":"4","reps":"15/12/10/6","note":"Progredir carga"},
     {"exercise":"Levantamento terra sumo","sets":"4","reps":"12"},
     {"exercise":"Búlgaro","sets":"3","reps":"12","note":"Drop set: 12 com peso + 10 sem peso"},
     {"exercise":"Abdução cruzada de quadril","sets":"3","reps":"12"},
     {"exercise":"Cadeira flexora + Stiff","sets":"3","reps":"12"},
     {"exercise":"Panturrilha","sets":"3","reps":"12"}
   ]'),
  (4,'M-D','Quinta • Peito, Ombro e Tríceps','https://www.youtube.com/shorts/H59irhx1u14',
   '[
     {"exercise":"Supino inclinado com halteres","sets":"3","reps":"12"},
     {"exercise":"Voador peitoral","sets":"3","reps":"15/12/10","note":"Aumentar carga"},
     {"exercise":"Desenvolvimento com barra","sets":"4","reps":"15/12/10/6","note":"Progredir carga"},
     {"exercise":"Elevação lateral na polia","sets":"3","reps":"10"},
     {"exercise":"Tríceps coice na polia","sets":"3","reps":"10"},
     {"exercise":"Tríceps barra reta","sets":"4","reps":"15/12/10/6","note":"Progredir carga"},
     {"exercise":"Abdominal prancha","sets":"2","reps":"60s"},
     {"exercise":"Abdominal remador","sets":"2","reps":"15"}
   ]'),
  (5,'M-E','Sexta • Posterior e Quadríceps','https://www.youtube.com/shorts/AiiK07TgAio',
   '[
     {"exercise":"Mobilidade/Alongamento","reps":"5-8 min","type":"warmup"},
     {"exercise":"Cadeira flexora","sets":"4","reps":"15/12/10/6","note":"Progredir carga"},
     {"exercise":"Agachamento livre","sets":"4","reps":"15/12/10/6","note":"Progredir carga"},
     {"exercise":"Leg Press","sets":"4","reps":"12","note":"Carga alta"},
     {"exercise":"Afundo no step","sets":"3","reps":"12"},
     {"exercise":"Cadeira extensora + Agachamento taça","sets":"4","reps":"12"},
     {"exercise":"Panturrilha","sets":"3","reps":"12"}
   ]'),
  (6,'M-F','Sábado • Costas, Bíceps e Tríceps','https://www.youtube.com/shorts/ACwh6bYPRZo',
   '[
     {"exercise":"Remada curvada com barra","sets":"4","reps":"12"},
     {"exercise":"Remada máquina pegada neutra","sets":"4","reps":"15/12/10/6","note":"Aumentar carga"},
     {"exercise":"Puxada frontal com triângulo","sets":"4","reps":"12"},
     {"exercise":"Pulldown","sets":"3","reps":"12"},
     {"exercise":"Bíceps Scott + Tríceps barra reta","sets":"3","reps":"12"},
     {"exercise":"Bíceps alternado + Tríceps francês","sets":"3","reps":"12"},
     {"exercise":"Abdominal prancha","sets":"2","reps":"60s"},
     {"exercise":"Abdominal supra com peso","sets":"2","reps":"12-15"}
   ]'),
  (7,'M-G','Domingo • Glúteo e Posterior','https://www.youtube.com/shorts/TVPuN30d9vQ',
   '[
     {"exercise":"Mobilidade/Alongamento","reps":"5-8 min","type":"warmup"},
     {"exercise":"Cadeira abdutora","sets":"4","reps":"12","note":"Aumentar carga + 1 drop set"},
     {"exercise":"Extensão de quadril na polia","sets":"3","reps":"12"},
     {"exercise":"Elevação pélvica","sets":"4","reps":"15/12/10/6","note":"Progredir carga"},
     {"exercise":"Stiff com barra","sets":"4","reps":"12"},
     {"exercise":"Mesa flexora","sets":"3","reps":"12","note":"Drop set: 12 alta + 10 baixa"},
     {"exercise":"Panturrilha","sets":"3","reps":"12"}
   ]')
)
INSERT INTO workouts (day_number, title, exercises, video_url)
SELECT (w*7)+day_in_week AS day_number,
       CONCAT('Semana ', w+1, ' • ', title) AS title,
       exercises_json::jsonb,
       video_url
FROM base, generate_series(0,3) AS w;

-- Dias 29 e 30: recuperação ativa e avaliação
INSERT INTO workouts (day_number, title, exercises, video_url)
VALUES
 (29,'Semana 4 • Recuperação ativa','[
    {"exercise":"Mobilidade geral","reps":"10 min","type":"warmup"},
    {"exercise":"Caminhada/bike leve","reps":"20-30 min"},
    {"exercise":"Alongamentos de membros inferiores","reps":"10 min"}
  ]',''),
 (30,'Semana 4 • Avaliação e alongamento','[
    {"exercise":"Autoavaliação de cargas e execução","reps":"10 min"},
    {"exercise":"Alongamento completo","reps":"15 min"}
  ]','');

