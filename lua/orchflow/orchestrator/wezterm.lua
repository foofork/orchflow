-- orchflow.orchestrator.wezterm
-- WezTerm CLI integration for terminal management

local M = {}

-- Cache for wezterm executable path
local wezterm_path = nil

-- Setup and verify WezTerm is available
function M.setup()
  -- Find wezterm executable
  wezterm_path = vim.fn.exepath("wezterm")
  if wezterm_path == "" then
    error("WezTerm not found in PATH. Please install WezTerm to use orchflow.")
  end
  
  -- Verify CLI is working
  local result = M._execute_cli("list", "--format", "json")
  if not result.success then
    error("WezTerm CLI not responding. Please ensure WezTerm is running.")
  end
  
  return true
end

-- Execute a WezTerm CLI command
function M._execute_cli(...)
  local args = { "cli", ... }
  local cmd = { wezterm_path, unpack(args) }
  
  local output = vim.fn.system(cmd)
  local exit_code = vim.v.shell_error
  
  return {
    success = exit_code == 0,
    output = output,
    exit_code = exit_code,
  }
end

-- Spawn a new terminal
function M.spawn_terminal(opts)
  opts = opts or {}
  
  local args = { "spawn" }
  
  -- Add command if provided
  if opts.command then
    table.insert(args, "--")
    -- Split command string into arguments
    for arg in opts.command:gmatch("%S+") do
      table.insert(args, arg)
    end
  end
  
  -- Add working directory
  if opts.cwd then
    table.insert(args, 1, "--cwd")
    table.insert(args, 2, opts.cwd)
  end
  
  local result = M._execute_cli(unpack(args))
  
  if result.success then
    -- Parse the pane ID from output
    local pane_id = tonumber(result.output:match("(%d+)"))
    
    if pane_id then
      -- Get pane info to get window ID
      local info = M.get_pane_info(pane_id)
      return {
        pane_id = pane_id,
        window_id = info and info.window_id or 0,
      }
    end
  end
  
  return nil
end

-- Get information about a pane
function M.get_pane_info(pane_id)
  local result = M._execute_cli("list", "--format", "json")
  
  if result.success then
    local ok, panes = pcall(vim.json.decode, result.output)
    if ok and panes then
      for _, pane in ipairs(panes) do
        if pane.pane_id == pane_id then
          return pane
        end
      end
    end
  end
  
  return nil
end

-- Check if a pane is still alive
function M.is_pane_alive(pane_id)
  local info = M.get_pane_info(pane_id)
  return info ~= nil
end

-- Focus a specific pane
function M.focus_pane(pane_id)
  local result = M._execute_cli("activate-pane", "--pane-id", tostring(pane_id))
  return result.success
end

-- Send text/command to a pane
function M.send_command(pane_id, command)
  -- Add newline to execute the command
  local text = command .. "\n"
  
  local result = M._execute_cli(
    "send-text",
    "--pane-id", tostring(pane_id),
    "--no-paste",
    text
  )
  
  return result.success
end

-- Kill a pane
function M.kill_pane(pane_id)
  local result = M._execute_cli("kill-pane", "--pane-id", tostring(pane_id))
  return result.success
end

-- List all panes
function M.list_panes()
  local result = M._execute_cli("list", "--format", "json")
  
  if result.success then
    local ok, panes = pcall(vim.json.decode, result.output)
    if ok then
      return panes
    end
  end
  
  return {}
end

-- Create a split pane
function M.split_pane(opts)
  opts = opts or {}
  
  local args = { "split-pane" }
  
  -- Direction (default to bottom)
  table.insert(args, "--" .. (opts.direction or "bottom"))
  
  -- Size percentage
  if opts.percent then
    table.insert(args, "--percent")
    table.insert(args, tostring(opts.percent))
  end
  
  -- Command to run
  if opts.command then
    table.insert(args, "--")
    for arg in opts.command:gmatch("%S+") do
      table.insert(args, arg)
    end
  end
  
  local result = M._execute_cli(unpack(args))
  
  if result.success then
    local pane_id = tonumber(result.output:match("(%d+)"))
    return pane_id
  end
  
  return nil
end

-- Get current active pane
function M.get_active_pane()
  local panes = M.list_panes()
  for _, pane in ipairs(panes) do
    if pane.is_active then
      return pane.pane_id
    end
  end
  return nil
end

-- Resize a pane
function M.resize_pane(pane_id, direction, amount)
  local args = {
    "adjust-pane-size",
    "--pane-id", tostring(pane_id),
    "--" .. direction,
    tostring(amount),
  }
  
  local result = M._execute_cli(unpack(args))
  return result.success
end

return M