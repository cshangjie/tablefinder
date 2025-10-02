<script lang="ts">
	import { type Snippet } from 'svelte';
	import { cn } from '$lib/utils';

	interface LabelProps {
		for?: string;
		class?: string;
		children?: Snippet;
	}

	let { for: htmlFor, class: className, children, ...rest }: LabelProps = $props();
</script>

<label
	for={htmlFor}
	{...rest}
	class={cn(
		'text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
		className
	)}
>
	{@render children?.()}
</label>
