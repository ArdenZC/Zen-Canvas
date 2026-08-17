//! Bounded local handoff only; WorkScheduler remains resource admission authority.

use super::super::contracts::WorkClass;
use super::{
    cache::GenerationKey,
    lock,
    service::{run_generation, GenerationSeed, ThumbnailServiceInner},
    types::ThumbnailError,
};
use std::{
    collections::VecDeque,
    sync::{Arc, Condvar, Mutex, Weak},
    thread::{self, JoinHandle},
    time::{Duration, Instant},
};

const RETRY_HANDOFF_DELAY: Duration = Duration::from_millis(10);
// This bounds local handoff preference only. WorkScheduler still owns all
// resource admission and class ordering once a generation reaches it.
const HIGH_PRIORITY_HANDOFF_BUDGET: usize = 2;

struct ThumbnailWorkItem {
    inner: Weak<ThumbnailServiceInner>,
    key: GenerationKey,
    seed: GenerationSeed,
    retry_after: Option<Instant>,
}

struct ThumbnailDispatchState {
    queue: VecDeque<ThumbnailWorkItem>,
    outstanding: usize,
    high_priority_handoffs_since_background: usize,
    closed: bool,
}

pub(super) struct ThumbnailDispatch {
    state: Arc<(Mutex<ThumbnailDispatchState>, Condvar)>,
    max_outstanding: usize,
    workers: Vec<JoinHandle<()>>,
}

impl ThumbnailDispatch {
    pub(super) fn new(worker_count: usize, queue_capacity: usize) -> Self {
        let state = Arc::new((
            Mutex::new(ThumbnailDispatchState {
                queue: VecDeque::new(),
                outstanding: 0,
                high_priority_handoffs_since_background: 0,
                closed: false,
            }),
            Condvar::new(),
        ));
        let mut workers = Vec::with_capacity(worker_count);
        for index in 0..worker_count {
            let state = Arc::clone(&state);
            let name = format!("thumbnail-worker-{index}");
            let worker = thread::Builder::new()
                .name(name)
                .spawn(move || loop {
                    let work = next_work(&state);
                    let Some(work) = work else {
                        break;
                    };
                    if let Some(inner) = work.inner.upgrade() {
                        #[cfg(test)]
                        if work.seed.effective_work_class() == WorkClass::Interactive {
                            inner
                                .interactive_queued
                                .store(true, std::sync::atomic::Ordering::Release);
                        }
                        run_generation(inner, work.key, work.seed);
                    }
                })
                .expect("thumbnail worker must start");
            workers.push(worker);
        }
        Self {
            state,
            max_outstanding: worker_count.saturating_add(queue_capacity),
            workers,
        }
    }

    pub(super) fn submit(
        &self,
        inner: Weak<ThumbnailServiceInner>,
        key: GenerationKey,
        seed: GenerationSeed,
    ) -> Result<(), ThumbnailError> {
        let (queue, changed) = &*self.state;
        let mut state = lock(queue);
        if state.closed {
            return Err(ThumbnailError::SchedulerUnavailable);
        }
        if state.outstanding >= self.max_outstanding {
            return Err(ThumbnailError::SchedulerBackpressure);
        }
        state.outstanding += 1;
        state.queue.push_back(ThumbnailWorkItem {
            inner,
            key,
            seed,
            retry_after: None,
        });
        changed.notify_one();
        Ok(())
    }

    pub(super) fn resubmit(
        &self,
        inner: Weak<ThumbnailServiceInner>,
        key: GenerationKey,
        seed: GenerationSeed,
    ) -> Result<(), ThumbnailError> {
        let (queue, changed) = &*self.state;
        let mut state = lock(queue);
        if state.closed {
            return Err(ThumbnailError::SchedulerUnavailable);
        }
        if state.queue.len() >= self.max_outstanding {
            return Err(ThumbnailError::SchedulerBackpressure);
        }
        state.queue.push_back(ThumbnailWorkItem {
            inner,
            key,
            seed,
            retry_after: Some(Instant::now() + RETRY_HANDOFF_DELAY),
        });
        changed.notify_one();
        Ok(())
    }

    pub(super) fn complete(&self) {
        let (queue, changed) = &*self.state;
        let mut state = lock(queue);
        state.outstanding = state.outstanding.saturating_sub(1);
        changed.notify_all();
    }
}

fn next_work(state: &Arc<(Mutex<ThumbnailDispatchState>, Condvar)>) -> Option<ThumbnailWorkItem> {
    let (queue, changed) = &**state;
    let mut state = lock(queue);
    loop {
        if state.closed && state.queue.is_empty() {
            return None;
        }
        if state.queue.is_empty() {
            state = changed
                .wait(state)
                .unwrap_or_else(std::sync::PoisonError::into_inner);
            continue;
        }
        let index = handoff_index(&state);
        if let Some(retry_after) = state.queue[index].retry_after {
            let now = Instant::now();
            if now < retry_after {
                // The generation remains counted as outstanding while this
                // bounded handoff waits for its next admission attempt; no
                // worker loops waiting for a local queue slot.
                state = changed
                    .wait_timeout(state, retry_after.saturating_duration_since(now))
                    .unwrap_or_else(std::sync::PoisonError::into_inner)
                    .0;
                continue;
            }
        }
        let work = state
            .queue
            .remove(index)
            .expect("selected thumbnail handoff must remain queued");
        if work.seed.effective_work_class() == WorkClass::Background {
            state.high_priority_handoffs_since_background = 0;
        } else if state
            .queue
            .iter()
            .any(|queued| queued.seed.effective_work_class() == WorkClass::Background)
        {
            state.high_priority_handoffs_since_background = state
                .high_priority_handoffs_since_background
                .saturating_add(1);
        } else {
            state.high_priority_handoffs_since_background = 0;
        }
        return Some(work);
    }
}

fn handoff_index(state: &ThumbnailDispatchState) -> usize {
    let high_priority = state
        .queue
        .iter()
        .position(|work| work.seed.effective_work_class() != WorkClass::Background);
    let background = state
        .queue
        .iter()
        .position(|work| work.seed.effective_work_class() == WorkClass::Background);
    if state.high_priority_handoffs_since_background >= HIGH_PRIORITY_HANDOFF_BUDGET {
        background.or(high_priority)
    } else {
        high_priority.or(background)
    }
    .expect("thumbnail handoff queue must contain a selected item")
}

impl Drop for ThumbnailDispatch {
    fn drop(&mut self) {
        let (_, changed) = &*self.state;
        {
            let (queue, _) = &*self.state;
            lock(queue).closed = true;
        }
        changed.notify_all();
        for worker in self.workers.drain(..) {
            let _ = worker.join();
        }
    }
}
