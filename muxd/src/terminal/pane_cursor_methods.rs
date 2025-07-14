use super::*;

impl Pane {
    /// Get current cursor position
    pub fn get_cursor_position(&self) -> CursorPosition {
        *self.cursor_position.read()
    }

    /// Set cursor position manually
    pub fn set_cursor_position(&self, position: CursorPosition) {
        *self.cursor_position.write() = position;
    }

    /// Save current cursor position
    pub fn save_cursor_position(&self) {
        let current = *self.cursor_position.read();
        *self.saved_cursor_position.write() = Some(current);
    }

    /// Restore saved cursor position
    pub fn restore_cursor_position(&self) -> Result<()> {
        let saved = *self.saved_cursor_position.read();
        if let Some(saved_pos) = saved {
            *self.cursor_position.write() = saved_pos;
            Ok(())
        } else {
            Err(MuxdError::ValidationError {
                field: "saved_cursor".to_string(),
                reason: "No saved cursor position available".to_string(),
            })
        }
    }

    /// Send cursor position query to PTY (Device Status Report)
    pub async fn query_cursor_position(&self) -> Result<()> {
        if let Some(pty) = self.pty.read().as_ref() {
            // Send Device Status Report query (CSI 6n)
            let query = b"\x1b[6n";
            pty.write(query).await?;
            Ok(())
        } else {
            Err(MuxdError::StateError {
                operation: "query_cursor".to_string(),
                reason: "PTY not available".to_string(),
            })
        }
    }

    /// Process PTY output for cursor position updates
    pub fn process_output_for_cursor(&self, data: &[u8]) -> Result<Vec<CursorEvent>> {
        let mut cursor = self.cursor_position.write();
        let events = self.ansi_parser.parse_and_update(data, &mut cursor)?;
        
        // Handle cursor save/restore events
        for event in &events {
            match event {
                CursorEvent::Save(_) => {
                    *self.saved_cursor_position.write() = Some(*cursor);
                }
                CursorEvent::Restore(_) => {
                    if let Some(saved) = *self.saved_cursor_position.read() {
                        *cursor = saved;
                    }
                }
                _ => {}
            }
        }

        Ok(events)
    }

    /// Check if cursor position report is available in data
    pub fn extract_cursor_report(&self, data: &[u8]) -> Result<Option<CursorPosition>> {
        self.ansi_parser.parse_cursor_report(data)
    }

    /// Update cursor position from cursor report
    pub fn update_cursor_from_report(&self, position: CursorPosition) {
        *self.cursor_position.write() = position;
    }

    /// Get cursor position as zero-based coordinates for internal calculations
    pub fn get_cursor_zero_based(&self) -> (u16, u16) {
        self.cursor_position.read().to_zero_based()
    }

    /// Set cursor position from zero-based coordinates
    pub fn set_cursor_zero_based(&self, row: u16, col: u16) {
        *self.cursor_position.write() = CursorPosition::from_zero_based(row, col);
    }

    /// Get cursor position relative to pane size
    pub fn get_cursor_relative(&self) -> Result<(f32, f32)> {
        let cursor = *self.cursor_position.read();
        let size = *self.size.read();
        
        if size.rows == 0 || size.cols == 0 {
            return Err(MuxdError::ValidationError {
                field: "pane_size".to_string(),
                reason: "Pane size cannot be zero".to_string(),
            });
        }

        let rel_row = (cursor.row as f32) / (size.rows as f32);
        let rel_col = (cursor.col as f32) / (size.cols as f32);
        
        Ok((rel_row, rel_col))
    }

    /// Check if cursor is within pane bounds
    pub fn is_cursor_in_bounds(&self) -> bool {
        let cursor = *self.cursor_position.read();
        let size = *self.size.read();
        
        cursor.row <= size.rows && cursor.col <= size.cols
    }

    /// Reset cursor to top-left position
    pub fn reset_cursor(&self) {
        *self.cursor_position.write() = CursorPosition::default();
        *self.saved_cursor_position.write() = None;
    }
}

#[cfg(test)]
mod cursor_tests {
    use super::*;
    use tokio::sync::mpsc;

