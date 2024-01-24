import { Package } from "@/types/package";
import { Vehicle } from "@/types/vehicle";
import { Graph, Node, Edge, createGraph, calculateDistance } from '../model/graph';
import { VehicleRoute, VRPSolution } from '../model/vrp';
import { calculateTraversalMins } from "../../scheduling/create-schedules";
import { ScheduleProfile } from "@/types/schedule-profile";

/***
 * Round Robin Allocation 2
 * 
 * Sort packages into FIFO, then allocate to vehicles in a round robin fashion
 * Group packages that are going to the same address and find vehicle, if no vehicle then split group into smaller groups
 * 
 * Constraints: time window, vehicle capacity (weight and volume)
 * 
 * @param graph Graph of packages and depot
 * @param vehicles Array of available vehicles
 * @param timeWindow Number of hours to deliver packages
 * @returns VRPSolution, results in the minimum required number of vehicles to service all packages
 */
export async function roundRobinAllocation(graph: Graph, vehicles: Vehicle[], profile: ScheduleProfile): Promise<VRPSolution> {
    
    const solution = new VRPSolution();
    const availableVehicles = [...vehicles];

    const timeWindow = profile.time_window;
    const driverBreak = profile.driver_break;
    const deliveryTime = profile.delivery_time;

    // Sort packages by date added (FIFO) and filter out depot node
    const sortedPackages = graph.nodes
        .filter(node => !node.isDepot)
        .sort((a, b) =>
            (new Date(a.pkg?.date_added || 0).getTime()) - (new Date(b.pkg?.date_added || 0).getTime())
        );

    // Group packages by recipient address
    const addressToPackagesMap: Record<string, Node[]> = {};
    for (const pkgNode of sortedPackages) {
        const address = pkgNode.pkg?.recipient_address || '';
        if (!addressToPackagesMap[address]) {
            addressToPackagesMap[address] = [];
        }
        addressToPackagesMap[address].push(pkgNode);
    }

    const groupedPackages: Node[][] = Object.values(addressToPackagesMap);

    let vehicleIndex = 0;

    // Round robin allocation
    // For each group of packages, find a vehicle that can fit the group
    // If no vehicle, split group into two and try again
    // If no vehicle can fit package, package is not allocated
    for (const pkgGroup of groupedPackages) {
        let vehiclesChecked = 0;
        while (vehiclesChecked < availableVehicles.length) {
            const route = solution.routes[vehicleIndex] || new VehicleRoute(availableVehicles[vehicleIndex], graph.depot as Node);
            const travelCost = calculateDistance(route.nodes[route.nodes.length - 1], pkgGroup[0]);
            const timeRequired = calculateTraversalMins(travelCost) + deliveryTime;

            if (route.canAddGroup(pkgGroup, timeRequired, timeWindow, driverBreak)) {
                for (const pkgNode of pkgGroup) {
                    const travelCost = calculateDistance(route.nodes[route.nodes.length - 1], pkgNode);
                    const timeRequired = calculateTraversalMins(travelCost) + deliveryTime;
                    route.addNode(pkgNode, travelCost, timeRequired);
                }
                if (!solution.routes[vehicleIndex]) {
                    solution.addRoute(route);
                }
                break;
            } else {
                vehicleIndex = (vehicleIndex + 1) % availableVehicles.length;
                vehiclesChecked++;
            }
        }
        // If all vehicles checked and no fit
        if (vehiclesChecked === availableVehicles.length) {
    
            if (pkgGroup.length > 1) {
                // Split group into two and try again
                const halfIndex = Math.ceil(pkgGroup.length / 2);
                const firstHalf = pkgGroup.slice(0, halfIndex);
                const secondHalf = pkgGroup.slice(halfIndex);
                groupedPackages.push(firstHalf);
                groupedPackages.push(secondHalf);
            } else {
                // Package not allocated
            }
        }
    }

    // Close routes back to depot
    for (const route of solution.routes) {
        route.closeRoute(graph.depot as Node);
    }

    return solution;
}

