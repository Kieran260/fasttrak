import { VRPSolution } from "@/lib/routing/model/VRPSolution";
import { PriorityQueue } from "../../../scheduling/PriorityQueue";
import { RouteNode } from '@/lib/routing/model/RouteNode';
import { crossover } from "./crossover";
import { routeFitness } from "./fitness";
import {  mutate } from "./mutate";
import { insert } from "./insert";
import { ScheduleProfile } from "@/types/db/ScheduleProfile";

export class GeneticAlgorithm {
    private bestGeneration: VRPSolution;
    private remainingPackages: PriorityQueue;
    private scheduleProfile: ScheduleProfile
    private generationFitness: { generation: number, fitness: number }[];
    private generations: number;

    constructor(initialPopulation: VRPSolution, remainingPackages: PriorityQueue | RouteNode[], scheduleProfile: ScheduleProfile, generations: number) {
        // Convert nodes to priority queue
        let packages = new PriorityQueue();
        if (remainingPackages instanceof PriorityQueue) {
            packages = remainingPackages;
        } else {
            const queue = new PriorityQueue();
            for (const node of remainingPackages) {
                queue.enqueue(node);
            }
            packages = queue;
        }
        this.generations = generations;
        this.remainingPackages = packages;
        this.bestGeneration = initialPopulation.clone();
        this.scheduleProfile = scheduleProfile;
        this.scheduleProfile.time_window = scheduleProfile.time_window;
        this.generationFitness = [];
    }

    private evolveGeneration(generationNumber: number): void {
        // 1. Update the measurements of the best generation
        this.bestGeneration.updateRouteMeasurements();

        // 2. Evaluate fitness of the bestGeneration and aggregate the total fitness
        let generationFitness = 0;
        for (const route of this.bestGeneration.routes) {
            route.scheduleProfile = this.scheduleProfile;
            generationFitness += routeFitness(route);
        }

        // 3. Create a deep copy of the best generation
        let offspring = this.bestGeneration.clone();

        // 4. Crossover occurs with 80% probability, only if there is more than one route
        if (offspring.routes.length > 1) {
            if (Math.random() < 0.8) {
                offspring = crossover(offspring);
            }
        }

        offspring.updateRouteMeasurements()

        // 5. Mutation
        for (const route of offspring.routes) {
            // 20% chance of mutation if there is more than one route, else mutate for every iteration
            if (Math.random() < 0.2 || offspring.routes.length === 1) {
                const mutatedRoute = mutate(route, this.bestGeneration.routes[0].depotNode);
                offspring.routes[offspring.routes.indexOf(route)] = mutatedRoute;
            }
        }

        offspring.updateRouteMeasurements()

        // 6. Evaluate fitness of new population
        let offspringFitness = 0;
        for (const route of offspring.routes) {
            offspringFitness += routeFitness(route);
        }

        // 7. Replace old population with new population if new population is better
        if (offspringFitness < generationFitness) {
            this.bestGeneration = offspring;
        }

        // Log the fitness of the generation
        if (offspringFitness < generationFitness || generationNumber % 100 === 0) {
            this.generationFitness.push({ generation: generationNumber, fitness: generationFitness });
            console.log(generationNumber);
        }
    }

    public evolve(): VRPSolution {
        console.log("Starting evolve")
        // Test Initial Population
        let fitness = 0;
        for (const route of this.bestGeneration.routes) {
            fitness += routeFitness(route);
        }

        // Main loop
        for (let i = 0; i < this.generations; i++) {
            this.evolveGeneration(i);

            if (i > this.generations / 4 && Math.random() < 0.20) {
                // Artificial Gene Transfer - start attempting to add genes to the pool after 20% of the generations
                this.bestGeneration = insert(this.bestGeneration, this.remainingPackages, this.scheduleProfile);
            }
        }

        this.bestGeneration.updateRouteMeasurements();

        let endFitness = 0;
        for (const route of this.bestGeneration.routes) {
            endFitness += routeFitness(route);
        }

        this.bestGeneration.cleanRoutes();

        // Used for experiment 2 - logging fitness
        // Turn generationFitness into csv and download to file
        let csv = "Generation,Fitness\n";
        for (const fitness of this.generationFitness) {
            csv += `${fitness.generation},${fitness.fitness}\n`;
        }

        // download
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'generation_fitness.csv';
        a.click();
        

        return this.bestGeneration;
    }
}
