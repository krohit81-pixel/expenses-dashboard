/**
 * Static calendar data for now, not stored in Supabase: there's no
 * calendar/events table in the schema, and building one wasn't asked for
 * yet. Ahaana's data sourced from Chatrabhuj Narsee School's official AY
 * 2026-27 calendar PDF, filtered to Grade 8 + whole-school dates (excludes
 * Early Years, Primary, and Grade 9/10/11/IBDP-only events). Rohana's data
 * sourced from NUS's official AY2026/2027 Academic Calendar PDF, page 1
 * only (per explicit instruction — page 2 is administrative deadlines and
 * MINDEF In-Camp Training schedules, not relevant here). Condensed to the
 * dates that matter for travel planning and avoiding conflicts: recess/
 * reading weeks, examination periods, vacation windows, public holidays,
 * and Special Term boundaries — not every individual instructional week.
 */

export type EventTag = "vacation" | "holiday" | "exam" | "event" | "trip";

export interface CalendarEvent {
  date: string;
  day?: string;
  title: string;
  meta?: string;
  tag: EventTag;
}

export interface MonthGroup {
  month: string;
  events: CalendarEvent[];
}

export interface TravelWindow {
  name: string;
  range: string;
  days: string;
}

export const TAG_STYLES: Record<EventTag, string> = {
  vacation: "bg-positive text-white",
  holiday: "bg-line text-ink-soft",
  exam: "bg-negative-soft text-negative",
  event: "bg-accent-soft text-accent",
  trip: "bg-accent-soft text-accent",
};

export const TAG_LABELS: Record<EventTag, string> = {
  vacation: "Vacation",
  holiday: "Holiday",
  exam: "Exam",
  event: "Event",
  trip: "Trip",
};

export const AHAANA_TRAVEL_WINDOWS: TravelWindow[] = [
  {
    name: "Diwali Vacations",
    range: "Fri 6 Nov – Tue 17 Nov 2026",
    days: "12 days",
  },
  {
    name: "Winter Vacations",
    range: "Wed 23 Dec 2026 – Sun 3 Jan 2027",
    days: "12 days",
  },
  {
    name: "Spring Break",
    range: "Mon 22 Mar – Sun 28 Mar 2027",
    days: "7 days",
  },
  {
    name: "Summer Vacation begins",
    range: "From Fri 21 May 2027",
    days: "Open-ended",
  },
];

