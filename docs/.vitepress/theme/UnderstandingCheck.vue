<script setup>
import { ref } from 'vue';
const selected = ref(null);
const answers = [
  {
    text: 'It is just a calculator with a different name.',
    feedback:
      'Look at who manages the work. The specialist can ask for information, choose a tool, evaluate the result, and decline an impossible request.',
  },
  {
    text: 'It owns the delegated task and can choose its next action.',
    feedback:
      'Exactly. The coordinator gives a goal and constraints. The specialist controls the permitted steps needed to produce a result. Rehearsal scripts those choices; live mode uses a model.',
  },
  {
    text: 'A2A automatically makes every reply correct.',
    feedback:
      'A2A gives the agents a shared communication contract. It does not guarantee good reasoning or correct results, which is why the coordinator checks the returned recommendation.',
  },
];
</script>

<template>
  <section class="knowledge-check" aria-labelledby="quiz-title">
    <span class="eyebrow">Your turn · one question</span>
    <h3 id="quiz-title">What makes the specialist an agent role?</h3>
    <div class="answers">
      <button
        v-for="(answer, index) in answers"
        :key="answer.text"
        :aria-pressed="selected === index"
        @click="selected = index"
      >
        <span class="answer-letter">{{ String.fromCharCode(65 + index) }}</span
        >{{ answer.text }}
      </button>
    </div>
    <p v-if="selected !== null" class="feedback" role="status">{{ answers[selected].feedback }}</p>
    <p v-else class="quiz-hint">
      Choose an answer to see the explanation. Nothing is scored or saved.
    </p>
  </section>
</template>
