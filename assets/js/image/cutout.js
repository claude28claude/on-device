/* ============================================================
   On Device - separating a subject from its background

   What this does, plainly: it decides which pixels are background
   by how close their colour is to the background you point at, and
   makes those pixels see-through.

   What it is NOT: it is not a neural network that understands what
   a person or a dog looks like. Those exist, they are very good,
   and they are tens of megabytes of downloaded weights. Bundling
   one would break two promises this site makes - that a first
   visit is small, and that every borrowed thing is a permissively
   licensed file whose fingerprint is published. Several of the
   good background-removal models are licensed for non-commercial
   use only, which is worse than large.

   So this works by colour, which means:

     - a plain, even background: excellent
     - a slightly uneven one, or a studio backdrop: good, with the
       tolerance nudged up
     - hair, fur, smoke, glass: it will cut through them, because
       colour cannot tell a strand of hair from the wall behind it
     - a busy background: it cannot, and the tool says so rather
       than producing a mess and calling it done

   For the cases in the middle there is a brush, so you can correct
   it by hand instead of being told it is your photograph's fault.
   ============================================================ */

import { makeCanvas, releaseCanvas } from "./ops.js";

/* ---- Colour distance ------------------------------------- */
/* Plain arithmetic on red, green and blue treats a change in blue
   as being as visible as the same change in green, which is not
   how eyes work. These weights are the usual cheap correction -
   good enough to decide "is this the same colour as that", and
   fast enough to run on every pixel of a large photograph. */
function distance(r1, g1, b1, r2, g2, b2) {
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  return Math.sqrt(2 * dr * dr + 4 * dg * dg + 3 * db * db);
}

/* The largest distance the formula above can produce, so a
   tolerance from 0 to 100 can mean something to a person. */
const MAX_DISTANCE = Math.sqrt(2 * 255 * 255 + 4 * 255 * 255 + 3 * 255 * 255);

export function toleranceToDistance(percent) {
  return (Math.max(0, Math.min(100, percent)) / 100) * MAX_DISTANCE * 0.45;
}

/* ---- Looking at the edges -------------------------------- */
/* With nothing pointed at, the background is guessed from a ring
   of pixels around the edge of the picture, on the assumption that
   the subject is not touching all four sides. The spread of those
   pixels is reported too, because a wide spread means the guess is
   poor and the visitor deserves to be told that up front. */
export function sampleEdges(imageData, { ring = 3 } = {}) {
  const { width, height, data } = imageData;
  const colours = [];

  const take = (x, y) => {
    const i = (y * width + x) * 4;
    colours.push([data[i], data[i + 1], data[i + 2]]);
  };

  const step = Math.max(1, Math.floor(Math.min(width, height) / 200));
  for (let x = 0; x < width; x += step) {
    for (let r = 0; r < ring; r++) {
      take(x, Math.min(r, height - 1));
      take(x, Math.max(height - 1 - r, 0));
    }
  }
  for (let y = 0; y < height; y += step) {
    for (let r = 0; r < ring; r++) {
      take(Math.min(r, width - 1), y);
      take(Math.max(width - 1 - r, 0), y);
    }
  }

  /* The median of each channel, which a few dark corners cannot
     drag around the way an average can. */
  const median = (index) => {
    const values = colours.map((c) => c[index]).sort((a, b) => a - b);
    return values[Math.floor(values.length / 2)] || 0;
  };
  const centre = [median(0), median(1), median(2)];

  let total = 0;
  let far = 0;
  for (const c of colours) {
    const d = distance(c[0], c[1], c[2], centre[0], centre[1], centre[2]);
    total += d;
    if (d > MAX_DISTANCE * 0.12) far++;
  }

  const averageSpread = colours.length ? total / colours.length : 0;

  return {
    colour: centre,
    /* 0 means every edge pixel is the same colour; 1 means they are
       all over the place. */
    unevenness: Math.min(1, averageSpread / (MAX_DISTANCE * 0.15)),
    busyFraction: colours.length ? far / colours.length : 0,
    sampled: colours.length
  };
}

/* An honest verdict, before anything is done, about whether this
   picture is the kind this tool can handle. */
export function assess(edges) {
  if (edges.unevenness < 0.25) {
    return {
      level: "good",
      text: "The edges of this picture are close to a single colour, which is exactly what this tool is good at."
    };
  }
  if (edges.unevenness < 0.6) {
    return {
      level: "mixed",
      text:
        "The background is not perfectly even. This will probably work, but expect to " +
        "raise the tolerance, and to tidy the result with the brush."
    };
  }
  return {
    level: "poor",
    text:
      "The edges of this picture are many different colours, so there is no single " +
      "background colour to remove. Cutting this out properly needs a tool that " +
      "understands what it is looking at, which this one does not. You can still " +
      "point at a colour and brush the rest by hand, but it will be work."
  };
}

