-- orchflow.orchestrator.terminal_manager
-- Manages terminal instances and their lifecycle using tmux

local M = {}

-- Terminal registry
local terminals = {}
local terminal_id_counter = 0

-- Session management
local session_name = "orchflow"

-- Terminal status enum
M.STATUS = {
  SPAWNING = "spawning",
  RUNNING = "running",
  EXITED = "exited",
  KILLED = "killed",
  ERROR = "error",
}

-- Initialize terminal manager
function M.setup(config)
  M.config = config or {}
  
  -- Set up periodic health checks
  vim.loop.new_timer():start(5000, 5000, vim.schedule_wrap(function()
    M._check_terminal_health()
  end))
end

-- Create a new terminal
function M.create(opts)
  terminal_id_counter = terminal_id_counter + 1
  
  local terminal = {
    id = terminal_id_counter,
    name = opts.name or ("terminal-" .. terminal_id_counter),
    command = opts.command,
    cwd = opts.cwd,
    env = opts.env,
    status = M.STATUS.SPAWNING,
    created_at = os.time(),
    pane_id = nil,
    window_id = nil,
    focus = opts.focus,
  }
  
  -- Spawn the actual terminal using tmux
  local tmux = require("orchflow.orchestrator.tmux")
  
  -- Ensure session exists
  tmux.get_or_create_session(session_name)
  
  -- Create the pane
  local pane_id = tmux.spawn_pane({
    target = session_name,
    command = opts.command,
    cwd = opts.cwd,
    vertical = opts.split_vertical,
    percent = opts.split_percent,
    focus = opts.focus,
  })
  
  if pane_id then
    terminal.pane_id = pane_id
    terminal.session = session_name
    terminal.status = M.STATUS.RUNNING
    
    -- Store in registry
    terminals[terminal.id] = terminal
    
    return terminal
  else
    terminal.status = M.STATUS.ERROR
    return nil
  end
end

-- Get terminal by name or ID
function M.get(identifier)
  -- Try as ID first
  if type(identifier) == "number" then
    return terminals[identifier]
  end
  
  -- Try as name
  for _, term in pairs(terminals) do
    if term.name == identifier then
      return term
    end
  end
  
  return nil
end

-- List all terminals
function M.list()
  local list = {}
  for _, term in pairs(terminals) do
    table.insert(list, term)
  end
  
  -- Sort by creation time
  table.sort(list, function(a, b)
    return a.created_at < b.created_at
  end)
  
  return list
end

-- Send command to terminal
function M.send_command(terminal_id, command)
  local terminal = terminals[terminal_id]
  if not terminal then
    return false
  end
  
  local tmux = require("orchflow.orchestrator.tmux")
  return tmux.send_command(terminal.pane_id, command)
end

-- Kill a terminal
function M.kill(terminal_id)
  local terminal = terminals[terminal_id]
  if not terminal then
    return false
  end
  
  local tmux = require("orchflow.orchestrator.tmux")
  local success = tmux.kill_pane(terminal.pane_id)
  
  if success then
    terminal.status = M.STATUS.KILLED
    terminals[terminal_id] = nil
  end
  
  return success
end

-- Check health of all terminals
function M._check_terminal_health()
  local tmux = require("orchflow.orchestrator.tmux")
  
  for id, term in pairs(terminals) do
    if term.status == M.STATUS.RUNNING then
      local is_alive = tmux.is_pane_alive(term.pane_id)
      if not is_alive then
        term.status = M.STATUS.EXITED
        -- Could emit an event here for other components to react
        vim.schedule(function()
          vim.notify(string.format("Terminal '%s' has exited", term.name), vim.log.levels.WARN)
        end)
      end
    end
  end
end

-- Get terminal status summary
function M.get_status_summary()
  local summary = {
    total = 0,
    running = 0,
    exited = 0,
    error = 0,
  }
  
  for _, term in pairs(terminals) do
    summary.total = summary.total + 1
    if term.status == M.STATUS.RUNNING then
      summary.running = summary.running + 1
    elseif term.status == M.STATUS.EXITED or term.status == M.STATUS.KILLED then
      summary.exited = summary.exited + 1
    elseif term.status == M.STATUS.ERROR then
      summary.error = summary.error + 1
    end
  end
  
  return summary
end

-- Clean up exited terminals
function M.cleanup_exited()
  local cleaned = 0
  for id, term in pairs(terminals) do
    if term.status == M.STATUS.EXITED or term.status == M.STATUS.KILLED then
      terminals[id] = nil
      cleaned = cleaned + 1
    end
  end
  return cleaned
end

-- Get output from terminal
function M.capture_output(terminal_id, lines)
  local terminal = terminals[terminal_id]
  if not terminal then
    return ""
  end
  
  local tmux = require("orchflow.orchestrator.tmux")
  return tmux.capture_pane(terminal.pane_id, lines)
end

-- Focus terminal
function M.focus(terminal_id)
  local terminal = terminals[terminal_id]
  if not terminal then
    return false
  end
  
  local tmux = require("orchflow.orchestrator.tmux")
  return tmux.focus_pane(terminal.pane_id)
end

-- Resize terminal
function M.resize(terminal_id, direction, amount)
  local terminal = terminals[terminal_id]
  if not terminal then
    return false
  end
  
  local tmux = require("orchflow.orchestrator.tmux")
  return tmux.resize_pane(terminal.pane_id, direction, amount)
end

-- Get or set the session name
function M.session(name)
  if name then
    session_name = name
  end
  return session_name
end

return M