export const AHAANA_CALENDAR: MonthGroup[] = [
  {
    month: "July 2026",
    events: [
      {
        date: "9",
        day: "Thu",
        title: "Secondary Orientation Grade 8 & uniform distribution",
        tag: "event",
      },
      { date: "13", day: "Mon", title: "School reopens", tag: "event" },
      {
        date: "31",
        day: "Fri",
        title: "Early exit, all students",
        tag: "event",
      },
    ],
  },
  {
    month: "August 2026",
    events: [
      {
        date: "1",
        day: "Sat",
        title: "CNS Mumbai 10th Year Celebration",
        tag: "event",
      },
      {
        date: "15",
        day: "Sat",
        title: "Independence Day + Student Council Investiture",
        tag: "holiday",
      },
      { date: "16", day: "Sun", title: "Parsi New Year", tag: "holiday" },
      {
        date: "22",
        day: "Sat",
        title: "Meet & Greet HRTs, Grades 6–10",
        tag: "event",
      },
      { date: "26", day: "Wed", title: "Eid-E-Milad", tag: "holiday" },
      { date: "27", day: "Thu", title: "School-wide holiday", tag: "holiday" },
      {
        date: "28",
        day: "Fri",
        title: "Raksha Bandhan",
        meta: "Long weekend — Fri–Sun",
        tag: "holiday",
      },
    ],
  },
  {
    month: "September 2026",
    events: [
      {
        date: "5",
        day: "Sat",
        title: "Dahi Handi / Teacher's Day",
        tag: "holiday",
      },
      {
        date: "11",
        day: "Fri",
        title: "Grandparents Day (whole school)",
        tag: "event",
      },
      { date: "14", day: "Mon", title: "Ganesh Chaturthi", tag: "holiday" },
      { date: "18", day: "Fri", title: "Gauri Pooja", tag: "holiday" },
      { date: "19", day: "Sat", title: "Gauri Visarjan", tag: "holiday" },
      { date: "25", day: "Fri", title: "Anant Chaturdashi", tag: "holiday" },
      {
        date: "30",
        day: "Wed",
        title: "Educational Trip, Grades 6–8",
        meta: "Through 4 Oct",
        tag: "trip",
      },
    ],
  },
  {
    month: "October 2026",
    events: [
      {
        date: "2",
        day: "Fri",
        title: "Mahatma Gandhi Jayanti",
        tag: "holiday",
      },
      {
        date: "9",
        day: "Fri",
        title: "Gr 8 Subject Choice presentation (for Gr 9)",
        tag: "event",
      },
      {
        date: "19",
        day: "Mon",
        title: "1st Summative Assessments, Grades 1–8",
        meta: "Through 3 Nov — avoid travel",
        tag: "exam",
      },
      { date: "20", day: "Tue", title: "Dusshera", tag: "holiday" },
    ],
  },
  {
    month: "November 2026",
    events: [
      {
        date: "4",
        day: "Wed",
        title: "Gr 8 Subject Choice form due",
        tag: "event",
      },
      {
        date: "5",
        day: "Thu",
        title: "Children's Day Celebration, picnic",
        tag: "event",
      },
      {
        date: "6–17",
        title: "Diwali Vacations",
        meta: "Fri – Tue · 12 days",
        tag: "vacation",
      },
      { date: "18", day: "Wed", title: "School reopens", tag: "event" },
      { date: "24", day: "Tue", title: "Guru Nanak Jayanti", tag: "holiday" },
    ],
  },
  {
    month: "December 2026",
    events: [
      {
        date: "5",
        day: "Sat",
        title: "Shree Chatrabhuj Narsee Jayanti · PTM Grades 7 & 8",
        tag: "event",
      },
      { date: "19", day: "Sat", title: "Secondary Sports Day", tag: "event" },
      {
        date: "22",
        day: "Tue",
        title: "Secondary Christmas Celebrations, Grades 6–10",
        tag: "event",
      },
      {
        date: "23–3",
        title: "Winter Vacations",
        meta: "Wed 23 Dec – Sun 3 Jan · 12 days",
        tag: "vacation",
      },
    ],
  },
  {
    month: "January 2027",
    events: [
      { date: "4", day: "Mon", title: "School reopens", tag: "event" },
      {
        date: "5",
        day: "Tue",
        title: "Secondary Class Photo, Grades 6–10",
        meta: "Through 7 Jan",
        tag: "event",
      },
      {
        date: "9",
        day: "Sat",
        title: "PTA Fiesta & Innovation Exhibition",
        tag: "event",
      },
      { date: "15", day: "Fri", title: "Makar Sankranti", tag: "holiday" },
      {
        date: "23",
        day: "Sat",
        title: "Quintessence V @ Mumbai",
        meta: "Through 25 Jan",
        tag: "event",
      },
      { date: "26", day: "Tue", title: "Republic Day (NID)", tag: "holiday" },
    ],
  },
  {
    month: "February 2027",
    events: [
      {
        date: "5",
        day: "Fri",
        title: "Competency Test, Additional Math — Grade 8",
        tag: "exam",
      },
      { date: "19", day: "Fri", title: "Shivaji Jayanti", tag: "holiday" },
      {
        date: "22",
        day: "Mon",
        title: "2nd Term Summative Assessment, Grade 8",
        meta: "Through 11 Mar — avoid travel",
        tag: "exam",
      },
      {
        date: "25",
        day: "Thu",
        title: "Cambridge Lower Secondary Checkpoint",
        tag: "exam",
      },
    ],
  },
  {
    month: "March 2027",
    events: [
      {
        date: "2",
        day: "Tue",
        title: "Cambridge Lower Secondary Checkpoint",
        tag: "exam",
      },
      {
        date: "4",
        day: "Thu",
        title: "Cambridge Lower Secondary Checkpoint",
        tag: "exam",
      },
      { date: "6", day: "Sat", title: "Mahashivratri", tag: "holiday" },
      { date: "10", day: "Wed", title: "Eid-ul-Fitar", tag: "holiday" },
      {
        date: "14",
        day: "Sun",
        title: "Shree Narsee Monjee Birth Anniversary",
        tag: "event",
      },
      { date: "21", day: "Sun", title: "Navroze", tag: "holiday" },
      { date: "22", day: "Mon", title: "Holi", tag: "holiday" },
      {
        date: "22–28",
        title: "Spring Break",
        meta: "Mon – Sun · 7 days · overlaps Holi",
        tag: "vacation",
      },
      { date: "26", day: "Fri", title: "Good Friday", tag: "holiday" },
      { date: "28", day: "Sun", title: "Easter Sunday", tag: "holiday" },
      { date: "29", day: "Mon", title: "School reopens", tag: "event" },
    ],
  },
  {
    month: "April 2027",
    events: [
      { date: "7", day: "Wed", title: "Gudipadwa", tag: "holiday" },
      { date: "14", day: "Wed", title: "Dr. Ambedkar Jayanti", tag: "holiday" },
    ],
  },
  {
    month: "May 2027",
    events: [
      { date: "1", day: "Sat", title: "Maharashtra Day", tag: "holiday" },
      {
        date: "5",
        day: "Wed",
        title: "Melange dress rehearsal, Grades 8 & 9",
        tag: "event",
      },
      { date: "8", day: "Sat", title: "Melange, Grades 8–9", tag: "event" },
      { date: "17", day: "Mon", title: "Eid-al-Adha", tag: "holiday" },
      {
        date: "18",
        day: "Tue",
        title: "School team tryouts",
        meta: "Through 21 May",
        tag: "event",
      },
      {
        date: "21",
        title: "Last day of school · Summer Vacation begins",
        meta: "Grades 1–11",
        tag: "vacation",
      },
    ],
  },
];

