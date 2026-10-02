//! One process-local deadline/wake coordinator. WorkScheduler owns admission.
use crate::{
    db::{queries::current_unix_seconds, Database},
    file_workspace::WorkClass,
    scheduler::{AcquireError, CancellationToken, ResourceHints, WorkRequest, WorkScheduler},
};
use std::sync::{Arc, Condvar, Mutex, Weak};
use std::thread::JoinHandle;
use std::time::Duration;

#[derive(Default)]
struct SignalState {
    epoch: u64,
    paused: bool,
    stopping: bool,
    admission: Option<CancellationToken>,
}
#[derive(Default)]
pub(crate) struct AutomationWake {
    state: Mutex<SignalState>,
    changed: Condvar,
}
impl AutomationWake {
    pub(crate) fn wake(&self) {
        let mut state = self
            .state
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        state.epoch = state.epoch.wrapping_add(1);
        if let Some(token) = &state.admission {
            token.cancel();
        }
        self.changed.notify_all();
    }
    pub(crate) fn set_paused(&self, paused: bool) {
        {
            let mut state = self
                .state
                .lock()
                .unwrap_or_else(std::sync::PoisonError::into_inner);
            state.paused = paused;
        }
        self.wake();
    }
    fn wait(&self, epoch: u64, deadline: Option<i64>) {
        let state = self
            .state
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        if state.epoch != epoch || state.stopping {
            return;
        }
        if let Some(deadline) = deadline {
            let duration = Duration::from_millis(
                deadline
                    .saturating_sub(jiff::Timestamp::now().as_millisecond())
                    .max(0) as u64,
            );
            drop(
                self.changed
                    .wait_timeout_while(state, duration, |s| s.epoch == epoch && !s.stopping),
            );
        } else {
            drop(
                self.changed
                    .wait_while(state, |s| s.epoch == epoch && !s.stopping),
            );
        }
    }
}

pub struct AutomationTriggerCoordinator {
    signal: Arc<AutomationWake>,
    worker: Mutex<Option<JoinHandle<()>>>,
    #[cfg(target_os = "windows")]
    resume: Mutex<Option<crate::platform::windows::automation_resume::AutomationResumeWake>>,
}
impl AutomationTriggerCoordinator {
    pub fn start(
        db: Database,
        on_receipt: impl Fn() + Send + Sync + 'static,
    ) -> Result<Self, String> {
        Self::start_with_scheduler(db, WorkScheduler::global(), Arc::new(on_receipt))
    }
    pub(crate) fn start_with_scheduler(
        db: Database,
        scheduler: Arc<WorkScheduler>,
        on_receipt: Arc<dyn Fn() + Send + Sync>,
    ) -> Result<Self, String> {
        let signal = Arc::new(AutomationWake::default());
        db.install_automation_wake(Arc::downgrade(&signal));
        #[cfg(target_os = "windows")]
        let resume = crate::platform::windows::automation_resume::AutomationResumeWake::start(
            Arc::clone(&signal),
        )?;
        let wake = Arc::clone(&signal);
        let worker = std::thread::Builder::new()
            .name("automation-trigger-coordinator".into())
            .spawn(move || loop {
                let (epoch, paused, stopping) = {
                    let s = wake
                        .state
                        .lock()
                        .unwrap_or_else(std::sync::PoisonError::into_inner);
                    (s.epoch, s.paused, s.stopping)
                };
                if stopping {
                    break;
                }
                if paused {
                    wake.wait(epoch, None);
                    continue;
                }
                let (cause, deadline) =
                    match db.select_automation_trigger_at(jiff::Timestamp::now()) {
                        Ok(value) => value,
                        Err(error) => {
                            eprintln!("Automation trigger recovery deferred: {error}");
                            wake.wait(epoch, None);
                            continue;
                        }
                    };
                let Some(cause) = cause else {
                    wake.wait(epoch, deadline);
                    continue;
                };
                let cancellation = CancellationToken::new();
                {
                    let mut s = wake
                        .state
                        .lock()
                        .unwrap_or_else(std::sync::PoisonError::into_inner);
                    if s.epoch != epoch || s.paused || s.stopping {
                        continue;
                    }
                    s.admission = Some(cancellation.clone());
                }
                let request = WorkRequest::new(
                    &cause.request_key,
                    WorkClass::Background,
                    ResourceHints {
                        cpu: 1,
                        io: 1,
                        open_handles: 1,
                        ..ResourceHints::empty()
                    },
                )
                .with_cancellation(cancellation.clone());
                let lease = match scheduler.try_acquire(request.clone()) {
                    Err(
                        AcquireError::PolicyDenied
                        | AcquireError::WouldBlock
                        | AcquireError::QueueFull,
                    ) => {
                        let _ = db.defer_automation_trigger(&cause);
                        on_receipt();
                        scheduler.acquire_with_backpressure(request)
                    }
                    other => other,
                };
                let mut wait_for_hint = false;
                match lease {
                    Ok(_lease) if !cancellation.is_cancelled() => {
                        match db.run_automation_intent_automatic(&cause) {
                            Ok(_) => {
                                if let Err(error) =
                                    db.finish_automation_trigger(&cause, current_unix_seconds())
                                {
                                    eprintln!("Automation trigger cursor deferred: {error}");
                                    wait_for_hint = true;
                                }
                                on_receipt();
                            }
                            Err(error) => {
                                eprintln!("Automation trigger delivery deferred: {error}");
                                wait_for_hint = true;
                            }
                        }
                    }
                    Err(AcquireError::Cancelled) | Ok(_) => {}
                    Err(error) => {
                        eprintln!("Automation trigger admission deferred: {error}");
                        wait_for_hint = true;
                    }
                }
                wake.state
                    .lock()
                    .unwrap_or_else(std::sync::PoisonError::into_inner)
                    .admission = None;
                if wait_for_hint {
                    wake.wait(epoch, None);
                }
            })
            .map_err(|e| e.to_string())?;
        Ok(Self {
            signal,
            worker: Mutex::new(Some(worker)),
            #[cfg(target_os = "windows")]
            resume: Mutex::new(Some(resume)),
        })
    }
    pub fn pause(&self) {
        self.signal.set_paused(true);
    }
    pub fn resume(&self) {
        self.signal.set_paused(false);
    }
    pub fn shutdown(&self) {
        {
            self.signal
                .state
                .lock()
                .unwrap_or_else(std::sync::PoisonError::into_inner)
                .stopping = true;
        }
        self.signal.wake();
        #[cfg(target_os = "windows")]
        {
            self.resume
                .lock()
                .unwrap_or_else(std::sync::PoisonError::into_inner)
                .take();
        }
        if let Some(worker) = self
            .worker
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
            .take()
        {
            let _ = worker.join();
        }
    }
}
impl Drop for AutomationTriggerCoordinator {
    fn drop(&mut self) {
        self.shutdown();
    }
}

impl Database {
    pub(crate) fn install_automation_wake(&self, wake: Weak<AutomationWake>) {
        *self
            .automation_wake
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner) = Some(wake);
    }
    pub(crate) fn wake_automation_triggers(&self) {
        let wake = self
            .automation_wake
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
            .as_ref()
            .and_then(Weak::upgrade);
        if let Some(wake) = wake {
            wake.wake();
        }
    }
}
