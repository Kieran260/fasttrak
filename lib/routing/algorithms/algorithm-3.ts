import { Package } from "@/types/package";
import { Vehicle } from "@/types/vehicle";
import { Graph, Node, Edge, createGraph, calculateDistance } from '../model/graph';
import { VehicleRoute, VRPSolution } from '../model/vrp';
import { calculateTraversalMins } from "../../scheduling/create-schedules";
import { PriorityQueue } from "../../scheduling/priority-queue";
import { ScheduleProfile } from "@/types/schedule-profile";

/***
 * Geospatial Density Clustering
 * 
 * Sort packages into priority queue, then allocate to n clusters based on geospatial density
 *  1. Initialise priority queue to maintain order of packages
 *  2. Create clusters based on geospatial density equal to number of vehicles
 *  3. Allocate packages to N clusters using KMeans, returning the clusters as priority queues
 *  4. For each cluster, allocate packages from the respective priority queue to the vehicle, once first constraint 
 *     is met dequeue the package back to main queue. Continue to iterate priority queue and try to allocate the rest of the packages
 *  5. close the routes back to the depot 
 *  6. Return the solution, with the lefotver packages remaining unallocated
 * 
 * Constraints: time window, vehicle capacity (weight and volume)
 * 
 * @param graph Graph of packages and depot
 * @param vehicles Array of available vehicles
 * @param timeWindow Number of hours to deliver packages
 * @returns VRPSolution, results in the minimum required number of vehicles to service all packages
 */
