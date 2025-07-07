-- orchflow.ui
-- UI components and dashboard

local M = {}

-- UI configuration
M.config = {
  dashboard = {
    enabled = true,
    position = "bottom",
    height = 10,
  },
  statusline = {
    show_terminal_count = true,
  },
}

-- Setup UI components
function M.setup(opts)
  M.config = vim.tbl_deep_extend("force", M.config, opts or {})
  
  -- Initialize dashboard
  if M.config.dashboard.enabled then
    require("orchflow.ui.dashboard").setup(M.config.dashboard)
  end
  
  -- Set up UI commands
  M._setup_commands()
end

-- Create commands
function M._setup_commands()
  vim.api.nvim_create_user_command("OrchDashboard", function()
    require("orchflow.ui.dashboard").toggle()
  end, {
    desc = "Toggle orchestrator dashboard",
  })
end

return M