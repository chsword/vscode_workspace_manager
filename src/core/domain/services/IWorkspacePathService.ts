/**
 * Workspace Path Service Interface
 * 
 * Domain service for workspace path operations.
 * Handles path validation, normalization, and WSL path conversions.
 */

import { Result } from '@shared/utils/Result';
import { BaseError, PathError } from '@shared/errors';

/**
 * Path validation result
 */
export interface PathValidationResult {
    readonly isValid: boolean;
    readonly isAccessible: boolean;
    readonly exists: boolean;
    readonly isDirectory: boolean;
    readonly absolutePath: string;
}

/**
 * WSL path information
 */
export interface WSLPathInfo {
    readonly isWSLPath: boolean;
    readonly distribution?: string;
    readonly linuxPath?: string;
    readonly windowsPath?: string;
}

/**
 * Remote path information
 */
export interface RemotePathInfo {
    readonly isRemotePath: boolean;
    readonly protocol?: 'ssh' | 'github' | 'codespaces' | 'dev-container';
    readonly host?: string;
    readonly path?: string;
}

/**
 * Workspace name extraction result
 */
export interface WorkspaceNameInfo {
    readonly name: string;
    readonly fullPath: string;
    readonly parentDirectory?: string;
}

/**
 * Workspace Path Service
 * 
 * Responsible for:
 * - Path validation and normalization
 * - WSL path detection and conversion
 * - Remote path detection and parsing
 * - Workspace name extraction from paths
 * - Path format conversions (Windows <-> Linux)
 */
export interface IWorkspacePathService {
    /**
     * Validate workspace path
     * @param path - Path to validate
     * @returns Result with validation result
     */
    validatePath(path: string): Promise<Result<PathValidationResult, BaseError>>;

    /**
     * Normalize workspace path to consistent format
     * @param path - Path to normalize
     * @returns Result with normalized path
     */
    normalizePath(path: string): Result<string, BaseError>;

    /**
     * Extract workspace name from path
     * @param path - Workspace path
     * @returns Result with workspace name info
     */
    extractWorkspaceName(path: string): Result<WorkspaceNameInfo, BaseError>;

    /**
     * Detect and parse WSL path information
     * @param path - Path to analyze
     * @returns Result with WSL path info
     */
    parseWSLPath(path: string): Result<WSLPathInfo, BaseError>;

    /**
     * Convert Windows path to WSL Linux path
     * @param windowsPath - Windows path (e.g., \\wsl$\Ubuntu\home\user\project)
     * @param distribution - WSL distribution name
     * @returns Result with Linux path (e.g., /home/user/project)
     */
    convertWindowsToWSLPath(windowsPath: string, distribution: string): Result<string, BaseError>;

    /**
     * Extract WSL distribution name from path
     * @param path - WSL path
     * @returns Result with distribution name
     */
    extractWSLDistribution(path: string): Result<string, BaseError>;

    /**
     * Detect and parse remote path information
     * @param path - Path to analyze
     * @returns Result with remote path info
     */
    parseRemotePath(path: string): Result<RemotePathInfo, BaseError>;

    /**
     * Check if path is a local path
     * @param path - Path to check
     * @returns Result with boolean
     */
    isLocalPath(path: string): Result<boolean, BaseError>;

    /**
     * Check if path is a WSL path
     * @param path - Path to check
     * @returns Result with boolean
     */
    isWSLPath(path: string): Result<boolean, BaseError>;

    /**
     * Check if path is a remote path
     * @param path - Path to check
     * @returns Result with boolean
     */
    isRemotePath(path: string): Result<boolean, BaseError>;

    /**
     * Get absolute path from relative or mixed path
     * @param path - Path to resolve
     * @param basePath - Base path for relative resolution
     * @returns Result with absolute path
     */
    getAbsolutePath(path: string, basePath?: string): Result<string, BaseError>;
}