export const ROHANA_TRAVEL_WINDOWS: TravelWindow[] = [
  {
    name: "Recess Week (Sem 1)",
    range: "Sat 19 Sep – Sun 27 Sep 2026",
    days: "9 days",
  },
  {
    name: "Semester break",
    range: "Sun 6 Dec 2026 – Sun 10 Jan 2027",
    days: "5 weeks",
  },
  {
    name: "Recess Week (Sem 2)",
    range: "Sat 20 Feb – Sun 28 Feb 2027",
    days: "9 days",
  },
  {
    name: "Summer vacation begins",
    range: "From Sun 9 May 2027",
    days: "12 weeks (Special Term optional, see notes)",
  },
];

export const ROHANA_CALENDAR: MonthGroup[] = [
  {
    month: "August 2026",
    events: [
      {
        date: "3–8",
        title: "Orientation",
        meta: "Mon – Sat",
        tag: "event",
      },
      {
        date: "9",
        day: "Sun",
        title: "National Day",
        meta: "Observed Mon 10 Aug",
        tag: "holiday",
      },
      {
        date: "10",
        day: "Mon",
        title: "Semester 1 instruction begins",
        meta: "Weeks 1–6, through 18 Sep",
        tag: "event",
      },
    ],
  },
  {
    month: "September 2026",
    events: [
      {
        date: "19–27",
        title: "Recess Week",
        meta: "Sat – Sun · 9 days",
        tag: "vacation",
      },
      {
        date: "28",
        day: "Mon",
        title: "Week 7 / Examination",
        meta: "Through 3 Oct — avoid travel",
        tag: "exam",
      },
    ],
  },
  {
    month: "October 2026",
    events: [
      {
        date: "5",
        day: "Mon",
        title: "Mini Sem 1B instruction begins",
        meta: "Weeks 8–13, through 13 Nov",
        tag: "event",
      },
      {
        date: "9",
        day: "Fri",
        title: "NUS Well-Being Day",
        tag: "holiday",
      },
    ],
  },
  {
    month: "November 2026",
    events: [
      {
        date: "8",
        day: "Sun",
        title: "Deepavali",
        meta: "Observed Mon 9 Nov",
        tag: "holiday",
      },
      {
        date: "14–20",
        title: "Reading Week",
        meta: "Sat – Fri — exam prep, avoid travel",
        tag: "exam",
      },
      {
        date: "21",
        day: "Sat",
        title: "Examination period begins",
        meta: "Through 5 Dec — avoid travel",
        tag: "exam",
      },
    ],
  },
  {
    month: "December 2026",
    events: [
      {
        date: "6–31",
        title: "Semester break",
        meta: "Continues into January · 5 weeks total",
        tag: "vacation",
      },
      {
        date: "25",
        day: "Fri",
        title: "Christmas Day",
        tag: "holiday",
      },
    ],
  },
  {
    month: "January 2027",
    events: [
      {
        date: "1",
        day: "Fri",
        title: "New Year's Day",
        tag: "holiday",
      },
      {
        date: "1–10",
        title: "Semester break continues",
        meta: "Ends Sun 10 Jan",
        tag: "vacation",
      },
      {
        date: "11",
        day: "Mon",
        title: "Semester 2 instruction begins",
        meta: "Weeks 1–6, through 19 Feb",
        tag: "event",
      },
    ],
  },
  {
    month: "February 2027",
    events: [
      {
        date: "20–28",
        title: "Recess Week",
        meta: "Sat – Sun · 9 days",
        tag: "vacation",
      },
    ],
  },
  {
    month: "March 2027",
    events: [
      {
        date: "1",
        day: "Mon",
        title: "Week 7 / Examination",
        meta: "Through 6 Mar — avoid travel",
        tag: "exam",
      },
      {
        date: "8",
        day: "Mon",
        title: "Mini Sem 2B instruction begins",
        meta: "Weeks 8–13, through 16 Apr",
        tag: "event",
      },
    ],
  },
  {
    month: "April 2027",
    events: [
      {
        date: "17–23",
        title: "Reading Week",
        meta: "Sat – Fri — exam prep, avoid travel",
        tag: "exam",
      },
      {
        date: "24",
        day: "Sat",
        title: "Examination period begins",
        meta: "Through 8 May — avoid travel",
        tag: "exam",
      },
    ],
  },
  {
    month: "May 2027",
    events: [
      {
        date: "1",
        day: "Sat",
        title: "Labour Day",
        tag: "holiday",
      },
      {
        date: "9",
        day: "Sun",
        title: "Vacation begins",
        meta: "12 weeks, through 1 Aug — see Special Term note below",
        tag: "vacation",
      },
      {
        date: "10",
        day: "Mon",
        title: "Special Term Part 1 (optional)",
        meta: "Through 19 Jun — only if enrolled",
        tag: "event",
      },
    ],
  },
  {
    month: "June 2027",
    events: [
      {
        date: "21",
        day: "Mon",
        title: "Special Term Part 2 (optional)",
        meta: "Through 31 Jul — only if enrolled",
        tag: "event",
      },
    ],
  },
];

/**
 * Chinese New Year, Good Friday, Vesak Day, and Hari Raya Puasa are all
 * marked "to be confirmed" in NUS's own AY2026/2027 calendar (page 1) —
 * genuinely not dated yet, not an omission here. Re-check NUS's calendar
 * closer to the date once they're confirmed.
 */
export const ROHANA_TBC_HOLIDAYS = [
  "Chinese New Year",
  "Good Friday",
  "Vesak Day",
  "Hari Raya Puasa",
];
