import { DeliverySchedule, DeliveryStatus } from "@/types/delivery-schedule";
import { Package } from "@/types/package";
import { Vehicle } from "@/types/vehicle";



export function SchedulePackages(vehiclesData: Vehicle[], packagesData: Package[], date: Date) {
    console.log("Scheduling packages...")
    // Initialize variables for tracking total volume and weight
    let totalVolume = 0;
    let totalWeight = 0;



    // Sort packages in order of priority: Redelivery -> date_added >= 3 days -> Express -> Standard -> Return -> date_aded(newest)
    //packages.sort((a, b) => {
    //    const priorityOrder = ["Redelivery", "Express", "Standard", "Return"];
    //    const aPriority = priorityOrder.indexOf(a.priority);
    //    const bPriority = priorityOrder.indexOf(b.priority);

    //   if (aPriority !== bPriority) {
    //        return aPriority - bPriority;
    //    }

    // Check if date_added is greater than or equal to 3 days
    /*
    const aDaysOld = differenceInDays(new Date(), a.date_added);
    const bDaysOld = differenceInDays(new Date(), b.date_added);
    

    if (aDaysOld >= 3 && bDaysOld < 3) {
        return -1;
    }
    if (bDaysOld >= 3 && aDaysOld < 3) {
        return 1;
    }
    */

    // Sort by date_added if priorities and days old are the same
    //   console.log("Packages Sorted")
    //    return b.date_added.getTime() - a.date_added.getTime();
    //});


    // Initialize an empty array to hold delivery schedules for each vehicle
    let deliverySchedules: DeliverySchedule[] = [];

    console.log("iterating vehicles")
    // Iterate over each vehicle to create a delivery schedule
    for (const vehicle of vehiclesData) {
        let schedule: DeliverySchedule = {
            schedule_id: undefined,
            vehicle_id: vehicle.vehicle_id,
            vehicle: vehicle,
            store_id: undefined,
            package_order: [],  // Initialize as empty; will populate later
            delivery_date: date,  // Placeholder for now, replace with date of schedule
            start_time: date,  // Placeholder, replace with start date/time of first delivery
            status: DeliveryStatus.Pending,
            num_packages: 0,
            estimated_duration_mins: 0,
            actual_duration_mins: 0,
            distance_miles: 0,
            load_weight: 0,
            load_volume: 0,
            created_at: new Date()
        };

        // Add the schedule to the deliverySchedules array
        deliverySchedules.push(schedule);
    }
    // Initialize a variable to keep track of the current vehicle index for round-robin assignment
    let currentScheduleIndex = 0;

    // Sort vehicles by their current load_weight in ascending order
    deliverySchedules.sort((a, b) => a.load_weight - b.load_weight);

    for (const packageItem of packagesData) {
        const currentSchedule = deliverySchedules[currentScheduleIndex];


        // Remove undefined packages
        if (!packageItem) {
            console.log(`Package is undefined. Skipping.`);
            continue;
        }

        // Remove packages that wont fit from scheduling
        if (!findSuitableVehicle(packageItem, deliverySchedules)) {
            console.log("vehicle cannot be found for " + packageItem.package_id)
            continue;
        }

        totalVolume += parseInt(packageItem.volume);
        totalWeight += parseInt(packageItem.weight);

        if (currentSchedule) {
            const newLoadWeight = currentSchedule.load_weight + parseInt(packageItem.weight);
            const newLoadVolume = currentSchedule.load_volume + parseInt(packageItem.volume);

            if (newLoadWeight <= currentSchedule.vehicle.max_load && newLoadVolume <= currentSchedule.vehicle.max_load) {
                if (checkEstimatedTime(packageItem, currentSchedule, 8)) {
                    // Add package to schedule, remove from queue and update info
                    console.log("Adding package " + packageItem.package_id + " to schedule " + currentScheduleIndex)
                    currentSchedule.package_order.push(packageItem);
                    currentSchedule.num_packages += 1;
                    currentSchedule.load_weight = newLoadWeight;
                    currentSchedule.load_volume = newLoadVolume;
                    currentSchedule.estimated_duration_mins = calculateTotalTime(currentSchedule);
                } else {
                    // Try next schedule
                    console.log(packageItem.package_id + "xx")
                    findScheduleForPackage(packageItem, deliverySchedules);
                }
            } else {
                // Try next schedule
                findScheduleForPackage(packageItem, deliverySchedules);
            }
        }

        currentScheduleIndex = (currentScheduleIndex + 1) % vehiclesData.length;
    }





    // Return the delivery schedules
    return deliverySchedules;
}



