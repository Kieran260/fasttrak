import { RouteNode } from "@/lib/routing/model/RouteNode";
import { VRPSolution } from "@/lib/routing/model/VRPSolution";
import { VehicleRoute } from "@/lib/routing/model/VehicleRoute";
import { calculateTravelTime } from "@/lib/utils/calculate-travel-time";
import { calculateDistance } from "@/lib/utils/calculate-distance";
import { Client, DirectionsRequest, LatLng, TravelMode, TravelRestriction, UnitSystem } from "@googlemaps/google-maps-services-js";

const client = new Client({});

interface VRP {
    solution: VRPSolution;
    distanceMultiplier: number;
    avgSpeed: number;
}

/**
 * Calculate the estimated distance multiplier and average speed for the solution.
 * 
 * This is only used for calculating the estimated metrics for optimisation, and not for calculating
 * the actual distance and time for the routes.
 * 
 * @param solution - VRPSolution object containing all of the routes
 * @returns Promise of VRP object containing the updated VRPSolution, distance multiplier, and average speed
 */
export async function initialiseMetrics(solution: VRPSolution): Promise<VRP> {
    // Enable test mode to bypass calling Google Maps API
    const test: Boolean = false;

    if (test == true) {
        const distanceMultiplier = 1.5;
        const avgSpeed = 20;
        solution.loadMetrics(avgSpeed, distanceMultiplier);
        return { solution, distanceMultiplier, avgSpeed };
    }


    const responses = [];
    let totalActualDistanceMiles = 0;
    let totalActualTimeHours = 0;
    let totalEucDistanceMiles = 0;
    let totalEucDuration = 0;

    for (const route of solution.routes) {
        // Filter out route nodes which have duplicate addresses
        const uniqueNodes: RouteNode[] = route.nodes.filter((node, index, self) => {
            const firstIndex = self.findIndex(n => n.pkg?.recipient_address === node.pkg?.recipient_address);
            return firstIndex === index;
        },);

        // Determine the indices of the nodes to be selected
        const selectedIndices = createEvenlySpreadIndices(uniqueNodes.length);
        const nodes: RouteNode[] = selectedIndices.map(index => uniqueNodes[index]);

        // Get total euclidean distance for the selected nodes
        for (let i = 0; i < nodes.length - 1; i++) {
            const node = nodes[i];
            const nextNode = nodes[i + 1];
            const distance = calculateDistance(node, nextNode);
            totalEucDistanceMiles += distance;
            totalEucDuration += calculateTravelTime(distance);
        }

        const origin = new google.maps.LatLng(route.nodes[0].coordinates.lat, route.nodes[0].coordinates.lng); // Starting at node 0 (depot)
        const destinations = nodes.map(pkg => new google.maps.LatLng(pkg.coordinates.lat, pkg.coordinates.lng));


    }

    const avgSpeed = totalActualDistanceMiles / totalActualTimeHours; // miles per hour
    const distanceMultiplier = totalActualDistanceMiles / totalEucDistanceMiles; // ratio of actual distance to euclidean distance

    // Update the solution with the calculated metrics
    solution.loadMetrics(avgSpeed, distanceMultiplier);

    return { solution, distanceMultiplier, avgSpeed };
}

/**
 * Calculate the actual distance and time values for each route using the Google Maps Directions API.
 * 
 * This is used to update the routes with the actual distance and time travelled by the vehicle. The API
 * returns the actual distance and time between each node in the route, the route object is updated with these values.
 * 
 * The API requests are done in chunks of 25 as the API has a limit of 25 waypoints per request.
 * 
 * @param route - VehicleRoute object containing the route nodes and package information
 */
export async function calculateActualTravel(route: VehicleRoute): Promise<void> {
    const test: Boolean = false;
    if (test == true) {
        return;
    }

    // Store the accumulated actual distance and time for the route
    let totalActualDuration = 0;
    let totalActualDistance = 0;
    let responseRouteLegs = 0;

    // Separate the depot and customer locations, then create an array of all nodes
    const depot = new google.maps.LatLng(route.depotNode.coordinates.lat, route.depotNode.coordinates.lng);
    const customerLocations = route.nodes.map(node => new google.maps.LatLng(node.coordinates.lat, node.coordinates.lng))
        .filter((location) => location.lat() !== depot.lat() && location.lng() !== depot.lng());
    const allNodes = [depot, ...customerLocations, depot];

    // Divide the nodes into chunks of 25 waypoints
    let chunks: google.maps.LatLng[][] = [];

    for (let i = 0; i < allNodes.length; i += 25) {
        let chunk = allNodes.slice(i, i + 25);
        chunks.push(chunk);
    }

    // Ensure each chunk is of minimum size 3 and maximum size 25
    if (chunks.length > 1 && chunks[chunks.length - 1].length < 3) {
        const lastChunk = chunks[-1];
        const secondLastChunk = chunks[-2];

        // Move nodes from the second last chunk to the last chunk until it has at least 3 nodes
        if (lastChunk !== undefined && secondLastChunk !== undefined) {
            while (lastChunk.length < 3) {
                lastChunk.unshift(secondLastChunk.pop()!);
            }
        } else {
            alert("Error: Unable to adjust chunks");
            return;
        }
    }

    // Iterate through the chunks of 25 waypoints
    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];

        const directionsRequest: DirectionsRequest = {
            params: {
                origin: `${chunk[0].lat()},${chunk[0].lng()}`,
                destination: `${chunk[chunk.length - 1].lat()},${chunk[chunk.length - 1].lng()}`, // Return to depot
                waypoints: chunk.slice(1, -1).map(waypoint => `${waypoint.lat},${waypoint.lng}`),
                mode: TravelMode.driving,
                units: UnitSystem.imperial,
                avoid: [TravelRestriction.tolls],
                key: process.env.GOOGLE_MAPS_API_KEY!,
            }
        };

        client.directions(directionsRequest)
            .then((response) => {
                if (response) {
                    // Calculate total actual distance and time for each leg of the route
                    response.data.routes[0].legs.forEach((element) => {
                        const distanceMeters = element.distance?.value;
                        const durationSeconds = element.duration?.value;
                        if (distanceMeters && durationSeconds) {
                            // Convert units
                            totalActualDuration += durationSeconds / 3600; // convert to hours
                            totalActualDistance += distanceMeters / 1609;  // convert to miles
                        }
                    });
                }
            });
    }

    // Modify the route object with the actual distance and time
    route.actualDistanceMiles = totalActualDistance;
    route.actualTimeMins = totalActualDuration * 60;
    route.actualTimeCalculated = true;
}

function createEvenlySpreadIndices(length: number, maxIndices: number = 25): number[] {
    const indices: number[] = [0]; // Start with index 0
    const lastIndex = length - 1; // Adjust for zero-based indexing

    // Ensure the array includes the last index by adjusting the length
    if (length <= maxIndices) {
        // If the length is less than or equal to maxIndices, return a range from 0 to length
        for (let i = 1; i <= lastIndex; i++) {
            indices.push(i);
        }
    } else {
        // Calculate step to evenly distribute indices, ensuring to include the last index
        const step = lastIndex / (maxIndices - 1);

        for (let i = 1; i < maxIndices - 1; i++) {
            // Use Math.round to ensure indices are integers
            const index = Math.round(i * step);
            if (!indices.includes(index)) {
                indices.push(index);
            }
        }

        // Ensure the last index is included
        if (!indices.includes(lastIndex)) {
            indices.push(lastIndex);
        }
    }

    return indices;
}