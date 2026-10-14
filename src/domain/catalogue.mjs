// Invented data only. Prices cover a four-hour workshop; nothing is booked.
export const VENUES = Object.freeze([
  {
    id: 'canal-loft',
    name: 'Canal Loft',
    area: 'Waterside district',
    capacity: 40,
    price: 1200,
    projector: true,
    accessible: true,
    noise: 'moderate',
    breakoutRooms: 0,
    note: 'Flexible tables in one open room. Nearby shared lounge can be audible; no separate breakout rooms.',
  },
  {
    id: 'harbor-hall',
    name: 'Harbor Hall',
    area: 'Arts quarter',
    capacity: 60,
    price: 1550,
    projector: true,
    accessible: true,
    noise: 'moderate',
    breakoutRooms: 2,
    note: 'Two enclosed breakout rooms for parallel discussions. Main hall faces a shared foyer; some background noise.',
  },
  {
    id: 'cedar-room',
    name: 'Cedar Room',
    area: 'Library quarter',
    capacity: 36,
    price: 1350,
    projector: true,
    accessible: true,
    noise: 'low',
    breakoutRooms: 0,
    note: 'Quiet enclosed room away from the foyer. Groups share one room; no separate breakout rooms.',
  },
  {
    id: 'studio-eight',
    name: 'Studio Eight',
    area: 'Old town',
    capacity: 20,
    price: 700,
    noise: 'low',
    breakoutRooms: 0,
    projector: true,
    accessible: true,
    note: 'A compact studio for smaller, focused sessions.',
  },
  {
    id: 'garden-room',
    name: 'Garden Room',
    area: 'Park district',
    capacity: 45,
    price: 950,
    noise: 'low',
    breakoutRooms: 0,
    projector: false,
    accessible: true,
    note: 'A relaxed setting with whiteboards, but no projector.',
  },
  {
    id: 'atelier',
    name: 'The Atelier',
    area: 'Design district',
    capacity: 35,
    price: 1050,
    noise: 'moderate',
    breakoutRooms: 1,
    projector: true,
    accessible: false,
    note: 'Creative workspace on an upper floor with stairs only.',
  },
]);

export function validateBrief(input) {
  if (!input || typeof input !== 'object') throw new Error('Provide a workshop brief.');
  const title = typeof input.title === 'string' ? input.title.trim() : '';
  if (!title || title.length > 160) throw new Error('Use a workshop name of 1–160 characters.');
  if (!Number.isInteger(input.attendees) || input.attendees < 1 || input.attendees > 200)
    throw new Error('Choose between 1 and 200 attendees.');
  if (typeof input.projector !== 'boolean' || typeof input.accessible !== 'boolean')
    throw new Error('Choose the required facilities.');
  const budget = input.budget ?? null;
  if (budget !== null && (!Number.isFinite(budget) || budget < 1 || budget > 100000))
    throw new Error('Budget must be between AED 1 and AED 100,000.');
  const preferredBudget = input.preferredBudget ?? null;
  if (
    preferredBudget !== null &&
    (!Number.isFinite(preferredBudget) ||
      preferredBudget < 1 ||
      preferredBudget > 100000 ||
      (budget !== null && preferredBudget > budget))
  )
    throw new Error('Preferred budget must be positive and no higher than the hard limit.');
  const priority = input.priority ?? 'value';
  if (!['undecided', 'value', 'quiet', 'breakouts'].includes(priority))
    throw new Error('Choose a supported workshop priority.');
  const preferences = input.preferences ?? '';
  if (typeof preferences !== 'string' || preferences.length > 600)
    throw new Error('Keep workshop preferences within 600 characters.');
  return {
    title,
    attendees: input.attendees,
    budget,
    projector: input.projector,
    accessible: input.accessible,
    preferredBudget,
    priority,
    preferences: preferences.trim(),
  };
}

export function unmetRequirements(venue, brief) {
  return [
    venue.capacity < brief.attendees && 'Not enough seats',
    brief.budget !== null && venue.price > brief.budget && 'Over budget',
    brief.projector && !venue.projector && 'No projector',
    brief.accessible && !venue.accessible && 'No step-free access',
  ].filter(Boolean);
}

export function lookupVenues(brief) {
  return VENUES.map((venue) => ({
    ...venue,
    unmet: unmetRequirements(venue, brief),
    stretch: brief.preferredBudget == null ? 0 : Math.max(0, venue.price - brief.preferredBudget),
  }));
}

export function clarificationNeeded(brief, venues) {
  if (brief.budget === null) return 'budget';
  if (brief.priority === 'undecided' && venues?.filter((venue) => !venue.unmet.length).length > 1)
    return 'priority';
  return null;
}

export const PRIORITIES = {
  value: 'Keep the cost down',
  quiet: 'A quieter room',
  breakouts: 'Separate breakout rooms',
};

export function rehearsalSelection(venues, priority) {
  return venues
    .filter((venue) => !venue.unmet.length)
    .sort(
      (a, b) =>
        (priority === 'breakouts'
          ? b.breakoutRooms - a.breakoutRooms
          : priority === 'quiet'
            ? Number(b.noise === 'low') - Number(a.noise === 'low')
            : 0) || a.price - b.price,
    )[0];
}

export function validateRecommendation(result, brief) {
  const venue = VENUES.find((item) => item.id === result?.venueId);
  if (!venue || brief.budget === null || unmetRequirements(venue, brief).length)
    throw new Error('The returned venue does not meet the workshop requirements.');
  if (clarificationNeeded(brief, lookupVenues(brief)))
    throw new Error('Clarify the workshop priority before choosing between suitable venues.');
  if (typeof result.reason !== 'string' || !result.reason.trim() || result.reason.length > 2000)
    throw new Error('The specialist did not provide a valid explanation.');
  return {
    venue,
    reason: result.reason,
    alternatives: lookupVenues(brief).filter((item) => item.id !== venue.id),
    currency: 'AED',
    duration: '4 hours',
    fictional: true,
    preferredBudget: brief.preferredBudget ?? null,
    hardLimit: brief.budget,
    stretch: brief.preferredBudget == null ? 0 : Math.max(0, venue.price - brief.preferredBudget),
    priority: brief.priority ?? 'value',
  };
}