function checkEstimatedTime(packageToAdd: Package, schedule: DeliverySchedule | undefined, maxHours: number): boolean {
    if (!schedule) {
        return false;
    }

    const newSchedule: DeliverySchedule = {
        ...schedule,
        package_order: [...(schedule.package_order || []), packageToAdd],
    };

    const totalJourneyTime = calculateTotalTime(newSchedule);

    return (totalJourneyTime / 60) <= maxHours;
}





/*
// Function to calculate the time required for a package (Placeholder)
function calculateTimeForPackage(packageToAdd: Package): number {
    // Calculate the time required for a package
    return 0;
}
*/

// Function to calculate the total time to deliver all packages in a route (DeliverySchedule)
function calculateTotalTime(schedule: DeliverySchedule): number {
    // Calculate the total time required for a route

    let time = 0;
    // for all packages in delivery schedule, calculate time from depot to package, ..., to depot and return total time
    for (let i = 0; i < schedule.num_packages; i++) {
        const packageItem = schedule.package_order[i];
        if (packageItem) {
            if (schedule.num_packages == 1) {
                // If and only if one package
                // Calculate time from depot to packageItem[i] and back to depot

                // calculateTravelTime(depot, packageItem[i])
                time += 1;

                // calculateTravelTime(packageItem[i], depot)
                time += 1;

                console.log(1)
            } else if (i === 0) {
                // If first package
                // Calculate time from depot to packageItem[i]

                // calculateTravelTime(depot, packageItem[i])
                time += 1;
                
                console.log(2)
            } else if (i === schedule.num_packages - 1) {
                // If last package
                // Calculate travel time from previous package to current package, and from current package (last package) back to depot

                // calculateTravelTime(packageItem[i-1], packageItem[i]])
                time += 1;

                // calculateTravelTime(packageItem[i], depot)
                time += 1;

                console.log(3)
            } else {
                // If package, but not first or last package
                // Calculate travel time of packageItem[i-1] to packageItem[i]
                
                // calculateTravelTime(packageItem[i], packageItem[i-1])
                time += 1;

                console.log(4)
            }
        }
    }

    return time;
}

function findSuitableVehicle(packageItem: Package, deliverySchedules: DeliverySchedule[]): boolean {
    for (const schedule of deliverySchedules) {
        if (schedule) {
            const newLoadWeight = schedule.load_weight + parseInt(packageItem.weight);
            const newLoadVolume = schedule.load_volume + parseInt(packageItem.volume);

            if (newLoadWeight <= schedule.vehicle.max_load && newLoadVolume <= schedule.vehicle.max_volume) {
                if (checkEstimatedTime(packageItem, schedule, 8)) {
                    return true;
                }
            }
        }
    }
    return false;
}

function findScheduleForPackage(packageItem: Package, deliverySchedules: DeliverySchedule[]): boolean {
    for (const schedule of deliverySchedules) {
        const newLoadWeight = schedule.load_weight + parseInt(packageItem.weight);
        const newLoadVolume = schedule.load_volume + parseInt(packageItem.volume);

        if (newLoadWeight <= schedule.vehicle.max_load && newLoadVolume <= schedule.vehicle.max_volume) {
            if (checkEstimatedTime(packageItem, schedule, 8)) {
                schedule.package_order.push(packageItem);
                schedule.num_packages += 1;
                schedule.load_weight = newLoadWeight;
                schedule.load_volume = newLoadVolume;
                schedule.estimated_duration_mins = calculateTotalTime(schedule);
                return true;
            } else {
                return false;
            }
        }

    }
    return false;
}


/*
// Fetch available vehicles for Date that are not unavailable for maintenance
let vehicles: Vehicle[] = vehiclesData;

// Fetch packages that have status pending
let packages: Package[] = packagesData;

const returnedSchedules: DeliverySchedule[] = SchedulePackages(vehicles, packages);

for (let i = 0; i < returnedSchedules.length; i++) {
    console.log("[]------[]")
    console.log("package order length:" + returnedSchedules[i].package_order.length)
    console.log("num packages: " + returnedSchedules[i].num_packages)
    console.log("package order:")
    for (let j = 0; j < returnedSchedules[i].package_order.length; j++) {
        console.log(returnedSchedules[i].package_order[j].package_id)
    }
}

*/

// types
