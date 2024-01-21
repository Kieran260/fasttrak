import { Vehicle } from "./vehicle";

export type ScheduleProfile = {
    selected_vehicles: Vehicle[],
    optimisation_profile: "Eco" | "Space" | "Time",
    time_window: number, // time window in hours
    delivery_time: number, // est time to deliver each parcel in minutes
    driver_break: number, // break time in minutes
}