<script lang="ts">
	import { onMount } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { settings } from '$lib/stores/settings';
	import { browser } from '$app/environment';

	export let isOpen = false;
	export let onClose: () => void;

	interface SettingsState {
		appearance: {
			theme: 'dark' | 'light' | 'auto';
			fontSize: number;
			fontFamily: string;
			accentColor: string;
			compactMode: boolean;
			animations: boolean;
		};
		editor: {
			tabSize: number;
			insertSpaces: boolean;
			wordWrap: boolean;
			lineNumbers: boolean;
			minimap: boolean;
			bracketMatching: boolean;
			autoSave: boolean;
			autoSaveDelay: number;
		};
		terminal: {
			shell: string;
			fontSize: number;
			fontFamily: string;
			scrollback: number;
			closeOnExit: boolean;
			bellStyle: 'none' | 'visual' | 'sound';
		};
		git: {
			autoFetch: boolean;
			fetchInterval: number;
			showUntracked: boolean;
			defaultBranch: string;
			signCommits: boolean;
		};
		performance: {
			maxTabs: number;
			enableVirtualization: boolean;
			metricsPolling: boolean;
			logLevel: 'error' | 'warn' | 'info' | 'debug';
		};
		shortcuts: {
			[key: string]: string;
		};
	}

	let activeTab = 'appearance';
	let localSettings: SettingsState;
	let hasChanges = false;
	let searchQuery = '';
	let isLoading = false;

	const tabs = [
		{ id: 'appearance', label: 'Appearance', icon: '🎨' },
		{ id: 'editor', label: 'Editor', icon: '📝' },
		{ id: 'terminal', label: 'Terminal', icon: '💻' },
		{ id: 'git', label: 'Git', icon: '🔧' },
		{ id: 'performance', label: 'Performance', icon: '⚡' },
		{ id: 'shortcuts', label: 'Shortcuts', icon: '⌨️' }
	];

	const themes = [
		{ id: 'dark', label: 'Dark', preview: '#1e1e1e' },
		{ id: 'light', label: 'Light', preview: '#ffffff' },
		{ id: 'auto', label: 'Auto', preview: 'linear-gradient(45deg, #1e1e1e 50%, #ffffff 50%)' }
	];

	const accentColors = [
		{ id: '#007acc', label: 'Blue' },
		{ id: '#16a085', label: 'Teal' },
		{ id: '#e74c3c', label: 'Red' },
		{ id: '#f39c12', label: 'Orange' },
		{ id: '#9b59b6', label: 'Purple' },
		{ id: '#2ecc71', label: 'Green' }
	];

	const fontFamilies = [
		'JetBrains Mono',
		'Fira Code',
		'Source Code Pro',
		'Monaco',
		'Consolas',
		'Ubuntu Mono',
		'Cascadia Code'
	];


	$: if (isOpen && $settings) {
		loadSettings();
	}

	$: filteredTabs = searchQuery 
		? tabs.filter(tab => 
			tab.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
			tab.id.toLowerCase().includes(searchQuery.toLowerCase())
		)
		: tabs;

	function loadSettings() {
		localSettings = {
			appearance: {
				theme: $settings.theme || 'dark',
				fontSize: $settings.fontSize || 14,
				fontFamily: $settings.fontFamily || 'JetBrains Mono',
				accentColor: $settings.accentColor || '#007acc',
				compactMode: $settings.compactMode || false,
				animations: $settings.animations ?? true
			},
			editor: {
				tabSize: $settings.tabSize || 2,
				insertSpaces: $settings.insertSpaces ?? true,
				wordWrap: $settings.wordWrap || false,
				lineNumbers: $settings.lineNumbers ?? true,
				minimap: $settings.minimap ?? true,
				bracketMatching: $settings.bracketMatching ?? true,
				autoSave: $settings.autoSave ?? true,
				autoSaveDelay: $settings.autoSaveDelay || 1000
			},
			terminal: {
				shell: $settings.shell || '/bin/zsh',
				fontSize: $settings.terminalFontSize || 14,
				fontFamily: $settings.terminalFontFamily || 'JetBrains Mono',
				scrollback: $settings.scrollback || 1000,
				closeOnExit: $settings.closeOnExit ?? true,
				bellStyle: $settings.bellStyle || 'none'
			},
			git: {
				autoFetch: $settings.gitAutoFetch ?? true,
				fetchInterval: $settings.gitFetchInterval || 300,
				showUntracked: $settings.gitShowUntracked ?? true,
				defaultBranch: $settings.gitDefaultBranch || 'main',
				signCommits: $settings.gitSignCommits ?? false
			},
			performance: {
				maxTabs: $settings.maxTabs || 20,
				enableVirtualization: $settings.enableVirtualization ?? true,
				metricsPolling: $settings.metricsPolling ?? true,
				logLevel: $settings.logLevel || 'info'
			},
			shortcuts: $settings.shortcuts || {
				'command_palette': 'Ctrl+K',
				'quick_open': 'Ctrl+P',
				'toggle_sidebar': 'Ctrl+B',
				'new_terminal': 'Ctrl+`',
				'save_file': 'Ctrl+S',
				'close_tab': 'Ctrl+W',
				'symbol_outline': 'Ctrl+Shift+O',
				'git_panel': 'Ctrl+Shift+G'
			}
		};
		hasChanges = false;
	}

	function updateSetting(section: keyof SettingsState, key: string, value: any) {
		localSettings = {
			...localSettings,
			[section]: {
				...localSettings[section],
				[key]: value
			}
		};
		hasChanges = true;
	}

	function updateShortcut(action: string, shortcut: string) {
		localSettings = {
			...localSettings,
			shortcuts: {
				...localSettings.shortcuts,
				[action]: shortcut
			}
		};
		hasChanges = true;
	}

	async function saveSettings() {
		if (!hasChanges) return;
		
		isLoading = true;
		
		try {
			// Flatten settings for the store
			const flatSettings = {
				// Appearance
				theme: localSettings.appearance.theme,
				fontSize: localSettings.appearance.fontSize,
				fontFamily: localSettings.appearance.fontFamily,
				accentColor: localSettings.appearance.accentColor,
				compactMode: localSettings.appearance.compactMode,
				animations: localSettings.appearance.animations,
				
				// Editor
				tabSize: localSettings.editor.tabSize,
				insertSpaces: localSettings.editor.insertSpaces,
				wordWrap: localSettings.editor.wordWrap,
				lineNumbers: localSettings.editor.lineNumbers,
				minimap: localSettings.editor.minimap,
				bracketMatching: localSettings.editor.bracketMatching,
				autoSave: localSettings.editor.autoSave,
				autoSaveDelay: localSettings.editor.autoSaveDelay,
				
				// Terminal
				shell: localSettings.terminal.shell,
				terminalFontSize: localSettings.terminal.fontSize,
				terminalFontFamily: localSettings.terminal.fontFamily,
				scrollback: localSettings.terminal.scrollback,
				closeOnExit: localSettings.terminal.closeOnExit,
				bellStyle: localSettings.terminal.bellStyle,
				
				// AI
				aiProvider: localSettings.ai.provider,
				aiApiKey: localSettings.ai.apiKey,
				aiModel: localSettings.ai.model,
				aiTemperature: localSettings.ai.temperature,
				aiMaxTokens: localSettings.ai.maxTokens,
				enableInlineCompletion: localSettings.ai.enableInlineCompletion,
				enableCodeSuggestions: localSettings.ai.enableCodeSuggestions,
				
				// Git
				gitAutoFetch: localSettings.git.autoFetch,
				gitFetchInterval: localSettings.git.fetchInterval,
				gitShowUntracked: localSettings.git.showUntracked,
				gitDefaultBranch: localSettings.git.defaultBranch,
				gitSignCommits: localSettings.git.signCommits,
				
				// Performance
				maxTabs: localSettings.performance.maxTabs,
				enableVirtualization: localSettings.performance.enableVirtualization,
				metricsPolling: localSettings.performance.metricsPolling,
				logLevel: localSettings.performance.logLevel,
				
				// Shortcuts
				shortcuts: localSettings.shortcuts
			};

			// Save to Tauri backend if available
			if (browser && '__TAURI__' in window) {
				const { invoke } = await import('@tauri-apps/api/core');
				await invoke('db_set_setting', {
					key: 'orchflow_settings',
					value: JSON.stringify(flatSettings)
				});
			}

			// Update the store
			settings.set(flatSettings);
			hasChanges = false;
			
			// Apply theme immediately
			document.documentElement.setAttribute('data-theme', localSettings.appearance.theme);
			
		} catch (error) {
			console.error('Failed to save settings:', error);
		} finally {
			isLoading = false;
		}
	}

	function resetSettings() {
		loadSettings();
	}

	function exportSettings() {
		const dataStr = JSON.stringify(localSettings, null, 2);
		const dataBlob = new Blob([dataStr], { type: 'application/json' });
		const url = URL.createObjectURL(dataBlob);
		const link = document.createElement('a');
		link.href = url;
		link.download = 'orchflow-settings.json';
		link.click();
		URL.revokeObjectURL(url);
	}

	async function importSettings(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		try {
			const text = await file.text();
			const imported = JSON.parse(text);
			localSettings = imported;
			hasChanges = true;
		} catch (error) {
			console.error('Failed to import settings:', error);
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			onClose();
		} else if (event.key === 's' && (event.ctrlKey || event.metaKey)) {
			event.preventDefault();
			saveSettings();
		}
	}
