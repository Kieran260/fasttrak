import { Package } from "@/types/package";
import { Vehicle } from "@/types/vehicle";
import { Graph, Node, Edge, createGraph, calculateDistance } from '../model/graph';
import { VehicleRoute, VRPSolution } from '../model/vrp';
import { calculateTraversalMins } from "../../scheduling/create-schedules";
import { displayGraph } from "../../utils/cytoscape-data";
import { ScheduleProfile } from "@/types/schedule-profile";

/***
 * Round Robin Allocation 1
 * 
 * Sort packages into FIFO, then allocate to vehicles in a round robin fashion
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

    // Round robin allocation
    let vehicleIndex = 0;

    for (const pkgNode of sortedPackages) {
        let vehiclesChecked = 0;
        while (vehiclesChecked < availableVehicles.length) {
            const route = solution.routes[vehicleIndex] || new VehicleRoute(availableVehicles[vehicleIndex], graph.depot as Node);
            const travelCost = calculateDistance(route.nodes[route.nodes.length - 1], pkgNode);
            const timeRequired = calculateTraversalMins(travelCost, deliveryTime);
            if (route.canAddPackage(pkgNode.pkg as Package, pkgNode, timeRequired, timeWindow, driverBreak)) {
                route.addNode(pkgNode, travelCost, timeRequired);
                if (!solution.routes[vehicleIndex]) {
                    solution.addRoute(route);
                }
                break;
            } else {
                vehicleIndex = (vehicleIndex + 1) % availableVehicles.length;
                vehiclesChecked++;
            }
        }
        if (vehiclesChecked === availableVehicles.length) {
            console.error('No available vehicle for package:', pkgNode.pkg);
        }
    }

    // Close routes back to depot
    for (const route of solution.routes) {
        route.closeRoute(graph.depot as Node);
    }

    return solution;
}

