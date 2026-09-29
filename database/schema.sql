-- EdgeDeploy Database Schema (12 Tables according to SRS §5.2)

CREATE DATABASE IF NOT EXISTS edgedeploy CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE edgedeploy;

-- 1. Users
CREATE TABLE IF NOT EXISTS Users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('DEVELOPER', 'ADMIN') NOT NULL DEFAULT 'DEVELOPER',
  is_blocked BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Projects
CREATE TABLE IF NOT EXISTS Projects (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  build_command VARCHAR(255) NOT NULL DEFAULT 'npm run build',
  output_directory VARCHAR(255) NOT NULL DEFAULT 'dist',
  install_command VARCHAR(255) NOT NULL DEFAULT 'npm install',
  branch VARCHAR(255) NOT NULL DEFAULT 'main',
  active_deployment_id INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_projects_user FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Repositories
CREATE TABLE IF NOT EXISTS Repositories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  project_id INT NOT NULL UNIQUE,
  repo_url VARCHAR(500) NOT NULL,
  owner VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  default_branch VARCHAR(255) NOT NULL DEFAULT 'main',
  webhook_id VARCHAR(255) NULL,
  webhook_secret VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_repositories_project FOREIGN KEY (project_id) REFERENCES Projects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Deployments
CREATE TABLE IF NOT EXISTS Deployments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  project_id INT NOT NULL,
  commit_sha VARCHAR(40) NOT NULL,
  commit_message TEXT NOT NULL,
  branch VARCHAR(255) NOT NULL DEFAULT 'main',
  status ENUM('QUEUED', 'BUILDING', 'SUCCESS', 'FAILED', 'CANCELLED') NOT NULL DEFAULT 'QUEUED',
  `trigger` ENUM('WEBHOOK', 'MANUAL', 'REDEPLOY') NOT NULL DEFAULT 'MANUAL',
  started_at TIMESTAMP NULL,
  finished_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_deployments_project FOREIGN KEY (project_id) REFERENCES Projects(id) ON DELETE CASCADE,
  INDEX idx_deployments_project_created (project_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- FK for Projects.active_deployment_id
ALTER TABLE Projects 
  ADD CONSTRAINT fk_projects_active_deployment 
  FOREIGN KEY (active_deployment_id) REFERENCES Deployments(id) ON DELETE SET NULL;

-- 5. DeploymentLogs
CREATE TABLE IF NOT EXISTS DeploymentLogs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  deployment_id INT NOT NULL,
  seq INT NOT NULL,
  level VARCHAR(20) NOT NULL DEFAULT 'INFO',
  stream ENUM('SYSTEM', 'STDOUT', 'STDERR') NOT NULL DEFAULT 'SYSTEM',
  message TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_deploymentlogs_deployment FOREIGN KEY (deployment_id) REFERENCES Deployments(id) ON DELETE CASCADE,
  INDEX idx_deploymentlogs_seq (deployment_id, seq)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Builds
CREATE TABLE IF NOT EXISTS Builds (
  id INT AUTO_INCREMENT PRIMARY KEY,
  deployment_id INT NOT NULL UNIQUE,
  command VARCHAR(500) NOT NULL,
  install_duration_ms INT NOT NULL DEFAULT 0,
  build_duration_ms INT NOT NULL DEFAULT 0,
  exit_code INT NOT NULL DEFAULT 0,
  status VARCHAR(50) NOT NULL,
  error_summary TEXT NULL,
  CONSTRAINT fk_builds_deployment FOREIGN KEY (deployment_id) REFERENCES Deployments(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Files
CREATE TABLE IF NOT EXISTS Files (
  id INT AUTO_INCREMENT PRIMARY KEY,
  deployment_id INT NOT NULL,
  path VARCHAR(500) NOT NULL,
  size_bytes INT NOT NULL,
  content_type VARCHAR(100) NOT NULL,
  sha256 VARCHAR(64) NOT NULL,
  CONSTRAINT fk_files_deployment FOREIGN KEY (deployment_id) REFERENCES Deployments(id) ON DELETE CASCADE,
  UNIQUE KEY uq_files_deployment_path (deployment_id, path(255))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. EdgeNodes
CREATE TABLE IF NOT EXISTS EdgeNodes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  port INT NOT NULL UNIQUE,
  region VARCHAR(100) NOT NULL,
  status ENUM('HEALTHY', 'UNHEALTHY', 'OFFLINE') NOT NULL DEFAULT 'HEALTHY',
  cache_capacity INT NOT NULL DEFAULT 100,
  last_heartbeat TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. CacheEntries
CREATE TABLE IF NOT EXISTS CacheEntries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  edge_node_id INT NOT NULL,
  file_id INT NOT NULL,
  project_id INT NOT NULL,
  cache_key VARCHAR(255) NOT NULL,
  size_bytes INT NOT NULL,
  ttl_seconds INT NOT NULL DEFAULT 60,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_accessed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  hit_count INT NOT NULL DEFAULT 0,
  CONSTRAINT fk_cacheentries_edge FOREIGN KEY (edge_node_id) REFERENCES EdgeNodes(id) ON DELETE CASCADE,
  CONSTRAINT fk_cacheentries_file FOREIGN KEY (file_id) REFERENCES Files(id) ON DELETE CASCADE,
  UNIQUE KEY uq_edge_cachekey (edge_node_id, cache_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. RequestLogs
CREATE TABLE IF NOT EXISTS RequestLogs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ts TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  client_ip VARCHAR(45) NOT NULL,
  project_id INT NULL,
  domain VARCHAR(255) NOT NULL,
  path VARCHAR(500) NOT NULL,
  method VARCHAR(10) NOT NULL DEFAULT 'GET',
  status_code INT NOT NULL,
  latency_ms INT NOT NULL,
  edge_node_id INT NULL,
  cache_result ENUM('HIT', 'MISS', 'NONE') NOT NULL DEFAULT 'NONE',
  bytes INT NOT NULL DEFAULT 0,
  INDEX idx_requestlogs_project_ts (project_id, ts),
  INDEX idx_requestlogs_ts (ts)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11. RateLimits
CREATE TABLE IF NOT EXISTS RateLimits (
  id INT AUTO_INCREMENT PRIMARY KEY,
  client_ip VARCHAR(45) NOT NULL,
  endpoint VARCHAR(255) NULL,
  tokens DOUBLE NOT NULL DEFAULT 10,
  window_start TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  request_count INT NOT NULL DEFAULT 0,
  is_blocked BOOLEAN NOT NULL DEFAULT FALSE,
  blocked_until TIMESTAMP NULL,
  block_reason VARCHAR(255) NULL,
  blocked_by ENUM('AUTO', 'ADMIN') NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_ip_endpoint (client_ip, endpoint)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 12. Domains
CREATE TABLE IF NOT EXISTS Domains (
  id INT AUTO_INCREMENT PRIMARY KEY,
  project_id INT NOT NULL,
  hostname VARCHAR(255) NOT NULL UNIQUE,
  is_primary BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT fk_domains_project FOREIGN KEY (project_id) REFERENCES Projects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
