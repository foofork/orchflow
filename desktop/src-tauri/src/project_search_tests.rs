#[cfg(test)]
mod tests {
    use crate::error::Result;
    use crate::project_search::{
        FileSearchResult, ProjectSearch, ReplaceResult, SearchMatch, SearchOptions,
    };
    use tempfile::TempDir;
    use tokio::fs;

    async fn create_test_files(dir: &TempDir) -> Result<()> {
        // Create test file structure
        let src_dir = dir.path().join("src");
        fs::create_dir(&src_dir).await?;

        // Test file 1: main.rs
        fs::write(
            src_dir.join("main.rs"),
            r#"fn main() {
    println!("Hello, world!");
    let foo = "test string";
    println!("foo: {}", foo);
}

#[test]
fn test_foo() {
    assert_eq!(foo(), "test");
}
"#,
        )
        .await?;

        // Test file 2: lib.rs
        fs::write(
            src_dir.join("lib.rs"),
            r#"pub fn foo() -> &'static str {
    "test"
}

pub fn bar() -> i32 {
    42
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_bar() {
        assert_eq!(bar(), 42);
    }
}
"#,
        )
        .await?;

        // Test file 3: config.json
        fs::write(
            dir.path().join("config.json"),
            r#"{
    "name": "test project",
    "version": "1.0.0",
    "foo": {
        "bar": "baz"
    }
}
"#,
        )
        .await?;

        // Binary file (should be skipped)
        fs::write(
            dir.path().join("binary.dat"),
            vec![0xFF, 0xFE, 0x00, 0x01, 0x02, 0x03],
        )
        .await?;

        // Hidden file
        fs::write(dir.path().join(".gitignore"), "target/\n*.log\n").await?;

        Ok(())
    }

    #[tokio::test]
    async fn test_simple_search() -> Result<()> {
        let temp_dir = TempDir::new().unwrap();
        create_test_files(&temp_dir).await?;

        let search = ProjectSearch::new(temp_dir.path().to_path_buf());

        // Search for "foo"
        let results = search.search_simple("foo", false).await?;

        assert!(results.len() >= 2); // Should find in main.rs and lib.rs

        let total_matches: usize = results.iter().map(|r| r.total_matches).sum();
        assert!(total_matches >= 4); // Multiple occurrences of "foo"

        Ok(())
    }

    #[tokio::test]
    async fn test_case_sensitive_search() -> Result<()> {
        let temp_dir = TempDir::new().unwrap();
        create_test_files(&temp_dir).await?;

        let search = ProjectSearch::new(temp_dir.path().to_path_buf());

        // Case sensitive search for "Foo" (should find less)
        let results_sensitive = search.search_simple("Foo", true).await?;

        // Case insensitive search for "foo" (should find more)
        let results_insensitive = search.search_simple("foo", false).await?;

        assert!(results_insensitive.len() >= results_sensitive.len());

        Ok(())
    }

    #[tokio::test]
    async fn test_regex_search() -> Result<()> {
        let temp_dir = TempDir::new().unwrap();
        create_test_files(&temp_dir).await?;

        let search = ProjectSearch::new(temp_dir.path().to_path_buf());

        let options = SearchOptions {
            pattern: r"fn\s+\w+\(\)".to_string(),
            regex: true,
            ..Default::default()
        };

        let results = search.search(options).await?;

        // Should find function definitions
        assert!(results.len() >= 2);

        Ok(())
    }

    #[tokio::test]
    async fn test_whole_word_search() -> Result<()> {
        let temp_dir = TempDir::new().unwrap();
        create_test_files(&temp_dir).await?;

        let search = ProjectSearch::new(temp_dir.path().to_path_buf());

        let options = SearchOptions {
            pattern: "test".to_string(),
            whole_word: true,
            ..Default::default()
        };

        let results = search.search(options).await?;

        // Should only find complete word "test", not "tests"
        for result in &results {
            for match_item in &result.matches {
                assert!(!match_item.line_text.contains("tests"));
            }
        }

        Ok(())
    }

    #[tokio::test]
    async fn test_include_patterns() -> Result<()> {
        let temp_dir = TempDir::new().unwrap();
        create_test_files(&temp_dir).await?;

        let search = ProjectSearch::new(temp_dir.path().to_path_buf());

        let options = SearchOptions {
            pattern: "foo".to_string(),
            include_patterns: vec!["*.rs".to_string()],
            ..Default::default()
        };

        let results = search.search(options).await?;

        // Should only find in .rs files
        for result in &results {
            assert!(result.path.extension().unwrap() == "rs");
        }

        Ok(())
    }

    #[tokio::test]
    async fn test_exclude_patterns() -> Result<()> {
        let temp_dir = TempDir::new().unwrap();
        create_test_files(&temp_dir).await?;

        let search = ProjectSearch::new(temp_dir.path().to_path_buf());

        let options = SearchOptions {
            pattern: "test".to_string(),
            exclude_patterns: vec!["*.rs".to_string()],
            ..Default::default()
        };

        let results = search.search(options).await?;

        // Should not find in .rs files
        for result in &results {
            assert!(result.path.extension().unwrap() != "rs");
        }

        Ok(())
    }

    #[tokio::test]
    async fn test_search_history() -> Result<()> {
        let temp_dir = TempDir::new().unwrap();
        create_test_files(&temp_dir).await?;

        let search = ProjectSearch::new(temp_dir.path().to_path_buf());

        // Perform multiple searches
        search.search_simple("foo", false).await?;
        search.search_simple("bar", false).await?;
        search.search_simple("test", false).await?;

        let history = search.get_history(2).await;

        assert_eq!(history.len(), 2);
        assert_eq!(history[0], "test"); // Most recent first
        assert_eq!(history[1], "bar");

        Ok(())
    }

    #[tokio::test]
    async fn test_saved_searches() -> Result<()> {
        let temp_dir = TempDir::new().unwrap();
        let search = ProjectSearch::new(temp_dir.path().to_path_buf());

        let options = SearchOptions {
            pattern: "test pattern".to_string(),
            case_sensitive: true,
            whole_word: true,
            regex: false,
            ..Default::default()
        };

        // Save search
        search
            .save_search("my_search".to_string(), options.clone())
            .await;

        // Load search
        let loaded = search.load_search("my_search").await;
        assert!(loaded.is_some());

        let loaded_options = loaded.unwrap();
        assert_eq!(loaded_options.pattern, "test pattern");
        assert_eq!(loaded_options.case_sensitive, true);
        assert_eq!(loaded_options.whole_word, true);

        Ok(())
    }

    #[tokio::test]
    async fn test_search_cache() -> Result<()> {
        let temp_dir = TempDir::new().unwrap();
        create_test_files(&temp_dir).await?;

        let search = ProjectSearch::new(temp_dir.path().to_path_buf());

        // First search
        let results1 = search.search_simple("foo", false).await?;

        // Check cache
        let cached = search.get_cached_results("foo").await;
        assert!(cached.is_some());

        // Clear cache
        search.clear_cache().await;

        // Check cache is cleared
        let cached_after = search.get_cached_results("foo").await;
        assert!(cached_after.is_none());

        Ok(())
    }

    #[tokio::test]
    async fn test_replace_dry_run() -> Result<()> {
        let temp_dir = TempDir::new().unwrap();
        create_test_files(&temp_dir).await?;

        let search = ProjectSearch::new(temp_dir.path().to_path_buf());

        let options = SearchOptions {
            pattern: "foo".to_string(),
            ..Default::default()
        };

        // Dry run replace
        let replace_results = search.replace_in_files(options, "bar", true).await?;

        assert!(!replace_results.is_empty());

        // Verify files weren't modified
        let content = fs::read_to_string(temp_dir.path().join("src/main.rs")).await?;
        assert!(content.contains("foo"));
        assert!(!content.contains("bar"));

        // Check replacement count
        let total_replacements: usize = replace_results.iter().map(|r| r.replacements).sum();
        assert!(total_replacements > 0);

        Ok(())
    }

    #[tokio::test]
    async fn test_replace_actual() -> Result<()> {
        let temp_dir = TempDir::new().unwrap();
        create_test_files(&temp_dir).await?;

        let search = ProjectSearch::new(temp_dir.path().to_path_buf());

        let options = SearchOptions {
            pattern: "foo".to_string(),
            include_patterns: vec!["*.rs".to_string()],
            ..Default::default()
        };

        // Actual replace
        let replace_results = search
            .replace_in_files(options, "replaced_foo", false)
            .await?;

        assert!(!replace_results.is_empty());

        // Verify files were modified
        let content = fs::read_to_string(temp_dir.path().join("src/main.rs")).await?;
        assert!(!content.contains("foo ="));
        assert!(content.contains("replaced_foo"));

        // Verify all replacements succeeded
        for result in &replace_results {
            assert!(result.success);
            assert!(result.error.is_none());
        }

        Ok(())
    }

    #[tokio::test]
    async fn test_replace_case_insensitive() -> Result<()> {
        let temp_dir = TempDir::new().unwrap();

        // Create test file with mixed case
        fs::write(temp_dir.path().join("test.txt"), "FOO foo Foo FoO").await?;

        let search = ProjectSearch::new(temp_dir.path().to_path_buf());

        let options = SearchOptions {
            pattern: "foo".to_string(),
            case_sensitive: false,
            ..Default::default()
        };

        // Replace all case variations
        search.replace_in_files(options, "bar", false).await?;

        let content = fs::read_to_string(temp_dir.path().join("test.txt")).await?;
        assert_eq!(content, "bar bar bar bar");

        Ok(())
    }

    #[tokio::test]
    async fn test_replace_whole_word() -> Result<()> {
        let temp_dir = TempDir::new().unwrap();

        // Create test file
        fs::write(
            temp_dir.path().join("test.txt"),
            "foo foobar barfoo foo_bar _foo",
        )
        .await?;

        let search = ProjectSearch::new(temp_dir.path().to_path_buf());

        let options = SearchOptions {
            pattern: "foo".to_string(),
            whole_word: true,
            ..Default::default()
        };

        // Replace only whole words
        search.replace_in_files(options, "replaced", false).await?;

        let content = fs::read_to_string(temp_dir.path().join("test.txt")).await?;
        assert!(content.contains("replaced foobar"));
        assert!(content.contains("barfoo"));
        assert!(!content.contains(" foo "));

        Ok(())
    }

    #[tokio::test]
    async fn test_replace_regex() -> Result<()> {
        let temp_dir = TempDir::new().unwrap();

        // Create test file
        fs::write(
            temp_dir.path().join("test.rs"),
            r#"let x = 123;
let y = 456;
let z = 789;"#,
        )
        .await?;

        let search = ProjectSearch::new(temp_dir.path().to_path_buf());

        let options = SearchOptions {
            pattern: r"let (\w+) = (\d+);".to_string(),
            regex: true,
            ..Default::default()
        };

        // Replace with regex (note: our implementation doesn't support capture groups yet)
        search
            .replace_in_files(options, "const VAR = NUM;", false)
            .await?;

        let content = fs::read_to_string(temp_dir.path().join("test.rs")).await?;
        assert!(content.contains("const VAR = NUM;"));

        Ok(())
    }

    #[tokio::test]
    async fn test_binary_file_skip() -> Result<()> {
        let temp_dir = TempDir::new().unwrap();

        // Create binary file
        fs::write(
            temp_dir.path().join("binary.dat"),
            vec![0xFF, 0xFE, 0x00, 0x01, 0x02, 0x03],
        )
        .await?;

        let search = ProjectSearch::new(temp_dir.path().to_path_buf());

        // Search shouldn't find anything in binary files
        let results = search.search_simple("test", false).await?;

        for result in &results {
            assert!(result.path.file_name().unwrap() != "binary.dat");
        }

        Ok(())
    }

    #[tokio::test]
    async fn test_max_file_size() -> Result<()> {
        let temp_dir = TempDir::new().unwrap();

        // Create large file
        let large_content = "test ".repeat(1_000_000); // ~5MB
        fs::write(temp_dir.path().join("large.txt"), &large_content).await?;

        // Create small file
        fs::write(temp_dir.path().join("small.txt"), "test content").await?;

        let search = ProjectSearch::new(temp_dir.path().to_path_buf());

        let options = SearchOptions {
            pattern: "test".to_string(),
            max_file_size: Some(1024 * 1024), // 1MB limit
            ..Default::default()
        };

        let results = search.search(options).await?;

        // Should only find in small file
        assert_eq!(results.len(), 1);
        assert!(results[0].path.file_name().unwrap() == "small.txt");

        Ok(())
    }

    #[tokio::test]
    async fn test_search_hidden_files() -> Result<()> {
        let temp_dir = TempDir::new().unwrap();
        create_test_files(&temp_dir).await?;

        let search = ProjectSearch::new(temp_dir.path().to_path_buf());

        // Search without hidden files
        let options_no_hidden = SearchOptions {
            pattern: "target".to_string(),
            search_hidden: false,
            ..Default::default()
        };

        let results_no_hidden = search.search(options_no_hidden).await?;

        // Search with hidden files
        let options_hidden = SearchOptions {
            pattern: "target".to_string(),
            search_hidden: true,
            ..Default::default()
        };

        let results_hidden = search.search(options_hidden).await?;

        // Should find more results with hidden files enabled
        assert!(results_hidden.len() >= results_no_hidden.len());

        Ok(())
    }

    #[tokio::test]
    async fn test_context_lines() -> Result<()> {
        let temp_dir = TempDir::new().unwrap();

        // Create file with multiple lines
        fs::write(
            temp_dir.path().join("test.txt"),
            "line 1\nline 2\nline 3 test\nline 4\nline 5",
        )
        .await?;

        let search = ProjectSearch::new(temp_dir.path().to_path_buf());

        let options = SearchOptions {
            pattern: "test".to_string(),
            context_lines: 2,
            ..Default::default()
        };

        let results = search.search(options).await?;

        // Note: Context lines are not fully implemented in our collector
        // This test is a placeholder for when they are
        assert!(!results.is_empty());

        Ok(())
    }

    #[tokio::test]
    async fn test_concurrent_searches() -> Result<()> {
        let temp_dir = TempDir::new().unwrap();
        create_test_files(&temp_dir).await?;

        let search = ProjectSearch::new(temp_dir.path().to_path_buf());

        // Run multiple searches concurrently
        let search1 = search.search_simple("foo", false);
        let search2 = search.search_simple("bar", false);
        let search3 = search.search_simple("test", false);

        let (results1, results2, results3) = tokio::join!(search1, search2, search3);

        assert!(results1?.len() > 0);
        assert!(results2?.len() > 0);
        assert!(results3?.len() > 0);

        Ok(())
    }
}

