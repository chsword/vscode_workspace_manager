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
import { IWorkspaceDomainRepository, WorkspaceDomainRepositoryAdapter } from '@core/application/adapters/WorkspaceDomainRepositoryAdapter';
import { 
  GetWorkspacesUseCase,
  GetWorkspaceByIdUseCase,
  CreateWorkspaceUseCase,
  UpdateWorkspaceUseCase,
  DeleteWorkspaceUseCase,
  ToggleFavoriteUseCase,
  TogglePinUseCase,
  SyncWorkspacesUseCase
} from '@core/application/use-cases';

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

  // Register Domain Repository Adapters
  container.registerSingleton<IWorkspaceDomainRepository>('IWorkspaceDomainRepository', WorkspaceDomainRepositoryAdapter);

  // Register Use Cases
  container.registerSingleton('GetWorkspacesUseCase', GetWorkspacesUseCase);
  container.registerSingleton('GetWorkspaceByIdUseCase', GetWorkspaceByIdUseCase);
  container.registerSingleton('CreateWorkspaceUseCase', CreateWorkspaceUseCase);
  container.registerSingleton('UpdateWorkspaceUseCase', UpdateWorkspaceUseCase);
  container.registerSingleton('DeleteWorkspaceUseCase', DeleteWorkspaceUseCase);
  container.registerSingleton('ToggleFavoriteUseCase', ToggleFavoriteUseCase);
  container.registerSingleton('TogglePinUseCase', TogglePinUseCase);
  container.registerSingleton('SyncWorkspacesUseCase', SyncWorkspacesUseCase);

  // TODO: Register adapters when implemented
  // container.registerSingleton('SQLiteAdapter', SQLiteAdapter);
  // container.registerSingleton('IHistoryAdapter', VSCodeHistoryAdapter);

  // TODO: Register presentation services when implemented
  // container.registerSingleton('WorkspaceCommands', WorkspaceCommands);
}

/**
 * Export the container for use in other parts of the application
 */
export { container };
