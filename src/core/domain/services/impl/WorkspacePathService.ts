/**
 * Workspace Path Service Implementation
 * 
 * Domain service for workspace path operations.
 * Migrated from WorkspaceSyncService and WorkspaceManager.
 */

import * as path from 'path';
import * as fs from 'fs';
import { injectable } from 'tsyringe';
import { Result } from '@shared/utils/Result';
import { BaseError, PathError } from '@shared/errors';
import {
    IWorkspacePathService,
    PathValidationResult,
    WSLPathInfo,
    RemotePathInfo,
    WorkspaceNameInfo
} from '../IWorkspacePathService';

@injectable()
export class WorkspacePathService implements IWorkspacePathService {
    /**
     * Validate workspace path
     */
    async validatePath(pathToValidate: string): Promise<Result<PathValidationResult, BaseError>> {
        try {
            // For remote and WSL paths, we can't validate locally
            const isRemote = this.isRemotePath(pathToValidate);
            const isWSL = this.isWSLPath(pathToValidate);

            if (isRemote.value || isWSL.value) {
                // Remote/WSL paths - assume valid, can't check locally
                return Result.ok({
                    isValid: true,
                    isAccessible: true, // Assume accessible
                    exists: true, // Assume exists
                    isDirectory: true,
                    absolutePath: pathToValidate
                });
            }

            // Local path validation
            const normalized = this.normalizePath(pathToValidate);
            if (normalized.isFailure) {
                return Result.fail(normalized.error);
            }

            const absolutePath = path.isAbsolute(normalized.value) 
                ? normalized.value 
                : path.resolve(normalized.value);

            let exists = false;
            let isAccessible = false;
            let isDirectory = false;

            try {
                exists = fs.existsSync(absolutePath);
                if (exists) {
                    const stats = fs.statSync(absolutePath);
                    isDirectory = stats.isDirectory();
                    isAccessible = true;
                }
            } catch (error) {
                // Path exists but not accessible
                isAccessible = false;
            }

            return Result.ok({
                isValid: true,
                isAccessible,
                exists,
                isDirectory,
                absolutePath
            });

        } catch (error) {
            return Result.fail(
                new PathError(
                    `Failed to validate path: ${error instanceof Error ? error.message : String(error)}`,
                    pathToValidate
                )
            );
        }
    }

    /**
     * Normalize workspace path to consistent format
     */
    normalizePath(pathToNormalize: string): Result<string, BaseError> {
        try {
            if (!pathToNormalize || pathToNormalize.trim() === '') {
                return Result.fail(new PathError('Path cannot be empty', pathToNormalize));
            }

            // Don't normalize remote paths
            if (pathToNormalize.startsWith('ssh://') || 
                pathToNormalize.startsWith('github://') ||
                pathToNormalize.includes('vscode-remote')) {
                return Result.ok(pathToNormalize);
            }

            // Don't normalize WSL paths with special prefixes
            if (pathToNormalize.startsWith('\\\\wsl$\\') || 
                pathToNormalize.includes('wsl+')) {
                return Result.ok(pathToNormalize);
            }

            // Normalize local paths
            const normalized = path.normalize(pathToNormalize);
            return Result.ok(normalized);

        } catch (error) {
            return Result.fail(
                new PathError(
                    `Failed to normalize path: ${error instanceof Error ? error.message : String(error)}`,
                    pathToNormalize
                )
            );
        }
    }

    /**
     * Extract workspace name from path
     * Migrated from WorkspaceSyncService.extractWorkspaceName
     */
    extractWorkspaceName(workspacePath: string): Result<WorkspaceNameInfo, BaseError> {
        try {
            let name: string;
            let parentDirectory: string | undefined;

            // Handle SSH remote paths
            if (workspacePath.startsWith('ssh://')) {
                const parts = workspacePath.split('/');
                name = parts[parts.length - 1] || 'Remote Workspace';
                parentDirectory = parts.slice(0, -1).join('/');
            }
            // Handle GitHub paths
            else if (workspacePath.startsWith('github://')) {
                const parts = workspacePath.split('/');
                name = parts[parts.length - 1] || 'GitHub Workspace';
                parentDirectory = parts.slice(0, -1).join('/');
            }
            // Handle Codespaces
            else if (workspacePath.includes('codespaces')) {
                const parts = workspacePath.split('/');
                name = parts[parts.length - 1] || 'Codespaces Workspace';
                parentDirectory = parts.slice(0, -1).join('/');
            }
            // Handle WSL paths
            else if (workspacePath.startsWith('\\\\wsl$\\')) {
                const parts = workspacePath.split('\\');
                name = parts[parts.length - 1] || 'WSL Workspace';
                parentDirectory = parts.slice(0, -1).join('\\');
            }
            // Handle remote authority paths
            else if (workspacePath.includes(':') && !path.isAbsolute(workspacePath)) {
                const parts = workspacePath.split('/');
                const lastName = parts[parts.length - 1];
                if (lastName && lastName !== '') {
                    name = lastName;
                } else {
                    // Fallback to authority part
                    const authorityMatch = workspacePath.match(/([^:]+):/);
                    name = authorityMatch ? `Remote (${authorityMatch[1]})` : 'Remote Workspace';
                }
                parentDirectory = parts.slice(0, -1).join('/');
            }
            // Default: use path.basename for local paths
            else {
                name = path.basename(workspacePath) || 'Unknown Workspace';
                parentDirectory = path.dirname(workspacePath);
            }

            return Result.ok({
                name,
                fullPath: workspacePath,
                parentDirectory
            });

        } catch (error) {
            return Result.fail(
                new PathError(
                    `Failed to extract workspace name: ${error instanceof Error ? error.message : String(error)}`,
                    workspacePath
                )
            );
        }
    }

