import { supabase } from "@/lib/supabase/client";
import { Package, CurrentState, PackageStatus } from "@/types/db/Package";
import { UUID } from "crypto";
import { db } from "./db";
import { DeliveryStatus } from "@/types/db/DeliverySchedule";
import { cookies } from "next/headers";

// Fetch all packages for a user
const fetchPackages = async () => {

    // Fetch store for user
    const { data: store, error } = await db.stores.fetch.forUser();

    if (!store) {
        return;
    } if (error) {
        return;
    } else {

        let { data: packages, error } = await supabase
            .from('packages')
            .select('*')
            .order('created_at', { ascending: false })
            .eq('store_id', store.store_id);
        if (error) {
            return;
        } else {
            return (packages as Package[]);
        }
    }
}

// Fetch all packages for a user where current state is "Pending" (i.e. not scheduled for delivery)
const fetchPackagesByPending = async () => {
    // Fetch store for user
    const { data: store, error } = await db.stores.fetch.forUser();

    if (!store) {
        return;
    } if (error) {
        return;
    } else {
        let { data: packages, error } = await supabase
            .from('packages')
            .select('*')
            .eq('current_state', CurrentState.Pending)
            .order('created_at', { ascending: false })
            .eq('store_id', store.store_id);
        if (error) {
            return;
        } else {
            return (packages as Package[]);
        }
    }
}

// Fetch packages by Ids
const fetchPackagesByIds = async (ids: UUID[]) => {
    if (!ids) {
        return ([] as Package[]);
    }

    let { data: packages, error } = await supabase
        .from('packages')
        .select('*')
        .in('package_id', ids)
    if (error) {
        return;
    } else {
        return (packages as Package[]);
    }
}

// Fetch packages for store ID which are not delivered
const fetchPackagesInventory = async () => {
    // Get store ID
    const { data: store, error } = await db.stores.fetch.forUser();

    if (!store) {
        return;
    } if (error) {
        return;
    } else {
        const { data: packages, error } = await supabase
            .from('packages')
            .select('*')
            .eq('store_id', store.store_id)
            .eq('current_state', CurrentState.Pending || CurrentState.InTransit || CurrentState.Scheduled);
        if (error) {
            return;
        } else {
            // Sort from date_added in descending order
            packages?.sort((a, b) => {
                if (a.created_at < b.created_at) {
                    return 1;
                } else if (a.created_at > b.created_at) {
                    return -1;
                } else {
                    return 0;
                }
            });
            return (packages as Package[]);
        }
    }
}

// Fetch packages for store ID, select where PackageStatus = "Pending" | "In Transit"
const fetchPackageDeliveryHistory = async () => {
    // Get store ID
    const { data: store, error } = await db.stores.fetch.forUser();

    if (!store) {
        return;
    } if (error) {
        return;
    } else {
        const { data: packages, error } = await supabase
            .from('packages')
            .select('*')
            .eq('store_id', store.store_id)
            .eq('current_state', CurrentState.Delivered);
        if (error) {
            return;
        } else {
            return (packages as Package[]);
        }
    }
}


// Remove package by ID
// TODO: Ensure data consistency by removing package from all delivery schedules
const removePackageById = async (id: UUID) => {

    // Fetch store for user
    const { data: store, error } = await db.stores.fetch.forUser();

    if (!store) {
        return;
    } if (error) {
        return;
    } else {
        const { error } = await supabase
            .from('packages')
            .delete()
            .eq('package_id', id)
            .eq('store_id', store.store_id);
        if (error) {
            return
        } else {
            return
        }
    }
}

// Update package statuses by IDs
const updatePackageStatusByIds = async (ids: UUID[], scheduleStatus: DeliveryStatus) => {
    if (!ids) {
        return;
    }

    // Manage package state, careful not to update status as it may overwrite a return delivery status
    let packageState = CurrentState.Pending;

    if (scheduleStatus === DeliveryStatus.Scheduled) {
        packageState = CurrentState.Scheduled;
    } else if (scheduleStatus === DeliveryStatus.InProgress) {
        packageState = CurrentState.InTransit;
    } else if (scheduleStatus === DeliveryStatus.Completed) {
        // Remove personal information from packages and set status to delivered
        const { error } = await supabase
            .from('packages')
            .update({
                status: PackageStatus.Delivered,
                current_state: CurrentState.Delivered,
                recipient_name: null,
                recipient_phone: null,
                sender_name: null,
                sender_phone: null,
            })
            .in('package_id', ids)
        if (error) {
            return
        }
    }

    const { error } = await supabase
        .from('packages')
        .update({ status: scheduleStatus, current_state: packageState })
        .in('package_id', ids)
    if (error) {
        return
    } else {
        return
    }

}


export const packages = {
    fetch: {
        all: fetchPackages,
        pending: fetchPackagesByPending,
        byIds: fetchPackagesByIds,
        inventory: fetchPackagesInventory,
        history: fetchPackageDeliveryHistory,
    },
    update: {
        status: {
            byIds: updatePackageStatusByIds,
        },
    },
    remove: {
        byId: removePackageById,
    }
};