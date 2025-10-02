<script lang="ts">
	import { type Snippet } from 'svelte';
	import { cn } from '$lib/utils';

	interface CardProps {
		class?: string;
		children?: Snippet;
	}

	let { class: className, children, ...rest }: CardProps = $props();
</script>

<div
	{...rest}
	class={cn('rounded-lg border bg-card text-card-foreground shadow-sm', className)}
>
	{@render children?.()}
</div>
