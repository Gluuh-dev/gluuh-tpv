/**
 * Esquema PowerSync de la base de datos LOCAL (SQLite) de cada dispositivo.
 *
 * Es el subconjunto "operativo" que el TPV/comandera necesita sin conexión
 * (carta, mesas, comandas, pagos). PowerSync añade automáticamente la columna
 * `id` (texto/UUID) a cada tabla. La fuente de verdad canónica es PostgreSQL
 * (apps/api/db/schema.sql); aquí se replica lo necesario por dispositivo.
 *
 * Ver docs/06-base-de-datos-y-sincronizacion.md §4.
 */

import { column, Schema, Table } from "@powersync/common";

const category = new Table({
  tenant_id: column.text,
  nombre: column.text,
  orden: column.integer,
});

const product = new Table({
  tenant_id: column.text,
  category_id: column.text,
  nombre: column.text,
  precio: column.real,
  tipo_impositivo: column.real,
  estacion: column.text,
  disponible: column.integer,
});

const restaurant_table = new Table({
  tenant_id: column.text,
  room_id: column.text,
  nombre: column.text,
  estado: column.text,
  pos_x: column.integer,
  pos_y: column.integer,
});

const sales_order = new Table({
  tenant_id: column.text,
  location_id: column.text,
  table_id: column.text,
  user_id: column.text,
  estado: column.text,
  total: column.real,
  client_id: column.text,
  created_at: column.text,
});

const order_line = new Table({
  tenant_id: column.text,
  order_id: column.text,
  product_id: column.text,
  nombre: column.text,
  cantidad: column.real,
  precio_unitario: column.real,
  tipo_impositivo: column.real,
  notas: column.text,
  estacion: column.text,
});

const payment = new Table({
  tenant_id: column.text,
  order_id: column.text,
  metodo: column.text,
  importe: column.real,
  propina: column.real,
  client_id: column.text,
});

export const AppSchema = new Schema({
  category,
  product,
  restaurant_table,
  sales_order,
  order_line,
  payment,
});
