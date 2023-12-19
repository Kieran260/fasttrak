import * as z from "zod";
import { useEffect, useState } from "react";

import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

import PackageSchema from "./package-schema";
import sanitizeHtml from "sanitize-html";
import { sanitizeFloat } from "@/lib/utils/validation";
import { Textarea } from "@/components/ui/textarea";

interface PackageFormProps {
    onSubmit: (values: z.infer<typeof PackageSchema>) => void;
    form: any;
}

export const PackageForm: React.FC<PackageFormProps> = ({ onSubmit, form }) => {

    const { setValue } = form;

    // Form Input Handling
    const capitalizeWords = (str: string) => {
        return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
    };

    const onTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        const capitalizedValue = capitalizeWords(value);
        setValue(name as keyof z.infer<typeof PackageSchema>, capitalizedValue);
    };

    const onPostcodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        // capitalise all alpha letters
        const { name, value } = e.target;
        const capitalizedValue = value.toUpperCase();
        setValue(name as keyof z.infer<typeof PackageSchema>, capitalizedValue);
    };

    const onNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;

        // Remove all characters that are not numbers or phone-related symbols
        let sanitizedValue = value.replace(/[^0-9+\-()\s]/g, '');

        // Remove consecutive whitespaces and whitespaces not following a number
        sanitizedValue = sanitizedValue.replace(/\s{2,}|(?<!\d)\s/g, '');

        setValue(name as keyof z.infer<typeof PackageSchema>, sanitizedValue);
    };

    // Package Details Handling
    const [isVolumeDisabled, setIsVolumeDisabled] = useState(false);
    const [volumePlaceholder, setVolumePlaceholder] = useState<string>("Volume");

    const [isDimensionsDisabled, setIsDimensionsDisabled] = useState(false);
    const [dimensions, setDimensions] = useState<{ [key: string]: string | undefined }>({
        width: undefined,
        height: undefined,
        length: undefined,
    });

    const onWeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        const sanitizedValue = sanitizeFloat(value);
        setValue(name as keyof z.infer<typeof PackageSchema>, sanitizedValue);
    };

    const onVolumeChange = (value: string) => {
        const volume = sanitizeFloat(value);
        setValue('volume', volume);

        // Disable dimensions if volume is entered
        setIsDimensionsDisabled(!!volume);

        // Reset dimensions
        setDimensions({ width: undefined, height: undefined, length: undefined });
    };

    const onDimensionChange = (dimension: 'width' | 'height' | 'length', value: string) => {
        value = sanitizeFloat(value);

        // Enable dimensions if volume is removed
        if (!value) {
            setIsDimensionsDisabled(false);
        }

        setDimensions(prev => ({ ...prev, [dimension]: value }));
        setValue('volume', undefined!);
    };

    // Disable volume input if any dimension is entered
    useEffect(() => {
        const { width, height, length } = dimensions;

        const anyDimensionEntered = width || height || length;
        const allDimensionsEntered = width && height && length;

        setIsVolumeDisabled(Boolean(anyDimensionEntered));
        setVolumePlaceholder(anyDimensionEntered ? "Calculating by dimensions..." : "Volume");

        if (allDimensionsEntered) {
            const volume = parseFloat(width!) * parseFloat(height!) * parseFloat(length!);
            setValue('volume', volume.toString());
        }
    }, [dimensions, setValue]);

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">

                    {/* Package Details */}
                    <div className="space-y-4 border rounded-md p-4 bg-card order-1">
                        <FormField
                            control={form.control}
                            name="weight"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Package Details</FormLabel>
                                    <FormControl>
                                        <div className="relative">
                                            <Input
                                                {...field}
                                                value={field.value || ''}
                                                placeholder="Weight"
                                                onChange={onWeightChange}
                                            />
                                            <span className="absolute inset-y-0 right-0 flex items-center pr-2 text-muted-foreground">
                                                kg
                                            </span>
                                        </div>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <div className="flex items-center gap-2">
                            <div className="relative w-1/3">
                                <Input
                                    value={dimensions.width || ''}
                                    placeholder="Width"
                                    disabled={isDimensionsDisabled}
                                    onChange={(e) => onDimensionChange('width', e.target.value)}
                                />
                                <span className="absolute inset-y-0 right-0 flex items-center pr-2 text-muted-foreground">
                                    m
                                </span>
                            </div>
                            <div className="relative w-1/3">
                                <Input
                                    value={dimensions.height || ''}
                                    placeholder="Height"
                                    disabled={isDimensionsDisabled}
                                    onChange={(e) => onDimensionChange('height', e.target.value)}
                                />
                                <span className="absolute inset-y-0 right-0 flex items-center pr-2 text-muted-foreground">
                                    m
                                </span>
                            </div>
                            <div className="relative w-1/3">
                                <Input
                                    value={dimensions.length || ''}
                                    placeholder="Length"
                                    disabled={isDimensionsDisabled}
                                    onChange={(e) => onDimensionChange('length', e.target.value)}
                                />
                                <span className="absolute inset-y-0 right-0 flex items-center pr-2 text-muted-foreground">
                                    m
                                </span>
                            </div>
                        </div>
                        <FormField
                            control={form.control}
                            name="volume"
                            render={({ field }) => (
                                <FormItem>
                                    <FormControl>
                                        <div className="relative">
                                            <Input
                                                {...field}
                                                disabled={isVolumeDisabled}
                                                value={field.value || ''}
                                                placeholder={volumePlaceholder}
                                                onChange={(e) => onVolumeChange(e.target.value)}
                                                className="pr-8"
                                            />
                                            <span className="absolute inset-y-0 right-0 flex items-center pr-2 text-muted-foreground">
                                                m³
                                            </span>
                                        </div>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>

                    {/* Delivery Details */}
                    <div className="space-y-4 border rounded-md p-4 order-3">
                        <FormField
                            control={form.control}
                            name="fragile"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Delivery Information</FormLabel>
                                    <Select onValueChange={(e) => setValue(field.name, Boolean(e))} defaultValue={field.value?.toString()}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Item Fragility" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="true">Fragile</SelectItem>
                                            <SelectItem value="false">Not Fragile</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="priority"
                            render={({ field }) => (
                                <FormItem>
                                    <Select onValueChange={field.onChange} defaultValue={field.value?.toString()}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select Priority" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="Standard">Standard</SelectItem>
                                            <SelectItem value="Express">Express</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="delivery_notes"
                            render={({ field }) => (
                                <FormItem>
                                    <FormControl>

                                        <Textarea
                                            {...field}
                                            value={field.value || ''}
                                            placeholder="Delivery Notes"
                                            className="resize-none"
                                            onChange={field.onChange}

                                        />

                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>


                    {/* Recipient Details */}
                    <div className="space-y-4 border rounded-md p-4 bg-card order-3">
                        <FormField
                            control={form.control}
                            name="recipient_name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Recipient Details</FormLabel>
                                    <FormControl>
                                        <Input
                                            {...field}
                                            value={field.value || ''}
                                            placeholder="Recipient Name"
                                            onChange={onTextChange} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="recipient_address_1"
                            render={({ field }) => (
                                <FormItem>
                                    <FormControl>
                                        <Input
                                            {...field}
                                            value={field.value || ''}
                                            placeholder="Address Line 1"
                                            onChange={onTextChange} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="recipient_address_2"
                            render={({ field }) => (
                                <FormItem>
                                    <FormControl>
                                        <Input
                                            {...field}
                                            value={field.value || ''}
                                            placeholder="Address Line 2 (Optional)"
                                            onChange={onTextChange} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="recipient_postcode"
                            render={({ field }) => (
                                <FormItem>
                                    <FormControl>
                                        <Input
                                            {...field}
                                            value={field.value || ''}
                                            placeholder="Postcode"
                                            onChange={onPostcodeChange} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="recipient_phone"
                            render={({ field }) => (
                                <FormItem>
                                    <FormControl>
                                        <Input
                                            {...field}
                                            value={field.value || ''}
                                            placeholder="Phone Number"
                                            onChange={onNumberChange} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>

                    {/* Sender Details */}
                    <div className="space-y-4 border rounded-md p-4 flex-grow order-4">
                        <FormField
                            control={form.control}
                            name="sender_name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Sender Details</FormLabel>
                                    <FormControl>
                                        <Input
                                            {...field}
                                            value={field.value || ''}
                                            placeholder="Sender Name"
                                            onChange={onTextChange} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="sender_address_1"
                            render={({ field }) => (
                                <FormItem>
                                    <FormControl>
                                        <Input
                                            {...field}
                                            value={field.value || ''}
                                            placeholder="Address Line 1"
                                            onChange={onTextChange} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="sender_address_2"
                            render={({ field }) => (
                                <FormItem>
                                    <FormControl>
                                        <Input
                                            {...field}
                                            value={field.value || ''}
                                            placeholder="Address Line 2 (Optional)"
                                            onChange={onTextChange} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="sender_postcode"
                            render={({ field }) => (
                                <FormItem>
                                    <FormControl>
                                        <Input
                                            {...field}
                                            value={field.value || ''}
                                            placeholder="Postcode"
                                            onChange={onPostcodeChange} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="sender_phone"
                            render={({ field }) => (
                                <FormItem>
                                    <FormControl>
                                        <Input
                                            {...field}
                                            value={field.value || ''}
                                            placeholder="Phone Number"
                                            onChange={onNumberChange} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                </div>

                <div className="flex justify-end">
                    <Button type="submit">Submit</Button>
                </div>
            </form>
        </Form >
    );
};
