// Builds src/lib/seed/cities.json from all-the-cities (GeoNames-derived), population >= 5000
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
const require = createRequire(import.meta.url);
const all = require("all-the-cities");
const US = {AL:"Alabama",AK:"Alaska",AZ:"Arizona",AR:"Arkansas",CA:"California",CO:"Colorado",CT:"Connecticut",DE:"Delaware",DC:"Washington, D.C.",FL:"Florida",GA:"Georgia",HI:"Hawaii",ID:"Idaho",IL:"Illinois",IN:"Indiana",IA:"Iowa",KS:"Kansas",KY:"Kentucky",LA:"Louisiana",ME:"Maine",MD:"Maryland",MA:"Massachusetts",MI:"Michigan",MN:"Minnesota",MS:"Mississippi",MO:"Missouri",MT:"Montana",NE:"Nebraska",NV:"Nevada",NH:"New Hampshire",NJ:"New Jersey",NM:"New Mexico",NY:"New York",NC:"North Carolina",ND:"North Dakota",OH:"Ohio",OK:"Oklahoma",OR:"Oregon",PA:"Pennsylvania",RI:"Rhode Island",SC:"South Carolina",SD:"South Dakota",TN:"Tennessee",TX:"Texas",UT:"Utah",VT:"Vermont",VA:"Virginia",WA:"Washington",WV:"West Virginia",WI:"Wisconsin",WY:"Wyoming",PR:"Puerto Rico"};
const CA = {"01":"Alberta","02":"British Columbia","03":"Manitoba","04":"New Brunswick","05":"Newfoundland and Labrador","07":"Nova Scotia","08":"Ontario","09":"Prince Edward Island","10":"Quebec","11":"Saskatchewan","12":"Yukon","13":"Northwest Territories","14":"Nunavut"};
const AU = {"01":"Australian Capital Territory","02":"New South Wales","03":"Northern Territory","04":"Queensland","05":"South Australia","06":"Tasmania","07":"Victoria","08":"Western Australia"};
const GB = {ENG:"England",SCT:"Scotland",WLS:"Wales",NIR:"Northern Ireland"};
const dn = new Intl.DisplayNames(["en"], { type: "region" });
const rows = [];
for (const c of all) {
  if (c.population < 5000) continue;
  let region = "";
  if (c.country === "US") region = US[c.adminCode] || "";
  else if (c.country === "CA") region = CA[c.adminCode] || "";
  else if (c.country === "AU") region = AU[c.adminCode] || "";
  else if (c.country === "GB") region = GB[c.adminCode] || "";
  let country = "";
  try { country = dn.of(c.country) || c.country; } catch { country = c.country; }
  if (country === "United States of America") country = "United States";
  rows.push([c.name, region, country, c.country, +c.loc.coordinates[1].toFixed(5), +c.loc.coordinates[0].toFixed(5), c.population]);
}
rows.sort((a, b) => b[6] - a[6]);
writeFileSync("src/lib/seed/cities.json", JSON.stringify(rows));
console.log(rows.length, "cities");