/* ---- Building the mask ----------------------------------- */
/* The mask is one byte per pixel: 255 keep, 0 remove.

   Two ways of deciding:

   "touching" starts at the edges of the picture and spreads inwards
   through pixels that match, so a white shirt in the middle of a
   white background is kept, because the subject blocks the way.

   "anywhere" removes every matching pixel wherever it is, which is
   what you want for a logo on white, and wrong for the shirt. */
export function buildMask(imageData, {
  samples = [],
  tolerance = 12,
  mode = "touching",
  shouldStop = () => false
} = {}) {
  const { width, height, data } = imageData;
  const limit = toleranceToDistance(tolerance);
  const mask = new Uint8Array(width * height).fill(255);

  const list = samples.length ? samples : [sampleEdges(imageData).colour];

  const matches = (i) => {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    for (const s of list) {
      if (distance(r, g, b, s[0], s[1], s[2]) <= limit) return true;
    }
    return false;
  };

  if (mode === "anywhere") {
    for (let i = 0; i < width * height; i++) {
      if (matches(i)) mask[i] = 0;
    }
    return mask;
  }

  /* Spreading inwards from the edges, one horizontal run at a time.
     Doing whole runs rather than single pixels keeps the list of
     places still to visit small enough for a large photograph. */
  const seen = new Uint8Array(width * height);
  const stack = [];

  for (let x = 0; x < width; x++) {
    stack.push(x, 0);
    stack.push(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    stack.push(0, y);
    stack.push(width - 1, y);
  }

  let guard = 0;
  while (stack.length) {
    if ((++guard & 0xffff) === 0 && shouldStop()) break;

    const y = stack.pop();
    const x = stack.pop();
    let i = y * width + x;
    if (seen[i] || !matches(i)) continue;

    /* Walk left and right to the ends of this run. */
    let left = x;
    while (left > 0 && !seen[i - 1] && matches(i - 1)) { left--; i--; }
    let right = x;
    let j = y * width + x;
    while (right < width - 1 && !seen[j + 1] && matches(j + 1)) { right++; j++; }

    for (let k = left; k <= right; k++) {
      const at = y * width + k;
      seen[at] = 1;
      mask[at] = 0;
    }

    /* Anything above or below this run is worth trying next. */
    for (let k = left; k <= right; k++) {
      if (y > 0) {
        const up = (y - 1) * width + k;
        if (!seen[up] && matches(up)) stack.push(k, y - 1);
      }
      if (y < height - 1) {
        const down = (y + 1) * width + k;
        if (!seen[down] && matches(down)) stack.push(k, y + 1);
      }
    }
  }

  return mask;
}

/* ---- Tidying up ------------------------------------------ */
/* Single stray pixels, kept or removed against all their
   neighbours, are almost always wrong. This replaces each pixel
   with whatever most of its neighbours are. */
export function despeckle(mask, width, height, rounds = 1) {
  let current = mask;
  for (let round = 0; round < rounds; round++) {
    const next = new Uint8Array(current);
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const i = y * width + x;
        let keep = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            if (current[i + dy * width + dx] > 127) keep++;
          }
        }
        if (keep >= 6) next[i] = 255;
        else if (keep <= 2) next[i] = 0;
      }
    }
    current = next;
  }
  return current;
}

/* Move the edge in or out. Shrinking by a pixel or two removes the
   halo of background colour that otherwise clings to the subject. */
export function grow(mask, width, height, pixels) {
  if (!pixels) return mask;
  const shrinking = pixels < 0;
  const steps = Math.abs(Math.round(pixels));
  let current = mask;

  for (let s = 0; s < steps; s++) {
    const next = new Uint8Array(current);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        const isKeep = current[i] > 127;
        if (shrinking ? !isKeep : isKeep) continue;

        let touching = false;
        for (let dy = -1; dy <= 1 && !touching; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
            const neighbour = current[ny * width + nx] > 127;
            if (shrinking ? !neighbour : neighbour) { touching = true; break; }
          }
        }
        if (touching) next[i] = shrinking ? 0 : 255;
      }
    }
    current = next;
  }
  return current;
}

/* Soften the edge so it does not look cut out with scissors.
   A plain box blur, run twice, which is close enough to a smooth
   one and much faster. */
