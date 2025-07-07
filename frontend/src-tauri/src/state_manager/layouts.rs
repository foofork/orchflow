// Layout management

use crate::layout::GridLayout;
use crate::error::{OrchflowError, Result};
use super::types::StateEvent;
use super::events::EventManager;

pub struct LayoutManager {
    events: EventManager,
}

impl LayoutManager {
    pub fn new(events: EventManager) -> Self {
        Self { events }
    }
    
    /// Update layout for a session
    pub async fn update_layout(
        &self,
        session: &mut super::types::SessionState,
        layout: GridLayout,
    ) -> Result<()> {
        // Validate layout
        self.validate_layout(&layout, session).await?;
        
        // Update session layout
        session.update_layout(layout.clone());
        
        // Emit event
        self.events.emit(StateEvent::LayoutUpdated {
            session_id: session.id.clone(),
            layout,
        });
        
        Ok(())
    }
    
    /// Reset layout for a session
    pub async fn reset_layout(&self, session: &mut super::types::SessionState) -> Result<()> {
        session.layout = None;
        
        // Emit event
        self.events.emit(StateEvent::LayoutReset {
            session_id: session.id.clone(),
        });
        
        Ok(())
    }
    
    /// Validate a layout against a session
    async fn validate_layout(&self, layout: &GridLayout, session: &super::types::SessionState) -> Result<()> {
        // Check that all panes in the layout exist in the session
        let layout_panes = self.extract_pane_ids_from_layout(layout);
        
        for pane_id in &layout_panes {
            if !session.panes.contains(pane_id) {
                return Err(OrchflowError::validation_error(
                    "layout_panes",
                    &format!("Layout contains pane {} that is not in session", pane_id)
                ));
            }
        }
        
        // Check that all session panes are in the layout (optional - depends on requirements)
        // for session_pane in &session.panes {
        //     if !layout_panes.contains(session_pane) {
        //         return Err(OrchflowError::validation_error(
        //             "session_panes",
        //             &format!("Session pane {} is not represented in layout", session_pane)
        //         ));
        //     }
        // }
        
        Ok(())
    }
    
    /// Extract all pane IDs from a layout
    fn extract_pane_ids_from_layout(&self, layout: &GridLayout) -> Vec<String> {
        let mut pane_ids = Vec::new();
        self.collect_pane_ids_recursive(&layout.root_id, layout, &mut pane_ids);
        pane_ids
    }
    
    /// Recursively collect pane IDs from layout nodes
    fn collect_pane_ids_recursive(&self, node_id: &str, layout: &GridLayout, pane_ids: &mut Vec<String>) {
        if let Some(pane_layout) = layout.panes.get(node_id) {
            if let Some(pane_id) = &pane_layout.pane_id {
                pane_ids.push(pane_id.clone());
            }
            
            for child_id in &pane_layout.children {
                self.collect_pane_ids_recursive(child_id, layout, pane_ids);
            }
        }
    }
    
    /// Create a simple single-pane layout
    pub fn create_single_pane_layout(&self, pane_id: &str) -> GridLayout {
        use crate::layout::{PaneLayout, PaneBounds};
        
        let root_id = uuid::Uuid::new_v4().to_string();
        let mut panes = std::collections::HashMap::new();
        
        panes.insert(root_id.clone(), PaneLayout {
            id: root_id.clone(),
            parent_id: None,
            split_type: None,
            split_percent: None,
            pane_id: Some(pane_id.to_string()),
            children: vec![],
            bounds: PaneBounds { x: 0, y: 0, width: 100, height: 100 },
        });
        
        GridLayout {
            session_id: "temp".to_string(), // This should be set by the caller
            root_id,
            active_pane_id: Some(pane_id.to_string()),
            panes,
        }
    }
    
    /// Create a horizontal split layout
    pub fn create_horizontal_split_layout(&self, left_pane: &str, right_pane: &str) -> GridLayout {
        use crate::layout::{PaneLayout, PaneBounds, SplitType};
        
        let left_id = uuid::Uuid::new_v4().to_string();
        let right_id = uuid::Uuid::new_v4().to_string();
        let container_id = uuid::Uuid::new_v4().to_string();
        let mut panes = std::collections::HashMap::new();
        
        // Root container
        panes.insert(container_id.clone(), PaneLayout {
            id: container_id.clone(),
            parent_id: None,
            split_type: Some(SplitType::Horizontal),
            split_percent: Some(50),
            pane_id: None,
            children: vec![left_id.clone(), right_id.clone()],
            bounds: PaneBounds { x: 0, y: 0, width: 100, height: 100 },
        });
        
        // Left pane
        panes.insert(left_id.clone(), PaneLayout {
            id: left_id,
            parent_id: Some(container_id.clone()),
            split_type: None,
            split_percent: None,
            pane_id: Some(left_pane.to_string()),
            children: vec![],
            bounds: PaneBounds { x: 0, y: 0, width: 50, height: 100 },
        });
        
        // Right pane
        panes.insert(right_id.clone(), PaneLayout {
            id: right_id,
            parent_id: Some(container_id.clone()),
            split_type: None,
            split_percent: None,
            pane_id: Some(right_pane.to_string()),
            children: vec![],
            bounds: PaneBounds { x: 50, y: 0, width: 50, height: 100 },
        });
        
        GridLayout {
            session_id: "temp".to_string(),
            root_id: container_id,
            active_pane_id: Some(left_pane.to_string()),
            panes,
        }
    }
    
    /// Create a vertical split layout
    pub fn create_vertical_split_layout(&self, top_pane: &str, bottom_pane: &str) -> GridLayout {
        use crate::layout::{PaneLayout, PaneBounds, SplitType};
        
        let top_id = uuid::Uuid::new_v4().to_string();
        let bottom_id = uuid::Uuid::new_v4().to_string();
        let container_id = uuid::Uuid::new_v4().to_string();
        let mut panes = std::collections::HashMap::new();
        
        // Root container
        panes.insert(container_id.clone(), PaneLayout {
            id: container_id.clone(),
            parent_id: None,
            split_type: Some(SplitType::Vertical),
            split_percent: Some(50),
            pane_id: None,
            children: vec![top_id.clone(), bottom_id.clone()],
            bounds: PaneBounds { x: 0, y: 0, width: 100, height: 100 },
        });
        
        // Top pane
        panes.insert(top_id.clone(), PaneLayout {
            id: top_id,
            parent_id: Some(container_id.clone()),
            split_type: None,
            split_percent: None,
            pane_id: Some(top_pane.to_string()),
            children: vec![],
            bounds: PaneBounds { x: 0, y: 0, width: 100, height: 50 },
        });
        
        // Bottom pane
        panes.insert(bottom_id.clone(), PaneLayout {
            id: bottom_id,
            parent_id: Some(container_id.clone()),
            split_type: None,
            split_percent: None,
            pane_id: Some(bottom_pane.to_string()),
            children: vec![],
            bounds: PaneBounds { x: 0, y: 50, width: 100, height: 50 },
        });
        
        GridLayout {
            session_id: "temp".to_string(),
            root_id: container_id,
            active_pane_id: Some(top_pane.to_string()),
            panes,
        }
    }
}