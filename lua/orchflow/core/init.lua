-- orchflow.core
-- Core functionality and settings

local M = {}

-- Core settings
vim.opt.number = true
vim.opt.relativenumber = true
vim.opt.termguicolors = true
vim.opt.signcolumn = "yes"
vim.opt.updatetime = 250
vim.opt.timeoutlen = 300
vim.opt.completeopt = "menuone,noselect"

-- Better splits
vim.opt.splitbelow = true
vim.opt.splitright = true

-- Tab settings
vim.opt.expandtab = true
vim.opt.shiftwidth = 2
vim.opt.tabstop = 2

-- Search settings
vim.opt.ignorecase = true
vim.opt.smartcase = true

-- Initialize core modules
function M.setup()
  -- Core keymaps
  require("orchflow.core.keymaps")
  
  -- Auto commands
  require("orchflow.core.autocmds")
end

M.setup()

return M