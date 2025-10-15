import * as assert from 'assert';
import { WorkspaceId, WorkspacePath, WorkspaceName } from './WorkspaceValueObjects';

suite('WorkspaceValueObjects Test Suite', () => {
    
    suite('WorkspaceId', () => {
        
        test('should create valid UUID-based WorkspaceId', () => {
            const uuid = '550e8400-e29b-41d4-a716-446655440000';
            const result = WorkspaceId.create(uuid);
            
            assert.strictEqual(result.isSuccess, true);
            assert.strictEqual(result.value.toString(), uuid);
        });
        
        test('should create valid Base64-based WorkspaceId (backward compatibility)', () => {
            const base64Id = 'QzpcXFVzZXJzXFx0ZXN0XFxwcm9qZWN0';
            const result = WorkspaceId.create(base64Id);
            
            assert.strictEqual(result.isSuccess, true);
            assert.strictEqual(result.value.toString(), base64Id);
        });
        
        test('should generate new WorkspaceId', () => {
            const result = WorkspaceId.generate();
            
            assert.strictEqual(result.isSuccess, true);
            assert.ok(result.value.toString().match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i));
        });
        
        test('should reject empty WorkspaceId', () => {
            const result = WorkspaceId.create('');
            
            assert.strictEqual(result.isFailure, true);
            assert.ok(result.error.message.includes('cannot be empty'));
        });
        
        test('should reject whitespace-only WorkspaceId', () => {
            const result = WorkspaceId.create('   ');
            
            assert.strictEqual(result.isFailure, true);
            assert.ok(result.error.message.includes('cannot be empty'));
        });
        
        test('should reject invalid format WorkspaceId', () => {
            const result = WorkspaceId.create('invalid-id-format!@#');
            
            assert.strictEqual(result.isFailure, true);
            assert.ok(result.error.message.includes('Invalid workspace ID format'));
        });
        
        test('should compare WorkspaceIds correctly', () => {
            const id1Result = WorkspaceId.create('550e8400-e29b-41d4-a716-446655440000');
            const id2Result = WorkspaceId.create('550e8400-e29b-41d4-a716-446655440000');
            const id3Result = WorkspaceId.create('660e8400-e29b-41d4-a716-446655440000');
            
            assert.strictEqual(id1Result.value.equals(id2Result.value), true);
            assert.strictEqual(id1Result.value.equals(id3Result.value), false);
        });
    });
    
    suite('WorkspacePath', () => {
        
        test('should create valid WorkspacePath', () => {
            const path = '/home/user/projects/my-app';
            const result = WorkspacePath.create(path);
            
            assert.strictEqual(result.isSuccess, true);
            assert.strictEqual(result.value.toString(), path);
        });
        
        test('should normalize path by removing trailing slashes', () => {
            const result1 = WorkspacePath.create('/home/user/projects/my-app/');
            const result2 = WorkspacePath.create('/home/user/projects/my-app//');
            
            assert.strictEqual(result1.value.toString(), '/home/user/projects/my-app');
            assert.strictEqual(result2.value.toString(), '/home/user/projects/my-app');
        });
        
        test('should handle Windows paths', () => {
            const windowsPath = 'C:\\Users\\test\\project';
            const result = WorkspacePath.create(windowsPath);
            
            assert.strictEqual(result.isSuccess, true);
            assert.strictEqual(result.value.toString(), windowsPath);
        });
        
        test('should handle WSL paths', () => {
            const wslPath = '\\\\wsl$\\Ubuntu\\home\\user\\project';
            const result = WorkspacePath.create(wslPath);
            
            assert.strictEqual(result.isSuccess, true);
        });
        
        test('should handle remote paths', () => {
            const remotePath = 'ssh://user@host/path/to/project';
            const result = WorkspacePath.create(remotePath);
            
            assert.strictEqual(result.isSuccess, true);
        });
        
        test('should reject empty path', () => {
            const result = WorkspacePath.create('');
            
            assert.strictEqual(result.isFailure, true);
            assert.ok(result.error.message.includes('cannot be empty'));
        });
        
        test('should reject whitespace-only path', () => {
            const result = WorkspacePath.create('   ');
            
            assert.strictEqual(result.isFailure, true);
            assert.ok(result.error.message.includes('cannot be empty'));
        });
        
        test('should compare paths case-insensitively (Windows compatibility)', () => {
            const path1Result = WorkspacePath.create('C:\\Users\\Test\\Project');
            const path2Result = WorkspacePath.create('c:\\users\\test\\project');
            
            assert.strictEqual(path1Result.value.equals(path2Result.value), true);
        });
        
        test('should extract filename from path', () => {
            const path1 = WorkspacePath.create('/home/user/projects/my-app').value;
            const path2 = WorkspacePath.create('C:\\Users\\test\\my-project').value;
            
            assert.strictEqual(path1.getFileName(), 'my-app');
            assert.strictEqual(path2.getFileName(), 'my-project');
        });
        
        test('should handle paths with special characters', () => {
            const specialPath = '/home/user/projects/my-app (v2)';
            const result = WorkspacePath.create(specialPath);
            
            assert.strictEqual(result.isSuccess, true);
            assert.strictEqual(result.value.toString(), specialPath);
        });
    });
    
    suite('WorkspaceName', () => {
        
        test('should create valid WorkspaceName', () => {
            const name = 'My Project';
            const result = WorkspaceName.create(name);
            
            assert.strictEqual(result.isSuccess, true);
            assert.strictEqual(result.value.toString(), name);
        });
        
        test('should trim whitespace from WorkspaceName', () => {
            const result = WorkspaceName.create('  My Project  ');
            
            assert.strictEqual(result.isSuccess, true);
            assert.strictEqual(result.value.toString(), 'My Project');
        });
        
        test('should reject empty name', () => {
            const result = WorkspaceName.create('');
            
            assert.strictEqual(result.isFailure, true);
            assert.ok(result.error.message.includes('cannot be empty'));
        });
        
        test('should reject whitespace-only name', () => {
            const result = WorkspaceName.create('   ');
            
            assert.strictEqual(result.isFailure, true);
            assert.ok(result.error.message.includes('cannot be empty'));
        });
        
        test('should reject name exceeding 255 characters', () => {
            const longName = 'a'.repeat(256);
            const result = WorkspaceName.create(longName);
            
            assert.strictEqual(result.isFailure, true);
            assert.ok(result.error.message.includes('too long'));
        });
        
        test('should accept name with exactly 255 characters', () => {
            const name = 'a'.repeat(255);
            const result = WorkspaceName.create(name);
            
            assert.strictEqual(result.isSuccess, true);
        });
        
        test('should handle special characters in name', () => {
            const name = 'My Project (v2) - [Production]';
            const result = WorkspaceName.create(name);
            
            assert.strictEqual(result.isSuccess, true);
            assert.strictEqual(result.value.toString(), name);
        });
        
        test('should handle Unicode characters in name', () => {
            const name = '我的项目 📁';
            const result = WorkspaceName.create(name);
            
            assert.strictEqual(result.isSuccess, true);
            assert.strictEqual(result.value.toString(), name);
        });
        
        test('should compare WorkspaceNames correctly', () => {
            const name1Result = WorkspaceName.create('My Project');
            const name2Result = WorkspaceName.create('My Project');
            const name3Result = WorkspaceName.create('Other Project');
            
            assert.strictEqual(name1Result.value.equals(name2Result.value), true);
            assert.strictEqual(name1Result.value.equals(name3Result.value), false);
        });
        
        test('should handle names with leading/trailing special characters', () => {
            const name = '.my-project_v2';
            const result = WorkspaceName.create(name);
            
            assert.strictEqual(result.isSuccess, true);
            assert.strictEqual(result.value.toString(), name);
        });
    });
});
