<script setup lang="ts">
useHead({ title: 'Build a Team · MyVGC' })
const cancelTo = useNewTeamCancelTo()
// Works with no signal too: the pickers use the names kept on the phone (ADR 17).
const save = useSaveNewTeam()
</script>

<template>
  <div class="mx-auto flex w-full max-w-3xl flex-col gap-6">
    <h1 class="text-2xl font-semibold">Build a Team</h1>
    <TeamBuilder :save="save" :cancel-to="cancelTo" />
  </div>
</template>
