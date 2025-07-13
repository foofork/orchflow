#[cfg(test)]
mod layout_tests {
    use crate::layout::*;

    #[tokio::test]
    async fn test_layout_creation() {
        let session_id = "test-session".to_string();
        let layout = GridLayout::new(session_id.clone());

        assert_eq!(layout.session_id, session_id);
        assert!(layout.root_id.starts_with("pane-"));
        assert_eq!(layout.panes.len(), 1);
        assert!(layout.panes.contains_key(&layout.root_id));
    }

    #[tokio::test]
    async fn test_layout_split_pane() {
        let mut layout = GridLayout::new("test-session".to_string());
        let root_id = layout.root_id.clone();

        // Split the root pane
        let result = layout.split_pane(&root_id, SplitType::Horizontal, 50);
        assert!(result.is_ok());

        let (child1_id, child2_id) = result.unwrap();

        // Should now have 3 panes: original root (now container) + 2 children
        assert_eq!(layout.panes.len(), 3);
        assert!(layout.panes.contains_key(&child1_id));
        assert!(layout.panes.contains_key(&child2_id));

        // Root should now have children
        let root_pane = layout.panes.get(&root_id).unwrap();
        assert_eq!(root_pane.children.len(), 2);
        assert!(root_pane.children.contains(&child1_id));
        assert!(root_pane.children.contains(&child2_id));
    }

    #[tokio::test]
    async fn test_layout_resize() {
        let mut layout = GridLayout::new("test-session".to_string());
        let root_id = layout.root_id.clone();

        // Split the root pane
        let (child1_id, child2_id) = layout
            .split_pane(&root_id, SplitType::Horizontal, 50)
            .unwrap();

        // Resize one of the children
        let result = layout.resize_pane(&child1_id, 70);
        assert!(result.is_ok());

        // Check that bounds were updated
        let child1 = layout.panes.get(&child1_id).unwrap();
        let child2 = layout.panes.get(&child2_id).unwrap();

        // Child1 should have 70% width, child2 should have 30%
        assert_eq!(child1.bounds.width, 70);
        assert_eq!(child2.bounds.width, 30);
    }

    #[tokio::test]
    async fn test_layout_close_pane() {
        let mut layout = GridLayout::new("test-session".to_string());
        let root_id = layout.root_id.clone();

        // Split the root pane
        let (child1_id, child2_id) = layout
            .split_pane(&root_id, SplitType::Horizontal, 50)
            .unwrap();

        // Close one child
        let result = layout.close_pane(&child1_id);
        assert!(result.is_ok());

        // Should have 1 pane left: the root (merged with remaining child)
        assert_eq!(layout.panes.len(), 1);
        assert!(!layout.panes.contains_key(&child1_id));
        assert!(!layout.panes.contains_key(&child2_id));
        assert!(layout.panes.contains_key(&root_id));

        // Root should have no children now (merged back to leaf)
        let root_pane = layout.panes.get(&root_id).unwrap();
        assert_eq!(root_pane.children.len(), 0);
    }

    #[tokio::test]
    async fn test_get_leaf_panes() {
        let mut layout = GridLayout::new("test-session".to_string());
        let root_id = layout.root_id.clone();

        // Initially, root is the only leaf
        let leaves = layout.get_leaf_panes();
        assert_eq!(leaves.len(), 1);
        assert_eq!(leaves[0].id, root_id);

        // Split root
        let (child1_id, child2_id) = layout
            .split_pane(&root_id, SplitType::Horizontal, 50)
            .unwrap();

        // Now children are leaves
        let leaves = layout.get_leaf_panes();
        assert_eq!(leaves.len(), 2);

        let leaf_ids: Vec<&String> = leaves.iter().map(|p| &p.id).collect();
        assert!(leaf_ids.contains(&&child1_id));
        assert!(leaf_ids.contains(&&child2_id));
    }
}
