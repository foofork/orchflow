#[cfg(test)]
mod tests {
    
    use crate::terminal::Pty;
    use std::collections::HashMap;
    use std::io::Read;
    use std::time::Duration;
    

    #[test]
    fn test_pty_creation() {
        let pty = Pty::new();
        assert!(pty.is_ok(), "Failed to create PTY");
    }

    #[test]
    fn test_pty_spawn_default_shell() {
        let mut pty = Pty::new().unwrap();
        let env = HashMap::new();
        
        let result = pty.spawn(None, None, env);
        assert!(result.is_ok(), "Failed to spawn default shell");
        
        let pid = result.unwrap();
        assert!(pid > 0, "Invalid PID");
        
        // Verify PID matches
        assert_eq!(pty.pid(), Some(pid));
    }

    #[test]
    fn test_pty_spawn_custom_command() {
        let mut pty = Pty::new().unwrap();
        let env = HashMap::new();
        
        let result = pty.spawn(Some("/bin/echo"), None, env);
        assert!(result.is_ok(), "Failed to spawn echo command");
    }

    #[test]
    fn test_pty_write_and_read() {
        let mut pty = Pty::new().unwrap();
        let env = HashMap::new();
        
        // Spawn a shell
        pty.spawn(Some("/bin/sh"), None, env).unwrap();
        
        // Write a command
        let command = "echo 'test output'\n";
        let result = pty.write(command.as_bytes());
        assert!(result.is_ok(), "Failed to write to PTY");
        
        // Give it time to process
        std::thread::sleep(Duration::from_millis(100));
        
        // Read output
        let mut reader = pty.take_reader().unwrap();
        let mut buffer = [0; 1024];
        let bytes_read = reader.read(&mut buffer);
        assert!(bytes_read.is_ok(), "Failed to read from PTY");
        
        let output = String::from_utf8_lossy(&buffer[..bytes_read.unwrap()]);
        assert!(output.contains("test output"), "Expected output not found");
    }

    #[test]
    fn test_pty_resize() {
        let pty = Pty::new().unwrap();
        
        let result = pty.resize(100, 40);
        assert!(result.is_ok(), "Failed to resize PTY");
    }

    #[test]
    fn test_pty_kill_process() {
        let mut pty = Pty::new().unwrap();
        let env = HashMap::new();
        
        // Spawn a long-running process
        pty.spawn(Some("/bin/sleep"), None, env).unwrap();
        
        // Kill it
        let result = pty.kill();
        assert!(result.is_ok(), "Failed to kill process");
        
        // PID should be None after kill
        assert_eq!(pty.pid(), None);
    }

    #[test]
    fn test_pty_with_working_directory() {
        let mut pty = Pty::new().unwrap();
        let env = HashMap::new();
        
        let result = pty.spawn(Some("/bin/pwd"), Some("/tmp"), env);
        assert!(result.is_ok(), "Failed to spawn with working directory");
        
        // Give it time to execute
        std::thread::sleep(Duration::from_millis(100));
        
        // Read output
        let mut reader = pty.take_reader().unwrap();
        let mut buffer = [0; 1024];
        let bytes_read = reader.read(&mut buffer).unwrap();
        
        let output = String::from_utf8_lossy(&buffer[..bytes_read]);
        assert!(output.contains("/tmp"), "Working directory not set correctly");
    }

    #[test]
    fn test_pty_with_environment_variables() {
        let mut pty = Pty::new().unwrap();
        let mut env = HashMap::new();
        env.insert("TEST_VAR".to_string(), "test_value".to_string());
        
        let result = pty.spawn(Some("/bin/sh"), None, env);
        assert!(result.is_ok(), "Failed to spawn with environment variables");
        
        // Write command to check env var
        pty.write(b"echo $TEST_VAR\n").unwrap();
        
        // Give it time to process
        std::thread::sleep(Duration::from_millis(100));
        
        // Read output
        let mut reader = pty.take_reader().unwrap();
        let mut buffer = [0; 1024];
        let bytes_read = reader.read(&mut buffer).unwrap();
        
        let output = String::from_utf8_lossy(&buffer[..bytes_read]);
        assert!(output.contains("test_value"), "Environment variable not set correctly");
    }
}