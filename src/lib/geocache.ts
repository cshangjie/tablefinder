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
    return await this.geocodeWithMapbox(query);
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