export async function geospatialClustering(graph: Graph, vehicles: Vehicle[], profile: ScheduleProfile): Promise<VRPSolution> {
    const solution = new VRPSolution();
    const availableVehicles = [...vehicles];

    const timeWindow = profile.time_window;
    const deliveryTime = profile.delivery_time;
    const driverBreak = profile.driver_break;

    // Step 1: Sort packages into priority queue
    const mainQueue = new PriorityQueue;
    graph.nodes.forEach(node => {
        if (node.pkg) {
            mainQueue.enqueue(node);
        }
    });

    const backupQueue = new PriorityQueue;

    // Step 2: Create clusters equal to number of vehicles
    const numberOfClusters = availableVehicles.length;

    // Step 3: Perform K-Means clustering to n clusters
    const clusterPriorityQueues = kMeans(mainQueue, numberOfClusters);
    console.log("queues")
    // print length of each queue
    for (const queue of clusterPriorityQueues) {
        console.log(queue.getData().length);
    }
    console.log("Leftover after clustering: " + mainQueue.getData().length);

    // Step 4: Allocate priority queue clusters to vehicles
    // For each cluster, allocate packages from the respective priority queue to the vehicle until the first constraint is met
    for (const [index, vehicle] of Array.from(availableVehicles.entries())) {
        // Get the cluster queue for the current vehicle
        const clusterQueue = clusterPriorityQueues[index];

        // Create a new route for the vehicle cluster
        const route = new VehicleRoute(vehicle, graph.depot as Node);

        // Iterate through the current cluster queue and try to allocate the packages
        while (!clusterQueue.isEmpty()) {
            const node = clusterQueue.peek(); // Peek at the next package in the queue
            let nextNode = clusterQueue.peek(1);
            if (!node) break;

            if (nextNode == undefined) {
                // set next node to depot
                const depotNode = graph.depot as Node;
                nextNode = depotNode;
            }

            if (nextNode) {
                // Calculate the travel cost and time required to travel from the last node in the route to the next node
                const travelCost = calculateDistance(node, nextNode);
                const travelTime = calculateTraversalMins(travelCost) + deliveryTime;

                // Check if the package can be added to the vehicle route
                if ((route as any).canAddPackage(node.pkg, node, travelTime, timeWindow, driverBreak)) {
                    // Remove the package from the cluster queue and add it to the vehicle route
                    clusterQueue.dequeue();
                    (route as any).addNode(node, travelCost, travelTime);
                } else {
                    // If the package cannot be added to the vehicle, requeue the package to main queue
                    // Continue to next package in cluster queue
                    clusterQueue.dequeue();
                    mainQueue.enqueue(node);
                }
            }

            const shortestPath = findShortestPathForNodes(route.nodes, graph.depot as Node);
            route.nodes = shortestPath;
            route.updateTotalTime(deliveryTime);
        }

        // Find the shortest path through the route and addroute to solution
        const shortestPath = findShortestPathForNodes(route.nodes, graph.depot as Node);

        // Overwrite the route nodes with the shortest path
        route.nodes = shortestPath;
        //route.updateTotalTime(profile);

        solution.addRoute(route);
    }

    // Try to allocate leftover packages to vehicles
    while (!mainQueue.isEmpty()) {
        const node = mainQueue.peek(); // Peek at the next package in the queue

        if (!node) {
            break;
        };

        // Iterate solution routes, find centroid for each route and sort the route based on closest to node first
        const routeCentroids = solution.routes.map(route => {
            const centroid = calculateCentroidFromNodes(route.nodes);
            return { route, centroid };
        });

        // Sort routeCentroids by distance to node
        routeCentroids.sort((a, b) => {
            const distanceA = calculateCentroidNodeDistance(a.centroid, node);
            const distanceB = calculateCentroidNodeDistance(b.centroid, node);
            return distanceA - distanceB;
        });

        // Iterate route centroids trying to add a package to each route, if not possible, continue to next route
        for (const { route } of routeCentroids) {
            // Calculate the travel cost and time required to travel from the last node in the route to the next node
            const travelCost = calculateDistance(route.nodes[route.nodes.length - 1], node);
            const travelTime = calculateTraversalMins(travelCost) + deliveryTime; // Calculate time required to traverse nodes, plus time to deliver package

            // If travel cost is more than triple the average time to travel for this route, skip this route
            const averageTimeToTravel = route.totalTime / route.nodes.length;
            if (travelCost < averageTimeToTravel * 3) break;

            // Check if the package can be added to the vehicle route
            if ((route as any).canAddPackage(node.pkg, node, travelTime, timeWindow, driverBreak)) {
                // Remove the package from the cluster queue and add it to the vehicle route
                (route as any).addNode(node, travelCost, travelTime);
                mainQueue.dequeue();
                break;
            }

            const shortestPath = findShortestPathForNodes(route.nodes, graph.depot as Node);
            route.nodes = shortestPath;
            route.updateTotalTime(deliveryTime);
        }

        // If the package cannot be added to any route, dequeue the package indefinitely
        backupQueue.enqueue(node);
        mainQueue.dequeue();
    }

    // Step 4: Allocate leftover packages to vehicles
    // Try to add backup queue to each route, if cant fit in any of the routes, then dequeue indefinitely
    while (!backupQueue.isEmpty()) {
        const node = backupQueue.peek(); // Peek at the next package in the queue
        if (!node) break;;

        for (const route of solution.routes) {
            // Calculate the travel cost and time required to travel from the last node in the route to the next node
            const travelCost = calculateDistance(route.nodes[route.nodes.length - 1], node);
            const travelTime = calculateTraversalMins(travelCost) + deliveryTime; // Calculate time required to traverse nodes, plus time to deliver package

            // Check if the package can be added to the vehicle route
            if ((route as any).canAddPackage(node.pkg, node, travelTime, timeWindow, driverBreak)) {
                // Remove the package from the cluster queue and add it to the vehicle route
                (route as any).addNode(node, travelCost, travelTime);
                backupQueue.dequeue();

                const shortestPath = findShortestPathForNodes(route.nodes, graph.depot as Node);
                route.nodes = shortestPath;
                route.updateTotalTime(deliveryTime);
                break;
            }
        }

        // If the package cannot be added to any route, dequeue the package indefinitely
        mainQueue.enqueue(node);
        backupQueue.dequeue();
    }

    // Find shortest path for each route again
    for (const route of solution.routes) {
        const shortestPath = findShortestPathForNodes(route.nodes, graph.depot as Node);
        route.nodes = shortestPath;
        route.updateTotalTime(deliveryTime);
    }

    // Step 5: Close routes back to depot
    for (const route of solution.routes) {
        route.closeRoute(graph.depot as Node);
    }

    console.log("remaining packages" + backupQueue.getData().length);

    return solution;

}

// Type declarations
type Coordinate = [number, number];

