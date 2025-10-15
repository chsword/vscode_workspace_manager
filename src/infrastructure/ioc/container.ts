import 'reflect-metadata';
import { container } from 'tsyringe';
import * as vscode from 'vscode';
import { ILogger } from '../logging/ILogger';
import { VSCodeLogger } from '../logging/VSCodeLogger';
import { IWorkspaceRepository } from '@core/domain/repositories/IWorkspaceRepository';
import { ITagRepository } from '@core/domain/repositories/ITagRepository';
import { VSCodeWorkspaceRepository } from '../repositories/VSCodeWorkspaceRepository';
import { VSCodeTagRepository } from '../repositories/VSCodeTagRepository';
import { WorkspaceStorage } from '../../storage/workspaceStorage';

/**
 * Configure the dependency injection container
 */
export function configureContainer(context: vscode.ExtensionContext): void {
  // Register VS Code Extension Context
  container.registerInstance('ExtensionContext', context);

  // Register Storage (legacy - needed by repositories)
  container.registerInstance('WorkspaceStorage', new WorkspaceStorage(context));

  // Register Infrastructure Services
  container.registerSingleton<ILogger>('ILogger', VSCodeLogger);

  // Register Repositories
  container.registerSingleton<IWorkspaceRepository>('IWorkspaceRepository', VSCodeWorkspaceRepository);
  container.registerSingleton<ITagRepository>('ITagRepository', VSCodeTagRepository);

  // TODO: Register adapters when implemented
  // container.registerSingleton('SQLiteAdapter', SQLiteAdapter);
  // container.registerSingleton('IHistoryAdapter', VSCodeHistoryAdapter);

  // TODO: Register use cases when implemented
  // container.registerSingleton('GetWorkspaces', GetWorkspaces);
  // container.registerSingleton('CreateWorkspace', CreateWorkspace);

  // TODO: Register presentation services when implemented
  // container.registerSingleton('WorkspaceCommands', WorkspaceCommands);
}

/**
 * Export the container for use in other parts of the application
 */
export { container };