</script>

<svelte:window on:keydown={handleKeydown} />

{#if isOpen}
	<div
		class="settings-overlay"
		transition:fade={{ duration: 200 }}
		on:click={onClose}
		on:keydown={handleKeydown}
		role="dialog"
		aria-modal="true"
		aria-labelledby="settings-title"
	>
		<div
			class="settings-modal"
			transition:fly={{ y: 20, duration: 300, easing: cubicOut }}
			on:click|stopPropagation
			role="document"
		>
			<!-- Header -->
			<div class="settings-header">
				<h1 id="settings-title">⚙️ Settings</h1>
				<div class="header-actions">
					<button class="action-btn" on:click={exportSettings} title="Export Settings">
						📤
					</button>
					<label class="action-btn" title="Import Settings">
						📥
						<input type="file" accept=".json" on:change={importSettings} hidden />
					</label>
					<button class="close-btn" on:click={onClose} aria-label="Close settings">
						✕
					</button>
				</div>
			</div>

			<div class="settings-body">
				<!-- Sidebar -->
				<div class="settings-sidebar">
					<div class="search-box">
						<input
							type="text"
							placeholder="Search settings..."
							bind:value={searchQuery}
							class="search-input"
						/>
					</div>
					
					<nav class="settings-nav">
						{#each filteredTabs as tab}
							<button
								class="nav-item"
								class:active={activeTab === tab.id}
								on:click={() => activeTab = tab.id}
							>
								<span class="nav-icon">{tab.icon}</span>
								<span class="nav-label">{tab.label}</span>
							</button>
						{/each}
					</nav>
				</div>

				<!-- Content -->
				<div class="settings-content">
					{#if localSettings}
						{#if activeTab === 'appearance'}
							<div class="settings-section">
								<h2>Appearance</h2>
								
								<div class="setting-group">
									<label for="theme-select">Theme</label>
									<div class="theme-selector" id="theme-select">
										{#each themes as theme}
											<button
												class="theme-option"
												class:selected={localSettings.appearance.theme === theme.id}
												on:click={() => updateSetting('appearance', 'theme', theme.id)}
											>
												<div class="theme-preview" style="background: {theme.preview}"></div>
												<span>{theme.label}</span>
											</button>
										{/each}
									</div>
								</div>

								<div class="setting-group">
									<label for="accent-color-select">Accent Color</label>
									<div class="color-selector" id="accent-color-select">
										{#each accentColors as color}
											<button
												class="color-option"
												class:selected={localSettings.appearance.accentColor === color.id}
												style="background: {color.id}"
												on:click={() => updateSetting('appearance', 'accentColor', color.id)}
												title={color.label}
											></button>
										{/each}
									</div>
								</div>

								<div class="setting-group">
									<label for="font-size">Font Size</label>
									<input
										id="font-size"
										type="range"
										min="10"
										max="24"
										bind:value={localSettings.appearance.fontSize}
										on:input={(e) => updateSetting('appearance', 'fontSize', +(e.target as HTMLInputElement).value)}
									/>
									<span class="range-value">{localSettings.appearance.fontSize}px</span>
								</div>

								<div class="setting-group">
									<label for="font-family">Font Family</label>
									<select
										id="font-family"
										bind:value={localSettings.appearance.fontFamily}
										on:change={(e) => updateSetting('appearance', 'fontFamily', (e.target as HTMLSelectElement).value)}
									>
										{#each fontFamilies as font}
											<option value={font}>{font}</option>
										{/each}
									</select>
								</div>

								<div class="setting-group">
									<label class="checkbox-label">
										<input
											type="checkbox"
											bind:checked={localSettings.appearance.compactMode}
											on:change={(e) => updateSetting('appearance', 'compactMode', e.target.checked)}
										/>
										Compact Mode
									</label>
								</div>

								<div class="setting-group">
									<label class="checkbox-label">
										<input
											type="checkbox"
											bind:checked={localSettings.appearance.animations}
											on:change={(e) => updateSetting('appearance', 'animations', e.target.checked)}
										/>
										Enable Animations
									</label>
								</div>
							</div>
						{:else if activeTab === 'editor'}
							<div class="settings-section">
								<h2>Editor</h2>
								
								<div class="setting-group">
									<label for="tab-size">Tab Size</label>
									<input
										id="tab-size"
										type="number"
										min="1"
										max="8"
										bind:value={localSettings.editor.tabSize}
										on:input={(e) => updateSetting('editor', 'tabSize', +(e.target as HTMLInputElement).value)}
									/>
								</div>

								<div class="setting-group">
									<label class="checkbox-label">
										<input
											type="checkbox"
											bind:checked={localSettings.editor.insertSpaces}
											on:change={(e) => updateSetting('editor', 'insertSpaces', e.target.checked)}
										/>
										Insert Spaces (instead of tabs)
									</label>
								</div>

								<div class="setting-group">
									<label class="checkbox-label">
										<input
											type="checkbox"
											bind:checked={localSettings.editor.wordWrap}
											on:change={(e) => updateSetting('editor', 'wordWrap', e.target.checked)}
										/>
										Word Wrap
									</label>
								</div>

								<div class="setting-group">
									<label class="checkbox-label">
										<input
											type="checkbox"
											bind:checked={localSettings.editor.lineNumbers}
											on:change={(e) => updateSetting('editor', 'lineNumbers', e.target.checked)}
										/>
										Show Line Numbers
									</label>
								</div>

								<div class="setting-group">
									<label class="checkbox-label">
										<input
											type="checkbox"
											bind:checked={localSettings.editor.minimap}
											on:change={(e) => updateSetting('editor', 'minimap', e.target.checked)}
										/>
										Show Minimap
									</label>
								</div>

								<div class="setting-group">
									<label class="checkbox-label">
										<input
											type="checkbox"
											bind:checked={localSettings.editor.autoSave}
											on:change={(e) => updateSetting('editor', 'autoSave', e.target.checked)}
										/>
										Auto Save
									</label>
								</div>

								{#if localSettings.editor.autoSave}
									<div class="setting-group">
										<label for="auto-save-delay">Auto Save Delay (ms)</label>
										<input
											id="auto-save-delay"
											type="number"
											min="100"
											max="5000"
											step="100"
											bind:value={localSettings.editor.autoSaveDelay}
											on:input={(e) => updateSetting('editor', 'autoSaveDelay', +(e.target as HTMLInputElement).value)}
										/>
									</div>
								{/if}
							</div>
						{:else if activeTab === 'terminal'}
							<div class="settings-section">
								<h2>Terminal</h2>
								
								<div class="setting-group">
									<label for="shell">Default Shell</label>
									<input
										id="shell"
										type="text"
										bind:value={localSettings.terminal.shell}
										on:input={(e) => updateSetting('terminal', 'shell', (e.target as HTMLInputElement).value)}
									/>
								</div>

								<div class="setting-group">
									<label for="terminal-font-size">Font Size</label>
									<input
										id="terminal-font-size"
										type="range"
										min="8"
										max="24"
										bind:value={localSettings.terminal.fontSize}
										on:input={(e) => updateSetting('terminal', 'fontSize', +(e.target as HTMLInputElement).value)}
									/>
									<span class="range-value">{localSettings.terminal.fontSize}px</span>
								</div>

								<div class="setting-group">
									<label for="terminal-font-family">Font Family</label>
									<select
										id="terminal-font-family"
										bind:value={localSettings.terminal.fontFamily}
										on:change={(e) => updateSetting('terminal', 'fontFamily', (e.target as HTMLSelectElement).value)}
									>
										{#each fontFamilies as font}
											<option value={font}>{font}</option>
										{/each}
									</select>
								</div>

								<div class="setting-group">
									<label for="scrollback">Scrollback Lines</label>
									<input
										id="scrollback"
										type="number"
										min="100"
										max="10000"
										step="100"
										bind:value={localSettings.terminal.scrollback}
										on:input={(e) => updateSetting('terminal', 'scrollback', +(e.target as HTMLInputElement).value)}
									/>
								</div>

								<div class="setting-group">
									<label for="bell-style">Bell Style</label>
									<select
										id="bell-style"
										bind:value={localSettings.terminal.bellStyle}
										on:change={(e) => updateSetting('terminal', 'bellStyle', (e.target as HTMLSelectElement).value)}
									>
										<option value="none">None</option>
										<option value="visual">Visual</option>
										<option value="sound">Sound</option>
									</select>
								</div>

								<div class="setting-group">
									<label class="checkbox-label">
										<input
											type="checkbox"
											bind:checked={localSettings.terminal.closeOnExit}
											on:change={(e) => updateSetting('terminal', 'closeOnExit', e.target.checked)}
										/>
										Close terminal when shell exits
									</label>
								</div>
							</div>
						{:else if activeTab === 'git'}
							<div class="settings-section">
								<h2>Git</h2>
								
								<div class="setting-group">
									<label class="checkbox-label">
										<input
											type="checkbox"
											bind:checked={localSettings.git.autoFetch}
											on:change={(e) => updateSetting('git', 'autoFetch', e.target.checked)}
										/>
										Auto Fetch
									</label>
								</div>

								{#if localSettings.git.autoFetch}
									<div class="setting-group">
										<label for="fetch-interval">Fetch Interval (seconds)</label>
										<input
											id="fetch-interval"
											type="number"
											min="60"
											max="3600"
											step="60"
											bind:value={localSettings.git.fetchInterval}
											on:input={(e) => updateSetting('git', 'fetchInterval', +(e.target as HTMLInputElement).value)}
										/>
									</div>
								{/if}

								<div class="setting-group">
									<label for="default-branch">Default Branch</label>
									<input
										id="default-branch"
										type="text"
										bind:value={localSettings.git.defaultBranch}
										on:input={(e) => updateSetting('git', 'defaultBranch', (e.target as HTMLInputElement).value)}
									/>
								</div>

								<div class="setting-group">
									<label class="checkbox-label">
										<input
											type="checkbox"
											bind:checked={localSettings.git.showUntracked}
											on:change={(e) => updateSetting('git', 'showUntracked', e.target.checked)}
										/>
										Show Untracked Files
									</label>
								</div>

								<div class="setting-group">
									<label class="checkbox-label">
										<input
											type="checkbox"
											bind:checked={localSettings.git.signCommits}
											on:change={(e) => updateSetting('git', 'signCommits', e.target.checked)}
										/>
										Sign Commits
									</label>
								</div>
							</div>
						{:else if activeTab === 'performance'}
							<div class="settings-section">
								<h2>Performance</h2>
								
								<div class="setting-group">
									<label for="max-tabs">Maximum Open Tabs</label>
									<input
										id="max-tabs"
										type="number"
										min="5"
										max="50"
										bind:value={localSettings.performance.maxTabs}
										on:input={(e) => updateSetting('performance', 'maxTabs', +(e.target as HTMLInputElement).value)}
									/>
								</div>

								<div class="setting-group">
									<label class="checkbox-label">
										<input
											type="checkbox"
											bind:checked={localSettings.performance.enableVirtualization}
											on:change={(e) => updateSetting('performance', 'enableVirtualization', e.target.checked)}
										/>
										Enable UI Virtualization
									</label>
								</div>

								<div class="setting-group">
									<label class="checkbox-label">
										<input
											type="checkbox"
											bind:checked={localSettings.performance.metricsPolling}
											on:change={(e) => updateSetting('performance', 'metricsPolling', e.target.checked)}
										/>
										Enable Metrics Polling
									</label>
								</div>

								<div class="setting-group">
									<label for="log-level">Log Level</label>
									<select
										id="log-level"
										bind:value={localSettings.performance.logLevel}
										on:change={(e) => updateSetting('performance', 'logLevel', (e.target as HTMLSelectElement).value)}
									>
										<option value="error">Error</option>
										<option value="warn">Warning</option>
										<option value="info">Info</option>
										<option value="debug">Debug</option>
									</select>
								</div>
							</div>
						{:else if activeTab === 'shortcuts'}
							<div class="settings-section">
								<h2>Keyboard Shortcuts</h2>
								
								{#each Object.entries(localSettings.shortcuts) as [action, shortcut]}
									<div class="setting-group shortcut-group">
										<label for="shortcut-{action}">
											{action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
										</label>
										<input
											id="shortcut-{action}"
											type="text"
											value={shortcut}
											on:input={(e) => updateShortcut(action, (e.target as HTMLInputElement).value)}
											placeholder="Enter shortcut..."
										/>
									</div>
								{/each}
							</div>
						{/if}
					{/if}
				</div>
			</div>

			<!-- Footer -->
			<div class="settings-footer">
				<div class="footer-info">
					{#if hasChanges}
						<span class="changes-indicator">● Unsaved changes</span>
					{/if}
				</div>
				<div class="footer-actions">
					<button class="btn secondary" on:click={resetSettings} disabled={!hasChanges}>
						Reset
					</button>
					<button 
						class="btn primary" 
						on:click={saveSettings} 
						disabled={!hasChanges || isLoading}
					>
						{#if isLoading}
							Saving...
						{:else}
							Save Changes
						{/if}
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	.settings-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.6);
		backdrop-filter: blur(4px);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
	}

	.settings-modal {
		background: var(--bg-primary);
		border: 1px solid var(--border);
		border-radius: 12px;
		width: 90vw;
		max-width: 900px;
		height: 80vh;
		max-height: 700px;
		display: flex;
		flex-direction: column;
		box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
	}

	.settings-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 20px 24px;
		border-bottom: 1px solid var(--border);
	}

	.settings-header h1 {
		margin: 0;
		font-size: 18px;
		color: var(--fg-primary);
	}

	.header-actions {
		display: flex;
		gap: 8px;
	}

	.action-btn, .close-btn {
		background: none;
		border: none;
		color: var(--fg-secondary);
		padding: 8px;
		border-radius: 6px;
		cursor: pointer;
		transition: all 0.2s;
	}

	.action-btn:hover, .close-btn:hover {
		background: var(--bg-hover);
		color: var(--fg-primary);
	}

	.settings-body {
		display: flex;
		flex: 1;
		overflow: hidden;
	}

	.settings-sidebar {
		width: 240px;
		background: var(--bg-secondary);
		border-right: 1px solid var(--border);
		display: flex;
		flex-direction: column;
	}

	.search-box {
		padding: 16px;
		border-bottom: 1px solid var(--border);
	}

	.search-input {
		width: 100%;
		padding: 8px 12px;
		background: var(--bg-primary);
		border: 1px solid var(--border);
		border-radius: 6px;
		color: var(--fg-primary);
		font-size: 14px;
	}

	.search-input:focus {
		outline: none;
		border-color: var(--accent);
	}

	.settings-nav {
		flex: 1;
		padding: 8px 0;
	}

	.nav-item {
		display: flex;
		align-items: center;
		gap: 12px;
		width: 100%;
		padding: 12px 16px;
		background: none;
		border: none;
		color: var(--fg-secondary);
		cursor: pointer;
		transition: all 0.2s;
		text-align: left;
	}

	.nav-item:hover {
		background: var(--bg-hover);
		color: var(--fg-primary);
	}

	.nav-item.active {
		background: var(--accent);
		color: white;
	}

	.nav-icon {
		font-size: 16px;
		width: 20px;
		text-align: center;
	}

	.nav-label {
		font-size: 14px;
	}

	.settings-content {
		flex: 1;
		overflow-y: auto;
		padding: 24px;
	}

	.settings-section h2 {
		margin: 0 0 24px 0;
		font-size: 20px;
		color: var(--fg-primary);
	}

	.setting-group {
		margin-bottom: 20px;
	}

	.setting-group label {
		display: block;
		margin-bottom: 8px;
		font-size: 14px;
		font-weight: 500;
		color: var(--fg-primary);
	}

	.checkbox-label {
		display: flex !important;
		align-items: center;
		gap: 8px;
		margin-bottom: 0 !important;
		cursor: pointer;
	}

	.setting-group input[type="text"],
	.setting-group input[type="password"],
	.setting-group input[type="number"],
	.setting-group select {
		width: 100%;
		padding: 8px 12px;
		background: var(--bg-secondary);
		border: 1px solid var(--border);
		border-radius: 6px;
		color: var(--fg-primary);
		font-size: 14px;
	}

	.setting-group input[type="range"] {
		width: calc(100% - 60px);
		margin-right: 12px;
	}

	.range-value {
		font-size: 12px;
		color: var(--fg-secondary);
		font-family: monospace;
	}

	.theme-selector {
		display: flex;
		gap: 12px;
	}

	.theme-option {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		padding: 12px;
		background: var(--bg-secondary);
		border: 2px solid var(--border);
		border-radius: 8px;
		cursor: pointer;
		transition: all 0.2s;
	}

	.theme-option.selected {
		border-color: var(--accent);
	}

	.theme-preview {
		width: 40px;
		height: 30px;
		border-radius: 4px;
		border: 1px solid var(--border);
	}

	.color-selector {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
	}

	.color-option {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		border: 2px solid var(--border);
		cursor: pointer;
		transition: all 0.2s;
	}

	.color-option.selected {
		border-color: white;
		box-shadow: 0 0 0 2px var(--accent);
	}

	.shortcut-group {
		display: grid;
		grid-template-columns: 1fr 200px;
		gap: 16px;
		align-items: center;
	}

	.settings-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 16px 24px;
		border-top: 1px solid var(--border);
		background: var(--bg-secondary);
	}

	.changes-indicator {
		color: var(--accent);
		font-size: 14px;
	}

	.footer-actions {
		display: flex;
		gap: 12px;
	}

	.btn {
		padding: 8px 16px;
		border-radius: 6px;
		font-size: 14px;
		cursor: pointer;
		transition: all 0.2s;
		border: none;
	}

	.btn.primary {
		background: var(--accent);
		color: white;
	}

	.btn.primary:hover:not(:disabled) {
		opacity: 0.9;
	}

	.btn.secondary {
		background: var(--bg-tertiary);
		color: var(--fg-primary);
		border: 1px solid var(--border);
	}

	.btn.secondary:hover:not(:disabled) {
		background: var(--bg-hover);
	}

	.btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	input[type="file"] {
		display: none;
	}

	/* Responsive */
	@media (max-width: 768px) {
		.settings-modal {
			width: 95vw;
			height: 90vh;
		}

		.settings-sidebar {
			width: 200px;
		}

		.shortcut-group {
			grid-template-columns: 1fr;
		}
	}
</style>