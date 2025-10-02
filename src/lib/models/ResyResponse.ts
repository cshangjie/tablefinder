export interface ResyLocation {
  name: string;
  id: number;
  url_slug: string;
  code: string;
}

export interface ResyRating {
  average: number;
  count: number;
}

export interface ResyCollection {
  short_name: string;
  image: string;
  type_id: number;
  name: string;
  id: string;
  collection_slug: string;
  file_name: string;
}

export interface ResyContact {
  phone_number: string;
}

export interface ResyGeolocation {
  lat: number;
  lng: number;
}

export interface ResySlotConfig {
  token: string;
  id: number;
  type: string;
}

export interface ResySlotDate {
  start: string;
  end: string;
}

export interface ResySlotShift {
  service: {
    type: {
      id: number;
    };
  };
  id: number;
  day: string;
}

export interface ResySlotTemplate {
  id: number;
}

export interface ResySlotExclusive {
  is_eligible: boolean;
  id: number;
}

export interface ResySlotDisplayConfig {
  color: {
    background: string | null;
    font: string | null;
  };
}

export interface ResySlotReservationConfig {
  badge: string | null;
}

export interface ResySlot {
  reservation_config: ResySlotReservationConfig;
  template: ResySlotTemplate;
  exclusive: ResySlotExclusive;
  date: ResySlotDate;
  shift: ResySlotShift;
  config: ResySlotConfig;
  is_global_dining_access: boolean;
  has_add_ons: boolean;
  display_config: ResySlotDisplayConfig;
}

export interface ResyAvailability {
  slots: ResySlot[];
}

export interface ResyContentItem {
  name: string;
  body: string;
}

export interface ResyContent {
  [key: string]: ResyContentItem | ResyContentItem[];
}

export interface ResyHighlightResult {
  location?: {
    name: {
      value: string;
      matchLevel: string;
      matchedWords: string[];
    };
  };
  locality?: {
    value: string;
    matchLevel: string;
    matchedWords: string[];
  };
  neighborhood?: {
    value: string;
    matchLevel: string;
    matchedWords: string[];
  };
  cuisine?: Array<{
    value: string;
    matchLevel: string;
    matchedWords: string[];
  }>;
  name?: {
    value: string;
    matchLevel: string;
    matchedWords: string[];
  };
}

export interface ResySource {
  terms_of_service: string | null;
  name: string | null;
  logo: string | null;
  privacy_policy: string | null;
}

export interface ResyVenue {
  collections: ResyCollection[];
  objectID: string;
  url_slug: string;
  source: ResySource;
  rating?: ResyRating;
  is_rga: number;
  feature_recaptcha: boolean;
  reopen: {
    date: string | null;
  };
  locality: string;
  currency_symbol: string;
  inventory_event: string[];
  min_party_size: number;
  inventory_reservation: string[];
  collection: string[];
  is_global_dining_access: boolean;
  global_dining_access: number;
  last_updated_at: number;
  contact: ResyContact;
  inventory_type_id: number;
  _highlightResult: ResyHighlightResult;
  country: string;
  currency_code: string;
  location: ResyLocation;
  images: string[];
  gda_concierge_booking: boolean;
  id: {
    resy: number;
  };
  _geoloc: ResyGeolocation;
  is_gdc: number;
  menu_highlights: string[];
  max_party_size: number;
  is_gns: number;
  requires_reservation_transfers: number;
  availability?: ResyAvailability;
  content?: ResyContent | ResyContentItem[];
  price_range_id?: number;
  name?: string;
}

export interface ResySearchResult {
  hitsPerPage: number;
  hits: ResyVenue[];
}

export interface ResyResponse {
  search: ResySearchResult;
  results?: any[];
  meta?: any;
  pagination?: any;
  searchLocation?: { lat: number; lng: number };
}

export class ResyResponseHandler {
  private response: ResyResponse;
  private searchLocation?: { lat: number; lng: number };

  constructor(response: ResyResponse) {
    this.response = response;
    this.searchLocation = response.searchLocation;
  }

