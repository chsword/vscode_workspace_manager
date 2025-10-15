import * as vscode from 'vscode';
import { injectable } from 'tsyringe';
import { ILogger, LogLevel, LogEntry } from './ILogger';

/**
 * VS Code output channel logger implementation
 */
@injectable()
export class VSCodeLogger implements ILogger {
  private outputChannel: vscode.OutputChannel;
  private level: LogLevel = LogLevel.INFO;

  constructor() {
    this.outputChannel = vscode.window.createOutputChannel('Workspace Manager');
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  debug(message: string, context?: Record<string, unknown>): void {
    if (this.level <= LogLevel.DEBUG) {
      this.log(LogLevel.DEBUG, message, context);
    }
  }

  info(message: string, context?: Record<string, unknown>): void {
    if (this.level <= LogLevel.INFO) {
      this.log(LogLevel.INFO, message, context);
    }
  }

  warn(message: string, context?: Record<string, unknown>): void {
    if (this.level <= LogLevel.WARN) {
      this.log(LogLevel.WARN, message, context);
    }
  }

  error(message: string, context?: Record<string, unknown>): void {
    if (this.level <= LogLevel.ERROR) {
      this.log(LogLevel.ERROR, message, context);
    }
  }

  private log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      context
    };

    const formattedMessage = this.formatLogEntry(entry);
    this.outputChannel.appendLine(formattedMessage);

    // Show output channel for errors and warnings (optional)
    if (level >= LogLevel.ERROR) {
      // Don't auto-show to avoid disruption, but can be enabled if needed
      // this.outputChannel.show(true);
    }
  }

  private formatLogEntry(entry: LogEntry): string {
    const timestamp = entry.timestamp.toISOString();
    const levelName = LogLevel[entry.level];
    const contextStr = entry.context 
      ? ` | ${JSON.stringify(entry.context, null, 2)}`
      : '';

    return `[${timestamp}] [${levelName}] ${entry.message}${contextStr}`;
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.outputChannel.dispose();
  }
}
