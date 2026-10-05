// School bus routes across Gurugram. Live position is simulated from the clock.

export type Stop = { name: string; am: string; pm: string };

export type Route = {
  id: string;
  name: string;
  bus: string;
  capacity: number;
  driver: string;
  driverPhone: string;
  attendant: string;
  localities: string[];
  stops: Stop[];
};

export const ROUTES: Route[] = [
  {
    id: "R1", name: "Golf Course Road", bus: "HR 26 FD 4521", capacity: 52,
    driver: "Ramesh Kumar", driverPhone: "+91 98110 42716", attendant: "Sunita Devi",
    localities: ["Golf Course Road", "DLF Phase 5"],
    stops: [
      { name: "DLF Phase 5 · Galleria", am: "06:52", pm: "14:58" },
      { name: "The Aralias gate", am: "07:00", pm: "14:50" },
      { name: "Sector 42 · Paras Hospital", am: "07:08", pm: "14:42" },
      { name: "Sector 53 metro", am: "07:17", pm: "14:33" },
      { name: "Sector 54 · Sun City", am: "07:26", pm: "14:24" },
      { name: "School", am: "07:40", pm: "14:15" },
    ],
  },
  {
    id: "R2", name: "Sohna Road", bus: "HR 26 EK 1180", capacity: 52,
    driver: "Satpal Yadav", driverPhone: "+91 98111 20934", attendant: "Kamlesh",
    localities: ["Sohna Road", "Malibu Towne"],
    stops: [
      { name: "Vatika City", am: "06:48", pm: "15:02" },
      { name: "Omaxe Celebration Mall", am: "06:56", pm: "14:54" },
      { name: "Malibu Towne", am: "07:05", pm: "14:45" },
      { name: "Subhash Chowk", am: "07:14", pm: "14:36" },
      { name: "Sector 47 market", am: "07:22", pm: "14:28" },
      { name: "School", am: "07:40", pm: "14:15" },
    ],
  },
  {
    id: "R3", name: "Nirvana Country", bus: "HR 26 DQ 7704", capacity: 40,
    driver: "Mahender Singh", driverPhone: "+91 99100 58212", attendant: "Rekha",
    localities: ["Nirvana Country", "South City II"],
    stops: [
      { name: "Nirvana Country · Main gate", am: "06:58", pm: "14:56" },
      { name: "Nirvana · Birch Court", am: "07:04", pm: "14:50" },
      { name: "South City II · Block G", am: "07:12", pm: "14:42" },
      { name: "South City II · Market", am: "07:19", pm: "14:35" },
      { name: "Sector 49", am: "07:27", pm: "14:27" },
      { name: "School", am: "07:40", pm: "14:15" },
    ],
  },
  {
    id: "R4", name: "Sushant Lok", bus: "HR 26 EV 3312", capacity: 40,
    driver: "Jagdish Prasad", driverPhone: "+91 98712 66450", attendant: "Pushpa",
    localities: ["Sushant Lok 1", "DLF Phase 2"],
    stops: [
      { name: "MG Road metro", am: "06:45", pm: "15:05" },
      { name: "DLF Phase 2 · Cyber Hub", am: "06:53", pm: "14:57" },
      { name: "Sushant Lok 1 · Block C", am: "07:03", pm: "14:47" },
      { name: "Sushant Lok · Galleria", am: "07:11", pm: "14:39" },
      { name: "Sector 43", am: "07:21", pm: "14:29" },
      { name: "School", am: "07:40", pm: "14:15" },
    ],
  },
  {
    id: "R5", name: "Sector 56–57 loop", bus: "HR 26 FA 0921", capacity: 40,
    driver: "Bijender", driverPhone: "+91 98995 21007", attendant: "Geeta",
    localities: ["Sector 56", "Sector 57"],
    stops: [
      { name: "Sector 56 · HUDA market", am: "07:10", pm: "14:40" },
      { name: "Sector 56 · Hamilton Court", am: "07:16", pm: "14:34" },
      { name: "Sector 57 · Block F", am: "07:23", pm: "14:27" },
      { name: "Sector 57 · Rail Vihar", am: "07:30", pm: "14:21" },
      { name: "School", am: "07:40", pm: "14:15" },
    ],
  },
  {
    id: "R6", name: "Golf Course Extension", bus: "HR 26 EY 5520", capacity: 52,
    driver: "Naresh Chand", driverPhone: "+91 98914 33178", attendant: "Manju",
    localities: ["Sector 65", "Sector 67"],
    stops: [
      { name: "Sector 65 · M3M Golf Estate", am: "06:55", pm: "14:55" },
      { name: "Sector 66 · Ireo Uptown", am: "07:03", pm: "14:47" },
      { name: "Sector 67 · Ireo Victory Valley", am: "07:11", pm: "14:39" },
      { name: "Badshahpur chowk", am: "07:20", pm: "14:30" },
      { name: "Sector 58", am: "07:29", pm: "14:22" },
      { name: "School", am: "07:40", pm: "14:15" },
    ],
  },
  {
    id: "R7", name: "Palam Vihar", bus: "HR 26 DT 8836", capacity: 52,
    driver: "Om Prakash", driverPhone: "+91 99716 40382", attendant: "Savita",
    localities: ["Palam Vihar", "Ardee City"],
    stops: [
      { name: "Palam Vihar · Block C", am: "06:35", pm: "15:15" },
      { name: "Palam Vihar · Ansal Plaza", am: "06:43", pm: "15:07" },
      { name: "Ardee City", am: "07:00", pm: "14:50" },
      { name: "Sector 52", am: "07:15", pm: "14:35" },
      { name: "Sector 54 · Chowk", am: "07:26", pm: "14:24" },
      { name: "School", am: "07:40", pm: "14:15" },
    ],
  },
  {
    id: "R8", name: "New Gurugram", bus: "HR 26 FB 2047", capacity: 40,
    driver: "Sukhbir", driverPhone: "+91 98731 77251", attendant: "Kiran",
    localities: ["Sector 82", "Sector 54"],
    stops: [
      { name: "Sector 82 · Vatika India Next", am: "06:40", pm: "15:10" },
      { name: "Sector 83 · Raheja Atharva", am: "06:48", pm: "15:02" },
      { name: "NH-48 · Kherki Daula", am: "06:58", pm: "14:52" },
      { name: "Sector 54 · Arcadia", am: "07:24", pm: "14:26" },
      { name: "School", am: "07:40", pm: "14:15" },
    ],
  },
];

