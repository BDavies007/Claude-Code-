import { WhoopAdapter } from "./whoop";
import { GarminAdapter } from "./garmin";
import { OutlookAdapter } from "./outlook";
import { GmailAdapter } from "./gmail";

export const whoop = new WhoopAdapter();
export const garmin = new GarminAdapter();
export const outlook = new OutlookAdapter();
export const gmail = new GmailAdapter();

export const allAdapters = [whoop, garmin, outlook, gmail] as const;

export * from "./types";