    fn create_test_pane() -> Pane {
        let (tx, _rx) = mpsc::unbounded_channel();
        Pane::new("test_session".to_string(), PaneType::Terminal, tx)
    }

    #[test]
    fn test_cursor_position_default() {
        let pane = create_test_pane();
        let pos = pane.get_cursor_position();
        assert_eq!(pos.row, 1);
        assert_eq!(pos.col, 1);
    }

    #[test]
    fn test_set_cursor_position() {
        let pane = create_test_pane();
        let new_pos = CursorPosition::new(10, 20);
        pane.set_cursor_position(new_pos);
        
        let pos = pane.get_cursor_position();
        assert_eq!(pos.row, 10);
        assert_eq!(pos.col, 20);
    }

    #[test]
    fn test_save_restore_cursor() {
        let pane = create_test_pane();
        
        // Set a position and save it
        let original_pos = CursorPosition::new(5, 15);
        pane.set_cursor_position(original_pos);
        pane.save_cursor_position();
        
        // Change position
        let new_pos = CursorPosition::new(10, 25);
        pane.set_cursor_position(new_pos);
        assert_eq!(pane.get_cursor_position(), new_pos);
        
        // Restore original position
        pane.restore_cursor_position().unwrap();
        assert_eq!(pane.get_cursor_position(), original_pos);
    }

    #[test]
    fn test_restore_cursor_without_save() {
        let pane = create_test_pane();
        let result = pane.restore_cursor_position();
        assert!(result.is_err());
    }

    #[test]
    fn test_zero_based_coordinates() {
        let pane = create_test_pane();
        pane.set_cursor_zero_based(9, 19);
        
        let (row, col) = pane.get_cursor_zero_based();
        assert_eq!(row, 9);
        assert_eq!(col, 19);
        
        let pos = pane.get_cursor_position();
        assert_eq!(pos.row, 10);
        assert_eq!(pos.col, 20);
    }

    #[test]
    fn test_cursor_relative_position() {
        let pane = create_test_pane();
        
        // Set pane size to 20x40
        *pane.size.write() = PaneSize { rows: 20, cols: 40 };
        
        // Set cursor to middle
        pane.set_cursor_position(CursorPosition::new(10, 20));
        
        let (rel_row, rel_col) = pane.get_cursor_relative().unwrap();
        assert_eq!(rel_row, 0.5);
        assert_eq!(rel_col, 0.5);
    }

    #[test]
    fn test_cursor_bounds_checking() {
        let pane = create_test_pane();
        *pane.size.write() = PaneSize { rows: 24, cols: 80 };
        
        // Cursor within bounds
        pane.set_cursor_position(CursorPosition::new(10, 40));
        assert!(pane.is_cursor_in_bounds());
        
        // Cursor out of bounds
        pane.set_cursor_position(CursorPosition::new(30, 90));
        assert!(!pane.is_cursor_in_bounds());
    }

    #[test]
    fn test_process_output_for_cursor() {
        let pane = create_test_pane();
        
        // Test cursor position command
        let data = b"\x1b[10;20H";
        let events = pane.process_output_for_cursor(data).unwrap();
        
        assert_eq!(events.len(), 1);
        assert_eq!(pane.get_cursor_position(), CursorPosition::new(10, 20));
    }

    #[test]
    fn test_extract_cursor_report() {
        let pane = create_test_pane();
        
        // Test cursor position report
        let data = b"\x1b[15;25R";
        let position = pane.extract_cursor_report(data).unwrap();
        
        assert!(position.is_some());
        let pos = position.unwrap();
        assert_eq!(pos.row, 15);
        assert_eq!(pos.col, 25);
    }

    #[test]
    fn test_reset_cursor() {
        let pane = create_test_pane();
        
        // Set cursor to some position and save
        pane.set_cursor_position(CursorPosition::new(10, 20));
        pane.save_cursor_position();
        
        // Reset cursor
        pane.reset_cursor();
        
        let pos = pane.get_cursor_position();
        assert_eq!(pos, CursorPosition::default());
        
        // Should not be able to restore after reset
        let result = pane.restore_cursor_position();
        assert!(result.is_err());
    }
}