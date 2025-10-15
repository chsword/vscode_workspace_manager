/**
 * Workspace Detection Service Implementation
 * 
 * Domain service for detecting project information from workspace paths.
 * Migrated from WorkspaceSyncService.detectProjectInfo
 */

import * as path from 'path';
import * as fs from 'fs';
import { injectable } from 'tsyringe';
import { Result } from '@shared/utils/Result';
import { BaseError, DetectionError, PathError } from '@shared/errors';
import {
    IWorkspaceDetectionService,
    DetectedProjectInfo,
    FrameworkDetectionResult,
    LanguageDetectionResult,
    PackageDependencies
} from '../IWorkspaceDetectionService';

@injectable()
export class WorkspaceDetectionService implements IWorkspaceDetectionService {
    /**
     * Detect complete project information from workspace path
     * Migrated from WorkspaceSyncService.detectProjectInfo
     */
    async detectProjectInfo(workspacePath: string): Promise<Result<DetectedProjectInfo, BaseError>> {
        try {
            // Check if directory exists
            if (!fs.existsSync(workspacePath)) {
                return Result.fail(
                    new PathError('Workspace path does not exist', workspacePath)
                );
            }

            const stats = fs.statSync(workspacePath);
            if (!stats.isDirectory()) {
                return Result.fail(
                    new PathError('Workspace path is not a directory', workspacePath)
                );
            }

            let framework: string | undefined;
            let language: string | undefined;
            let packageManager: 'npm' | 'yarn' | 'pnpm' | undefined;
            let gitRepository: string | undefined;
            let hasPackageJson = false;
            let hasDockerfile = false;

            // Check for package.json
            const packageJsonResult = await this.readPackageJson(workspacePath);
            if (packageJsonResult.isSuccess && packageJsonResult.value) {
                hasPackageJson = true;
                const deps = packageJsonResult.value;

                // Detect framework
                const frameworkResult = this.detectFramework(deps);
                if (frameworkResult.isSuccess && frameworkResult.value) {
                    framework = frameworkResult.value.framework;
                }

                // Detect package manager
                const pmResult = await this.detectPackageManager(workspacePath);
                if (pmResult.isSuccess && pmResult.value) {
                    packageManager = pmResult.value;
                }
            }

            // Detect language from project files
            const languageResult = await this.detectLanguage(workspacePath);
            if (languageResult.isSuccess && languageResult.value) {
                language = languageResult.value.language;
            }

            // Check for Dockerfile
            const dockerfileResult = await this.hasFile(workspacePath, 'Dockerfile');
            if (dockerfileResult.isSuccess) {
                hasDockerfile = dockerfileResult.value;
            }

            // Check for .git directory
            const gitResult = await this.hasFile(workspacePath, '.git');
            if (gitResult.isSuccess && gitResult.value) {
                gitRepository = 'Present'; // TODO: Extract git remote URL
            }

            return Result.ok({
                framework,
                language,
                packageManager,
                gitRepository,
                hasPackageJson,
                hasDockerfile
            });

        } catch (error) {
            return Result.fail(
                new DetectionError(
                    `Failed to detect project info: ${error instanceof Error ? error.message : String(error)}`,
                    workspacePath
                )
            );
        }
    }

    /**
     * Detect framework from package.json dependencies
     * Migrated from WorkspaceSyncService.detectProjectInfo
     */
    detectFramework(dependencies: PackageDependencies): Result<FrameworkDetectionResult | undefined, BaseError> {
        try {
            const allDeps = {
                ...dependencies.dependencies,
                ...dependencies.devDependencies
            };

            // Framework detection with confidence levels
            interface FrameworkPattern {
                name: string;
                deps: string[];
                devDepsOnly?: boolean;
            }

            const frameworkPatterns: FrameworkPattern[] = [
                { name: 'Vue', deps: ['vue', '@vue/cli', '@vue/core'] },
                { name: 'React', deps: ['react', 'react-dom'] },
                { name: 'Angular', deps: ['@angular/core', '@angular/cli'] },
                { name: 'Svelte', deps: ['svelte'] },
                { name: 'Next.js', deps: ['next'] },
                { name: 'Nuxt', deps: ['nuxt', '@nuxt/core'] },
                { name: 'Vite', deps: ['vite'], devDepsOnly: true },
                { name: 'Spring Boot', deps: ['spring-boot'] },
                { name: 'Django', deps: ['django'] }
            ];

            for (const pattern of frameworkPatterns) {
                for (const dep of pattern.deps) {
                    if (allDeps[dep]) {
                        // Check if found in dependencies or devDependencies
                        const inDeps = dependencies.dependencies?.[dep] !== undefined;
                        const inDevDeps = dependencies.devDependencies?.[dep] !== undefined;

                        let confidence: 'high' | 'medium' | 'low' = 'high';
                        let detectedFrom: 'dependencies' | 'devDependencies' | 'both';

                        if (inDeps && inDevDeps) {
                            detectedFrom = 'both';
                            confidence = 'high';
                        } else if (inDeps) {
                            detectedFrom = 'dependencies';
                            confidence = pattern.devDepsOnly ? 'medium' : 'high';
                        } else {
                            detectedFrom = 'devDependencies';
                            confidence = pattern.devDepsOnly ? 'high' : 'medium';
                        }

                        return Result.ok({
                            framework: pattern.name,
                            confidence,
                            detectedFrom
                        });
                    }
                }
            }

            // No framework detected
            return Result.ok(undefined);

        } catch (error) {
            return Result.fail(
                new DetectionError(
                    `Failed to detect framework: ${error instanceof Error ? error.message : String(error)}`,
                    'dependencies'
                )
            );
        }
    }

