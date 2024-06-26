"use client"

import { ColumnDef, RowSelectionState } from "@tanstack/react-table"
import { Package } from '@/types/db/Package'

import { MoreHorizontal } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import Link from "next/link"
import { useState } from "react"
import { UUID } from "crypto"
import { DeliverySchedule, DeliveryStatus } from "@/types/db/DeliverySchedule"
import { Vehicle } from "@/types/db/Vehicle"
import { db } from "@/lib/db/db"
import {
    HoverCard,
    HoverCardContent,
    HoverCardTrigger,
} from "@/components/ui/hover-card"
import { ConfirmDeliveryTable } from "../confirm-delivery-table/confirm-delivery-table"
import { ConfirmTableColumns } from "../confirm-delivery-table/columns"
import { updatePackages } from "@/lib/scheduling/update-packages"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { downloadGPX } from "@/lib/utils/export-gpx"

export const columns = (refreshSchedule: (updatedSchedule: DeliverySchedule) => void): ColumnDef<DeliverySchedule>[] => [
    {
        accessorKey: "route_number",
        header: "Route",
        cell: ({ row }) => {
            const routeNumber = row.getValue("route_number")?.toString()

            return (
                <p className="text-muted-foreground">{routeNumber}</p>
            )
        }

    },
    {
        accessorKey: "vehicle",
        header: "Vehicle",
        cell: ({ row }) => {
            const vehicle: Vehicle = row.getValue("vehicle")

            return (
                <div className="flex flex-col w-fit">
                    <HoverCard>
                        <HoverCardTrigger asChild>
                                <p className="hover:text-primary hover:underline hover:cursor-default">{vehicle.registration}</p>
                        </HoverCardTrigger>
                        <HoverCardContent className="w-50">
                            <div className="flex justify-between space-x-4">
                                <div className="space-y-1">
                                    <h4 className="text-sm font-semibold">{vehicle.registration}</h4>
                                    <p className="text-sm">
                                        {vehicle.manufacturer} {vehicle.model} {vehicle.manufacture_year}
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                        Max load: {vehicle.max_load} kg
                                        <br />
                                        Max volume: {vehicle.max_volume} m<sup>3</sup>
                                    </p>
                                </div>
                            </div>
                        </HoverCardContent>
                    </HoverCard>
                    <p className="text-sm text-muted-foreground w-fit">{vehicle.manufacturer} {vehicle.model}</p>
                </div>
            )
        }
    },
    {
        accessorKey: "package_order",
        header: "Packages",
        cell: ({ row }) => {
            const packages: Package[] = row.getValue("package_order")

            return (
                <div className="flex flex-col w-fit">
                    <p>{packages.length}</p>
                </div>
            )
        }
    },
    {
        accessorKey: "actual_distance_miles",
        header: () => (
            <div className="text-left">
                Travel
            </div>
        ),
        cell: ({ row }) => {
            const distance = row.getValue("actual_distance_miles")?.toString()
            const time = row.original.actual_duration_mins?.toString()

            // convert minutes to hours and minutes (e.g. 90 minutes = 1h 30)
            const hours = Math.floor(parseInt(time!) / 60);
            const minutes = parseInt(time!) % 60;
            return (
                <div className="flex flex-col w-fit whitespace-nowrap">
                    <p>{distance} mi</p>
                    <p>{hours}h {minutes}m</p>
                </div>
            )
        }
    },
    {
        accessorKey: "load_weight",
        header: () => (
            <div className="text-left">
                Load
            </div>
        ),
        cell: ({ row }) => {
            // Get current load and weight
            const vehicle: Vehicle = row.getValue("vehicle")

            let load = row.getValue("load_weight")?.toString()
            let volume = row.original.load_volume?.toString()

            // Reduce to 2 decimal places if there is a decimal point
            if (load?.includes(".")) {
                load = Number(load).toFixed(2)
            }
            if (volume?.includes(".")) {
                volume = Number(volume).toFixed(2)
            }


            // Get max load and volume
            const maxLoad = vehicle.max_load
            const maxVolume = vehicle.max_volume



            return (
                <div className="flex flex-col w-fit">
                    <div className="inline-flex gap-1 whitespace-nowrap">
                        <p className="text-foreground">{load} kg </p>
                        <p className="text-muted-foreground">/ {maxLoad} kg</p>
                    </div>
                    <div className="inline-flex gap-1 whitespace-nowrap">
                        <p className="text-foreground">{volume} m<sup>3</sup> </p>
                        <p className="text-muted-foreground">/ {maxVolume} m<sup>3</sup></p>
                    </div>
                </div>
            )
        }
    },
    {
        accessorKey: "status",
        header: "Status",
    },
    {
        id: "actions",
        cell: ({ row }) => {
            const schedule = row.original
            const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
            const [inProgressAlertOpen, setInProgressAlertOpen] = useState(false);
            const [completeAlertOpen, setCompleteAlertOpen] = useState(false);
            const [rowSelection, setRowSelection] = useState({})


            async function handleUpdateStatus(id: UUID, status: DeliveryStatus) {

                // Update schedule status
                const res = await db.schedules.update.status(id, status)

                if (res) {
                    //console.log("Delivery status updated successfully.")
                    refreshSchedule(res.data!);

                } else {
                    console.warn("Failed to update delivery status.");
                }

            }



            async function completeDeliveries(schedule: DeliverySchedule, rowSelection: RowSelectionState): Promise<void> {
                // Mark selected rows as delivered
                // Mark all other rows as failed to deliver

                const packageIds = schedule.package_order.map(pkg => pkg.package_id);
                const selectedRowIndices = Object.keys(rowSelection).filter((key) => rowSelection[key] === true);

                const deliveredPackageIds = packageIds.filter((_, index) => selectedRowIndices.includes(index.toString()));
                const failedPackageIds = packageIds.filter((_, index) => !selectedRowIndices.includes(index.toString()));

                // Convert package IDs to Package objects from the original schedule.package_order
                const deliveredPackages = schedule.package_order.filter(pkg => deliveredPackageIds.includes(pkg.package_id));
                const failedPackages = schedule.package_order.filter(pkg => failedPackageIds.includes(pkg.package_id));

                //console.log("Before update")

                const newSchedule = await updatePackages(schedule, deliveredPackages, failedPackages);

                //console.log("Before refresh")
                if (newSchedule) {
                    refreshSchedule(newSchedule);
                    //console.log("after refresh")

                }
            }
            
            return (
                <>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" className="h-8 w-8 p-0">
                                <span className="sr-only">Open menu</span>
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Route {schedule.route_number}</DropdownMenuLabel>
                            <DropdownMenuSeparator />

                            <AlertDialog open={inProgressAlertOpen} onOpenChange={setInProgressAlertOpen}>
                                <AlertDialogTrigger asChild>
                                    <Button
                                        disabled={schedule.status != DeliveryStatus.Scheduled}
                                        variant="ghost"
                                        className="relative w-full justify-start h-8 font-normal flex cursor-default select-none items-center rounded-sm px-2 py-1 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                                    >
                                        Delivery In-Progress
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Delivery In Progress</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            Are you sure? This update cannot be undone.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction disabled={schedule.status != DeliveryStatus.Scheduled}
                                            onClick={() => handleUpdateStatus(schedule.schedule_id!, DeliveryStatus.InProgress)}
                                        >
                                            Continue
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>

                            {/* TODO: Show dialog to select any packages which were failed to be delivered */}
                            <Dialog open={completeAlertOpen} onOpenChange={setCompleteAlertOpen}>
                                <DialogTrigger asChild>
                                    <Button
                                        disabled={schedule.status == DeliveryStatus.Scheduled || schedule.status == DeliveryStatus.Completed || schedule.status == DeliveryStatus.Cancelled}
                                        variant="ghost"
                                        className="relative w-full justify-start h-8 font-normal flex cursor-default select-none items-center rounded-sm px-2 py-1 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                                    >
                                        Delivery Complete
                                    </Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>Delivery Complete</DialogTitle>
                                        <DialogDescription>
                                            Select delivered packages to confirm delivery.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <ConfirmDeliveryTable columns={ConfirmTableColumns()} data={schedule.package_order} rowSelection={rowSelection} setRowSelection={setRowSelection} />

                                    <DialogFooter>
                                        <DialogClose>Cancel</DialogClose>
                                        <Button
                                            onClick={() => completeDeliveries(schedule, rowSelection)}
                                        >
                                            Continue
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                            <DropdownMenuSeparator />
                            <Link href={`/dashboard/schedule/${schedule.schedule_id}`}>
                                <DropdownMenuItem>Route Details</DropdownMenuItem>
                            </Link>
                            <DropdownMenuItem onClick={() => downloadGPX(schedule)}>Export Directions</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </>

            )
        },
    },
]
