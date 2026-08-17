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
};

struct ThumbnailWorkItem {
    inner: Weak<ThumbnailServiceInner>,
    key: GenerationKey,
    seed: GenerationSeed,
    order: u64,
}

struct ThumbnailDispatchState {
    queue: VecDeque<ThumbnailWorkItem>,
    next_order: u64,
    closed: bool,
}

pub(super) struct ThumbnailDispatch {
    state: Arc<(Mutex<ThumbnailDispatchState>, Condvar)>,
    queue_capacity: usize,
    workers: Vec<JoinHandle<()>>,
}

impl ThumbnailDispatch {
    pub(super) fn new(worker_count: usize, queue_capacity: usize) -> Self {
        let state = Arc::new((
            Mutex::new(ThumbnailDispatchState {
                queue: VecDeque::new(),
                next_order: 0,
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
                    let work = {
                        let (queue, changed) = &*state;
                        let mut state = lock(queue);
                        loop {
                            if let Some(index) = state
                                .queue
                                .iter()
                                .enumerate()
                                .min_by_key(|(_, work)| {
                                    (
                                        work_class_priority(work.seed.request.work_class),
                                        work.order,
                                    )
                                })
                                .map(|(index, _)| index)
                            {
                                break state.queue.remove(index);
                            }
                            if state.closed {
                                break None;
                            }
                            state = changed
                                .wait(state)
                                .unwrap_or_else(std::sync::PoisonError::into_inner);
                        }
                    };
                    let Some(work) = work else {
                        break;
                    };
                    if let Some(inner) = work.inner.upgrade() {
                        run_generation(inner, work.key, work.seed);
                    }
                })
                .expect("thumbnail worker must start");
            workers.push(worker);
        }
        Self {
            state,
            queue_capacity,
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
        if state.queue.len() >= self.queue_capacity {
            return Err(ThumbnailError::SchedulerBackpressure);
        }
        state.next_order = state.next_order.wrapping_add(1).max(1);
        let order = state.next_order;
        state.queue.push_back(ThumbnailWorkItem {
            inner,
            key,
            seed,
            order,
        });
        changed.notify_one();
        Ok(())
    }
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

fn work_class_priority(class: WorkClass) -> u8 {
    match class {
        WorkClass::Foreground => 0,
        WorkClass::Interactive => 1,
        WorkClass::Background => 2,
    }
}
