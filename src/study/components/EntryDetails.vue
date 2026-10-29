<script setup>
defineProps({ entry: { type: Object, required: true } });
</script>

<template>
  <div class="answer">
    <p><span lang="ja">{{ entry.hiragana }} {{ entry.katakana }}</span> · {{ entry.romaji }}</p>
    <div v-for="(meaning, index) in entry.meanings" :key="index">
      <strong>{{ meaning.text }}</strong>
      <p v-if="meaning.description">{{ meaning.description }}</p>
    </div>
    <div v-for="(example, index) in entry.examples" :key="index">
      <p class="study-example" lang="ja">{{ example.japanese }}</p>
      <p><span lang="ja">{{ example.hiragana }}</span><br>{{ example.romaji }}<br>{{ example.translation }}</p>
    </div>
    <p v-if="entry.notes" class="entry-notes">{{ entry.notes }}</p>
  </div>
</template>
