-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create user_progress table
CREATE TABLE user_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    day_number INTEGER NOT NULL CHECK (day_number >= 1 AND day_number <= 20),
    completed BOOLEAN DEFAULT false,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, day_number)
);

-- Create workouts table
CREATE TABLE workouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    day_number INTEGER UNIQUE NOT NULL CHECK (day_number >= 1 AND day_number <= 20),
    title VARCHAR(255) NOT NULL,
    exercises JSONB NOT NULL,
    video_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Grant permissions
GRANT SELECT ON user_progress TO anon;
GRANT ALL PRIVILEGES ON user_progress TO authenticated;

GRANT SELECT ON workouts TO anon;
GRANT SELECT ON workouts TO authenticated;

-- Create indexes
CREATE INDEX idx_user_progress_user_id ON user_progress(user_id);
CREATE INDEX idx_user_progress_day ON user_progress(day_number);
CREATE INDEX idx_workouts_day_number ON workouts(day_number);

-- Enable RLS
ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE workouts ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for user_progress
CREATE POLICY "Users can view their own progress" ON user_progress
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own progress" ON user_progress
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own progress" ON user_progress
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own progress" ON user_progress
    FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for workouts
CREATE POLICY "Anyone can view workouts" ON workouts
    FOR SELECT USING (true);

