import { UUID } from "crypto"

export type Package = {
    package_id: UUID
    store_id: UUID
    recipient_name: string
    recipient_address: string
    recipient_phone: string
    sender_name: string
    sender_address: string
    sender_phone: string
    status: "Pending" | "In Transit" | "Delivered"
    weight: string
    volume: string
    fragile?: boolean
    priority: "Redelivery" | "Express" | "Standard"
    delivery_notes: string
    date_added: Date
    date_modified: Date
    date_delivered: Date
    date_dispatched: Date
}
  