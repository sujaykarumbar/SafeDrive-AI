const API_BASE = 'http://localhost:8000/api/v1';

export interface User {
  id: number;
  email: string;
  name: string;
  role: string;
  phone?: string;
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
  status_history?: Array<{
    id: number;
    new_status: string;
    notes?: string;
    proof_image_url?: string;
    changed_by_name?: string;
    created_at: string;
  }>;
}

export interface DepartmentMetrics {
  total_reported: number;
  open: number;
  assigned: number;
  in_progress: number;
  fixed: number;
  critical_unresolved: number;
  avg_fix_time_hours: number;
}

let storedToken: string | null = localStorage.getItem('safedrive_roaddept_token');

export const setStoredToken = (token: string | null) => {
  storedToken = token;
  if (token) {
    localStorage.setItem('safedrive_roaddept_token', token);
  } else {
    localStorage.removeItem('safedrive_roaddept_token');
  }
};

export const getStoredToken = () => {
  if (!storedToken) {
    storedToken = localStorage.getItem('safedrive_roaddept_token');
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

