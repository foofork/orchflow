use crate::error::{OrchflowError, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PaneLayout {
    pub id: String,
    pub parent_id: Option<String>,
    pub split_type: Option<SplitType>,
    pub split_percent: Option<u8>,
    pub pane_id: Option<String>, // tmux pane ID
    pub children: Vec<String>,
    pub bounds: PaneBounds,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub enum SplitType {
    Horizontal, // Split left/right
    Vertical,   // Split top/bottom
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PaneBounds {
    pub x: u16,
    pub y: u16,
    pub width: u16,
    pub height: u16,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GridLayout {
    pub session_id: String,
    pub root_id: String,
    pub active_pane_id: Option<String>,
    pub panes: HashMap<String, PaneLayout>,
}

impl GridLayout {
    pub fn new(session_id: String) -> Self {
        let root_id = format!("pane-{}", uuid::Uuid::new_v4());
        let mut panes = HashMap::new();

        // Create root pane that fills the entire window
        panes.insert(
            root_id.clone(),
            PaneLayout {
                id: root_id.clone(),
                parent_id: None,
                split_type: None,
                split_percent: None,
                pane_id: None,
                children: vec![],
                bounds: PaneBounds {
                    x: 0,
                    y: 0,
                    width: 100,
                    height: 100,
                },
            },
        );

        Self {
            session_id,
            root_id,
            active_pane_id: None,
            panes,
        }
    }

    pub fn split_pane(
        &mut self,
        pane_id: &str,
        split_type: SplitType,
        percent: u8,
    ) -> Result<(String, String)> {
        // Get the pane to split
        let pane = self
            .panes
            .get(pane_id)
            .ok_or_else(|| OrchflowError::pane_not_found(pane_id))?
            .clone();

        // Can't split a pane that already has children
        if !pane.children.is_empty() {
            return Err(OrchflowError::InvalidPaneSplit {
                reason: "Pane already split".to_string(),
            });
        }

        // Create two new child panes
        let child1_id = format!("pane-{}", uuid::Uuid::new_v4());
        let child2_id = format!("pane-{}", uuid::Uuid::new_v4());

        // Calculate bounds for children
        let (bounds1, bounds2) = match split_type {
            SplitType::Horizontal => {
                let split_x = pane.bounds.x + (pane.bounds.width * percent as u16 / 100);
                (
                    PaneBounds {
                        x: pane.bounds.x,
                        y: pane.bounds.y,
                        width: pane.bounds.width * percent as u16 / 100,
                        height: pane.bounds.height,
                    },
                    PaneBounds {
                        x: split_x,
                        y: pane.bounds.y,
                        width: pane.bounds.width * (100 - percent as u16) / 100,
                        height: pane.bounds.height,
                    },
                )
            }
            SplitType::Vertical => {
                let split_y = pane.bounds.y + (pane.bounds.height * percent as u16 / 100);
                (
                    PaneBounds {
                        x: pane.bounds.x,
                        y: pane.bounds.y,
                        width: pane.bounds.width,
                        height: pane.bounds.height * percent as u16 / 100,
                    },
                    PaneBounds {
                        x: pane.bounds.x,
                        y: split_y,
                        width: pane.bounds.width,
                        height: pane.bounds.height * (100 - percent as u16) / 100,
                    },
                )
            }
        };

        // Create child panes
        let child1 = PaneLayout {
            id: child1_id.clone(),
            parent_id: Some(pane_id.to_string()),
            split_type: None,
            split_percent: None,
            pane_id: pane.pane_id.clone(), // First child inherits the tmux pane
            children: vec![],
            bounds: bounds1,
        };

        let child2 = PaneLayout {
            id: child2_id.clone(),
            parent_id: Some(pane_id.to_string()),
            split_type: None,
            split_percent: None,
            pane_id: None, // Second child needs a new tmux pane
            children: vec![],
            bounds: bounds2,
        };

        // Update parent pane
        if let Some(parent) = self.panes.get_mut(pane_id) {
            parent.split_type = Some(split_type);
            parent.split_percent = Some(percent);
            parent.children = vec![child1_id.clone(), child2_id.clone()];
            parent.pane_id = None; // Parent no longer has a tmux pane
        }

        // Insert children
        self.panes.insert(child1_id.clone(), child1);
        self.panes.insert(child2_id.clone(), child2);

        Ok((child1_id, child2_id))
    }

    pub fn get_leaf_panes(&self) -> Vec<&PaneLayout> {
        self.panes
            .values()
            .filter(|pane| pane.children.is_empty())
            .collect()
    }

    pub fn resize_pane(&mut self, pane_id: &str, new_percent: u8) -> Result<()> {
        // Find the parent of this pane
        let pane = self
            .panes
            .get(pane_id)
            .ok_or_else(|| OrchflowError::pane_not_found(pane_id))?
            .clone();

        let parent_id = pane
            .parent_id
            .as_ref()
            .ok_or_else(|| OrchflowError::PaneResizeError {
                reason: "Cannot resize root pane".to_string(),
            })?;

        let parent = self
            .panes
            .get_mut(parent_id)
            .ok_or_else(|| OrchflowError::pane_not_found(parent_id))?;

        // Update split percentage
        parent.split_percent = Some(new_percent);

        // Recalculate bounds for all children
        self.recalculate_bounds(parent_id)?;

        Ok(())
    }

    fn recalculate_bounds(&mut self, pane_id: &str) -> Result<()> {
        let pane = self
            .panes
            .get(pane_id)
            .ok_or_else(|| OrchflowError::pane_not_found(pane_id))?
            .clone();

        if pane.children.len() != 2 {
            return Ok(()); // Nothing to recalculate
        }

        let split_type = pane
            .split_type
            .as_ref()
            .ok_or_else(|| OrchflowError::LayoutError {
                operation: "recalculate_bounds".to_string(),
                reason: "Split type not set".to_string(),
            })?;
        let percent = pane.split_percent.unwrap_or(50);

        // Calculate new bounds
        let (bounds1, bounds2) = match split_type {
            SplitType::Horizontal => {
                let split_x = pane.bounds.x + (pane.bounds.width * percent as u16 / 100);
                (
                    PaneBounds {
                        x: pane.bounds.x,
                        y: pane.bounds.y,
                        width: pane.bounds.width * percent as u16 / 100,
                        height: pane.bounds.height,
                    },
                    PaneBounds {
                        x: split_x,
                        y: pane.bounds.y,
                        width: pane.bounds.width * (100 - percent as u16) / 100,
                        height: pane.bounds.height,
                    },
                )
            }
            SplitType::Vertical => {
                let split_y = pane.bounds.y + (pane.bounds.height * percent as u16 / 100);
                (
                    PaneBounds {
                        x: pane.bounds.x,
                        y: pane.bounds.y,
                        width: pane.bounds.width,
                        height: pane.bounds.height * percent as u16 / 100,
                    },
                    PaneBounds {
                        x: pane.bounds.x,
                        y: split_y,
                        width: pane.bounds.width,
                        height: pane.bounds.height * (100 - percent as u16) / 100,
                    },
                )
            }
        };

        // Update children bounds
        if let Some(child1) = self.panes.get_mut(&pane.children[0]) {
            child1.bounds = bounds1;
        }
        if let Some(child2) = self.panes.get_mut(&pane.children[1]) {
            child2.bounds = bounds2;
        }

        // Recursively update children's children
        for child_id in &pane.children {
            self.recalculate_bounds(child_id)?;
        }

        Ok(())
    }

    pub fn close_pane(&mut self, pane_id: &str) -> Result<()> {
        let pane = self
            .panes
            .get(pane_id)
            .ok_or_else(|| OrchflowError::pane_not_found(pane_id))?
            .clone();

        // Can't close root pane
        if pane.parent_id.is_none() {
            return Err(OrchflowError::PaneCloseError {
                reason: "Cannot close root pane".to_string(),
            });
        }

        let parent_id = pane.parent_id.unwrap();
        let parent = self
            .panes
            .get(&parent_id)
            .ok_or_else(|| OrchflowError::pane_not_found(&parent_id))?
            .clone();

        // Find sibling
        let sibling_id = parent
            .children
            .iter()
            .find(|&id| id != pane_id)
            .ok_or_else(|| OrchflowError::LayoutError {
                operation: "close_pane".to_string(),
                reason: "Sibling not found".to_string(),
            })?
            .clone();

        let sibling = self
            .panes
            .get(&sibling_id)
            .ok_or_else(|| OrchflowError::pane_not_found(&sibling_id))?
            .clone();

        // Remove the pane and its sibling
        self.panes.remove(pane_id);
        self.panes.remove(&sibling_id);

        // Update parent to take sibling's properties
        if let Some(parent_pane) = self.panes.get_mut(&parent_id) {
            parent_pane.split_type = sibling.split_type;
            parent_pane.split_percent = sibling.split_percent;
            parent_pane.pane_id = sibling.pane_id;
            parent_pane.children = sibling.children.clone();

            // Update children's parent references
            for child_id in &sibling.children {
                if let Some(child) = self.panes.get_mut(child_id) {
                    child.parent_id = Some(parent_id.clone());
                }
            }
        }

        Ok(())
    }
}
