import Database from 'better-sqlite3';
import { env } from '$env/dynamic/private';

interface QuotaEntry {
  date: string;
  request_count: number;
}

export class GeocodingQuotaManager {
  private db: Database.Database;
  private mapboxDailyQuotaLimit = 50000; // Mapbox free tier: 50,000 requests/month (~1,667/day)

  constructor() {
    this.db = new Database('./data/quota.db');
    this.initializeTables();
  }

  private initializeTables(): void {
    // Create Mapbox quota tracking table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS mapbox_quota_tracking (
        date TEXT PRIMARY KEY,
        request_count INTEGER DEFAULT 0
      )
    `);

    // Create geocoding cache table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS geocoding_cache (
        normalized_query TEXT PRIMARY KEY,
        original_query TEXT,
        lat REAL NOT NULL,
        lng REAL NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  private normalizeAddress(address: string): string {
    return address
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ')  // Multiple spaces to single space
      .replace(/\bstreet\b/g, 'st')
      .replace(/\bboulevard\b/g, 'blvd')
      .replace(/\bavenue\b/g, 'ave')
      .replace(/\bdrive\b/g, 'dr')
      .replace(/\broad\b/g, 'rd')
      .replace(/\blane\b/g, 'ln')
      .replace(/\bcourt\b/g, 'ct')
      .replace(/\bsaint\b/g, 'st')
      .replace(/\bsan francisco\b/g, 'sf')
      .replace(/[,\.]/g, '')  // Remove commas and periods
      .replace(/\s+/g, ' ')  // Clean up spaces again
      .trim();
  }

  private getCachedGeocode(query: string): { lat: number; lng: number } | null {
    const normalized = this.normalizeAddress(query);

    // Try exact match first
    const exactStmt = this.db.prepare(`
      SELECT lat, lng FROM geocoding_cache WHERE normalized_query = ?
    `);
    const exactResult = exactStmt.get(normalized) as { lat: number; lng: number } | undefined;

    if (exactResult) {
      console.log('✨ Geocoding cache hit (exact):', {
        inputAddress: query,
        normalizedAddress: normalized,
        cachedCoordinates: exactResult
      });
      return exactResult;
    }

    // Try partial/prefix match - find cached entries that start with our query
    const prefixStmt = this.db.prepare(`
      SELECT lat, lng, normalized_query
      FROM geocoding_cache
      WHERE normalized_query LIKE ? || '%'
      ORDER BY LENGTH(normalized_query) ASC
      LIMIT 1
    `);
    const prefixResult = prefixStmt.get(normalized) as { lat: number; lng: number; normalized_query: string } | undefined;

    if (prefixResult) {
      console.log('✨ Geocoding cache hit (partial):', {
        inputAddress: query,
        normalizedAddress: normalized,
        matchedAddress: prefixResult.normalized_query,
        cachedCoordinates: { lat: prefixResult.lat, lng: prefixResult.lng }
      });
      return { lat: prefixResult.lat, lng: prefixResult.lng };
    }

    return null;
  }

  private cacheGeocode(query: string, lat: number, lng: number): void {
    const normalized = this.normalizeAddress(query);
    const stmt = this.db.prepare(`
      INSERT INTO geocoding_cache (normalized_query, original_query, lat, lng)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(normalized_query)
      DO UPDATE SET original_query = ?, lat = ?, lng = ?, created_at = CURRENT_TIMESTAMP
    `);
    stmt.run(normalized, query, lat, lng, query, lat, lng);
  }



  async checkMapboxDailyQuota(): Promise<{ available: boolean; used: number; limit: number }> {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    
    const stmt = this.db.prepare(`
      SELECT request_count FROM mapbox_quota_tracking WHERE date = ?
    `);
    
    const result = stmt.get(today) as { request_count: number } | undefined;
    const used = result?.request_count || 0;
    
    return {
      available: used < this.mapboxDailyQuotaLimit,
      used,
      limit: this.mapboxDailyQuotaLimit
    };
  }

  async incrementMapboxQuota(): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    
    const stmt = this.db.prepare(`
      INSERT INTO mapbox_quota_tracking (date, request_count)
      VALUES (?, 1)
      ON CONFLICT(date) 
      DO UPDATE SET request_count = request_count + 1
    `);
    
    stmt.run(today);
  }

  async geocodeWithMapbox(query: string): Promise<{ lat: number; lng: number } | null> {
    const quota = await this.checkMapboxDailyQuota();
    
    if (!quota.available) {
      console.warn(`Mapbox Geocoding quota exceeded: ${quota.used}/${quota.limit} for today`);
      return null;
    }

    const apiKey = env.MAPBOX_ACCESS_TOKEN;
    if (!apiKey) {
      console.error('MAPBOX_ACCESS_TOKEN not configured');
      return null;
    }

    console.log('🗺️ Mapbox Geocoding Request:', { 
      inputAddress: query,
      quotaUsed: quota.used,
      quotaLimit: quota.limit 
    });

    try {
      const encodedQuery = encodeURIComponent(query);
      const requestUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedQuery}.json?access_token=${apiKey}&limit=1`;
      
