<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	
	export let options: { value: string; label: string }[] = [];
export let selected: string[] = [];
export let placeholder: string = 'Select options...';
export let disabled: boolean = false;
export let name: string = '';
export let id: string = '';
export let selectionMode: 'multiple' | 'single' = 'multiple';
	
	const dispatch = createEventDispatcher();
	
	let isOpen = false;
	
	$: filteredOptions = options;
	
	$: selectedLabels = options
		.filter(option => selected.includes(option.value))
		.map(option => option.label);
	
	function toggleOption(value: string) {
		if (disabled) return;

		if (selectionMode === 'single') {
			selected = [value];
			dispatch('change', { value: selected });
			closeDropdown();
			return;
		}

		const newSelected = selected.includes(value)
			? selected.filter((v) => v !== value)
			: [...selected, value];

		selected = newSelected;
		dispatch('change', { value: newSelected });
	}
	
	function toggleDropdown() {
		if (disabled) return;
		isOpen = !isOpen;
	}
	
	function closeDropdown() {
		isOpen = false;
	}
	
	function selectAll() {
		if (disabled || selectionMode === 'single') return;
		const allValues = options.map(option => option.value);
		selected = allValues;
		dispatch('change', { value: allValues });
	}
	
	function clearAll() {
		if (disabled || selectionMode === 'single') return;
		selected = [];
		dispatch('change', { value: [] });
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			toggleDropdown();
		}
	}

	function handleOptionKeydown(event: KeyboardEvent, value: string) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			toggleOption(value);
		}
	}
</script>

