-- orchflow - Terminal IDE with Orchestration
-- Entry point for the orchflow Neovim configuration

-- Add orchflow to runtime path
local orchflow_path = vim.fn.fnamemodify(vim.fn.expand("<sfile>"), ":p:h")
vim.opt.rtp:prepend(orchflow_path)

-- Set leader key early
vim.g.mapleader = " "
vim.g.maplocalleader = " "

-- Bootstrap lazy.nvim
local lazypath = vim.fn.stdpath("data") .. "/lazy/lazy.nvim"
if not vim.loop.fs_stat(lazypath) then
  vim.fn.system({
    "git",
    "clone",
    "--filter=blob:none",
    "https://github.com/folke/lazy.nvim.git",
    "--branch=stable",
    lazypath,
  })
end
vim.opt.rtp:prepend(lazypath)

-- Load orchflow modules
require("orchflow.core")

-- Load plugins
require("lazy").setup("orchflow.plugins", {
  defaults = { lazy = true },
  performance = {
    rtp = {
      disabled_plugins = {
        "gzip",
        "tarPlugin",
        "tohtml",
        "tutor",
        "zipPlugin",
      },
    },
  },
})

-- Initialize orchestrator after plugins are loaded
vim.api.nvim_create_autocmd("User", {
  pattern = "LazyVimStarted",
  callback = function()
    require("orchflow.orchestrator").setup()
    require("orchflow.ui").setup()
  end,
})