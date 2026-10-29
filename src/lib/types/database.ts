
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "audit_log": {
                  Row: {
                    "action": string,"actor_id": string | null,"at": string,"id": number,"new_data": Json | null,"old_data": Json | null,"record_id": string | null,"table_name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"at"?: string,"id"?: never,"new_data"?: Json | null,"old_data"?: Json | null,"record_id"?: string | null,"table_name": string
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"at"?: string,"id"?: never,"new_data"?: Json | null,"old_data"?: Json | null,"record_id"?: string | null,"table_name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"cash_movements": {
                  Row: {
                    "amount": number,"category": string | null,"created_at": string,"created_by": string,"description": string,"id": string,"shift_id": string,"type": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"category"?: string | null,"created_at"?: string,"created_by"?: string,"description": string,"id"?: string,"shift_id": string,"type": string
                  }
                  Update: {
                    "amount"?: number,"category"?: string | null,"created_at"?: string,"created_by"?: string,"description"?: string,"id"?: string,"shift_id"?: string,"type"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "cash_movements_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cash_movements_shift_id_fkey"
      columns: ["shift_id"]
isOneToOne: false
      referencedRelation: "shifts"
      referencedColumns: ["id"]
    }
                  ]
                },"client_prices": {
                  Row: {
                    "client_id": string,"price": number,"product_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "client_id": string,"price": number,"product_id": string,"updated_at"?: string
                  }
                  Update: {
                    "client_id"?: string,"price"?: number,"product_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "client_prices_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "client_prices_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "v_client_balances"
      referencedColumns: ["client_id"]
    },{
      foreignKeyName: "client_prices_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    }
                  ]
                },"clients": {
                  Row: {
                    "address": string | null,"billing_cycle": string,"client_type": string,"container_balance": number,"created_at": string,"credit_limit": number | null,"id": string,"is_active": boolean,"name": string,"notes": string | null,"payment_terms_days": number,"phone": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "address"?: string | null,"billing_cycle"?: string,"client_type"?: string,"container_balance"?: number,"created_at"?: string,"credit_limit"?: number | null,"id"?: string,"is_active"?: boolean,"name": string,"notes"?: string | null,"payment_terms_days"?: number,"phone"?: string | null
                  }
                  Update: {
                    "address"?: string | null,"billing_cycle"?: string,"client_type"?: string,"container_balance"?: number,"created_at"?: string,"credit_limit"?: number | null,"id"?: string,"is_active"?: boolean,"name"?: string,"notes"?: string | null,"payment_terms_days"?: number,"phone"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"container_logs": {
                  Row: {
                    "client_id": string,"created_by": string | null,"gallons_delivered": number,"gallons_pulled_out": number,"id": string,"logged_at": string,"net_change": number | null,"notes": string | null,"order_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "client_id": string,"created_by"?: string | null,"gallons_delivered"?: number,"gallons_pulled_out"?: number,"id"?: string,"logged_at"?: string,"net_change"?: never,"notes"?: string | null,"order_id"?: string | null
                  }
                  Update: {
                    "client_id"?: string,"created_by"?: string | null,"gallons_delivered"?: number,"gallons_pulled_out"?: number,"id"?: string,"logged_at"?: string,"net_change"?: never,"notes"?: string | null,"order_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "container_logs_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "container_logs_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "v_client_balances"
      referencedColumns: ["client_id"]
    },{
      foreignKeyName: "container_logs_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "container_logs_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    }
                  ]
                },"monthly_soas": {
                  Row: {
                    "client_id": string,"due_date": string,"generated_at": string,"generated_by": string | null,"id": string,"notes": string | null,"period_end": string,"period_start": string,"soa_no": number,"total_amount_due": number,"total_deliveries": number
                  }
                  ComputedFields: never
                  Insert: {
                    "client_id": string,"due_date": string,"generated_at"?: string,"generated_by"?: string | null,"id"?: string,"notes"?: string | null,"period_end": string,"period_start": string,"soa_no"?: never,"total_amount_due": number,"total_deliveries": number
                  }
                  Update: {
                    "client_id"?: string,"due_date"?: string,"generated_at"?: string,"generated_by"?: string | null,"id"?: string,"notes"?: string | null,"period_end"?: string,"period_start"?: string,"soa_no"?: never,"total_amount_due"?: number,"total_deliveries"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "monthly_soas_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "monthly_soas_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "v_client_balances"
      referencedColumns: ["client_id"]
    },{
      foreignKeyName: "monthly_soas_generated_by_fkey"
      columns: ["generated_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"order_items": {
                  Row: {
                    "id": string,"order_id": string,"product_id": string,"quantity": number,"subtotal": number | null,"unit_price": number
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"order_id": string,"product_id": string,"quantity": number,"subtotal"?: never,"unit_price": number
                  }
                  Update: {
                    "id"?: string,"order_id"?: string,"product_id"?: string,"quantity"?: number,"subtotal"?: never,"unit_price"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "order_items_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "order_items_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    }
                  ]
                },"orders": {
                  Row: {
                    "amount_paid": number,"client_id": string | null,"completed_at": string | null,"created_at": string,"created_by": string,"delivery_address": string | null,"dispatched_at": string | null,"id": string,"notes": string | null,"order_no": number,"order_type": string,"payment_status": string,"rider_id": string | null,"shift_id": string,"soa_id": string | null,"status": string,"total_amount": number,"voided_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_paid"?: number,"client_id"?: string | null,"completed_at"?: string | null,"created_at"?: string,"created_by"?: string,"delivery_address"?: string | null,"dispatched_at"?: string | null,"id"?: string,"notes"?: string | null,"order_no"?: never,"order_type": string,"payment_status"?: string,"rider_id"?: string | null,"shift_id": string,"soa_id"?: string | null,"status": string,"total_amount": number,"voided_at"?: string | null
                  }
                  Update: {
                    "amount_paid"?: number,"client_id"?: string | null,"completed_at"?: string | null,"created_at"?: string,"created_by"?: string,"delivery_address"?: string | null,"dispatched_at"?: string | null,"id"?: string,"notes"?: string | null,"order_no"?: never,"order_type"?: string,"payment_status"?: string,"rider_id"?: string | null,"shift_id"?: string,"soa_id"?: string | null,"status"?: string,"total_amount"?: number,"voided_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "orders_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "orders_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "v_client_balances"
      referencedColumns: ["client_id"]
    },{
      foreignKeyName: "orders_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "orders_rider_id_fkey"
      columns: ["rider_id"]
isOneToOne: false
      referencedRelation: "riders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "orders_shift_id_fkey"
      columns: ["shift_id"]
isOneToOne: false
      referencedRelation: "shifts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "orders_soa_id_fkey"
      columns: ["soa_id"]
isOneToOne: false
      referencedRelation: "monthly_soas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "orders_soa_id_fkey"
      columns: ["soa_id"]
isOneToOne: false
      referencedRelation: "v_soas"
      referencedColumns: ["id"]
    }
                  ]
                },"payments": {
                  Row: {
                    "amount": number,"created_at": string,"created_by": string,"id": string,"method": string,"order_id": string,"reference": string | null,"shift_id": string | null,"soa_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"created_at"?: string,"created_by"?: string,"id"?: string,"method": string,"order_id": string,"reference"?: string | null,"shift_id"?: string | null,"soa_id"?: string | null
                  }
                  Update: {
                    "amount"?: number,"created_at"?: string,"created_by"?: string,"id"?: string,"method"?: string,"order_id"?: string,"reference"?: string | null,"shift_id"?: string | null,"soa_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "payments_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_shift_id_fkey"
      columns: ["shift_id"]
isOneToOne: false
      referencedRelation: "shifts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_soa_id_fkey"
      columns: ["soa_id"]
isOneToOne: false
      referencedRelation: "monthly_soas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_soa_id_fkey"
      columns: ["soa_id"]
isOneToOne: false
      referencedRelation: "v_soas"
      referencedColumns: ["id"]
    }
                  ]
                },"products": {
                  Row: {
                    "category": string,"created_at": string,"id": string,"is_active": boolean,"name": string,"sort_order": number,"stock_quantity": number,"track_stock": boolean,"unit_price": number
                  }
                  ComputedFields: never
                  Insert: {
                    "category": string,"created_at"?: string,"id"?: string,"is_active"?: boolean,"name": string,"sort_order"?: number,"stock_quantity"?: number,"track_stock"?: boolean,"unit_price": number
                  }
                  Update: {
                    "category"?: string,"created_at"?: string,"id"?: string,"is_active"?: boolean,"name"?: string,"sort_order"?: number,"stock_quantity"?: number,"track_stock"?: boolean,"unit_price"?: number
                  }
                  Relationships: [
                    
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"full_name": string,"id": string,"is_active": boolean,"role": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"full_name": string,"id": string,"is_active"?: boolean,"role"?: string
                  }
                  Update: {
                    "created_at"?: string,"full_name"?: string,"id"?: string,"is_active"?: boolean,"role"?: string
                  }
                  Relationships: [
                    
                  ]
                },"riders": {
                  Row: {
                    "created_at": string,"id": string,"is_active": boolean,"name": string,"phone": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"is_active"?: boolean,"name": string,"phone"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"is_active"?: boolean,"name"?: string,"phone"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"shifts": {
                  Row: {
                    "closed_at": string | null,"closing_cash": number | null,"expected_cash": number | null,"id": string,"notes": string | null,"opened_at": string,"opening_cash": number,"secretary_id": string,"status": string,"variance": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "closed_at"?: string | null,"closing_cash"?: number | null,"expected_cash"?: number | null,"id"?: string,"notes"?: string | null,"opened_at"?: string,"opening_cash": number,"secretary_id": string,"status"?: string,"variance"?: number | null
                  }
                  Update: {
                    "closed_at"?: string | null,"closing_cash"?: number | null,"expected_cash"?: number | null,"id"?: string,"notes"?: string | null,"opened_at"?: string,"opening_cash"?: number,"secretary_id"?: string,"status"?: string,"variance"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "shifts_secretary_id_fkey"
      columns: ["secretary_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"void_requests": {
                  Row: {
                    "created_at": string,"id": string,"order_id": string,"reason": string,"requested_by": string,"review_notes": string | null,"reviewed_at": string | null,"reviewed_by": string | null,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"order_id": string,"reason": string,"requested_by"?: string,"review_notes"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"status"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"order_id"?: string,"reason"?: string,"requested_by"?: string,"review_notes"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "void_requests_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "void_requests_requested_by_fkey"
      columns: ["requested_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "void_requests_reviewed_by_fkey"
      columns: ["reviewed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "v_client_balances": {
                  Row: {
                    "address": string | null,"billing_cycle": string,"client_id": string,"client_type": string,"container_balance": number,"credit_limit": number | null,"is_active": boolean,"name": string,"oldest_unpaid_at": string | null,"outstanding": number | null,"phone": string | null,"unpaid_orders": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                },"v_soas": {
                  Row: {
                    "amount_paid": number | null,"balance": number | null,"client_id": string,"client_name": string,"due_date": string,"generated_at": string,"generated_by": string | null,"id": string,"notes": string | null,"period_end": string,"period_start": string,"soa_no": number,"status": string | null,"total_amount_due": number,"total_deliveries": number
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "monthly_soas_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "monthly_soas_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "v_client_balances"
      referencedColumns: ["client_id"]
    },{
      foreignKeyName: "monthly_soas_generated_by_fkey"
      columns: ["generated_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "_void_order":
{ Args: { "p_order_id": string }; Returns: undefined
                           },
"client_outstanding":
{ Args: { "p_client_id": string }; Returns: number
                           },
"client_volume_report":
{ Args: { "p_end": string,"p_start": string }; Returns: {
              "client_id": string,"client_type": string,"container_balance": number,"name": string,"orders": number,"outstanding": number,"refills": number,"sales": number
            }[]
                           },
"close_shift":
{ Args: { "p_closing_cash": number,"p_notes"?: string,"p_shift_id": string }; Returns: {
              "closed_at": string | null,
"closing_cash": number | null,
"expected_cash": number | null,
"id": string,
"notes": string | null,
"opened_at": string,
"opening_cash": number,
"secretary_id": string,
"status": string,
"variance": number | null
            }
                          SetofOptions: {
        from: "*"
        to: "shifts"
        isOneToOne: true
        isSetofReturn: false
      } },
"create_order":
{ Args: { "p_client_id"?: string,"p_delivery_address"?: string,"p_gallons_delivered"?: number,"p_gallons_pulled_out"?: number,"p_items": Json,"p_notes"?: string,"p_order_type": string,"p_payment_amount"?: number,"p_payment_method"?: string,"p_payment_reference"?: string,"p_rider_id"?: string }; Returns: Json
                           },
"dashboard_summary":
{ Args: { "p_date"?: string }; Returns: Json
                           },
"generate_soa":
{ Args: { "p_client_id": string,"p_due_date"?: string,"p_notes"?: string,"p_period_end": string,"p_period_start": string }; Returns: {
              "client_id": string,
"due_date": string,
"generated_at": string,
"generated_by": string | null,
"id": string,
"notes": string | null,
"period_end": string,
"period_start": string,
"soa_no": number,
"total_amount_due": number,
"total_deliveries": number
            }
                          SetofOptions: {
        from: "*"
        to: "monthly_soas"
        isOneToOne: true
        isSetofReturn: false
      } },
"is_owner":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_staff":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"log_cash_movement":
{ Args: { "p_amount": number,"p_category"?: string,"p_description": string,"p_type": string }; Returns: {
              "amount": number,
"category": string | null,
"created_at": string,
"created_by": string,
"description": string,
"id": string,
"shift_id": string,
"type": string
            }
                          SetofOptions: {
        from: "*"
        to: "cash_movements"
        isOneToOne: true
        isSetofReturn: false
      } },
"log_container_movement":
{ Args: { "p_client_id": string,"p_gallons_delivered": number,"p_gallons_pulled_out": number,"p_notes"?: string }; Returns: {
              "client_id": string,
"created_by": string | null,
"gallons_delivered": number,
"gallons_pulled_out": number,
"id": string,
"logged_at": string,
"net_change": number | null,
"notes": string | null,
"order_id": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "container_logs"
        isOneToOne: true
        isSetofReturn: false
      } },
"manila_day_start":
{ Args: { "d": string }; Returns: string
                           },
"manila_today":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"my_open_shift_id":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"my_role":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"open_shift":
{ Args: { "p_opening_cash": number }; Returns: {
              "closed_at": string | null,
"closing_cash": number | null,
"expected_cash": number | null,
"id": string,
"notes": string | null,
"opened_at": string,
"opening_cash": number,
"secretary_id": string,
"status": string,
"variance": number | null
            }
                          SetofOptions: {
        from: "*"
        to: "shifts"
        isOneToOne: true
        isSetofReturn: false
      } },
"price_for":
{ Args: { "p_client_id": string,"p_product_id": string }; Returns: number
                           },
"record_payment":
{ Args: { "p_amount": number,"p_method"?: string,"p_order_id": string,"p_reference"?: string }; Returns: {
              "amount": number,
"created_at": string,
"created_by": string,
"id": string,
"method": string,
"order_id": string,
"reference": string | null,
"shift_id": string | null,
"soa_id": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "payments"
        isOneToOne: true
        isSetofReturn: false
      } },
"record_soa_payment":
{ Args: { "p_amount": number,"p_method"?: string,"p_reference"?: string,"p_soa_id": string }; Returns: Json
                           },
"request_void":
{ Args: { "p_order_id": string,"p_reason": string }; Returns: {
              "created_at": string,
"id": string,
"order_id": string,
"reason": string,
"requested_by": string,
"review_notes": string | null,
"reviewed_at": string | null,
"reviewed_by": string | null,
"status": string
            }
                          SetofOptions: {
        from: "*"
        to: "void_requests"
        isOneToOne: true
        isSetofReturn: false
      } },
"require_owner":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"require_staff":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"review_void":
{ Args: { "p_approve": boolean,"p_notes"?: string,"p_request_id": string }; Returns: {
              "created_at": string,
"id": string,
"order_id": string,
"reason": string,
"requested_by": string,
"review_notes": string | null,
"reviewed_at": string | null,
"reviewed_by": string | null,
"status": string
            }
                          SetofOptions: {
        from: "*"
        to: "void_requests"
        isOneToOne: true
        isSetofReturn: false
      } },
"sales_report":
{ Args: { "p_end": string,"p_start": string }; Returns: {
              "collected": number,"day": string,"expenses": number,"orders": number,"refills": number,"sales": number
            }[]
                           },
"shift_summary":
{ Args: { "p_shift_id": string }; Returns: Json
                           },
"update_delivery_status":
{ Args: { "p_gallons_delivered"?: number,"p_gallons_pulled_out"?: number,"p_order_id": string,"p_rider_id"?: string,"p_status": string }; Returns: {
              "amount_paid": number,
"client_id": string | null,
"completed_at": string | null,
"created_at": string,
"created_by": string,
"delivery_address": string | null,
"dispatched_at": string | null,
"id": string,
"notes": string | null,
"order_no": number,
"order_type": string,
"payment_status": string,
"rider_id": string | null,
"shift_id": string,
"soa_id": string | null,
"status": string,
"total_amount": number,
"voided_at": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "orders"
        isOneToOne: true
        isSetofReturn: false
      } }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const
