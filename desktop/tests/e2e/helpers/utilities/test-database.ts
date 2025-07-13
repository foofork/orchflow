import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface TestUser {
  id: string;
  username: string;
  email: string;
  password: string;
  role: 'admin' | 'user' | 'guest';
  createdAt: Date;
  metadata?: Record<string, any>;
}

export interface TestProject {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  collaborators: string[];
  files: TestFile[];
  createdAt: Date;
  updatedAt: Date;
  settings?: Record<string, any>;
}

export interface TestFile {
  id: string;
  name: string;
  path: string;
  content: string;
  type: string;
  size: number;
  createdAt: Date;
  modifiedAt: Date;
}

export interface TestGitRepo {
  id: string;
  name: string;
  remote: string;
  branch: string;
  commits: TestCommit[];
  status: 'clean' | 'dirty';
}

export interface TestCommit {
  hash: string;
  message: string;
  author: string;
  date: Date;
  files: string[];
}

export class TestDatabase {
  private users: Map<string, TestUser> = new Map();
  private projects: Map<string, TestProject> = new Map();
  private repos: Map<string, TestGitRepo> = new Map();
  private dataDir: string;
  private initialized = false;

  constructor(dataDir = './test-data') {
    this.dataDir = dataDir;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    await fs.mkdir(this.dataDir, { recursive: true });
    await this.loadData();
    this.initialized = true;
  }

  async reset(): Promise<void> {
    this.users.clear();
    this.projects.clear();
    this.repos.clear();
    await this.seedDefaultData();
    await this.saveData();
  }

  async cleanup(): Promise<void> {
    this.users.clear();
    this.projects.clear();
    this.repos.clear();
    
    try {
      await fs.rm(this.dataDir, { recursive: true, force: true });
    } catch (error) {
      console.error('Error cleaning up test data:', error);
    }
  }

  // User Management
  async createUser(userData: Partial<TestUser>): Promise<TestUser> {
    const user: TestUser = {
      id: userData.id || uuidv4(),
      username: userData.username || `user_${Date.now()}`,
      email: userData.email || `user_${Date.now()}@test.com`,
      password: userData.password || 'password123',
      role: userData.role || 'user',
      createdAt: userData.createdAt || new Date(),
      metadata: userData.metadata
    };

    this.users.set(user.id, user);
    await this.saveData();
    return user;
  }

  async createUsers(count: number, template?: Partial<TestUser>): Promise<TestUser[]> {
    const users: TestUser[] = [];
    
    for (let i = 0; i < count; i++) {
      const user = await this.createUser({
        ...template,
        username: `${template?.username || 'user'}_${i}`,
        email: `${template?.username || 'user'}_${i}@test.com`
      });
      users.push(user);
    }
    
    return users;
  }

  getUser(id: string): TestUser | undefined {
    return this.users.get(id);
  }

  getUserByUsername(username: string): TestUser | undefined {
    return Array.from(this.users.values()).find(u => u.username === username);
  }

  getUserByEmail(email: string): TestUser | undefined {
    return Array.from(this.users.values()).find(u => u.email === email);
  }

  getAllUsers(): TestUser[] {
    return Array.from(this.users.values());
  }

  async updateUser(id: string, updates: Partial<TestUser>): Promise<TestUser | null> {
    const user = this.users.get(id);
    if (!user) return null;

    const updatedUser = { ...user, ...updates, id };
    this.users.set(id, updatedUser);
    await this.saveData();
    return updatedUser;
  }

  async deleteUser(id: string): Promise<boolean> {
    const deleted = this.users.delete(id);
    if (deleted) {
      await this.saveData();
    }
    return deleted;
  }

  // Project Management
  async createProject(projectData: Partial<TestProject>): Promise<TestProject> {
    const project: TestProject = {
      id: projectData.id || uuidv4(),
      name: projectData.name || `project_${Date.now()}`,
      description: projectData.description || 'Test project',
      ownerId: projectData.ownerId || '',
      collaborators: projectData.collaborators || [],
      files: projectData.files || [],
      createdAt: projectData.createdAt || new Date(),
      updatedAt: projectData.updatedAt || new Date(),
      settings: projectData.settings
    };

    this.projects.set(project.id, project);
    await this.saveData();
    return project;
  }

