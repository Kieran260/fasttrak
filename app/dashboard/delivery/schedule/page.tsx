'use client'

import { useEffect, useState } from "react";
import { columns } from "./components/columns"
import { DataTable } from "./components/data-table"
import { Package } from "@/types/package";
import { DeliverySchedule } from "@/types/delivery-schedule";
import { supabase } from "@/pages/api/supabase-client";
import { fetchSchedulesByDate } from "@/lib/db/delivery-schedules";

import { format } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { HiOutlineCog } from "react-icons/hi";

import { SchedulePackages } from "@/lib/scheduling/algorithm-1";
import { fetchVehicles } from "@/lib/db/vehicles";
import { fetchPackages } from "@/lib/db/packages";
import { UUID } from "crypto";

export default function ScheduleDeliveries() {

  // Date Picker
  const [date, setDate] = useState<Date>(new Date());

  const isDateWithinLimit = (newDate: Date) => {
    const tomorrow = new Date();
    tomorrow.setDate(new Date().getDate() + 1);
    return newDate <= tomorrow;
  };

  const isNextDateValid = () => {
    if (date) {
      const nextDate = new Date(date);
      nextDate.setDate(date.getDate() + 1);
      return isDateWithinLimit(nextDate);
    }
    return true;
  };

  useEffect(() => {
    setDate(new Date())
    // TODO: Check if there are any schedules for today
    // TODO: If there are, set isScheduledToday to true
    // TODO: If there aren't, set isScheduledToday to false
  }, [])

  // Data
  const [data, setData] = useState<DeliverySchedule[]>([]);
  const [reload, setReload] = useState(false);
  const [isScheduledToday, setIsScheduledToday] = useState(false);

  useEffect(() => {
    async function fetchData() {
      // Fetch delivery schedules
      // TODO: Testing for different setups of schedules
      // TODO: Loading screens when fetching data

      let schedules = await fetchSchedulesByDate(date);

      if (schedules) {
        setData(schedules as DeliverySchedule[]);
        setIsScheduledToday(true);
        console.log("schedules" + schedules);
      } else {
        console.log("no schedules")
        setIsScheduledToday(false);
      }
    }
    fetchData();
  }, [reload, date]);

  const refreshData = () => setReload(prev => !prev);

  // Schedule
  async function handleScheduleDelivery() {
    // fetch vehicles
    let vehicles = await fetchVehicles();
    console.log(vehicles)

    // fetch packages
    let packages = await fetchPackages();
    console.log(packages)

    let deliverySchedule: DeliverySchedule[] = [];

    // schedule packages
    if (vehicles && packages) {
      deliverySchedule = SchedulePackages(vehicles, packages);
      console.log(deliverySchedule)
    }

    if (deliverySchedule && deliverySchedule.length > 0) {



      for (const schedule in deliverySchedule) {
        let packageOrderIds = [];

        for (const pkg in deliverySchedule[schedule].package_order) {
          packageOrderIds.push(deliverySchedule[schedule].package_order[pkg].package_id)
        }

        // update scheduledPackageIds status to scheduled
        const { error } = await supabase
          .from('packages')
          .update({ status: 'Scheduled' })
          .in('package_id', packageOrderIds)
        if (error) {
          alert(error.message)
        } else {
          // upload insert to supabase for schedule
          console.log("updated packages")
          const { error } = await supabase
            .from('delivery_schedules')
            .insert({
              vehicle_id: deliverySchedule[schedule].vehicle_id,
              package_order: packageOrderIds,
              delivery_date: deliverySchedule[schedule].delivery_date,
              start_time: deliverySchedule[schedule].start_time,
              status: deliverySchedule[schedule].status,
              num_packages: deliverySchedule[schedule].num_packages,
              estimated_duration_mins: deliverySchedule[schedule].estimated_duration_mins,
              distance_miles: deliverySchedule[schedule].distance_miles,
              load_weight: deliverySchedule[schedule].load_weight,
              load_volume: deliverySchedule[schedule].load_volume,
            })

          if (error) {
            alert(error.message)
          }
        }
      }
    }
    refreshData();

  }



  return (
    <div className="flex flex-col w-full justify-start gap-2 mx-auto p-4 max-w-[1500px]">
      <div className="inline-flex justify-between">
        <h1 className="text-foreground font-bold text-3xl my-auto">Schedule</h1>
      </div>


      <div className="flex items-center justify-between py-4">
        <div className="inline-flex justify-between w-full">
          <div className="inline-flex justify-between gap-1">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn(
                    "w-[200px] justify-start text-left font-normal",
                    !date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(selectedDate) => {
                    if (selectedDate instanceof Date) {
                      setDate(selectedDate);
                    }
                  }}
                  disabled={(date) =>
                    // Disable dates in the past and more than 1 day in the future
                    date > new Date((new Date()).valueOf() + 1000 * 3600 * 24) || date < new Date("1900-01-01")
                  }
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            <div className="inline-flex justify-between gap-1">
              <Button
                className="w-10 h-10 p-0"
                variant="outline"
                onClick={e => {
                  const newDate = new Date(date || new Date());
                  newDate.setDate(newDate.getDate() - 1);
                  setDate(newDate);
                }}
              >
                <ChevronLeft size={16} />
              </Button>
              <Button variant="outline" onClick={e => setDate(new Date())}>
                Today
              </Button>
              <Button
                className="w-10 h-10 p-0"
                variant="outline"
                disabled={!isNextDateValid()}
                onClick={e => {
                  if (date) {
                    const newDate = new Date(date);
                    newDate.setDate(date.getDate() + 1);
                    if (isDateWithinLimit(newDate)) {
                      setDate(newDate);
                    }
                  }
                }}
              >
                <ChevronRight size={16} />
              </Button>

            </div>
          </div>

          <div>Log</div>
          <div>Export</div>
          <div>Info</div>
          <div className="inline-flex">
            <Button className="w-10 p-0 rounded-r-none border-r-0" variant="outline">
              <HiOutlineCog size={16} />
            </Button>
            <Button className="rounded-l-none border-l-none border-y border-r"
              disabled={date < new Date((new Date()).valueOf() - 1000 * 3600 * 24) || date < new Date("1900-01-01") && isScheduledToday == false}
              onClick={e => handleScheduleDelivery()}
            >
              Schedule
            </Button>
          </div>
        </div>
      </div>

      <DataTable columns={columns(refreshData)} data={data} />


    </div>
  )
}
