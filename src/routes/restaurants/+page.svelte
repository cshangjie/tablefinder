<script lang="ts">
	import { enhance } from '$app/forms';
	import TimeRangeSlider from '$lib/components/TimeRangeSlider.svelte';
	import MultiSelect from '$lib/components/MultiSelect.svelte';
	import { ResyResponseHandler, type ResyVenue } from '$lib/models/ResyResponse';
	import type { ActionData } from './$types';
	import { Button, Input, Label, Select } from '$lib/components/ui';
	import { Calendar as CalendarComponent } from '$lib/components/ui/calendar/index.js';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Spinner } from '$lib/components/ui/spinner/index.js';
	import { Calendar as CalendarIcon, ChevronDown } from 'lucide-svelte';
	import { DateFormatter, type DateValue, parseDate, today, getLocalTimeZone } from '@internationalized/date';
	import { cn } from '$lib/utils.js';
	import { buttonVariants } from '$lib/components/ui/button/index.js';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
	import { Separator } from '$lib/components/ui/separator/index.js';

	interface Props {
		form: ActionData;
		data: { url: { searchParams: Record<string, string> } };
	}

	let { form, data }: Props = $props();

	// Get URL search parameters
	const urlParams = {
		get: (key: string) => data.url.searchParams[key] || null
	};
	
	// Constants for time calculations
	const MIN_HOUR = 9; // 9 AM
	const MAX_HOUR = 23; // 11 PM
	const TOTAL_INTERVALS = 56; // (23-9) * 4 = 56 fifteen-minute intervals
	
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
	let sortBy = $state('default'); // default, rating, distance

	// Pagination state
	let currentPage = $state(1);
	let pageSize = $state(10); // Default to 20 results per page
	let pageSizeOptions = [
		{ value: 10, label: '10 per page' },
		{ value: 20, label: '20 per page' },
		{ value: 50, label: '50 per page' }
	];

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

	const handleLogout = () => {
		const form = document.createElement('form');
		form.method = 'POST';
		form.action = '?/logout';
		document.body.appendChild(form);
		form.submit();
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

	const scrollToResults = () => {
		if (resultsSection) {
			resultsSection.scrollIntoView({ 
				behavior: 'smooth', 
				block: 'start' 
			});
		}
	};
</script>

<svelte:head>
	<title>Search - JennyTime</title>
</svelte:head>

<div class="container mx-auto max-w-6xl p-6 space-y-8">
	<div class="flex items-center justify-between">
		<h1 class="text-3xl font-bold">Restaurant Search</h1>
		<div class="flex items-center gap-2">
			<ThemeToggle />
			<Button variant="secondary" onclick={handleLogout}>Logout</Button>
		</div>
	</div>

	<form method="POST" action="?/search" use:enhance={handleSubmit} class="space-y-6">
		<!-- City/Address Row - Full Width -->
		<div class="space-y-2">
			<Label for="city">City/Address</Label>
			<Input
				type="text"
				id="city"
				name="city"
				bind:value={city}
				placeholder="City, neighborhood, or address (e.g., New York, SoHo NYC, Times Square)"
				disabled={loading}
				required
			/>
		</div>

		<Separator class="!bg-black dark:!bg-white" />

		<!-- Second Row: Date, Seats, Radius, Seating -->
		<div class="flex flex-col lg:flex-row gap-4 items-stretch">
			<div class="flex-[2] space-y-2">
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

			<Separator orientation="vertical" class="!w-px h-16 !bg-black dark:!bg-white hidden lg:block self-center" />

			<div class="flex-1 space-y-2">
				<Label for="partySize">Seats</Label>
				<Select id="partySize" name="partySize" bind:value={partySize} disabled={loading}>
					<option value="1">1</option>
					<option value="2">2</option>
					<option value="3">3</option>
					<option value="4">4</option>
					<option value="5">5</option>
					<option value="6">6</option>
					<option value="7">7</option>
					<option value="8">8</option>
					<option value="9">9</option>
					<option value="10">10+</option>
				</Select>
			</div>

			<Separator orientation="vertical" class="!w-px h-16 !bg-black dark:!bg-white hidden lg:block self-center" />

			<div class="flex-1 space-y-2">
				<Label for="searchRadius">Radius (miles)</Label>
				<Input
					type="number"
					id="searchRadius"
					name="searchRadius"
					bind:value={searchRadius}
					min="0.5"
					max="50"
					step="0.5"
					placeholder="3"
					disabled={loading}
					required
				/>
			</div>

			<Separator orientation="vertical" class="!w-px h-16 !bg-black dark:!bg-white hidden lg:block self-center" />

			<div class="flex-[2] space-y-2">
				<Label for="seatingType">Seating Preference</Label>
				<Select id="seatingType" name="seatingType" bind:value={seatingType} disabled={loading}>
					<option value="">No Preference</option>
					<option value="indoor">Indoor</option>
					<option value="outdoor">Outdoor</option>
				</Select>
			</div>
		</div>

		<Separator class="!bg-black dark:!bg-white" />

		<!-- Time Slider Row - Full Width -->
		<div class="space-y-2">
			<Label>Time Window</Label>
			<TimeRangeSlider
				bind:value={timeValues}
				min={9 * 60}
				max={23 * 60}
				step={15}
				disabled={loading}
				formatLabel={formatTime}
			/>
			<!-- Hidden inputs for form submission -->
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

	<!-- Results Section -->
	{#if form}
		{#if form.success && form.results}
			<div class="space-y-6" bind:this={resultsSection}>
				<div class="space-y-4">
					<h2 class="text-2xl font-semibold">Search Results</h2>
					{#if form.results.search?.hits && form.results.search.hits.length > 0}
						<div class="flex flex-wrap gap-4 items-end">
							<div class="space-y-2 flex-1 min-w-[200px]">
								<Label for="sortBy">Sort by</Label>
								<Select id="sortBy" bind:value={sortBy}>
									<option value="default">Least Reservations</option>
									<option value="rating">Highest Rated</option>
									<option value="distance">Distance (Closest First)</option>
								</Select>
							</div>
							<div class="space-y-2 flex-1 min-w-[200px]">
								<Label for="priceRanges">Price Range</Label>
								<MultiSelect
									options={priceRangeOptions}
									bind:selected={selectedPriceRanges}
									placeholder="All prices"
									disabled={loading}
									name="priceRanges"
									id="priceRanges"
								/>
							</div>
							<div class="space-y-2 min-w-[150px]">
								<Label for="pageSize">Show</Label>
								<Select id="pageSize" bind:value={pageSize} onchange={() => currentPage = 1}>
									{#each pageSizeOptions as option}
										<option value={option.value}>{option.label}</option>
									{/each}
								</Select>
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
					{@const selectedPriceIds = selectedPriceRanges.map(p => parseInt(p))}
					{@const venuesWithSlots = resyHandler.filterVenuesByTimeAndPrice(timeStart, timeEnd, selectedPriceIds)}
					{@const venuesWithoutSlots = resyHandler.getVenues().filter(venue => !venuesWithSlots.includes(venue))}
					{@const sortedVenues = getSortedVenues(venuesWithSlots, sortBy)}
					{@const totalPages = getTotalPages(sortedVenues.length, pageSize)}
					{@const paginatedVenues = getPaginatedVenues(sortedVenues, currentPage, pageSize)}
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
										{#each Array(totalPages).fill().map((_, i) => i + 1) as page}
											{#if page === currentPage || page === 1 || page === totalPages || (page >= currentPage - 1 && page <= currentPage + 1)}
												<Button
													variant={page === currentPage ? 'default' : 'outline'}
													onclick={() => {
														if (page !== currentPage) {
															currentPage = page;
															scrollToResults();
														}
													}}
													class="min-w-[2.5rem]"
												>
													{page}
												</Button>
											{:else if page === currentPage - 2 || page === currentPage + 2}
												<span class="px-2">...</span>
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
							<Card.Card>
								<Card.Header class="cursor-pointer" onclick={() => toggleCard(venue.objectID)}>
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

								<Card.Content>
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
														{@html resyHandler.getVenueContent(venue, 'about').replace(/\n/g, '<br>')}
													</div>
												</details>
											{/if}

											{#if resyHandler.getVenueContent(venue, 'need_to_know')}
												<details class="restaurant-details need-to-know">
													<summary class="details-summary">💡 Need to Know</summary>
													<div class="restaurant-description important">
														{@html resyHandler.getVenueContent(venue, 'need_to_know').replace(/\n/g, '<br>')}
													</div>
												</details>
											{/if}

											{#if resyHandler.getVenueContent(venue, 'why_we_like_it')}
												<details class="restaurant-details why-like">
													<summary class="details-summary">⭐ Why We Like It</summary>
													<div class="restaurant-description highlight">
														{@html resyHandler.getVenueContent(venue, 'why_we_like_it').replace(/\n/g, '<br>')}
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
							</Card.Card>
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
									{#each Array(totalPages).fill().map((_, i) => i + 1) as page}
										{#if page === currentPage || page === 1 || page === totalPages || (page >= currentPage - 1 && page <= currentPage + 1)}
											<Button
												variant={page === currentPage ? 'default' : 'outline'}
												onclick={() => {
													if (page !== currentPage) {
														currentPage = page;
														scrollToResults();
													}
												}}
												class="min-w-[2.5rem]"
											>
												{page}
											</Button>
										{:else if page === currentPage - 2 || page === currentPage + 2}
											<span class="px-2">...</span>
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
		{:else if form.success === false}
			<div class="error-section">
				<h2>Search Error</h2>
				<p class="error-message">{form.error || 'An unexpected error occurred'}</p>
			</div>
		{/if}
	{/if}
</div>

