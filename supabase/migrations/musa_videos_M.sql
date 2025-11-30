-- Atualiza os links de vídeo dos treinos M-A a M-G

UPDATE workouts SET video_url = 'https://www.youtube.com/shorts/FA8JMD09M4E'
WHERE title ILIKE 'M-A:%' OR title ILIKE 'T-A:%';

UPDATE workouts SET video_url = 'https://www.youtube.com/shorts/R9buc95ALUk'
WHERE title ILIKE 'M-B:%' OR title ILIKE 'T-B:%';

UPDATE workouts SET video_url = 'https://www.youtube.com/shorts/5QXUBKWqe4w'
WHERE title ILIKE 'M-C:%' OR title ILIKE 'T-C:%';

UPDATE workouts SET video_url = 'https://www.youtube.com/shorts/H59irhx1u14'
WHERE title ILIKE 'M-D:%' OR title ILIKE 'T-D:%';

UPDATE workouts SET video_url = 'https://www.youtube.com/shorts/AiiK07TgAio'
WHERE title ILIKE 'M-E:%' OR title ILIKE 'T-E:%';

UPDATE workouts SET video_url = 'https://www.youtube.com/shorts/ACwh6bYPRZo'
WHERE title ILIKE 'M-F:%' OR title ILIKE 'T-F:%';

UPDATE workouts SET video_url = 'https://www.youtube.com/shorts/TVPuN30d9vQ'
WHERE title ILIKE 'M-G:%' OR title ILIKE 'T-G:%';