export const ROUTE_BY_ID = Object.fromEntries(ROUTES.map((r) => [r.id, r])) as Record<string, Route>;

export function routeForLocality(locality: string): Route | undefined {
  return ROUTES.find((r) => r.localities.includes(locality));
}

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

export type BusStatus = {
  phase: "parked" | "morning" | "afternoon" | "done";
  /** index of the last stop passed (or -1 before first) */
  lastStop: number;
  /** 0..1 progress between lastStop and next */
  t: number;
  /** minutes late (simulated) */
  delay: number;
  label: string;
};

/** Simulated live status for a route at a given time of day. */
export function busStatus(route: Route, now: Date): BusStatus {
  const mins = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
  // a little route-specific delay that changes every ~20 minutes
  const delay = Math.max(0, (Number(route.id.slice(1)) * 7 + Math.floor(mins / 20)) % 9 - 4);
  const run = (times: number[]) => {
    const tt = times.map((x) => x + delay);
    if (mins < tt[0]) return null;
    for (let i = 0; i < tt.length - 1; i++) {
      if (mins < tt[i + 1]) return { lastStop: i, t: (mins - tt[i]) / (tt[i + 1] - tt[i]) };
    }
    return { lastStop: tt.length - 1, t: 0 };
  };
  const day = now.getDay();
  if (day === 0 || day === 6) return { phase: "parked", lastStop: -1, t: 0, delay: 0, label: "No service today" };

  const am = run(route.stops.map((s) => toMin(s.am)));
  const amEnd = toMin(route.stops[route.stops.length - 1].am) + delay;
  if (am && mins <= amEnd) {
    return { phase: "morning", ...am, delay, label: delay > 2 ? `Running ${delay} min late` : "On time" };
  }
  // afternoon run goes school → first stop, so reverse stop order
  const pmStops = [...route.stops].reverse();
  const pm = run(pmStops.map((s) => toMin(s.pm)));
  const pmEnd = toMin(pmStops[pmStops.length - 1].pm) + delay;
  if (pm && mins <= pmEnd) {
    return { phase: "afternoon", ...pm, delay, label: delay > 2 ? `Running ${delay} min late` : "On time" };
  }
  if (mins > pmEnd) return { phase: "done", lastStop: -1, t: 0, delay: 0, label: "All drops completed" };
  if (mins > amEnd) return { phase: "parked", lastStop: -1, t: 0, delay: 0, label: "Parked at school" };
  return { phase: "parked", lastStop: -1, t: 0, delay: 0, label: "Departs " + route.stops[0].am };
}
