'use client'

import { SetStateAction, useEffect, useState } from "react";
import { columns } from "./components/columns"
import { DataTable } from "./components/data-table"
import { Package } from "@/types/package";
import { DeliverySchedule, DeliveryStatus } from "@/types/delivery-schedule";
import { supabase } from "@/pages/api/supabase-client";

import { format } from "date-fns"
import { Calendar as CalendarIcon, Loader2 } from "lucide-react"
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

import { createSchedules } from "@/lib/routing/create-schedules";
import { createGraphAndSolutionFromScheduleArray } from "@/lib/routing/schedules-to-graph";

import { db } from "@/lib/db/db";
import { displayGraph } from "@/lib/cytoscape-data";
import { CytoscapeGraph } from "@/components/CytoscapeGraph";
import { MdRefresh } from "react-icons/md"
import { useRouter, useSearchParams } from "next/navigation";


export default function ScheduleDeliveries() {
  // Date Handling
  const [date, setDate] = useState<Date | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams()

  useEffect(() => {
    // Check if a valid date is in the URL
    const dateString = searchParams?.get('date');
    
    // Check if dateString is a valid date
    if (dateString && dateString.length === 8) {
      const day = dateString.slice(0, 2);
      const month = dateString.slice(2, 4);
      const year = dateString.slice(4, 8);

      // Construct date object 
      const newDate = new Date(`${year}-${month}-${day}`)
      
      // Check newDate is a valid date
      if (isNaN(newDate.valueOf())) {
        handleDateChange(new Date()); 
        return;
      }
      handleDateChange(newDate);
    } else {
      handleDateChange(new Date()); 
    }
  }, [searchParams]);

  const handleDateChange = (selectedDate: number | SetStateAction<Date>) => {
    if (selectedDate instanceof Date) {
      setDate(selectedDate);
      console.log("date set:", selectedDate)

      // Format the date to 'ddMMyyyy'
      const formattedDate = format(selectedDate, 'ddMMyyyy');
      // Update the URL
      router.push(`schedule/?date=${formattedDate}`);
    } else {
      // Set date to today
      const today = new Date();
      setDate(today);

      // Format date to 'ddMMyyyy'
      const formattedDate = format(today, 'ddMMyyyy');
      // Update the URL
      router.push(`schedule/?date=${formattedDate}`);
    }
  };


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



  // Data
  const [deliverySchedules, setDeliverySchedules] = useState<DeliverySchedule[]>([]);
  const [reload, setReload] = useState(false);
  const [isScheduledToday, setIsScheduledToday] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);
  const [graph, setGraph] = useState<any>(null);
  const [solution, setSolution] = useState<any>(null);

  // Schedule progress states
  const [inProgress, setInProgress] = useState(false);
  const [scheduleComplete, setScheduleComplete] = useState(false);

  useEffect(() => {
    async function fetchData() {
      if (!date) return; // Return early if date is null

      setIsLoading(true); // Set loading to true when starting to fetch data
      setInProgress(false); // Set default to true
      setScheduleComplete(true); // Set default to true

      let schedules = await db.schedules.fetch.byDate(date);

      if (schedules && schedules.length > 0) {
        setDeliverySchedules(schedules as DeliverySchedule[]);
        // sort data by route number
        schedules.sort((a, b) => a.route_number - b.route_number);
        setIsScheduledToday(true);

        // Check schedule status
        schedules.forEach(schedule => {
          // Check if any schedule is in progress
          if (schedule.status !== DeliveryStatus.Scheduled) {
            setInProgress(true);
          }

          // Check all schedules for completion
          // Default is set to true, if any schedule is not completed, set to false
          if (schedule.status !== DeliveryStatus.Completed) {
            setScheduleComplete(false);
          }
        });
        
        buildGraph(schedules)

      } else {
        setDeliverySchedules([]);
        setIsScheduledToday(false);
      }
      setIsLoading(false); // Set loading to false after fetching data
    }

    fetchData();
  }, [reload, date]);

  // Generate graph once data is loaded
  useEffect(() => {
    if (graph && solution) {
      displayGraph(graph, solution);
    }
  }, [graph, solution])

  const refreshData = () => setReload(prev => !prev);

  async function buildGraph(schedules: DeliverySchedule[]) {
    // Create graph and solution
    const [graph, solution] = await createGraphAndSolutionFromScheduleArray(schedules as DeliverySchedule[]);
    setGraph(graph);
    setSolution(solution);
  }

  // Schedule
  async function handleScheduleDelivery() {
    if (!date) return; // Return early if date is null
    setIsLoading(true);
    setIsScheduling(true);

    // fetch vehicles
    let vehicles = await db.vehicles.fetch.all();
    console.log(vehicles)

    // fetch packages
    let packages = await db.packages.fetch.pending();
    console.log(packages)

    let deliverySchedule: DeliverySchedule[] = [];
    console.log("Scheduling for date:", date)
    // schedule packages
    if (vehicles && packages) {
      deliverySchedule = await createSchedules(vehicles, packages, date);
      console.log(deliverySchedule)
    }

    if (deliverySchedule && deliverySchedule.length > 0) {
      for (const schedule in deliverySchedule) {
        let packageOrderIds = [];

        for (const pkg in deliverySchedule[schedule].package_order) {
          if (deliverySchedule[schedule].package_order[pkg]) {
            packageOrderIds.push(deliverySchedule[schedule].package_order[pkg].package_id)
          }
        }

        const store = await db.stores.fetch.store.forUser();
        if (!store) {
          console.error("User not atatched to store");
          return [] as DeliverySchedule[];
        }

        // Try upload schedules to database
        const { error } = await supabase
          .from('delivery_schedules')
          .insert({
            vehicle_id: deliverySchedule[schedule].vehicle_id,
            store_id: store.store_id,
            package_order: packageOrderIds,
            delivery_date: deliverySchedule[schedule].delivery_date,
            route_number: deliverySchedule[schedule].route_number,
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
        } else {
          // If successfully scheduled, update scheduledPackageIds status to scheduled
          const { error } = await supabase
            .from('packages')
            .update({ status: 'Scheduled' })
            .in('package_id', packageOrderIds)
          if (error) {
            alert(error.message)
          }
        }
      }
    }
    refreshData();
    setIsLoading(false);
    setIsScheduling(false);
  }

  async function handleDeleteSchedule() {
    if (deliverySchedules && deliverySchedules.length > 0) {
      for (const schedule in deliverySchedules) {
        let packageOrderIds = [];

        for (const pkg in deliverySchedules[schedule].package_order) {
          packageOrderIds.push(deliverySchedules[schedule].package_order[pkg].package_id)
        }

        // update scheduledPackageIds status to scheduled
        const { error } = await supabase
          .from('packages')
          .update({ status: 'Pending' })
          .in('package_id', packageOrderIds)
        if (error) {
          alert(error.message)
        } else {
          // delete schedule from supabase
          const { error } = await supabase
            .from('delivery_schedules')
            .delete()
            .match({ schedule_id: deliverySchedules[schedule].schedule_id })

          if (error) {
            alert(error.message)
          }
        }
      }
    }
    refreshData();
  }

  // TODO: Export schedule analysis
  function handleScheduleAnalysis() {
    console.log("Schedule Analysis")
  }

  return (
    <TooltipProvider delayDuration={100}>
      <div className="flex flex-col w-full justify-start gap-2 mx-auto p-4 max-w-[1500px]">
        <div className="inline-flex justify-between">
          <h1 className="text-foreground font-bold text-3xl my-auto">Delivery Schedule</h1>
        </div>

        <div className="flex items-center justify-between py-4">
          <div className="inline-flex justify-between w-full">
            <div className="inline-flex justify-between gap-1">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "min-w-[210px] justify-start text-left font-normal",
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
                    selected={date || new Date()}
                    onSelect={(selectedDate) => {
                      if (selectedDate instanceof Date) {
                        //setDate(selectedDate);
                        handleDateChange(selectedDate);

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
                    handleDateChange(newDate);
                  }}
                >
                  <ChevronLeft size={16} />
                </Button>
                <Button variant="outline" onClick={e => handleDateChange(new Date())}>
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
                        handleDateChange(newDate);
                      }
                    }
                  }}
                >
                  <ChevronRight size={16} />
                </Button>
              </div>
            </div>

            <div className="inline-flex justify-between gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <Button variant="outline"
                      disabled={!(scheduleComplete == true && isScheduledToday == true) || isLoading == true}
                      onClick={e => handleScheduleAnalysis()}
                    >
                      Analysis
                    </Button>
                  </div>

                </TooltipTrigger>
                <TooltipContent>
                  {scheduleComplete == true && isScheduledToday == true &&
                    <p>Export schedule analysis</p>
                  }
                  {scheduleComplete == false &&
                    <p>Deliveries must be completed first</p>
                  }
                  {isScheduledToday == false &&
                    <p>No schedule to analyse</p>
                  }
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <Button variant="outline"
                      disabled={isLoading == true || isScheduledToday == false || date! < new Date((new Date()).valueOf() - 1000 * 3600 * 24) || date! < new Date("1900-01-01") || inProgress === true}
                      onClick={e => handleDeleteSchedule()}
                    >
                      Delete
                    </Button>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  {inProgress == true &&
                    <p>Unable to delete schedule <br className="lg:hidden" />with routes in progress</p>
                  }
                  {inProgress == false && isScheduledToday == false &&
                    <p>No schedule to delete</p>
                  }
                  {inProgress == false && isScheduledToday == true &&
                    <p>Delete schedule</p>
                  }
                </TooltipContent>
              </Tooltip>

              <div className="inline-flex">
                {isScheduling == true &&
                  <Button disabled className="border">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Scheduling
                  </Button>
                }

                {isScheduling == false &&
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div>
                        <Button className="border"
                          disabled={isLoading == true || date! < new Date((new Date()).valueOf() - 1000 * 3600 * 24) || date! < new Date("1900-01-01") || isScheduledToday != false}
                          onClick={e => handleScheduleDelivery()}
                        >
                          Schedule
                        </Button>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      {isScheduledToday != false &&
                        <p>Schedule already generated</p>
                      }
                      {isScheduledToday == false && date! >= new Date((new Date()).valueOf() - 1000 * 3600 * 24) &&
                        <p>Schedule deliveries</p>
                      }
                      {isScheduledToday == false && date! < new Date((new Date()).valueOf() - 1000 * 3600 * 24) &&
                        <p>Unable to schedule delivery for past date</p>
                      }
                    </TooltipContent>
                  </Tooltip>
                }
              </div>
            </div>
          </div>
        </div>

        <DataTable columns={columns(refreshData)} data={deliverySchedules} />

        {deliverySchedules.length > 0 &&
          <div className="flex flex-col justify-between mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <div className="border-x border-t rounded-t-md inline-flex justify-between w-full items-center p-1 h-12">
                  <p className="text-muted-foreground font-medium text-sm m-2">Delivery Network</p>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" onClick={e => buildGraph(deliverySchedules)}>
                        <MdRefresh className="text-muted-foreground" size={18} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Refresh</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="border rounded-t-none rounded-md border-divider h-[450px]">
                  {graph && solution &&
                    <CytoscapeGraph graph={graph} solution={solution} />
                  }
                </div>
              </div>

              <div>
                <div className="border-x border-t rounded-t-md inline-flex justify-between w-full items-center p-1 h-12">
                  <p className="text-muted-foreground text-sm font-medium m-2">Schedule Statistics</p>
                </div>
                <div className="border rounded-t-none rounded-md border-divider h-[450px]">
                  <div className="grid grid-cols-2 p-8 gap-8 h-[450px]">
                    <div>
                      <p className="text-muted-foreground text-sm mx-2">Total Routes</p>
                      <p className="text-2xl font-semibold mx-2 my-1">
                        {deliverySchedules.length}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-sm mx-2">Total Packages</p>
                      <p className="text-2xl font-semibold mx-2 my-1">
                        {
                          deliverySchedules.reduce((acc, schedule) => {
                            return acc + schedule.num_packages
                          }, 0)
                        }</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-sm mx-2">Total Distance</p>
                      <p className="text-2xl font-semibold mx-2 my-1">
                        {
                          Math.round(deliverySchedules.reduce((acc, schedule) => {
                            return acc + schedule.distance_miles
                          }, 0) * 100) / 100
                        } miles
                      </p>
                    </div>

                    <div>
                      <p className="text-muted-foreground text-sm mx-2">Packages / Vehicle</p>
                      <p className="text-2xl font-semibold mx-2 my-1">
                        {
                          Math.round(deliverySchedules.reduce((acc, schedule) => {
                            return acc + schedule.num_packages
                          }, 0) / deliverySchedules.length * 100) / 100
                        }
                      </p>
                    </div>

                    <div>
                      <p className="text-muted-foreground text-sm mx-2">Driving Time / Vehicle</p>
                      <p className="text-2xl font-semibold mx-2 my-1">
                        {
                          Math.floor(deliverySchedules.reduce((acc, schedule) => {
                            return acc + schedule.estimated_duration_mins
                          }, 0) / deliverySchedules.length / 60)
                        }h {
                          Math.round(deliverySchedules.reduce((acc, schedule) => {
                            return acc + schedule.estimated_duration_mins
                          }, 0) / deliverySchedules.length % 60)
                        }m
                      </p>
                    </div>

                    <div>
                      <p className="text-muted-foreground text-sm mx-2">Distance / Vehicle</p>
                      <p className="text-2xl font-semibold mx-2 my-1">
                        {
                          Math.round(deliverySchedules.reduce((acc, schedule) => {
                            return acc + schedule.distance_miles
                          }, 0) / deliverySchedules.length * 100) / 100
                        } miles
                      </p>
                    </div>

                    <div>
                      <p className="text-muted-foreground text-sm mx-2">Driving Time / Package</p>
                      <p className="text-2xl font-semibold mx-2 my-1">
                        {
                          Math.floor(deliverySchedules.reduce((acc, schedule) => {
                            return acc + schedule.estimated_duration_mins
                          }, 0) / deliverySchedules.reduce((acc, schedule) => {
                            return acc + schedule.num_packages
                          }, 0) / 60)
                        }h {
                          Math.round(deliverySchedules.reduce((acc, schedule) => {
                            return acc + schedule.estimated_duration_mins
                          }, 0) / deliverySchedules.reduce((acc, schedule) => {
                            return acc + schedule.num_packages
                          }, 0) % 60)
                        }m
                      </p>
                    </div>

                    <div>
                      <p className="text-muted-foreground text-sm mx-2">Distance / Package</p>
                      <p className="text-2xl font-semibold mx-2 my-1">
                        {
                          Math.round(deliverySchedules.reduce((acc, schedule) => {
                            return acc + schedule.distance_miles
                          }, 0) / deliverySchedules.reduce((acc, schedule) => {
                            return acc + schedule.num_packages
                          }, 0) * 100) / 100
                        } miles
                      </p>
                    </div>




                  </div>
                </div>

              </div>

            </div>
          </div>
        }
      </div>
    </TooltipProvider>
  )
}
