pub fn new_job_id(prefix: &str) -> String {
    format!("{prefix}-{}", uuid::Uuid::now_v7())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{collections::HashSet, thread};

    #[test]
    fn concurrent_uuid_job_ids_do_not_collide() {
        let handles = (0..10)
            .map(|_| thread::spawn(|| (0..1_000).map(|_| new_job_id("job")).collect::<Vec<_>>()))
            .collect::<Vec<_>>();
        let ids = handles
            .into_iter()
            .flat_map(|handle| handle.join().expect("id generator thread"))
            .collect::<Vec<_>>();
        let unique = ids.iter().collect::<HashSet<_>>();

        assert_eq!(ids.len(), 10_000);
        assert_eq!(unique.len(), ids.len());
    }
}
