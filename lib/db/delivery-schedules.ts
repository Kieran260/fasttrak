import { supabase } from "@/lib/supabase/client";
import { Package } from "@/types/package";
import { DeliverySchedule, DeliveryStatus } from "@/types/delivery-schedule";
import { UUID } from "crypto";
import { db } from "./db";
import { Vehicle } from "@/types/vehicle";
import { PostgrestError } from "@supabase/supabase-js";

// Helper function to fetch store and handle errors
const fetchStoreAndHandleError = async () => {
    const { data: store, error } = await db.stores.fetch.forUser();
    if (error || !store) {
        console.error("Error fetching store or store not found: ", error);
        throw new Error("Store fetching failed");
    }
    return store;
};

// Fetch all schedules for a date
export const fetchSchedulesByDate = async (date: Date): Promise<DeliverySchedule[] | null> => {
    try {
        const store = await fetchStoreAndHandleError();
        const formattedDate = date.toISOString().slice(0, 10);

        const { data: schedules, error } = await supabase
            .from('delivery_schedules')
            .select('*')
            .eq('delivery_date', formattedDate)
            .eq('store_id', store.store_id);

        if (error) throw new Error(`Error fetching schedules: ${error.message}`);
        if (!schedules) return null;

        for (const schedule of schedules) {
            schedule.package_order = await fetchPackagesForSchedule(schedule.package_order);
            schedule.vehicle = await db.vehicles.fetch.byId(schedule.vehicle_id);
        }

        return schedules;
    } catch (error) {
        console.error("Error in fetchSchedulesByDate:", error);
        return null;
    }
};

// Helper function to fetch packages for a schedule
const fetchPackagesForSchedule = async (packageIds: UUID[]): Promise<Package[]> => {
    const packages = await db.packages.fetch.byIds(packageIds);
    if (!packages) throw new Error("Error fetching packages for schedule");

    // Sort packages in the same order as they are saved in the database
    return packageIds.map(id => packages.find(pkg => pkg.package_id === id) as Package);
};

// Fetch schedule by ID
export const fetchScheduleById = async (scheduleId: UUID): Promise<DeliverySchedule | null> => {
    try {
        const { data: schedule, error } = await supabase
            .from('delivery_schedules')
            .select('*')
            .eq('schedule_id', scheduleId)
            .single();

        if (error) throw new Error(`Error fetching schedule: ${error.message}`);
        if (!schedule) return null;

        schedule.package_order = await fetchPackagesForSchedule(schedule.package_order);
        schedule.vehicle = await db.vehicles.fetch.byId(schedule.vehicle_id);

        return schedule;
    } catch (error) {
        console.error("Error in fetchScheduleById:", error);
        return null;
    }
};

// Update schedule status by ID
const updateScheduleStatus = async (
    scheduleId: UUID,
    status: DeliveryStatus
): Promise<{ data: DeliverySchedule | null, error: PostgrestError | null }> => {
    try {
        const { error } = await supabase
            .from('delivery_schedules')
            .update({ status: status })
            .eq('schedule_id', scheduleId);

        if (error) throw new Error(`Error updating schedule status: ${error.message}`);

        // Fetch the updated schedule
        const updatedSchedule = await fetchScheduleById(scheduleId);
        if (!updatedSchedule) throw new Error('Failed to fetch the updated schedule');

        // Assuming package_order is an array of package details within the schedule
        // and db.packages.update.status.byIds updates the status of given package IDs
        const packageIds = updatedSchedule.package_order.map(pkg => pkg.package_id);
        await db.packages.update.status.byIds(packageIds, status);

        return { data: updatedSchedule, error: null };
    } catch (error) {
        console.error("Error in updateScheduleStatus:", error);
        return {
            data: null,
            error: {
                message: `Error updating schedule status: ${(error as Error).message}`,
                details: '',
                hint: '',
                code: '' // You may want to adjust the error code based on the actual error
            },
        };
    }
};

export const schedules = {
    fetch: {
        byId: fetchScheduleById,
        byDate: fetchSchedulesByDate,
    },
    update: {
        status: updateScheduleStatus,
    }
};
