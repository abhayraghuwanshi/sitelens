// GA4 runReport with at most a few requests in flight per property.
//
// Google allows about 10 concurrent Data API requests per property and answers
// the rest with a quota error. Pages fan out many reports at once (Outcomes
// alone can send 15+), so they queue here instead. The queue is per process, so
// on the hosted server it also covers several users reading the same property.

import { runReport as gaRunReport } from '../shared/sitelens/ga4.js';

export const MAX_PER_PROPERTY = 5;

const lanes = new Map(); // property id → { active, waiting: [resolve] }

const propertyKey = (propertyId) => String(propertyId || '').replace(/^properties\//, '').trim();

async function slot(pid) {
  let lane = lanes.get(pid);
  if (!lane) lanes.set(pid, (lane = { active: 0, waiting: [] }));
  // A finished request hands its slot straight to the next one in line.
  if (lane.active >= MAX_PER_PROPERTY) await new Promise((resolve) => lane.waiting.push(resolve));
  else lane.active += 1;
  return () => {
    const next = lane.waiting.shift();
    if (next) return next();
    lane.active -= 1;
    if (!lane.active) lanes.delete(pid);
  };
}

export async function runReport(args) {
  const release = await slot(propertyKey(args?.propertyId));
  try {
    return await gaRunReport(args);
  } finally {
    release();
  }
}
