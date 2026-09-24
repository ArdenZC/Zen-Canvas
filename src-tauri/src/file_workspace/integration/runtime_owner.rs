use super::runtime::FileWorkspaceRuntime;
use crate::{db::Database, platform::macos::quick_look::MacThumbnailService};
use std::{
    path::PathBuf,
    sync::{Arc, Mutex},
};
use tauri::{Runtime, WebviewWindow};

const MAIN_GENERATION_QUERY_KEY: &str = "mainGeneration";

#[derive(Clone)]
pub struct FileWorkspaceRuntimeOwner {
    factory: Arc<dyn Fn() -> Result<FileWorkspaceRuntime, String> + Send + Sync>,
    state: Arc<Mutex<OwnerState>>,
}

enum OwnerState {
    Dormant {
        last_generation: Option<u64>,
    },
    Active {
        generation: u64,
        runtime: Option<FileWorkspaceRuntime>,
    },
    Closing {
        generation: u64,
        runtime: Option<FileWorkspaceRuntime>,
    },
}

impl FileWorkspaceRuntimeOwner {
    pub fn new(
        database: Database,
        legacy_thumbnail_service: MacThumbnailService,
        thumbnail_cache_dir: PathBuf,
        native_preview_root: PathBuf,
    ) -> Self {
        let factory = Arc::new(move || {
            FileWorkspaceRuntime::new_with_native_preview_root(
                database.clone(),
                legacy_thumbnail_service.clone(),
                thumbnail_cache_dir.clone(),
                native_preview_root.clone(),
            )
        });
        Self {
            factory,
            state: Arc::new(Mutex::new(OwnerState::Dormant {
                last_generation: None,
            })),
        }
    }

    pub fn activate_generation(&self, generation: u64) -> Result<(), String> {
        let mut state = self.lock_state()?;
        let last_generation = match &*state {
            OwnerState::Dormant { last_generation } => *last_generation,
            OwnerState::Active { .. } => {
                return Err("file_workspace_generation_already_active".to_string())
            }
            OwnerState::Closing { .. } => {
                return Err("file_workspace_generation_teardown_incomplete".to_string())
            }
        };
        if last_generation.is_some_and(|last| generation <= last) {
            return Err("file_workspace_generation_not_advanced".to_string());
        }
        *state = OwnerState::Active {
            generation,
            runtime: None,
        };
        Ok(())
    }

    pub fn abort_generation(&self, generation: u64) -> Result<(), String> {
        let mut state = self.lock_state()?;
        match &*state {
            OwnerState::Active {
                generation: active,
                runtime: None,
            } if *active == generation => {
                *state = OwnerState::Dormant {
                    last_generation: Some(generation),
                };
                Ok(())
            }
            OwnerState::Active {
                generation: active,
                runtime: Some(_),
            }
            | OwnerState::Closing {
                generation: active, ..
            } if *active == generation => Err("file_workspace_generation_has_runtime".to_string()),
            _ => Err("file_workspace_generation_stale".to_string()),
        }
    }

    pub fn resume_after_window_destroy_failure(&self, generation: u64) -> Result<(), String> {
        let mut state = self.lock_state()?;
        match &*state {
            OwnerState::Dormant {
                last_generation: Some(last),
            } if *last == generation => {
                *state = OwnerState::Active {
                    generation,
                    runtime: None,
                };
                Ok(())
            }
            _ => Err("file_workspace_generation_stale".to_string()),
        }
    }

    pub fn acquire_for_window<R: Runtime>(
        &self,
        window: &WebviewWindow<R>,
    ) -> Result<FileWorkspaceRuntime, String> {
        let generation = main_generation_from_window(window)?;
        self.acquire(generation)
    }

    pub fn current_if_initialized_for_window<R: Runtime>(
        &self,
        window: &WebviewWindow<R>,
    ) -> Result<Option<FileWorkspaceRuntime>, String> {
        let generation = main_generation_from_window(window)?;
        self.current_if_initialized(generation)
    }

