<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { manager, activePane } from '$lib/stores/manager';
	import { fly, fade } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';

	export let isOpen = false;
	export let onClose: () => void;

	interface Symbol {
		name: string;
		kind: string;
		line: number;
		column: number;
		endLine: number;
		endColumn: number;
		children?: Symbol[];
		level: number;
		icon: string;
		description?: string;
	}

	interface FileSymbols {
		path: string;
		language: string;
		symbols: Symbol[];
	}

	let searchQuery = '';
	let fileSymbols: FileSymbols | null = null;
	let filteredSymbols: Symbol[] = [];
	let selectedIndex = 0;
	let searchInput: HTMLInputElement;
	let loading = false;
	let error: string | null = null;
	let parseTime = 0;

	const symbolIcons: Record<string, string> = {
		function: '󰊕',
		method: '',
		class: '',
		interface: '',
		enum: '',
		struct: '',
		variable: '',
		constant: '',
		property: '',
		field: '󰆧',
		constructor: '',
		namespace: '󰌗',
		module: '',
		type: '',
		parameter: '',
		import: '',
		export: '',
		comment: '',
		tag: '󰜢',
		attribute: '@',
		default: ''
	};

	const symbolColors: Record<string, string> = {
		function: 'text-blue-400',
		method: 'text-purple-400',
		class: 'text-yellow-400',
		interface: 'text-green-400',
		enum: 'text-orange-400',
		struct: 'text-cyan-400',
		variable: 'text-gray-400',
		constant: 'text-red-400',
		property: 'text-indigo-400',
		field: 'text-pink-400',
		constructor: 'text-teal-400',
		namespace: 'text-lime-400',
		module: 'text-amber-400',
		type: 'text-violet-400',
		parameter: 'text-gray-500',
		import: 'text-gray-600',
		export: 'text-gray-600',
		comment: 'text-gray-500',
		tag: 'text-blue-300',
		attribute: 'text-green-300'
	};

	$: if (isOpen && searchInput) {
		searchInput.focus();
		loadSymbols();
	}

	$: {
		if (fileSymbols) {
			const query = searchQuery.toLowerCase();
			const flatSymbols = flattenSymbols(fileSymbols.symbols);
			
			if (!query) {
				filteredSymbols = flatSymbols;
			} else {
				// Fuzzy search with scoring
				const scored = flatSymbols
					.map(symbol => ({
						symbol,
						score: fuzzyScore(query, symbol.name.toLowerCase())
					}))
					.filter(item => item.score > 0)
					.sort((a, b) => b.score - a.score);
				
				filteredSymbols = scored.map(item => item.symbol);
			}
			
			selectedIndex = Math.min(selectedIndex, filteredSymbols.length - 1);
		}
	}

	function flattenSymbols(symbols: Symbol[], level = 0): Symbol[] {
		const result: Symbol[] = [];
		
		for (const symbol of symbols) {
			result.push({ ...symbol, level });
			if (symbol.children) {
				result.push(...flattenSymbols(symbol.children, level + 1));
			}
		}
		
		return result;
	}

	function fuzzyScore(query: string, text: string): number {
		if (!query) return 1;
		
		let score = 0;
		let queryIndex = 0;
		let lastMatchIndex = -1;
		
		for (let i = 0; i < text.length && queryIndex < query.length; i++) {
			if (text[i] === query[queryIndex]) {
				// Bonus for consecutive matches
				const consecutiveBonus = lastMatchIndex === i - 1 ? 5 : 0;
				
				// Bonus for matching at start
				const startBonus = i === 0 ? 10 : 0;
				
				// Bonus for matching after separator
				const separatorBonus = i > 0 && /[_\-\s]/.test(text[i - 1]) ? 8 : 0;
				
				score += 10 + consecutiveBonus + startBonus + separatorBonus;
				lastMatchIndex = i;
				queryIndex++;
			}
		}
		
		// Must match all query characters
		return queryIndex === query.length ? score : 0;
	}

	async function loadSymbols() {
		// TODO: Manager doesn't have tab management yet
		// Need to implement file tracking in manager
		const pane = $activePane;
		
		if (!pane) {
			error = 'No active pane';
			return;
		}

		loading = true;
		error = null;
		const startTime = performance.now();

		try {
			// Simulate tree-sitter parsing with realistic data
			// In production, this would call a Rust backend with tree-sitter
			await new Promise(resolve => setTimeout(resolve, 20));
			
			// For now, use pane title as filename
			if (pane.title) {
				const ext = pane.title.split('.').pop() || '';
				fileSymbols = generateSymbols(pane.title, ext);
			} else {
				fileSymbols = { path: '', language: '', symbols: [] };
			}
			
			parseTime = performance.now() - startTime;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to parse symbols';
		} finally {
			loading = false;
		}
	}

	function generateSymbols(path: string, ext: string): FileSymbols {
		// Generate realistic symbol structure based on file type
		const language = getLanguage(ext);
		const symbols: Symbol[] = [];

		if (language === 'typescript' || language === 'javascript') {
			symbols.push(
				{
					name: 'imports',
					kind: 'namespace',
					line: 1,
					column: 1,
					endLine: 10,
					endColumn: 1,
					level: 0,
					icon: symbolIcons.namespace,
					children: [
						{ name: 'React', kind: 'import', line: 1, column: 8, endLine: 1, endColumn: 13, level: 1, icon: symbolIcons.import },
						{ name: 'useState', kind: 'import', line: 2, column: 10, endLine: 2, endColumn: 18, level: 1, icon: symbolIcons.import }
					]
				},
				{
					name: 'App',
					kind: 'function',
					line: 12,
					column: 1,
					endLine: 150,
					endColumn: 1,
					level: 0,
					icon: symbolIcons.function,
					description: 'Main application component',
					children: [
						{ name: 'handleClick', kind: 'function', line: 15, column: 8, endLine: 20, endColumn: 9, level: 1, icon: symbolIcons.function },
						{ name: 'state', kind: 'variable', line: 13, column: 8, endLine: 13, endColumn: 13, level: 1, icon: symbolIcons.variable }
					]
				},
				{
					name: 'UserProfile',
					kind: 'class',
					line: 160,
					column: 1,
					endLine: 250,
					endColumn: 1,
					level: 0,
					icon: symbolIcons.class,
					children: [
						{ name: 'constructor', kind: 'constructor', line: 162, column: 4, endLine: 165, endColumn: 5, level: 1, icon: '🏗️' },
						{ name: 'name', kind: 'property', line: 167, column: 4, endLine: 167, endColumn: 8, level: 1, icon: symbolIcons.property },
						{ name: 'email', kind: 'property', line: 168, column: 4, endLine: 168, endColumn: 9, level: 1, icon: symbolIcons.property },
						{ name: 'updateProfile', kind: 'method', line: 170, column: 4, endLine: 180, endColumn: 5, level: 1, icon: symbolIcons.method }
					]
				}
			);
		} else if (language === 'rust') {
			symbols.push(
				{
					name: 'Config',
					kind: 'struct',
					line: 10,
					column: 1,
					endLine: 25,
					endColumn: 1,
					level: 0,
					icon: symbolIcons.struct,
					children: [
						{ name: 'host', kind: 'field', line: 11, column: 4, endLine: 11, endColumn: 8, level: 1, icon: symbolIcons.field },
						{ name: 'port', kind: 'field', line: 12, column: 4, endLine: 12, endColumn: 8, level: 1, icon: symbolIcons.field }
					]
				},
				{
					name: 'impl Config',
					kind: 'namespace',
					line: 27,
					column: 1,
					endLine: 50,
					endColumn: 1,
					level: 0,
					icon: symbolIcons.namespace,
					children: [
						{ name: 'new', kind: 'function', line: 28, column: 4, endLine: 35, endColumn: 5, level: 1, icon: symbolIcons.function },
						{ name: 'validate', kind: 'function', line: 37, column: 4, endLine: 45, endColumn: 5, level: 1, icon: symbolIcons.function }
					]
				}
			);
		}

		return { path, language, symbols };
	}

	function getLanguage(ext: string): string {
		const langMap: Record<string, string> = {
			ts: 'typescript',
			tsx: 'typescript',
			js: 'javascript',
			jsx: 'javascript',
			rs: 'rust',
			py: 'python',
			go: 'go',
			java: 'java',
			c: 'c',
			cpp: 'cpp',
			cs: 'csharp',
			rb: 'ruby',
			php: 'php',
			swift: 'swift',
			kt: 'kotlin',
			scala: 'scala',
			r: 'r',
			lua: 'lua',
			dart: 'dart',
			svelte: 'svelte',
			vue: 'vue'
		};
		return langMap[ext] || 'text';
	}

	function handleKeyDown(event: KeyboardEvent) {
		switch (event.key) {
			case 'ArrowDown':
				event.preventDefault();
				selectedIndex = Math.min(selectedIndex + 1, filteredSymbols.length - 1);
				scrollToSelected();
				break;
			case 'ArrowUp':
				event.preventDefault();
				selectedIndex = Math.max(selectedIndex - 1, 0);
				scrollToSelected();
				break;
			case 'Enter':
				event.preventDefault();
				if (filteredSymbols[selectedIndex]) {
					goToSymbol(filteredSymbols[selectedIndex]);
				}
				break;
			case 'Escape':
				event.preventDefault();
				onClose();
				break;
		}
	}

	function scrollToSelected() {
		const container = document.querySelector('.symbol-list');
		const selected = container?.children[selectedIndex] as HTMLElement;
		if (selected && container) {
			const containerRect = container.getBoundingClientRect();
			const selectedRect = selected.getBoundingClientRect();
			
			if (selectedRect.bottom > containerRect.bottom) {
				selected.scrollIntoView({ block: 'end', behavior: 'smooth' });
			} else if (selectedRect.top < containerRect.top) {
				selected.scrollIntoView({ block: 'start', behavior: 'smooth' });
			}
		}
	}

	function goToSymbol(symbol: Symbol) {
		// TODO: Manager doesn't have Neovim integration yet
		// Need to implement editor commands in manager
		console.log('Would go to symbol:', symbol.name, 'at', symbol.line, symbol.column);
		onClose();
	}

	onMount(() => {
		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	});
