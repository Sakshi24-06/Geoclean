export type Role = 'user' | 'ngo' | 'admin';

export type AuthUser = {
  id: string;
  role: Role;
  name: string;
  email: string;
  phone?: string;
  organization?: string;
  contactPerson?: string;
  orgId?: string;
  location?: string;
  area?: string;
  locality?: string;
  landmark?: string;
  street?: string;
  district?: string;
  state?: string;
  pincode?: string;
  avatarUrl?: string;
  description?: string;
  website?: string;
  services?: string;
  initiatives?: string;
  socialLink?: string;
  createdAt: string;
};

export interface StructuredLocation {
  area: string;
  locality: string;
  landmark: string;
  street: string;
  district: string;
  state: string;
  pincode: string;
  country: string;
  latitude?: number | null;
  longitude?: number | null;
  source: 'CURRENT_LOCATION' | 'MANUAL';
  formattedAddress?: string;
}

export type ReportStatus =
  | 'Submitted'
  | 'Assigned'
  | 'In Progress'
  | 'Resolving'
  | 'Resolved'
  | 'Available'
  | 'Available Again'
  | 'Deleted';

export type StatusHistoryItem = {
  status: 'Submitted' | 'Assigned' | 'In Progress' | 'Resolving' | 'Resolved';
  timestamp: string;
  updatedBy?: string;
  note?: string;
};

export type Report = {
  id: string;
  dbId?: string;
  issueType: string;
  location: string;
  structuredLocation?: StructuredLocation;
  locationSource?: 'CURRENT_LOCATION' | 'MANUAL';
  locationDescription?: string;
  locationDetails?: {
    area?: string;
    locality?: string;
    landmark?: string;
    street?: string;
    city?: string;
    district?: string;
    state?: string;
    pincode?: string;
    country?: string;
  };
  coordinates?: string;
  latitude?: number;
  longitude?: number;
  readableLocation?: string;
  description: string;
  photo?: string;
  beforePhoto?: string;
  afterPhoto?: string;
  imageSource?: 'CAMERA' | 'GALLERY';
  imageVerificationStatus?: 'VERIFIED' | 'FAILED' | 'PENDING';
  imageConfidence?: number;
  detectedWasteTypes?: string[];
  createdAt: string;
  resolvedAt?: string;
  status: ReportStatus;
  assignedTo?: string;
  assignedNgoId?: string;
  assignedNgoName?: string;
  resolvedByNgoName?: string;
  reporterEmail?: string;
  reporterName?: string;
  reporterId?: string;
  completionRemarks?: string;
  startedAt?: string;
  assignmentHistory?: { ngo: string; action: 'Accepted' | 'Released'; timestamp: string; reason?: string }[];
  statusHistory?: StatusHistoryItem[];
  deleted?: boolean;
  deletedAt?: string;
  deletedBy?: string;
  deletionReason?: string;
};

export type NotificationType =
  | 'REPORT_SUBMITTED'
  | 'REPORT_ASSIGNED'
  | 'REPORT_IN_PROGRESS'
  | 'REPORT_RESOLVING'
  | 'REPORT_RESOLVED'
  | 'REPORT_DELETED'
  | 'COMMUNITY_UPDATE';

export type Notice = {
  id: string;
  userId?: string;
  title: string;
  detail: string;
  time: string;
  createdAt: string;
  read: boolean;
  is_read?: boolean;
  icon: 'check' | 'truck' | 'leaf' | 'alert' | 'progress' | 'resolving';
  type: NotificationType;
  reportId?: string;
  reportCode?: string;
  location?: string;
  ngoName?: string;
  metadata?: Record<string, unknown>;
};

export type NgoDirectoryItem = {
  id: string;
  profileId?: string;
  name: string;
  location: string;
  categories: string[];
  description: string;
  activities: string;
  website: string;
  phone?: string;
  email?: string;
  source: string;
  verified?: boolean;
  latitude?: number | null;
  longitude?: number | null;
  createdAt?: string;
};

export const issueOptions = [
  'Garbage Dump',
  'Plastic Waste',
  'Overflowing Garbage Bin',
  'Roadside Waste',
  'Water Pollution',
  'Construction Waste',
  'E-Waste',
  'Other',
];

export const STORAGE_KEYS = {
  auth: 'geoclean-auth',
  reports: 'geoclean-reports',
  notices: 'geoclean-notices',
  users: 'geoclean-users',
  ngos: 'geoclean-ngos',
} as const;