      const response = await fetch(requestUrl);

      if (!response.ok) {
        throw new Error(`Mapbox Geocoding API error: ${response.status}`);
      }

      const data = await response.json();
      
      // Increment quota after successful API call
      await this.incrementMapboxQuota();

      if (data.features && data.features.length > 0) {
        const [lng, lat] = data.features[0].center;
        const coordinates = { lat, lng };
        
        console.log('✅ Mapbox Geocoding Success:', {
          inputAddress: query,
          returnedCoordinates: coordinates,
          placeName: data.features[0].place_name,
          quotaAfterRequest: quota.used + 1
        });
        
        return coordinates;
      } else {
        console.warn(`❌ Mapbox Geocoding failed for "${query}": No results found`);
        return null;
      }
    } catch (error) {
      console.error('💥 Error calling Mapbox Geocoding API:', error);
      return null;
    }
  }


  async geocode(query: string): Promise<{ lat: number; lng: number } | null> {
    // Check cache first
    const cached = this.getCachedGeocode(query);
    if (cached) {
      return cached;
    }

    // If not cached, geocode with Mapbox
    const result = await this.geocodeWithMapbox(query);

    // Cache the result if successful
    if (result) {
      this.cacheGeocode(query, result.lat, result.lng);
    }

    return result;
  }

  getQuotaStats(): {
    mapboxUsageToday: number;
    mapboxLimit: number;
  } {
    const today = new Date().toISOString().split('T')[0];

    const mapboxUsageStmt = this.db.prepare(`
      SELECT request_count FROM mapbox_quota_tracking WHERE date = ?
    `);
    const mapboxUsage = mapboxUsageStmt.get(today) as { request_count: number } | undefined;

    return {
      mapboxUsageToday: mapboxUsage?.request_count || 0,
      mapboxLimit: this.mapboxDailyQuotaLimit
    };
  }

  getCacheStats(): {
    totalCached: number;
    cacheSize: string;
  } {
    const countStmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM geocoding_cache
    `);
    const result = countStmt.get() as { count: number };

    // Get rough database size
    const sizeStmt = this.db.prepare(`
      SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()
    `);
    const sizeResult = sizeStmt.get() as { size: number };
    const sizeKB = (sizeResult.size / 1024).toFixed(2);

    return {
      totalCached: result.count,
      cacheSize: `${sizeKB} KB`
    };
  }

  close(): void {
    this.db.close();
  }
}

// Singleton instance
let quotaManager: GeocodingQuotaManager | null = null;

export function getGeocodingQuotaManager(): GeocodingQuotaManager {
  if (!quotaManager) {
    quotaManager = new GeocodingQuotaManager();
  }
  return quotaManager;
}