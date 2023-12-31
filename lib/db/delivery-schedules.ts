import { supabase } from "@/pages/api/supabase-client";
import { Package } from "@/types/package";
import { DeliverySchedule, DeliveryStatus } from "@/types/delivery-schedule";
import { UUID } from "crypto";
import { db } from "./db";
import { Vehicle } from "@/types/vehicle";

// Fetch all schedules for a date
export const fetchSchedulesByDate = async (date: Date) => {
    const formattedDate = date.toISOString().slice(0, 10);

    // Fetch store for user
    const store = await db.stores.fetch.store.forUser();

    if (!store) {
        console.error("User not atatched to store");
        return;
    }

    let { data: schedules, error } = await supabase
        .from('delivery_schedules')
        .select('*')
        .eq('delivery_date', formattedDate)
        .eq('store_id', store.store_id);
    if (error) {
        console.error("Error fetching schedules: ", error);
        return;
    } else {
        // For all schedules, convert the array of packageId UUIDs to array of Package objects using fetchPackagesByIds
        if (schedules) {
            for (let i = 0; i < schedules.length; i++) {
                const packageIdOrder = schedules[i].package_order;
                const packages = await db.packages.fetch.byIds(schedules[i].package_order);

                // ensure packages are sorted in the same order as they are saved in the database
                if (packages) {
                    schedules[i].package_order = packageIdOrder.map((id: UUID) => packages.find(pkg => pkg.package_id === id) as Package);
                }

                schedules[i].vehicle = await db.vehicles.fetch.byId(schedules[i].vehicle_id);
            }
        }

        const deliverySchedule: DeliverySchedule[] = schedules as DeliverySchedule[];

        return deliverySchedule;
    }
}

// Fetch schedule by ID
export const fetchScheduleById = async (scheduleId: UUID): Promise<DeliverySchedule | null> => {

    try {
        const { data, error } = await supabase
            .from('delivery_schedules')
            .select('*')
            .eq('schedule_id', scheduleId)
            .single();

        if (error) {
            throw new Error(`Error fetching schedule: ${error.message || 'Unknown error'}`);
        }

        if (!data) {
            return null;
        }

        // Set schedule as data
        const schedule = data as DeliverySchedule;

        // Save the order of the packages as retrieved from the database
        const packageIdOrder: UUID[] = data.package_order;

        const packages = await db.packages.fetch.byIds(packageIdOrder);

        // If packages returned, sort the array of packages in the same order as they are saved in the database
        if (packages) {
            schedule.package_order = packageIdOrder.map(id => packages.find(pkg => pkg.package_id === id) as Package);
        } else {
            throw new Error("Error fetching packages for schedule");
        }

        const vehicle = await db.vehicles.fetch.byId(schedule.vehicle_id);

        if (vehicle) {
            schedule.vehicle = vehicle;
        } else {
            throw new Error("Error fetching vehicle for schedule");
        }

        return schedule;

    } catch (error) {
        console.error(`Error fetching schedule by ID:` + (error as Error).message || `Unknown error`);
        return null;
    }
};

// Update schedule status by ID
const updateScheduleStatus = async (scheduleId: UUID, status: DeliveryStatus) => {
    let { error } = await supabase
        .from('delivery_schedules')
        .update({ status: status })
        .eq('schedule_id', scheduleId)
    if (error) {
        console.error("Error updating package status: ", error);
        return ("Error updating package status");
    } else {
        // Update status of all packages in schedule
        const schedule = await fetchScheduleById(scheduleId);
        if (schedule) {
            const packageIds = schedule.package_order.map(pkg => pkg.package_id);
            await db.packages.update.status.byIds(packageIds, status as DeliveryStatus);
        }
        return true;
    }
}



export const schedules = {
    fetch: {
        byId: fetchScheduleById,
        byDate: fetchSchedulesByDate,
    },
    remove: {
    },
    update: {
        status: updateScheduleStatus,
    }
};