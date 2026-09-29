export type UserRole = 'DEVELOPER' | 'ADMIN';
export type DeploymentStatus = 'QUEUED' | 'BUILDING' | 'SUCCESS' | 'FAILED' | 'CANCELLED';
export type DeploymentTrigger = 'WEBHOOK' | 'MANUAL' | 'REDEPLOY';
export type LogStream = 'SYSTEM' | 'STDOUT' | 'STDERR';
export type EdgeNodeStatus = 'HEALTHY' | 'UNHEALTHY' | 'OFFLINE';
export type CacheResult = 'HIT' | 'MISS' | 'NONE';
export type BlockedBy = 'AUTO' | 'ADMIN';

export interface User {
  id: number;
  email: string;
  password_hash: string;
  role: UserRole;
  is_blocked: boolean;
  created_at: Date;
}

export interface Project {
  id: number;
  user_id: number;
  name: string;
  slug: string;
  build_command: string;
  output_directory: string;
  install_command: string;
  branch: string;
  active_deployment_id: number | null;
  created_at: Date;
  updated_at: Date;
}

export interface Repository {
  id: number;
  project_id: number;
  repo_url: string;
  owner: string;
  name: string;
  default_branch: string;
  webhook_id: string | null;
  webhook_secret: string | null;
  created_at: Date;
}

export interface Deployment {
  id: number;
  project_id: number;
  commit_sha: string;
  commit_message: string;
  branch: string;
  status: DeploymentStatus;
  trigger: DeploymentTrigger;
  started_at: Date | null;
  finished_at: Date | null;
  created_at: Date;
}

export interface DeploymentLog {
  id: number;
  deployment_id: number;
  seq: number;
  level: string;
  stream: LogStream;
  message: string;
  created_at: Date;
}

export interface Build {
  id: number;
  deployment_id: number;
  command: string;
  install_duration_ms: number;
  build_duration_ms: number;
  exit_code: number;
  status: string;
  error_summary: string | null;
}

export interface FileRecord {
  id: number;
  deployment_id: number;
  path: string;
  size_bytes: number;
  content_type: string;
  sha256: string;
}

export interface EdgeNode {
  id: number;
  name: string;
  port: number;
  region: string;
  status: EdgeNodeStatus;
  cache_capacity: number;
  last_heartbeat: Date | null;
  created_at: Date;
}

export interface CacheEntry {
  id: number;
  edge_node_id: number;
  file_id: number;
  project_id: number;
  cache_key: string;
  size_bytes: number;
  ttl_seconds: number;
  created_at: Date;
  expires_at: Date;
  last_accessed_at: Date;
  hit_count: number;
}

export interface RequestLog {
  id: number;
  ts: Date;
  client_ip: string;
  project_id: number | null;
  domain: string;
  path: string;
  method: string;
  status_code: number;
  latency_ms: number;
  edge_node_id: number | null;
  cache_result: CacheResult;
  bytes: number;
}

export interface RateLimit {
  id: number;
  client_ip: string;
  endpoint: string | null;
  tokens: number;
  window_start: Date;
  request_count: number;
  is_blocked: boolean;
  blocked_until: Date | null;
  block_reason: string | null;
  blocked_by: BlockedBy | null;
  updated_at: Date;
}

export interface DomainRecord {
  id: number;
  project_id: number;
  hostname: string;
  is_primary: boolean;
}

export interface JWTPayload {
  userId: number;
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}
