-- Nombre de la reserva (a nombre de quién está) para mostrarlo en el plano.
ALTER TABLE reservation
  ADD COLUMN IF NOT EXISTS nombre text;