</script>

{#if isOpen}
	<div
		class="fixed inset-0 z-50 flex items-start justify-center pt-20"
		transition:fade={{ duration: 150 }}
	>
		<!-- Backdrop -->
		<div
			class="absolute inset-0 bg-black/50 backdrop-blur-sm"
			on:click={onClose}
			role="button"
			tabindex="-1"
			aria-label="Close symbol outline"
		/>

		<!-- Modal -->
		<div
			class="relative w-[600px] max-h-[600px] bg-gray-800 rounded-lg shadow-2xl border border-gray-700 flex flex-col"
			transition:fly={{ y: -20, duration: 200, easing: cubicOut }}
		>
			<!-- Header -->
			<div class="flex items-center justify-between p-4 border-b border-gray-700">
				<div class="flex items-center gap-3">
					<span class="text-xl"> </span>
					<h2 class="text-lg font-semibold">Go to Symbol</h2>
					{#if parseTime > 0}
						<span class="text-xs text-gray-500">{parseTime.toFixed(1)}ms</span>
					{/if}
				</div>
				<button
					on:click={onClose}
					class="text-gray-400 hover:text-white transition-colors"
					aria-label="Close"
				>
					✕
				</button>
			</div>

			<!-- Search -->
			<div class="p-4 border-b border-gray-700">
				<input
					bind:this={searchInput}
					bind:value={searchQuery}
					type="text"
					placeholder="Search symbols..."
					class="w-full px-3 py-2 bg-gray-900 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
				/>
			</div>

			<!-- Symbol List -->
			<div class="flex-1 overflow-y-auto symbol-list">
				{#if loading}
					<div class="flex items-center justify-center p-8">
						<div class="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent" />
					</div>
				{:else if error}
					<div class="p-4 text-center text-red-400">
						{error}
					</div>
				{:else if filteredSymbols.length === 0}
					<div class="p-4 text-center text-gray-500">
						{searchQuery ? 'No symbols match your search' : 'No symbols found'}
					</div>
				{:else}
					{#each filteredSymbols as symbol, index}
						<button
							on:click={() => goToSymbol(symbol)}
							class="w-full text-left px-4 py-2 hover:bg-gray-700 transition-colors flex items-center gap-2
								{index === selectedIndex ? 'bg-gray-700' : ''}"
							style="padding-left: {16 + symbol.level * 16}px"
						>
							<span class="{symbolColors[symbol.kind] || symbolColors.default} text-lg">
								{symbolIcons[symbol.kind] || symbolIcons.default}
							</span>
							<span class="flex-1 truncate">{symbol.name}</span>
							<span class="text-xs text-gray-500">{symbol.kind}</span>
							<span class="text-xs text-gray-600">:{symbol.line}:{symbol.column}</span>
						</button>
					{/each}
				{/if}
			</div>

			{#if fileSymbols}
				<!-- Footer -->
				<div class="p-3 border-t border-gray-700 text-xs text-gray-500 flex justify-between">
					<span>{fileSymbols.path.split('/').pop()} · {fileSymbols.language}</span>
					<span>{filteredSymbols.length} symbols</span>
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	.symbol-list {
		max-height: 400px;
	}
	
	.symbol-list::-webkit-scrollbar {
		width: 8px;
	}
	
	.symbol-list::-webkit-scrollbar-track {
		background: transparent;
	}
	
	.symbol-list::-webkit-scrollbar-thumb {
		background: #4b5563;
		border-radius: 4px;
	}
	
	.symbol-list::-webkit-scrollbar-thumb:hover {
		background: #6b7280;
	}
</style>