import { PriorityQueue } from "@/lib/scheduling/priority-queue";
import { calculateDistance } from "../../models/graph";
import { Node } from "../../models/graph";

// Type declarations
export type Coordinate = [number, number];

export type ClusterWithNodes = {
    index: number;
    nodes: Node[];
};

export function kMeans(queue: PriorityQueue, k: number, maxIterations = 100): PriorityQueue[] {
    // Create a backup of the original queue data
    const originalNodes = queue.getData().slice();

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

        // Reinitialize the queue with the original nodes and restart clustering
        queue = new PriorityQueue();
        originalNodes.forEach(node => queue.enqueue(node));
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

export function calculateCentroidFromNodes(nodes: Node[]): Coordinate {
    const sum = nodes.reduce((acc, node) => {
        if (!node.pkg) return acc;
        acc[0] += node.pkg!.recipient_address_lat;
        acc[1] += node.pkg!.recipient_address_lng;
        return acc;
    }, [0, 0]);
    return [sum[0] / nodes.length, sum[1] / nodes.length];
}

export function calculateCentroidNodeDistance(centroid: Coordinate, node: Node): number {
    return Math.hypot(centroid[0] - node.pkg!.recipient_address_lat, centroid[1] - node.pkg!.recipient_address_lng);
}

export function findShortestPathForNodes(cluster: Node[], depot: Node): Node[] {
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


export function findNearestNeighbour(currentNode: Node, nodes: Node[]): Node | undefined {
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