    /**
     * Detect and parse WSL path information
     */
    parseWSLPath(pathToParse: string): Result<WSLPathInfo, BaseError> {
        try {
            const isWSL = this.isWSLPath(pathToParse);
            if (!isWSL.value) {
                return Result.ok({
                    isWSLPath: false
                });
            }

            const distributionResult = this.extractWSLDistribution(pathToParse);
            if (distributionResult.isFailure) {
                return Result.fail(distributionResult.error);
            }

            const distribution = distributionResult.value;
            let linuxPath: string | undefined;
            let windowsPath: string | undefined;

            // \\wsl$\Ubuntu\home\user\project
            if (pathToParse.startsWith('\\\\wsl$\\')) {
                windowsPath = pathToParse;
                // Extract Linux path
                const parts = pathToParse.split('\\');
                if (parts.length >= 4) {
                    linuxPath = '/' + parts.slice(4).join('/');
                }
            }
            // wsl+Ubuntu:/home/user/project
            else if (pathToParse.includes('wsl+')) {
                const match = pathToParse.match(/wsl\+[^:]+:(.+)/);
                if (match) {
                    linuxPath = match[1];
                }
            }
            // /mnt/c/ or /mnt/d/ paths
            else if (pathToParse.includes('/mnt/')) {
                linuxPath = pathToParse;
            }

            return Result.ok({
                isWSLPath: true,
                distribution,
                linuxPath,
                windowsPath
            });

        } catch (error) {
            return Result.fail(
                new PathError(
                    `Failed to parse WSL path: ${error instanceof Error ? error.message : String(error)}`,
                    pathToParse
                )
            );
        }
    }

    /**
     * Convert Windows path to WSL Linux path
     */
    convertWindowsToWSLPath(windowsPath: string, distribution: string): Result<string, BaseError> {
        try {
            // \\wsl$\Ubuntu\home\user\project -> /home/user/project
            if (windowsPath.startsWith('\\\\wsl$\\')) {
                const parts = windowsPath.split('\\');
                if (parts.length >= 4) {
                    const linuxPath = '/' + parts.slice(4).join('/');
                    return Result.ok(linuxPath);
                }
            }

            // /mnt/wsl/Ubuntu/home/user/project -> /home/user/project
            if (windowsPath.startsWith('/mnt/wsl/')) {
                const linuxPath = windowsPath.replace(`/mnt/wsl/${distribution}`, '');
                return Result.ok(linuxPath);
            }

            // If already looks like Linux path, return as is
            if (windowsPath.startsWith('/')) {
                return Result.ok(windowsPath);
            }

            return Result.fail(
                new PathError(
                    `Cannot convert path to WSL format: ${windowsPath}`,
                    windowsPath
                )
            );

        } catch (error) {
            return Result.fail(
                new PathError(
                    `Failed to convert Windows path to WSL: ${error instanceof Error ? error.message : String(error)}`,
                    windowsPath
                )
            );
        }
    }

    /**
     * Extract WSL distribution name from path
     * Migrated from WorkspaceSyncService.extractWSLDistribution
     */
    extractWSLDistribution(pathToExtract: string): Result<string, BaseError> {
        try {
            // \\wsl$\Ubuntu-20.04\home\user\project
            let match = pathToExtract.match(/\\\\wsl\$\\([^\\]+)/);
            if (match) {
                let distro = match[1];
                // Handle URL-encoded distribution names (e.g., wsl%2Bubuntu -> wsl+ubuntu)
                try {
                    distro = decodeURIComponent(distro);
                } catch (decodeError) {
                    // If decode fails, use original
                }
                // If the distribution name starts with 'wsl+', extract the actual name
                if (distro.startsWith('wsl+')) {
                    distro = distro.substring(4); // Remove 'wsl+' prefix
                }
                return Result.ok(distro);
            }

            // wsl+Ubuntu-20.04
            match = pathToExtract.match(/wsl\+([^:/]+)/);
            if (match) {
                return Result.ok(match[1]);
            }

            // /mnt/c/ or /mnt/d/ paths
            if (pathToExtract.includes('/mnt/')) {
                return Result.ok('WSL');
            }

            return Result.ok('Unknown');

        } catch (error) {
            return Result.fail(
                new PathError(
                    `Failed to extract WSL distribution: ${error instanceof Error ? error.message : String(error)}`,
                    pathToExtract
                )
            );
        }
    }

