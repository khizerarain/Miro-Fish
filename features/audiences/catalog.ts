import type { IncomeBandId, RegionId } from "./constants";

export const REGION_PLACES: Record<RegionId, string[]> = {
  us_west: ["Seattle, WA", "Portland, OR", "San Francisco, CA", "Los Angeles, CA", "Denver, CO", "Phoenix, AZ"],
  us_midwest: ["Chicago, IL", "Minneapolis, MN", "Detroit, MI", "Columbus, OH", "Kansas City, MO", "Madison, WI"],
  us_south: ["Austin, TX", "Atlanta, GA", "Nashville, TN", "Miami, FL", "Charlotte, NC", "New Orleans, LA"],
  us_northeast: ["Brooklyn, NY", "Boston, MA", "Philadelphia, PA", "Pittsburgh, PA", "Providence, RI", "Buffalo, NY"],
  uk: ["Manchester, UK", "London, UK", "Edinburgh, UK", "Bristol, UK", "Leeds, UK"],
  ca: ["Toronto, ON", "Vancouver, BC", "Montreal, QC", "Calgary, AB", "Halifax, NS"],
  eu: ["Berlin, DE", "Amsterdam, NL", "Lisbon, PT", "Barcelona, ES", "Stockholm, SE"],
  au: ["Melbourne, AU", "Sydney, AU", "Brisbane, AU", "Adelaide, AU"],
  latam: ["Mexico City, MX", "Bogotá, CO", "São Paulo, BR", "Santiago, CL", "Buenos Aires, AR"],
  asia: ["Bengaluru, IN", "Singapore", "Seoul, KR", "Tokyo, JP", "Jakarta, ID"],
};

export const FIRST_NAMES = [
  "Amina", "Andre", "Priya", "Marcus", "Sofia", "Kenji", "Elena", "Jamal", "Nora", "Diego",
  "Hannah", "Omar", "Lila", "Theo", "Mei", "Chris", "Imani", "Ravi", "Claire", "Mateo",
  "Yara", "Ben", "Sana", "Owen", "Lucia", "Nate", "Aisha", "Hugo", "Greta", "Samir",
  "June", "Leo", "Farah", "Cole", "Ines", "Dev", "Ruth", "Kai", "Marta", "Jonah",
];

export const LAST_NAMES = [
  "Okoro", "Nguyen", "Patel", "Garcia", "Kowalski", "Berg", "Okafor", "Chen", "Ali", "Rossi",
  "Kim", "Santos", "Hughes", "Ibrahim", "Cohen", "Silva", "Walsh", "Nakamura", "Diaz", "Singh",
  "O'Neill", "Mbeki", "Larsson", "Costa", "Park", "Rahman", "Novak", "Brooks", "Fernandez", "Adeyemi",
];

export const PROFESSIONS = [
  "Freelance designer", "Operations lead", "High school teacher", "Registered nurse", "Software engineer",
  "Small business owner", "Accountant", "Retail manager", "Graduate student", "Marketing coordinator",
  "Electrician", "HR generalist", "Barista", "Product manager", "Social worker", "Truck driver",
  "Physical therapist", "Real estate agent", "Data analyst", "Chef", "Librarian", "Carpenter",
];

export const TRAITS = [
  "cautious", "curious", "wry", "impatient", "methodical", "warm", "skeptical", "ambitious",
  "private", "outspoken", "practical", "anxious", "loyal", "restless", "analytical", "generous",
];

export const DEFAULT_INTERESTS = [
  "cooking", "hiking", "podcasts", "football", "photography", "gardening", "board games",
  "running", "thrifts", "sci-fi", "yoga", "DIY", "live music", "personal finance",
];

export const FINANCIAL = [
  "Pays rent and a car loan; leftover money is unpredictable.",
  "Comfortable month to month, but a $400 surprise would sting.",
  "Household has a buffer and reviews subscriptions once a year.",
  "Saving for a house; every extra dollar is spoken for.",
  "Self-employed income swings with the season.",
  "Shared budget with a partner; big purchases need a conversation.",
];

export function incomeFromAge(age: number, pick: number): IncomeBandId {
  if (age < 26) return (["under_40k", "under_40k", "40_75k"] as const)[Math.floor(pick * 3)]!;
  if (age < 35) return (["40_75k", "40_75k", "75_120k", "under_40k"] as const)[Math.floor(pick * 4)]!;
  if (age < 50) return (["75_120k", "120_200k", "40_75k", "75_120k"] as const)[Math.floor(pick * 4)]!;
  return (["75_120k", "120_200k", "200k_plus", "40_75k"] as const)[Math.floor(pick * 4)]!;
}
