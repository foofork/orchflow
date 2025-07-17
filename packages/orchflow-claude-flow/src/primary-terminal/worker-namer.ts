export interface Task {
  id: string;
  type: string;
  description: string;
  parameters?: any;
}

export class WorkerNamer {
  private usedNames: Set<string> = new Set();

  generateFromDescription(description: string): string {
    // Generate context-aware descriptive names
    const desc = description.toLowerCase();

    // Authentication/Security patterns
    if (desc.match(/auth|login|signin|signup|jwt|oauth|security/)) {
      return this.makeUnique('Auth System Builder');
    }

    // API patterns
    if (desc.match(/api|endpoint|rest|graphql|backend/)) {
      if (desc.includes('user')) {return this.makeUnique('User API Developer');}
      if (desc.includes('payment')) {return this.makeUnique('Payment API Developer');}
      if (desc.includes('data')) {return this.makeUnique('Data API Developer');}
      return this.makeUnique('API Developer');
    }

    // Frontend patterns
    if (desc.match(/ui|interface|frontend|react|vue|angular|component/)) {
      if (desc.includes('dashboard')) {return this.makeUnique('Dashboard UI Developer');}
      if (desc.includes('form')) {return this.makeUnique('Form UI Developer');}
      if (desc.includes('mobile')) {return this.makeUnique('Mobile UI Developer');}
      return this.makeUnique('UI Developer');
    }

    // Database patterns
    if (desc.match(/database|db|sql|mongo|postgres|mysql|migration/)) {
      if (desc.includes('design')) {return this.makeUnique('Database Architect');}
      if (desc.includes('optimize')) {return this.makeUnique('Database Optimizer');}
      return this.makeUnique('Database Engineer');
    }

    // Testing patterns
    if (desc.match(/test|testing|spec|tdd|unit|integration|e2e/)) {
      if (desc.includes('unit')) {return this.makeUnique('Unit Test Engineer');}
      if (desc.includes('integration')) {return this.makeUnique('Integration Tester');}
      if (desc.includes('e2e')) {return this.makeUnique('E2E Test Engineer');}
      return this.makeUnique('Test Engineer');
    }

    // Performance patterns
    if (desc.match(/performance|optimize|speed|fast|efficient|scale/)) {
      return this.makeUnique('Performance Engineer');
    }

    // DevOps patterns
    if (desc.match(/deploy|ci|cd|pipeline|docker|kubernetes|aws/)) {
      return this.makeUnique('DevOps Engineer');
    }

    // Documentation patterns
    if (desc.match(/document|docs|readme|guide|tutorial/)) {
      return this.makeUnique('Documentation Writer');
    }

    // Analytics patterns
    if (desc.match(/analytic|metric|monitor|log|telemetry/)) {
      return this.makeUnique('Analytics Engineer');
    }

    // Machine Learning patterns
    if (desc.match(/ml|machine learning|ai|neural|model/)) {
      return this.makeUnique('ML Engineer');
    }

    // Mobile patterns
    if (desc.match(/mobile|ios|android|react native|flutter/)) {
      if (desc.includes('ios')) {return this.makeUnique('iOS Developer');}
      if (desc.includes('android')) {return this.makeUnique('Android Developer');}
      return this.makeUnique('Mobile Developer');
    }

    // Infrastructure patterns
    if (desc.match(/infrastructure|server|network|cloud/)) {
      return this.makeUnique('Infrastructure Engineer');
    }

    // Research patterns
    if (desc.match(/research|analyze|study|investigate|explore/)) {
      return this.makeUnique('Research Analyst');
    }

    // Design patterns
    if (desc.match(/design|architect|pattern|structure/)) {
      return this.makeUnique('System Architect');
    }

    // Default: Generate from first few meaningful words
    const words = description
      .split(/\s+/)
      .filter(word => word.length > 2 && !this.isStopWord(word))
      .slice(0, 3);

    if (words.length > 0) {
      const name = `${words
        .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ')  } Worker`;
      return this.makeUnique(name);
    }

    // Fallback
    return this.makeUnique('Task Worker');
  }

  generateName(task: Task): string {
    return this.generateFromDescription(task.description);
  }

  ensureUniqueness(name: string, existingNames: string[]): string {
    // Add existing names to our set
    existingNames.forEach(n => this.usedNames.add(n));
    return this.makeUnique(name);
  }

  private makeUnique(baseName: string): string {
    if (!this.usedNames.has(baseName)) {
      this.usedNames.add(baseName);
      return baseName;
    }

    // Add number suffix to make unique
    let counter = 2;
    let uniqueName = `${baseName} ${counter}`;

    while (this.usedNames.has(uniqueName)) {
      counter++;
      uniqueName = `${baseName} ${counter}`;
    }

    this.usedNames.add(uniqueName);
    return uniqueName;
  }

  private isStopWord(word: string): boolean {
    const stopWords = new Set([
      'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'up', 'about', 'into', 'through', 'during',
      'before', 'after', 'above', 'below', 'between', 'under', 'again',
      'further', 'then', 'once', 'that', 'this', 'these', 'those', 'all',
      'each', 'few', 'more', 'most', 'other', 'some', 'such', 'only', 'own',
      'same', 'so', 'than', 'too', 'very', 'can', 'will', 'just', 'should'
    ]);

    return stopWords.has(word.toLowerCase());
  }

  reset(): void {
    this.usedNames.clear();
  }
}