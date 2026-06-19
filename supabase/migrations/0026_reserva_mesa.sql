-- Enlaza una reserva con una mesa concreta (reserva de mesa desde el plano).
-- Nullable: una reserva puede no tener mesa asignada todavía.
ALTER TABLE reservation
  ADD COLUMN IF NOT EXISTS table_id uuid REFERENCES restaurant_table(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_reservation_table ON reservation (table_id);
