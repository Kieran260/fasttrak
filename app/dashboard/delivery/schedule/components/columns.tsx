"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Package } from '@/types/package'

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
import { DeliverySchedule } from "@/types/delivery-schedule"
import { Vehicle } from "@/types/vehicle"
import { db } from "@/lib/db/db"


export const columns = (refreshData: () => void): ColumnDef<DeliverySchedule>[] => [
    {
        accessorKey: "vehicle",
        header: "Vehicle",
        cell: ({ row }) => {
            const vehicle: Vehicle = row.getValue("vehicle")

            return (
                <div className="flex flex-col w-fit">
                    <p>{vehicle.registration}</p>
                    <p className="text-sm text-foreground/50 w-fit">{vehicle.manufacturer} {vehicle.model}</p>
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
        accessorKey: "distance_miles",
        header: () => (
            <div className="text-left">
                Distance
            </div>
        ),
        cell: ({ row }) => {
            const distance = row.getValue("distance_miles")?.toString()

            return (
                <div className="flex flex-col w-fit">
                    <p>{distance} mi</p>
                </div>
            )
        }
    },
    {
        accessorKey: "estimated_duration_mins",
        header: () => (
            <div className="text-left">
                Driving Time
            </div>
        ),
        cell: ({ row }) => {
            const time = row.getValue("estimated_duration_mins")?.toString()

            // convert minutes to hours and minutes (e.g. 90 minutes = 1h 30)
            const hours = Math.floor(parseInt(time!) / 60);
            const minutes = parseInt(time!) % 60;

            return (
                <div className="flex flex-col w-fit">
                    <p>{hours}h {minutes}m</p>
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
            const p = row.original
            const [removeDialogOpen, setRemoveDialogOpen] = useState(false)

            async function handleRemovePackage(id?: UUID) {
                if (!id) {
                    console.warn("Schedule ID is undefined. Cannot remove package.");
                    return;
                }
                await db.packages.remove.byId(id);
                refreshData();
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
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem>Edit Information</DropdownMenuItem>
                            <AlertDialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
                                <AlertDialogTrigger asChild>
                                    <Button variant="ghost" className="relative h-8 font-normal flex cursor-default select-none items-center rounded-sm px-2 py-1 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50">Remove Package</Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Remove Package</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            This action cannot be undone. This will remove the package from
                                            the system and cancel any scheduled deliveries.
                                        </AlertDialogDescription>
                                        <AlertDialogDescription className="text-foreground/50 hover:underline hover:text-blue-500 hover:cursor-pointer w-fit">
                                            Made a mistake? Amend the package instead.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleRemovePackage(p.schedule_id)}>Continue</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Remove Package Alert */}

                </>

            )
        },
    },
]