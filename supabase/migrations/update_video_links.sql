-- Atualiza os links de vídeo semanal em todos os ciclos do desafio de 30 dias

UPDATE public.workouts SET video_url = 'https://www.youtube.com/shorts/dGrI2K2b9fU'
WHERE day_number IN (1,8,15,22);

UPDATE public.workouts SET video_url = 'https://www.youtube.com/shorts/Qo0TFXUdVb8'
WHERE day_number IN (2,9,16,23);

UPDATE public.workouts SET video_url = 'https://www.youtube.com/shorts/9oDDdNfo2ac'
WHERE day_number IN (3,10,17,24);

UPDATE public.workouts SET video_url = 'https://www.youtube.com/shorts/B0BP74TqpO8'
WHERE day_number IN (4,11,18,25);

UPDATE public.workouts SET video_url = 'https://www.youtube.com/shorts/nIRlOiGsriY'
WHERE day_number IN (5,12,19,26);

UPDATE public.workouts SET video_url = 'https://www.youtube.com/shorts/xsRDXpwCiWY'
WHERE day_number IN (6,13,20,27);

UPDATE public.workouts SET video_url = 'https://www.youtube.com/shorts/JvFmGrvtCqo'
WHERE day_number IN (7,14,21,28);