export function feather(mask, width, height, radius) {
  if (!radius) return mask;
  const r = Math.max(1, Math.round(radius));
  let current = Float32Array.from(mask);
  const temp = new Float32Array(current.length);

  for (let pass = 0; pass < 2; pass++) {
    /* Across */
    for (let y = 0; y < height; y++) {
      let total = 0;
      const row = y * width;
      for (let x = -r; x <= r; x++) total += current[row + Math.min(width - 1, Math.max(0, x))];
      for (let x = 0; x < width; x++) {
        temp[row + x] = total / (2 * r + 1);
        const out = row + Math.min(width - 1, Math.max(0, x - r));
        const into = row + Math.min(width - 1, Math.max(0, x + r + 1));
        total += current[into] - current[out];
      }
    }
    /* And down */
    for (let x = 0; x < width; x++) {
      let total = 0;
      for (let y = -r; y <= r; y++) total += temp[Math.min(height - 1, Math.max(0, y)) * width + x];
      for (let y = 0; y < height; y++) {
        current[y * width + x] = total / (2 * r + 1);
        const out = Math.min(height - 1, Math.max(0, y - r)) * width + x;
        const into = Math.min(height - 1, Math.max(0, y + r + 1)) * width + x;
        total += temp[into] - temp[out];
      }
    }
  }

  const out = new Uint8Array(current.length);
  for (let i = 0; i < current.length; i++) out[i] = Math.max(0, Math.min(255, Math.round(current[i])));
  return out;
}

/* ---- Painting by hand ------------------------------------ */
/* Strokes are kept as a list rather than baked into the mask, so
   changing the tolerance does not throw away corrections already
   made by hand. */
export function applyStrokes(mask, width, height, strokes) {
  if (!strokes || !strokes.length) return mask;
  const out = new Uint8Array(mask);

  for (const stroke of strokes) {
    const value = stroke.keep ? 255 : 0;
    const r = Math.max(1, stroke.radius);
    const rr = r * r;
    const minX = Math.max(0, Math.floor(stroke.x - r));
    const maxX = Math.min(width - 1, Math.ceil(stroke.x + r));
    const minY = Math.max(0, Math.floor(stroke.y - r));
    const maxY = Math.min(height - 1, Math.ceil(stroke.y + r));

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const dx = x - stroke.x;
        const dy = y - stroke.y;
        if (dx * dx + dy * dy <= rr) out[y * width + x] = value;
      }
    }
  }
  return out;
}

/* ---- Putting it together --------------------------------- */
export function cutOut(canvas, {
  samples = [],
  tolerance = 12,
  mode = "touching",
  softness = 1,
  tidy = true,
  edgeShift = -1,
  strokes = [],
  background = null,
  shouldStop = () => false
} = {}) {
  const width = canvas.width;
  const height = canvas.height;
  const ctx = canvas.getContext("2d");
  const image = ctx.getImageData(0, 0, width, height);

  let mask = buildMask(image, { samples, tolerance, mode, shouldStop });
  if (tidy) mask = despeckle(mask, width, height, 1);
  if (edgeShift) mask = grow(mask, width, height, edgeShift);
  mask = applyStrokes(mask, width, height, strokes);
  if (softness) mask = feather(mask, width, height, softness);

  /* How much was removed - worth reporting, because "it removed
     everything" and "it removed nothing" are both failures that
     look like success from the outside. */
  let removed = 0;
  for (let i = 0; i < mask.length; i++) if (mask[i] < 128) removed++;

  const out = makeCanvas(width, height);
  const outCtx = out.getContext("2d");
  const result = outCtx.createImageData(width, height);

  if (background) {
    /* Replacing rather than cutting out: blend the subject over a
       flat colour, so the soft edge blends with the new colour
       instead of with nothing. */
    const [br, bg, bb] = background;
    for (let i = 0; i < mask.length; i++) {
      const a = mask[i] / 255;
      result.data[i * 4] = Math.round(image.data[i * 4] * a + br * (1 - a));
      result.data[i * 4 + 1] = Math.round(image.data[i * 4 + 1] * a + bg * (1 - a));
      result.data[i * 4 + 2] = Math.round(image.data[i * 4 + 2] * a + bb * (1 - a));
      result.data[i * 4 + 3] = 255;
    }
  } else {
    for (let i = 0; i < mask.length; i++) {
      result.data[i * 4] = image.data[i * 4];
      result.data[i * 4 + 1] = image.data[i * 4 + 1];
      result.data[i * 4 + 2] = image.data[i * 4 + 2];
      /* The original may already have had see-through parts. */
      result.data[i * 4 + 3] = Math.min(image.data[i * 4 + 3], mask[i]);
    }
  }

  outCtx.putImageData(result, 0, 0);

  return {
    canvas: out,
    mask,
    removedFraction: mask.length ? removed / mask.length : 0
  };
}

/* An honest reading of what happened, for after the event. */
export function judgeResult(removedFraction) {
  if (removedFraction < 0.01) {
    return {
      ok: false,
      text:
        "Almost nothing was removed. The tolerance is probably too low, or the colour " +
        "being pointed at is not the background."
    };
  }
  if (removedFraction > 0.985) {
    return {
      ok: false,
      text:
        "Almost the whole picture was removed, which means the subject matched the " +
        "background colour too. Lower the tolerance, or brush the subject back in."
    };
  }
  return { ok: true, text: "" };
}

export { releaseCanvas };
