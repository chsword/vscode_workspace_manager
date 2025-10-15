/**
 * Workspace Detection Service Interface
 * 
 * Domain service for detecting project information from workspace paths.
 * Encapsulates cross-entity business logic for project type detection.
 */

import { Result } from '@shared/utils/Result';
import { BaseError, DetectionError, PathError } from '@shared/errors';

/**
 * Detected project information
 */
export interface DetectedProjectInfo {
    readonly framework?: string;
    readonly language?: string;
    readonly packageManager?: 'npm' | 'yarn' | 'pnpm';
    readonly gitRepository?: string;
    readonly hasPackageJson: boolean;
    readonly hasDockerfile: boolean;
}

/**
 * Package.json dependencies structure
 */
export interface PackageDependencies {
    readonly dependencies?: Record<string, string>;
    readonly devDependencies?: Record<string, string>;
}

/**
 * Framework detection result
 */
export interface FrameworkDetectionResult {
    readonly framework: string;
    readonly confidence: 'high' | 'medium' | 'low';
    readonly detectedFrom: 'dependencies' | 'devDependencies' | 'both';
}

/**
 * Language detection result
 */
export interface LanguageDetectionResult {
    readonly language: string;
    readonly confidence: 'high' | 'medium' | 'low';
    readonly detectedFrom: string; // e.g., 'package.json', 'pom.xml', 'Cargo.toml'
}

/**
 * Workspace Detection Service
 * 
 * Responsible for:
 * - Detecting project framework (Vue, React, Angular, etc.)
 * - Detecting programming language (TypeScript, JavaScript, Python, etc.)
 * - Detecting package manager (npm, yarn, pnpm)
 * - Detecting git repository information
 * - Analyzing project files (package.json, Dockerfile, etc.)
 */
export interface IWorkspaceDetectionService {
    /**
     * Detect complete project information from workspace path
     * @param workspacePath - Absolute path to workspace directory
     * @returns Result with detected project info or error
     */
    detectProjectInfo(workspacePath: string): Promise<Result<DetectedProjectInfo, BaseError>>;

    /**
     * Detect framework from package.json dependencies
     * @param dependencies - Package dependencies object
     * @returns Result with framework detection result or undefined
     */
    detectFramework(dependencies: PackageDependencies): Result<FrameworkDetectionResult | undefined, BaseError>;

    /**
     * Detect programming language from project files
     * @param workspacePath - Absolute path to workspace directory
     * @returns Result with language detection result or undefined
     */
    detectLanguage(workspacePath: string): Promise<Result<LanguageDetectionResult | undefined, BaseError>>;

    /**
     * Detect package manager from lock files
     * @param workspacePath - Absolute path to workspace directory
     * @returns Result with package manager name or undefined
     */
    detectPackageManager(workspacePath: string): Promise<Result<'npm' | 'yarn' | 'pnpm' | undefined, BaseError>>;

    /**
     * Check if workspace has specific file
     * @param workspacePath - Absolute path to workspace directory
     * @param fileName - File name to check (e.g., 'package.json', 'Dockerfile')
     * @returns Result with boolean indicating file existence
     */
    hasFile(workspacePath: string, fileName: string): Promise<Result<boolean, BaseError>>;

    /**
     * Read and parse package.json file
     * @param workspacePath - Absolute path to workspace directory
     * @returns Result with parsed package.json or undefined
     */
    readPackageJson(workspacePath: string): Promise<Result<PackageDependencies | undefined, BaseError>>;
}
