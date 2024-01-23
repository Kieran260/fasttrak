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
import { Vehicle } from "@/types/vehicle";
import { format } from "date-fns";
import { BiSolidTruck } from "react-icons/bi";
import { PiPackageBold } from "react-icons/pi";
import { Label } from "@/components/ui/label";
import { Loader2 } from 'lucide-react';
import { OptimisationProfile, ScheduleProfile } from '@/types/schedule-profile';
import { MdError, MdInfoOutline } from 'react-icons/md';
import { db } from '@/lib/db/db';
import { HiLightningBolt } from 'react-icons/hi';
import { FaLeaf, FaTruck } from 'react-icons/fa';


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
    const [isScheduling, setIsScheduling] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(false);

    const fetchData = async () => {
        setIsLoading(true);

        const vehicles = await db.vehicles.fetch.all()
        const packages = await db.packages.fetch.pending()

        if (vehicles && packages) {
            setVehicles(vehicles);
            setNumPendingPackages(packages.length);
            setSelectedVehicles(vehicles);
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
                    driverBreak: '30',
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
        driverBreak: '30',
    });

    const isSubmitDisabled = () => {
        return (
            formFields.optimisationProfile === '' ||
            formFields.timeWindow === '' ||
            formFields.deliveryTime === '' ||
            formFields.driverBreak === '' ||
            selectedVehicles.length === 0 ||
            (numPendingPackages !== null && Number(numPendingPackages) === 0) ||
            isLoading == true
        );
    };

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();

        const scheduleProfile: ScheduleProfile = {
            selected_vehicles: selectedVehicles,
            optimisation_profile: formFields.optimisationProfile as OptimisationProfile,
            time_window: parseInt(formFields.timeWindow),
            delivery_time: parseInt(formFields.deliveryTime),
            driver_break: parseInt(formFields.driverBreak),
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
                    {
                        numPendingPackages !== null && numPendingPackages !== undefined
                            ? `${vehicles.length} Available Vehicles`
                            : <div className="flex font-normal text-xs items-center mx-2 my-auto gap-2">
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

            {isLoading == false && selectedVehicles.length === 0 && vehicles.length > 0 && numPendingPackages !== null && Number(numPendingPackages) > 0 &&
                <div className="w-full flex gap-2 items-center text-sm text-red-500"><MdError />Unable to schedule, no vehicles selected</div>
            }
            {isLoading == false && vehicles.length === 0 && numPendingPackages !== null && Number(numPendingPackages) > 0 &&
                <div className="w-full flex gap-2 items-center text-sm text-red-500"><MdError />Unable to schedule, no vehicles available</div>
            }
            {isLoading == false && numPendingPackages === 0 &&
                <div className="w-full flex gap-2 items-center text-sm text-red-500"><MdError />Unable to schedule, no packages pending</div>
            }

            {/* Divider */}
            <div className="w-full border-t" />

            {/* Form */}
            <div className="flex justify-between gap-4">
                <Label className="my-auto justify-center line-clamp-1">Selected Vehicles</Label>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="selectTrigger">
                            {vehicles.length > 0 &&
                                <div className="line-clamp-1 font-normal">{selectedVehicles.length} Selected</div>
                            }
                            {vehicles.length === 0 &&
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

            <div className="flex justify-between gap-4">
                <Label className="my-auto justify-center line-clamp-1">Driver Break</Label>
                <Select value={formFields.driverBreak}
                    onValueChange={(e) => setFormFields({ ...formFields, driverBreak: e.valueOf() })}>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Select Time" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectGroup>
                            <SelectLabel>Driver Break</SelectLabel>
                            <SelectItem value="30">30 Minutes</SelectItem>
                            <SelectItem value="45">45 Minutes</SelectItem>
                            <SelectItem value="60">60 Minutes</SelectItem>
                        </SelectGroup>
                    </SelectContent>
                </Select>
            </div>

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
