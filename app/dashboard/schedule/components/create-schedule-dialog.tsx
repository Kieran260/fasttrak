import React, { useEffect, useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectTrigger, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Vehicle } from "@/types/db/Vehicle";
import { format } from "date-fns";
import { BiSolidTruck } from "react-icons/bi";
import { PiPackageBold } from "react-icons/pi";
import { Label } from "@/components/ui/label";
import { Loader2 } from 'lucide-react';
import { OptimisationProfile, ScheduleProfile } from '@/types/db/ScheduleProfile';
import { MdError, MdInfoOutline } from 'react-icons/md';
import { db } from '@/lib/db/db';
import { HiLightningBolt } from 'react-icons/hi';
import { FaLeaf, FaTruck } from 'react-icons/fa';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScheduleInitialiser, ScheduleOptimiser } from '@/types/db/ScheduleReport';


interface ScheduleDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    date: Date | null;
    handleScheduleDelivery: (profile: ScheduleProfile) => void;
}

export const ScheduleDialogContent: React.FC<ScheduleDialogProps> = ({
    date,
    onOpenChange,
    open,
    handleScheduleDelivery,
}) => {

    const [numPendingPackages, setNumPendingPackages] = useState<Number | null>(null);
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [selectedVehicles, setSelectedVehicles] = useState<Vehicle[]>([]);
    const [minimiseVehicles, setMinimiseVehicles] = useState<boolean>(true);
    const [selectOptimal, setSelectOptimal] = useState<boolean>(true);
    const [isScheduling, setIsScheduling] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [userHasDepot, setUserHasDepot] = useState<boolean>(false);
    const [userHasStore, setUserHasStore] = useState<boolean>(false);

    const fetchData = async () => {
        setIsLoading(true);

        const store = await db.stores.fetch.forUser();

        if (store.error) {
            setVehicles([]);
            setNumPendingPackages(0);
            setUserHasStore(false);
        } else if (store.data) {
            setUserHasStore(true);
            const depot = await db.depots.fetch.forUser();

            // If user has depot, fetch the vehicles and packages
            if (depot.data) {
                setUserHasDepot(true);
                const vehicles = await db.vehicles.fetch.all()
                const packages = await db.packages.fetch.pending()

                // If the vehicles and packages are available, set the states
                if (vehicles && packages) {
                    setVehicles(vehicles);
                    setNumPendingPackages(packages.length);
                    setSelectedVehicles(vehicles);
                }
            } else if (depot.error) {
                setVehicles([]);
                setNumPendingPackages(0);
                setUserHasDepot(false);
            }
        }

        setIsLoading(false);
    };

    useEffect(() => {
        if (open) {
            fetchData();
        } else {
            // Delay the reset process by 200 ms
            const timer = setTimeout(() => {
                setNumPendingPackages(null);
                setVehicles([]);
                setSelectedVehicles([]);
                setIsScheduling(false);
                setFormFields({
                    optimisationProfile: 'Eco',
                    timeWindow: '8',
                    deliveryTime: '3',
                    initialisationAlgorithm: ScheduleInitialiser.Random,
                    optimisationAlgorithm: ScheduleOptimiser.GA,
                    generations: '1000000',
                });
            }, 200);

            // Cleanup function to clear the timeout
            return () => clearTimeout(timer);
        }
    }, [open]);

    const handleCheckedChange = (vehicle: Vehicle, isChecked: boolean) => {
        if (isChecked) {
            setSelectedVehicles(prev => [...prev, vehicle]);
        } else {
            setSelectedVehicles(prev => prev.filter(v => v.vehicle_id !== vehicle.vehicle_id));
        }
    };

    const [formFields, setFormFields] = useState({
        optimisationProfile: 'Eco',
        timeWindow: '8',
        deliveryTime: '3',
        initialisationAlgorithm: ScheduleInitialiser.Random,
        optimisationAlgorithm: ScheduleOptimiser.GA,
        generations: '1000000',
    });

    const isSubmitDisabled = () => {
        return (
            formFields.optimisationProfile === '' ||
            formFields.timeWindow === '' ||
            formFields.deliveryTime === '' ||
            selectedVehicles.length === 0 ||
            (numPendingPackages !== null && Number(numPendingPackages) === 0) ||
            isLoading == true
        );
    };

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();

        const scheduleProfile: ScheduleProfile = {
            // Profile settings
            selected_vehicles: selectedVehicles,
            auto_selection: minimiseVehicles,
            optimisation_profile: formFields.optimisationProfile as OptimisationProfile,
            time_window: parseInt(formFields.timeWindow),
            delivery_time: parseInt(formFields.deliveryTime),
            // Advanced settings
            select_optimal: selectOptimal,
            initialisation_algorithm: formFields.initialisationAlgorithm,
            optimisation_algorithm: formFields.optimisationAlgorithm,
            generations: formFields.optimisationAlgorithm === ScheduleOptimiser.GA ? parseInt(formFields.generations) : 0,
        };

        console.log(scheduleProfile);
        // Call the handleScheduleDelivery function to process the schedule
        handleScheduleDelivery(scheduleProfile);

        // Set the scheduling state to true
        setIsScheduling(true);

        // Wait for 1 second before closing the dialog
        setTimeout(() => {
            onOpenChange(false);
        }, 1000);
    };

    return (
        <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
                <DialogTitle>New Schedule</DialogTitle>
                {date != null &&
                    <DialogDescription>
                        Schedule for <b>{format(date, 'do MMMM yyyy') ?? ""}</b>
                    </DialogDescription>
                }
            </DialogHeader>


            {/* Info */}
            <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 text-xs">
                <div className="flex text-sm items-center gap-2 justify-center sm:justify-start">
                    <BiSolidTruck />
                    {!isLoading &&
                        `${vehicles.length} Available Vehicles`
                    }
                    {isLoading &&
                        <div className="flex font-normal text-xs items-center mx-2 my-auto gap-2">
                            <Loader2 size={18} className="animate-spin" /> Loading Vehicles...
                        </div>
                    }
                </div>
                <div className="flex text-sm items-center gap-2 justify-center sm:justify-start">
                    <PiPackageBold />
                    {
                        numPendingPackages !== null && numPendingPackages !== undefined
                            ? `${numPendingPackages} Pending Packages`
                            : <div className="flex font-normal text-xs items-center mx-2 my-auto gap-2">
                                <Loader2 size={18} className="animate-spin" /> Loading Packages...
                            </div>
                    }
                </div>
            </div>

            {/* Error messages */}
            {userHasDepot && !isLoading &&
                <>
                    {isLoading == false && selectedVehicles.length === 0 && vehicles.length > 0 && numPendingPackages !== null && Number(numPendingPackages) > 0 &&
                        <div className="w-full flex gap-2 items-center text-sm text-red-500"><MdError />Unable to schedule, no vehicles selected</div>
                    }
                    {isLoading == false && vehicles.length === 0 && numPendingPackages !== null && Number(numPendingPackages) > 0 &&
                        <div className="w-full flex gap-2 items-center text-sm text-red-500"><MdError />Unable to schedule, no vehicles available</div>
                    }
                    {isLoading == false && numPendingPackages === 0 &&
                        <div className="w-full flex gap-2 items-center text-sm text-red-500"><MdError />Unable to schedule, no packages pending</div>
                    }
                </>
            }
            {!userHasStore && !isLoading &&
                <div className="w-full flex gap-2 items-center text-sm text-red-500"><MdError />No store found, please create or join one first.</div>

            }
            {!userHasDepot && !isLoading && userHasStore &&
                <div className="w-full flex gap-2 items-center text-sm text-red-500"><MdError />No depot found, please create one and try again.</div>
            }


            {/* Divider */}
            <div className="w-full border-t" />

            <Tabs defaultValue="profile" className="w-full">
                <TabsList className="w-full">
                    <TabsTrigger className="w-full" value="profile">Profile</TabsTrigger>
                    <TabsTrigger className="w-full" value="advanced">Advanced</TabsTrigger>
                </TabsList>
                <TabsContent value="profile">
                    {/* Profile Form */}
                    <div className="flex flex-col justify-between gap-4 mt-4">
                        <div className="flex justify-between gap-4">
                            <Label className="my-auto justify-center line-clamp-1">Selected Vehicles</Label>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="selectTrigger" disabled={vehicles.length == 0}>
                                        {vehicles.length > 0 &&
                                            <div className="line-clamp-1 font-normal">{selectedVehicles.length} Selected</div>
                                        }
                                        {!isLoading && vehicles.length == 0 &&
                                            <div className="line-clamp-1 font-normal">None available</div>
                                        }
                                        {isLoading &&
                                            <div className="inline-flex gap-2 font-normal items-center"><Loader2 size={18} className="animate-spin" /> Loading...</div>
                                        }
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="w-[180px] max-h-[200px] overflow-y-scroll">
                                    {vehicles.map((vehicle) => {
                                        return (
                                            <DropdownMenuCheckboxItem
                                                key={vehicle.vehicle_id}
                                                className="capitalize flex-grow"
                                                checked={selectedVehicles.some(v => v.vehicle_id === vehicle.vehicle_id)}
                                                onCheckedChange={(value) => handleCheckedChange(vehicle, value)}
                                                onSelect={(event) => event.preventDefault()}
                                            >
                                                {vehicle.registration}
                                            </DropdownMenuCheckboxItem>
                                        )
                                    })}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>

                        <div className="flex justify-between ">
                            <Label htmlFor="min-vehicles" className="my-auto justify-center line-clamp-1">Auto Minimise Vehicles</Label>
                            <Switch id="min-vehicles" checked={minimiseVehicles} onCheckedChange={setMinimiseVehicles} />
                        </div>

                        <div className="flex justify-between gap-4">
                            <Label className="my-auto justify-center line-clamp-1 flex gap-1">Optimisation Profile</Label>
                            <Select value={formFields.optimisationProfile}
                                onValueChange={(e) => setFormFields({ ...formFields, optimisationProfile: e.valueOf() })}>
                                <SelectTrigger className="w-[180px]">
                                    <SelectValue placeholder="Select Profile" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectGroup>
                                        <SelectLabel>Optimisation</SelectLabel>
                                        <SelectItem value="Eco"><div className="flex items-center gap-2">Economical<FaLeaf className="text-primary" /></div></SelectItem>
                                        <SelectItem value="Space"><div className="flex items-center gap-2">Load Utilisation<FaTruck /></div></SelectItem>
                                        <SelectItem value="Time"><div className="flex items-center gap-2">Fastest Delivery<HiLightningBolt className="text-yellow-400" /></div></SelectItem>
                                    </SelectGroup>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex justify-between gap-4">
                            <Label className="my-auto justify-center line-clamp-1">Time Window</Label>
                            <Select value={formFields.timeWindow}
                                onValueChange={(e) => setFormFields({ ...formFields, timeWindow: e.valueOf() })}>
                                <SelectTrigger className="w-[180px]">
                                    <SelectValue placeholder="Select Time" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectGroup>
                                        <SelectLabel>Time Window</SelectLabel>
                                        <SelectItem value="4">4 hours</SelectItem>
                                        <SelectItem value="5">5 hours</SelectItem>
                                        <SelectItem value="6">6 hours</SelectItem>
                                        <SelectItem value="7">7 hours</SelectItem>
                                        <SelectItem value="8">8 hours</SelectItem>
                                        <SelectItem value="9">9 hours</SelectItem>
                                        <SelectItem value="10">10 hours</SelectItem>
                                    </SelectGroup>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="flex justify-between gap-4">
                            <Label className="my-auto justify-center line-clamp-1">Time Per Delivery</Label>
                            <Select value={formFields.deliveryTime}
                                onValueChange={(e) => setFormFields({ ...formFields, deliveryTime: e.valueOf() })}>
                                <SelectTrigger className="w-[180px]">
                                    <SelectValue placeholder="Select Time" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectGroup>
                                        <SelectLabel>Time Per Delivery</SelectLabel>
                                        <SelectItem value="2">2 Minutes</SelectItem>
                                        <SelectItem value="3">3 Minutes</SelectItem>
                                        <SelectItem value="4">4 Minutes</SelectItem>
                                        <SelectItem value="5">5 Minutes</SelectItem>
                                        <SelectItem value="6">6 Minutes</SelectItem>
                                    </SelectGroup>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </TabsContent>




                <TabsContent value="advanced">
                    {/* Advanced Form */}
                    <div className="flex flex-col justify-between gap-4 mt-4">
                        <div className="flex justify-between ">
                            <Label htmlFor="min-vehicles" className="my-auto justify-center line-clamp-1 h-4">Select Optimal (Slow)</Label>
                            <Switch id="min-vehicles" checked={selectOptimal} onCheckedChange={setSelectOptimal} />
                        </div>

                        <div className="flex justify-between gap-4">
                            <Label className="my-auto justify-center line-clamp-1 flex gap-1 h-4">Initialisation</Label>
                            <Select disabled={selectOptimal} value={formFields.initialisationAlgorithm}
                                onValueChange={(e) => setFormFields({ ...formFields, initialisationAlgorithm: e.valueOf() as ScheduleInitialiser })}>
                                <SelectTrigger className="w-[180px]">
                                    <SelectValue placeholder="Select Profile" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectGroup>
                                        <SelectLabel>Initialisation Algorithm</SelectLabel>
                                        <SelectItem value={ScheduleInitialiser.Random}><div className="flex items-center gap-2">Random</div></SelectItem>
                                        <SelectItem value={ScheduleInitialiser.KMeans}><div className="flex items-center gap-2">K-Means</div> </SelectItem>
                                    </SelectGroup>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex justify-between gap-4">
                            <Label className="my-auto justify-center line-clamp-1 flex gap-1">Optimisation</Label>
                            <Select disabled={selectOptimal} value={formFields.optimisationAlgorithm}
                                onValueChange={(e) => setFormFields({ ...formFields, optimisationAlgorithm: e.valueOf() as ScheduleOptimiser })}>
                                <SelectTrigger className="w-[180px]">
                                    <SelectValue placeholder="Select Profile" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectGroup>
                                        <SelectLabel>Optimisation Algorithm</SelectLabel>
                                        <SelectItem value={ScheduleOptimiser.None}><div className="flex items-center gap-2">None</div></SelectItem>
                                        <SelectItem value={ScheduleOptimiser.GA}><div className="flex items-center gap-2">Genetic Algorithm</div></SelectItem>
                                    </SelectGroup>
                                </SelectContent>
                            </Select>
                        </div>
                        {formFields.optimisationAlgorithm === ScheduleOptimiser.GA && selectOptimal == false &&
                            <div className="flex justify-between gap-4">
                                <Label className="my-auto justify-center line-clamp-1">Generations</Label>
                                <Select value={formFields.generations}
                                    onValueChange={(e) => setFormFields({ ...formFields, generations: e.valueOf() })}>
                                    <SelectTrigger className="w-[180px]">
                                        <SelectValue placeholder="Select Generations" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectGroup>
                                            <SelectLabel>Generations</SelectLabel>
                                            <SelectItem value="500000">500,000</SelectItem>
                                            <SelectItem value="1000000">1,000,000</SelectItem>
                                            <SelectItem value="1500000">1,500,000</SelectItem>
                                            <SelectItem value="2000000">2,000,000</SelectItem>
                                            <SelectItem value="2500000">2,500,000</SelectItem>
                                        </SelectGroup>
                                    </SelectContent>
                                </Select>
                            </div>
                        }
                    </div>
                </TabsContent>
            </Tabs>

            <DialogFooter>
                <>
                    {isScheduling == false &&
                        <Button type="submit"
                            onClick={e => handleSubmit(e)}
                            disabled={isSubmitDisabled()}>
                            Schedule
                        </Button>
                    }
                    {isScheduling == true &&
                        <Button disabled className="border">
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Scheduling
                        </Button>
                    }
                </>
            </DialogFooter>
        </DialogContent>
    );
};
