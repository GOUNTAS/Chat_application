-- Create Database
CREATE DATABASE IF NOT EXISTS discord_app;
USE discord_app;

-- Users Table
CREATE TABLE users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(50) NOT NULL UNIQUE,
  email VARCHAR(100) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  preferred_language VARCHAR(10) DEFAULT 'en',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_email (email),
  INDEX idx_username (username)
);

-- Groups Table - NOTICE THE BACKTICKS!
CREATE TABLE `groups` (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  owner_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_owner (owner_id)
);

-- Group Members Table
CREATE TABLE group_members (
  id INT PRIMARY KEY AUTO_INCREMENT,
  group_id INT NOT NULL,
  user_id INT NOT NULL,
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (group_id) REFERENCES `groups`(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_membership (group_id, user_id),
  INDEX idx_group (group_id),
  INDEX idx_user (user_id)
);

-- Channels Table
CREATE TABLE channels (
  id INT PRIMARY KEY AUTO_INCREMENT,
  group_id INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  type ENUM('text', 'voice') NOT NULL DEFAULT 'text',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (group_id) REFERENCES `groups`(id) ON DELETE CASCADE,
  INDEX idx_group (group_id),
  INDEX idx_type (type)
);

-- Messages Table
CREATE TABLE messages (
  id INT PRIMARY KEY AUTO_INCREMENT,
  channel_id INT NOT NULL,
  user_id INT NOT NULL,
  message TEXT NOT NULL,
  original_language VARCHAR(10) DEFAULT 'en',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_channel (channel_id),
  INDEX idx_user (user_id),
  INDEX idx_created (created_at)
);