<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	
	export let options: { value: string; label: string }[] = [];
	export let selected: string[] = [];
	export let placeholder: string = 'Select options...';
	export let disabled: boolean = false;
	export let name: string = '';
	export let id: string = '';
	
	const dispatch = createEventDispatcher();
	
	let isOpen = false;
	
	$: filteredOptions = options;
	
	$: selectedLabels = options
		.filter(option => selected.includes(option.value))
		.map(option => option.label);
	
	function toggleOption(value: string) {
		if (disabled) return;
		
		const newSelected = selected.includes(value)
			? selected.filter(v => v !== value)
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
		if (disabled) return;
		const allValues = options.map(option => option.value);
		selected = allValues;
		dispatch('change', { value: allValues });
	}
	
	function clearAll() {
		if (disabled) return;
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
	<input type="hidden" {name} value={selected.join(',')} />
	
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
			<div class="actions">
				<button type="button" on:click={selectAll} class="action-btn">Select All</button>
				<button type="button" on:click={clearAll} class="action-btn">Clear All</button>
			</div>
			
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
	}
	
	.multi-select-trigger {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.5rem;
		border: 1px solid #ddd;
		border-radius: 4px;
		background-color: white;
		cursor: pointer;
		transition: all 0.2s ease;
		min-height: 38px;
	}
	
	.multi-select-trigger:hover:not(.disabled) {
		border-color: #007bff;
	}
	
	.multi-select-trigger.open {
		border-color: #007bff;
		box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
	}
	
	
	.selected-display {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		flex: 1;
		min-width: 0;
		flex-wrap: wrap;
	}
	
	.selected-item {
		font-weight: 500;
		color: #333;
		background-color: #e3f2fd;
		padding: 0.1rem 0.4rem;
		border-radius: 12px;
		font-size: 0.8rem;
	}
	

	
	.placeholder {
		color: #999;
	}
	
	.arrow {
		font-size: 0.8rem;
		color: #666;
		transition: transform 0.2s ease;
	}
	
	.arrow.open {
		transform: rotate(180deg);
	}
	
	.multi-select-dropdown {
		position: absolute;
		top: 100%;
		left: 0;
		right: 0;
		background-color: white;
		border: 1px solid #ddd;
		border-top: none;
		border-radius: 0 0 4px 4px;
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
		z-index: 1000;
		max-height: 300px;
		overflow: hidden;
	}
	

	
	.actions {
		display: flex;
		gap: 0.5rem;
		padding: 0.5rem;
		border-bottom: 1px solid #eee;
	}
	
	.action-btn {
		flex: 1;
		padding: 0.25rem 0.5rem;
		border: 1px solid #ddd;
		border-radius: 4px;
		background-color: #f8f9fa;
		color: #333;
		font-size: 0.8rem;
		cursor: pointer;
		transition: all 0.2s ease;
	}
	
	.action-btn:hover {
		background-color: #e9ecef;
		border-color: #007bff;
	}
	
	.options-list {
		max-height: 200px;
		overflow-y: auto;
	}
	
	.option {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem;
		cursor: pointer;
		transition: background-color 0.2s ease;
	}
	
	.option:hover {
		background-color: #f8f9fa;
	}
	
	.option.selected {
		background-color: #e3f2fd;
	}
	
	.checkbox {
		width: 16px;
		height: 16px;
		border: 1px solid #ddd;
		border-radius: 2px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.7rem;
		color: white;
		background-color: #007bff;
	}
	
	.option:not(.selected) .checkbox {
		background-color: white;
		color: transparent;
	}
	
	.option-label {
		flex: 1;
		font-size: 14px;
	}
</style>
