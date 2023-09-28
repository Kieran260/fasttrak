"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Vehicle } from '@/types/vehicle'

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

export const columns: ColumnDef<Vehicle>[] = [
    {
        accessorKey: "registration",
        header: "Registration",
    },
    {
        accessorKey: "manufacturer",
        header: "Manufacturer",
    },

    {
        accessorKey: "model",
        header: "Model",
    },

    {
        accessorKey: "max_load",
        header: "Max Load (kg)",
    },
    {
        accessorKey: "max_volume",
        header: () => (
            <div className="text-left">
                Volume (cm<sup>3</sup>)
            </div>
        ),
    },
    {
        accessorKey: "status",
        header: "Status",
    },
    {
        id: "actions",
        cell: ({ row }) => {
            const payment = row.original

            return (
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
                        <DropdownMenuItem>Schedule Maintenance</DropdownMenuItem>
                        <DropdownMenuItem>Remove Vehicle</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            )
        },
    },
]
