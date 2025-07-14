use crate::error::Result;
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::fmt;

/// Cursor position within a terminal pane
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct CursorPosition {
    /// Row position (1-based, as per ANSI standard)
    pub row: u16,
    /// Column position (1-based, as per ANSI standard)
    pub col: u16,
}

impl Default for CursorPosition {
    fn default() -> Self {
        Self { row: 1, col: 1 }
    }
}

impl fmt::Display for CursorPosition {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}:{}", self.row, self.col)
    }
}

impl CursorPosition {
    /// Create a new cursor position
    pub fn new(row: u16, col: u16) -> Self {
        Self { row, col }
    }

    /// Move cursor to specific position (1-based coordinates)
    pub fn set(&mut self, row: u16, col: u16) {
        self.row = row.max(1);
        self.col = col.max(1);
    }

    /// Move cursor relatively
    pub fn move_by(&mut self, delta_row: i16, delta_col: i16) {
        self.row = ((self.row as i16) + delta_row).max(1) as u16;
        self.col = ((self.col as i16) + delta_col).max(1) as u16;
    }

    /// Convert to zero-based coordinates for internal use
    pub fn to_zero_based(&self) -> (u16, u16) {
        (self.row.saturating_sub(1), self.col.saturating_sub(1))
    }

    /// Create from zero-based coordinates
    pub fn from_zero_based(row: u16, col: u16) -> Self {
        Self {
            row: row + 1,
            col: col + 1,
        }
    }
}

/// ANSI escape sequence parser for cursor position
#[derive(Debug)]
pub struct AnsiParser {
    cursor_position_regex: Regex,
    cursor_move_regex: Regex,
    cursor_save_regex: Regex,
    cursor_restore_regex: Regex,
}

impl Default for AnsiParser {
    fn default() -> Self {
        Self::new()
    }
}

impl AnsiParser {
    /// Create a new ANSI parser
    pub fn new() -> Self {
        Self {
            // CSI n ; m H - Cursor Position (row ; col)
            cursor_position_regex: Regex::new(r"\x1b\[(\d+);(\d+)H").unwrap(),
            // CSI n A/B/C/D - Cursor movement (up/down/right/left)
            cursor_move_regex: Regex::new(r"\x1b\[(\d*)([ABCD])").unwrap(),
            // CSI s - Save cursor position
            cursor_save_regex: Regex::new(r"\x1b\[s").unwrap(),
            // CSI u - Restore cursor position
            cursor_restore_regex: Regex::new(r"\x1b\[u").unwrap(),
        }
    }

    /// Parse ANSI escape sequences from PTY output and update cursor position
    pub fn parse_and_update(&self, data: &[u8], cursor: &mut CursorPosition) -> Result<Vec<CursorEvent>> {
        let text = String::from_utf8_lossy(data);
        let mut events = Vec::new();

        // Parse cursor position commands
        for captures in self.cursor_position_regex.captures_iter(&text) {
            if let (Some(row_match), Some(col_match)) = (captures.get(1), captures.get(2)) {
                if let (Ok(row), Ok(col)) = (row_match.as_str().parse::<u16>(), col_match.as_str().parse::<u16>()) {
                    cursor.set(row, col);
                    events.push(CursorEvent::Position(*cursor));
                }
            }
        }

        // Parse cursor movement commands
        for captures in self.cursor_move_regex.captures_iter(&text) {
            let count_str = captures.get(1).map_or("1", |m| m.as_str());
            let count = count_str.parse::<i16>().unwrap_or(1);
            let direction = captures.get(2).map(|m| m.as_str()).unwrap_or("");

            match direction {
                "A" => cursor.move_by(-count, 0), // Up
                "B" => cursor.move_by(count, 0),  // Down
                "C" => cursor.move_by(0, count),  // Right
                "D" => cursor.move_by(0, -count), // Left
                _ => continue,
            }
            events.push(CursorEvent::Move(*cursor));
        }

        // Parse save/restore commands
        if self.cursor_save_regex.is_match(&text) {
            events.push(CursorEvent::Save(*cursor));
        }

        if self.cursor_restore_regex.is_match(&text) {
            events.push(CursorEvent::Restore(*cursor));
        }

        Ok(events)
    }

    /// Extract cursor position from CSI 6n response (Device Status Report)
    pub fn parse_cursor_report(&self, data: &[u8]) -> Result<Option<CursorPosition>> {
        let text = String::from_utf8_lossy(data);
        // CSI row ; col R - Cursor Position Report
        let report_regex = Regex::new(r"\x1b\[(\d+);(\d+)R").unwrap();
        
        if let Some(captures) = report_regex.captures(&text) {
            if let (Some(row_match), Some(col_match)) = (captures.get(1), captures.get(2)) {
                if let (Ok(row), Ok(col)) = (row_match.as_str().parse::<u16>(), col_match.as_str().parse::<u16>()) {
                    return Ok(Some(CursorPosition::new(row, col)));
                }
            }
        }
        
        Ok(None)
    }
}

