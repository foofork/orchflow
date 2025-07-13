import { defineConfig } from 'cypress'

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:4173',
    supportFile: 'cypress/support/e2e.ts',
    specPattern: 'cypress/e2e/**/*.cy.{js,jsx,ts,tsx}',
    videosFolder: 'cypress/videos',
    screenshotsFolder: 'cypress/screenshots',
    fixturesFolder: 'cypress/fixtures',
    viewportWidth: 1280,
    viewportHeight: 720,
    video: true,
    screenshotOnRunFailure: true,
    chromeWebSecurity: false,
    env: {
      coverage: false
    },
    setupNodeEvents(on, _config) {
      // implement node event listeners here
      on('task', {
        log(message) {
          // Use console.warn instead of console.log for Cypress tasks
          console.warn(`[Cypress Task] ${message}`)
          return null
        },
        table(message) {
          // Use console.warn instead of console.table for Cypress tasks
          console.warn('[Cypress Task Table]', message)
          return null
        }
      })
    },
  },
  component: {
    devServer: {
      framework: 'svelte',
      bundler: 'vite',
    },
    supportFile: 'cypress/support/component.ts',
    specPattern: 'src/**/*.cy.{js,jsx,ts,tsx,svelte}',
    indexHtmlFile: 'cypress/support/component-index.html',
  },
  retries: {
    runMode: 2,
    openMode: 0
  },
  defaultCommandTimeout: 10000,
  requestTimeout: 15000,
  responseTimeout: 15000,
  pageLoadTimeout: 30000,
  watchForFileChanges: true,
})