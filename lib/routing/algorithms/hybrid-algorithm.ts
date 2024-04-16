import { Graph } from '../model/Graph';
import { VRPSolution } from "@/lib/routing/model/VRPSolution";
import { ScheduleProfile } from "@/types/db/ScheduleProfile";
import { GeneticAlgorithm } from "./genetic-algorithm/genetic-algorithm";
import { Vehicle } from "@/types/db/Vehicle";
import { roundRobinAllocation } from './rr-fifo/rr-fifo';
import { EfficiencyScores, calculateEfficiencyScores } from '@/lib/utils/calculate-efficiency';
import { calculateActualTravel as calculateActualTravelClient } from '../../google-maps/client/directions';
import { calculateActualTravel as calculateActualTravelServer } from '@/lib/google-maps/server/directions';
import { geospatialClustering as KMeansClustering } from './k-means/k-means';
import { ScheduleInitialiser, ScheduleOptimiser, ScheduleReport } from '@/types/db/ScheduleReport';
import { initKMeans } from './k-means/init-k-means';
import { initRandom } from './rr-fifo/init-rr-fifo';

export type VRPMetrics = {
    solution: VRPSolution;
    distanceMultiplier: number;
    avgSpeed: number;
}

/**
 * Multi step process to optimise the VRPSolution using a hybrid algorithm. A VRPSolution is generated by taking 
 * the nodes from the graph, the available vehicles and the schedule profile and processing it through the algorithm.
 * 
 * Two-non optimised solutions are processed: round-robin allocation, and K-Means clustering.
 * 
 * Two optimised solutions are processed with the Genetic Algorithm: one with random initialisation, and one with 
 * K-Means initialisation.
 * 
 * The solution with the highest total efficiency score is selected as the final solution.
 * 
 * @param graph - Graph of nodes: packages and depot
 * @param vehicles - Array of available vehicles
 * @param profile - Schedule profile of configuration settings
 * @returns 
 */
