import { Vehicle } from "./vehicle";

export enum OptimisationProfile {
    Eco = "Eco",
    Space = "Space",
    Time = "Time",
}


export type ScheduleProfile = {
    selected_vehicles: Vehicle[],
    optimisation_profile: OptimisationProfile,
    time_window: number, // time window in hours
    delivery_time: number, // est time to deliver each parcel in minutes
    driver_break: number, // break time in minutes
}