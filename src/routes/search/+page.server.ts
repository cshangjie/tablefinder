import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ cookies, url }) => {
	const session = cookies.get('session');
	if (session !== 'authenticated') {
		throw redirect(303, '/');
	}
	
	return {
		url: {
			searchParams: Object.fromEntries(url.searchParams.entries())
		}
	};
};

export const actions: Actions = {
	search: async ({ request, fetch }) => {
		try {
			const data = await request.formData();
			
			// Prepare search parameters for internal API
			const searchParams = {
				party_size: data.get('partySize') as string,
				res_date: data.get('reservationDate') as string,
				city: data.get('city') as string,
				time_start: data.get('timeStart') as string,
				time_end: data.get('timeEnd') as string,
				location: '', // Removed separate address field - now handled within city
				searchRadius: data.get('searchRadius') as string || '3', // Get radius from form
				collection: '',
				cuisine: '',
				seating_type: data.get('seatingType') as string || '',
				price_ranges: ''
			};
			
			// Call internal search API
			const response = await fetch('/api/search', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(searchParams)
			});
			
			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				throw new Error(errorData.message || `API error: ${response.status}`);
			}
			
			const results = await response.json();
			
			console.log('📋 Debug check - results._debugRequest:', results._debugRequest);
			
			return {
				success: true,
				results,
				searchParams
			};
			
		} catch (error) {
			console.error('Search action error:', error);
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Search failed',
				searchParams: {}
			};
		}
	},
	
	logout: async ({ cookies }) => {
		cookies.delete('session', { path: '/' });
		throw redirect(303, '/');
	}
};