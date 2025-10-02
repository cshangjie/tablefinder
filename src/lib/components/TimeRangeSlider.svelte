<script lang="ts">
	import { Slider } from '$lib/components/ui/slider';

	interface Props {
		value?: number[];
		min?: number;
		max?: number;
		step?: number;
		disabled?: boolean;
		formatLabel?: (value: number) => string;
	}

	let {
		value = $bindable([540, 1260]), // Default 9:00 AM to 9:00 PM in minutes
		min = 0,
		max = 1440,
		step = 15,
		disabled = false,
		formatLabel = (v) => v.toString()
	}: Props = $props();

	const startLabel = $derived(formatLabel(value[0]));
	const endLabel = $derived(formatLabel(value[1]));
</script>

<div class="space-y-4">
	<div class="flex justify-between text-sm font-medium">
		<span class="text-muted-foreground">{startLabel}</span>
		<span class="text-muted-foreground">{endLabel}</span>
	</div>

	<Slider
		bind:value
		{min}
		{max}
		{step}
		{disabled}
	/>

	<div class="flex justify-between text-xs text-muted-foreground px-0.5">
		<span>{formatLabel(min)}</span>
		<span>{formatLabel(max)}</span>
	</div>
</div>
