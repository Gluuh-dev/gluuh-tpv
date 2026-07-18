export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      alergeno: {
        Row: {
          created_at: string | null
          descripcion: string | null
          id: string
          nombre: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string | null
          descripcion?: string | null
          id?: string
          nombre: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string | null
          descripcion?: string | null
          id?: string
          nombre?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "alergeno_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      allergen: {
        Row: {
          codigo: string
          id: string
          nombre: string
        }
        Insert: {
          codigo: string
          id?: string
          nombre: string
        }
        Update: {
          codigo?: string
          id?: string
          nombre?: string
        }
        Relationships: []
      }
      app_user: {
        Row: {
          activo: boolean
          auth_user_id: string | null
          clave_hash: string | null
          codigo: string | null
          created_at: string
          cuenta_id: string | null
          email: string | null
          id: string
          nombre: string
          password_hash: string | null
          perfil_id: string | null
          pin_bloqueado_hasta: string | null
          pin_hash: string | null
          pin_intentos: number
          pulsera_hash: string | null
          rol: string
          tenant_id: string
          updated_at: string
          usr_app: string | null
        }
        Insert: {
          activo?: boolean
          auth_user_id?: string | null
          clave_hash?: string | null
          codigo?: string | null
          created_at?: string
          cuenta_id?: string | null
          email?: string | null
          id?: string
          nombre: string
          password_hash?: string | null
          perfil_id?: string | null
          pin_bloqueado_hasta?: string | null
          pin_hash?: string | null
          pin_intentos?: number
          pulsera_hash?: string | null
          rol?: string
          tenant_id: string
          updated_at?: string
          usr_app?: string | null
        }
        Update: {
          activo?: boolean
          auth_user_id?: string | null
          clave_hash?: string | null
          codigo?: string | null
          created_at?: string
          cuenta_id?: string | null
          email?: string | null
          id?: string
          nombre?: string
          password_hash?: string | null
          perfil_id?: string | null
          pin_bloqueado_hasta?: string | null
          pin_hash?: string | null
          pin_intentos?: number
          pulsera_hash?: string | null
          rol?: string
          tenant_id?: string
          updated_at?: string
          usr_app?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "app_user_cuenta_id_fkey"
            columns: ["cuenta_id"]
            isOneToOne: false
            referencedRelation: "cuenta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_user_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfil"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_user_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      app_user_local: {
        Row: {
          app_user_id: string
          created_at: string
          desde: string | null
          estado: string
          hasta: string | null
          id: string
          location_id: string
          perfil_id: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          app_user_id: string
          created_at?: string
          desde?: string | null
          estado?: string
          hasta?: string | null
          id?: string
          location_id: string
          perfil_id?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          app_user_id?: string
          created_at?: string
          desde?: string | null
          estado?: string
          hasta?: string | null
          id?: string
          location_id?: string
          perfil_id?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_user_local_app_user_id_fkey"
            columns: ["app_user_id"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_user_local_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "location"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_user_local_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfil"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_user_local_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      app_user_permiso: {
        Row: {
          app_user_id: string
          efecto: string
          id: string
          location_id: string | null
          permiso: string
          tenant_id: string
        }
        Insert: {
          app_user_id: string
          efecto: string
          id?: string
          location_id?: string | null
          permiso: string
          tenant_id: string
        }
        Update: {
          app_user_id?: string
          efecto?: string
          id?: string
          location_id?: string | null
          permiso?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_user_permiso_app_user_id_fkey"
            columns: ["app_user_id"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_user_permiso_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "location"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_user_permiso_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      cancel_reason: {
        Row: {
          created_at: string | null
          id: string
          nombre: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          nombre: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string | null
          id?: string
          nombre?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cancel_reason_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_move: {
        Row: {
          cash_session_id: string
          created_at: string
          id: string
          importe: number
          motivo: string | null
          tenant_id: string
          tipo: string
        }
        Insert: {
          cash_session_id: string
          created_at?: string
          id?: string
          importe: number
          motivo?: string | null
          tenant_id: string
          tipo: string
        }
        Update: {
          cash_session_id?: string
          created_at?: string
          id?: string
          importe?: number
          motivo?: string | null
          tenant_id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_move_cash_session_id_fkey"
            columns: ["cash_session_id"]
            isOneToOne: false
            referencedRelation: "cash_session"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_move_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_session: {
        Row: {
          abierta_en: string
          abierta_por: string | null
          cerrada_en: string | null
          descuadre: number | null
          device_id: string | null
          fondo_inicial: number
          id: string
          location_id: string
          tenant_id: string
          total_efectivo: number | null
          total_tarjeta: number | null
        }
        Insert: {
          abierta_en?: string
          abierta_por?: string | null
          cerrada_en?: string | null
          descuadre?: number | null
          device_id?: string | null
          fondo_inicial?: number
          id?: string
          location_id: string
          tenant_id: string
          total_efectivo?: number | null
          total_tarjeta?: number | null
        }
        Update: {
          abierta_en?: string
          abierta_por?: string | null
          cerrada_en?: string | null
          descuadre?: number | null
          device_id?: string | null
          fondo_inicial?: number
          id?: string
          location_id?: string
          tenant_id?: string
          total_efectivo?: number | null
          total_tarjeta?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cash_session_abierta_por_fkey"
            columns: ["abierta_por"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_session_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "device"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_session_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "location"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_session_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      category: {
        Row: {
          carta_descripcion: string | null
          carta_nombre: string | null
          categoria_padre_id: string | null
          color: string | null
          created_at: string
          estacion: string | null
          family_id: string | null
          foto_url: string | null
          icono: string | null
          id: string
          mostrar_menus: boolean
          mostrar_venta: boolean
          nombre: string
          orden: number
          tenant_id: string
          texto_boton: string | null
          updated_at: string
        }
        Insert: {
          carta_descripcion?: string | null
          carta_nombre?: string | null
          categoria_padre_id?: string | null
          color?: string | null
          created_at?: string
          estacion?: string | null
          family_id?: string | null
          foto_url?: string | null
          icono?: string | null
          id?: string
          mostrar_menus?: boolean
          mostrar_venta?: boolean
          nombre: string
          orden?: number
          tenant_id: string
          texto_boton?: string | null
          updated_at?: string
        }
        Update: {
          carta_descripcion?: string | null
          carta_nombre?: string | null
          categoria_padre_id?: string | null
          color?: string | null
          created_at?: string
          estacion?: string | null
          family_id?: string | null
          foto_url?: string | null
          icono?: string | null
          id?: string
          mostrar_menus?: boolean
          mostrar_venta?: boolean
          nombre?: string
          orden?: number
          tenant_id?: string
          texto_boton?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "category_categoria_padre_id_fkey"
            columns: ["categoria_padre_id"]
            isOneToOne: false
            referencedRelation: "category"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "category_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "family"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "category_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      category_grupo_pv: {
        Row: {
          category_id: string
          grupo_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          category_id: string
          grupo_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          category_id?: string
          grupo_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "category_grupo_pv_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "category"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "category_grupo_pv_grupo_id_fkey"
            columns: ["grupo_id"]
            isOneToOne: false
            referencedRelation: "grupo_punto_venta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "category_grupo_pv_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      category_horario: {
        Row: {
          category_id: string
          created_at: string
          dias: number[]
          hora_fin: string
          hora_inicio: string
          id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          category_id: string
          created_at?: string
          dias?: number[]
          hora_fin: string
          hora_inicio: string
          id?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          category_id?: string
          created_at?: string
          dias?: number[]
          hora_fin?: string
          hora_inicio?: string
          id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "category_horario_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "category"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "category_horario_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      category_sales_center: {
        Row: {
          category_id: string
          sales_center_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          category_id: string
          sales_center_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          category_id?: string
          sales_center_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "category_sales_center_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "category"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "category_sales_center_sales_center_id_fkey"
            columns: ["sales_center_id"]
            isOneToOne: false
            referencedRelation: "sales_center"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "category_sales_center_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_request: {
        Row: {
          atendida: boolean
          created_at: string
          email: string | null
          id: string
          mensaje: string | null
          nombre: string | null
          telefono: string | null
        }
        Insert: {
          atendida?: boolean
          created_at?: string
          email?: string | null
          id?: string
          mensaje?: string | null
          nombre?: string | null
          telefono?: string | null
        }
        Update: {
          atendida?: boolean
          created_at?: string
          email?: string | null
          id?: string
          mensaje?: string | null
          nombre?: string | null
          telefono?: string | null
        }
        Relationships: []
      }
      credencial_dispositivo: {
        Row: {
          device_id: string
          emitida_at: string
          expira_at: string
          id: string
          refresh_hash: string
          revocada_at: string | null
          tenant_id: string
          version: number
        }
        Insert: {
          device_id: string
          emitida_at?: string
          expira_at: string
          id?: string
          refresh_hash: string
          revocada_at?: string | null
          tenant_id: string
          version?: number
        }
        Update: {
          device_id?: string
          emitida_at?: string
          expira_at?: string
          id?: string
          refresh_hash?: string
          revocada_at?: string | null
          tenant_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "credencial_dispositivo_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "device"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credencial_dispositivo_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      cuenta: {
        Row: {
          auth_user_id: string
          created_at: string
          debe_cambiar_password: boolean
          estado: string
          id: string
          nombre: string | null
          password_caduca_at: string | null
          updated_at: string
        }
        Insert: {
          auth_user_id: string
          created_at?: string
          debe_cambiar_password?: boolean
          estado?: string
          id?: string
          nombre?: string | null
          password_caduca_at?: string | null
          updated_at?: string
        }
        Update: {
          auth_user_id?: string
          created_at?: string
          debe_cambiar_password?: boolean
          estado?: string
          id?: string
          nombre?: string | null
          password_caduca_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      cuenta_parte: {
        Row: {
          client_id: string
          cobrada: boolean
          cobrada_at: string | null
          cobrada_order_id: string | null
          created_at: string
          id: string
          importe: number
          indice: number
          lineas: Json | null
          order_id: string
          payment_id: string | null
          tenant_id: string
          tipo: string
          updated_at: string
        }
        Insert: {
          client_id?: string
          cobrada?: boolean
          cobrada_at?: string | null
          cobrada_order_id?: string | null
          created_at?: string
          id?: string
          importe?: number
          indice: number
          lineas?: Json | null
          order_id: string
          payment_id?: string | null
          tenant_id: string
          tipo: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          cobrada?: boolean
          cobrada_at?: string | null
          cobrada_order_id?: string | null
          created_at?: string
          id?: string
          importe?: number
          indice?: number
          lineas?: Json | null
          order_id?: string
          payment_id?: string | null
          tenant_id?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cuenta_parte_cobrada_order_id_fkey"
            columns: ["cobrada_order_id"]
            isOneToOne: false
            referencedRelation: "sales_order"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cuenta_parte_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "sales_order"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cuenta_parte_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cuenta_parte_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      customer: {
        Row: {
          codigo_postal: string | null
          consentimiento_marketing: boolean
          created_at: string
          descuento_pct: number
          direccion: string | null
          email: string | null
          id: string
          nif: string | null
          nombre: string | null
          notas: string | null
          poblacion: string | null
          provincia: string | null
          puntos_fidelidad: number
          saldo: number
          tarifa_id: string | null
          telefono: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          codigo_postal?: string | null
          consentimiento_marketing?: boolean
          created_at?: string
          descuento_pct?: number
          direccion?: string | null
          email?: string | null
          id?: string
          nif?: string | null
          nombre?: string | null
          notas?: string | null
          poblacion?: string | null
          provincia?: string | null
          puntos_fidelidad?: number
          saldo?: number
          tarifa_id?: string | null
          telefono?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          codigo_postal?: string | null
          consentimiento_marketing?: boolean
          created_at?: string
          descuento_pct?: number
          direccion?: string | null
          email?: string | null
          id?: string
          nif?: string | null
          nombre?: string | null
          notas?: string | null
          poblacion?: string | null
          provincia?: string | null
          puntos_fidelidad?: number
          saldo?: number
          tarifa_id?: string | null
          telefono?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_tarifa_id_fkey"
            columns: ["tarifa_id"]
            isOneToOne: false
            referencedRelation: "tarifa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_type: {
        Row: {
          created_at: string | null
          descripcion: string | null
          id: string
          nombre: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string | null
          descripcion?: string | null
          id?: string
          nombre: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string | null
          descripcion?: string | null
          id?: string
          nombre?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_type_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      device: {
        Row: {
          codigo_expira: string | null
          codigo_vinculacion: string | null
          created_at: string
          estacion: string | null
          grupo_punto_venta_id: string | null
          id: string
          location_id: string
          modulo: string | null
          nombre: string
          serie_dispositivo: string | null
          tenant_id: string
          tipo: string
          ultima_conexion: string | null
          ultima_huella: string | null
          ultima_sync: string | null
          updated_at: string
          version: string | null
          vinculado_at: string | null
        }
        Insert: {
          codigo_expira?: string | null
          codigo_vinculacion?: string | null
          created_at?: string
          estacion?: string | null
          grupo_punto_venta_id?: string | null
          id?: string
          location_id: string
          modulo?: string | null
          nombre: string
          serie_dispositivo?: string | null
          tenant_id: string
          tipo: string
          ultima_conexion?: string | null
          ultima_huella?: string | null
          ultima_sync?: string | null
          updated_at?: string
          version?: string | null
          vinculado_at?: string | null
        }
        Update: {
          codigo_expira?: string | null
          codigo_vinculacion?: string | null
          created_at?: string
          estacion?: string | null
          grupo_punto_venta_id?: string | null
          id?: string
          location_id?: string
          modulo?: string | null
          nombre?: string
          serie_dispositivo?: string | null
          tenant_id?: string
          tipo?: string
          ultima_conexion?: string | null
          ultima_huella?: string | null
          ultima_sync?: string | null
          updated_at?: string
          version?: string | null
          vinculado_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "device_grupo_punto_venta_id_fkey"
            columns: ["grupo_punto_venta_id"]
            isOneToOne: false
            referencedRelation: "grupo_punto_venta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "device_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "location"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "device_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      discount: {
        Row: {
          activo: boolean | null
          created_at: string | null
          id: string
          nombre: string
          orden: number | null
          tenant_id: string
          tipo: string
          updated_at: string
          valor: number
        }
        Insert: {
          activo?: boolean | null
          created_at?: string | null
          id?: string
          nombre: string
          orden?: number | null
          tenant_id: string
          tipo?: string
          updated_at?: string
          valor?: number
        }
        Update: {
          activo?: boolean | null
          created_at?: string | null
          id?: string
          nombre?: string
          orden?: number | null
          tenant_id?: string
          tipo?: string
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "discount_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      etiqueta_producto: {
        Row: {
          color: string | null
          created_at: string | null
          id: string
          nombre: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          id?: string
          nombre: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          id?: string
          nombre?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "etiqueta_producto_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      evento_seguridad: {
        Row: {
          creado_at: string
          cuenta_id: string | null
          detalle: Json
          id: number
          tenant_id: string | null
          tipo: string
        }
        Insert: {
          creado_at?: string
          cuenta_id?: string | null
          detalle?: Json
          id?: never
          tenant_id?: string | null
          tipo: string
        }
        Update: {
          creado_at?: string
          cuenta_id?: string | null
          detalle?: Json
          id?: never
          tenant_id?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "evento_seguridad_cuenta_id_fkey"
            columns: ["cuenta_id"]
            isOneToOne: false
            referencedRelation: "cuenta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evento_seguridad_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      family: {
        Row: {
          color: string | null
          combinable: boolean
          created_at: string | null
          familia_padre_id: string | null
          foto_url: string | null
          grupo_mayor_id: string | null
          id: string
          mostrar_menus: boolean
          mostrar_venta: boolean
          nombre: string
          orden: number | null
          orden_impresion: number
          tenant_id: string
          texto_boton: string | null
          updated_at: string
        }
        Insert: {
          color?: string | null
          combinable?: boolean
          created_at?: string | null
          familia_padre_id?: string | null
          foto_url?: string | null
          grupo_mayor_id?: string | null
          id?: string
          mostrar_menus?: boolean
          mostrar_venta?: boolean
          nombre: string
          orden?: number | null
          orden_impresion?: number
          tenant_id: string
          texto_boton?: string | null
          updated_at?: string
        }
        Update: {
          color?: string | null
          combinable?: boolean
          created_at?: string | null
          familia_padre_id?: string | null
          foto_url?: string | null
          grupo_mayor_id?: string | null
          id?: string
          mostrar_menus?: boolean
          mostrar_venta?: boolean
          nombre?: string
          orden?: number | null
          orden_impresion?: number
          tenant_id?: string
          texto_boton?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_familia_padre_id_fkey"
            columns: ["familia_padre_id"]
            isOneToOne: false
            referencedRelation: "family"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_grupo_mayor_id_fkey"
            columns: ["grupo_mayor_id"]
            isOneToOne: false
            referencedRelation: "grupo_mayor"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      family_grupo_pv: {
        Row: {
          family_id: string
          grupo_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          family_id: string
          grupo_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          family_id?: string
          grupo_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_grupo_pv_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "family"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_grupo_pv_grupo_id_fkey"
            columns: ["grupo_id"]
            isOneToOne: false
            referencedRelation: "grupo_punto_venta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_grupo_pv_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_outbox: {
        Row: {
          created_at: string
          estado: string
          id: number
          intentos: number
          invoice_id: string
          lease_hasta: string | null
          tenant_id: string
          ultimo_error: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          estado?: string
          id?: never
          intentos?: number
          invoice_id: string
          lease_hasta?: string | null
          tenant_id: string
          ultimo_error?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          estado?: string
          id?: never
          intentos?: number
          invoice_id?: string
          lease_hasta?: string | null
          tenant_id?: string
          ultimo_error?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_outbox_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: true
            referencedRelation: "invoice"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiscal_outbox_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      grupo_mayor: {
        Row: {
          created_at: string | null
          descripcion: string | null
          id: string
          nombre: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string | null
          descripcion?: string | null
          id?: string
          nombre: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string | null
          descripcion?: string | null
          id?: string
          nombre?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "grupo_mayor_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      grupo_punto_venta: {
        Row: {
          created_at: string
          descripcion: string | null
          id: string
          nombre: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          descripcion?: string | null
          id?: string
          nombre: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          descripcion?: string | null
          id?: string
          nombre?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "grupo_punto_venta_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      ingredient: {
        Row: {
          coste_unitario: number | null
          created_at: string
          id: string
          nombre: string
          stock: number
          stock_minimo: number | null
          tenant_id: string
          unidad: string
          updated_at: string
        }
        Insert: {
          coste_unitario?: number | null
          created_at?: string
          id?: string
          nombre: string
          stock?: number
          stock_minimo?: number | null
          tenant_id: string
          unidad?: string
          updated_at?: string
        }
        Update: {
          coste_unitario?: number | null
          created_at?: string
          id?: string
          nombre?: string
          stock?: number
          stock_minimo?: number | null
          tenant_id?: string
          unidad?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ingredient_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      invitacion: {
        Row: {
          aceptada_at: string | null
          created_at: string
          cuenta_id: string | null
          email: string
          emitida_por: string | null
          es_titular: boolean
          estado: string
          expira_at: string
          id: string
          nombre: string | null
          perfil_id: string | null
          rol: string
          tenant_id: string
          token_hash: string
        }
        Insert: {
          aceptada_at?: string | null
          created_at?: string
          cuenta_id?: string | null
          email: string
          emitida_por?: string | null
          es_titular?: boolean
          estado?: string
          expira_at?: string
          id?: string
          nombre?: string | null
          perfil_id?: string | null
          rol?: string
          tenant_id: string
          token_hash: string
        }
        Update: {
          aceptada_at?: string | null
          created_at?: string
          cuenta_id?: string | null
          email?: string
          emitida_por?: string | null
          es_titular?: boolean
          estado?: string
          expira_at?: string
          id?: string
          nombre?: string | null
          perfil_id?: string | null
          rol?: string
          tenant_id?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitacion_cuenta_id_fkey"
            columns: ["cuenta_id"]
            isOneToOne: false
            referencedRelation: "cuenta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitacion_emitida_por_fkey"
            columns: ["emitida_por"]
            isOneToOne: false
            referencedRelation: "cuenta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitacion_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfil"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitacion_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice: {
        Row: {
          base_total: number
          created_at: string
          cuota_total: number
          dest_domicilio: string | null
          dest_nif: string | null
          dest_nombre: string | null
          estado_aeat: string
          fecha_expedicion: string
          fecha_hora_huso: string | null
          huella: string | null
          huella_anterior: string | null
          id: string
          importe_total: number
          location_id: string | null
          nif_emisor: string | null
          nombre_emisor: string | null
          num_serie_factura: string | null
          numero: number
          order_id: string | null
          qr_url: string | null
          serie: string
          tenant_id: string
          tipo: string
          tipo_factura: string
        }
        Insert: {
          base_total: number
          created_at?: string
          cuota_total: number
          dest_domicilio?: string | null
          dest_nif?: string | null
          dest_nombre?: string | null
          estado_aeat?: string
          fecha_expedicion: string
          fecha_hora_huso?: string | null
          huella?: string | null
          huella_anterior?: string | null
          id?: string
          importe_total: number
          location_id?: string | null
          nif_emisor?: string | null
          nombre_emisor?: string | null
          num_serie_factura?: string | null
          numero: number
          order_id?: string | null
          qr_url?: string | null
          serie: string
          tenant_id: string
          tipo?: string
          tipo_factura?: string
        }
        Update: {
          base_total?: number
          created_at?: string
          cuota_total?: number
          dest_domicilio?: string | null
          dest_nif?: string | null
          dest_nombre?: string | null
          estado_aeat?: string
          fecha_expedicion?: string
          fecha_hora_huso?: string | null
          huella?: string | null
          huella_anterior?: string | null
          id?: string
          importe_total?: number
          location_id?: string | null
          nif_emisor?: string | null
          nombre_emisor?: string | null
          num_serie_factura?: string | null
          numero?: number
          order_id?: string | null
          qr_url?: string | null
          serie?: string
          tenant_id?: string
          tipo?: string
          tipo_factura?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "location"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "sales_order"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_series: {
        Row: {
          activa: boolean
          created_at: string | null
          id: string
          nombre: string
          predeterminada: boolean
          prefijo: string | null
          tenant_id: string
          tipo: string
          updated_at: string
        }
        Insert: {
          activa?: boolean
          created_at?: string | null
          id?: string
          nombre: string
          predeterminada?: boolean
          prefijo?: string | null
          tenant_id: string
          tipo?: string
          updated_at?: string
        }
        Update: {
          activa?: boolean
          created_at?: string | null
          id?: string
          nombre?: string
          predeterminada?: boolean
          prefijo?: string | null
          tenant_id?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_series_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_tax_line: {
        Row: {
          base: number
          cuota: number
          id: string
          invoice_id: string
          tenant_id: string
          tipo: number
        }
        Insert: {
          base: number
          cuota: number
          id?: string
          invoice_id: string
          tenant_id: string
          tipo: number
        }
        Update: {
          base?: number
          cuota?: number
          id?: string
          invoice_id?: string
          tenant_id?: string
          tipo?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_tax_line_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoice"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_tax_line_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      jornada: {
        Row: {
          abierta_en: string
          arqueo_pendiente: boolean
          cerrada_en: string | null
          cerrada_por: string | null
          created_at: string
          descuadre: number | null
          efectivo_contado: number | null
          id: string
          location_id: string
          mesas_abiertas: number
          numero: number
          tenant_id: string
          tipo_cierre: string | null
          updated_at: string
          z: Json | null
        }
        Insert: {
          abierta_en?: string
          arqueo_pendiente?: boolean
          cerrada_en?: string | null
          cerrada_por?: string | null
          created_at?: string
          descuadre?: number | null
          efectivo_contado?: number | null
          id?: string
          location_id: string
          mesas_abiertas?: number
          numero: number
          tenant_id: string
          tipo_cierre?: string | null
          updated_at?: string
          z?: Json | null
        }
        Update: {
          abierta_en?: string
          arqueo_pendiente?: boolean
          cerrada_en?: string | null
          cerrada_por?: string | null
          created_at?: string
          descuadre?: number | null
          efectivo_contado?: number | null
          id?: string
          location_id?: string
          mesas_abiertas?: number
          numero?: number
          tenant_id?: string
          tipo_cierre?: string | null
          updated_at?: string
          z?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "jornada_cerrada_por_fkey"
            columns: ["cerrada_por"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jornada_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "location"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jornada_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      licencia: {
        Row: {
          canjeado_at: string | null
          codigo: string
          created_at: string
          id: string
          meses: number
          modulos: string[]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          canjeado_at?: string | null
          codigo: string
          created_at?: string
          id?: string
          meses: number
          modulos?: string[]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          canjeado_at?: string | null
          codigo?: string
          created_at?: string
          id?: string
          meses?: number
          modulos?: string[]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "licencia_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      location: {
        Row: {
          cif: string
          codigo_postal: string | null
          contacto: string | null
          created_at: string
          direccion: string | null
          email: string | null
          id: string
          nombre: string
          nombre_comercial: string | null
          poblacion: string | null
          provincia: string | null
          razon_social: string
          regimen_facturacion: string
          serie_factura: string
          telefono: string | null
          tenant_id: string
          territorio_fiscal: string
          updated_at: string
          web: string | null
        }
        Insert: {
          cif: string
          codigo_postal?: string | null
          contacto?: string | null
          created_at?: string
          direccion?: string | null
          email?: string | null
          id?: string
          nombre: string
          nombre_comercial?: string | null
          poblacion?: string | null
          provincia?: string | null
          razon_social: string
          regimen_facturacion?: string
          serie_factura?: string
          telefono?: string | null
          tenant_id: string
          territorio_fiscal?: string
          updated_at?: string
          web?: string | null
        }
        Update: {
          cif?: string
          codigo_postal?: string | null
          contacto?: string | null
          created_at?: string
          direccion?: string | null
          email?: string | null
          id?: string
          nombre?: string
          nombre_comercial?: string | null
          poblacion?: string | null
          provincia?: string | null
          razon_social?: string
          regimen_facturacion?: string
          serie_factura?: string
          telefono?: string | null
          tenant_id?: string
          territorio_fiscal?: string
          updated_at?: string
          web?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "location_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      menu: {
        Row: {
          activo: boolean | null
          category_id: string | null
          clase_fiscal: string
          created_at: string | null
          id: string
          nombre: string
          orden: number | null
          precio: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          activo?: boolean | null
          category_id?: string | null
          clase_fiscal?: string
          created_at?: string | null
          id?: string
          nombre: string
          orden?: number | null
          precio?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          activo?: boolean | null
          category_id?: string | null
          clase_fiscal?: string
          created_at?: string | null
          id?: string
          nombre?: string
          orden?: number | null
          precio?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "category"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_choice: {
        Row: {
          group_id: string
          product_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          group_id: string
          product_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          group_id?: string
          product_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_choice_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "menu_group"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_choice_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_choice_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_group: {
        Row: {
          id: string
          menu_id: string
          nombre: string
          orden: number | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          id?: string
          menu_id: string
          nombre: string
          orden?: number | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          id?: string
          menu_id?: string
          nombre?: string
          orden?: number | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_group_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "menu"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_group_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      modifier: {
        Row: {
          id: string
          modifier_group_id: string
          nombre: string
          precio_extra: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          id?: string
          modifier_group_id: string
          nombre: string
          precio_extra?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          id?: string
          modifier_group_id?: string
          nombre?: string
          precio_extra?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "modifier_modifier_group_id_fkey"
            columns: ["modifier_group_id"]
            isOneToOne: false
            referencedRelation: "modifier_group"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "modifier_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      modifier_group: {
        Row: {
          id: string
          max_sel: number
          min_sel: number
          nombre: string
          product_id: string | null
          tenant_id: string
          tipo: string
          updated_at: string
        }
        Insert: {
          id?: string
          max_sel?: number
          min_sel?: number
          nombre: string
          product_id?: string | null
          tenant_id: string
          tipo?: string
          updated_at?: string
        }
        Update: {
          id?: string
          max_sel?: number
          min_sel?: number
          nombre?: string
          product_id?: string | null
          tenant_id?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "modifier_group_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "modifier_group_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      modifier_group_asignacion: {
        Row: {
          category_id: string | null
          created_at: string
          family_id: string | null
          id: string
          modifier_group_id: string
          modo: string
          product_id: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          family_id?: string | null
          id?: string
          modifier_group_id: string
          modo?: string
          product_id?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          family_id?: string | null
          id?: string
          modifier_group_id?: string
          modo?: string
          product_id?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "modifier_group_asignacion_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "category"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "modifier_group_asignacion_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "family"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "modifier_group_asignacion_modifier_group_id_fkey"
            columns: ["modifier_group_id"]
            isOneToOne: false
            referencedRelation: "modifier_group"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "modifier_group_asignacion_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "modifier_group_asignacion_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      nodo_instancia: {
        Row: {
          clave_publica: string | null
          created_at: string
          estado: string
          fingerprint: string | null
          id: string
          location_id: string
          orden_id: string | null
          plataforma: string | null
          reemplaza_a: string | null
          revocado_at: string | null
          tenant_id: string
          ultimo_contacto: string | null
          version: string | null
        }
        Insert: {
          clave_publica?: string | null
          created_at?: string
          estado?: string
          fingerprint?: string | null
          id?: string
          location_id: string
          orden_id?: string | null
          plataforma?: string | null
          reemplaza_a?: string | null
          revocado_at?: string | null
          tenant_id: string
          ultimo_contacto?: string | null
          version?: string | null
        }
        Update: {
          clave_publica?: string | null
          created_at?: string
          estado?: string
          fingerprint?: string | null
          id?: string
          location_id?: string
          orden_id?: string | null
          plataforma?: string | null
          reemplaza_a?: string | null
          revocado_at?: string | null
          tenant_id?: string
          ultimo_contacto?: string | null
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nodo_instancia_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "location"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nodo_instancia_orden_id_fkey"
            columns: ["orden_id"]
            isOneToOne: false
            referencedRelation: "orden_instalacion"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nodo_instancia_reemplaza_a_fkey"
            columns: ["reemplaza_a"]
            isOneToOne: false
            referencedRelation: "nodo_instancia"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nodo_instancia_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      nodo_release: {
        Row: {
          id: string
          notas: string | null
          obligatoria: boolean
          publicada_at: string
          sha256: string
          url: string
          version: string
        }
        Insert: {
          id?: string
          notas?: string | null
          obligatoria?: boolean
          publicada_at?: string
          sha256: string
          url: string
          version: string
        }
        Update: {
          id?: string
          notas?: string | null
          obligatoria?: boolean
          publicada_at?: string
          sha256?: string
          url?: string
          version?: string
        }
        Relationships: []
      }
      nota_preparacion: {
        Row: {
          created_at: string | null
          descripcion: string | null
          id: string
          nombre: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string | null
          descripcion?: string | null
          id?: string
          nombre: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string | null
          descripcion?: string | null
          id?: string
          nombre?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "nota_preparacion_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      offer: {
        Row: {
          activa: boolean | null
          color: string | null
          created_at: string | null
          descripcion: string | null
          emoji: string | null
          id: string
          media_tipo: string
          media_url: string | null
          orden: number | null
          precio: string | null
          tenant_id: string
          titulo: string
          updated_at: string
        }
        Insert: {
          activa?: boolean | null
          color?: string | null
          created_at?: string | null
          descripcion?: string | null
          emoji?: string | null
          id?: string
          media_tipo?: string
          media_url?: string | null
          orden?: number | null
          precio?: string | null
          tenant_id: string
          titulo: string
          updated_at?: string
        }
        Update: {
          activa?: boolean | null
          color?: string | null
          created_at?: string | null
          descripcion?: string | null
          emoji?: string | null
          id?: string
          media_tipo?: string
          media_url?: string | null
          orden?: number | null
          precio?: string | null
          tenant_id?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "offer_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      online_order: {
        Row: {
          created_at: string
          estado: string
          id: string
          location_id: string
          order_id: string | null
          origen: string
          ref_externa: string | null
          tenant_id: string
        }
        Insert: {
          created_at?: string
          estado?: string
          id?: string
          location_id: string
          order_id?: string | null
          origen: string
          ref_externa?: string | null
          tenant_id: string
        }
        Update: {
          created_at?: string
          estado?: string
          id?: string
          location_id?: string
          order_id?: string | null
          origen?: string
          ref_externa?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "online_order_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "location"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "online_order_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "sales_order"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "online_order_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      orden_instalacion: {
        Row: {
          canjeada_at: string | null
          codigo_hash: string
          created_at: string
          emitida_por: string | null
          estado: string
          expira_at: string
          id: string
          location_id: string
          nodo_id: string | null
          reserva_hash: string | null
          reservada_at: string | null
          revocada_at: string | null
          tenant_id: string
        }
        Insert: {
          canjeada_at?: string | null
          codigo_hash: string
          created_at?: string
          emitida_por?: string | null
          estado?: string
          expira_at?: string
          id?: string
          location_id: string
          nodo_id?: string | null
          reserva_hash?: string | null
          reservada_at?: string | null
          revocada_at?: string | null
          tenant_id: string
        }
        Update: {
          canjeada_at?: string | null
          codigo_hash?: string
          created_at?: string
          emitida_por?: string | null
          estado?: string
          expira_at?: string
          id?: string
          location_id?: string
          nodo_id?: string | null
          reserva_hash?: string | null
          reservada_at?: string | null
          revocada_at?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orden_instalacion_emitida_por_fkey"
            columns: ["emitida_por"]
            isOneToOne: false
            referencedRelation: "cuenta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orden_instalacion_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "location"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orden_instalacion_nodo_fk"
            columns: ["nodo_id"]
            isOneToOne: false
            referencedRelation: "nodo_instancia"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orden_instalacion_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      order_event: {
        Row: {
          created_at: string
          id: string
          order_id: string
          payload: Json | null
          tenant_id: string
          tipo: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          payload?: Json | null
          tenant_id: string
          tipo: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          payload?: Json | null
          tenant_id?: string
          tipo?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_event_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "sales_order"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_event_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_event_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
        ]
      }
      order_line: {
        Row: {
          cantidad: number
          created_at: string
          estacion: string | null
          id: string
          modificadores: Json
          nombre: string
          notas: string | null
          order_id: string
          pase: number | null
          precio_unitario: number
          product_id: string | null
          tenant_id: string
          tipo_impositivo: number
          user_id: string | null
        }
        Insert: {
          cantidad?: number
          created_at?: string
          estacion?: string | null
          id?: string
          modificadores?: Json
          nombre: string
          notas?: string | null
          order_id: string
          pase?: number | null
          precio_unitario: number
          product_id?: string | null
          tenant_id: string
          tipo_impositivo: number
          user_id?: string | null
        }
        Update: {
          cantidad?: number
          created_at?: string
          estacion?: string | null
          id?: string
          modificadores?: Json
          nombre?: string
          notas?: string | null
          order_id?: string
          pase?: number | null
          precio_unitario?: number
          product_id?: string | null
          tenant_id?: string
          tipo_impositivo?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_line_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "sales_order"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_line_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_line_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_line_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
        ]
      }
      pago_gluuh: {
        Row: {
          concepto: string | null
          created_at: string
          fecha: string
          id: string
          importe: number
          metodo: string | null
          periodo_desde: string | null
          periodo_hasta: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          concepto?: string | null
          created_at?: string
          fecha?: string
          id?: string
          importe: number
          metodo?: string | null
          periodo_desde?: string | null
          periodo_hasta?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          concepto?: string | null
          created_at?: string
          fecha?: string
          id?: string
          importe?: number
          metodo?: string | null
          periodo_desde?: string | null
          periodo_hasta?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pago_gluuh_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      payment: {
        Row: {
          client_id: string
          created_at: string
          id: string
          importe: number
          metodo: string
          order_id: string
          propina: number
          ref_pasarela: string | null
          tenant_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          importe: number
          metodo: string
          order_id: string
          propina?: number
          ref_pasarela?: string | null
          tenant_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          importe?: number
          metodo?: string
          order_id?: string
          propina?: number
          ref_pasarela?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "sales_order"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_method: {
        Row: {
          abre_cajon: boolean
          activo: boolean | null
          created_at: string | null
          cuenta_arqueo: boolean
          id: string
          nombre: string
          orden: number | null
          tenant_id: string
          tipo: string
          updated_at: string
        }
        Insert: {
          abre_cajon?: boolean
          activo?: boolean | null
          created_at?: string | null
          cuenta_arqueo?: boolean
          id?: string
          nombre: string
          orden?: number | null
          tenant_id: string
          tipo?: string
          updated_at?: string
        }
        Update: {
          abre_cajon?: boolean
          activo?: boolean | null
          created_at?: string | null
          cuenta_arqueo?: boolean
          id?: string
          nombre?: string
          orden?: number | null
          tenant_id?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_method_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      perfil: {
        Row: {
          created_at: string | null
          descripcion: string | null
          id: string
          nombre: string
          permisos: Json
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string | null
          descripcion?: string | null
          id?: string
          nombre: string
          permisos?: Json
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string | null
          descripcion?: string | null
          id?: string
          nombre?: string
          permisos?: Json
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "perfil_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      periodo_servicio: {
        Row: {
          created_at: string | null
          hora_fin: string | null
          hora_inicio: string | null
          id: string
          nombre: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string | null
          hora_fin?: string | null
          hora_inicio?: string | null
          id?: string
          nombre: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string | null
          hora_fin?: string | null
          hora_inicio?: string | null
          id?: string
          nombre?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "periodo_servicio_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      pin_intento: {
        Row: {
          bloqueado_hasta: string | null
          device_id: string | null
          id: string
          intentos: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          bloqueado_hasta?: string | null
          device_id?: string | null
          id?: string
          intentos?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          bloqueado_hasta?: string | null
          device_id?: string | null
          id?: string
          intentos?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pin_intento_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "device"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pin_intento_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      plano_elemento: {
        Row: {
          alto: number
          ancho: number
          color: string | null
          created_at: string
          etiqueta: string | null
          icono: string | null
          id: string
          pos_x: number
          pos_y: number
          room_id: string
          rotacion: number
          tenant_id: string
          tipo: string
          updated_at: string
        }
        Insert: {
          alto?: number
          ancho?: number
          color?: string | null
          created_at?: string
          etiqueta?: string | null
          icono?: string | null
          id?: string
          pos_x?: number
          pos_y?: number
          room_id: string
          rotacion?: number
          tenant_id: string
          tipo: string
          updated_at?: string
        }
        Update: {
          alto?: number
          ancho?: number
          color?: string | null
          created_at?: string
          etiqueta?: string | null
          icono?: string | null
          id?: string
          pos_x?: number
          pos_y?: number
          room_id?: string
          rotacion?: number
          tenant_id?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plano_elemento_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "room"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plano_elemento_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      plantilla_comanda: {
        Row: {
          created_at: string | null
          descripcion: string | null
          id: string
          nombre: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string | null
          descripcion?: string | null
          id?: string
          nombre: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string | null
          descripcion?: string | null
          id?: string
          nombre?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plantilla_comanda_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      plantilla_etiqueta: {
        Row: {
          created_at: string | null
          descripcion: string | null
          id: string
          nombre: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string | null
          descripcion?: string | null
          id?: string
          nombre: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string | null
          descripcion?: string | null
          id?: string
          nombre?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plantilla_etiqueta_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      plantilla_ticket: {
        Row: {
          created_at: string | null
          descripcion: string | null
          id: string
          nombre: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string | null
          descripcion?: string | null
          id?: string
          nombre: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string | null
          descripcion?: string | null
          id?: string
          nombre?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plantilla_ticket_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_admin: {
        Row: {
          auth_user_id: string
          created_at: string
        }
        Insert: {
          auth_user_id: string
          created_at?: string
        }
        Update: {
          auth_user_id?: string
          created_at?: string
        }
        Relationships: []
      }
      print_job: {
        Row: {
          client_id: string | null
          created_at: string
          error: string | null
          estado: string
          id: string
          intentos: number
          origen_device: string | null
          payload: Json
          printer_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          error?: string | null
          estado?: string
          id?: string
          intentos?: number
          origen_device?: string | null
          payload: Json
          printer_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          error?: string | null
          estado?: string
          id?: string
          intentos?: number
          origen_device?: string | null
          payload?: Json
          printer_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "print_job_printer_id_fkey"
            columns: ["printer_id"]
            isOneToOne: false
            referencedRelation: "printer"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_job_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      print_route: {
        Row: {
          created_at: string
          estacion: string
          id: string
          printer_id: string
          room_id: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          estacion: string
          id?: string
          printer_id: string
          room_id?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          estacion?: string
          id?: string
          printer_id?: string
          room_id?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "print_route_printer_id_fkey"
            columns: ["printer_id"]
            isOneToOne: false
            referencedRelation: "printer"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_route_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "room"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_route_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      printer: {
        Row: {
          activa: boolean
          ancho: number
          created_at: string
          destino: string | null
          device_id: string | null
          id: string
          location_id: string | null
          nombre: string
          rol: string
          tenant_id: string
          tipo: string
          transporte: string
          updated_at: string
        }
        Insert: {
          activa?: boolean
          ancho?: number
          created_at?: string
          destino?: string | null
          device_id?: string | null
          id?: string
          location_id?: string | null
          nombre: string
          rol?: string
          tenant_id: string
          tipo?: string
          transporte?: string
          updated_at?: string
        }
        Update: {
          activa?: boolean
          ancho?: number
          created_at?: string
          destino?: string | null
          device_id?: string | null
          id?: string
          location_id?: string | null
          nombre?: string
          rol?: string
          tenant_id?: string
          tipo?: string
          transporte?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "printer_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "device"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "printer_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "location"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "printer_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      product: {
        Row: {
          agotado_hasta: string | null
          alergenos: string[]
          carta_nombre: string | null
          category_id: string | null
          clase_fiscal: string
          codigo_barras: string | null
          combinable: boolean | null
          created_at: string
          descripcion: string | null
          disponible: boolean
          es_alcohol: boolean
          es_anadido: boolean
          es_principal: boolean
          estacion: string | null
          family_id: string | null
          foto_url: string | null
          id: string
          nombre: string
          nombre_cocina: string | null
          nombre_ticket: string | null
          orden: number
          plu: string | null
          precio: number
          tenant_id: string
          texto_boton: string | null
          tiempo_preparacion_min: number | null
          tipo_impositivo: number
          updated_at: string
          vendido_por_peso: boolean
        }
        Insert: {
          agotado_hasta?: string | null
          alergenos?: string[]
          carta_nombre?: string | null
          category_id?: string | null
          clase_fiscal?: string
          codigo_barras?: string | null
          combinable?: boolean | null
          created_at?: string
          descripcion?: string | null
          disponible?: boolean
          es_alcohol?: boolean
          es_anadido?: boolean
          es_principal?: boolean
          estacion?: string | null
          family_id?: string | null
          foto_url?: string | null
          id?: string
          nombre: string
          nombre_cocina?: string | null
          nombre_ticket?: string | null
          orden?: number
          plu?: string | null
          precio: number
          tenant_id: string
          texto_boton?: string | null
          tiempo_preparacion_min?: number | null
          tipo_impositivo?: number
          updated_at?: string
          vendido_por_peso?: boolean
        }
        Update: {
          agotado_hasta?: string | null
          alergenos?: string[]
          carta_nombre?: string | null
          category_id?: string | null
          clase_fiscal?: string
          codigo_barras?: string | null
          combinable?: boolean | null
          created_at?: string
          descripcion?: string | null
          disponible?: boolean
          es_alcohol?: boolean
          es_anadido?: boolean
          es_principal?: boolean
          estacion?: string | null
          family_id?: string | null
          foto_url?: string | null
          id?: string
          nombre?: string
          nombre_cocina?: string | null
          nombre_ticket?: string | null
          orden?: number
          plu?: string | null
          precio?: number
          tenant_id?: string
          texto_boton?: string | null
          tiempo_preparacion_min?: number | null
          tipo_impositivo?: number
          updated_at?: string
          vendido_por_peso?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "product_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "category"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "family"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      product_allergen: {
        Row: {
          allergen_id: string
          product_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          allergen_id: string
          product_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          allergen_id?: string
          product_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_allergen_allergen_id_fkey"
            columns: ["allergen_id"]
            isOneToOne: false
            referencedRelation: "allergen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_allergen_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product"
            referencedColumns: ["id"]
          },
        ]
      }
      product_category: {
        Row: {
          category_id: string
          orden: number | null
          product_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          category_id: string
          orden?: number | null
          product_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          category_id?: string
          orden?: number | null
          product_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_category_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "category"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_category_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_category_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      product_etiqueta: {
        Row: {
          etiqueta_id: string
          product_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          etiqueta_id: string
          product_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          etiqueta_id?: string
          product_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_etiqueta_etiqueta_id_fkey"
            columns: ["etiqueta_id"]
            isOneToOne: false
            referencedRelation: "etiqueta_producto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_etiqueta_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_etiqueta_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      product_format: {
        Row: {
          created_at: string
          id: string
          nombre: string
          orden: number
          precio: number
          product_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          nombre: string
          orden?: number
          precio: number
          product_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          nombre?: string
          orden?: number
          precio?: number
          product_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_format_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_format_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      product_price: {
        Row: {
          id: string
          precio: number
          product_id: string
          tarifa_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          id?: string
          precio: number
          product_id: string
          tarifa_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          id?: string
          precio?: number
          product_id?: string
          tarifa_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_price_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_price_tarifa_id_fkey"
            columns: ["tarifa_id"]
            isOneToOne: false
            referencedRelation: "tarifa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_price_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      promocion: {
        Row: {
          activa: boolean
          category_id: string | null
          created_at: string | null
          descripcion: string | null
          dias_semana: number[] | null
          fecha_fin: string | null
          fecha_inicio: string | null
          hora_fin: string | null
          hora_inicio: string | null
          id: string
          nombre: string
          product_id: string | null
          tenant_id: string
          tipo: string
          updated_at: string
          valor: number
        }
        Insert: {
          activa?: boolean
          category_id?: string | null
          created_at?: string | null
          descripcion?: string | null
          dias_semana?: number[] | null
          fecha_fin?: string | null
          fecha_inicio?: string | null
          hora_fin?: string | null
          hora_inicio?: string | null
          id?: string
          nombre: string
          product_id?: string | null
          tenant_id: string
          tipo?: string
          updated_at?: string
          valor?: number
        }
        Update: {
          activa?: boolean
          category_id?: string | null
          created_at?: string | null
          descripcion?: string | null
          dias_semana?: number[] | null
          fecha_fin?: string | null
          fecha_inicio?: string | null
          hora_fin?: string | null
          hora_inicio?: string | null
          id?: string
          nombre?: string
          product_id?: string | null
          tenant_id?: string
          tipo?: string
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "promocion_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "category"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promocion_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promocion_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      punto_venta: {
        Row: {
          created_at: string | null
          descripcion: string | null
          id: string
          nombre: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string | null
          descripcion?: string | null
          id?: string
          nombre: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string | null
          descripcion?: string | null
          id?: string
          nombre?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "punto_venta_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_item: {
        Row: {
          cantidad: number
          id: string
          ingredient_id: string
          product_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          cantidad: number
          id?: string
          ingredient_id: string
          product_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          cantidad?: number
          id?: string
          ingredient_id?: string
          product_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_item_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredient"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_item_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_item_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      reservation: {
        Row: {
          alergias: string | null
          canal: string | null
          comensales: number
          created_at: string
          customer_id: string | null
          estado: string
          fecha_hora: string
          id: string
          location_id: string
          nombre: string | null
          notas: string | null
          table_id: string | null
          telefono: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          alergias?: string | null
          canal?: string | null
          comensales: number
          created_at?: string
          customer_id?: string | null
          estado?: string
          fecha_hora: string
          id?: string
          location_id: string
          nombre?: string | null
          notas?: string | null
          table_id?: string | null
          telefono?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          alergias?: string | null
          canal?: string | null
          comensales?: number
          created_at?: string
          customer_id?: string | null
          estado?: string
          fecha_hora?: string
          id?: string
          location_id?: string
          nombre?: string | null
          notas?: string | null
          table_id?: string | null
          telefono?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservation_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservation_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "location"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservation_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "restaurant_table"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservation_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_table: {
        Row: {
          capacidad: number
          color: string | null
          estado: string
          id: string
          nombre: string
          pos_x: number | null
          pos_y: number | null
          room_id: string
          rotacion: number
          sprite: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          capacidad?: number
          color?: string | null
          estado?: string
          id?: string
          nombre: string
          pos_x?: number | null
          pos_y?: number | null
          room_id: string
          rotacion?: number
          sprite?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          capacidad?: number
          color?: string | null
          estado?: string
          id?: string
          nombre?: string
          pos_x?: number | null
          pos_y?: number | null
          room_id?: string
          rotacion?: number
          sprite?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_table_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "room"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_table_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      room: {
        Row: {
          id: string
          location_id: string
          nombre: string
          orden: number
          suelo: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          id?: string
          location_id: string
          nombre: string
          orden?: number
          suelo?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          id?: string
          location_id?: string
          nombre?: string
          orden?: number
          suelo?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "location"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_center: {
        Row: {
          created_at: string | null
          descripcion: string | null
          id: string
          nombre: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string | null
          descripcion?: string | null
          id?: string
          nombre: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string | null
          descripcion?: string | null
          id?: string
          nombre?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_center_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_order: {
        Row: {
          aparcado_como: string | null
          canal: string
          canal_pedido: string | null
          client_id: string
          cliente_nombre: string | null
          cliente_telefono: string | null
          comensales: number | null
          created_at: string
          customer_id: string | null
          deleted_at: string | null
          direccion: string | null
          entrega_at: string | null
          estado: string
          estado_preparacion: string
          id: string
          jornada_id: string | null
          location_id: string
          motivo_no_venta: string | null
          notas: string | null
          numero_pedido: number | null
          table_id: string | null
          tenant_id: string
          tipo_consumo: string | null
          tipo_operacion: string
          total: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          aparcado_como?: string | null
          canal?: string
          canal_pedido?: string | null
          client_id: string
          cliente_nombre?: string | null
          cliente_telefono?: string | null
          comensales?: number | null
          created_at?: string
          customer_id?: string | null
          deleted_at?: string | null
          direccion?: string | null
          entrega_at?: string | null
          estado?: string
          estado_preparacion?: string
          id?: string
          jornada_id?: string | null
          location_id: string
          motivo_no_venta?: string | null
          notas?: string | null
          numero_pedido?: number | null
          table_id?: string | null
          tenant_id: string
          tipo_consumo?: string | null
          tipo_operacion?: string
          total?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          aparcado_como?: string | null
          canal?: string
          canal_pedido?: string | null
          client_id?: string
          cliente_nombre?: string | null
          cliente_telefono?: string | null
          comensales?: number | null
          created_at?: string
          customer_id?: string | null
          deleted_at?: string | null
          direccion?: string | null
          entrega_at?: string | null
          estado?: string
          estado_preparacion?: string
          id?: string
          jornada_id?: string | null
          location_id?: string
          motivo_no_venta?: string | null
          notas?: string | null
          numero_pedido?: number | null
          table_id?: string | null
          tenant_id?: string
          tipo_consumo?: string | null
          tipo_operacion?: string
          total?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_order_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_jornada_id_fkey"
            columns: ["jornada_id"]
            isOneToOne: false
            referencedRelation: "jornada"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "location"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "restaurant_table"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
        ]
      }
      sesion_contexto: {
        Row: {
          app_user_id: string
          cuenta_id: string
          location_id: string | null
          session_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          app_user_id: string
          cuenta_id: string
          location_id?: string | null
          session_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          app_user_id?: string
          cuenta_id?: string
          location_id?: string | null
          session_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sesion_contexto_app_user_id_fkey"
            columns: ["app_user_id"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sesion_contexto_cuenta_id_fkey"
            columns: ["cuenta_id"]
            isOneToOne: false
            referencedRelation: "cuenta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sesion_contexto_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "location"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sesion_contexto_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      sesion_operario: {
        Row: {
          app_user_id: string
          desde: string
          device_id: string
          tenant_id: string
          ultima_actividad: string
        }
        Insert: {
          app_user_id: string
          desde?: string
          device_id: string
          tenant_id: string
          ultima_actividad?: string
        }
        Update: {
          app_user_id?: string
          desde?: string
          device_id?: string
          tenant_id?: string
          ultima_actividad?: string
        }
        Relationships: [
          {
            foreignKeyName: "sesion_operario_app_user_id_fkey"
            columns: ["app_user_id"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sesion_operario_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: true
            referencedRelation: "device"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sesion_operario_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      sesion_registro: {
        Row: {
          creada_at: string
          cuenta_id: string
          revocada_at: string | null
          session_id: string
          ultima_vista: string
          user_agent: string | null
        }
        Insert: {
          creada_at?: string
          cuenta_id: string
          revocada_at?: string | null
          session_id: string
          ultima_vista?: string
          user_agent?: string | null
        }
        Update: {
          creada_at?: string
          cuenta_id?: string
          revocada_at?: string | null
          session_id?: string
          ultima_vista?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sesion_registro_cuenta_id_fkey"
            columns: ["cuenta_id"]
            isOneToOne: false
            referencedRelation: "cuenta"
            referencedColumns: ["id"]
          },
        ]
      }
      sesion_soporte: {
        Row: {
          aprobada_por: string | null
          created_at: string
          cuenta_soporte: string
          desde: string
          estado: string
          hasta: string
          id: string
          motivo: string
          revocada_at: string | null
          tenant_id: string
          tipo: string
        }
        Insert: {
          aprobada_por?: string | null
          created_at?: string
          cuenta_soporte: string
          desde?: string
          estado?: string
          hasta: string
          id?: string
          motivo: string
          revocada_at?: string | null
          tenant_id: string
          tipo?: string
        }
        Update: {
          aprobada_por?: string | null
          created_at?: string
          cuenta_soporte?: string
          desde?: string
          estado?: string
          hasta?: string
          id?: string
          motivo?: string
          revocada_at?: string | null
          tenant_id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "sesion_soporte_aprobada_por_fkey"
            columns: ["aprobada_por"]
            isOneToOne: false
            referencedRelation: "cuenta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sesion_soporte_cuenta_soporte_fkey"
            columns: ["cuenta_soporte"]
            isOneToOne: false
            referencedRelation: "cuenta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sesion_soporte_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      setting: {
        Row: {
          device_id: string | null
          id: string
          key: string
          location_id: string | null
          scope: string
          tenant_id: string
          updated_at: string
          value: Json | null
        }
        Insert: {
          device_id?: string | null
          id?: string
          key: string
          location_id?: string | null
          scope: string
          tenant_id: string
          updated_at?: string
          value?: Json | null
        }
        Update: {
          device_id?: string | null
          id?: string
          key?: string
          location_id?: string | null
          scope?: string
          tenant_id?: string
          updated_at?: string
          value?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "setting_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "device"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "setting_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "location"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "setting_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      shift: {
        Row: {
          created_at: string
          entrada: string
          id: string
          salida: string | null
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          entrada: string
          id?: string
          salida?: string | null
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          entrada?: string
          id?: string
          salida?: string | null
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_move: {
        Row: {
          cantidad: number
          created_at: string
          id: string
          ingredient_id: string
          motivo: string | null
          tenant_id: string
          tipo: string
        }
        Insert: {
          cantidad: number
          created_at?: string
          id?: string
          ingredient_id: string
          motivo?: string | null
          tenant_id: string
          tipo: string
        }
        Update: {
          cantidad?: number
          created_at?: string
          id?: string
          ingredient_id?: string
          motivo?: string | null
          tenant_id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_move_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredient"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_move_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier: {
        Row: {
          created_at: string | null
          email: string | null
          id: string
          nif: string | null
          nombre: string
          notas: string | null
          telefono: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id?: string
          nif?: string | null
          nombre: string
          notas?: string | null
          telefono?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string
          nif?: string | null
          nombre?: string
          notas?: string | null
          telefono?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      tarifa: {
        Row: {
          created_at: string | null
          descripcion: string | null
          id: string
          nombre: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string | null
          descripcion?: string | null
          id?: string
          nombre: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string | null
          descripcion?: string | null
          id?: string
          nombre?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tarifa_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      tarifa_plataforma: {
        Row: {
          clave: string
          etiqueta: string
          precio: number
          updated_at: string
        }
        Insert: {
          clave: string
          etiqueta: string
          precio?: number
          updated_at?: string
        }
        Update: {
          clave?: string
          etiqueta?: string
          precio?: number
          updated_at?: string
        }
        Relationships: []
      }
      tax_line: {
        Row: {
          base: number
          cuota: number
          id: string
          impuesto: string
          invoice_id: string
          tenant_id: string
          tipo: number
        }
        Insert: {
          base: number
          cuota: number
          id?: string
          impuesto: string
          invoice_id: string
          tenant_id: string
          tipo: number
        }
        Update: {
          base?: number
          cuota?: number
          id?: string
          impuesto?: string
          invoice_id?: string
          tenant_id?: string
          tipo?: number
        }
        Relationships: [
          {
            foreignKeyName: "tax_line_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoice"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_line_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_rate: {
        Row: {
          clase_fiscal: string
          porcentaje: number
          territorio: string
        }
        Insert: {
          clase_fiscal: string
          porcentaje: number
          territorio: string
        }
        Update: {
          clase_fiscal?: string
          porcentaje?: number
          territorio?: string
        }
        Relationships: []
      }
      tenant: {
        Row: {
          activo: boolean
          ciclo_pago: string | null
          cif: string | null
          clave_tecnica_hash: string | null
          codigo_instalacion: string | null
          created_at: string
          email_admin: string | null
          es_plantilla: boolean
          estado_alta: string
          forma_pago: string | null
          id: string
          licencia_hasta: string | null
          licencia_limites: Json | null
          licencia_modulos: string[]
          nombre: string
          plan: string
          precio_periodo: number | null
          proximo_pago: string | null
          slug: string | null
          stripe_customer_id: string | null
          updated_at: string
        }
        Insert: {
          activo?: boolean
          ciclo_pago?: string | null
          cif?: string | null
          clave_tecnica_hash?: string | null
          codigo_instalacion?: string | null
          created_at?: string
          email_admin?: string | null
          es_plantilla?: boolean
          estado_alta?: string
          forma_pago?: string | null
          id?: string
          licencia_hasta?: string | null
          licencia_limites?: Json | null
          licencia_modulos?: string[]
          nombre: string
          plan?: string
          precio_periodo?: number | null
          proximo_pago?: string | null
          slug?: string | null
          stripe_customer_id?: string | null
          updated_at?: string
        }
        Update: {
          activo?: boolean
          ciclo_pago?: string | null
          cif?: string | null
          clave_tecnica_hash?: string | null
          codigo_instalacion?: string | null
          created_at?: string
          email_admin?: string | null
          es_plantilla?: boolean
          estado_alta?: string
          forma_pago?: string | null
          id?: string
          licencia_hasta?: string | null
          licencia_limites?: Json | null
          licencia_modulos?: string[]
          nombre?: string
          plan?: string
          precio_periodo?: number | null
          proximo_pago?: string | null
          slug?: string | null
          stripe_customer_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      tenant_branding: {
        Row: {
          color_primario: string | null
          color_secundario: string | null
          kiosko_subtitulo: string | null
          kiosko_titulo: string | null
          logo_ticket_url: string | null
          logo_url: string | null
          mesa_color: string | null
          nombre_comercial: string | null
          silla_color: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          color_primario?: string | null
          color_secundario?: string | null
          kiosko_subtitulo?: string | null
          kiosko_titulo?: string | null
          logo_ticket_url?: string | null
          logo_url?: string | null
          mesa_color?: string | null
          nombre_comercial?: string | null
          silla_color?: string | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          color_primario?: string | null
          color_secundario?: string | null
          kiosko_subtitulo?: string | null
          kiosko_titulo?: string | null
          logo_ticket_url?: string | null
          logo_url?: string | null
          mesa_color?: string | null
          nombre_comercial?: string | null
          silla_color?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_branding_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_module: {
        Row: {
          activo: boolean
          config: Json
          modulo: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          config?: Json
          modulo: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          config?: Json
          modulo?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_module_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      ticketbai_record: {
        Row: {
          created_at: string
          encadenamiento: string | null
          estado_envio: string
          firma: string | null
          id: string
          invoice_id: string
          tenant_id: string
          territorio: string
        }
        Insert: {
          created_at?: string
          encadenamiento?: string | null
          estado_envio?: string
          firma?: string | null
          id?: string
          invoice_id: string
          tenant_id: string
          territorio: string
        }
        Update: {
          created_at?: string
          encadenamiento?: string | null
          estado_envio?: string
          firma?: string | null
          id?: string
          invoice_id?: string
          tenant_id?: string
          territorio?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticketbai_record_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoice"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticketbai_record_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      tipo_preparacion: {
        Row: {
          created_at: string | null
          descripcion: string | null
          id: string
          nombre: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string | null
          descripcion?: string | null
          id?: string
          nombre: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string | null
          descripcion?: string | null
          id?: string
          nombre?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tipo_preparacion_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      tombstone_sync: {
        Row: {
          clave: Json
          id: string
          origen: string
          tabla: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          clave: Json
          id?: string
          origen?: string
          tabla: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          clave?: Json
          id?: string
          origen?: string
          tabla?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      unit_of_measure: {
        Row: {
          abreviatura: string | null
          created_at: string | null
          id: string
          nombre: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          abreviatura?: string | null
          created_at?: string | null
          id?: string
          nombre: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          abreviatura?: string | null
          created_at?: string | null
          id?: string
          nombre?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "unit_of_measure_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      verifactu_record: {
        Row: {
          created_at: string
          device_id: string | null
          estado_envio: string
          fecha_hora_gen: string
          huella: string
          huella_anterior: string
          id: string
          invoice_id: string
          qr_url: string
          respuesta_aeat: Json | null
          tenant_id: string
          tipo_registro: string
        }
        Insert: {
          created_at?: string
          device_id?: string | null
          estado_envio?: string
          fecha_hora_gen: string
          huella: string
          huella_anterior?: string
          id?: string
          invoice_id: string
          qr_url: string
          respuesta_aeat?: Json | null
          tenant_id: string
          tipo_registro?: string
        }
        Update: {
          created_at?: string
          device_id?: string | null
          estado_envio?: string
          fecha_hora_gen?: string
          huella?: string
          huella_anterior?: string
          id?: string
          invoice_id?: string
          qr_url?: string
          respuesta_aeat?: Json | null
          tenant_id?: string
          tipo_registro?: string
        }
        Relationships: [
          {
            foreignKeyName: "verifactu_record_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "device"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verifactu_record_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoice"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verifactu_record_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouse: {
        Row: {
          created_at: string | null
          direccion: string | null
          id: string
          nombre: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string | null
          direccion?: string | null
          id?: string
          nombre: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string | null
          direccion?: string | null
          id?: string
          nombre?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "warehouse_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _exigir_tenant: { Args: { v_tenant: string }; Returns: undefined }
      abrir_sesion_soporte: {
        Args: {
          p_minutos?: number
          p_motivo: string
          p_tenant: string
          p_tipo?: string
        }
        Returns: string
      }
      activar_licencia: { Args: { p_codigo: string }; Returns: Json }
      admin_dispositivos_empresa: {
        Args: { p_tenant: string }
        Returns: {
          id: string
          modulo: string
          nombre: string
          tipo: string
          ultima_conexion: string
          version: string
          vinculado_at: string
        }[]
      }
      admin_empresa_datos: {
        Args: { p_tenant: string }
        Returns: {
          cif: string
          codigo_postal: string
          direccion: string
          email_admin: string
          nombre: string
          poblacion: string
          provincia: string
          telefono: string
        }[]
      }
      admin_establecer_clave_tecnica: {
        Args: { p_clave: string; p_tenant: string }
        Returns: undefined
      }
      admin_generar_licencia: {
        Args: {
          p_codigo: string
          p_meses: number
          p_modulos: string[]
          p_tenant: string
        }
        Returns: undefined
      }
      admin_resumen_empresas: {
        Args: never
        Returns: {
          activo: boolean
          ciclo_pago: string
          cif: string
          codigo_instalacion: string
          created_at: string
          email_admin: string
          es_plantilla: boolean
          forma_pago: string
          id: string
          licencia_hasta: string
          licencia_limites: Json
          licencia_modulos: string[]
          n_dispositivos: number
          n_dispositivos_online: number
          n_productos: number
          n_usuarios: number
          nombre: string
          plan: string
          precio_calculado: number
          precio_periodo: number
          proximo_pago: string
          slug: string
        }[]
      }
      admin_sembrar_ejemplo: { Args: { p_tenant: string }; Returns: undefined }
      admin_sembrar_formas_pago: {
        Args: { p_tenant: string }
        Returns: undefined
      }
      admin_sembrar_operarios_defecto: {
        Args: { p_tenant: string }
        Returns: undefined
      }
      admin_uso_empresa: { Args: { p_tenant: string }; Returns: Json }
      admin_uso_empresas: {
        Args: never
        Returns: {
          importe_30d: number
          pedidos_30d: number
          pedidos_7d: number
          tenant_id: string
          ultima_conexion: string
          ultima_copia: string
          ultima_venta: string
        }[]
      }
      aprobar_sesion_soporte: { Args: { p_sesion: string }; Returns: undefined }
      asignar_pulsera: {
        Args: { p_codigo: string; p_user_id: string }
        Returns: undefined
      }
      cambiar_clave_operario: {
        Args: { p_clave: string; p_user_id: string }
        Returns: undefined
      }
      cambiar_pin: {
        Args: { p_pin: string; p_user_id: string }
        Returns: undefined
      }
      canjear_invitacion: {
        Args: { p_cuenta: string; p_token_hash: string }
        Returns: {
          aceptada_at: string | null
          created_at: string
          cuenta_id: string | null
          email: string
          emitida_por: string | null
          es_titular: boolean
          estado: string
          expira_at: string
          id: string
          nombre: string | null
          perfil_id: string | null
          rol: string
          tenant_id: string
          token_hash: string
        }[]
        SetofOptions: {
          from: "*"
          to: "invitacion"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      canjear_orden_instalacion: {
        Args: {
          p_clave_publica?: string
          p_codigo_hash: string
          p_fingerprint?: string
          p_plataforma?: string
          p_reserva_hash: string
          p_version?: string
        }
        Returns: {
          empresa: string
          local: string
          location_id: string
          nodo_id: string
          resultado: string
          tenant_id: string
        }[]
      }
      cerrar_jornada: {
        Args: {
          p_contado?: number
          p_jornada: string
          p_por?: string
          p_tipo?: string
        }
        Returns: Json
      }
      clientes_stats: {
        Args: never
        Returns: {
          customer_id: string
          ultima: string
          visitas: number
        }[]
      }
      cobrar_cuenta: {
        Args: {
          p_client_id?: string
          p_operario?: string
          p_order: string
          p_pagos?: Json
        }
        Returns: {
          order_id: string
          resultado: string
          total: number
        }[]
      }
      crear_empleado: {
        Args: {
          p_email: string
          p_nombre: string
          p_pin: string
          p_rol: string
        }
        Returns: string
      }
      crear_pedido: {
        Args: { p_items: Json; p_tipo_consumo: string }
        Returns: Json
      }
      crear_pedido_srv: {
        Args: {
          p_canal: string
          p_items: Json
          p_location: string
          p_tenant: string
          p_tipo_consumo: string
        }
        Returns: Json
      }
      current_tenant_id: { Args: never; Returns: string }
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      device_heartbeat: {
        Args: { p_device: string; p_version?: string }
        Returns: undefined
      }
      dividir_cuenta: {
        Args: {
          p_campos: Json
          p_docs: Json
          p_etiqueta_base: string
          p_location: string
          p_mesa: string
          p_origen: string
          p_user: string
        }
        Returns: undefined
      }
      emitir_credencial_dispositivo: {
        Args: { p_device: string; p_dias?: number; p_refresh_hash: string }
        Returns: {
          credencial_id: string
          expira_at: string
          version: number
        }[]
      }
      emitir_factura_fiscal: {
        Args: { p_encolar?: boolean; p_factura: Json; p_lineas?: Json }
        Returns: {
          invoice_id: string
          resultado: string
        }[]
      }
      empresa_por_codigo: {
        Args: { p_codigo: string }
        Returns: {
          activo: boolean
          id: string
          nombre: string
        }[]
      }
      es_admin_plataforma: { Args: never; Returns: boolean }
      establecer_clave_tecnica: {
        Args: { p_actual: string; p_nueva: string }
        Returns: undefined
      }
      establecer_contexto_sesion: {
        Args: { p_location?: string; p_tenant: string }
        Returns: undefined
      }
      guardar_cuenta: {
        Args: {
          p_cuenta: Json
          p_lineas: Json
          p_order_id: string
          p_version?: string
        }
        Returns: string
      }
      jornada_abierta: { Args: { p_location: string }; Returns: string }
      listar_operarios: {
        Args: never
        Returns: {
          codigo: string
          id: string
          nombre: string
          rol: string
        }[]
      }
      mis_membresias: {
        Args: never
        Returns: {
          app_user_id: string
          rol: string
          tenant_id: string
          tenant_nombre: string
        }[]
      }
      normalizar_usr: { Args: { p: string }; Returns: string }
      operario_permite: { Args: { p_permiso: string }; Returns: boolean }
      outbox_resolver: {
        Args: { p_error?: string; p_estado: string; p_id: number }
        Returns: undefined
      }
      outbox_tomar: {
        Args: { p_lease_min?: number; p_max?: number }
        Returns: {
          created_at: string
          estado: string
          id: number
          intentos: number
          invoice_id: string
          lease_hasta: string | null
          tenant_id: string
          ultimo_error: string | null
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "fiscal_outbox"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      renovar_credencial_dispositivo: {
        Args: { p_dias?: number; p_nuevo_hash: string; p_refresh_hash: string }
        Returns: {
          device_id: string
          estacion: string
          modulo: string
          nombre: string
          tenant_id: string
        }[]
      }
      resolver_iva: {
        Args: { p_clase: string; p_territorio?: string }
        Returns: number
      }
      revocar_sesion: { Args: { p_session: string }; Returns: undefined }
      revocar_sesion_soporte: { Args: { p_sesion: string }; Returns: undefined }
      separar_cuenta: {
        Args: {
          p_campos: Json
          p_lineas: Json
          p_location: string
          p_mesa_order: string
          p_user: string
        }
        Returns: string
      }
      setting_get: {
        Args: { p_device_id?: string; p_key: string; p_location_id?: string }
        Returns: Json
      }
      setting_set: {
        Args: {
          p_device_id?: string
          p_key: string
          p_location_id?: string
          p_scope: string
          p_value: Json
        }
        Returns: {
          device_id: string | null
          id: string
          key: string
          location_id: string | null
          scope: string
          tenant_id: string
          updated_at: string
          value: Json | null
        }
        SetofOptions: {
          from: "*"
          to: "setting"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      soporte_vigente: { Args: { p_tenant: string }; Returns: boolean }
      traspasar_lineas: {
        Args: {
          p_destino_mesa: string
          p_location: string
          p_movimientos?: Json
          p_origen: string
          p_user: string
        }
        Returns: string
      }
      unaccent: { Args: { "": string }; Returns: string }
      validar_clave_tecnica: { Args: { p_clave: string }; Returns: boolean }
      validar_pin: {
        Args: { p_pin: string }
        Returns: {
          id: string
          nombre: string
          rol: string
        }[]
      }
      validar_pin_terminal: {
        Args: { p_device?: string; p_pin: string }
        Returns: {
          id: string
          nombre: string
          rol: string
        }[]
      }
      validar_pulsera: {
        Args: { p_codigo: string }
        Returns: {
          id: string
          nombre: string
          rol: string
        }[]
      }
      valorar_linea_pedido: {
        Args: { p_item: Json; p_tenant: string }
        Returns: Record<string, unknown>
      }
      verificar_clave_operario: {
        Args: { p_clave: string; p_tenant?: string; p_usuario: string }
        Returns: {
          auth_user_id: string
          codigo: string
          id: string
          nombre: string
          tenant_id: string
        }[]
      }
      z_de_jornada: { Args: { p_jornada: string }; Returns: Json }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
