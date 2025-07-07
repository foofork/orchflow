-- orchflow.orchestrator.tmux
-- Tmux integration for terminal management

local M = {}

-- Cache for tmux executable path
local tmux_path = nil

-- Setup and verify tmux is available
function M.setup()
  -- Find tmux executable
  tmux_path = vim.fn.exepath("tmux")
  if tmux_path == "" then
    error("tmux not found in PATH. Please install tmux to use orchflow.")
  end
  
  -- Verify tmux is working
  local result = M._execute("list-sessions")
  -- It's ok if no sessions exist yet
  if result.exit_code ~= 0 and not result.output:match("no server running") then
    error("tmux not responding. Error: " .. result.output)
  end
  
  return true
end

-- Execute a tmux command
function M._execute(...)
  local args = { ... }
  local cmd = { tmux_path, unpack(args) }
  
  local output = vim.fn.system(cmd)
  local exit_code = vim.v.shell_error
  
  return {
    success = exit_code == 0,
    output = output,
    exit_code = exit_code,
  }
end

-- Create a new tmux session
function M.create_session(name, start_directory)
  local args = { "new-session", "-d", "-s", name }
  
  if start_directory then
    table.insert(args, "-c")
    table.insert(args, start_directory)
  end
  
  local result = M._execute(unpack(args))
  return result.success
end

-- Create a new pane in a session/window
function M.spawn_pane(opts)
  opts = opts or {}
  
  local args = { "split-window" }
  
  -- Target session/window
  if opts.target then
    table.insert(args, "-t")
    table.insert(args, opts.target)
  end
  
  -- Direction
  if opts.vertical then
    table.insert(args, "-v")
  else
    table.insert(args, "-h")
  end
  
  -- Size percentage
  if opts.percent then
    table.insert(args, "-p")
    table.insert(args, tostring(opts.percent))
  end
  
  -- Start directory
  if opts.cwd then
    table.insert(args, "-c")
    table.insert(args, opts.cwd)
  end
  
  -- Don't make new pane active
  if not opts.focus then
    table.insert(args, "-d")
  end
  
  -- Print pane ID
  table.insert(args, "-P")
  table.insert(args, "-F")
  table.insert(args, "#{pane_id}")
  
  -- Command to run
  if opts.command then
    table.insert(args, opts.command)
  end
  
  local result = M._execute(unpack(args))
  
  if result.success then
    local pane_id = vim.trim(result.output)
    return pane_id
  end
  
  return nil
end

-- Get information about all panes
function M.list_panes()
  local result = M._execute("list-panes", "-a", "-F", 
    "#{session_name}:#{window_index}.#{pane_index}|#{pane_id}|#{pane_pid}|#{pane_dead}|#{pane_current_command}")
  
  if not result.success then
    return {}
  end
  
  local panes = {}
  for line in result.output:gmatch("[^\n]+") do
    local target, pane_id, pid, dead, command = line:match("^([^|]+)|([^|]+)|([^|]+)|([^|]+)|(.+)$")
    if target then
      table.insert(panes, {
        target = target,
        pane_id = pane_id,
        pid = tonumber(pid),
        is_dead = dead == "1",
        command = command,
      })
    end
  end
  
  return panes
end

-- Check if a pane exists and is alive
function M.is_pane_alive(pane_id)
  local panes = M.list_panes()
  for _, pane in ipairs(panes) do
    if pane.pane_id == pane_id and not pane.is_dead then
      return true
    end
  end
  return false
end

-- Send text/command to a pane
function M.send_command(pane_id, command)
  -- Use send-keys to send the command
  local result = M._execute("send-keys", "-t", pane_id, command, "Enter")
  return result.success
end

-- Focus a specific pane
function M.focus_pane(pane_id)
  local result = M._execute("select-pane", "-t", pane_id)
  return result.success
end

-- Kill a pane
function M.kill_pane(pane_id)
  local result = M._execute("kill-pane", "-t", pane_id)
  return result.success
end

-- Kill a session
function M.kill_session(session_name)
  local result = M._execute("kill-session", "-t", session_name)
  return result.success
end

-- Get or create orchflow session
function M.get_or_create_session(name)
  name = name or "orchflow"
  
  -- Check if session exists
  local result = M._execute("has-session", "-t", name)
  
  if not result.success then
    -- Create new session
    M.create_session(name, vim.fn.getcwd())
  end
  
  return name
end

-- Attach to session (for testing)
function M.attach_session(name)
  name = name or "orchflow"
  vim.fn.system({ tmux_path, "attach-session", "-t", name })
end

-- Capture pane output
function M.capture_pane(pane_id, lines)
  lines = lines or 100
  local result = M._execute("capture-pane", "-t", pane_id, "-p", "-S", "-" .. tostring(lines))
  
  if result.success then
    return result.output
  end
  
  return ""
end

-- Resize a pane
function M.resize_pane(pane_id, direction, amount)
  local resize_flag = "-U"
  if direction == "down" then
    resize_flag = "-D"
  elseif direction == "left" then
    resize_flag = "-L"
  elseif direction == "right" then
    resize_flag = "-R"
  end
  
  local result = M._execute("resize-pane", "-t", pane_id, resize_flag, tostring(amount))
  return result.success
end

-- List all sessions
function M.list_sessions()
  local result = M._execute("list-sessions", "-F", "#{session_name}|#{session_created}|#{session_windows}")
  
  if not result.success then
    return {}
  end
  
  local sessions = {}
  for line in result.output:gmatch("[^\n]+") do
    local name, created, windows = line:match("^([^|]+)|([^|]+)|(.+)$")
    if name then
      table.insert(sessions, {
        name = name,
        created = tonumber(created),
        window_count = tonumber(windows),
      })
    end
  end
  
  return sessions
end

-- Create named window
function M.new_window(session, window_name, command)
  local args = { "new-window", "-t", session, "-n", window_name }
  
  if command then
    table.insert(args, command)
  end
  
  local result = M._execute(unpack(args))
  return result.success
end

return M