/// Events related to cursor position changes
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum CursorEvent {
    /// Cursor moved to absolute position
    Position(CursorPosition),
    /// Cursor moved relatively
    Move(CursorPosition),
    /// Cursor position saved
    Save(CursorPosition),
    /// Cursor position restored
    Restore(CursorPosition),
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cursor_position_default() {
        let pos = CursorPosition::default();
        assert_eq!(pos.row, 1);
        assert_eq!(pos.col, 1);
    }

    #[test]
    fn test_cursor_position_new() {
        let pos = CursorPosition::new(10, 20);
        assert_eq!(pos.row, 10);
        assert_eq!(pos.col, 20);
    }

    #[test]
    fn test_cursor_position_set() {
        let mut pos = CursorPosition::default();
        pos.set(5, 15);
        assert_eq!(pos.row, 5);
        assert_eq!(pos.col, 15);
    }

    #[test]
    fn test_cursor_position_move_by() {
        let mut pos = CursorPosition::new(5, 10);
        pos.move_by(2, -3);
        assert_eq!(pos.row, 7);
        assert_eq!(pos.col, 7);
    }

    #[test]
    fn test_cursor_position_bounds_checking() {
        let mut pos = CursorPosition::new(1, 1);
        pos.move_by(-5, -5);
        assert_eq!(pos.row, 1); // Should not go below 1
        assert_eq!(pos.col, 1); // Should not go below 1
    }

    #[test]
    fn test_cursor_position_zero_based_conversion() {
        let pos = CursorPosition::new(10, 20);
        let (row, col) = pos.to_zero_based();
        assert_eq!(row, 9);
        assert_eq!(col, 19);

        let pos2 = CursorPosition::from_zero_based(9, 19);
        assert_eq!(pos, pos2);
    }

    #[test]
    fn test_ansi_parser_cursor_position() {
        let parser = AnsiParser::new();
        let mut cursor = CursorPosition::default();
        
        // Test cursor position command
        let data = b"\x1b[10;20H";
        let events = parser.parse_and_update(data, &mut cursor).unwrap();
        
        assert_eq!(cursor.row, 10);
        assert_eq!(cursor.col, 20);
        assert_eq!(events.len(), 1);
        assert_eq!(events[0], CursorEvent::Position(cursor));
    }

    #[test]
    fn test_ansi_parser_cursor_movement() {
        let parser = AnsiParser::new();
        let mut cursor = CursorPosition::new(10, 10);
        
        // Test cursor up
        let data = b"\x1b[5A";
        let events = parser.parse_and_update(data, &mut cursor).unwrap();
        assert_eq!(cursor.row, 5);
        assert_eq!(cursor.col, 10);
        assert_eq!(events.len(), 1);
        
        // Test cursor right
        let data = b"\x1b[3C";
        let events = parser.parse_and_update(data, &mut cursor).unwrap();
        assert_eq!(cursor.row, 5);
        assert_eq!(cursor.col, 13);
        assert_eq!(events.len(), 1);
    }

    #[test]
    fn test_ansi_parser_cursor_report() {
        let parser = AnsiParser::new();
        
        // Test cursor position report response
        let data = b"\x1b[10;20R";
        let position = parser.parse_cursor_report(data).unwrap();
        
        assert!(position.is_some());
        let pos = position.unwrap();
        assert_eq!(pos.row, 10);
        assert_eq!(pos.col, 20);
    }

    #[test]
    fn test_ansi_parser_mixed_content() {
        let parser = AnsiParser::new();
        let mut cursor = CursorPosition::default();
        
        // Test mixed content with cursor commands
        let data = b"Hello\x1b[10;20HWorld\x1b[5ATest";
        let events = parser.parse_and_update(data, &mut cursor).unwrap();
        
        assert_eq!(events.len(), 2);
        assert_eq!(cursor.row, 5); // Final position after up movement
        assert_eq!(cursor.col, 20);
    }

    #[test]
    fn test_ansi_parser_save_restore() {
        let parser = AnsiParser::new();
        let mut cursor = CursorPosition::new(5, 10);
        
        // Test save cursor
        let data = b"\x1b[s";
        let events = parser.parse_and_update(data, &mut cursor).unwrap();
        assert_eq!(events.len(), 1);
        assert_eq!(events[0], CursorEvent::Save(cursor));
        
        // Test restore cursor
        let data = b"\x1b[u";
        let events = parser.parse_and_update(data, &mut cursor).unwrap();
        assert_eq!(events.len(), 1);
        assert_eq!(events[0], CursorEvent::Restore(cursor));
    }
}