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

// Domain Services
import { IWorkspacePathService } from '@core/domain/services/IWorkspacePathService';
import { IWorkspaceDetectionService } from '@core/domain/services/IWorkspaceDetectionService';
import { IWorkspaceValidationService } from '@core/domain/services/IWorkspaceValidationService';
import { WorkspacePathService } from '@core/domain/services/impl/WorkspacePathService';
import { WorkspaceDetectionService } from '@core/domain/services/impl/WorkspaceDetectionService';
import { WorkspaceValidationService } from '@core/domain/services/impl/WorkspaceValidationService';

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

  // Register Domain Services
  container.registerSingleton<IWorkspacePathService>('IWorkspacePathService', WorkspacePathService);
  container.registerSingleton<IWorkspaceDetectionService>('IWorkspaceDetectionService', WorkspaceDetectionService);
  container.registerSingleton<IWorkspaceValidationService>('IWorkspaceValidationService', WorkspaceValidationService);

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
