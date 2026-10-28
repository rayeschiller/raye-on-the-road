export type Source = "wix" | "beacons";

export type Person = {
  email: string;
  firstName: string;
  lastName: string;
  /** Resolved city center */
  city: string;
  region: string;
  country: string;
  lat: number | null;
  lon: number | null;
  /** What they actually typed (Wix form answer) or the Beacons location */
  rawLocation: string;
  /** "requested" = they asked for a show there (Wix form), "recorded" = location on file (Beacons) */
  locationKind: "requested" | "recorded" | "none";
  sources: Source[];
  wixStatus: "SUBSCRIBED" | "UNSUBSCRIBED" | "PENDING" | "NOT_SET" | "NO_SUBSCRIPTION_STATUS" | null;
  beaconsStatus: "Subscribed" | "Not on list" | null;
  /** Unsubscribed through this site */
  siteUnsubscribed: boolean;
  /** OK to email: not unsubscribed anywhere */
  emailEligible: boolean;
  createdAt: string | null;
  /** "Needs a location" reason, if any */
  needsLocation: string | null;
};

export type Campaign = {
  id: string;
  subject: string;
  body: string;
  filter: CampaignFilter;
  /** Snapshot of recipient emails at send time (or current preview for drafts) */
  recipients: string[];
  excludedEmails: string[];
  status: "draft" | "sending" | "sent" | "failed";
  createdAt: string;
  sentAt: string | null;
  sentCount: number;
  error: string | null;
};

export type CampaignFilter = {
  center: { name: string; region: string; country: string; lat: number; lon: number } | null;
  radiusMiles: number;
  includeRecorded: boolean;
  includeRequested: boolean;
};

export type Overrides = {
  /** lowercased raw answer -> resolved place */
  rawFixes: Record<string, { city: string; region: string; country: string; lat: number; lon: number }>;
  /** lowercased email -> resolved place (per-person override) */
  emailFixes: Record<string, { city: string; region: string; country: string; lat: number; lon: number }>;
  /** emails unsubscribed via this site */
  unsubscribed: string[];
  /** emails explicitly hidden/excluded by Raye */
  excluded: string[];
};

export type StoreState = {
  overrides: Overrides;
  campaigns: Campaign[];
  /** Beacons contacts (seeded from the one-time export; replaceable by CSV import) */
  beacons: BeaconsPerson[];
  /** Last successful Wix pull, used as a fallback when the API is unreachable */
  wixSnapshot: { fetchedAt: string; people: WixPerson[] } | null;
  /** One-time carry-over of "what city?" answers from the old site (email → raw answer). Live Wix answers win. */
  legacyAnswers?: Record<string, string>;
};

export type BeaconsPerson = {
  email: string;
  firstName: string;
  lastName: string;
  city: string;
  region: string;
  country: string;
  rawLocation: string;
  status: "Subscribed" | "Not on list";
  lat: number | null;
  lon: number | null;
};

export type WixPerson = {
  contactId: string;
  email: string;
  firstName: string;
  lastName: string;
  subscriptionStatus: Person["wixStatus"];
  createdAt: string | null;
  /** Raw city answer from the signup form, if any */
  cityAnswer: string;
  answeredAt: string | null;
};

export type Place = { city: string; region: string; country: string; lat: number; lon: number };
