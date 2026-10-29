<script setup>
import { computed } from "vue";
import { japaneseForm } from "../glossary.mjs";

const props = defineProps({
  entry: { type: Object, required: true },
  script: { type: String, required: true },
});
const form = computed(() => japaneseForm(props.entry, props.script));
</script>

<template>
  <span class="japanese-word">
    <span class="japanese-text" :lang="form.script === 'romaji' ? 'ja-Latn' : 'ja'">{{ form.text }}</span>
    <span v-if="form.alternative" class="script-alternative" lang="ca">{{ form.notice }}</span>
  </span>
</template>

<style>
.japanese-word { display: inline-flex; flex-direction: column; align-items: inherit; max-width: 100%; }
.japanese-text { overflow-wrap: anywhere; }
.script-alternative { display: block; margin-top: 6px; color: #94733b; font: 400 11px/1.6 "Segoe UI", sans-serif; letter-spacing: normal; }
</style>
