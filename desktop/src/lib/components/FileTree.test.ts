import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, waitFor, screen } from '@testing-library/svelte';
import FileTree from './FileTree.svelte';
import type { TreeNode } from '$lib/types';
import { createTypedMock, createVoidMock } from '@/test/mock-factory';
import { mockSvelteEvents } from '@/test/svelte5-event-helper';

describe('FileTree', () => {
  let cleanup: Array<() => void> = [];

  afterEach(() => {
    cleanup.forEach(fn => fn());
    cleanup = [];
  });

  const createNode = (overrides: Partial<TreeNode> = {}): TreeNode => ({
    name: 'test-node',
    path: '/test/path',
    isDirectory: false,
    ...overrides
  });

  describe('Rendering', () => {
    it('renders file node', () => {
      const node = createNode({ name: 'test.txt' });
      const { container, unmount } = render(FileTree, { props: { node } });
      cleanup.push(unmount);
      
      expect(container.querySelector('.node-item')).toBeTruthy();
      expect(container.textContent).toContain('test.txt');
      expect(container.querySelector('.chevron')).toBeFalsy();
      expect(container.querySelector('.spacer')).toBeTruthy();
    });

    it('renders directory node', () => {
      const node = createNode({ 
        name: 'src',
        isDirectory: true,
        children: []
      });
      const { container, unmount } = render(FileTree, { props: { node } });
      cleanup.push(unmount);
      
      expect(container.querySelector('.directory')).toBeTruthy();
      expect(container.querySelector('.chevron')).toBeTruthy();
      expect(container.querySelector('.spacer')).toBeFalsy();
    });

    it('renders with correct indentation', () => {
      const node = createNode();
      const { container, unmount } = render(FileTree, { props: { node, level: 2 } });
      cleanup.push(unmount);
      
      const nodeItem = container.querySelector('.node-item') as HTMLElement;
      expect(nodeItem.style.paddingLeft).toBe('40px'); // 8 + 2 * 16
    });

    it('renders selected state', () => {
      const node = createNode({ path: '/selected' });
      const { container, unmount } = render(FileTree, { 
        props: { node, selectedPath: '/selected' } 
      });
      cleanup.push(unmount);
      
      expect(container.querySelector('.selected')).toBeTruthy();
    });

    it('renders expanded directory with children', async () => {
      const node = createNode({
        name: 'parent',
        isDirectory: true,
        expanded: true,
        children: [
          createNode({ name: 'child1.txt', path: '/parent/child1.txt' }),
          createNode({ name: 'child2.txt', path: '/parent/child2.txt' })
        ]
      });
      
      const { container, unmount } = render(FileTree, { props: { node } });
      cleanup.push(unmount);
      
      await waitFor(() => {
        expect(container.querySelector('.children')).toBeTruthy();
        expect(container.textContent).toContain('child1.txt');
        expect(container.textContent).toContain('child2.txt');
      });
    });

    it('shows loading indicator', () => {
      const node = createNode({ loading: true });
      const { container, unmount } = render(FileTree, { props: { node } });
      cleanup.push(unmount);
      
      expect(container.querySelector('.loading')).toBeTruthy();
    });
  });

  describe('File Icons', () => {
    it.each([
      ['package.json', '📦'],
      ['tsconfig.json', '🔧'],
      ['.gitignore', '🚫'],
      ['README.md', '📖'],
      ['LICENSE', '⚖️'],
      ['Dockerfile', '🐋'],
      ['.env', '🔐'],
      ['script.js', '📜'],
      ['Component.jsx', '⚛️'],
      ['types.ts', '📘'],
      ['App.tsx', '⚛️'],
      ['index.html', '🌐'],
      ['styles.css', '🎨'],
      ['styles.scss', '💅'],
      ['App.svelte', '🔥'],
      ['App.vue', '💚'],
      ['data.json', '📋'],
      ['config.yaml', '📐'],
      ['doc.md', '📝'],
      ['notes.txt', '📄'],
      ['image.png', '🖼️'],
      ['logo.svg', '🎨'],
      ['main.py', '🐍'],
      ['lib.rs', '🦀'],
      ['main.go', '🐹'],
      ['App.java', '☕'],
      ['script.sh', '🖥️'],
      ['archive.zip', '📦'],
      ['unknown.xyz', '📄']
    ])('shows correct icon for %s', (filename, expectedIcon) => {
      const node = createNode({ name: filename });
      const { container, unmount } = render(FileTree, { props: { node } });
      cleanup.push(unmount);
      
      const icon = container.querySelector('.icon');
      expect(icon?.textContent).toBe(expectedIcon);
    });

    it('shows folder icon for directories', () => {
      const node = createNode({ isDirectory: true, expanded: false });
      const { container, unmount } = render(FileTree, { props: { node } });
      cleanup.push(unmount);
      
      expect(container.querySelector('.icon')?.textContent).toBe('📁');
    });

    it('shows open folder icon for expanded directories', () => {
      const node = createNode({ isDirectory: true, expanded: true });
      const { container, unmount } = render(FileTree, { props: { node } });
      cleanup.push(unmount);
      
      expect(container.querySelector('.icon')?.textContent).toBe('📂');
    });
  });

  describe('Interactions', () => {
    it('dispatches select and openFile on file click', async () => {
      const node = createNode({ path: '/file.txt' });
      const { container, component, unmount } = render(FileTree, { props: { node } });
      cleanup.push(unmount);
      
      const selectHandler = createVoidMock<[CustomEvent]>();
      const openFileHandler = createVoidMock<[CustomEvent]>();
      const mockComponent = mockSvelteEvents(component);
      mockComponent.$on('select', selectHandler);
      const mockComponent = mockSvelteEvents(component);
      mockComponent.$on('openFile', openFileHandler);
      
      const nodeItem = container.querySelector('.node-item') as HTMLElement;
      await fireEvent.click(nodeItem);
      
      expect(selectHandler).toHaveBeenCalledWith(
        expect.objectContaining({ detail: '/file.txt' })
      );
      expect(openFileHandler).toHaveBeenCalledWith(
        expect.objectContaining({ detail: '/file.txt' })
      );
    });

    it('toggles directory expansion on click', async () => {
      const node = createNode({ 
        isDirectory: true,
        expanded: false,
        children: []
      });
      const { container, component, unmount } = render(FileTree, { props: { node } });
      cleanup.push(unmount);
      
      const nodeItem = container.querySelector('.node-item') as HTMLElement;
      await fireEvent.click(nodeItem);
      
      expect(node.expanded).toBe(true);
      expect(container.querySelector('.chevron.expanded')).toBeTruthy();
    });

    it('dispatches expand event for empty directory', async () => {
      const node = createNode({ 
        isDirectory: true,
        expanded: false,
        children: []
      });
      const { container, component, unmount } = render(FileTree, { props: { node } });
      cleanup.push(unmount);
      
      const expandHandler = createVoidMock<[CustomEvent]>();
      const mockComponent = mockSvelteEvents(component);
      mockComponent.$on('expand', expandHandler);
      
      const nodeItem = container.querySelector('.node-item') as HTMLElement;
      await fireEvent.click(nodeItem);
      
      expect(expandHandler).toHaveBeenCalledWith(
        expect.objectContaining({ detail: node })
      );
    });

    it('dispatches contextMenu event on right click', async () => {
      const node = createNode();
      const { container, component, unmount } = render(FileTree, { props: { node } });
      cleanup.push(unmount);
      
      const contextMenuHandler = createVoidMock<[CustomEvent]>();
      const mockComponent = mockSvelteEvents(component);
      mockComponent.$on('contextMenu', contextMenuHandler);
      
      const nodeItem = container.querySelector('.node-item') as HTMLElement;
      await fireEvent.contextMenu(nodeItem, { clientX: 100, clientY: 200 });
      
      expect(contextMenuHandler).toHaveBeenCalledWith(
        expect.objectContaining({ 
          detail: { node, x: 100, y: 200 }
        })
      );
    });
  });

  describe('Keyboard Navigation', () => {
    it('toggles on Enter key', async () => {
      const node = createNode({ 
        isDirectory: true,
        expanded: false 
      });
      const { container, unmount } = render(FileTree, { props: { node } });
      cleanup.push(unmount);
      
      const nodeItem = container.querySelector('.node-item') as HTMLElement;
      await fireEvent.keyDown(nodeItem, { key: 'Enter' });
      
      expect(node.expanded).toBe(true);
    });

    it('toggles on Space key', async () => {
      const node = createNode({ 
        isDirectory: true,
        expanded: true 
      });
      const { container, unmount } = render(FileTree, { props: { node } });
      cleanup.push(unmount);
      
      const nodeItem = container.querySelector('.node-item') as HTMLElement;
      await fireEvent.keyDown(nodeItem, { key: ' ' });
      
      expect(node.expanded).toBe(false);
    });

    it('expands directory on ArrowRight', async () => {
      const node = createNode({ 
        isDirectory: true,
        expanded: false 
      });
      const { container, unmount } = render(FileTree, { props: { node } });
      cleanup.push(unmount);
      
      const nodeItem = container.querySelector('.node-item') as HTMLElement;
      await fireEvent.keyDown(nodeItem, { key: 'ArrowRight' });
      
      expect(node.expanded).toBe(true);
    });

    it('collapses directory on ArrowLeft', async () => {
      const node = createNode({ 
        isDirectory: true,
        expanded: true 
      });
      const { container, unmount } = render(FileTree, { props: { node } });
      cleanup.push(unmount);
      
      const nodeItem = container.querySelector('.node-item') as HTMLElement;
      await fireEvent.keyDown(nodeItem, { key: 'ArrowLeft' });
      
      expect(node.expanded).toBe(false);
    });

    it('ignores arrow keys for files', async () => {
      const node = createNode();
      const { container, component, unmount } = render(FileTree, { props: { node } });
      cleanup.push(unmount);
      
      const selectHandler = createVoidMock<[CustomEvent]>();
      const mockComponent = mockSvelteEvents(component);
      mockComponent.$on('select', selectHandler);
      
      const nodeItem = container.querySelector('.node-item') as HTMLElement;
      await fireEvent.keyDown(nodeItem, { key: 'ArrowRight' });
      await fireEvent.keyDown(nodeItem, { key: 'ArrowLeft' });
      
      expect(selectHandler).not.toHaveBeenCalled();
    });
  });

  describe('Agent Status', () => {
    it('shows running agent status', () => {
      const node = createNode({ path: '/test.js' });
      const agents = new Map([
        ['/test.js', { status: 'running', pid: 1234 }]
      ]);
      const { container, unmount } = render(FileTree, { props: { node, agents } });
      cleanup.push(unmount);
      
      const status = container.querySelector('.agent-status') as HTMLElement;
      expect(status).toBeTruthy();
      expect(status.style.color).toBe('var(--success)');
      expect(status.title).toContain('active');
    });

    it('shows error agent status', () => {
      const node = createNode({ path: '/test.js' });
      const agents = new Map([
        ['/test.js', { status: 'error' }]
      ]);
      const { container, unmount } = render(FileTree, { props: { node, agents } });
      cleanup.push(unmount);
      
      const status = container.querySelector('.agent-status') as HTMLElement;
      expect(status).toBeTruthy();
      expect(status.style.color).toBe('var(--error)');
    });

    it('shows warning agent status', () => {
      const node = createNode({ path: '/test.js' });
      const agents = new Map([
        ['/test.js', { status: 'warning' }]
      ]);
      const { container, unmount } = render(FileTree, { props: { node, agents } });
      cleanup.push(unmount);
      
      const status = container.querySelector('.agent-status') as HTMLElement;
      expect(status).toBeTruthy();
      expect(status.style.color).toBe('var(--warning)');
    });

    it('shows idle agent status', () => {
      const node = createNode({ path: '/test.js' });
      const agents = new Map([
        ['/test.js', { status: 'idle' }]
      ]);
      const { container, unmount } = render(FileTree, { props: { node, agents } });
      cleanup.push(unmount);
      
      const status = container.querySelector('.agent-status') as HTMLElement;
      expect(status).toBeTruthy();
      expect(status.style.color).toBe('var(--fg-tertiary)');
    });

    it('hides status for non-agent files', () => {
      const node = createNode({ path: '/test.js' });
      const agents = new Map();
      const { container, unmount } = render(FileTree, { props: { node, agents } });
      cleanup.push(unmount);
      
      expect(container.querySelector('.agent-status')).toBeFalsy();
    });
  });

  describe('Recursive Rendering', () => {
    it('renders nested tree structure', async () => {
      const node = createNode({
        name: 'root',
        path: '/root',
        isDirectory: true,
        expanded: true,
        children: [
          createNode({
            name: 'src',
            path: '/root/src',
            isDirectory: true,
            expanded: true,
            children: [
              createNode({ name: 'index.js', path: '/root/src/index.js' }),
              createNode({ name: 'utils.js', path: '/root/src/utils.js' })
            ]
          }),
          createNode({ name: 'package.json', path: '/root/package.json' })
        ]
      });
      
      const { container, unmount } = render(FileTree, { props: { node } });
      cleanup.push(unmount);
      
      await waitFor(() => {
        expect(container.textContent).toContain('root');
        expect(container.textContent).toContain('src');
        expect(container.textContent).toContain('index.js');
        expect(container.textContent).toContain('utils.js');
        expect(container.textContent).toContain('package.json');
      });
    });

    it('propagates events from nested nodes', async () => {
      const node = createNode({
        name: 'root',
        path: '/root',
        isDirectory: true,
        expanded: true,
        children: [
          createNode({ name: 'file.txt', path: '/root/file.txt' })
        ]
      });
      
      const { container, component, unmount } = render(FileTree, { props: { node } });
      cleanup.push(unmount);
      
      const openFileHandler = createVoidMock<[CustomEvent]>();
      const mockComponent = mockSvelteEvents(component);
      mockComponent.$on('openFile', openFileHandler);
      
      // Find and click the nested file
      const nodeItems = container.querySelectorAll('.node-item');
      const fileNode = Array.from(nodeItems).find(n => n.textContent?.includes('file.txt')) as HTMLElement;
      await fireEvent.click(fileNode);
      
      expect(openFileHandler).toHaveBeenCalledWith(
        expect.objectContaining({ detail: '/root/file.txt' })
      );
    });

    it('maintains selected state in nested nodes', async () => {
      const node = createNode({
        name: 'root',
        path: '/root',
        isDirectory: true,
        expanded: true,
        children: [
          createNode({ name: 'selected.txt', path: '/root/selected.txt' })
        ]
      });
      
      const { container, unmount } = render(FileTree, { 
        props: { node, selectedPath: '/root/selected.txt' } 
      });
      cleanup.push(unmount);
      
      await waitFor(() => {
        const nodeItems = container.querySelectorAll('.node-item');
        const selectedNode = Array.from(nodeItems).find(n => n.textContent?.includes('selected.txt'));
        expect(selectedNode?.classList.contains('selected')).toBe(true);
      });
    });
  });

  describe('Edge Cases', () => {
    it('handles undefined children gracefully', () => {
      const node = createNode({ isDirectory: true, children: undefined });
      const { container, unmount } = render(FileTree, { props: { node } });
      cleanup.push(unmount);
      
      expect(container.querySelector('.tree-node')).toBeTruthy();
    });

    it('handles empty children array', () => {
      const node = createNode({ 
        isDirectory: true,
        expanded: true,
        children: []
      });
      const { container, unmount } = render(FileTree, { props: { node } });
      cleanup.push(unmount);
      
      expect(container.querySelector('.children')).toBeTruthy();
      expect(container.querySelector('.children')?.children.length).toBe(0);
    });

    it('handles files with no extension', () => {
      const node = createNode({ name: 'Makefile' });
      const { container, unmount } = render(FileTree, { props: { node } });
      cleanup.push(unmount);
      
      expect(container.querySelector('.icon')?.textContent).toBe('📄');
    });

    it('handles files with multiple dots', () => {
      const node = createNode({ name: 'app.test.js' });
      const { container, unmount } = render(FileTree, { props: { node } });
      cleanup.push(unmount);
      
      expect(container.querySelector('.icon')?.textContent).toBe('📜');
    });
  });
});