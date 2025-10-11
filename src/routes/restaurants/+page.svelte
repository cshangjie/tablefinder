<script lang="ts">
	import { enhance } from '$app/forms';
	import { ResyResponseHandler, type ResyVenue } from '$lib/models/ResyResponse';
	import type { ActionData } from './$types';
	import { Button, Input, Label, Skeleton } from '$lib/components/ui';
	import { Calendar as CalendarComponent } from '$lib/components/ui/calendar/index.js';
	import { Slider } from '$lib/components/ui/slider/index.js';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Spinner } from '$lib/components/ui/spinner/index.js';
	import { Calendar as CalendarIcon, ChevronDown } from 'lucide-svelte';
	import { DateFormatter, type DateValue, parseDate, today, getLocalTimeZone } from '@internationalized/date';
	import { cn } from '$lib/utils.js';
	import { buttonVariants } from '$lib/components/ui/button/index.js';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
	import * as Select from "$lib/components/ui/select/index.js";
	interface Props {
		form: ActionData;
		data: { url: { searchParams: Record<string, string> } };
	}

	let { form, data }: Props = $props();

	// Get URL search parameters
	const urlParams = {
		get: (key: string) => data.url.searchParams[key] || null
	};
	
	// Constants for time calculations (in minutes from midnight)
	const MIN_TIME = 9 * 60; // 9:00 AM = 540 minutes
	const MAX_TIME = 23 * 60 + 30; // 11:30 PM = 1410 minutes
	
	// Helper function for default date
	const formatDateForInput = () => {
		const today = new Date();
		return today.toISOString().split('T')[0];
	};

	// Helper to convert DateValue to ISO string
	const dateValueToISO = (date: DateValue | undefined): string => {
		if (!date) return formatDateForInput();
		return `${date.year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`;
	};

	// Date formatter for display
	const df = new DateFormatter('en-US', {
		dateStyle: 'long'
	});

	// Initialize form values from URL params, previous search, or defaults
	let city = $state(urlParams.get('city') || (form && (form.searchParams as any)?.city) || 'San Francisco');
	const initialDateStr = urlParams.get('date') || (form && (form.searchParams as any)?.res_date) || formatDateForInput();
	let selectedDate = $state<DateValue | undefined>(parseDate(initialDateStr));
	const seatsParam = urlParams.get('seats');
	let partySize = $state(seatsParam || (form && (form.searchParams as any)?.party_size) || '2');

	// Derived value for form submission
	const reservationDate = $derived(dateValueToISO(selectedDate));

	// Convert time strings (HH:MM) to minutes from midnight
	const parseTimeToMinutes = (timeStr: string) => {
		const [hours, minutes] = timeStr.split(':').map(Number);
		return hours * 60 + minutes;
	};

	// Time range values for svelte-range-slider-pips (using minutes from midnight)
	// Default: 6 PM to 9 PM
	let timeValues = $state([18 * 60, 21 * 60]); // [6 PM, 9 PM] in minutes from midnight

	// Restore time values from previous search if available
	if (form && (form.searchParams as any)?.time_start && (form.searchParams as any)?.time_end) {
		const timeStartStr = (form.searchParams as any).time_start;
		const timeEndStr = (form.searchParams as any).time_end;

		timeValues = [parseTimeToMinutes(timeStartStr), parseTimeToMinutes(timeEndStr)];
	}
	let searchRadius = $state((form && (form.searchParams as any)?.searchRadius) ? parseFloat((form.searchParams as any).searchRadius) : 3);
	let seatingType = $state((form && (form.searchParams as any)?.seating_type) || '');
	let selectedPriceRanges = $state((form && (form.searchParams as any)?.price_ranges) ? (form.searchParams as any).price_ranges.split(',').filter((p: string) => p.trim()) : ['1', '2', '3']);
	
	// Price range options for the multi-select
	const priceRangeOptions = [
		{ value: '1', label: '$' },
		{ value: '2', label: '$$' },
		{ value: '3', label: '$$$' }
	];
	let loading = $state(false);
	const sortOptions = [
		{ value: 'default', label: 'Least Reservations' },
		{ value: 'rating', label: 'Highest Rated' },
		{ value: 'distance', label: 'Distance (Closest First)' }
	];
	let sortBySelection = $state(sortOptions[0].value);
	const sortBy = $derived(sortBySelection ?? sortOptions[0].value); // default, rating, distance

	// Pagination state
	let currentPage = $state(1);
	const pageSizeOptions = [
		{ value: '10', label: '10 per page' },
		{ value: '20', label: '20 per page' },
		{ value: '50', label: '50 per page' }
	];
	let pageSizeSelection = $state(pageSizeOptions[0].value);
	const pageSize = $derived(parseInt(pageSizeSelection ?? pageSizeOptions[0].value, 10) || 10);

	// Collapsible card state
	let expandedCards = $state(new Set<string>());

	function toggleCard(venueId: string) {
		const newExpanded = new Set(expandedCards);
		if (newExpanded.has(venueId)) {
			newExpanded.delete(venueId);
		} else {
			newExpanded.add(venueId);
		}
		expandedCards = newExpanded;
	}

	// Create ResyResponseHandler when we have results
	const resyHandler = $derived(form?.results ? new ResyResponseHandler(form.results) : null);

	const handleSubmit = () => {
		loading = true;
		return async ({ update }: { update: () => Promise<void> }) => {
			await update();
			loading = false;
		};
	};

	const formatTime = (totalMinutes: number) => {
		const hour = Math.floor(totalMinutes / 60);
		const minutes = totalMinutes % 60;
		const minutesStr = minutes.toString().padStart(2, '0');
		
		if (hour === 0 || hour === 24) return `12:${minutesStr} AM`;
		if (hour < 12) return `${hour}:${minutesStr} AM`;
		if (hour === 12) return `12:${minutesStr} PM`;
		return `${hour - 12}:${minutesStr} PM`;
	};

	const formatTimeForForm = (totalMinutes: number) => {
		const hour = Math.floor(totalMinutes / 60);
		const minutes = totalMinutes % 60;
		return `${hour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
	};

	// Set default values
	let defaultDate = formatDateForInput();
	const minDate = today(getLocalTimeZone());

	// Update timeStart and timeEnd when slider values change
	const timeStart = $derived(timeValues[0]);
	const timeEnd = $derived(timeValues[1]);

	// Computed values for display and form submission
	const timeStartForm = $derived(formatTimeForForm(timeStart));
	const timeEndForm = $derived(formatTimeForForm(timeEnd));
	

	
	// Sorting function using ResyResponseHandler
	const getSortedVenues = (venues: ResyVenue[], sortType: string): ResyVenue[] => {
		if (!venues || !resyHandler) return venues || [];
		
		// Create a temporary handler with just these venues
		const tempHandler = new ResyResponseHandler({
			search: { hitsPerPage: venues.length, hits: venues }
		});
		
		return tempHandler.sortVenues(sortType as any);
	};

	// Pagination functions
	const getPaginatedVenues = (venues: ResyVenue[], page: number, size: number): ResyVenue[] => {
		const startIndex = (page - 1) * size;
		const endIndex = startIndex + size;
		return venues.slice(startIndex, endIndex);
	};

	const getTotalPages = (totalItems: number, size: number): number => {
		return Math.ceil(totalItems / size);
	};

	const getPageNumbers = (current: number, total: number): Array<number | 'ellipsis'> => {
		if (total <= 7) {
			return Array.from({ length: total }, (_, i) => i + 1);
		}

		const pages: Array<number | 'ellipsis'> = [1];
		const start = Math.max(2, current - 1);
		const end = Math.min(total - 1, current + 1);

		if (start > 2) {
			pages.push('ellipsis');
		}

		for (let page = start; page <= end; page += 1) {
			pages.push(page);
		}

		if (end < total - 1) {
			pages.push('ellipsis');
		}

		pages.push(total);
		return pages;
	};

	// Reset to page 1 when search results change or sort/filter changes
	const resetPagination = () => {
		currentPage = 1;
	};

	// Watch for changes that should reset pagination
	$effect(() => {
		if (form?.results || sortBy) {
			resetPagination();
		}
	});

	// Scroll to results function
	let resultsSection: HTMLElement | undefined = $state();
	const placeholderCards = Array.from({ length: 2 }, (_, i) => i);

	const scrollToResults = () => {
		if (resultsSection) {
			resultsSection.scrollIntoView({ 
				behavior: 'smooth', 
				block: 'start' 
			});
		}
	};
	const seatOptions = [
		{ value: '1', label: '1' },
		{ value: '2', label: '2' },
		{ value: '3', label: '3' },
		{ value: '4', label: '4' },
		{ value: '5', label: '5' },
		{ value: '6', label: '6' },
		{ value: '7', label: '7' },
		{ value: '8', label: '8' },
		{ value: '9', label: '9' },
		{ value: '10', label: '10+' }
	];
	const seatTriggerContent = $derived(
		seatOptions.find((option) => option.value === partySize)?.label ?? 'Select seats'
	);
	const sortTriggerContent = $derived(
		sortOptions.find((option) => option.value === sortBySelection)?.label ?? 'Sort results'
	);
	const priceRangeTriggerContent = $derived((() => {
		const selected = selectedPriceRanges ?? [];

		const selectedLabels = selected
			.map((value) => priceRangeOptions.find((option) => option.value === value)?.label ?? value)
			.filter(Boolean);

		if (selected.length === 0 || selectedLabels.length === priceRangeOptions.length) {
			return 'All prices';
		}

		return selectedLabels.join(', ');
	})());
	const pageSizeTriggerContent = $derived(
		pageSizeOptions.find((option) => option.value === pageSizeSelection)?.label ?? 'Results per page'
	);
	const RADIUS_STEP = 0.5;
	const MIN_RADIUS = 0.5;
	const MAX_RADIUS = 50;

	const adjustRadius = (delta: number) => {
		const next = Number((Number(searchRadius) + delta).toFixed(1));
		searchRadius = Math.min(MAX_RADIUS, Math.max(MIN_RADIUS, next));
	};
</script>

<svelte:head>
	<title>Search</title>
</svelte:head>

<div class="search-page w-full p-6 space-y-8">
	<div class="search-header flex items-center justify-between">
		<h1 class="text-3xl font-bold">Restaurant Search</h1>
		<div class="search-actions flex items-center gap-2">
			<ThemeToggle />
			<form method="POST" action="?/logout">
				<Button type="submit" variant="secondary">Logout</Button>
			</form>
		</div>
	</div>

	<div class="search-layout">
		<section class="filters-panel">
			<form method="POST" action="?/search" use:enhance={handleSubmit} class="search-form">
				<!-- Filter grid -->
				<div class="field-grid">
					<div class="field-group">
						<Label for="city">City/Address</Label>
						<Input
							type="text"
							id="city"
							name="city"
							bind:value={city}
							placeholder="City or address"
							disabled={loading}
							required
						/>
					</div>

					<div class="field-group">
						<Label for="reservationDate">Reservation Date</Label>
						<Popover.Root>
							<Popover.Trigger
							class={cn(
								buttonVariants({ variant: 'outline' }),
								'w-full justify-start text-left font-normal h-10 dark:bg-secondary',
								!selectedDate && 'text-muted-foreground'
							)}
							>
								<CalendarIcon class="mr-2 size-4" />
								{selectedDate ? df.format(selectedDate.toDate(getLocalTimeZone())) : 'Pick a date'}
							</Popover.Trigger>
							<Popover.Content class="w-auto p-0">
								<CalendarComponent type="single" bind:value={selectedDate} minValue={minDate} />
							</Popover.Content>
						</Popover.Root>
						<input type="hidden" name="reservationDate" value={reservationDate} />
					</div>
					<Label for="seats">Seats</Label>
					<Select.Root type="single" name="seats" bind:value={partySize}>
						<Select.Trigger class="w-full h-10 justify-between">
							{seatTriggerContent}
						</Select.Trigger>
						<Select.Content>
							<Select.Group>
								<Select.Label>Seats</Select.Label>
								{#each seatOptions as option (option.value)}
									<Select.Item value={option.value} label={option.label}>
										{option.label}
									</Select.Item>
								{/each}
							</Select.Group>
						</Select.Content>
					</Select.Root>

					<div class="field-group">
						<Label for="searchRadius">Radius (miles)</Label>
						<div class="flex items-center space-x-2">
							<Button
								type="button"
								variant="outline"
								size="icon"
								class="h-10 w-10"
								onclick={() => adjustRadius(-RADIUS_STEP)}
								disabled={loading || searchRadius <= MIN_RADIUS}
							>
								-
							</Button>
							<Input
								type="number"
								id="searchRadius"
								name="searchRadius"
								bind:value={searchRadius}
								min={MIN_RADIUS}
								max={MAX_RADIUS}
								step={RADIUS_STEP}
								placeholder="3"
								disabled={loading}
								required
								class="text-center [appearance:textfield] [-moz-appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
							/>
							<Button
								type="button"
								variant="outline"
								size="icon"
								class="h-10 w-10"
								onclick={() => adjustRadius(RADIUS_STEP)}
								disabled={loading || searchRadius >= MAX_RADIUS}
							>
								+
							</Button>
						</div>
					</div>
					<Label for="timeRange">Time Window</Label>
					<div class="slider-wrapper">
						<Slider
							type="multiple"
							bind:value={timeValues}
							min={MIN_TIME}
							max={MAX_TIME}
							step={15}
							class="w-full"
						/>
						<div class="flex justify-between text-sm text-muted-foreground">
							<span>{formatTime(timeValues[0])}</span>
							<span>{formatTime(timeValues[1])}</span>
						</div>
					</div>
					<input type="hidden" name="timeStart" value={timeStartForm} />
					<input type="hidden" name="timeEnd" value={timeEndForm} />
				</div>

			<div class="flex justify-center">
				<Button
					type="submit"
					variant="default"
					disabled={loading || !city.trim() || !reservationDate}
					size="lg"
					class="w-full sm:w-auto"
				>
					{#if loading}
						<Spinner class="mr-2" />
						Finding...
					{:else}
						Find Restaurants
					{/if}
				</Button>
			</div>
			</form>
		</section>

		<section class="results-panel" bind:this={resultsSection}>
			<!-- Results Section -->
			{#if form?.success && form?.results}
				<div class="results-section space-y-6">
					<div class="results-controls space-y-4">
						<h2 class="text-2xl font-semibold">Search Results</h2>
						{#if form.results.search?.hits && form.results.search.hits.length > 0}
						<div class="results-filters grid gap-4 md:grid-cols-3">
								<div class="filter-group space-y-2">
									<Label for="sortBy">Sort by</Label>
									<Select.Root
										type="single"
										name="sortBy"
										bind:value={sortBySelection}
										on:change={() => currentPage = 1}
									>
										<Select.Trigger class="w-full justify-between">
											{sortTriggerContent}
										</Select.Trigger>
										<Select.Content>
											<Select.Group>
												<Select.Label>Sort results</Select.Label>
												{#each sortOptions as option (option.value)}
													<Select.Item value={option.value} label={option.label}>
														{option.label}
													</Select.Item>
												{/each}
											</Select.Group>
										</Select.Content>
									</Select.Root>
								</div>
								<div class="filter-group space-y-2">
									<Label for="priceRanges">Price Range</Label>
									<Select.Root
										type="multiple"
										bind:value={selectedPriceRanges}
										disabled={loading}
									>
										<Select.Trigger class="w-full justify-between">
											<span data-slot="select-value" class="truncate text-left">
												{priceRangeTriggerContent}
											</span>
										</Select.Trigger>
										<Select.Content>
											<Select.Group>
												<Select.Label>Price Range</Select.Label>
												{#each priceRangeOptions as option (option.value)}
													<Select.Item value={option.value} label={option.label}>
														{option.label}
													</Select.Item>
												{/each}
											</Select.Group>
										</Select.Content>
									</Select.Root>
									<input type="hidden" name="priceRanges" value={selectedPriceRanges.join(',')} />
								</div>
								<div class="filter-group space-y-2">
									<Label for="pageSize">Show</Label>
									<Select.Root
										type="single"
										name="pageSize"
										bind:value={pageSizeSelection}
										on:change={() => currentPage = 1}
									>
										<Select.Trigger class="w-full justify-between">
											{pageSizeTriggerContent}
										</Select.Trigger>
										<Select.Content>
											<Select.Group>
												<Select.Label>Results per page</Select.Label>
												{#each pageSizeOptions as option (option.value)}
													<Select.Item value={option.value} label={option.label}>
														{option.label}
													</Select.Item>
												{/each}
											</Select.Group>
										</Select.Content>
									</Select.Root>
								</div>
							</div>
						{/if}
					</div>
					
					<!-- Raw JSON Debug Output -->
					<div class="debug-sections">
						<details class="json-debug">
							<summary>Raw Resy API Request (Debug)</summary>
							<pre class="json-output">{JSON.stringify(form.results._debugRequest || {}, null, 2)}</pre>
						</details>
						
						<details class="json-debug">
							<summary>Raw Resy API Response (Debug)</summary>
							<pre class="json-output">{JSON.stringify(form.results, null, 2)}</pre>
						</details>
					</div>

					{#if resyHandler && resyHandler.getVenues().length > 0}
						{@const selectedPriceIds = selectedPriceRanges.map((p: string) => parseInt(p))}
						{@const venuesWithSlots = resyHandler.filterVenuesByTimeAndPrice(timeStart, timeEnd, selectedPriceIds)}
						{@const venuesWithoutSlots = resyHandler.getVenues().filter(venue => !venuesWithSlots.includes(venue))}
						{@const sortedVenues = getSortedVenues(venuesWithSlots, sortBy)}
						{@const totalPages = getTotalPages(sortedVenues.length, pageSize)}
						{@const paginatedVenues = getPaginatedVenues(sortedVenues, currentPage, pageSize)}
						{@const pageNumbers = getPageNumbers(currentPage, totalPages)}
						{#if sortedVenues.length > 0}
							<!-- Results summary and pagination controls -->
							<div class="results-summary">
								<p>Showing {((currentPage - 1) * pageSize) + 1}-{Math.min(currentPage * pageSize, sortedVenues.length)} of {sortedVenues.length} restaurants with availability</p>
								
								{#if totalPages > 1}
									<div class="flex items-center justify-center gap-2">
										<Button
											variant="outline"
											onclick={() => {
												currentPage = Math.max(1, currentPage - 1);
												scrollToResults();
											}}
											disabled={currentPage <= 1}
										>
											← Previous
										</Button>

										<div class="flex items-center gap-1">
											{#each pageNumbers as page, idx (typeof page === 'number' ? page : `ellipsis-${idx}`)}
												{#if page === 'ellipsis'}
													<span class="px-2 text-muted-foreground">…</span>
												{:else}
													<Button
														variant={page === currentPage ? 'default' : 'outline'}
														onclick={() => {
															if (page !== currentPage) {
																currentPage = page;
																scrollToResults();
															}
														}}
														class="min-w-[2.5rem]"
														aria-current={page === currentPage ? 'page' : undefined}
													>
														{page}
													</Button>
												{/if}
											{/each}
										</div>

										<Button
											variant="outline"
											onclick={() => {
												currentPage = Math.min(totalPages, currentPage + 1);
												scrollToResults();
											}}
											disabled={currentPage >= totalPages}
										>
											Next →
										</Button>
									</div>
								{/if}
							</div>
							
							<div class="results-grid space-y-4">
								{#each paginatedVenues as venue}
								{@const isExpanded = expandedCards.has(venue.objectID)}
								<Card.Root class="result-card">
									<Card.Header class="result-card__header cursor-pointer" onclick={() => toggleCard(venue.objectID)}>
										<div class="flex items-start justify-between gap-2">
											<div class="flex-1">
												<Card.Title>
													<a href="{resyHandler.generateResyUrl(venue, reservationDate, partySize)}"
													   target="_blank"
													   class="venue-link"
													   onclick={(e) => e.stopPropagation()}>
														{resyHandler.getVenueDisplayName(venue)}
													</a>
												</Card.Title>
												<Card.Description>
													<span class="venue-meta">
														{#if venue.rating}
															<span class="rating">★ {venue.rating.average.toFixed(1)} ({venue.rating.count})</span>
														{/if}
														{#if resyHandler.formatVenuePrice(venue)}
															<span class="price-range">{resyHandler.formatVenuePrice(venue)}</span>
														{/if}
													</span>
												</Card.Description>
											</div>
											<ChevronDown class="h-5 w-5 transition-transform {isExpanded ? 'rotate-180' : ''}" />
										</div>
									</Card.Header>

									<Card.Content class="result-card__content">
										<div class="venue-info">
											<p class="location-cuisine">
												📍 {venue.locality || venue.location?.name || 'Location unknown'}
												{#if resyHandler.getVenueNeighborhood(venue)}
													• {resyHandler.getVenueNeighborhood(venue)}
												{/if}
												{#if resyHandler.getVenueCuisineTypes(venue).length > 0}
													• 🍽️ {resyHandler.getVenueCuisineTypes(venue).join(', ')}
												{/if}
											</p>

											{#if isExpanded}
												{#if venue.images && venue.images.length > 0}
													<div class="venue-image mt-4">
														<img src="{venue.images[0]}" alt="{resyHandler.getVenueDisplayName(venue)}" loading="lazy" />
													</div>
												{/if}

												<!-- Restaurant Content Sections -->
												{#if resyHandler.getVenueContent(venue, 'about')}
													<details class="restaurant-details">
														<summary class="details-summary">About this restaurant</summary>
														<div class="restaurant-description">
															<!-- {@html resyHandler.getVenueContent(venue, 'about').replace(/\n/g, '<br>')} -->
														</div>
													</details>
												{/if}

												{#if resyHandler.getVenueContent(venue, 'need_to_know')}
													<details class="restaurant-details need-to-know">
														<summary class="details-summary">💡 Need to Know</summary>
														<div class="restaurant-description important">
															<!-- {@html resyHandler.getVenueContent(venue, 'need_to_know').replace(/\n/g, '<br>')} -->
														</div>
													</details>
												{/if}

												{#if resyHandler.getVenueContent(venue, 'why_we_like_it')}
													<details class="restaurant-details why-like">
														<summary class="details-summary">⭐ Why We Like It</summary>
														<div class="restaurant-description highlight">
															<!-- {@html resyHandler.getVenueContent(venue, 'why_we_like_it').replace(/\n/g, '<br>')} -->
														</div>
													</details>
												{/if}

												{#if venue.availability?.slots && venue.availability.slots.length > 0}
													{@const filteredSlots = venue.availability.slots.filter((slot) => {
														const slotStart = new Date(slot.date.start);
														const slotTotalMinutes = slotStart.getHours() * 60 + slotStart.getMinutes();
														return slotTotalMinutes >= timeStart && slotTotalMinutes <= timeEnd;
													})}
													{#if filteredSlots.length > 0}
														<div class="reservations-section">
															<details class="reservations-details">
																<summary class="reservations-header">
																	🎉 {filteredSlots.length} Reservations Available
																</summary>
																<div class="reservation-slots">
																	{#each filteredSlots as slot}
																		<div class="reservation-slot">
																			<div class="slot-time">{resyHandler.formatSlotTime(slot)}</div>
																			<div class="slot-duration">({resyHandler.getSlotDuration(slot)} min)</div>
																			<div class="slot-type">{slot.config?.type || 'Standard'}</div>
																		</div>
																	{/each}
																</div>
															</details>
														</div>
													{:else}
														<div class="no-reservations">
															<p>❌ No reservations available for selected time window</p>
														</div>
													{/if}
												{:else}
													<div class="no-reservations">
														<p>❌ No reservations available for selected date/time</p>
													</div>
												{/if}
											{/if}
										</div>
									</Card.Content>
								</Card.Root>
							{/each}
							</div>
							
							<!-- Bottom pagination controls (duplicate of top) -->
							{#if totalPages > 1}
								<div class="flex items-center justify-center gap-2 mt-6">
									<Button
										variant="outline"
										onclick={() => {
											currentPage = Math.max(1, currentPage - 1);
											scrollToResults();
										}}
										disabled={currentPage <= 1}
										>
										← Previous
									</Button>

									<div class="flex items-center gap-1">
										{#each pageNumbers as page, idx (typeof page === 'number' ? `bottom-${page}` : `bottom-ellipsis-${idx}`)}
											{#if page === 'ellipsis'}
												<span class="px-2 text-muted-foreground">…</span>
											{:else}
												<Button
													variant={page === currentPage ? 'default' : 'outline'}
													onclick={() => {
														if (page !== currentPage) {
															currentPage = page;
															scrollToResults();
														}
													}}
													class="min-w-[2.5rem]"
													aria-current={page === currentPage ? 'page' : undefined}
												>
													{page}
												</Button>
											{/if}
										{/each}
									</div>

									<Button
										variant="outline"
										onclick={() => {
											currentPage = Math.min(totalPages, currentPage + 1);
											scrollToResults();
										}}
										disabled={currentPage >= totalPages}
									>
										Next →
									</Button>
								</div>
							{/if}
						{:else}
							<div class="no-results">
								<p>No restaurants with available reservations found for your search criteria. Try adjusting your filters or selecting a different date/time.</p>
							</div>
						{/if}

						<!-- Restaurants without available reservations -->
						{#if venuesWithoutSlots.length > 0}
							<div class="no-availability-section">
								<h3>Restaurants matching your filters but without available reservations:</h3>
								<p class="no-availability-list">
									{#each venuesWithoutSlots as venue, i}
										<a href="{resyHandler.generateResyUrl(venue, reservationDate, partySize)}"
										   target="_blank"
										   class="no-availability-link">
											{resyHandler.getVenueDisplayName(venue)}
										</a>{#if i < venuesWithoutSlots.length - 1}, {/if}
									{/each}
								</p>
							</div>
						{/if}
					{:else}
						<div class="no-results">
							<p>No restaurants found for your search criteria. Try adjusting your filters.</p>
						</div>
					{/if}
				</div>
			{:else if form?.success === false}
				<div class="error-section">
					<h2>Search Error</h2>
					<p class="error-message">{form.error || 'An unexpected error occurred'}</p>
				</div>
			{:else if form}
				<div class="no-results">
					<p>No restaurants found for your search criteria. Try adjusting your filters.</p>
				</div>
			{:else}
				<div class="results-placeholder" aria-live="polite">
					<div class="results-placeholder__message">
						<h2>Plan your night</h2>
						<p>Use the filters to search for reservations and see matches instantly.</p>
					</div>
					<div class="results-placeholder__grid" aria-hidden="true">
						{#each placeholderCards as _, index (index)}
							<Card.Root class="placeholder-card">
								<Card.Header class="placeholder-card__header">
									<Skeleton class="h-5 w-2/3" />
									<Skeleton class="h-3.5 w-1/3" />
								</Card.Header>
								<Card.Content class="placeholder-card__content">
									<Skeleton class="h-4 w-full" />
									<Skeleton class="h-4 w-3/4" />
									<Skeleton class="h-4 w-2/3" />
									<Skeleton class="h-16 w-full rounded-xl" />
									<div class="placeholder-card__slots">
										<Skeleton class="h-8 w-24 rounded-full" />
										<Skeleton class="h-8 w-20 rounded-full" />
									</div>
								</Card.Content>
							</Card.Root>
						{/each}
					</div>
				</div>
			{/if}
		</section>
	</div>
</div>
