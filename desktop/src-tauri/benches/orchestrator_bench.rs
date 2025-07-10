use criterion::{black_box, criterion_group, criterion_main, Criterion};
use orchflow::{
    orchestrator::{Orchestrator, Action, ShellType},
    mux_backend::create_mux_backend,
    simple_state_store::SimpleStateStore,
};
use std::sync::Arc;
use tokio::runtime::Runtime;
use tauri::test::{mock_builder, MockRuntime};

fn create_test_orchestrator() -> Orchestrator {
    let store = Arc::new(SimpleStateStore::new());
    let app = mock_builder().build(tauri::generate_context!()).unwrap();
    let app_handle = app.handle();
    let mux_backend = create_mux_backend();
    
    Orchestrator::new_with_backend(app_handle, mux_backend, store)
}

fn bench_create_session(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();
    
    c.bench_function("create_session", |b| {
        b.iter(|| {
            let orchestrator = create_test_orchestrator();
            rt.block_on(async {
                let action = Action::CreateSession {
                    name: black_box("bench-session".to_string()),
                };
                orchestrator.execute_action(action).await.unwrap();
            });
        });
    });
}

fn bench_create_pane(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();
    let orchestrator = create_test_orchestrator();
    
    // Create a session first
    let session_id = rt.block_on(async {
        let action = Action::CreateSession {
            name: "bench-session".to_string(),
        };
        let result = orchestrator.execute_action(action).await.unwrap();
        result["id"].as_str().unwrap().to_string()
    });
    
    c.bench_function("create_pane", |b| {
        b.iter(|| {
            rt.block_on(async {
                let action = Action::CreatePane {
                    session_id: black_box(session_id.clone()),
                    pane_type: None,
                    title: Some(black_box("bench-pane".to_string())),
                    command: None,
                    shell: Some(ShellType::Bash),
                };
                orchestrator.execute_action(action).await.unwrap();
            });
        });
    });
}

fn bench_send_input(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();
    let orchestrator = create_test_orchestrator();
    
    // Create session and pane
    let (session_id, pane_id) = rt.block_on(async {
        let session_action = Action::CreateSession {
            name: "bench-session".to_string(),
        };
        let session_result = orchestrator.execute_action(session_action).await.unwrap();
        let session_id = session_result["id"].as_str().unwrap().to_string();
        
        let pane_action = Action::CreatePane {
            session_id: session_id.clone(),
            pane_type: None,
            title: Some("bench-pane".to_string()),
            command: None,
            shell: Some(ShellType::Bash),
        };
        let pane_result = orchestrator.execute_action(pane_action).await.unwrap();
        let pane_id = pane_result["id"].as_str().unwrap().to_string();
        
        (session_id, pane_id)
    });
    
    c.bench_function("send_input", |b| {
        b.iter(|| {
            rt.block_on(async {
                let action = Action::SendInput {
                    pane_id: black_box(pane_id.clone()),
                    data: black_box("echo 'benchmark test'\n".to_string()),
                };
                orchestrator.execute_action(action).await.unwrap();
            });
        });
    });
}

fn bench_list_sessions(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();
    let orchestrator = create_test_orchestrator();
    
    // Create multiple sessions
    rt.block_on(async {
        for i in 0..10 {
            let action = Action::CreateSession {
                name: format!("bench-session-{}", i),
            };
            orchestrator.execute_action(action).await.unwrap();
        }
    });
    
    c.bench_function("list_sessions", |b| {
        b.iter(|| {
            rt.block_on(async {
                let action = Action::ListSessions;
                black_box(orchestrator.execute_action(action).await.unwrap());
            });
        });
    });
}

fn bench_file_operations(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();
    let orchestrator = create_test_orchestrator();
    
    // Benchmark file tree
    c.bench_function("get_file_tree", |b| {
        b.iter(|| {
            rt.block_on(async {
                let action = Action::GetFileTree {
                    max_depth: Some(black_box(3)),
                };
                black_box(orchestrator.execute_action(action).await.unwrap());
            });
        });
    });
    
    // Benchmark project search
    c.bench_function("search_project", |b| {
        b.iter(|| {
            rt.block_on(async {
                let action = Action::SearchProject {
                    query: black_box("TODO".to_string()),
                    case_sensitive: Some(false),
                    whole_word: Some(false),
                    regex: Some(false),
                    file_pattern: None,
                };
                black_box(orchestrator.execute_action(action).await.unwrap());
            });
        });
    });
}

fn bench_plugin_operations(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();
    let orchestrator = create_test_orchestrator();
    
    c.bench_function("list_plugins", |b| {
        b.iter(|| {
            rt.block_on(async {
                let action = Action::ListPlugins;
                black_box(orchestrator.execute_action(action).await.unwrap());
            });
        });
    });
}

fn bench_concurrent_operations(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();
    let orchestrator = Arc::new(create_test_orchestrator());
    
    // Create a session
    let session_id = rt.block_on(async {
        let action = Action::CreateSession {
            name: "bench-session".to_string(),
        };
        let result = orchestrator.execute_action(action).await.unwrap();
        result["id"].as_str().unwrap().to_string()
    });
    
    c.bench_function("concurrent_pane_creation", |b| {
        b.iter(|| {
            rt.block_on(async {
                let mut handles = vec![];
                
                // Create 10 panes concurrently
                for i in 0..10 {
                    let orch = orchestrator.clone();
                    let sid = session_id.clone();
                    let handle = tokio::spawn(async move {
                        let action = Action::CreatePane {
                            session_id: sid,
                            pane_type: None,
                            title: Some(format!("bench-pane-{}", i)),
                            command: None,
                            shell: Some(ShellType::Bash),
                        };
                        orch.execute_action(action).await.unwrap()
                    });
                    handles.push(handle);
                }
                
                // Wait for all to complete
                for handle in handles {
                    black_box(handle.await.unwrap());
                }
            });
        });
    });
}

criterion_group!(
    benches,
    bench_create_session,
    bench_create_pane,
    bench_send_input,
    bench_list_sessions,
    bench_file_operations,
    bench_plugin_operations,
    bench_concurrent_operations
);
criterion_main!(benches);