    /**
     * Detect programming language from project files
     * Migrated from WorkspaceSyncService.detectProjectInfo
     */
    async detectLanguage(workspacePath: string): Promise<Result<LanguageDetectionResult | undefined, BaseError>> {
        try {
            interface LanguagePattern {
                name: string;
                files: string[];
                confidence: 'high' | 'medium' | 'low';
            }

            const languagePatterns: LanguagePattern[] = [
                { name: 'Java', files: ['pom.xml', 'build.gradle'], confidence: 'high' },
                { name: 'Rust', files: ['Cargo.toml'], confidence: 'high' },
                { name: 'Go', files: ['go.mod'], confidence: 'high' },
                { name: 'Python', files: ['requirements.txt', 'pyproject.toml', 'setup.py'], confidence: 'high' },
                { name: '.NET', files: ['.csproj', '.sln'], confidence: 'high' },
                { name: 'PHP', files: ['composer.json'], confidence: 'high' },
                { name: 'Ruby', files: ['Gemfile'], confidence: 'high' }
            ];

            for (const pattern of languagePatterns) {
                for (const file of pattern.files) {
                    const filePath = path.join(workspacePath, file);
                    if (fs.existsSync(filePath)) {
                        // Special case for .NET: need to find .csproj or .sln files
                        if (file === '.csproj' || file === '.sln') {
                            const files = fs.readdirSync(workspacePath);
                            const hasProject = files.some(f => 
                                f.endsWith('.csproj') || f.endsWith('.sln')
                            );
                            if (hasProject) {
                                return Result.ok({
                                    language: pattern.name,
                                    confidence: pattern.confidence,
                                    detectedFrom: file
                                });
                            }
                        } else {
                            return Result.ok({
                                language: pattern.name,
                                confidence: pattern.confidence,
                                detectedFrom: file
                            });
                        }
                    }
                }
            }

            // Check for package.json (JavaScript/TypeScript)
            const packageJsonPath = path.join(workspacePath, 'package.json');
            if (fs.existsSync(packageJsonPath)) {
                try {
                    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
                    const allDeps = {
                        ...packageJson.dependencies,
                        ...packageJson.devDependencies
                    };

                    // Check for TypeScript
                    if (allDeps['typescript'] || fs.existsSync(path.join(workspacePath, 'tsconfig.json'))) {
                        return Result.ok({
                            language: 'TypeScript',
                            confidence: 'high',
                            detectedFrom: 'tsconfig.json or typescript dependency'
                        });
                    }

                    // Default to JavaScript if package.json exists
                    return Result.ok({
                        language: 'JavaScript',
                        confidence: 'medium',
                        detectedFrom: 'package.json'
                    });
                } catch (parseError) {
                    // Invalid package.json, continue
                }
            }

            // No language detected
            return Result.ok(undefined);

        } catch (error) {
            return Result.fail(
                new DetectionError(
                    `Failed to detect language: ${error instanceof Error ? error.message : String(error)}`,
                    workspacePath
                )
            );
        }
    }

    /**
     * Detect package manager from lock files
     * Migrated from WorkspaceSyncService.detectProjectInfo
     */
    async detectPackageManager(workspacePath: string): Promise<Result<'npm' | 'yarn' | 'pnpm' | undefined, BaseError>> {
        try {
            // Check in priority order (pnpm > yarn > npm)
            if (fs.existsSync(path.join(workspacePath, 'pnpm-lock.yaml'))) {
                return Result.ok('pnpm');
            }

            if (fs.existsSync(path.join(workspacePath, 'yarn.lock'))) {
                return Result.ok('yarn');
            }

            if (fs.existsSync(path.join(workspacePath, 'package-lock.json'))) {
                return Result.ok('npm');
            }

            // No lock file found
            return Result.ok(undefined);

        } catch (error) {
            return Result.fail(
                new DetectionError(
                    `Failed to detect package manager: ${error instanceof Error ? error.message : String(error)}`,
                    workspacePath
                )
            );
        }
    }

    /**
     * Check if workspace has specific file
     */
    async hasFile(workspacePath: string, fileName: string): Promise<Result<boolean, BaseError>> {
        try {
            const filePath = path.join(workspacePath, fileName);
            const exists = fs.existsSync(filePath);
            return Result.ok(exists);

        } catch (error) {
            return Result.fail(
                new PathError(
                    `Failed to check file existence: ${error instanceof Error ? error.message : String(error)}`,
                    path.join(workspacePath, fileName)
                )
            );
        }
    }

    /**
     * Read and parse package.json file
     */
    async readPackageJson(workspacePath: string): Promise<Result<PackageDependencies | undefined, BaseError>> {
        try {
            const packageJsonPath = path.join(workspacePath, 'package.json');

            if (!fs.existsSync(packageJsonPath)) {
                return Result.ok(undefined);
            }

            const content = fs.readFileSync(packageJsonPath, 'utf-8');
            const packageJson = JSON.parse(content);

            return Result.ok({
                dependencies: packageJson.dependencies,
                devDependencies: packageJson.devDependencies
            });

        } catch (error) {
            if (error instanceof SyntaxError) {
                return Result.fail(
                    new DetectionError(
                        'Invalid package.json format',
                        path.join(workspacePath, 'package.json')
                    )
                );
            }

            return Result.fail(
                new PathError(
                    `Failed to read package.json: ${error instanceof Error ? error.message : String(error)}`,
                    path.join(workspacePath, 'package.json')
                )
            );
        }
    }
}