    /**
     * Detect and parse remote path information
     */
    parseRemotePath(pathToParse: string): Result<RemotePathInfo, BaseError> {
        try {
            const isRemote = this.isRemotePath(pathToParse);
            if (!isRemote.value) {
                return Result.ok({
                    isRemotePath: false
                });
            }

            let protocol: 'ssh' | 'github' | 'codespaces' | 'dev-container' | undefined;
            let host: string | undefined;
            let remotePath: string | undefined;

            if (pathToParse.startsWith('ssh://')) {
                protocol = 'ssh';
                const match = pathToParse.match(/ssh:\/\/([^\/]+)(\/.*)?/);
                if (match) {
                    host = match[1];
                    remotePath = match[2];
                }
            } else if (pathToParse.startsWith('github://')) {
                protocol = 'github';
                const match = pathToParse.match(/github:\/\/([^\/]+)(\/.*)?/);
                if (match) {
                    host = match[1];
                    remotePath = match[2];
                }
            } else if (pathToParse.includes('codespaces')) {
                protocol = 'codespaces';
            } else if (pathToParse.includes('dev-container')) {
                protocol = 'dev-container';
            }

            return Result.ok({
                isRemotePath: true,
                protocol,
                host,
                path: remotePath
            });

        } catch (error) {
            return Result.fail(
                new PathError(
                    `Failed to parse remote path: ${error instanceof Error ? error.message : String(error)}`,
                    pathToParse
                )
            );
        }
    }

    /**
     * Check if path is a local path
     */
    isLocalPath(pathToCheck: string): Result<boolean, BaseError> {
        try {
            // Check if not remote
            const isRemote = this.isRemotePath(pathToCheck);
            if (isRemote.isFailure) {
                return Result.fail(isRemote.error);
            }

            // Check if not WSL
            const isWSL = this.isWSLPath(pathToCheck);
            if (isWSL.isFailure) {
                return Result.fail(isWSL.error);
            }

            const isLocal = !isRemote.value && !isWSL.value;
            return Result.ok(isLocal);

        } catch (error) {
            return Result.fail(
                new PathError(
                    `Failed to check if path is local: ${error instanceof Error ? error.message : String(error)}`,
                    pathToCheck
                )
            );
        }
    }

    /**
     * Check if path is a WSL path
     */
    isWSLPath(pathToCheck: string): Result<boolean, BaseError> {
        try {
            const isWSL = pathToCheck.startsWith('\\\\wsl$\\') ||
                pathToCheck.startsWith('/mnt/wsl/') ||
                pathToCheck.includes('wsl+') ||
                pathToCheck.includes('/mnt/c/') ||
                pathToCheck.includes('/mnt/d/');

            return Result.ok(isWSL);

        } catch (error) {
            return Result.fail(
                new PathError(
                    `Failed to check if path is WSL: ${error instanceof Error ? error.message : String(error)}`,
                    pathToCheck
                )
            );
        }
    }

    /**
     * Check if path is a remote path
     */
    isRemotePath(pathToCheck: string): Result<boolean, BaseError> {
        try {
            const isRemote = pathToCheck.startsWith('ssh://') ||
                pathToCheck.includes('@') ||
                pathToCheck.startsWith('github://') ||
                pathToCheck.includes('ssh-remote') ||
                pathToCheck.includes('vscode-remote') ||
                pathToCheck.includes('codespaces') ||
                pathToCheck.includes('dev-container');

            return Result.ok(isRemote);

        } catch (error) {
            return Result.fail(
                new PathError(
                    `Failed to check if path is remote: ${error instanceof Error ? error.message : String(error)}`,
                    pathToCheck
                )
            );
        }
    }

    /**
     * Get absolute path from relative or mixed path
     */
    getAbsolutePath(pathToResolve: string, basePath?: string): Result<string, BaseError> {
        try {
            // Remote and WSL paths are already absolute in their context
            if (this.isRemotePath(pathToResolve).value || this.isWSLPath(pathToResolve).value) {
                return Result.ok(pathToResolve);
            }

            // Already absolute
            if (path.isAbsolute(pathToResolve)) {
                return Result.ok(path.normalize(pathToResolve));
            }

            // Resolve relative path
            const base = basePath || process.cwd();
            const absolutePath = path.resolve(base, pathToResolve);
            return Result.ok(absolutePath);

        } catch (error) {
            return Result.fail(
                new PathError(
                    `Failed to get absolute path: ${error instanceof Error ? error.message : String(error)}`,
                    pathToResolve
                )
            );
        }
    }
}
