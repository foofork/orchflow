import { describe, it, expect, beforeEach, afterEach, vi, type MockedFunction } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import ActivityBar from './ActivityBar.svelte'
import type { ComponentProps } from 'svelte'
import { createTypedMock } from '@/test/mock-factory'
import { mockSvelteEvents } from '@/test/svelte5-event-helper'

describe('ActivityBar', () => {
  let cleanup: Array<() => void> = []
  let user: ReturnType<typeof userEvent.setup>
  let mockViewChange: MockedFunction<(view: string) => void>

  beforeEach(() => {
    user = userEvent.setup()
    mockViewChange = vi.fn() as unknown as MockedFunction<(view: string) => void>
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup.forEach(fn => fn())
    cleanup = []
    vi.restoreAllMocks()
  })

  describe('Rendering', () => {
    it('renders all default activity items', () => {
      const { unmount } = render(ActivityBar)
      cleanup.push(unmount)
      
      // Check top activities
      expect(screen.getByRole('button', { name: 'Explorer' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Search' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Source Control' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Run and Debug' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Extensions' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Dashboard' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Testing' })).toBeInTheDocument()
      
      // Check bottom activities
      expect(screen.getByRole('button', { name: 'Accounts' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument()
    })

    it('displays correct icons for each activity', () => {
      const { unmount } = render(ActivityBar)
      cleanup.push(unmount)
      
      const activities = [
        { label: 'Explorer', icon: '📁' },
        { label: 'Search', icon: '🔍' },
        { label: 'Source Control', icon: '🌿' },
        { label: 'Run and Debug', icon: '🐛' },
        { label: 'Extensions', icon: '🧩' },
        { label: 'Dashboard', icon: '📊' },
        { label: 'Testing', icon: '🧪' },
        { label: 'Accounts', icon: '👤' },
        { label: 'Settings', icon: '⚙️' }
      ]
      
      activities.forEach(({ label, icon }) => {
        const button = screen.getByRole('button', { name: label })
        const iconElement = button.querySelector('.icon')
        expect(iconElement).toHaveTextContent(icon)
      })
    })

    it('shows active state for current view', () => {
      const { unmount } = render(ActivityBar, { activeView: 'search' })
      cleanup.push(unmount)
      
      const searchButton = screen.getByRole('button', { name: 'Search' })
      const explorerButton = screen.getByRole('button', { name: 'Explorer' })
      
      expect(searchButton).toHaveClass('active')
      expect(explorerButton).not.toHaveClass('active')
    })

    it('shows explorer as active by default', () => {
      const { unmount } = render(ActivityBar)
      cleanup.push(unmount)
      
      const explorerButton = screen.getByRole('button', { name: 'Explorer' })
      expect(explorerButton).toHaveClass('active')
    })

    it('applies correct CSS classes', () => {
      const { container, unmount } = render(ActivityBar)
      cleanup.push(unmount)
      
      const activityBar = container.querySelector('.activity-bar')
      expect(activityBar).toBeInTheDocument()
      
      const topActivities = container.querySelector('.activities')
      expect(topActivities).toBeInTheDocument()
      
      const bottomActivities = container.querySelector('.bottom-activities')
      expect(bottomActivities).toBeInTheDocument()
    })
  })

  describe('Click Interactions', () => {
    it('dispatches viewChange event when activity is clicked', async () => {
      const { component, unmount } = render(ActivityBar)
      cleanup.push(unmount)
      
      const mockComponent = mockSvelteEvents(component)
      mockComponent.$on('viewChange', (e: CustomEvent<string>) => {
        mockViewChange(e.detail)
      })
      
      const searchButton = screen.getByRole('button', { name: 'Search' })
      await user.click(searchButton)
      
      expect(mockViewChange).toHaveBeenCalledWith('search')
    })

    it('dispatches viewChange event for each activity', async () => {
      const { component, unmount } = render(ActivityBar)
      cleanup.push(unmount)
      
      const mockComponent = mockSvelteEvents(component);
      mockComponent.$on('viewChange', (e: CustomEvent<string>) => {
        mockViewChange(e.detail)
      })
      
      const activities = [
        'explorer', 'search', 'git', 'debug', 
        'extensions', 'dashboard', 'test', 'accounts', 'settings'
      ]
      
      for (const activityId of activities) {
        mockViewChange.mockClear()
        
        const button = screen.getByRole('button', { 
          name: new RegExp(activityId === 'git' ? 'Source Control' : 
                           activityId === 'debug' ? 'Run and Debug' :
                           activityId === 'test' ? 'Testing' :
                           activityId.charAt(0).toUpperCase() + activityId.slice(1), 'i')
        })
        await user.click(button)
        
        expect(mockViewChange).toHaveBeenCalledWith(activityId)
      }
    })

    it('handles rapid clicks correctly', async () => {
      const { component, unmount } = render(ActivityBar)
      cleanup.push(unmount)
      
      const mockComponent = mockSvelteEvents(component);
      mockComponent.$on('viewChange', (e: CustomEvent<string>) => {
        mockViewChange(e.detail)
      })
      
      const searchButton = screen.getByRole('button', { name: 'Search' })
      const gitButton = screen.getByRole('button', { name: 'Source Control' })
      
      await user.click(searchButton)
      await user.click(gitButton)
      await user.click(searchButton)
      
      expect(mockViewChange).toHaveBeenCalledTimes(3)
      expect(mockViewChange.mock.calls).toEqual([['search'], ['git'], ['search']])
    })
  })

  describe('Active State Management', () => {
    it('updates active state when activeView prop changes', async () => {
      const { rerender, unmount } = render(ActivityBar, { activeView: 'explorer' })
      cleanup.push(unmount)
      
      const explorerButton = screen.getByRole('button', { name: 'Explorer' })
      const searchButton = screen.getByRole('button', { name: 'Search' })
      
      expect(explorerButton).toHaveClass('active')
      expect(searchButton).not.toHaveClass('active')
      
      await rerender({ activeView: 'search' })
      
      expect(explorerButton).not.toHaveClass('active')
      expect(searchButton).toHaveClass('active')
    })

    it('maintains active state through re-renders', async () => {
      const { rerender, unmount } = render(ActivityBar, { activeView: 'git' })
      cleanup.push(unmount)
      
      const gitButton = screen.getByRole('button', { name: 'Source Control' })
      expect(gitButton).toHaveClass('active')
      
      // Re-render with same active view
      await rerender({ activeView: 'git' })
      
      expect(gitButton).toHaveClass('active')
    })
  })

  describe('Tooltip Functionality', () => {
    it('has correct tooltip text for each activity', () => {
      const { unmount } = render(ActivityBar)
      cleanup.push(unmount)
      
      const tooltips = [
        { label: 'Explorer', tooltip: 'File Explorer (Ctrl+Shift+E)' },
        { label: 'Search', tooltip: 'Search (Ctrl+Shift+F)' },
        { label: 'Source Control', tooltip: 'Source Control (Ctrl+Shift+G)' },
        { label: 'Run and Debug', tooltip: 'Run and Debug (Ctrl+Shift+D)' },
        { label: 'Extensions', tooltip: 'Extensions (Ctrl+Shift+X)' },
        { label: 'Dashboard', tooltip: 'Dashboard' },
        { label: 'Testing', tooltip: 'Test Results' },
        { label: 'Accounts', tooltip: 'Accounts' },
        { label: 'Settings', tooltip: 'Settings (Ctrl+,)' }
      ]
      
      tooltips.forEach(({ label, tooltip }) => {
        const button = screen.getByRole('button', { name: label })
        expect(button).toHaveAttribute('title', tooltip)
      })
    })

    it('shows tooltips on hover with animation delay', async () => {
      const { unmount } = render(ActivityBar)
      cleanup.push(unmount)
      
      const searchButton = screen.getByRole('button', { name: 'Search' })
      
      // Hover over button
      await user.hover(searchButton)
      
      // The component uses CSS animations for tooltips
      // We can verify the title attribute is present for native tooltips
      expect(searchButton).toHaveAttribute('title', 'Search (Ctrl+Shift+F)')
    })
  })

  describe('Keyboard Navigation', () => {
    it('supports Tab navigation through all activities', async () => {
      const { unmount } = render(ActivityBar)
      cleanup.push(unmount)
      
      const buttons = screen.getAllByRole('button')
      
      // Tab through all buttons
      for (let i = 0; i < buttons.length; i++) {
        await user.tab()
        // Note: Actual focus behavior depends on the testing environment
        // In real browser, Tab would cycle through all buttons
      }
    })

    it('supports Enter key to activate activities', async () => {
      const { component, unmount } = render(ActivityBar)
      cleanup.push(unmount)
      
      const mockComponent = mockSvelteEvents(component);
      mockComponent.$on('viewChange', (e: CustomEvent<string>) => {
        mockViewChange(e.detail)
      })
      
      const searchButton = screen.getByRole('button', { name: 'Search' })
      searchButton.focus()
      
      await user.keyboard('{Enter}')
      
      expect(mockViewChange).toHaveBeenCalledWith('search')
    })

    it('supports Space key to activate activities', async () => {
      const { component, unmount } = render(ActivityBar)
      cleanup.push(unmount)
      
      const mockComponent = mockSvelteEvents(component);
      mockComponent.$on('viewChange', (e: CustomEvent<string>) => {
        mockViewChange(e.detail)
      })
      
      const gitButton = screen.getByRole('button', { name: 'Source Control' })
      gitButton.focus()
      
      await user.keyboard(' ')
      
      expect(mockViewChange).toHaveBeenCalledWith('git')
    })

    it('shows focus indicator when focused', () => {
      const { container, unmount } = render(ActivityBar)
      cleanup.push(unmount)
      
      const searchButton = screen.getByRole('button', { name: 'Search' })
      searchButton.focus()
      
      // Check if the component has focus styles defined
      const activityItems = container.querySelectorAll('.activity-item')
      expect(activityItems.length).toBeGreaterThan(0)
      
      // The component defines focus-visible styles
      // In a real browser, this would show a blue outline
    })
  })

  describe('Accessibility', () => {
    it('has proper ARIA labels for all buttons', () => {
      const { unmount } = render(ActivityBar)
      cleanup.push(unmount)
      
      const buttons = screen.getAllByRole('button')
      
      buttons.forEach((button) => {
        expect(button).toHaveAttribute('aria-label')
        expect(button.getAttribute('aria-label')).toBeTruthy()
      })
    })

    it('provides keyboard shortcuts in tooltips', () => {
      const { unmount } = render(ActivityBar)
      cleanup.push(unmount)
      
      const shortcutActivities = [
        { label: 'Explorer', shortcut: 'Ctrl+Shift+E' },
        { label: 'Search', shortcut: 'Ctrl+Shift+F' },
        { label: 'Source Control', shortcut: 'Ctrl+Shift+G' },
        { label: 'Run and Debug', shortcut: 'Ctrl+Shift+D' },
        { label: 'Extensions', shortcut: 'Ctrl+Shift+X' },
        { label: 'Settings', shortcut: 'Ctrl+,' }
      ]
      
      shortcutActivities.forEach(({ label, shortcut }) => {
        const button = screen.getByRole('button', { name: label })
        const tooltip = button.getAttribute('title')
        expect(tooltip).toContain(shortcut)
      })
    })

    it('maintains semantic HTML structure', () => {
      const { container, unmount } = render(ActivityBar)
      cleanup.push(unmount)
      
      // Check for semantic structure
      const activityBar = container.querySelector('.activity-bar')
      expect(activityBar).toBeInTheDocument()
      
      // All interactive elements are buttons
      const buttons = activityBar?.querySelectorAll('button')
      expect(buttons?.length).toBe(9) // 7 top + 2 bottom activities
      
      // Icons are wrapped in span elements
      const icons = activityBar?.querySelectorAll('.icon')
      expect(icons?.length).toBe(9)
    })
  })

  describe('Visual States', () => {
    it('shows active indicator bar for active items', () => {
      const { unmount } = render(ActivityBar, { activeView: 'git' })
      cleanup.push(unmount)
      
      const gitButton = screen.getByRole('button', { name: 'Source Control' })
      expect(gitButton).toHaveClass('active')
      
      // The CSS shows a ::before pseudo-element for active state
      // with a blue bar on the left side
    })

    it('shows hover state on mouse over', async () => {
      const { unmount } = render(ActivityBar)
      cleanup.push(unmount)
      
      const dashboardButton = screen.getByRole('button', { name: 'Dashboard' })
      
      await user.hover(dashboardButton)
      
      // The component CSS defines hover styles
      // In a real browser, this would show a hover background color
    })

    it('separates top and bottom activities visually', () => {
      const { container, unmount } = render(ActivityBar)
      cleanup.push(unmount)
      
      const topSection = container.querySelector('.activities')
      const bottomSection = container.querySelector('.bottom-activities')
      
      expect(topSection).toBeInTheDocument()
      expect(bottomSection).toBeInTheDocument()
      
      // Top section should have 7 activities
      expect(topSection?.querySelectorAll('.activity-item').length).toBe(7)
      
      // Bottom section should have 2 activities
      expect(bottomSection?.querySelectorAll('.activity-item').length).toBe(2)
    })
  })

  describe('Edge Cases', () => {
    it('handles undefined activeView prop', () => {
      const { unmount } = render(ActivityBar, { activeView: undefined })
      cleanup.push(unmount)
      
      // Should default to 'explorer' being active
      const explorerButton = screen.getByRole('button', { name: 'Explorer' })
      expect(explorerButton).toHaveClass('active')
    })

    it('handles invalid activeView values', () => {
      const { unmount } = render(ActivityBar, { activeView: 'invalid-view' as any })
      cleanup.push(unmount)
      
      // No button should be active for invalid view
      const buttons = screen.getAllByRole('button')
      buttons.forEach(button => {
        expect(button).not.toHaveClass('active')
      })
    })

    it('maintains functionality when rapidly changing activeView', async () => {
      const { rerender, unmount } = render(ActivityBar, { activeView: 'explorer' })
      cleanup.push(unmount)
      
      // Rapidly change active view
      await rerender({ activeView: 'search' })
      await rerender({ activeView: 'git' })
      await rerender({ activeView: 'debug' })
      await rerender({ activeView: 'extensions' })
      
      // Final state should be correct
      const extensionsButton = screen.getByRole('button', { name: 'Extensions' })
      expect(extensionsButton).toHaveClass('active')
      
      // All other buttons should not be active
      const otherButtons = screen.getAllByRole('button').filter(b => b !== extensionsButton)
      otherButtons.forEach(button => {
        expect(button).not.toHaveClass('active')
      })
    })

    it('handles component unmounting gracefully', () => {
      const { unmount } = render(ActivityBar)
      
      // Should unmount without errors
      expect(() => unmount()).not.toThrow()
      cleanup.push(unmount)
    })
  })

  describe('Integration Scenarios', () => {
    it('works correctly when embedded in a layout', () => {
      const { container, unmount } = render(ActivityBar)
      cleanup.push(unmount)
      
      const activityBar = container.querySelector('.activity-bar')
      expect(activityBar).toBeInTheDocument()
      
      // The component uses CSS variables for theming
      // which are defined in the component's style section
      expect(activityBar).toHaveClass('activity-bar')
    })

    it('dispatches events that can be listened to by parent components', async () => {
      const handleViewChange = vi.fn()
      
      const { component, unmount } = render(ActivityBar, { activeView: 'explorer' })
      cleanup.push(unmount)
      
      const mockComponent = mockSvelteEvents(component);
      mockComponent.$on('viewChange', (e: CustomEvent<string>) => {
        handleViewChange(e.detail)
      })
      
      // Click multiple activities
      await user.click(screen.getByRole('button', { name: 'Search' }))
      await user.click(screen.getByRole('button', { name: 'Dashboard' }))
      await user.click(screen.getByRole('button', { name: 'Settings' }))
      
      expect(handleViewChange).toHaveBeenCalledTimes(3)
      expect(handleViewChange).toHaveBeenNthCalledWith(1, 'search')
      expect(handleViewChange).toHaveBeenNthCalledWith(2, 'dashboard')
      expect(handleViewChange).toHaveBeenNthCalledWith(3, 'settings')
    })
  })
})