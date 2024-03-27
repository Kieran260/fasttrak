import { UUID } from "crypto";
import { Package } from "./package";
import { Vehicle } from "./vehicle";

export enum DeliveryStatus {
    Scheduled = "Scheduled",
    InProgress = "In Progress",
    Completed = "Completed",
    Cancelled = "Cancelled"
}

export type DeliverySchedule = {
    schedule_id?: UUID;
    vehicle_id: UUID;
    vehicle: Vehicle; // Convert UUID to store Vehicle object
    depot_lat: number;
    depot_lng: number;
    store_id: UUID;
    package_order: Package[];  // Convert array of UUIDs to array of Package objects
    delivery_date: Date;
    route_number: number;
    start_time: Date;
    status: DeliveryStatus;
    num_packages: number;
    estimated_duration_mins: number;
    actual_duration_mins: number;
    euclidean_distance_miles: number;
    actual_distance_miles: number;
    load_weight: number;
    load_volume: number;
    created_at: Date;
    // Report data
    auto_minimise: boolean;
    optimisation_profile: string;
    time_window_hours: number;
    est_delivery_time: number;
};
