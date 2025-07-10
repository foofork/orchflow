// LSP protocol implementation

use serde_json::{json, Value};

pub struct LspProtocol;

impl LspProtocol {
    /// Create a textDocument/didOpen notification
    pub fn did_open_text_document(uri: &str, language_id: &str, text: &str) -> Value {
        json!({
            "textDocument": {
                "uri": uri,
                "languageId": language_id,
                "version": 1,
                "text": text
            }
        })
    }
    
    /// Create a textDocument/didChange notification
    pub fn did_change_text_document(uri: &str, version: i32, text: &str) -> Value {
        json!({
            "textDocument": {
                "uri": uri,
                "version": version
            },
            "contentChanges": [{
                "text": text
            }]
        })
    }
    
    /// Create a textDocument/didSave notification
    pub fn did_save_text_document(uri: &str, text: Option<&str>) -> Value {
        let mut params = json!({
            "textDocument": {
                "uri": uri
            }
        });
        
        if let Some(text_content) = text {
            params["text"] = json!(text_content);
        }
        
        params
    }
    
    /// Create a textDocument/didClose notification
    pub fn did_close_text_document(uri: &str) -> Value {
        json!({
            "textDocument": {
                "uri": uri
            }
        })
    }
    
    /// Create a textDocument/completion request
    pub fn text_document_completion(uri: &str, line: u32, character: u32) -> Value {
        json!({
            "textDocument": {
                "uri": uri
            },
            "position": {
                "line": line,
                "character": character
            }
        })
    }
    
    /// Create a textDocument/hover request
    pub fn text_document_hover(uri: &str, line: u32, character: u32) -> Value {
        json!({
            "textDocument": {
                "uri": uri
            },
            "position": {
                "line": line,
                "character": character
            }
        })
    }
    
    /// Create a textDocument/definition request
    pub fn text_document_definition(uri: &str, line: u32, character: u32) -> Value {
        json!({
            "textDocument": {
                "uri": uri
            },
            "position": {
                "line": line,
                "character": character
            }
        })
    }
    
    /// Create a textDocument/references request
    pub fn text_document_references(uri: &str, line: u32, character: u32, include_declaration: bool) -> Value {
        json!({
            "textDocument": {
                "uri": uri
            },
            "position": {
                "line": line,
                "character": character
            },
            "context": {
                "includeDeclaration": include_declaration
            }
        })
    }
    
    /// Create a textDocument/formatting request
    pub fn text_document_formatting(uri: &str, tab_size: u32, insert_spaces: bool) -> Value {
        json!({
            "textDocument": {
                "uri": uri
            },
            "options": {
                "tabSize": tab_size,
                "insertSpaces": insert_spaces
            }
        })
    }
    
    /// Create a textDocument/rangeFormatting request
    pub fn text_document_range_formatting(
        uri: &str,
        start_line: u32,
        start_char: u32,
        end_line: u32,
        end_char: u32,
        tab_size: u32,
        insert_spaces: bool,
    ) -> Value {
        json!({
            "textDocument": {
                "uri": uri
            },
            "range": {
                "start": {
                    "line": start_line,
                    "character": start_char
                },
                "end": {
                    "line": end_line,
                    "character": end_char
                }
            },
            "options": {
                "tabSize": tab_size,
                "insertSpaces": insert_spaces
            }
        })
    }
    
    /// Create a textDocument/rename request
    pub fn text_document_rename(uri: &str, line: u32, character: u32, new_name: &str) -> Value {
        json!({
            "textDocument": {
                "uri": uri
            },
            "position": {
                "line": line,
                "character": character
            },
            "newName": new_name
        })
    }
    
    /// Create a workspace/symbol request
    pub fn workspace_symbol(query: &str) -> Value {
        json!({
            "query": query
        })
    }
    
    /// Create a textDocument/documentSymbol request
    pub fn text_document_document_symbol(uri: &str) -> Value {
        json!({
            "textDocument": {
                "uri": uri
            }
        })
    }
    
    /// Convert a file path to LSP URI format
    pub fn path_to_uri(path: &str) -> String {
        if path.starts_with("file://") {
            path.to_string()
        } else {
            format!("file://{}", path)
        }
    }
    
    /// Convert LSP URI to file path
    pub fn uri_to_path(uri: &str) -> Option<String> {
        if uri.starts_with("file://") {
            Some(uri.trim_start_matches("file://").to_string())
        } else {
            None
        }
    }
}