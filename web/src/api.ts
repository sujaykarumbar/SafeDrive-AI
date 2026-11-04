const API_BASE = 'http://localhost:8000/api/v1';

export interface User {
  id: number;
  email: string;
  name: string;
  role: string;
  phone?: string;
}

export interface MonitoredDriver {
  driver_id: number;
  driver_name: string;
  phone?: string;
  safety_score: number;
  safety_status: string;
  vehicle_category?: string;
  vehicle_label?: string;
  avatar?: string;
  active_trip?: {
    id: number;
    start_time: string;
    distance_km: number;
    duration_minutes: number;
    start_address?: string;
    end_address?: string;
    risk_score: number;
    risk_level: string;
    risk_factors?: string[];
  };
  last_location?: {
    latitude: number;
    longitude: number;
    speed_kmh: number;
    heading: number;
    battery_level: number;
    timestamp: string;
  };
}

export interface CaretakerOverview {
  total_drivers: number;
  active_vehicles: number;
  fleet_safety_score: number;
  active_emergencies: number;
  weekly_analytics: Array<{
    day: string;
    safe: number;
    risk: number;
    trips: number;
  }>;
  recent_alerts: Array<{
    id: string;
    type: string;
    title: string;
    time: string;
    severity: string;
  }>;
  safety_insights: {
    score_percentage: number;
    headline: string;
    vs_last_week: string;
    highlights: string[];
  };
}

export interface EmergencyIncident {
  id: number;
  trip_id?: number;
  driver_id: number;
  driver_name?: string;
  incident_type?: string;
  trigger_type?: string;
  severity?: string;
  status: string;
  escalation_level: number;
  latitude: number;
  longitude: number;
  address?: string;
  location_address?: string;
  created_at: string;
  g_force?: number;
  speed_at_incident?: number;
  acknowledged_by?: string;
  acknowledged_by_name?: string;
  medical_snapshot?: {
    blood_group?: string;
    emergency_contact?: string;
    emergency_contact_phone?: string;
    allergies?: string;
    driver_phone?: string;
  };
  notes?: string;
}

export interface Hazard {
  id: number;
  reporter_id?: number;
  reporter_name?: string;
  hazard_type: string;
  severity: string;
  status: string;
  title: string;
  description?: string;
  latitude: number;
  longitude: number;
  address?: string;
  image_url?: string;
  fixed_image_url?: string;
  assigned_department?: string;
  confirmation_count: number;
  created_at: string;
}

export interface TripHistoryItem {
  id: number;
  driver_id: number;
  vehicle_id?: number;
  status: string;
  start_time: string;
  end_time?: string;
  start_address?: string;
  end_address?: string;
  distance_km: number;
  duration_minutes: number;
  avg_speed_kmh: number;
  max_speed_kmh: number;
  risk_score: number;
  risk_level: string;
  risk_factors?: string[];
  summary_notes?: string;
}

export interface AuditLog {
  id: number;
  user_email?: string;
  action: string;
  details?: string;
  ip_address?: string;
  timestamp: string;
}

let storedToken: string | null = localStorage.getItem('safedrive_token');

export const setStoredToken = (token: string | null) => {
  storedToken = token;
  if (token) {
    localStorage.setItem('safedrive_token', token);
  } else {
    localStorage.removeItem('safedrive_token');
  }
};

export const getStoredToken = () => {
  if (!storedToken) {
    storedToken = localStorage.getItem('safedrive_token');
  }
  return storedToken;
};

export const apiFetch = async (endpoint: string, options: RequestInit = {}): Promise<any> => {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {})
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API Error [${response.status}]: ${errorText}`);
  }

  return response.json();
};