  getProject(id: string): TestProject | undefined {
    return this.projects.get(id);
  }

  getProjectsByOwner(ownerId: string): TestProject[] {
    return Array.from(this.projects.values()).filter(p => p.ownerId === ownerId);
  }

  getProjectsByCollaborator(userId: string): TestProject[] {
    return Array.from(this.projects.values()).filter(p => 
      p.collaborators.includes(userId) || p.ownerId === userId
    );
  }

  async addFileToProject(projectId: string, fileData: Partial<TestFile>): Promise<TestFile | null> {
    const project = this.projects.get(projectId);
    if (!project) return null;

    const file: TestFile = {
      id: fileData.id || uuidv4(),
      name: fileData.name || 'untitled.txt',
      path: fileData.path || '/',
      content: fileData.content || '',
      type: fileData.type || 'text/plain',
      size: fileData.size || fileData.content?.length || 0,
      createdAt: fileData.createdAt || new Date(),
      modifiedAt: fileData.modifiedAt || new Date()
    };

    project.files.push(file);
    project.updatedAt = new Date();
    await this.saveData();
    return file;
  }

  async updateProjectFile(projectId: string, fileId: string, updates: Partial<TestFile>): Promise<TestFile | null> {
    const project = this.projects.get(projectId);
    if (!project) return null;

    const fileIndex = project.files.findIndex(f => f.id === fileId);
    if (fileIndex === -1) return null;

    const updatedFile = { ...project.files[fileIndex], ...updates, id: fileId };
    project.files[fileIndex] = updatedFile;
    project.updatedAt = new Date();
    await this.saveData();
    return updatedFile;
  }

  async deleteProjectFile(projectId: string, fileId: string): Promise<boolean> {
    const project = this.projects.get(projectId);
    if (!project) return false;

    const initialLength = project.files.length;
    project.files = project.files.filter(f => f.id !== fileId);
    
    if (project.files.length < initialLength) {
      project.updatedAt = new Date();
      await this.saveData();
      return true;
    }
    
    return false;
  }

  // Git Repository Management
  async createGitRepo(repoData: Partial<TestGitRepo>): Promise<TestGitRepo> {
    const repo: TestGitRepo = {
      id: repoData.id || uuidv4(),
      name: repoData.name || `repo_${Date.now()}`,
      remote: repoData.remote || 'https://github.com/test/repo.git',
      branch: repoData.branch || 'main',
      commits: repoData.commits || [],
      status: repoData.status || 'clean'
    };

    this.repos.set(repo.id, repo);
    await this.saveData();
    return repo;
  }

  async addCommit(repoId: string, commitData: Partial<TestCommit>): Promise<TestCommit | null> {
    const repo = this.repos.get(repoId);
    if (!repo) return null;

    const commit: TestCommit = {
      hash: commitData.hash || uuidv4().substring(0, 7),
      message: commitData.message || 'Test commit',
      author: commitData.author || 'Test User',
      date: commitData.date || new Date(),
      files: commitData.files || []
    };

    repo.commits.push(commit);
    await this.saveData();
    return commit;
  }

  getGitRepo(id: string): TestGitRepo | undefined {
    return this.repos.get(id);
  }

  // Test Data Generation
  generateRandomString(length = 10): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  generateFileContent(type: string): string {
    const templates: Record<string, string> = {
      'javascript': `function example() {\n  console.log('Hello, World!');\n}\n\nexample();`,
      'typescript': `interface Example {\n  message: string;\n}\n\nconst example: Example = {\n  message: 'Hello, World!'\n};`,
      'python': `def example():\n    print("Hello, World!")\n\nif __name__ == "__main__":\n    example()`,
      'html': `<!DOCTYPE html>\n<html>\n<head>\n  <title>Test</title>\n</head>\n<body>\n  <h1>Hello, World!</h1>\n</body>\n</html>`,
      'css': `body {\n  font-family: Arial, sans-serif;\n  margin: 0;\n  padding: 20px;\n}`,
      'json': `{\n  "name": "test",\n  "version": "1.0.0",\n  "description": "Test file"\n}`,
      'markdown': `# Test Document\n\nThis is a test markdown file.\n\n## Section 1\n\nSome content here.`
    };

    return templates[type] || 'Test content';
  }