-- Insert initial workout data
INSERT INTO workouts (day_number, title, exercises, video_url) VALUES
(1, 'Treino Dia 1 - Iniciando Forte', '[{"exercise": "Polichinelos", "reps": "30 seg"}, {"exercise": "Agachamento", "reps": "15 rep"}, {"exercise": "Flexões de joelho", "reps": "10 rep"}, {"exercise": "Prancha", "reps": "20 seg"}]', 'https://youtube.com/embed/day1'),
(2, 'Treino Dia 2 - Resistência', '[{"exercise": "Prancha", "reps": "30 seg"}, {"exercise": "Afundo", "reps": "12 rep cada"}, {"exercise": "Flexões inclinadas", "reps": "8 rep"}, {"exercise": "Mountain climbers", "reps": "30 seg"}]', 'https://youtube.com/embed/day2'),
(3, 'Treino Dia 3 - Core Strength', '[{"exercise": "Abdominal bicicleta", "reps": "20 rep"}, {"exercise": "Prancha lateral", "reps": "20 seg cada"}, {"exercise": "Russian twist", "reps": "15 rep"}, {"exercise": "Leg raises", "reps": "12 rep"}]', 'https://youtube.com/embed/day3'),
(4, 'Treino Dia 4 - Lower Body', '[{"exercise": "Agachamento sumô", "reps": "15 rep"}, {"exercise": "Elevação de panturrilha", "reps": "20 rep"}, {"exercise": "Afundo lateral", "reps": "10 rep cada"}, {"exercise": "Glute bridge", "reps": "15 rep"}]', 'https://youtube.com/embed/day4'),
(5, 'Treino Dia 5 - Upper Body', '[{"exercise": "Flexões", "reps": "10 rep"}, {"exercise": "Tricep dips", "reps": "12 rep"}, {"exercise": "Superman", "reps": "15 rep"}, {"exercise": "Arm circles", "reps": "30 seg"}]', 'https://youtube.com/embed/day5'),
(6, 'Treino Dia 6 - Cardio', '[{"exercise": "Jumping jacks", "reps": "45 seg"}, {"exercise": "High knees", "reps": "30 seg"}, {"exercise": "Burpees", "reps": "8 rep"}, {"exercise": "Shadow boxing", "reps": "60 seg"}]', 'https://youtube.com/embed/day6'),
(7, 'Treino Dia 7 - Active Recovery', '[{"exercise": "Yoga flow", "reps": "5 min"}, {"exercise": "Stretching", "reps": "10 min"}, {"exercise": "Respiração", "reps": "5 min"}]', 'https://youtube.com/embed/day7'),
(8, 'Treino Dia 8 - Power', '[{"exercise": "Jump squats", "reps": "12 rep"}, {"exercise": "Push-up claps", "reps": "8 rep"}, {"exercise": "Lunges", "reps": "12 rep cada"}, {"exercise": "Plank jacks", "reps": "30 seg"}]', 'https://youtube.com/embed/day8'),
(9, 'Treino Dia 9 - Balance', '[{"exercise": "Single leg stand", "reps": "30 seg cada"}, {"exercise": "Tree pose", "reps": "30 seg cada"}, {"exercise": "Warrior pose", "reps": "45 seg cada"}, {"exercise": "Balance board", "reps": "60 seg"}]', 'https://youtube.com/embed/day9'),
(10, 'Treino Dia 10 - HIIT', '[{"exercise": "30s on/30s off", "reps": "burpees"}, {"exercise": "30s on/30s off", "reps": "mountain climbers"}, {"exercise": "30s on/30s off", "reps": "jump squats"}, {"exercise": "30s on/30s off", "reps": "high knees"}]', 'https://youtube.com/embed/day10'),
(11, 'Treino Dia 11 - Strength', '[{"exercise": "Push-ups", "reps": "15 rep"}, {"exercise": "Squats", "reps": "20 rep"}, {"exercise": "Lunges", "reps": "15 rep cada"}, {"exercise": "Plank", "reps": "60 seg"}]', 'https://youtube.com/embed/day11'),
(12, 'Treino Dia 12 - Flexibility', '[{"exercise": "Forward fold", "reps": "30 seg"}, {"exercise": "Cat-cow stretch", "reps": "10 rep"}, {"exercise": "Child pose", "reps": "60 seg"}, {"exercise": "Spinal twist", "reps": "30 seg cada"}]', 'https://youtube.com/embed/day12'),
(13, 'Treino Dia 13 - Endurance', '[{"exercise": "Jump rope", "reps": "2 min"}, {"exercise": "Running in place", "reps": "2 min"}, {"exercise": "Step ups", "reps": "1 min"}, {"exercise": "Dance cardio", "reps": "3 min"}]', 'https://youtube.com/embed/day13'),
(14, 'Treino Dia 14 - Core Blast', '[{"exercise": "Bicycle crunches", "reps": "25 rep"}, {"exercise": "Dead bug", "reps": "12 rep cada"}, {"exercise": "Bird dog", "reps": "10 rep cada"}, {"exercise": "Side plank", "reps": "30 seg cada"}]', 'https://youtube.com/embed/day14'),
(15, 'Treino Dia 15 - Full Body', '[{"exercise": "Burpees", "reps": "10 rep"}, {"exercise": "Mountain climbers", "reps": "45 seg"}, {"exercise": "Jump squats", "reps": "15 rep"}, {"exercise": "Push-ups", "reps": "12 rep"}]', 'https://youtube.com/embed/day15'),
(16, 'Treino Dia 16 - Speed', '[{"exercise": "Fast feet", "reps": "30 seg"}, {"exercise": "Quick jumps", "reps": "20 rep"}, {"exercise": "Speed skaters", "reps": "30 seg"}, {"exercise": "Shadow boxing", "reps": "45 seg"}]', 'https://youtube.com/embed/day16'),
(17, 'Treino Dia 17 - Sculpt', '[{"exercise": "Arm circles", "reps": "30 seg cada"}, {"exercise": "Shoulder taps", "reps": "20 rep"}, {"exercise": "Tricep kickbacks", "reps": "15 rep"}, {"exercise": "Bicep curls", "reps": "15 rep"}]', 'https://youtube.com/embed/day17'),
(18, 'Treino Dia 18 - Plyometric', '[{"exercise": "Box jumps", "reps": "10 rep"}, {"exercise": "Lateral jumps", "reps": "12 rep"}, {"exercise": "Tuck jumps", "reps": "8 rep"}, {"exercise": "Broad jumps", "reps": "6 rep"}]', 'https://youtube.com/embed/day18'),
(19, 'Treino Dia 19 - Mind Body', '[{"exercise": "Tai chi", "reps": "5 min"}, {"exercise": "Meditation", "reps": "5 min"}, {"exercise": "Deep breathing", "reps": "5 min"}, {"exercise": "Gentle stretch", "reps": "5 min"}]', 'https://youtube.com/embed/day19'),
(20, 'Treino Dia 20 - Victory', '[{"exercise": "Celebration dance", "reps": "5 min"}, {"exercise": "Victory poses", "reps": "10 rep"}, {"exercise": "Gratitude stretch", "reps": "5 min"}, {"exercise": "Final meditation", "reps": "5 min"}]', 'https://youtube.com/embed/day20');