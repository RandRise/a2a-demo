<script setup>
import { computed, onMounted, ref } from 'vue';
const ready = ref(false);
onMounted(() => {
  ready.value = true;
});
const position = ref(0);
const steps = [
  {
    label: 'Find the specialist',
    to: 'Venue specialist',
    state: 'Discovery',
    quote: 'Can you compare venues for my workshop?',
    explanation:
      'The coordinator reads the Agent Card at a known local address and checks the venue-selection skill. It discovers capabilities, not an internet-wide list of agents.',
    evidence: 'GET the Agent Card; inspect the skill and A2A endpoint.',
    from: 'Coordinator',
  },
  {
    label: 'Hand over the goal',
    to: 'Venue specialist',
    state: 'Working',
    quote:
      'Prefer AED 1,400, with a hard limit of AED 1,600. Find a venue for 30 people and explain whether extra spending is worthwhile.',
    explanation:
      'The structured brief includes a projector, step-free access, and discussion preferences. The specialist owns the comparison, not the whole event.',
    evidence: 'SendMessage creates a task and context; GetTask tracks progress.',
    from: 'Coordinator',
  },
  {
    label: 'Ask what is missing',
    to: 'Coordinator / you',
    state: 'Input required',
    quote: 'Would you prioritize lower cost, a quieter room, or separate breakout rooms?',
    explanation:
      'After checking the catalogue, the specialist sees several valid options. It asks which benefit matters most instead of assuming the cheapest is best.',
    evidence:
      'A lookupVenues status update precedes input-required. The clarification includes suitable candidates.',
    from: 'Venue specialist',
  },
  {
    label: 'Continue the same task',
    to: 'Venue specialist',
    state: 'Working',
    quote: 'Separate breakout rooms matter most.',
    explanation:
      'The coordinator forwards your priority using the existing task and context IDs. Your hard spending limit stays AED 1,600.',
    evidence: 'The follow-up SendMessage carries priority=breakouts and the same identifiers.',
    from: 'You / coordinator',
  },
  {
    label: 'Do the specialist’s work',
    to: 'Venue comparison',
    state: 'Working',
    quote: 'Harbor Hall has two separate rooms, but costs more and has some foyer noise.',
    explanation:
      'The specialist compares real catalogue facts. Canal Loft is cheaper; Cedar Room is quieter. Harbor Hall trades money and some noise for separate discussion spaces. All facts are fictional demo data.',
    evidence:
      'The recommendation explains a benefit, a sacrifice, and the AED 150 stretch above the preferred budget.',
    from: 'Venue specialist',
  },
  {
    label: 'Return and check the result',
    to: 'Coordinator / you',
    state: 'Completed',
    quote:
      'Harbor Hall: AED 1,550. The separate rooms justify the extra AED 150 for this priority.',
    explanation:
      'The coordinator checks hard constraints and reviews the explanation. A sound choice is accepted. If it requests one revision, the specialist receives a new linked task in the same context. Nothing is booked.',
    evidence:
      'Inspect the artifact and coordinator review. A revision appears only if actually requested; this illustration ends with acceptance.',
    from: 'Venue specialist',
  },
];
const current = computed(() => steps[position.value]);
</script>

<template>
  <section class="handoff" aria-label="Illustrated handoff walkthrough" :aria-busy="!ready">
    <div class="walk-top">
      <span class="eyebrow">Illustration · not a live run</span
      ><span>{{ position + 1 }} / {{ steps.length }}</span>
    </div>
    <div class="step-dots" aria-label="Choose a step">
      <button
        v-for="(step, index) in steps"
        :key="step.label"
        :disabled="!ready"
        :aria-label="`Step ${index + 1}: ${step.label}`"
        :aria-current="position === index ? 'step' : undefined"
        @click="position = index"
      >
        {{ index + 1 }}
      </button>
    </div>
    <div class="step-content" aria-live="polite" aria-atomic="true">
      <div class="route">
        <span>{{ current.from }}</span
        ><span aria-hidden="true">→</span><span>{{ current.to }}</span>
      </div>
      <h3>{{ current.label }}</h3>
      <p class="spoken">“{{ current.quote }}”</p>
      <p>{{ current.explanation }}</p>
      <div class="evidence">
        <span class="state">{{ current.state }}</span>
        <p><strong>What to look for in the demo:</strong> {{ current.evidence }}</p>
      </div>
    </div>
    <div class="walk-controls">
      <button :disabled="!ready || position === 0" @click="position--">← Previous</button
      ><button
        v-if="position < steps.length - 1"
        class="primary"
        :disabled="!ready"
        @click="position++"
      >
        Next step →</button
      ><button v-else class="primary" @click="position = 0">Replay the handoff ↺</button>
    </div>
  </section>
</template>