#[cfg(all(test, not(target_os = "windows")))]
mod integration_tests {
    use super::*;
    use crate::error::Result;
    use crate::project_search::{ProjectSearch, SearchOptions};
    use tempfile::TempDir;
    use tokio::fs;

    async fn create_test_files(dir: &TempDir) -> Result<()> {
        // Create test file structure
        let src_dir = dir.path().join("src");
        fs::create_dir(&src_dir).await?;

        // Test file 1: main.rs
        fs::write(
            src_dir.join("main.rs"),
            r#"fn main() {
    println!("Hello, world!");
    let foo = "test string";
    println!("foo: {}", foo);
}

#[test]
fn test_foo() {
    assert_eq!(foo(), "test");
}
"#,
        )
        .await?;

        // Test file 2: lib.rs
        fs::write(
            src_dir.join("lib.rs"),
            r#"pub mod utils;

pub fn foo() -> &'static str {
    "test"
}

pub fn bar(x: i32) -> i32 {
    x * 2
}
"#,
        )
        .await?;

        // Test file 3: test.txt
        fs::write(
            dir.path().join("test.txt"),
            "This is a test file\nwith multiple lines\nfor testing search\n",
        )
        .await?;

        // Test file 4: README.md
        fs::write(
            dir.path().join("README.md"),
            "# Test Project\n\nThis is a test readme with foo mentioned.\n",
        )
        .await?;

        // Create a binary file to test exclusion
        fs::write(dir.path().join("binary.bin"), vec![0xFF, 0xFE, 0x00, 0x01]).await?;

        Ok(())
    }

    #[tokio::test]
    async fn test_symlink_handling() -> Result<()> {
        let temp_dir = TempDir::new().unwrap();
        create_test_files(&temp_dir).await?;

        // Create symlink
        let target = temp_dir.path().join("src/main.rs");
        let link = temp_dir.path().join("link_to_main.rs");
        std::os::unix::fs::symlink(&target, &link)?;

        let search = ProjectSearch::new(temp_dir.path().to_path_buf());

        // Search without following symlinks
        let options_no_follow = SearchOptions {
            pattern: "main".to_string(),
            follow_symlinks: false,
            ..Default::default()
        };

        let results_no_follow = search.search(options_no_follow).await?;

        // Search with following symlinks
        let options_follow = SearchOptions {
            pattern: "main".to_string(),
            follow_symlinks: true,
            ..Default::default()
        };

        let results_follow = search.search(options_follow).await?;

        // Following symlinks might find more results
        assert!(results_follow.len() >= results_no_follow.len());

        Ok(())
    }
}
