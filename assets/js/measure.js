/* ============================================================
   On Device - saying how big something is

   PDFs measure in points, 72 to the inch. People do not. Settings
   has a "Units" choice, and this is the one place that turns a
   measurement into the words for it, so that choice is honoured
   everywhere rather than in whichever tool remembered to.

   Pixels are deliberately handled differently. A photograph has no
   physical size at all - a 1600-pixel-wide picture is as big as
   whatever you print it on - so asking for a photograph's width in
   millimetres is asking a question with no answer. Where that
   happens, the pixel count is given as it is.
   ============================================================ */

import * as store from "./store.js";

export const PER_INCH = 72;          /* points in an inch */
export const MM_PER_INCH = 25.4;

export function currentUnit() {
  const chosen = store.get("defaults.units", "px");
  return ["px", "mm", "cm", "in"].includes(chosen) ? chosen : "px";
}

/* Convert a length in PDF points into the visitor's unit. Returns
   null for "px", because a point is a physical length and a pixel
   is not - see the note above. */
export function fromPoints(points, unit = currentUnit()) {
  if (unit === "mm") return (points / PER_INCH) * MM_PER_INCH;
  if (unit === "cm") return (points / PER_INCH) * (MM_PER_INCH / 10);
  if (unit === "in") return points / PER_INCH;
  return null;
}

export function unitName(unit = currentUnit(), plural = true) {
  return {
    mm: plural ? "millimetres" : "millimetre",
    cm: plural ? "centimetres" : "centimetre",
    in: plural ? "inches" : "inch",
    px: plural ? "pixels" : "pixel"
  }[unit];
}

function round(value, unit) {
  if (unit === "in") return Math.round(value * 10) / 10;
  if (unit === "cm") return Math.round(value * 10) / 10;
  return Math.round(value);
}

/* "210 by 297 millimetres", in whichever unit was chosen. A page
   has a real size, so "px" falls back to millimetres rather than
   printing a number that would mean nothing. */
export function describePageSize(widthPoints, heightPoints) {
  let unit = currentUnit();
  if (unit === "px") unit = "mm";
  const w = round(fromPoints(widthPoints, unit), unit);
  const h = round(fromPoints(heightPoints, unit), unit);
  return `${w} by ${h} ${unitName(unit)}`;
}
