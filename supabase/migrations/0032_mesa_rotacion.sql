-- Rotación de la mesa en el plano (grados).
ALTER TABLE restaurant_table ADD COLUMN IF NOT EXISTS rotacion int NOT NULL DEFAULT 0;
