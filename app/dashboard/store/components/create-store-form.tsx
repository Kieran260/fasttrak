"use client"

import Link from "next/link"
import { zodResolver } from "@hookform/resolvers/zod"
import { useFieldArray, useForm } from "react-hook-form"
import { z } from "zod"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/use-toast"
import { FaCopy } from "react-icons/fa"
import { IoMdRefresh } from "react-icons/io";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { db } from "@/lib/db/db"
import { Store } from "@/types/store"
import { PostgrestError } from "@supabase/supabase-js"
import { useEffect } from "react"
import { generateIC } from "@/lib/utils/generate-ids"
import { storeFormSchema } from "./store-form"

type StoreFormValues = z.infer<typeof storeFormSchema>

// This can come from your database or API.
const defaultValues: Partial<StoreFormValues> = {
    name: "",
    passcode: "",
}

export function CreateStoreForm() {
    const form = useForm<StoreFormValues>({
        resolver: zodResolver(storeFormSchema),
        defaultValues,
        mode: "onChange",
    })

    async function onSubmit(data: StoreFormValues) {
        const store: Store = {
            store_name: data.name,
            invite_code: data.passcode,
            // Include other fields as necessary
        };

        try {
            const { data: createdStore, error } = await db.stores.create(store);
            console.log(createdStore)

            if (error) {
                console.log("Error occurred while creating store:", error);
                // Handle the error case here
            } else if (createdStore && createdStore.store_id) {
                // Here you have the created store with the UUID
                // You can now use createdStore.store_id to update the user's profile
                const updateResult = await db.profiles.update.store(createdStore.store_id);
            } else {
                // Handle the case where the store was not returned
                console.log("Store was not created.");
            }
        } catch (error) {
            console.error("An unexpected error occurred:", error);
        }
    }


    useEffect(() => {
        form.setValue("passcode", generateIC());
    }, [])


    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 xl:gap-24">
                    <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Store Name</FormLabel>
                                <FormControl>
                                    <Input placeholder="Store" {...field} />
                                </FormControl>
                                <FormDescription>
                                    This is the name of your organisation.
                                </FormDescription>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="passcode"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Invite Code</FormLabel>
                                <FormControl>
                                    <div className="flex gap-2">
                                        <div className="flex justify-start border items-center p-2 px-3 h-10 text-start text-sm text-muted-foreground rounded-lg flex-grow">{field.value}</div>
                                        <Button
                                            type="button"
                                            variant="secondary"
                                            size="icon"
                                            onClick={e => form.setValue("passcode", generateIC())}>

                                            <IoMdRefresh size={16} />
                                        </Button>
                                    </div>
                                </FormControl>
                                <FormDescription>
                                    This code is required for new users to join your store. Click the refresh button to generate a new code.
                                </FormDescription>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>
                <Button type="submit">Create Store</Button>

            </form>
        </Form >
    )
}