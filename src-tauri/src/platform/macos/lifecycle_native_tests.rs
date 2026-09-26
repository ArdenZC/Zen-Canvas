//! Native CFRunLoop + NotificationCenter production-path contracts. Timeouts
//! here bound test hangs/observe idle; the production worker has no timer.
use super::*;
use std::sync::{atomic::AtomicUsize, mpsc};
use std::time::{Duration, Instant};

type WaitingProbe = Box<dyn Fn() -> bool + Send>;

struct Harness {
    controller: MacLifecycleController,
    probe: mpsc::Receiver<WaitingProbe>,
    done: mpsc::Receiver<()>,
    cleanups: Arc<AtomicUsize>,
    callbacks: Arc<AtomicUsize>,
}

fn start(mode: &'static str) -> Harness {
    let controller = MacLifecycleController {
        state: Arc::new(Mutex::new(MacLifecycleSnapshot {
            state: MacLifecycleState::Active,
            last_error: None,
        })),
        stopped: Arc::new(AtomicBool::new(false)),
        stop_signal: Arc::new(NativeRunLoopStopSignal::default()),
        worker: Arc::new(Mutex::new(None)),
    };
    let cleanups = Arc::new(AtomicUsize::new(0));
    let observed_cleanups = cleanups.clone();
    let callbacks = Arc::new(AtomicUsize::new(0));
    let observed_callbacks = callbacks.clone();
    let state = controller.state.clone();
    let stopped = controller.stopped.clone();
    let signal = controller.stop_signal.clone();
    let (probe_tx, probe) = mpsc::channel::<WaitingProbe>();
    let (done_tx, done) = mpsc::channel();
    let worker = thread::spawn(move || {
        objc2::rc::autoreleasepool(|_| {
            let callback: Arc<dyn Fn(MacLifecycleEvent) -> Result<(), String> + Send + Sync> =
                Arc::new(move |_| {
                    observed_callbacks.fetch_add(1, Ordering::SeqCst);
                    Ok(())
                });
            run_workspace_observer(&state, &stopped, &signal, &callback, &|stage, run_loop| {
                if stage == "cleaned" {
                    observed_cleanups.fetch_add(1, Ordering::SeqCst);
                }
                if stage == "installed" {
                    probe_tx
                        .send(Box::new(run_loop.unwrap().waiting_probe()))
                        .unwrap();
                }
                if stage == mode {
                    stopped.store(true, Ordering::Release);
                    signal.request_stop();
                    signal.request_stop();
                }
                if mode == "unexpected" && stage == "before_run" {
                    // Exercise real native return without a controller stop.
                    run_loop.unwrap().stop_action()();
                }
            });
        });
        done_tx.send(()).unwrap();
    });
    *controller.worker.lock().unwrap() = Some(worker);
    Harness {
        controller,
        probe,
        done,
        cleanups,
        callbacks,
    }
}

#[test]
fn native_lifecycle_stop_before_install_after_install_and_before_run_join() {
    for stage in ["registered", "installed", "before_run"] {
        let harness = start(stage);
        harness
            .done
            .recv_timeout(Duration::from_secs(10))
            .expect(stage);
        harness.controller.stop();
        harness.controller.stop();
        assert_eq!(harness.cleanups.load(Ordering::SeqCst), 1, "{stage}");
        assert_eq!(harness.controller.snapshot().last_error, None);
    }
}

#[test]
fn native_lifecycle_idle_worker_blocks_until_stop_or_drop() {
    for use_drop in [false, true] {
        let harness = start("idle");
        let probe = harness.probe.recv_timeout(Duration::from_secs(10)).unwrap();
        let deadline = Instant::now() + Duration::from_secs(10);
        while !probe() {
            assert!(Instant::now() < deadline, "native loop never blocked");
            assert!(matches!(
                harness.done.try_recv(),
                Err(mpsc::TryRecvError::Empty)
            ));
            thread::sleep(Duration::from_millis(1));
        }
        // The worker has entered an actual CF native wait. No fixture timer,
        // notification or source signal keeps it alive during this interval.
        assert!(matches!(
            harness.done.recv_timeout(Duration::from_millis(350)),
            Err(mpsc::RecvTimeoutError::Timeout)
        ));
        assert!(probe(), "idle worker must still be in native wait");
        assert_eq!(harness.cleanups.load(Ordering::SeqCst), 0);
        let before = harness.callbacks.load(Ordering::SeqCst);
        post_policy_notification();
        assert!(
            harness.callbacks.load(Ordering::SeqCst) > before,
            "native observers remain registered while idle"
        );
        let Harness {
            controller,
            done,
            cleanups,
            callbacks,
            ..
        } = harness;
        let (joined_tx, joined_rx) = mpsc::channel();
        thread::spawn(move || {
            if !use_drop {
                controller.stop();
                controller.stop();
            }
            drop(controller);
            joined_tx.send(()).unwrap();
        });
        joined_rx
            .recv_timeout(Duration::from_secs(10))
            .expect("stop/Drop joins");
        done.recv_timeout(Duration::from_secs(10)).unwrap();
        assert_eq!(cleanups.load(Ordering::SeqCst), 1);
        let after = callbacks.load(Ordering::SeqCst);
        post_policy_notification();
        assert_eq!(
            callbacks.load(Ordering::SeqCst),
            after,
            "native observers were removed before join completed"
        );
    }
}

fn post_policy_notification() {
    use objc2_foundation::{NSNotificationCenter, NSProcessInfoPowerStateDidChangeNotification};
    objc2::rc::autoreleasepool(|_| unsafe {
        NSNotificationCenter::defaultCenter()
            .postNotificationName_object(NSProcessInfoPowerStateDidChangeNotification, None);
    });
}

#[test]
fn native_lifecycle_unexpected_return_cleans_observers_and_reports_failure() {
    let harness = start("unexpected");
    harness.done.recv_timeout(Duration::from_secs(10)).unwrap();
    assert_eq!(harness.cleanups.load(Ordering::SeqCst), 1);
    assert_eq!(
        harness.controller.snapshot().state,
        MacLifecycleState::ReconcileRequired
    );
    assert_eq!(
        harness.controller.snapshot().last_error.as_deref(),
        Some("macos_lifecycle_run_loop_exited_unexpectedly")
    );
    harness.controller.stop();
    assert_eq!(harness.cleanups.load(Ordering::SeqCst), 1);
}