    pub fn acquire(&self, generation: u64) -> Result<FileWorkspaceRuntime, String> {
        let mut state = self.lock_state()?;
        match &mut *state {
            OwnerState::Active {
                generation: active,
                runtime,
            } if *active == generation => {
                if runtime.is_none() {
                    *runtime = Some((self.factory)()?);
                }
                runtime
                    .as_ref()
                    .cloned()
                    .ok_or_else(|| "file_workspace_runtime_unavailable".to_string())
            }
            OwnerState::Active { .. } => Err("file_workspace_generation_stale".to_string()),
            OwnerState::Dormant { .. } => {
                Err("file_workspace_main_generation_inactive".to_string())
            }
            OwnerState::Closing { .. } => {
                Err("file_workspace_generation_teardown_in_progress".to_string())
            }
        }
    }

    pub fn current_if_initialized(
        &self,
        generation: u64,
    ) -> Result<Option<FileWorkspaceRuntime>, String> {
        let state = self.lock_state()?;
        match &*state {
            OwnerState::Active {
                generation: active,
                runtime,
            } if *active == generation => Ok(runtime.clone()),
            OwnerState::Active { .. } => Err("file_workspace_generation_stale".to_string()),
            OwnerState::Dormant {
                last_generation: Some(last),
            } if *last == generation => Ok(None),
            OwnerState::Dormant { .. } => {
                Err("file_workspace_main_generation_inactive".to_string())
            }
            OwnerState::Closing {
                generation: closing,
                ..
            } if *closing == generation => Ok(None),
            OwnerState::Closing { .. } => {
                Err("file_workspace_generation_teardown_in_progress".to_string())
            }
        }
    }

    pub fn dispose_generation(&self, generation: u64) -> Result<(), String> {
        let runtime = {
            let mut state = self.lock_state()?;
            match &mut *state {
                OwnerState::Active {
                    generation: active,
                    runtime,
                } if *active == generation => {
                    let current = runtime.take();
                    *state = OwnerState::Closing {
                        generation,
                        runtime: current.clone(),
                    };
                    current
                }
                OwnerState::Closing {
                    generation: active,
                    runtime,
                } if *active == generation => runtime.take(),
                OwnerState::Active { .. } | OwnerState::Closing { .. } => {
                    return Err("file_workspace_generation_stale".to_string())
                }
                OwnerState::Dormant { .. } => {
                    return Err("file_workspace_main_generation_inactive".to_string())
                }
            }
        };

        let result = runtime
            .as_ref()
            .map(FileWorkspaceRuntime::dispose_for_main_teardown)
            .unwrap_or(Ok(()));
        let mut state = self.lock_state()?;
        match result {
            Ok(()) => {
                *state = OwnerState::Dormant {
                    last_generation: Some(generation),
                };
                Ok(())
            }
            Err(error) => {
                *state = OwnerState::Closing {
                    generation,
                    runtime,
                };
                Err(format!("file_workspace_teardown_incomplete:{error}"))
            }
        }
    }

    pub fn current_generation(&self) -> Option<u64> {
        self.state.lock().ok().and_then(|state| match &*state {
            OwnerState::Active { generation, .. } | OwnerState::Closing { generation, .. } => {
                Some(*generation)
            }
            OwnerState::Dormant { .. } => None,
        })
    }

    pub fn is_initialized(&self) -> bool {
        self.state.lock().ok().is_some_and(|state| {
            matches!(
                &*state,
                OwnerState::Active {
                    runtime: Some(_),
                    ..
                } | OwnerState::Closing {
                    runtime: Some(_),
                    ..
                }
            )
        })
    }

    fn lock_state(&self) -> Result<std::sync::MutexGuard<'_, OwnerState>, String> {
        self.state
            .lock()
            .map_err(|_| "file_workspace_owner_unavailable".to_string())
    }
}

pub fn main_generation_from_window<R: Runtime>(window: &WebviewWindow<R>) -> Result<u64, String> {
    if window.label() != crate::window_auth::MAIN_WINDOW_LABEL {
        return Err("main_window_required".to_string());
    }
    window
        .url()
        .map_err(|error| format!("main_window_url_unavailable:{error}"))?
        .query_pairs()
        .find_map(|(key, value)| {
            (key == MAIN_GENERATION_QUERY_KEY).then(|| value.parse::<u64>().ok())
        })
        .flatten()
        .filter(|generation| *generation > 0)
        .ok_or_else(|| "main_window_generation_missing".to_string())
}
