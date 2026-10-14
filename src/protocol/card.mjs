import { A2A_PROTOCOL_VERSION } from '@a2a-js/sdk';

export function venueCard(baseUrl) {
  return {
    name: 'Venue specialist',
    description:
      'Evaluates fictional workshop venues. Can request a budget, use a catalogue tool, recommend a venue, or decline an impossible brief.',
    version: '1.1.0',
    supportedInterfaces: [
      { url: `${baseUrl}/a2a`, protocolBinding: 'JSONRPC', protocolVersion: A2A_PROTOCOL_VERSION },
    ],
    capabilities: {
      streaming: false,
      pushNotifications: false,
      extendedAgentCard: false,
      extensions: [],
    },
    defaultInputModes: ['text/plain', 'application/json'],
    defaultOutputModes: ['text/plain', 'application/json'],
    skills: [
      {
        id: 'venue-selection',
        name: 'Workshop venue selection',
        description:
          'Compare venue trade-offs within hard constraints. Application data: {brief:{title,attendees,budget,preferredBudget,priority,preferences,projector,accessible},mode:"rehearsal"|"live",reviewFeedback?:string}. budget is a hard ceiling; preferredBudget a soft target. priority is undecided|value|quiet|breakouts. Clarifications update only the requested budget or priority on the same task. Review revisions use a new task with the same context and referenceTaskIds.',
        tags: ['venues', 'workshops', 'recommendation'],
        examples: ['Find an accessible venue for a workshop of 30 people.'],
      },
    ],
  };
}
