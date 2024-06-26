import { Notification } from "@/types/Notification";
import { db } from "../db/db";
import { PostgrestError } from "@supabase/supabase-js";
import { format, isToday, parseISO, compareAsc } from 'date-fns';
import { DeliverySchedule, DeliveryStatus } from "@/types/db/DeliverySchedule";
import { supabase } from "../supabase/client";

export const getNotifications = async (): Promise<{ data: Notification[], error: PostgrestError | null }> => {
    // Notifications: 
    // 1) If there is meant to be a delivery today (store info) 
    //      yellow if before schedule time, red if after
    //     (if after, show how many minutes late)
    // 2) If a vehicle is due for maintenance (vehicle info)
    // 3) Reminders for schedule tomorrow
    // 4) Red:
    //     - If a user has no store
    //     - If a store has no depot
    //     - If a store has no vehicles
    // 5) Yellow:
    //    - If a store has no packages
    // 6) Green:
    //    - Schedule completed, see report?

    const notifications: Notification[] = [];
    let storeDepot;

    // Get store and depot information
    const { data: store, error: error } = await db.stores.fetch.forUser();
    if (error || !store) {
        notifications.push(noStore);
    } else {
        const { data: depot, error: error } = await db.depots.fetch.forStore(store);
        if (error || !depot) {
            notifications.push(noDepot);
        } else if (depot) {
            storeDepot = depot[0];
        }
    }

    if (store && storeDepot) {
        // Assuming the fetch.byDate function returns schedules for today
        const schedulesToday = await db.schedules.fetch.byDate(new Date());
        //console.log(schedulesToday);

        const deadlineTime = parseISO(`${format(new Date(), 'yyyy-MM-dd')}T${storeDepot.dispatch_time}:00`);
        const currentTime = new Date();

        // Mapping of date-fns weekday format to days_active array format
        type DayOfWeek = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';

        const dayMap: Record<DayOfWeek, string> = {
            'Monday': 'MO',
            'Tuesday': 'TU',
            'Wednesday': 'WE',
            'Thursday': 'TH',
            'Friday': 'FR',
            'Saturday': 'SA',
            'Sunday': 'SU',
        };

        // Use type assertion to tell TypeScript that currentDayOfWeek will always be a DayOfWeek
        const currentDayOfWeek = format(new Date(), 'EEEE') as DayOfWeek;

        // Convert current day to your days_active format ("MO", "TU", "WE", ...)
        const currentDayAbbreviation = dayMap[currentDayOfWeek];

        // Now, isActiveToday check should work without type errors
        const isActiveToday = storeDepot.days_active.includes(currentDayAbbreviation);

        // Check if there's meant to be a delivery today and if it's before or after the dispatch time
        if (isActiveToday && schedulesToday && schedulesToday.length === 0) {
            // There are schedules today
            if (compareAsc(currentTime, deadlineTime) === 1) {
                // After schedule time
                const lateMinutesTotal = Math.floor((currentTime.getTime() - deadlineTime.getTime()) / 60000);
                const hours = Math.floor(lateMinutesTotal / 60);
                const minutes = lateMinutesTotal % 60;

                let timeString = "";
                if (hours > 0) {
                    // If more than an hour, format as HH:MM
                    timeString = `${hours}h ${minutes < 10 ? '0' : ''}${minutes}m`;
                } else {
                    // Otherwise, just show minutes
                    timeString = `${lateMinutesTotal} minutes`;
                }

                notifications.push({
                    severity: 3, // Red
                    title: "Late Schedule",
                    description: `Today's schedule is ${timeString} late.`,
                    onClickLink: `/dashboard/schedule?date=${format(new Date(), 'ddMMyyyy')}`
                });
            } else {
                // Before schedule time, still within dispatch window
                notifications.push({
                    severity: 2, // Yellow
                    title: "Upcoming Schedule Today",
                    description: "Click to schedule today's deliveries.",
                    onClickLink: `/dashboard/schedule?date=${format(new Date(), 'ddMMyyyy')}`
                });
            }
        } else if (schedulesToday && schedulesToday.length > 0) {
            // There are schedules today - determine what the stages are at the moment
            // Two states - in progress, complete
            const scheduledCount = schedulesToday.reduce((count, schedule) => schedule.status === DeliveryStatus.Scheduled ? count + 1 : count, 0);
            const completedCount = schedulesToday.reduce((count, schedule) => schedule.status === DeliveryStatus.Completed ? count + 1 : count, 0);
            const inProgressCount = schedulesToday.reduce((count, schedule) => schedule.status === DeliveryStatus.InProgress ? count + 1 : count, 0);

            if (scheduledCount > 0) {
                // There are schedules in progress
                notifications.push({
                    severity: 2, // Yellow
                    title: "Today's Schedule Pending",
                    description: `${scheduledCount} schedule${scheduledCount > 1 ? 's' : ''} currently awaiting confirmation.`,
                    onClickLink: `/dashboard/schedule?date=${format(new Date(), 'ddMMyyyy')}`
                });
            }

            if (inProgressCount > 0) {
                // There are completed schedules
                notifications.push({
                    severity: 1, // Green
                    title: "Today's Schedule In Progress",
                    description: `${inProgressCount} schedule${inProgressCount > 1 ? 's' : ''} awaiting completion.`,
                    onClickLink: `/dashboard/schedule?date=${format(new Date(), 'ddMMyyyy')}`
                });
            }

        }
    }

    if (store && storeDepot) {
        // Fetch schedules for tomorrow
        const schedulesTomorrow = await db.schedules.fetch.byDate(new Date(new Date().getTime() + 24 * 60 * 60 * 1000));

        // Mapping of date-fns weekday format to days_active array format
        type DayOfWeek = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';

        const dayMap: Record<DayOfWeek, string> = {
            'Monday': 'MO',
            'Tuesday': 'TU',
            'Wednesday': 'WE',
            'Thursday': 'TH',
            'Friday': 'FR',
            'Saturday': 'SA',
            'Sunday': 'SU',
        };

        // Use type assertion to tell TypeScript that tomorrowDayOfWeek will always be a DayOfWeek
        const tomorrowDayOfWeek = format(new Date(new Date().getTime() + 24 * 60 * 60 * 1000), 'EEEE') as DayOfWeek;
        const isActiveTomorrow = storeDepot.days_active.includes(dayMap[tomorrowDayOfWeek]);

        // Check if there's meant to be a delivery today and if it's before or after the dispatch time
        if (isActiveTomorrow && schedulesTomorrow && schedulesTomorrow.length === 0) {
            const time = storeDepot.dispatch_time;

            // Before schedule time, still within dispatch window
            notifications.push({
                severity: 2, // Yellow
                title: "Upcoming Schedule Tomorrow",
                description: `Schedule due by ${time}.`,
                onClickLink: `/dashboard/schedule?date=${format(new Date(), 'ddMMyyyy')}`
            });
        }
    }

    // Find vehicles for store id
    const vehicles = await db.vehicles.fetch.all();

    if (vehicles === null || vehicles.length === 0) {
        if (store) {
            notifications.push({
                severity: 3, // Red
                title: "No Vehicles",
                description: "Click here to add a vehicle.",
                onClickLink: "/dashboard/vehicles"
            });
        }
    }

    if (!storeDepot) {
        notifications.push({
            severity: 3, // Red
            title: "No Depot",
            description: "Click here to create a depot for your store.",
            onClickLink: "/dashboard/store"
        });
    }

    // Get schedules which are pending confirmation or completion from supabase and add red alert 
    // These schedules should be for any date before today
    const schedules = await supabase
        .from('delivery_schedules')
        .select('*')
        .eq('store_id', store?.store_id)
        .in('status', [DeliveryStatus.Scheduled, DeliveryStatus.InProgress])
        .lt('delivery_date', format(new Date(), 'yyyy-MM-dd'))

    if (!schedules.error && schedules.data) {
        const deliverySchedules: DeliverySchedule[] = schedules.data as unknown as DeliverySchedule[];

        // Group schedules into delivery dates
        const groupedSchedules: DeliverySchedule[][] = [];

        // Iterate delivery schedules and group them by delivery date
        for (const schedule of deliverySchedules) {
            const date = schedule.delivery_date;
            const index = groupedSchedules.findIndex(group => group[0].delivery_date === date);
            if (index > -1) {
                groupedSchedules[index].push(schedule);
            } else {
                groupedSchedules.push([schedule]);
            }
        }


        for (const scheduleGroup of groupedSchedules) {
            const scheduledCount = scheduleGroup.filter(schedule => schedule.status === DeliveryStatus.Scheduled).length;
            const inProgressCount = scheduleGroup.filter(schedule => schedule.status === DeliveryStatus.InProgress).length;
            const date = format(parseISO(scheduleGroup[0].delivery_date.toString()), 'dd/MM/yy');
            const urlDate = format(parseISO(scheduleGroup[0].delivery_date.toString()), 'ddMMyyyy');

            if (scheduledCount > 0) {
                notifications.push({
                    severity: 3, // Red
                    title: "Overdue Confirmation",
                    description: `${scheduledCount} ${scheduledCount === 1 ? 'schedule' : 'schedules'} for ${date} ${scheduledCount === 1 ? 'is' : 'are'} awaiting confirmation.`,
                    onClickLink: `/dashboard/schedule?date=${urlDate}`
                });
            }
            if (inProgressCount > 0) {
                notifications.push({
                    severity: 3, // Red
                    title: "Overdue Completion",
                    description: `${inProgressCount} ${inProgressCount === 1 ? 'schedule' : 'schedules'} for ${date} ${inProgressCount === 1 ? 'is' : 'are'} awaiting completion.`,
                    onClickLink: `/dashboard/schedule?date=${urlDate}`
                });
            }
        }
    }


    if (notifications) {
        // Sort notifications from highest severity to lowest
        notifications.sort((a, b) => b.severity - a.severity);
        return { data: notifications, error: null };
    } else {
        return { data: [], error: { message: "No notifications found", details: "", hint: "", code: "" } };
    }


}

// Severity 3 = red
const noStore: Notification = {
    severity: 3,
    title: "No Store",
    description: "Click here to join or create one",
    onClickLink: "/dashboard/store"
}

const noDepot: Notification = {
    severity: 3,
    title: "No Depot",
    description: "Click here to create a depot for your store",
    onClickLink: "/dashboard/store"
}