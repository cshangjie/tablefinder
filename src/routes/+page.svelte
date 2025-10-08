<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Card from '$lib/components/ui/card';

	let loading = $state(false);
	let password = $state('');

	const handleSubmit = () => {
		loading = true;
		return async ({ update }: { update: () => Promise<void> }) => {
			await update();
			loading = false;
		};
	};

	const error = $derived($page.form?.error);
</script>

<svelte:head>
	<title>Login - JennyTime</title>
</svelte:head>

<main class="login-page container flex min-h-screen items-center justify-center">
	<div class="login-stack mx-auto flex w-full max-w-md flex-col gap-6">
		<Card.Root>
			<Card.Header class="text-center">
				<Card.Title class="text-2xl">Welcome to JennyTime</Card.Title>
				<Card.Description>Enter your password to access the restaurant search</Card.Description>
			</Card.Header>
			<Card.Content>
				<form method="POST" action="?/login" use:enhance={handleSubmit}>
					<div class="grid gap-6">
						{#if error}
							<div class="rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
								{error}
							</div>
						{/if}

						<div class="grid gap-3">
							<Label for="password">Password</Label>
							<Input
								id="password"
								name="password"
								type="password"
								bind:value={password}
								placeholder="Enter your password"
								required
								disabled={loading}
							/>
						</div>

						<Button type="submit" class="w-full" disabled={loading}>
							{loading ? 'Logging in...' : 'Login'}
						</Button>
					</div>
				</form>
			</Card.Content>
		</Card.Root>
	</div>
</main>
