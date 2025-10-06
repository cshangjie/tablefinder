import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getGeocodingQuotaManager } from '$lib/server/geocoding';

// Helper function to normalize and match city names
const normalizeCityName = (city: string): string => {
  const normalized = city.toLowerCase().trim();
  
  // Handle common abbreviations and variations
  const cityAliases: Record<string, string> = {
    'ny': 'new york',
    'nyc': 'new york',
    'new york city': 'new york',
    'sf': 'san francisco',
    'la': 'los angeles',
    'dc': 'washington dc',
    'philly': 'philadelphia'
  };
  
  return cityAliases[normalized] || normalized;
};

export const POST: RequestHandler = async ({ request }) => {
  try {
    const searchParams = await request.json();
    
    // Validate and normalize city input
    if (!searchParams.city || !searchParams.city.trim()) {
      return json({ 
        error: 'City is required', 
        message: 'Please enter a city name' 
      }, { status: 400 });
    }

    // Convert radius from miles to meters (1 mile = 1609.34 meters)
    const radiusInMiles = parseFloat(searchParams.searchRadius) || 2;
    const radiusInMeters = Math.round(radiusInMiles * 1609.34);
    
    // Note: Authentication tokens would need to be provided via environment variables
    
    // City coordinates mapping
    const cityCoordinates: Record<string, { lat: number; lng: number; locality: string }> = {
      'san francisco': { lat: 37.7577, lng: -122.4376, locality: 'San Francisco' },
      'sf': { lat: 37.7577, lng: -122.4376, locality: 'San Francisco' },
      'new york': { lat: 40.7589, lng: -73.9851, locality: 'New York' },
      'nyc': { lat: 40.7589, lng: -73.9851, locality: 'New York' },
      'new york city': { lat: 40.7589, lng: -73.9851, locality: 'New York' },
      'los angeles': { lat: 34.0549, lng: -118.2426, locality: 'Los Angeles' },
      'la': { lat: 34.0549, lng: -118.2426, locality: 'Los Angeles' },
      'chicago': { lat: 41.8758, lng: -87.6206, locality: 'Chicago' },
      'boston': { lat: 42.3582, lng: -71.0636, locality: 'Boston' },
      'washington dc': { lat: 38.8947, lng: -77.0365, locality: 'Washington' },
      'dc': { lat: 38.8947, lng: -77.0365, locality: 'Washington' },
      'miami': { lat: 25.7743, lng: -80.1937, locality: 'Miami' },
      'philadelphia': { lat: 39.9527, lng: -75.1635, locality: 'Philadelphia' },
      'seattle': { lat: 47.6205, lng: -122.3493, locality: 'Seattle' },
      'denver': { lat: 39.7399, lng: -104.9903, locality: 'Denver' },
      'atlanta': { lat: 33.7490, lng: -84.3880, locality: 'Atlanta' },
      'dallas': { lat: 32.7767, lng: -96.7970, locality: 'Dallas' },
      'austin': { lat: 30.2672, lng: -97.7431, locality: 'Austin' }
    };

    // Enhanced city resolution with geocoding fallback
    const quotaManager = getGeocodingQuotaManager();
    let latitude: number;
    let longitude: number;
    let expectedLocality: string;

    // Step 1: Try predefined city mapping first
    const normalizedCity = normalizeCityName(searchParams.city);
    const cityData = cityCoordinates[normalizedCity];
    
    if (cityData) {
      // Use predefined mapping
      latitude = cityData.lat;
      longitude = cityData.lng;
      expectedLocality = cityData.locality;
    } else {
      // Step 2: Use Mapbox geocoding API
      const coordinates = await quotaManager.geocode(searchParams.city);
      
      if (coordinates) {
        latitude = coordinates.lat;
        longitude = coordinates.lng;
        // For geocoded locations, we'll use the original input as the expected locality for filtering
        expectedLocality = searchParams.city;
      } else {
        // Step 3: Fallback to San Francisco if all else fails
        const mapboxQuota = await quotaManager.checkMapboxDailyQuota();
        const supportedCities = Object.values(cityCoordinates)
          .map(c => c.locality)
          .filter((city, index, arr) => arr.indexOf(city) === index)
          .sort()
          .join(', ');
        
        if (!mapboxQuota.available) {
          return json({ 
            error: 'Location not found', 
            message: `Mapbox geocoding service has reached daily limit (${mapboxQuota.used}/${mapboxQuota.limit}). Please use one of these supported cities: ${supportedCities}` 
          }, { status: 400 });
        } else {
          console.warn(`Unable to geocode: ${searchParams.city}. Defaulting to San Francisco.`);
          const fallbackCity = cityCoordinates['san francisco'];
          latitude = fallbackCity.lat;
          longitude = fallbackCity.lng;
          expectedLocality = fallbackCity.locality;
        }
      }
    }

    // Build request body for Resy API
    const slotFilter: any = {
      day: searchParams.res_date,
      party_size: parseInt(searchParams.party_size)
    };

    // Add time filter if provided
    if (searchParams.time_start && searchParams.time_end) {
      slotFilter.time_start = searchParams.time_start;
      slotFilter.time_end = searchParams.time_end;
    }

    // Add seating type filter if provided (indoor/outdoor)
    if (searchParams.seating_type) {
      if (searchParams.seating_type === 'indoor') {
        slotFilter.table_area = 'Indoor';
      } else if (searchParams.seating_type === 'outdoor') {
        slotFilter.table_area = 'Outdoor';
      }
    }

    const requestBody = {
      availability: true,
      page: 1,
      per_page: 500,
      slot_filter: slotFilter,
      types: ["venue"],
      order_by: "availability",
      geo: {
        latitude,
        longitude,
        radius: radiusInMeters
      },
      query: ""
    };

    // Log the query being made
    console.log('🔍 Resy API Query:');
    console.log('Search Params:', {
      city: searchParams.city,
      radiusInMiles,
      radiusInMeters,
      date: searchParams.res_date,
      partySize: searchParams.party_size
    });
    console.log('Request Body:');
    console.log(JSON.stringify(requestBody, null, 4));
    
    // Log the actual HTTP request being made to Resy API
    const resyApiUrl = 'https://api.resy.com/3/venuesearch/search';
    const resyHeaders = {
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Authorization': `ResyAPI api_key="VbWk7s3L4KiK5fzlO7JD3Q5EYolJI7n5"`,
      'Cache-Control': 'no-cache',
      'Content-Type': 'application/json',
      'Origin': 'https://resy.com',
      'Referer': 'https://resy.com/',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
      'X-Origin': 'https://resy.com'
    };
    
    console.log('🚀 Making HTTP Request to Resy API:');
    console.log('URL:', resyApiUrl);
    console.log('Method: POST');
    console.log('Headers:');
    console.log(JSON.stringify(resyHeaders, null, 2));
    console.log('Body:');
    console.log(JSON.stringify(requestBody, null, 2));
    
    // Call Resy API with proper headers
    const response = await fetch(resyApiUrl, {
      method: 'POST',
      headers: resyHeaders,
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      throw new Error(`Resy API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Add the complete HTTP request details to the response for debugging
    data._debugRequest = requestBody;
    console.log('✅ Added debug request to response:', data._debugRequest);
    
    // Filter venues to ensure locality matches the entered city
    const filteredVenues = (data.search?.hits || []).filter((venue: any) => {
      if (!venue.locality) return false;
      
      // Normalize locality for comparison
      const venueLocality = venue.locality.toLowerCase().trim();
      const expectedLocalityLower = expectedLocality.toLowerCase();
      
      // For predefined cities, use strict matching
      if (cityData) {
        return venueLocality === expectedLocalityLower || 
               venueLocality.includes(expectedLocalityLower) ||
               expectedLocalityLower.includes(venueLocality);
      } else {
        // For geocoded locations, be more flexible with matching
        // Extract the main city name from the geocoded query
        const mainCity = searchParams.city.split(',')[0].toLowerCase().trim();
        return venueLocality.includes(mainCity) || mainCity.includes(venueLocality);
      }
    });
    
    // Update search results with filtered venues
    const filteredData = {
      ...data,
      search: {
        ...data.search,
        hits: filteredVenues
      }
    };
    
    // Clean and format response for frontend
    const cleanedResults = {
      results: filteredData.results || [],
      search: filteredData.search || {},
      meta: filteredData.meta || {},
      pagination: filteredData.pagination || {},
      searchLocation: { lat: latitude, lng: longitude }
    };

    return json(cleanedResults);
    
  } catch (error) {
    console.error('Search API error:', error);
    return json({ 
      error: 'Search failed', 
      message: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
};

