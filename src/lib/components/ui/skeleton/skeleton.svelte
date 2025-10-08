<script lang="ts">
	import type { HTMLAttributes } from "svelte/elements";
	import { cn } from "$lib/utils.js";

	type Props = HTMLAttributes<HTMLDivElement>;

	let { class: className, ...restProps }: Props = $props();
</script>

<div
	data-slot="skeleton"
	class={cn("animate-pulse rounded-md bg-muted", className)}
	{...restProps}
></div>
