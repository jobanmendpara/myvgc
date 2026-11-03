<script setup lang="ts">
import { authClient } from '@/lib/auth-client'

definePageMeta({ layout: 'auth' })

const MIN_PASSWORD_LENGTH = 8

const email = ref('')
const password = ref('')
const signup = useAuthForm(() =>
  authClient.signUp.email({
    email: email.value,
    password: password.value,
    // Better Auth requires a name; until there's a profile screen, use the email's first part.
    name: email.value.split('@')[0] || email.value,
  }),
)
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="text-2xl">Create an account</CardTitle>
      <CardDescription>Keep your Pokémon Champions Teams in one place.</CardDescription>
    </CardHeader>
    <CardContent>
      <form class="flex flex-col gap-4" @submit.prevent="signup.mutate()">
        <div class="flex flex-col gap-2">
          <Label for="email">Email</Label>
          <Input id="email" v-model="email" type="email" autocomplete="email" required />
        </div>
        <div class="flex flex-col gap-2">
          <Label for="password">Password</Label>
          <Input
            id="password"
            v-model="password"
            type="password"
            autocomplete="new-password"
            :minlength="MIN_PASSWORD_LENGTH"
            aria-describedby="password-hint"
            required
          />
          <p id="password-hint" class="text-muted-foreground text-sm">
            At least {{ MIN_PASSWORD_LENGTH }} characters.
          </p>
        </div>
        <Alert v-if="signup.error.value" variant="destructive" role="alert">
          <AlertDescription>{{ signup.error.value.message }}</AlertDescription>
        </Alert>
        <Button type="submit" size="lg" :disabled="signup.isPending.value">
          {{ signup.isPending.value ? 'Creating account…' : 'Create account' }}
        </Button>
      </form>
    </CardContent>
    <CardFooter class="text-muted-foreground text-sm">
      <p>
        Already have an account?
        <NuxtLink to="/login" class="text-foreground underline underline-offset-4">Log in</NuxtLink>
      </p>
    </CardFooter>
  </Card>
</template>
