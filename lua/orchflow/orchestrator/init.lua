-- orchflow.orchestrator
-- Main orchestrator module for terminal management

local M = {}

-- Terminal manager instance
local terminal_manager = require("orchflow.orchestrator.terminal_manager")
local tmux = require("orchflow.orchestrator.tmux")

-- Configuration
M.config = {
  -- Default shell
  shell = vim.o.shell or "/bin/zsh",
  
  -- Terminal layout presets
  layouts = {
    default = "main-bottom",
    development = "main-with-sidebars",
  },
  
  -- Auto-spawn terminals on startup
  auto_spawn = {
    { name = "main", focus = true },
  },
  
  -- Terminal naming convention
  name_prefix = "orchflow",
}

-- Initialize the orchestrator
function M.setup(opts)
  M.config = vim.tbl_deep_extend("force", M.config, opts or {})
  
  -- Initialize tmux integration
  tmux.setup()
  
  -- Initialize terminal manager
  terminal_manager.setup(M.config)
  
  -- Set session name if provided
  if M.config.session_name then
    terminal_manager.session(M.config.session_name)
  end
  
  -- Set up commands
  M._setup_commands()
  
  -- Set up keymaps
  M._setup_keymaps()
  
  -- Auto-spawn terminals if configured
  if M.config.auto_spawn then
    vim.schedule(function()
      for _, term_config in ipairs(M.config.auto_spawn) do
        M.spawn_terminal(term_config)
      end
    end)
  end
end

-- Spawn a new terminal
function M.spawn_terminal(opts)
  opts = opts or {}
  
  local term = terminal_manager.create({
    name = opts.name or M._generate_name(),
    command = opts.command,
    cwd = opts.cwd or vim.fn.getcwd(),
    env = opts.env,
    focus = opts.focus,
  })
  
  if term then
    vim.notify("Terminal spawned: " .. term.name, vim.log.levels.INFO)
    return term
  else
    vim.notify("Failed to spawn terminal", vim.log.levels.ERROR)
    return nil
  end
end

-- Send command to a terminal
function M.send_command(terminal_name, command)
  local term = terminal_manager.get(terminal_name)
  if not term then
    vim.notify("Terminal not found: " .. terminal_name, vim.log.levels.ERROR)
    return false
  end
  
  return terminal_manager.send_command(term.id, command)
end

-- List all managed terminals
function M.list_terminals()
  return terminal_manager.list()
end

-- Focus a terminal
function M.focus_terminal(terminal_name)
  local term = terminal_manager.get(terminal_name)
  if not term then
    vim.notify("Terminal not found: " .. terminal_name, vim.log.levels.ERROR)
    return false
  end
  
  return terminal_manager.focus(term.id)
end

-- Kill a terminal
function M.kill_terminal(terminal_name)
  local term = terminal_manager.get(terminal_name)
  if not term then
    vim.notify("Terminal not found: " .. terminal_name, vim.log.levels.ERROR)
    return false
  end
  
  local success = terminal_manager.kill(term.id)
  if success then
    vim.notify("Terminal killed: " .. terminal_name, vim.log.levels.INFO)
  end
  return success
end

-- Generate a unique terminal name
function M._generate_name()
  local count = #terminal_manager.list() + 1
  return string.format("%s-%d", M.config.name_prefix, count)
end

-- Set up user commands
function M._setup_commands()
  -- Spawn terminal command
  vim.api.nvim_create_user_command("OrchSpawn", function(opts)
    local args = vim.split(opts.args, " ", { plain = true })
    M.spawn_terminal({
      name = args[1],
      command = opts.args:match("^%S+%s+(.+)$"),
    })
  end, {
    nargs = "*",
    desc = "Spawn a new terminal",
  })
  
  -- Send command to terminal
  vim.api.nvim_create_user_command("OrchSend", function(opts)
    local args = vim.split(opts.args, " ", { plain = true, trimempty = true })
    if #args < 2 then
      vim.notify("Usage: :OrchSend <terminal> <command>", vim.log.levels.ERROR)
      return
    end
    
    local terminal = args[1]
    local command = opts.args:match("^%S+%s+(.+)$")
    M.send_command(terminal, command)
  end, {
    nargs = "+",
    desc = "Send command to terminal",
  })
  
  -- List terminals
  vim.api.nvim_create_user_command("OrchList", function()
    local terminals = M.list_terminals()
    if #terminals == 0 then
      vim.notify("No terminals running", vim.log.levels.INFO)
      return
    end
    
    local lines = { "Active Terminals:" }
    for _, term in ipairs(terminals) do
      table.insert(lines, string.format("  %s [%s] - %s", 
        term.name, 
        term.status,
        term.command or "shell"
      ))
    end
    vim.notify(table.concat(lines, "\n"), vim.log.levels.INFO)
  end, {
    desc = "List all terminals",
  })
  
  -- Focus terminal
  vim.api.nvim_create_user_command("OrchFocus", function(opts)
    if opts.args == "" then
      vim.notify("Usage: :OrchFocus <terminal>", vim.log.levels.ERROR)
      return
    end
    M.focus_terminal(opts.args)
  end, {
    nargs = 1,
    complete = function()
      return vim.tbl_map(function(t) return t.name end, M.list_terminals())
    end,
    desc = "Focus a terminal",
  })
  
  -- Kill terminal
  vim.api.nvim_create_user_command("OrchKill", function(opts)
    if opts.args == "" then
      vim.notify("Usage: :OrchKill <terminal>", vim.log.levels.ERROR)
      return
    end
    M.kill_terminal(opts.args)
  end, {
    nargs = 1,
    complete = function()
      return vim.tbl_map(function(t) return t.name end, M.list_terminals())
    end,
    desc = "Kill a terminal",
  })
end

-- Set up keymaps
function M._setup_keymaps()
  local map = vim.keymap.set
  
  -- Terminal management
  map("n", "<leader>tn", function() M.spawn_terminal() end, { desc = "New terminal" })
  map("n", "<leader>tl", "<cmd>OrchList<cr>", { desc = "List terminals" })
  map("n", "<leader>tk", "<cmd>OrchKill<cr>", { desc = "Kill terminal" })
  map("n", "<leader>tf", "<cmd>OrchFocus<cr>", { desc = "Focus terminal" })
  
  -- Quick spawn presets
  map("n", "<leader>td", function()
    M.spawn_terminal({ name = "dev", command = "npm run dev" })
  end, { desc = "Spawn dev server" })
  
  map("n", "<leader>tt", function()
    M.spawn_terminal({ name = "test", command = "npm test" })
  end, { desc = "Spawn test runner" })
  
  -- Tmux specific commands
  map("n", "<leader>ta", function()
    tmux.attach_session(terminal_manager.session())
  end, { desc = "Attach to tmux session" })
end

-- Get terminal output
function M.capture_output(terminal_name, lines)
  local term = terminal_manager.get(terminal_name)
  if not term then
    vim.notify("Terminal not found: " .. terminal_name, vim.log.levels.ERROR)
    return ""
  end
  
  return terminal_manager.capture_output(term.id, lines)
end

-- Attach to orchestrator session
function M.attach()
  tmux.attach_session(terminal_manager.session())
end

return M