type ClusterWithNodes = {
    index: number;
    nodes: Node[];
};

function kMeans(queue: PriorityQueue, k: number, maxIterations = 100): PriorityQueue[] {
    // Dequeue all packages into nodes array
    const nodes: Node[] = [];
    while (!queue.isEmpty()) {
        const node = queue.dequeue();
        if (node) {
            nodes.push(node);
        }
    }

    // Shuffle nodes for random initial centroid selection
    for (let i = nodes.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [nodes[i], nodes[j]] = [nodes[j], nodes[i]];
    }

    // Initial centroids are selected from the first k nodes
    let centroids = nodes.slice(0, k).map(node => [node.pkg!.recipient_address_lat, node.pkg!.recipient_address_lng]);
    let clusters: ClusterWithNodes[] = Array.from({ length: k }, (_, index) => ({ index, nodes: [] }));
    let iterations = 0;

    while (iterations < maxIterations) {
        // Reset clusters for each iteration
        clusters.forEach(cluster => cluster.nodes = []);

        // Assign nodes to the nearest centroid
        nodes.forEach(node => {
            let minDistance = Number.MAX_VALUE;
            let closestCentroidIndex = 0;

            centroids.forEach((centroid, index) => {
                const distance = Math.hypot(centroid[0] - node.pkg!.recipient_address_lat, centroid[1] - node.pkg!.recipient_address_lng);
                if (distance < minDistance) {
                    minDistance = distance;
                    closestCentroidIndex = index;
                }
            });

            clusters[closestCentroidIndex].nodes.push(node);
        });

        // Calculate new centroids from the clusters
        let newCentroids = clusters.map(cluster => {
            if (cluster.nodes.length === 0) return [0, 0]; // Handle empty clusters
            return calculateCentroidFromNodes(cluster.nodes);
        });

        // Check for convergence
        let hasConverged = newCentroids.every((centroid, i) => centroids[i] && centroid[0] === centroids[i][0] && centroid[1] === centroids[i][1]);
        if (hasConverged) break;

        centroids = newCentroids;
        iterations++;
    }

    // Check if any of the clusters are empty
    const emptyClusterExists = clusters.some(cluster => cluster.nodes.length === 0);
    if (emptyClusterExists) {
        console.log("Empty cluster found, restarting...");
        return kMeans(queue, k, maxIterations);
    }

    // Convert clusters to priority queues
    const priorityQueueClusters = clusters.map(cluster => {
        const clusterQueue = new PriorityQueue();
        cluster.nodes.forEach(node => clusterQueue.enqueue(node));
        return clusterQueue;
    });

    return priorityQueueClusters;
}

function calculateCentroidFromNodes(nodes: Node[]): Coordinate {
    const sum = nodes.reduce((acc, node) => {
        if (!node.pkg) return acc;
        acc[0] += node.pkg!.recipient_address_lat;
        acc[1] += node.pkg!.recipient_address_lng;
        return acc;
    }, [0, 0]);
    return [sum[0] / nodes.length, sum[1] / nodes.length];
}

function calculateCentroidNodeDistance(centroid: Coordinate, node: Node): number {
    return Math.hypot(centroid[0] - node.pkg!.recipient_address_lat, centroid[1] - node.pkg!.recipient_address_lng);
}

function findShortestPathForNodes(cluster: Node[], depot: Node): Node[] {
    const path: Node[] = [];
    let remainingNodes = [...cluster];
    let currentNode = depot;

    while (remainingNodes.length > 0) {
        const nearestNode = findNearestNeighbour(currentNode, remainingNodes);
        if (nearestNode) {
            path.push(nearestNode);
            remainingNodes = remainingNodes.filter(node => node !== nearestNode);
            currentNode = nearestNode;
        } else {
            break; // No more nearest nodes found
        }
    }

    return path;
}


function findNearestNeighbour(currentNode: Node, nodes: Node[]): Node | undefined {
    let nearestNode: Node | undefined;
    let shortestDistance = Number.MAX_VALUE;

    for (const node of nodes) {
        const distance = calculateDistance(currentNode, node);
        if (distance < shortestDistance) {
            shortestDistance = distance;
            nearestNode = node;
        }
    }

    return nearestNode;
}
