<script setup lang="ts">
import { authClient } from '@/lib/auth-client'

definePageMeta({ layout: 'auth' })

const email = ref('')
const password = ref('')
const login = useAuthForm(() =>
  authClient.signIn.email({ email: email.value, password: password.value }),
)
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="text-2xl">Log in</CardTitle>
      <CardDescription>Welcome back to MyVGC.</CardDescription>
    </CardHeader>
    <CardContent>
      <form class="flex flex-col gap-4" @submit.prevent="login.mutate()">
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
            autocomplete="current-password"
            required
          />
        </div>
        <Alert v-if="login.error.value" variant="destructive" role="alert">
          <AlertDescription>{{ login.error.value.message }}</AlertDescription>
        </Alert>
        <Button type="submit" size="lg" :disabled="login.isPending.value">
          {{ login.isPending.value ? 'Logging in…' : 'Log in' }}
        </Button>
      </form>
    </CardContent>
    <CardFooter class="text-muted-foreground text-sm">
      <p>
        New here?
        <NuxtLink to="/signup" class="text-foreground underline underline-offset-4">
          Create an account
        </NuxtLink>
      </p>
    </CardFooter>
  </Card>
</template>