export async function hybridAlgorithm(graph: Graph, vehicles: Vehicle[], profile: ScheduleProfile, metrics: VRPMetrics, server: boolean):
    Promise<{ finalSolution: VRPSolution, scheduleReport: ScheduleReport }> {

    const originalVehicles = vehicles.slice(); // Clone the vehicles array

    // 1. If selected, estimate the maximum number of vehicles required to deliver all packages 
    if (profile.auto_selection == true) {
        let vehicleEstimator = await roundRobinAllocation(graph, vehicles, profile, metrics.distanceMultiplier, metrics.avgSpeed);
        vehicleEstimator.loadMetrics(metrics.avgSpeed, metrics.distanceMultiplier);

        // Estimate the amount of vehicles needed to deliver all pending packages
        const totalWeightCapacityNeeded = graph.nodes.reduce((acc, node) => acc + (node.pkg?.weight ?? 0), 0);
        const totalVolumeCapacityNeeded = graph.nodes.reduce((acc, node) => acc + (node.pkg?.volume ?? 0), 0);

        // Create a clone of the vehicles array
        const startingVehicles = vehicles.slice();
        let maximumVehiclesRequired: Vehicle[] = [];

        // Find maximum number of vehicles required to fit all packages based on weight and volume
        let weightAvailable = 0;
        let volumeAvailable = 0;

        for (const vehicle in startingVehicles) {
            // If the total weight and volume capacity needed exceeds the available capacity, add more vehicles
            if (weightAvailable < totalWeightCapacityNeeded && volumeAvailable < totalVolumeCapacityNeeded) {
                // Add the vehicle's capacity to the available capacity
                weightAvailable += startingVehicles[vehicle].max_load
                volumeAvailable += startingVehicles[vehicle].max_volume

                // Add the vehicle to the maximum vehicles required array
                maximumVehiclesRequired.push(startingVehicles[vehicle]);
                startingVehicles.splice(parseInt(vehicle), 1);
            }
        }

        const EFFICIENCY_INCREASE = 0.5 // Estimated routing efficiency increase between the random solution and the final solution

        let currentTimeWindowMins = (profile.time_window * maximumVehiclesRequired.length) * 60; // Current time window available
        const averageTimePerPackage = (vehicleEstimator.actualTime * EFFICIENCY_INCREASE) / vehicleEstimator.numberOfPackages;
        const estimatedTravelTimeMins = averageTimePerPackage * graph.nodes.length - 1; // Estimated (worst case) time to deliver all packages

        // From the remaining vehicles, add more vehicles if required based on the estimated time to deliver
        for (const vehicle in startingVehicles) {
            const travelTimeExceedsTimeWindow = estimatedTravelTimeMins > currentTimeWindowMins;

            if (travelTimeExceedsTimeWindow) {
                maximumVehiclesRequired.push(startingVehicles[vehicle]);
                startingVehicles.splice(parseInt(vehicle), 1);
                currentTimeWindowMins += (profile.time_window * 60); // Account for new vehicle's time window
            }
        }
        vehicles = maximumVehiclesRequired;
        profile.selected_vehicles = maximumVehiclesRequired;
    }

    // 2. Generate a Random solution without any optimisation
    const start1 = Date.now();
    let randomOnly = await roundRobinAllocation(graph, vehicles, profile, metrics.distanceMultiplier, metrics.avgSpeed);
    randomOnly.loadMetrics(metrics.avgSpeed, metrics.distanceMultiplier);
    const randomOnlyEfficiency: EfficiencyScores = calculateEfficiencyScores(randomOnly);
    const end1 = Date.now();
    console.log("Random solution computed in " + (end1 - start1) / 1000 + " seconds");

    // 3. Generate a K-Means solution without any optimisation
    const start2 = Date.now();
    let kMeansOnly = await KMeansClustering(graph, vehicles, profile, metrics.distanceMultiplier, metrics.avgSpeed);
    kMeansOnly[0].loadMetrics(metrics.avgSpeed, metrics.distanceMultiplier);
    const KMeansOnlyEfficiency: EfficiencyScores = calculateEfficiencyScores(kMeansOnly[0]);
    const end2 = Date.now();
    console.log("K-Means solution computed in " + (end2 - start2) / 1000 + " seconds");

    // 4. Run K-Means and Random initialisation to get an initial solution for the GA
    let KMeansInitial = await initKMeans(graph, vehicles, profile, metrics.distanceMultiplier, metrics.avgSpeed);
    KMeansInitial[0].loadMetrics(metrics.avgSpeed, metrics.distanceMultiplier);

    let randomInitial = await initRandom(graph, vehicles, profile, metrics.distanceMultiplier, metrics.avgSpeed);
    randomInitial[0].loadMetrics(metrics.avgSpeed, metrics.distanceMultiplier);

    // 5. Run the Genetic Algorithm to optimise the K-Means and Random initialisation solutions
    const NUM_GENERATIONS = 1000000;

    // K Means
    const start3 = Date.now();
    const gaKMeansInit = new GeneticAlgorithm(KMeansInitial[0], KMeansInitial[1], profile, NUM_GENERATIONS);
    const kMeansOptimised = gaKMeansInit.evolve();
    const kMeansOptimisedEfficiency: EfficiencyScores = calculateEfficiencyScores(kMeansOptimised);
    const end3 = Date.now();
    console.log("K-Means Optimised solution computed in " + (end3 - start3) / 1000 + " seconds");

    // Random Initialised
    const start4 = Date.now();
    const gaRandomInit = new GeneticAlgorithm(randomInitial[0], randomInitial[1], profile, NUM_GENERATIONS);
    const randomOptimised = gaRandomInit.evolve();
    const randomOptimisedEfficiency: EfficiencyScores = calculateEfficiencyScores(randomOptimised);
    const end4 = Date.now();
    console.log("Random Optimised solution computed in " + (end4 - start4) / 1000 + " seconds");

    // 6. Calculate the real times and distances for the optimised solutions
    for (const solution of [randomOnly, kMeansOnly[0], kMeansOptimised, randomOptimised]) {
        // Calculate the real travel time and distance for each route
        for (const route of solution.routes) {
            if (server) {
                await calculateActualTravelServer(route);
            }
            else {
                await calculateActualTravelClient(route);
            }
        }
    }

    // 7. Generate reports for each solution
    const randomOnlyReport: ScheduleReport = {
        initialiser: ScheduleInitialiser.Random,
        optimiser: ScheduleOptimiser.None,
        distance_multiplier: metrics.distanceMultiplier,
        average_speed: metrics.avgSpeed,
        vehicles_available: originalVehicles,
        vehicles_used: randomOnly.routes.map(route => route.vehicle),
        total_packages_count: graph.nodes.reduce((acc, node) => acc + (node.pkg ? 1 : 0), 0),
        scheduled_packages_count: randomOnly.numberOfPackages,
        total_distance_miles: randomOnly.actualDistance,
        total_duration_hours: randomOnly.actualTime / 60,
        // Schedule Profile
        auto_minimise: profile.auto_selection,
        optimisation_profile: profile.optimisation_profile,
        time_window_hours: profile.time_window,
        est_delivery_time: profile.delivery_time,
        TE: randomOnlyEfficiency.TE,
        DE: randomOnlyEfficiency.DE,
        WU: randomOnlyEfficiency.WU,
        VU: randomOnlyEfficiency.VU,
    }

    const kMeansOnlyReport: ScheduleReport = {
        initialiser: ScheduleInitialiser.KMeans,
        optimiser: ScheduleOptimiser.None,
        distance_multiplier: metrics.distanceMultiplier,
        average_speed: metrics.avgSpeed,
        vehicles_available: originalVehicles,
        vehicles_used: kMeansOnly[0].routes.map(route => route.vehicle),
        total_packages_count: graph.nodes.reduce((acc, node) => acc + (node.pkg ? 1 : 0), 0),
        scheduled_packages_count: kMeansOnly[0].numberOfPackages,
        total_distance_miles: kMeansOnly[0].actualDistance,
        total_duration_hours: kMeansOnly[0].actualTime / 60,
        // Schedule Profile
        auto_minimise: profile.auto_selection,
        optimisation_profile: profile.optimisation_profile,
        time_window_hours: profile.time_window,
        est_delivery_time: profile.delivery_time,
        TE: KMeansOnlyEfficiency.TE,
        DE: KMeansOnlyEfficiency.DE,
        WU: KMeansOnlyEfficiency.WU,
        VU: KMeansOnlyEfficiency.VU,
    }

    const randomOptimisedReport: ScheduleReport = {
        initialiser: ScheduleInitialiser.Random,
        optimiser: ScheduleOptimiser.GA,
        iterations: NUM_GENERATIONS,
        distance_multiplier: metrics.distanceMultiplier,
        average_speed: metrics.avgSpeed,
        vehicles_available: originalVehicles,
        vehicles_used: randomOptimised.routes.map(route => route.vehicle),
        total_packages_count: graph.nodes.reduce((acc, node) => acc + (node.pkg ? 1 : 0), 0),
        scheduled_packages_count: randomOptimised.numberOfPackages,
        total_distance_miles: randomOptimised.actualDistance,
        total_duration_hours: randomOptimised.actualTime / 60,
        // Schedule Profile
        auto_minimise: profile.auto_selection,
        optimisation_profile: profile.optimisation_profile,
        time_window_hours: profile.time_window,
        est_delivery_time: profile.delivery_time,
        TE: randomOptimisedEfficiency.TE,
        DE: randomOptimisedEfficiency.DE,
        WU: randomOptimisedEfficiency.WU,
        VU: randomOptimisedEfficiency.VU,
    }

    const kMeansOptimisedReport: ScheduleReport = {
        initialiser: ScheduleInitialiser.KMeans,
        optimiser: ScheduleOptimiser.GA,
        iterations: NUM_GENERATIONS,
        distance_multiplier: metrics.distanceMultiplier,
        average_speed: metrics.avgSpeed,
        vehicles_available: originalVehicles,
        vehicles_used: kMeansOptimised.routes.map(route => route.vehicle),
        total_packages_count: graph.nodes.reduce((acc, node) => acc + (node.pkg ? 1 : 0), 0),
        scheduled_packages_count: kMeansOptimised.numberOfPackages,
        total_distance_miles: kMeansOptimised.actualDistance,
        total_duration_hours: kMeansOptimised.actualTime / 60,
        // Schedule Profile
        auto_minimise: profile.auto_selection,
        optimisation_profile: profile.optimisation_profile,
        time_window_hours: profile.time_window,
        est_delivery_time: profile.delivery_time,
        // Efficiency Scores
        TE: kMeansOptimisedEfficiency.TE,
        DE: kMeansOptimisedEfficiency.DE,
        WU: kMeansOptimisedEfficiency.WU,
        VU: kMeansOptimisedEfficiency.VU,
    }

    // 8. Compare the efficiency of each solution, selecting the most efficient to be the final solution
    type SolutionEfficiencyTuple = [VRPSolution, ScheduleReport, EfficiencyScores];
    const solutionEfficiencies: SolutionEfficiencyTuple[] = [
        [randomOnly, randomOnlyReport, randomOnlyEfficiency],
        [kMeansOnly[0], kMeansOnlyReport, KMeansOnlyEfficiency],
        [randomOptimised, randomOptimisedReport, randomOptimisedEfficiency],
        [kMeansOptimised, kMeansOptimisedReport, kMeansOptimisedEfficiency]
    ];

    const mostEfficientSolution = solutionEfficiencies.reduce((prev, current) => {
        return (prev[2].overallEfficiency > current[2].overallEfficiency) ? prev : current;
    });

    const remainingSolutions = solutionEfficiencies.filter(solution => solution !== mostEfficientSolution);

    // Sort remaining solutions by efficiency, largest to smallest
    remainingSolutions.sort((a, b) => b[2].overallEfficiency - a[2].overallEfficiency);

    // 9. Return the most efficient solution and report, with the other solution reports included in the main report
    const finalSolution = mostEfficientSolution[0];
    const scheduleReport = mostEfficientSolution[1];
    scheduleReport.other_solutions = remainingSolutions.map(solution => solution[1]);

    return { finalSolution, scheduleReport };
}


