<script lang="ts">
	import { Moon, Sun } from 'lucide-svelte';
	import { Button } from '$lib/components/ui/button';
	import { onMount } from 'svelte';

	let theme = $state<'light' | 'dark'>('light');

	function toggleTheme() {
		const newTheme = theme === 'light' ? 'dark' : 'light';
		theme = newTheme;
		localStorage.setItem('theme', newTheme);
		document.documentElement.classList.toggle('dark', newTheme === 'dark');
	}

	onMount(() => {
		const stored = localStorage.getItem('theme') as 'light' | 'dark' | null;
		if (stored) {
			theme = stored;
			document.documentElement.classList.toggle('dark', stored === 'dark');
		} else {
			// Check system preference
			const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
			theme = systemTheme;
			document.documentElement.classList.toggle('dark', systemTheme === 'dark');
		}
	});
</script>

<Button variant="outline" size="icon" onclick={toggleTheme}>
	<Sun class="size-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
	<Moon class="absolute size-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
	<span class="sr-only">Toggle theme</span>
</Button>
