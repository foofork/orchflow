-- orchflow.ui.dashboard
-- Terminal orchestration dashboard

local M = {}

local dashboard_buf = nil
local dashboard_win = nil

-- Dashboard configuration
M.config = {
  position = "bottom",
  height = 10,
  update_interval = 1000, -- milliseconds
}

-- Setup dashboard
function M.setup(opts)
  M.config = vim.tbl_deep_extend("force", M.config, opts or {})
end

-- Toggle dashboard visibility
function M.toggle()
  if dashboard_win and vim.api.nvim_win_is_valid(dashboard_win) then
    M.close()
  else
    M.open()
  end
end

-- Open dashboard
function M.open()
  -- Create buffer if it doesn't exist
  if not dashboard_buf or not vim.api.nvim_buf_is_valid(dashboard_buf) then
    dashboard_buf = vim.api.nvim_create_buf(false, true)
    
    -- Set buffer options
    vim.api.nvim_buf_set_option(dashboard_buf, "buftype", "nofile")
    vim.api.nvim_buf_set_option(dashboard_buf, "bufhidden", "hide")
    vim.api.nvim_buf_set_option(dashboard_buf, "swapfile", false)
    vim.api.nvim_buf_set_option(dashboard_buf, "filetype", "orchflow-dashboard")
    vim.api.nvim_buf_set_name(dashboard_buf, "OrchFlow Dashboard")
    
    -- Set up keymaps for the dashboard
    M._setup_dashboard_keymaps()
  end
  
  -- Create split window
  local win_height = M.config.height
  if M.config.position == "bottom" then
    vim.cmd("botright split")
  elseif M.config.position == "top" then
    vim.cmd("topleft split")
  else
    vim.cmd("split")
  end
  
  dashboard_win = vim.api.nvim_get_current_win()
  vim.api.nvim_win_set_height(dashboard_win, win_height)
  vim.api.nvim_win_set_buf(dashboard_win, dashboard_buf)
  
  -- Make it non-modifiable
  vim.api.nvim_win_set_option(dashboard_win, "number", false)
  vim.api.nvim_win_set_option(dashboard_win, "relativenumber", false)
  vim.api.nvim_win_set_option(dashboard_win, "signcolumn", "no")
  vim.api.nvim_win_set_option(dashboard_win, "wrap", false)
  
  -- Start updating
  M._start_updates()
  
  -- Initial render
  M._render()
end

-- Close dashboard
function M.close()
  if dashboard_win and vim.api.nvim_win_is_valid(dashboard_win) then
    vim.api.nvim_win_close(dashboard_win, true)
    dashboard_win = nil
  end
  
  M._stop_updates()
end

-- Render dashboard content
function M._render()
  if not dashboard_buf or not vim.api.nvim_buf_is_valid(dashboard_buf) then
    return
  end
  
  local terminal_manager = require("orchflow.orchestrator.terminal_manager")
  local terminals = terminal_manager.list()
  local summary = terminal_manager.get_status_summary()
  
  local lines = {}
  local highlights = {}
  
  -- Header
  table.insert(lines, " OrchFlow Terminal Dashboard")
  table.insert(highlights, { line = #lines - 1, col = 0, end_col = -1, hl_group = "Title" })
  
  table.insert(lines, string.rep("─", vim.api.nvim_win_get_width(dashboard_win or 0)))
  
  -- Summary
  table.insert(lines, string.format(" Total: %d | Running: %d | Exited: %d | Errors: %d",
    summary.total, summary.running, summary.exited, summary.error))
  
  table.insert(lines, "")
  
  -- Terminal list
  if #terminals == 0 then
    table.insert(lines, " No terminals running. Press <leader>tn to spawn a new terminal.")
    table.insert(highlights, { line = #lines - 1, col = 0, end_col = -1, hl_group = "Comment" })
  else
    table.insert(lines, " ID  Name              Status     Command")
    table.insert(lines, string.rep("─", vim.api.nvim_win_get_width(dashboard_win or 0)))
    
    for _, term in ipairs(terminals) do
      local status_hl = "Normal"
      if term.status == "running" then
        status_hl = "DiagnosticOk"
      elseif term.status == "exited" or term.status == "killed" then
        status_hl = "DiagnosticWarn"
      elseif term.status == "error" then
        status_hl = "DiagnosticError"
      end
      
      local line = string.format(" %-3d %-16s %-10s %s",
        term.id,
        term.name,
        term.status,
        term.command or "shell"
      )
      table.insert(lines, line)
      
      -- Highlight status
      local status_start = 21
      local status_end = status_start + #term.status
      table.insert(highlights, {
        line = #lines - 1,
        col = status_start,
        end_col = status_end,
        hl_group = status_hl
      })
    end
  end
  
  -- Footer with keybindings
  table.insert(lines, "")
  table.insert(lines, string.rep("─", vim.api.nvim_win_get_width(dashboard_win or 0)))
  table.insert(lines, " [n]ew [k]ill [f]ocus [s]end [r]efresh [q]uit")
  table.insert(highlights, { line = #lines - 1, col = 0, end_col = -1, hl_group = "Comment" })
  
  -- Update buffer
  vim.api.nvim_buf_set_option(dashboard_buf, "modifiable", true)
  vim.api.nvim_buf_set_lines(dashboard_buf, 0, -1, false, lines)
  vim.api.nvim_buf_set_option(dashboard_buf, "modifiable", false)
  
  -- Apply highlights
  for _, hl in ipairs(highlights) do
    vim.api.nvim_buf_add_highlight(
      dashboard_buf,
      -1,
      hl.hl_group,
      hl.line,
      hl.col,
      hl.end_col
    )
  end
end

-- Set up dashboard-specific keymaps
function M._setup_dashboard_keymaps()
  local opts = { buffer = dashboard_buf, silent = true }
  
  vim.keymap.set("n", "q", function() M.close() end, opts)
  vim.keymap.set("n", "<Esc>", function() M.close() end, opts)
  vim.keymap.set("n", "r", function() M._render() end, opts)
  
  vim.keymap.set("n", "n", function()
    M.close()
    vim.cmd("OrchSpawn")
  end, opts)
  
  vim.keymap.set("n", "k", function()
    local line = vim.api.nvim_win_get_cursor(0)[1]
    local content = vim.api.nvim_buf_get_lines(dashboard_buf, line - 1, line, false)[1]
    local term_name = content:match("^%s*%d+%s+(%S+)")
    if term_name then
      M.close()
      vim.cmd("OrchKill " .. term_name)
    end
  end, opts)
  
  vim.keymap.set("n", "f", function()
    local line = vim.api.nvim_win_get_cursor(0)[1]
    local content = vim.api.nvim_buf_get_lines(dashboard_buf, line - 1, line, false)[1]
    local term_name = content:match("^%s*%d+%s+(%S+)")
    if term_name then
      M.close()
      vim.cmd("OrchFocus " .. term_name)
    end
  end, opts)
end

-- Auto-update timer
local update_timer = nil

function M._start_updates()
  if update_timer then
    update_timer:stop()
  end
  
  update_timer = vim.loop.new_timer()
  update_timer:start(M.config.update_interval, M.config.update_interval, vim.schedule_wrap(function()
    if dashboard_win and vim.api.nvim_win_is_valid(dashboard_win) then
      M._render()
    else
      M._stop_updates()
    end
  end))
end

function M._stop_updates()
  if update_timer then
    update_timer:stop()
    update_timer:close()
    update_timer = nil
  end
end

return M