<div class="multi-select-container" class:disabled>
	<input type="hidden" {name} value={selectionMode === 'single' ? (selected[0] ?? '') : selected.join(',')} />
	
	<div 
		class="multi-select-trigger" 
		on:click={toggleDropdown} 
		on:keydown={handleKeydown}
		class:open={isOpen}
		role="button"
		tabindex="0"
		{id}
		aria-expanded={isOpen}
		aria-haspopup="listbox"
	>
		<div class="selected-display">
			{#if selected.length === 0}
				<span class="placeholder">{placeholder}</span>
			{:else}
				{#each selectedLabels as label}
					<span class="selected-item">{label}</span>
				{/each}
			{/if}
		</div>
		<div class="arrow" class:open={isOpen}>▼</div>
	</div>
	
	{#if isOpen}
		<div class="multi-select-dropdown">
			{#if selectionMode === 'multiple'}
				<div class="actions">
					<button type="button" on:click={selectAll} class="action-btn">Select All</button>
					<button type="button" on:click={clearAll} class="action-btn">Clear All</button>
				</div>
			{/if}
			
			<div class="options-list" role="listbox">
				{#each filteredOptions as option}
					<div 
						class="option" 
						class:selected={selected.includes(option.value)}
						on:click={() => toggleOption(option.value)}
						on:keydown={(e) => handleOptionKeydown(e, option.value)}
						role="option"
						tabindex="0"
						aria-selected={selected.includes(option.value)}
					>
						<div class="checkbox">
							{#if selected.includes(option.value)}
								✓
							{/if}
						</div>
						<span class="option-label">{option.label}</span>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>

<style>
	.multi-select-container {
		position: relative;
		width: 100%;
		font-family: inherit;
		color: inherit;
	}

	.multi-select-container.disabled {
		opacity: 0.6;
		pointer-events: none;
	}

	.multi-select-trigger {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.5rem 0.7rem;
		min-height: 2.25rem;
		border-radius: calc(var(--radius) * 1.6);
		border: 1px solid color-mix(in srgb, var(--color-border) 85%, transparent);
		background: color-mix(in srgb, var(--color-card) 97%, var(--color-background) 3%);
		cursor: pointer;
		transition: border-color 150ms ease, box-shadow 150ms ease, background 150ms ease;
		box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.45);
	}

	.multi-select-trigger:hover:not(.disabled) {
		border-color: var(--color-ring);
	}

	.multi-select-trigger.open {
		border-color: var(--color-ring);
		box-shadow:
			0 0 0 3px color-mix(in srgb, var(--color-ring) 22%, transparent),
			inset 0 1px 0 rgb(255 255 255 / 0.5);
	}

	.selected-display {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		flex: 1;
		flex-wrap: wrap;
		min-width: 0;
	}

	.selected-item {
		font-weight: 600;
		color: var(--color-primary-foreground);
		background: color-mix(in srgb, var(--color-primary) 22%, transparent);
		padding: 0.2rem 0.6rem;
		border-radius: 999px;
		font-size: 0.78rem;
		letter-spacing: 0.02em;
	}

	.placeholder {
		color: color-mix(in srgb, var(--color-muted-foreground) 70%, var(--color-foreground) 30%);
		font-size: 0.85rem;
	}

	.arrow {
		font-size: 0.7rem;
		color: color-mix(in srgb, var(--color-muted-foreground) 65%, var(--color-foreground) 35%);
		margin-left: 0.6rem;
		transition: transform 150ms ease;
	}

	.arrow.open {
		transform: rotate(180deg);
	}

	.multi-select-dropdown {
		position: absolute;
		z-index: 25;
		top: calc(100% + 0.35rem);
		left: 0;
		right: 0;
		border-radius: calc(var(--radius) * 1.8);
		border: 1px solid color-mix(in srgb, var(--color-border) 80%, transparent);
		background: color-mix(in srgb, var(--color-card) 96%, var(--color-background) 4%);
		box-shadow: 0 24px 42px -26px rgb(15 23 42 / 0.55);
		padding: 0.75rem 0.9rem;
		max-height: 310px;
	}

	.actions {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		margin-bottom: 0.7rem;
	}

	.action-btn {
		border: none;
		background: transparent;
		color: var(--color-primary);
		font-weight: 600;
		font-size: 0.78rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		padding: 0.35rem 0.6rem;
		border-radius: calc(var(--radius) * 1.2);
		cursor: pointer;
		transition: background 150ms ease, color 150ms ease;
	}

	.action-btn:hover {
		background: color-mix(in srgb, var(--color-primary) 18%, transparent);
		color: var(--color-primary-foreground);
	}

	.options-list {
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
		max-height: 230px;
		overflow-y: auto;
		padding-right: 0.25rem;
	}

	.option {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.45rem 0.55rem;
		border-radius: calc(var(--radius) * 1.4);
		cursor: pointer;
		transition: background 150ms ease, color 150ms ease, transform 150ms ease;
		color: color-mix(in srgb, var(--color-muted-foreground) 70%, var(--color-foreground) 30%);
		font-size: 0.86rem;
	}

	.option:hover {
		background: color-mix(in srgb, var(--color-accent) 18%, transparent);
		color: var(--color-foreground);
	}

	.option.selected {
		background: color-mix(in srgb, var(--color-primary) 18%, transparent);
		color: var(--color-primary-foreground);
		transform: translateY(-1px);
	}

	.checkbox {
		width: 1.1rem;
		height: 1.1rem;
		border-radius: 0.35rem;
		border: 1px solid color-mix(in srgb, var(--color-border) 80%, transparent);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.75rem;
		background: color-mix(in srgb, var(--color-card) 96%, var(--color-background) 4%);
	}

	.option.selected .checkbox {
		background: var(--color-primary);
		color: var(--color-primary-foreground);
		border-color: color-mix(in srgb, var(--color-primary) 85%, rgb(0 0 0) 15%);
	}

	.option-label {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.options-list::-webkit-scrollbar {
		width: 6px;
	}

	.options-list::-webkit-scrollbar-track {
		background: color-mix(in srgb, var(--color-border) 50%, transparent);
	}

	.options-list::-webkit-scrollbar-thumb {
		background: color-mix(in srgb, var(--color-primary) 35%, transparent);
		border-radius: 3px;
	}

	@media (max-width: 540px) {
		.actions {
			flex-direction: column;
			align-items: stretch;
		}

		.action-btn {
			width: 100%;
			text-align: center;
		}
	}
</style>
