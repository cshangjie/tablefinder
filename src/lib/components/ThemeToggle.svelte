<script lang="ts">
	import { Moon, Sun } from 'lucide-svelte';
	import { Button } from '$lib/components/ui/button';
	import { onMount } from 'svelte';

	let theme = $state<'light' | 'dark'>('light');

	function toggleTheme(e: MouseEvent) {
		e.preventDefault();
		e.stopPropagation();
		console.log('Toggle theme clicked, current theme:', theme);
		const newTheme = theme === 'light' ? 'dark' : 'light';
		theme = newTheme;
		console.log('New theme:', newTheme);
		localStorage.setItem('theme', newTheme);
		if (newTheme === 'dark') {
			document.documentElement.classList.add('dark');
		} else {
			document.documentElement.classList.remove('dark');
		}
	}

	onMount(() => {
		const stored = localStorage.getItem('theme') as 'light' | 'dark' | null;
		if (stored) {
			theme = stored;
			if (stored === 'dark') {
				document.documentElement.classList.add('dark');
			} else {
				document.documentElement.classList.remove('dark');
			}
		} else {
			// Check system preference
			const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
			theme = systemTheme;
			if (systemTheme === 'dark') {
				document.documentElement.classList.add('dark');
			} else {
				document.documentElement.classList.remove('dark');
			}
		}
	});
</script>

<button
	type="button"
	onclick={toggleTheme}
	class="inline-flex items-center justify-center rounded-md border border-input bg-background hover:bg-primary hover:text-primary-foreground hover:border-primary h-9 w-9 transition-colors relative"
>
	<Sun class="size-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
	<Moon class="absolute size-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
	<span class="sr-only">Toggle theme</span>
</button>