  // Calculate distance between two coordinates using Haversine formula (in miles)
  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 3959; // Earth's radius in miles
    const dLat = this.toRadians(lat2 - lat1);
    const dLng = this.toRadians(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  getVenues(): ResyVenue[] {
    return this.response.search?.hits || [];
  }

  getVenuesWithAvailability(): ResyVenue[] {
    return this.getVenues().filter(venue => 
      venue.availability?.slots && venue.availability.slots.length > 0
    );
  }

  getVenuesByPriceRange(priceRanges: number[]): ResyVenue[] {
    if (priceRanges.length === 0) return this.getVenues();
    return this.getVenues().filter(venue => 
      venue.price_range_id && priceRanges.includes(venue.price_range_id)
    );
  }

  getVenuesByTimeWindow(startMinutes: number, endMinutes: number): ResyVenue[] {
    return this.getVenues().filter(venue => {
      if (!venue.availability?.slots) return false;
      
      return venue.availability.slots.some(slot => {
        const slotStart = new Date(slot.date.start);
        const slotEnd = new Date(slot.date.end);
        const slotStartMinutes = slotStart.getHours() * 60 + slotStart.getMinutes();
        const slotEndMinutes = slotEnd.getHours() * 60 + slotEnd.getMinutes();
        
        // Check for time window overlap: slot overlaps with user's desired time range
        return (slotStartMinutes < endMinutes && slotEndMinutes > startMinutes);
      });
    });
  }

  sortVenues(sortType: 'rating' | 'distance' | 'availability' | 'default'): ResyVenue[] {
    const venues = [...this.getVenues()];

    switch (sortType) {
      case 'rating':
        return venues.sort((a, b) => {
          const ratingA = a.rating?.average || 0;
          const ratingB = b.rating?.average || 0;
          return ratingB - ratingA;
        });

      case 'distance':
        if (!this.searchLocation) {
          console.warn('No search location available for distance sorting');
          return venues;
        }
        return venues.sort((a, b) => {
          const distanceA = a._geoloc
            ? this.calculateDistance(
                this.searchLocation!.lat,
                this.searchLocation!.lng,
                a._geoloc.lat,
                a._geoloc.lng
              )
            : Infinity;
          const distanceB = b._geoloc
            ? this.calculateDistance(
                this.searchLocation!.lat,
                this.searchLocation!.lng,
                b._geoloc.lat,
                b._geoloc.lng
              )
            : Infinity;
          return distanceA - distanceB; // Closest first
        });

      case 'availability':
        return venues.sort((a, b) => {
          const slotsA = a.availability?.slots?.length || 0;
          const slotsB = b.availability?.slots?.length || 0;
          return slotsB - slotsA; // Most slots first
        });

      default:
        return venues.sort((a, b) => {
          const slotsA = a.availability?.slots?.length || 0;
          const slotsB = b.availability?.slots?.length || 0;
          return slotsA - slotsB; // Least slots first
        });
    }
  }

  getVenueContent(venue: ResyVenue, contentType: 'about' | 'need_to_know' | 'why_we_like_it'): string | null {
    if (!venue.content) return null;

    // Handle array structure
    if (Array.isArray(venue.content)) {
      const contentItem = venue.content.find(item => item.name === contentType);
      return contentItem?.body || null;
    }

    // Handle nested structure with language code
    if (venue.content['en-us'] && typeof venue.content['en-us'] === 'object') {
      const langContent = venue.content['en-us'] as any;
      return langContent[contentType]?.body || null;
    }

    return null;
  }

  getVenueDisplayName(venue: ResyVenue): string {
    return venue._highlightResult?.name?.value || venue.name || 'Unknown Restaurant';
  }

  getVenueCuisineTypes(venue: ResyVenue): string[] {
    if (!venue._highlightResult?.cuisine) return [];
    return venue._highlightResult.cuisine.map(c => c.value);
  }

  getVenueNeighborhood(venue: ResyVenue): string | null {
    return venue._highlightResult?.neighborhood?.value || null;
  }

  formatVenuePrice(venue: ResyVenue): string {
    if (!venue.price_range_id) return '';
    switch (venue.price_range_id) {
      case 1: return '$';
      case 2: return '$$';
      case 3: return '$$$';
      default: return '';
    }
  }

  formatSlotTime(slot: ResySlot): string {
    const startTime = new Date(slot.date.start);
    return startTime.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  }

  getSlotDuration(slot: ResySlot): number {
    const start = new Date(slot.date.start);
    const end = new Date(slot.date.end);
    return Math.round((end.getTime() - start.getTime()) / (1000 * 60));
  }

  generateResyUrl(venue: ResyVenue, date: string, partySize: string): string {
    const locationSlug = venue.location?.url_slug || 'san-francisco-ca';
    return `https://resy.com/cities/${locationSlug}/venues/${venue.url_slug}?date=${date}&seats=${partySize}`;
  }

  getTotalVenueCount(): number {
    return this.getVenues().length;
  }

  getAvailableVenueCount(): number {
    return this.getVenuesWithAvailability().length;
  }

  filterVenuesByTimeAndPrice(
    timeStartMinutes: number, 
    timeEndMinutes: number, 
    priceRanges: number[] = []
  ): ResyVenue[] {
    let venues = this.getVenuesByTimeWindow(timeStartMinutes, timeEndMinutes);
    
    if (priceRanges.length > 0) {
      venues = venues.filter(venue => 
        venue.price_range_id && priceRanges.includes(venue.price_range_id)
      );
    }
    
    return venues;
  }
}