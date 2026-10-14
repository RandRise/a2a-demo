import { VENUES } from './catalogue.mjs';

export function budgetFacts(brief, venue) {
  const difference = brief.preferredBudget === null ? null : venue.price - brief.preferredBudget;
  return {
    price: venue.price,
    preferredBudget: brief.preferredBudget,
    hardLimit: brief.budget,
    preferredRelation:
      difference === null
        ? 'not supplied'
        : difference > 0
          ? 'above'
          : difference < 0
            ? 'below'
            : 'equal',
    preferredDifference: difference === null ? null : Math.abs(difference),
    stretch: difference === null ? 0 : Math.max(0, difference),
    headroom: brief.budget - venue.price,
  };
}

// A narrow deterministic check for contradictory budget-direction claims.
// This is not a general fact checker. Skip sentences naming alternatives to
// avoid interpreting their budget comparisons as claims about the selected venue.
export function budgetExplanationIssue(text, brief, venue) {
  if (brief.preferredBudget === null) return null;
  const facts = budgetFacts(brief, venue);
  const alternatives = VENUES.filter((item) => item.id !== venue.id);
  const sentences = text.split(/(?<=[.!?;])\s+/);
  for (const sentence of sentences) {
    if (alternatives.some((item) => sentence.toLowerCase().includes(item.name.toLowerCase())))
      continue;
    const negated =
      /\b(?:no|zero|without)\s+(?:budget\s+)?(?:stretch|overspend)\b|\b(?:not|never)\s+(?:above|over)\b/i.test(
        sentence,
      );
    const above =
      !negated &&
      /\b(?:above|over|exceed\w*)\b[^.!?;]{0,100}\bpreferred\s+budget\b/i.test(sentence);
    const below = /\b(?:below|under|within)\b[^.!?;]{0,100}\bpreferred\s+budget\b/i.test(sentence);
    const positiveStretch =
      !/\b(?:no|zero|without|not|doesn't|does not)\b/i.test(sentence) &&
      /\b(?:budget stretch|stretch (?:above|beyond) (?:the |your )?preferred budget)\b/i.test(
        sentence,
      );
    if ((facts.stretch === 0 && (above || positiveStretch)) || (facts.stretch > 0 && below)) {
      return `Correct the budget explanation: ${venue.name} costs AED ${facts.price}, which is ${facts.preferredRelation} the AED ${facts.preferredBudget} preferred budget by AED ${facts.preferredDifference}. The stretch is AED ${facts.stretch}; hard-limit headroom is AED ${facts.headroom}. Re-evaluate the explanation using these calculated facts.`;
    }
  }
  return null;
}
