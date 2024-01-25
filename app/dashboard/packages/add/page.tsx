'use client'

import * as z from "zod"

import PackageSchema from "./add-package-form/package-schema";
import { PackageForm } from "./add-package-form/package-form";
import { supabase } from "@/pages/api/supabase-client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useState } from "react";
import { generateFT } from "@/utils/utils/generate-ids";
import { Button } from "@/components/ui/button";
import { Loader } from '@googlemaps/js-api-loader';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const loader = new Loader({
  apiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY!,
  version: "weekly",
  libraries: ["geocoding"]
});

let geocoder: google.maps.Geocoder;

export default function AddPackage() {

  // Add Package Form
  const form = useForm<z.infer<typeof PackageSchema>>({
    resolver: zodResolver(PackageSchema),
    defaultValues: {
      recipient_name: "",
      recipient_address_1: "",
      recipient_address_2: "",
      recipient_postcode: "",
      recipient_phone: "",
      sender_name: "",
      sender_address_1: "",
      sender_address_2: "",
      sender_postcode: "",
      sender_phone: "",
      weight: "",
      volume: "",
      fragile: undefined,
      priority: "",
      delivery_notes: "",
    },
  })

  const [formKey, setFormKey] = useState<number>(0);

  // Data submission and confirmation
  const [packageDetails, setPackageDetails] = useState({
    formData: null as z.infer<typeof PackageSchema> | null,
    senderGeocode: null as google.maps.GeocoderResult[] | null,
    recipientGeocode: null as google.maps.GeocoderResult[] | null,
  });

  const [isDialogOpen, setIsDialogOpen] = useState(false);

  async function onSubmit(values: z.infer<typeof PackageSchema>) {
    console.log("submitted")
    console.log(values)

    // Swap address lines to allow better geocoding results
    if (values.recipient_address_2) {
      // swap address 1 and 2
      const temp = values.recipient_address_1;
      values.recipient_address_1 = values.recipient_address_2;
      values.recipient_address_2 = temp;
    }

    if (values.sender_address_2) {
      // swap address 1 and 2
      const temp = values.sender_address_1;
      values.sender_address_1 = values.sender_address_2;
      values.sender_address_2 = temp;
    }

    try {
      await loader.importLibrary("geocoding");
      geocoder = new google.maps.Geocoder();
    } catch (err) {
      console.error("Error loading Google Maps API: ", err);
      alert("Failed to initialize geocoding service");
      // TODO: Handle error alerts in a better way
      return;
    }

    const senderAddress = `${values.sender_address_1}, ${values.sender_address_2}, ${values.sender_postcode}`;
    const recipientAddress = `${values.recipient_address_1}, ${values.recipient_address_2}, ${values.recipient_postcode}`;

    const [resultSender, resultRecipient] = await Promise.all([
      geocode({ address: senderAddress }),
      geocode({ address: recipientAddress })
    ]);

    if (!resultSender || !resultRecipient) {
      alert("Error formatting address, please try again")
      return;
    } else {
      setIsDialogOpen(true);
      setPackageDetails(prevState => ({
        ...prevState,
        formData: values,
        senderGeocode: resultSender,
        recipientGeocode: resultRecipient,
      }));
    }
  }

  async function confirmPackage(values: z.infer<typeof PackageSchema>, resultSender: google.maps.GeocoderResult[], resultRecipient: google.maps.GeocoderResult[]) {
    const { error } = await supabase
      .from('packages')
      .insert({
        tracking_id: generateFT(),
        recipient_name: values.recipient_name,
        recipient_phone: values.recipient_phone,
        recipient_address: resultRecipient[0].formatted_address,
        recipient_address_lat: resultRecipient[0].geometry.location.lat(),
        recipient_address_lng: resultRecipient[0].geometry.location.lng(),
        sender_name: values.sender_name,
        sender_phone: values.sender_phone,
        sender_address: resultSender[0].formatted_address,
        sender_address_lat: resultSender[0].geometry.location.lat(),
        sender_address_lng: resultSender[0].geometry.location.lng(),
        status: "Pending",
        weight: Number(values.weight).toFixed(2),
        volume: Number(values.volume).toFixed(2),
        fragile: values.fragile,
        priority: values.priority,
        delivery_notes: values.delivery_notes,
      })
    if (error) {
      alert(error.message)
    } else {
      setIsDialogOpen(false);
      form.reset();
      // Increment key to re-render component
      setFormKey(prevKey => prevKey + 1);
    }
  }


  function geocode(request: google.maps.GeocoderRequest): Promise<google.maps.GeocoderResult[]> {
    return new Promise((resolve, reject) => {
      if (!geocoder) {
        console.error("Geocoder is not initialized");
        reject(new Error("Geocoder is not initialized"));
        return;
      }

      geocoder.geocode(request, (results, status) => {
        if (status === google.maps.GeocoderStatus.OK && results) {
          console.log(results);
          resolve(results);
        } else {
          alert("An addres you submitted is not valid, please check details and try again.");
        }
      });
    });
  }

  return (
    <div className="flex flex-col w-full justify-start gap-4 mx-auto p-4 max-w-[1600px]">
      <div className="inline-flex justify-between">
        <h1 className="text-foreground font-bold text-3xl my-auto">Add Package</h1>
      </div>

      {/* TODO: Add success / error messages */}
      <PackageForm key={formKey} onSubmit={onSubmit} form={form} />


      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Confirm Package Details</DialogTitle>
            <DialogDescription>
              Are you sure you want to add this package?
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col my-2">

            <div className="flex flex-col gap-1 border-t py-2">
              <p className="text-sm font-semibold">Package</p>
              <p className="text-sm">Weight: {Number(packageDetails.formData?.weight).toFixed(2)} kg</p>
              <p className="text-sm">Volume: {Number(packageDetails.formData?.volume).toFixed(2)} m<sup>3</sup></p>
              <p className="text-sm">Fragility: {packageDetails.formData?.fragile ? "Fragile" : "Not Fragile"}</p>
              <p className="text-sm">Priority: {packageDetails.formData?.priority}</p>
            </div>
            <div className="flex flex-col gap-1 border-y py-2">
              <p className="text-sm font-semibold">Recipient</p>
              <p className="text-sm">Name: {packageDetails.formData?.recipient_name}</p>
              <p className="text-sm">Address: {packageDetails.recipientGeocode?.[0]?.formatted_address ?? packageDetails.formData?.recipient_address_1}</p>
              <p className="text-sm">Lat Long: ({packageDetails.recipientGeocode?.[0]?.geometry.location.lat()}, {packageDetails.recipientGeocode?.[0]?.geometry.location.lng()})</p>
              <p className="text-sm">Phone: {packageDetails.formData?.recipient_phone}</p>
            </div>

            <div className="flex flex-col gap-1 border-b py-2">
              <p className="text-sm font-semibold">Sender</p>
              <p className="text-sm">Name: {packageDetails.formData?.sender_name}</p>
              <p className="text-sm">Address: {packageDetails.senderGeocode?.[0]?.formatted_address ?? packageDetails.formData?.sender_address_1}</p>
              <p className="text-sm">Lat Long: ({packageDetails.senderGeocode?.[0]?.geometry.location.lat()}, {packageDetails.senderGeocode?.[0]?.geometry.location.lng()})</p>
              <p className="text-sm">Phone: {packageDetails.formData?.sender_phone}</p>
            </div>


          </div>
          <DialogFooter>
            <Button variant="outline" onClick={e => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              onClick={() => {
                confirmPackage(packageDetails.formData!, packageDetails.senderGeocode!, packageDetails.recipientGeocode!);
              }}
            >
              Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
