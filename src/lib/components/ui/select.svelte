<script lang="ts">
	import { type Snippet } from 'svelte';
	import { cn } from '$lib/utils';

	interface SelectProps {
		value?: string | number;
		disabled?: boolean;
		required?: boolean;
		class?: string;
		id?: string;
		name?: string;
		children?: Snippet;
	}

	let {
		value = $bindable(''),
		disabled = false,
		required = false,
		class: className,
		children,
		...rest
	}: SelectProps = $props();
</script>

<select
	bind:value
	{disabled}
	{required}
	{...rest}
	class={cn(
		'flex h-10 w-full rounded-md border border-input bg-background dark:bg-secondary px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
		className
	)}
>
	{@render children?.()}
</select>