  // Seeding
  private async seedDefaultData(): Promise<void> {
    // Create default admin user
    const admin = await this.createUser({
      username: 'admin',
      email: 'admin@test.com',
      password: 'admin123',
      role: 'admin'
    });

    // Create default test users
    const user1 = await this.createUser({
      username: 'testuser1',
      email: 'user1@test.com',
      password: 'password123',
      role: 'user'
    });

    const user2 = await this.createUser({
      username: 'testuser2',
      email: 'user2@test.com',
      password: 'password123',
      role: 'user'
    });

    // Create sample projects
    const project1 = await this.createProject({
      name: 'Sample Project 1',
      description: 'A sample project for testing',
      ownerId: user1.id,
      collaborators: [user2.id]
    });

    // Add files to project
    await this.addFileToProject(project1.id, {
      name: 'index.js',
      path: '/src/index.js',
      content: this.generateFileContent('javascript'),
      type: 'application/javascript'
    });

    await this.addFileToProject(project1.id, {
      name: 'styles.css',
      path: '/src/styles.css',
      content: this.generateFileContent('css'),
      type: 'text/css'
    });

    // Create sample git repo
    const repo = await this.createGitRepo({
      name: 'sample-repo',
      remote: 'https://github.com/test/sample.git',
      branch: 'main'
    });

    // Add commits
    await this.addCommit(repo.id, {
      message: 'Initial commit',
      author: 'Test User',
      files: ['README.md']
    });

    await this.addCommit(repo.id, {
      message: 'Add index.js',
      author: 'Test User',
      files: ['index.js']
    });
  }

  // Persistence
  private async saveData(): Promise<void> {
    const data = {
      users: Array.from(this.users.entries()),
      projects: Array.from(this.projects.entries()),
      repos: Array.from(this.repos.entries())
    };

    await fs.writeFile(
      path.join(this.dataDir, 'test-db.json'),
      JSON.stringify(data, null, 2)
    );
  }

  private async loadData(): Promise<void> {
    try {
      const dataPath = path.join(this.dataDir, 'test-db.json');
      const exists = await fs.access(dataPath).then(() => true).catch(() => false);
      
      if (exists) {
        const content = await fs.readFile(dataPath, 'utf-8');
        const data = JSON.parse(content);
        
        this.users = new Map(data.users || []);
        this.projects = new Map(data.projects || []);
        this.repos = new Map(data.repos || []);
      } else {
        await this.seedDefaultData();
      }
    } catch (error) {
      console.error('Error loading test data:', error);
      await this.seedDefaultData();
    }
  }

  // Query helpers
  async findUsers(predicate: (user: TestUser) => boolean): Promise<TestUser[]> {
    return Array.from(this.users.values()).filter(predicate);
  }

  async findProjects(predicate: (project: TestProject) => boolean): Promise<TestProject[]> {
    return Array.from(this.projects.values()).filter(predicate);
  }

  async findFiles(predicate: (file: TestFile) => boolean): Promise<Array<{ file: TestFile; project: TestProject }>> {
    const results: Array<{ file: TestFile; project: TestProject }> = [];
    
    for (const project of this.projects.values()) {
      for (const file of project.files) {
        if (predicate(file)) {
          results.push({ file, project });
        }
      }
    }
    
    return results;
  }

  // Statistics
  getStats(): { users: number; projects: number; files: number; repos: number; commits: number } {
    let totalFiles = 0;
    let totalCommits = 0;
    
    for (const project of this.projects.values()) {
      totalFiles += project.files.length;
    }
    
    for (const repo of this.repos.values()) {
      totalCommits += repo.commits.length;
    }
    
    return {
      users: this.users.size,
      projects: this.projects.size,
      files: totalFiles,
      repos: this.repos.size,
      commits: totalCommits
    };
  }
}